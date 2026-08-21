#!/usr/bin/env python3
"""Import user-supplied Hansol HVAC PDFs as a separate image-first catalog.

Vector PDFs are rendered directly at high resolution so mathematical symbols and
Korean glyphs stay sharper than an AI-resampled copy. The two 2020 scan PDFs use
precomputed PaddleOCR layout JSON only to locate question boundaries; the OCR
text never replaces the original page pixels.
"""

from __future__ import annotations

import argparse
import difflib
import html
import json
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber
from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PDFTOPPM = Path(
    "/Users/sh/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm"
)
CIRCLED = {"①": 1, "②": 2, "③": 3, "④": 4}


@dataclass(frozen=True)
class Source:
    year: int
    session: int
    filename: str
    root: str
    count: int
    source_round_id: str | None = None
    scanned: bool = False

    @property
    def slug(self) -> str:
        return f"{self.year}_{self.session}"


SOURCES = [
    Source(2017, 1, "2017년 제1회 공조냉동기계산업기사.pdf", "legacy", 80, "hvac-20170305"),
    Source(2017, 2, "2017년 제2회 공조냉동기계산업기사.pdf", "legacy", 80, "hvac-20170507"),
    Source(2017, 3, "2017년 제3회 공조냉동기계산업기사.pdf", "legacy", 80, "hvac-20170826"),
    Source(2018, 1, "[1]2018년 1회 공조기계산업기사 기출문제.pdf", "legacy", 80, "hvac-20180304"),
    Source(2018, 2, "[1]2018년 2회 공조기계산업기사 기출문제.pdf", "legacy", 80, "hvac-20180428"),
    Source(2018, 3, "2018년 3회 공조기계산업기사 기출문제.pdf", "legacy", 80, "hvac-20180819"),
    Source(2019, 1, "2019년 1회 공조냉동기계산업기사  기출문제.pdf", "legacy", 80, "hvac-20190303"),
    Source(2019, 2, "2019년 2회 공조냉동기계산업기사 기출문제.pdf", "legacy", 80, "hvac-20190427"),
    Source(2019, 3, "[1]2019년 3회 공조냉동기계산업기사 기출문제.pdf", "legacy", 80, "hvac-20190804"),
    Source(2020, 1, "1,2회 통합 필기 공조냉동기계산업기사 A형.pdf", "main", 80, "hvac-20200606", True),
    Source(2020, 3, "3회 필기 공조냉동기계산업기사 A형.pdf", "main", 80, "hvac-20200822", True),
    Source(2020, 4, "공조냉동기계산업기사(20년 4회)CBT.pdf", "main", 80),
    Source(2021, 1, "[2]21년 1회 필기 공조냉동기계산업기사 A형.pdf", "main", 80),
    Source(2021, 2, "[2]21년 2회 필기 공조냉동기계산업기사 A형.pdf", "main", 80),
    Source(2021, 3, "[2]21년 3회 필기 공조냉동기계산업기사 A형.pdf", "main", 80),
    Source(2022, 1, "2022년 공조냉동기계산업기사 제1회 필기.pdf", "main", 60, "hvac-20221"),
    Source(2022, 2, "2022년 공조냉동기계산업기사 제2회 필기.pdf", "main", 60, "hvac-20222"),
    Source(2022, 3, "2022년 공조냉동기계산업기사 제3회 필기.pdf", "main", 60, "hvac-20223"),
    Source(2023, 1, "2023년 공조냉동기계산업기사 제1회 필기 복원문제.pdf", "main", 60, "hvac-20231"),
    Source(2023, 2, "2023년 공조냉동기계산업기사 제2회 필기 복원문제.pdf", "main", 60, "hvac-20232"),
    Source(2023, 3, "2023년 공조냉동기계산업기사 제3회 필기 복원문제.pdf", "main", 60, "hvac-20233"),
    Source(2024, 1, "[홈페이지용]공조냉동기계산업기사 필기 24년 1회.pdf", "main", 60, "hvac-20241"),
    Source(2024, 2, "[홈페이지용]공조냉동기계산업기사 필기 24년 2회.pdf", "main", 60, "hvac-20242"),
    Source(2024, 3, "[홈페이지용]공조냉동기계산업기사 필기 24년 3회.pdf", "main", 60, "hvac-20243"),
    Source(2025, 1, "공조냉동기계산업기사-2025년 1회.pdf", "main", 60),
    Source(2025, 2, "공조냉동기계산업기사-2025년 2회.pdf", "main", 60),
    Source(2025, 3, "공조냉동기계산업기사-2025년 3회.pdf", "main", 60),
]


