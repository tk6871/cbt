#!/usr/bin/env python3
"""Import public COMCBT exam pages as searchable CBT data.

The importer intentionally reads the HTML exam view instead of cutting the
printable PDF into question images. Text remains searchable and responsive;
only diagrams and image-only choices are downloaded.
"""

from __future__ import annotations

import argparse
import html as html_std
import json
import re
import shutil
import time
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from lxml import etree, html


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Target:
    key: str
    name: str
    short_name: str
    index_paths: tuple[Path, ...]
    variable: str
    subject_ranges: tuple[tuple[int, int, str], ...]
    question_count: int = 60
    legacy_subject_ranges: tuple[tuple[int, int, str], ...] = ()
    legacy_before_year: int | None = None


@dataclass(frozen=True)
class Exam:
    exam_id: int
    year: int
    month: int
    day: int
    session: int
    session_label: str

    @property
    def date(self) -> str:
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d}"

    @property
    def compact_date(self) -> str:
        return f"{self.year:04d}{self.month:02d}{self.day:02d}"


def clean_text(value: str) -> str:
    value = value.replace("\xa0", " ").replace("\u200b", "").replace("\r", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def normalized_match_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", html.fromstring(f"<div>{value or ''}</div>").text_content()).lower()
    return re.sub(r"[^0-9a-z가-힣]", "", value)


def explanation_signature(question: dict) -> str:
    choices = sorted(normalized_match_text(choice.get("text") or choice.get("html") or "") for choice in question["choices"])
    answer_choice = question["choices"][question["answer"] - 1]
    return "|".join([
        normalized_match_text(question.get("text") or question.get("html") or ""),
        *choices,
        normalized_match_text(answer_choice.get("text") or answer_choice.get("html") or ""),
    ])


def reuse_exact_duplicate_explanations(catalog: dict) -> int:
    fallback = "등록된 상세 해설은 없습니다."
    candidates: dict[str, tuple[str, str]] = {}
    questions = [question for round_data in catalog["rounds"] for question in round_data["questions"]]
    for question in questions:
        if fallback in question["explanation"]:
            continue
        candidates.setdefault(
            explanation_signature(question),
            (question["explanation"], question.get("explanationHtml", "")),
        )
    reused = 0
    for question in questions:
        if fallback not in question["explanation"]:
            continue
        candidate = candidates.get(explanation_signature(question))
        if not candidate:
            continue
        question["explanation"], question["explanationHtml"] = candidate
        question["explanationProvenance"] = "comcbt-exact-duplicate"
        reused += 1
    return reused


def node_text(node: etree._Element) -> str:
    return clean_text("\n".join(node.itertext()))


def safe_inline_html(node: etree._Element) -> str:
    parts: list[str] = []

    def walk(current: etree._Element) -> None:
        if current.text:
            parts.append(html_std.escape(current.text))
        for child in current:
            tag = child.tag.lower() if isinstance(child.tag, str) else ""
            if tag == "br":
                parts.append("<br>")
            elif tag in {"sup", "sub"}:
                parts.append(f"<{tag}>")
                walk(child)
                parts.append(f"</{tag}>")
            elif tag != "img":
                walk(child)
            if child.tail:
                parts.append(html_std.escape(child.tail))

    walk(node)
    return re.sub(r"(?:<br>\s*){3,}", "<br><br>", "".join(parts)).strip()


def image_urls(node: etree._Element) -> list[str]:
    urls: list[str] = []
    images = ([node] if isinstance(node.tag, str) and node.tag.lower() == "img" and node.get("src") else [])
    images.extend(node.xpath(".//img[@src]"))
    for image in images:
        url = urljoin("https://www.comcbt.com", (image.get("src") or "").strip())
        path = urlsplit(url).path.lower()
        if not re.search(r"\.(?:gif|png|jpe?g|webp)$", path):
            continue
        if any(part in path for part in ("/icons/", "/layouts/", "/common/")):
            continue
        if url not in urls:
            urls.append(url)
    return urls


def question_subject(target: Target, exam: Exam, number: int) -> str:
    ranges = target.subject_ranges
    if target.legacy_subject_ranges and target.legacy_before_year and exam.year < target.legacy_before_year:
        ranges = target.legacy_subject_ranges
    for start, end, subject in ranges:
        if start <= number <= end:
            return subject
    return "공통"


def explanation_values(outer: etree._Element) -> tuple[str, str]:
    candidates = []
    for node in outer.xpath('.//font[translate(@color, "BLUE", "blue")="blue"]'):
        if "문제 해설" in node_text(node):
            candidates.append(node)
    if not candidates:
        return "", ""
    node = candidates[-1]
    text = re.sub(r"^<?\s*문제\s*해설\s*>?\s*", "", node_text(node)).strip()
    markup = re.sub(
        r"^(?:&lt;|<)?\s*문제\s*해설\s*(?:&gt;|>)?\s*(?:<br>)?",
        "",
        safe_inline_html(node),
        flags=re.I,
    ).strip()
    return text, markup


def local_asset(target: Target, exam: Exam, url: str) -> tuple[str, Path]:
    filename = Path(urlsplit(url).path).name
    filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename) or "image.gif"
    relative = Path("assets") / target.key / "comcbt" / exam.compact_date / "images" / filename
    return relative.as_posix(), ROOT / relative