def load_hvac() -> dict[str, Any]:
    source = (PROJECT_ROOT / "data/hvac.js").read_text(encoding="utf-8")
    match = re.fullmatch(r"window\.CBT_DATA_HVAC=(.*);\s*", source, re.DOTALL)
    if not match:
        raise RuntimeError("data/hvac.js를 읽을 수 없습니다.")
    return json.loads(match.group(1))


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", html.unescape(value or "")).replace("\x00", "")
    value = re.sub(r"<[^>]+>", " ", value)
    return "".join(ch.lower() for ch in value if ch.isalnum() or "가" <= ch <= "힣")


def clean_block_text(value: str, number: int) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"한솔아카데미.*?(?=\n|$)", " ", value)
    value = re.sub(r"(?:온라인|학원)강의.*?(?=\n|$)", " ", value)
    value = re.sub(rf"^\s*0?{number}\s*[.)]?\s*", "", value.strip())
    return re.sub(r"\s+", " ", value).strip()


def split_question(value: str) -> tuple[str, list[str]]:
    parts = re.split(r"([①②③④])", value)
    stem = parts[0].strip()
    choices = ["", "", "", ""]
    for index in range(1, len(parts) - 1, 2):
        choice = CIRCLED.get(parts[index])
        if choice:
            choices[choice - 1] = parts[index + 1].strip()
    return stem, choices


def grouped_lines(words: list[dict[str, Any]]) -> list[list[str]]:
    lines: list[tuple[float, list[str]]] = []
    for word in sorted(words, key=lambda item: (item["top"], item["x0"])):
        if not lines or abs(lines[-1][0] - word["top"]) > 2.2:
            lines.append((word["top"], []))
        lines[-1][1].append(word["text"])
    return [tokens for _, tokens in lines]


def answer_table(document: pdfplumber.PDF, count: int) -> dict[int, int]:
    for page in reversed(document.pages):
        lines = grouped_lines(page.extract_words(x_tolerance=2, y_tolerance=2))
        answers: dict[int, int] = {}
        for index, tokens in enumerate(lines[:-1]):
            numbers = [int(token) for token in tokens if token.isdecimal() and 1 <= int(token) <= count]
            if len(numbers) < 5:
                continue
            answer_tokens = lines[index + 1]
            converted = [CIRCLED[token] if token in CIRCLED
                         else int(token) if token.isdecimal() and 1 <= int(token) <= 4
                         else 0 for token in answer_tokens]
            converted = [value for value in converted if value]
            if len(converted) != len(numbers):
                continue
            answers.update(zip(numbers, converted))
        if len(answers) == count:
            return answers
    return {}


def vector_candidates(document: pdfplumber.PDF, count: int) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for page_index, page in enumerate(document.pages):
        page_text = page.extract_text() or ""
        if "①" not in page_text or "④" not in page_text:
            continue
        for word in page.extract_words(x_tolerance=1, y_tolerance=2):
            dotted = re.match(r"^0?(\d{1,2})\.", word["text"])
            bare = re.fullmatch(r"(\d{2})", word["text"])
            match = dotted or bare
            if not match:
                continue
            number = int(match.group(1))
            x = float(word["x0"])
            column = 0 if x < 48 else 1 if 282 < x < 333 else None
            if column is None or not 1 <= number <= count or float(word["top"]) <= 35:
                continue
            candidates.append({
                "number": number,
                "page": page_index,
                "column": column,
                "top": float(word["top"]),
                "x": x,
                "dotted": bool(dotted),
            })
    return select_sequence(candidates, count)