def download_asset(url: str, output: Path) -> None:
    if output.exists() and output.stat().st_size > 32:
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            "Referer": "https://www.comcbt.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        output.write_bytes(response.read())
    time.sleep(0.04)


def parse_question(grid: etree._Element, target: Target, exam: Exam) -> tuple[dict, list[tuple[str, Path]]]:
    outer_cells = grid.xpath("./table[1]//tr[1]/td[1]")
    if not outer_cells:
        raise ValueError("question outer cell missing")
    outer = outer_cells[0]
    tables = outer.xpath("./table")
    if len(tables) < 5:
        raise ValueError(f"expected prompt and four choices, found {len(tables)}")

    prompt_cells = tables[0].xpath(".//tr[1]/td")
    number_match = re.search(r"\d+", node_text(prompt_cells[0]))
    if not number_match or len(prompt_cells) < 2:
        raise ValueError("invalid prompt row")
    number = int(number_match.group(0))
    prompt = prompt_cells[1]

    prompt_urls = image_urls(prompt)
    for image in outer.xpath("./img[@src]"):
        prompt_urls.extend(url for url in image_urls(image) if url not in prompt_urls)

    assets: list[tuple[str, Path]] = []
    choices = []
    for choice_number, table in enumerate(tables[1:5], start=1):
        cells = table.xpath(".//tr[1]/td")
        if len(cells) < 2:
            raise ValueError(f"question {number}: choice {choice_number} missing")
        urls = image_urls(cells[1])
        local_urls = []
        for url in urls:
            local, output = local_asset(target, exam, url)
            local_urls.append(local)
            assets.append((url, output))
        choices.append({
            "text": node_text(cells[1]),
            "html": safe_inline_html(cells[1]),
            "images": local_urls,
        })

    answer_nodes = outer.xpath(f'.//div[@id="jungdabcolor{number}"]')
    answer_match = re.search(r"[1-4]", node_text(answer_nodes[0])) if answer_nodes else None
    if not answer_match:
        raise ValueError(f"question {number}: answer missing")

    rate = None
    for green in outer.xpath('.//font[translate(@color, "GREEN", "green")="green"]'):
        match = re.search(r"정답률\s*:\s*(\d+)%", node_text(green))
        if match:
            rate = int(match.group(1))
            break

    explanation, explanation_html = explanation_values(outer)
    prompt_images = []
    for url in prompt_urls:
        local, output = local_asset(target, exam, url)
        prompt_images.append(local)
        assets.append((url, output))

    answer = int(answer_match.group(0))
    if not explanation:
        explanation = f"COMCBT 공개 시험 화면에서 정답은 {answer}번으로 확인됩니다. 등록된 상세 해설은 없습니다."

    return {
        "number": number,
        "text": node_text(prompt),
        "html": safe_inline_html(prompt),
        "images": prompt_images,
        "sourceImage": None,
        "choices": choices,
        "answer": answer,
        "answerRate": rate,
        "hint": "",
        "explanation": explanation,
        "explanationHtml": explanation_html,
        "_subject": question_subject(target, exam, number),
        "source": f"https://www.comcbt.com/cbt/problem/{exam.exam_id}/{number}/",
        "sourcePage": f"https://www.comcbt.com/cbt/exam/{exam.exam_id}/",
        "explanationProvenance": "comcbt-public-exam-view",
    }, assets