def scan_candidates(ocr_pages: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for entry in ocr_pages:
        width = Image.open(entry["image"]).width
        for line in entry["lines"]:
            match = re.match(r"^\s*0?(\d{1,2})\s*[.)]", line["text"])
            if not match:
                continue
            number = int(match.group(1))
            x1, y1, _, _ = line["box"]
            ratio = x1 / width
            column = 0 if ratio < .16 else 1 if .44 < ratio < .64 else None
            if column is None or not 1 <= number <= count:
                continue
            candidates.append({
                "number": number,
                "page": int(entry["page"]) - 1,
                "column": column,
                "top": float(y1),
                "x": float(x1),
                "dotted": True,
                "pixel": True,
            })
    return select_sequence(candidates, count)


def select_sequence(candidates: list[dict[str, Any]], count: int) -> list[dict[str, Any]]:
    candidates.sort(key=lambda item: (item["page"], item["column"], item["top"]))
    selected: list[dict[str, Any]] = []
    position = (-1, -1, -1.0)
    for number in range(1, count + 1):
        available = [item for item in candidates
                     if item["number"] == number
                     and (item["page"], item["column"], item["top"]) > position]
        dotted = [item for item in available if item["dotted"]]
        if not (dotted or available):
            raise RuntimeError(f"문항 시작 위치를 찾지 못했습니다: {number}번")
        chosen = (dotted or available)[0]
        selected.append(chosen)
        position = (chosen["page"], chosen["column"], chosen["top"])
    return selected


def bounds_for(starts: list[dict[str, Any]], page_sizes: list[tuple[float, float]]) -> dict[int, tuple[int, int, float, float, float, float]]:
    result = {}
    for current in starts:
        page_width, page_height = page_sizes[current["page"]]
        same_column = [item for item in starts
                       if item["page"] == current["page"]
                       and item["column"] == current["column"]
                       and item["top"] > current["top"]]
        pixel = current.get("pixel", False)
        if pixel:
            x0 = 28 if current["column"] == 0 else page_width / 2 + 8
            x1 = page_width / 2 - 8 if current["column"] == 0 else page_width - 28
            top = max(0, current["top"] - 10)
            bottom = (same_column[0]["top"] - 8) if same_column else page_height - 92
        else:
            x0 = 12 if current["column"] == 0 else page_width / 2 + 2
            x1 = page_width / 2 - 2 if current["column"] == 0 else page_width - 12
            top = max(0, current["top"] - 4)
            bottom = (same_column[0]["top"] - 3) if same_column else page_height - 48
        result[current["number"]] = (current["page"], current["column"], x0, top, x1, bottom)
    return result


def remove_yellow(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            red, green, blue = pixels[x, y]
            if abs(red - green) <= 12 and min(red, green) - blue >= 8:
                neutral = max(red, green)
                pixels[x, y] = (neutral, neutral, neutral)
    return rgb


def trim_and_save(image: Image.Image, destination: Path, remove_highlight: bool) -> None:
    image = remove_yellow(image) if remove_highlight else image.convert("RGB")
    gray = ImageOps.grayscale(image)
    mask = gray.point(lambda value: 255 if value < 248 else 0)
    bbox = mask.getbbox()
    if bbox:
        image = image.crop((max(0, bbox[0] - 8), max(0, bbox[1] - 8),
                            min(image.width, bbox[2] + 8), min(image.height, bbox[3] + 8)))
    image = ImageOps.expand(image, border=14, fill="white")
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", lossless=True, method=6)


def inline_highlight_answers(document: pdfplumber.PDF, bounds: dict[int, tuple[int, int, float, float, float, float]]) -> dict[int, int]:
    answers: dict[int, int] = {}
    for number, (page_index, _, x0, top, x1, bottom) in bounds.items():
        page = document.pages[page_index]
        yellow = [rect for rect in page.rects
                  if rect.get("non_stroking_color") == (1.0, 1.0, 0.0)
                  and x0 <= (rect["x0"] + rect["x1"]) / 2 <= x1
                  and top <= (rect["top"] + rect["bottom"]) / 2 <= bottom]
        markers = [word for word in page.extract_words(x_tolerance=1, y_tolerance=2)
                   if word["text"] in CIRCLED and x0 <= word["x0"] <= x1 and top <= word["top"] <= bottom]
        if len(yellow) != 1 or not markers:
            continue
        rect = yellow[0]
        center = ((rect["x0"] + rect["x1"]) / 2, (rect["top"] + rect["bottom"]) / 2)
        marker = min(markers, key=lambda word: abs((word["x0"] + word["x1"]) / 2 - center[0])
                     + abs((word["top"] + word["bottom"]) / 2 - center[1]))
        answers[number] = CIRCLED[marker["text"]]
    return answers


def render_pdf(pdf_path: Path, destination: Path, resolution: int) -> list[Path]:
    destination.mkdir(parents=True, exist_ok=True)
    prefix = destination / "page"
    existing = sorted(destination.glob("page-*.png"), key=lambda path: int(re.search(r"(\d+)$", path.stem).group(1)))
    if existing:
        return existing
    subprocess.run([str(PDFTOPPM), "-png", "-r", str(resolution), str(pdf_path), str(prefix)], check=True)
    return sorted(destination.glob("page-*.png"), key=lambda path: int(re.search(r"(\d+)$", path.stem).group(1)))


def best_explanation(question_copy: str, answer: int, candidates: list[dict[str, Any]]) -> tuple[str, str, float]:
    target = normalize(question_copy)
    exact = [item for item in candidates if item["normalized"] == target and item["answer"] == answer and item["explanation"]]
    if exact:
        return exact[0]["explanation"], exact[0]["id"], 1.0
    target_chars = set(target)
    best: tuple[float, dict[str, Any] | None] = (0.0, None)
    for item in candidates:
        other = item["normalized"]
        if item["answer"] != answer or not item["explanation"] or not other:
            continue
        length_ratio = min(len(target), len(other)) / max(len(target), len(other), 1)
        if length_ratio < .55 or len(target_chars & set(other)) / max(1, len(target_chars)) < .52:
            continue
        score = difflib.SequenceMatcher(None, target, other, autojunk=False).ratio()
        if score > best[0]:
            best = (score, item)
    if best[1] and best[0] >= .94:
        return best[1]["explanation"], best[1]["id"], best[0]
    return "", "", best[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--main-root", type=Path, required=True)
    parser.add_argument("--legacy-root", type=Path, required=True)
    parser.add_argument("--scan-ocr-root", type=Path, required=True,
                        help="2020-combined/ocr.json과 2020-third/ocr.json이 있는 상위 폴더")
    parser.add_argument("--output-data", type=Path, default=PROJECT_ROOT / "data/hvac-hansol.js")
    parser.add_argument("--output-assets", type=Path, default=PROJECT_ROOT / "assets/hvac-hansol/questions")
    parser.add_argument("--report", type=Path, default=PROJECT_ROOT / "work/hansol-import-report.json")
    parser.add_argument("--render-cache", type=Path, default=Path("/private/tmp/cbt-hansol-render-cache"))
    parser.add_argument("--skip-images", action="store_true",
                        help="이미지는 유지하고 문제 데이터와 해설 연결만 다시 생성")
    args = parser.parse_args()

    hvac = load_hvac()
    rounds_by_id = {round_["id"]: round_ for round_ in hvac["rounds"]}
    explanation_candidates = []
    for round_ in hvac["rounds"]:
        for question in round_["questions"]:
            text = question.get("text") or question.get("html") or ""
            explanation_candidates.append({
                "id": f'{round_["id"]}:{question["number"]}',
                "normalized": normalize(" ".join([
                    text,
                    *[(choice.get("text") or choice.get("html") or "")
                      for choice in question.get("choices", [])],
                ])),
                "answer": question.get("answer"),
                "explanation": question.get("explanation") or "",
            })

    output_rounds = []
    report: dict[str, Any] = {"rounds": [], "totals": {"questions": 0, "matched_explanations": 0, "fallback_explanations": 0}}
    args.render_cache.mkdir(parents=True, exist_ok=True)
    temporary_root = args.render_cache
    for source in SOURCES:
            source_root = args.main_root if source.root == "main" else args.legacy_root
            pdf_path = source_root / source.filename
            if not pdf_path.is_file():
                raise FileNotFoundError(pdf_path)
            render_root = temporary_root / source.slug
            page_images = render_pdf(pdf_path, render_root, 180 if source.scanned else 240)

            with pdfplumber.open(pdf_path) as document:
                if source.scanned:
                    ocr_name = "2020-combined" if source.session == 1 else "2020-third"
                    ocr_pages = json.loads((args.scan_ocr_root / ocr_name / "ocr.json").read_text(encoding="utf-8"))
                    starts = scan_candidates(ocr_pages, source.count)
                    page_sizes = [Image.open(path).size for path in page_images]
                else:
                    starts = vector_candidates(document, source.count)
                    page_sizes = [(float(page.width), float(page.height)) for page in document.pages]
                bounds = bounds_for(starts, page_sizes)
                answers = {}
                if source.source_round_id and source.scanned:
                    answers = {question["number"]: question["answer"]
                               for question in rounds_by_id[source.source_round_id]["questions"]}
                elif source.year == 2025:
                    answers = inline_highlight_answers(document, bounds)
                else:
                    answers = answer_table(document, source.count)
                if len(answers) != source.count:
                    missing = sorted(set(range(1, source.count + 1)) - set(answers))
                    raise RuntimeError(f"{source.filename}: 정답 {len(answers)}/{source.count}, 누락 {missing}")

                source_round = rounds_by_id.get(source.source_round_id or "")
                questions = []
                matched = 0
                for number in range(1, source.count + 1):
                    page_index, _, x0, top, x1, bottom = bounds[number]
                    page_image = Image.open(page_images[page_index])
                    if source.scanned:
                        crop_box = (int(x0), int(top), int(x1), int(bottom))
                        block_text = " ".join(
                            line["text"] for line in ocr_pages[page_index]["lines"]
                            if x0 <= (line["box"][0] + line["box"][2]) / 2 <= x1
                            and top <= (line["box"][1] + line["box"][3]) / 2 <= bottom
                        )
                    else:
                        scale_x = page_image.width / document.pages[page_index].width
                        scale_y = page_image.height / document.pages[page_index].height
                        crop_box = (int(x0 * scale_x), int(top * scale_y), int(x1 * scale_x), int(bottom * scale_y))
                        block_text = document.pages[page_index].crop((x0, top, x1, bottom)).extract_text() or ""
                    destination = args.output_assets / source.slug / f"{number:02}.webp"
                    if not args.skip_images:
                        trim_and_save(page_image.crop(crop_box), destination, source.year == 2025)

                    cleaned = clean_block_text(block_text, number)
                    stem, choices = split_question(cleaned)
                    answer = answers[number]
                    base_question = None
                    if source_round:
                        base_question = next((item for item in source_round["questions"] if item["number"] == number), None)
                    explanation = ""
                    provenance = ""
                    match_score = 0.0
                    if base_question and base_question.get("answer") == answer and base_question.get("explanation"):
                        explanation = base_question["explanation"]
                        provenance = f'{source.source_round_id}:{number}'
                        match_score = 1.0
                    if not explanation:
                        explanation, provenance, match_score = best_explanation(cleaned, answer, explanation_candidates)
                    if explanation:
                        matched += 1
                    else:
                        answer_copy = choices[answer - 1] if len(choices) >= answer else ""
                        explanation = (f"한솔아카데미 문제지의 정답 표시 기준으로 {CIRCLED_REVERSE[answer]}번"
                                       + (f" ‘{answer_copy[:90]}’" if answer_copy else "")
                                       + "이 정답입니다. 이 문항은 제공 PDF에 별도 해설이 없어 정답 기준만 먼저 연결했습니다.")
                        provenance = "hansol-answer-only"

                    questions.append({
                        "number": number,
                        "text": stem or cleaned,
                        "html": html.escape(stem or cleaned),
                        "images": [],
                        "sourceImage": destination.relative_to(PROJECT_ROOT).as_posix(),
                        "choices": [{"text": choice or f"{index + 1}번", "html": html.escape(choice or f"{index + 1}번"), "images": []}
                                    for index, choice in enumerate(choices)],
                        "answer": answer,
                        "answerRate": None,
                        "hint": "",
                        "explanation": explanation,
                        "explanationHtml": "",
                        "imageOnly": True,
                        "source": "한솔아카데미 제공 PDF",
                        "explanationProvenance": provenance,
                        "explanationMatchScore": round(match_score, 4),
                    })

                subjects = (["공기조화", "냉동공학", "배관일반", "전기제어공학"]
                            if source.count == 80 else ["공기조화설비", "냉동냉장설비", "공조냉동설치운영"])
                output_rounds.append({
                    "id": f"hvac-hansol-{source.year}-{source.session}",
                    "qualification": "한솔아카데미 공조냉동 문제",
                    "qualificationKey": "hvac-hansol",
                    "shortQualification": "한솔 공조",
                    "kind": "hansol-hvac",
                    "date": "",
                    "sortKey": f"{source.year}{source.session:02}",
                    "year": source.year,
                    "session": "1·2회 통합" if source.year == 2020 and source.session == 1 else f"{source.session}회",
                    "title": f"한솔아카데미 공조냉동기계산업기사 {source.year}년 "
                             + ("1·2회 통합" if source.year == 2020 and source.session == 1 else f"{source.session}회"),
                    "subjects": subjects,
                    "questions": questions,
                    "source": "한솔아카데미 제공 PDF",
                    "examMinutes": 120 if source.count == 80 else 90,
                })
                fallback = source.count - matched
                report["rounds"].append({"slug": source.slug, "questions": source.count,
                                         "matchedExplanations": matched, "fallbackExplanations": fallback})
                report["totals"]["questions"] += source.count
                report["totals"]["matched_explanations"] += matched
                report["totals"]["fallback_explanations"] += fallback
                print(f"{source.slug}: {source.count}문항, 기존 해설 연결 {matched}, 정답 기준 안내 {fallback}", flush=True)

    catalog = {"key": "hvac-hansol", "name": "한솔아카데미 공조 문제", "shortName": "한솔 공조", "rounds": output_rounds}
    args.output_data.parent.mkdir(parents=True, exist_ok=True)
    args.output_data.write_text("window.CBT_DATA_HANSOL_HVAC=" + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["totals"], ensure_ascii=False))


CIRCLED_REVERSE = {value: key for key, value in CIRCLED.items()}


if __name__ == "__main__":
    main()