def parse_exam_file(target: Target, exam: Exam, html_path: Path) -> tuple[dict, dict[str, Path]]:
    document = html.fromstring(html_path.read_bytes())
    grids = document.xpath('//div[contains(concat(" ", normalize-space(@class), " "), " grid-box ")]')
    if len(grids) != target.question_count:
        raise ValueError(
            f"{target.name} {exam.date} {exam.session_label}: "
            f"expected {target.question_count} questions, found {len(grids)}"
        )

    questions = []
    asset_records: dict[str, Path] = {}
    for grid in grids:
        question, assets = parse_question(grid, target, exam)
        questions.append(question)
        for url, output in assets:
            asset_records[url] = output

    numbers = [item["number"] for item in questions]
    if numbers != list(range(1, target.question_count + 1)):
        raise ValueError(f"{target.name}: invalid question order {numbers}")

    subjects = list(dict.fromkeys(item["_subject"] for item in questions))
    round_id = f"{target.key}-{exam.year}-{exam.session}"
    if "추가" in exam.session_label or "통합" in exam.session_label:
        round_id = f"{round_id}-{exam.compact_date}"
    return {
        "id": round_id,
        "qualificationKey": target.key,
        "qualification": target.name,
        "shortQualification": target.short_name,
        "year": exam.year,
        "session": exam.session_label,
        "date": exam.date,
        "sortKey": exam.compact_date,
        "title": f"{exam.year}년 {exam.session_label} COMCBT 공개 기출",
        "subjects": subjects,
        "kind": "COMCBT 공개 시험 화면",
        "questions": questions,
    }, asset_records


def list_exams(target: Target) -> list[Exam]:
    text = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in target.index_paths)
    pattern = re.compile(
        rf"{re.escape(target.name)}(?:\(구\))?\s*필기\s*기출문제\s*"
        r"(20\d{2})년(\d{2})월(\d{2})일\s*\(([^)]*회[^)]*)\).*?"
        r"/cbt/exam/(\d+)/",
        re.S,
    )
    exams = []
    for year, month, day, session_label, exam_id in pattern.findall(text):
        session_match = re.search(r"\d+", session_label)
        if not session_match:
            continue
        exams.append(Exam(
            int(exam_id), int(year), int(month), int(day), int(session_match.group(0)),
            re.sub(r"\s+", " ", session_label.replace(",", "·")).strip(),
        ))
    unique = {exam.exam_id: exam for exam in exams}
    result = sorted(unique.values(), key=lambda exam: (exam.year, exam.month, exam.day), reverse=True)
    if not result:
        raise ValueError(f"{target.name}: no exam links found in {target.index_paths}")
    return result


def download_page(url: str, output: Path) -> None:
    if output.exists() and output.stat().st_size > 10000:
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            "Referer": "https://www.comcbt.com/",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        output.write_bytes(response.read())
    time.sleep(0.08)


def parse_target(target: Target, cache_root: Path, download_assets: bool = True) -> tuple[dict, dict[str, Path]]:
    exams = list_exams(target)
    output_root = ROOT / "assets" / target.key
    if download_assets and output_root.exists():
        shutil.rmtree(output_root)

    rounds = []
    all_assets: dict[str, Path] = {}
    for index, exam in enumerate(exams, start=1):
        cached_page = cache_root / target.key / f"{exam.exam_id}.html"
        download_page(f"https://www.comcbt.com/cbt/exam/{exam.exam_id}/", cached_page)
        round_data, assets = parse_exam_file(target, exam, cached_page)
        rounds.append(round_data)
        all_assets.update(assets)
        print(
            f"  [{index:02d}/{len(exams):02d}] {target.name} "
            f"{exam.date} {exam.session_label} {target.question_count}문제"
        )

    if download_assets:
        for index, (url, output) in enumerate(all_assets.items(), start=1):
            download_asset(url, output)
            if index % 100 == 0:
                print(f"  이미지 {index}/{len(all_assets)}")

    return {
        "key": target.key,
        "name": target.name,
        "shortName": target.short_name,
        "rounds": rounds,
    }, all_assets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--electric-index", type=Path)
    parser.add_argument("--gas-index", type=Path)
    parser.add_argument("--hazardous-index", type=Path)
    parser.add_argument("--information-current-index", type=Path)
    parser.add_argument("--information-old-index", type=Path)
    parser.add_argument("--cache-root", type=Path, default=Path("/private/tmp/cbt-comcbt-craftsman"))
    parser.add_argument("--skip-assets", action="store_true")
    parser.add_argument("--asset-manifest", type=Path)
    args = parser.parse_args()

    targets = []
    if args.electric_index:
        targets.append(Target(
            "electric-craftsman", "전기기능사", "전기기능사", (args.electric_index,),
            "CBT_DATA_ELECTRIC_CRAFTSMAN",
            ((1, 20, "전기이론"), (21, 40, "전기기기"), (41, 60, "전기설비")),
        ))
    if args.gas_index:
        targets.append(Target(
            "gas-craftsman", "가스기능사", "가스기능사", (args.gas_index,),
            "CBT_DATA_GAS_CRAFTSMAN",
            ((1, 30, "가스안전관리"), (31, 45, "가스장치 및 기기"), (46, 60, "가스일반")),
        ))
    if args.hazardous_index:
        targets.append(Target(
            "hazardous-craftsman", "위험물기능사", "위험물기능사", (args.hazardous_index,),
            "CBT_DATA_HAZARDOUS_CRAFTSMAN",
            ((1, 20, "화재예방과 소화방법"), (21, 60, "위험물의 화학적 성질 및 취급")),
        ))
    information_indexes = (args.information_current_index, args.information_old_index)
    if any(information_indexes):
        if not all(information_indexes):
            parser.error("정보처리기사는 현행·구 목록 파일을 모두 지정해야 합니다.")
        targets.append(Target(
            "information-engineer", "정보처리기사", "정보처리기사",
            tuple(path for path in information_indexes if path),
            "CBT_DATA_INFORMATION_ENGINEER",
            (
                (1, 20, "소프트웨어 설계"), (21, 40, "소프트웨어 개발"),
                (41, 60, "데이터베이스 구축"), (61, 80, "프로그래밍 언어 활용"),
                (81, 100, "정보시스템 구축관리"),
            ),
            question_count=100,
            legacy_subject_ranges=(
                (1, 20, "데이터베이스"), (21, 40, "전자계산기구조"),
                (41, 60, "운영체제"), (61, 80, "소프트웨어공학"),
                (81, 100, "데이터통신"),
            ),
            legacy_before_year=2020,
        ))
    if not targets:
        parser.error("가져올 종목 목록 파일을 하나 이상 지정해야 합니다.")
    asset_manifest: dict[str, str] = {}
    for target in targets:
        catalog, assets = parse_target(target, args.cache_root, download_assets=not args.skip_assets)
        reused = reuse_exact_duplicate_explanations(catalog)
        asset_manifest.update({url: str(output) for url, output in assets.items()})
        output = ROOT / "data" / f"{target.key}.js"
        output.write_text(
            f"window.{target.variable} = {json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))};\n",
            encoding="utf-8",
        )
        questions = [q for round_data in catalog["rounds"] for q in round_data["questions"]]
        image_count = sum(len(q["images"]) + sum(len(c["images"]) for c in q["choices"]) for q in questions)
        explained = sum(1 for q in questions if q["explanationProvenance"] == "comcbt-public-exam-view")
        print(f"{target.name}: {len(catalog['rounds'])}회차, {len(questions)}문제, 이미지 {image_count}개, 해설 {explained}문제")
        if reused:
            print(f"  동일 원문 검증 해설 재사용: {reused}문제")
    if args.asset_manifest:
        args.asset_manifest.parent.mkdir(parents=True, exist_ok=True)
        args.asset_manifest.write_text(
            json.dumps(asset_manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"이미지 매니페스트: {args.asset_manifest} ({len(asset_manifest)}개)")


if __name__ == "__main__":
    main()
