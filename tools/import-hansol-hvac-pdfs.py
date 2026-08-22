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

# Six source pages either print a malformed circled number (for example @ or
# a duplicated ②) or contain diagram-only choices that OCR cannot label
# reliably.  These rectangles were checked against the final saved WebP.
REVIEWED_HOTSPOTS: dict[tuple[str, int], list[tuple[float, float, float, float]]] = {
    ("2018_3", 60): [(6.49, 14.92, 15.35, 12.12), (50.77, 14.92, 15.35, 12.12), (6.49, 27.04, 15.35, 12.35), (50.77, 27.04, 15.35, 12.35)],
    ("2020_1", 50): [(10.85, 45.90, 21.35, 21.48), (51.37, 45.90, 20.98, 21.48), (10.85, 68.36, 21.35, 20.51), (51.37, 68.36, 20.98, 20.51)],
    ("2020_1", 80): [(11.53, 33.90, 39.27, 17.18), (51.87, 33.90, 38.90, 17.18), (11.53, 51.08, 39.27, 17.03), (51.87, 51.08, 38.90, 17.03)],
    ("2020_3", 14): [(7.14, 22.00, 46.22, 37.01), (53.78, 22.00, 42.86, 37.01), (7.14, 59.01, 46.22, 36.48), (53.78, 59.01, 42.86, 36.48)],
    ("2020_3", 15): [(7.65, 67.91, 27.21, 14.77), (54.42, 67.91, 30.61, 14.77), (7.65, 82.68, 27.21, 15.75), (54.42, 82.68, 30.61, 15.75)],
    ("2020_3", 74): [(8.58, 53.32, 72.39, 8.50), (8.58, 64.91, 72.39, 8.50), (8.58, 76.51, 72.39, 8.50), (8.58, 88.10, 72.39, 9.66)],
    ("2022_3", 59): [(1.77, 22.76, 59.70, 15.86), (1.77, 40.00, 59.70, 17.93), (1.77, 57.93, 59.70, 18.62), (1.77, 76.55, 59.70, 19.31)],
    # Diagram-only choices and unusually compact 2x2 answers need the full
    # printed choice, not only the circled marker detected in the PDF layer.
    ("2019_3", 60): [(6.50, 10.10, 19.50, 3.10), (47.00, 10.10, 20.00, 3.10), (6.50, 13.90, 19.50, 4.20), (47.00, 13.90, 18.00, 5.00)],
    ("2020_4", 29): [(2.00, 83.50, 39.00, 7.80), (46.30, 83.50, 39.00, 7.80), (2.00, 91.50, 39.00, 8.00), (46.30, 91.50, 39.00, 8.00)],
    ("2021_1", 4): [(1.91, 27.03, 29.03, 16.59), (1.91, 43.62, 29.03, 14.95), (1.91, 58.57, 29.03, 13.24), (1.91, 72.01, 29.03, 14.50)],
    ("2021_2", 17): [(1.91, 14.42, 73.45, 7.25), (1.91, 24.97, 93.61, 18.56), (1.91, 46.61, 93.61, 17.59), (1.91, 67.37, 93.61, 18.00)],
    ("2021_3", 70): [(4.59, 33.58, 22.50, 14.33), (4.59, 47.91, 29.63, 12.71), (4.59, 60.62, 21.58, 12.77), (4.59, 73.39, 28.70, 13.00)],
    ("2023_3", 2): [(1.50, 36.60, 74.00, 10.00), (1.50, 48.00, 74.00, 10.00), (1.50, 59.30, 74.00, 10.00), (1.50, 70.70, 74.00, 10.30)],
    ("2024_1", 2): [(1.90, 69.00, 14.20, 11.80), (17.00, 69.00, 15.20, 11.80), (1.90, 83.20, 14.20, 11.80), (17.00, 83.20, 15.20, 11.80)],
    ("2024_2", 2): [(1.50, 46.90, 74.00, 10.30), (1.50, 60.80, 74.00, 10.30), (1.50, 74.40, 74.00, 10.30), (1.50, 88.00, 74.00, 10.20)],
}

# The 2021 source prints an unrelated stem above the delay-time choices, while
# the 2025 text layer cuts one duct question off mid-sentence. Keep the visible
# study text aligned with the printed choices and the known COMCBT source.
QUESTION_TEXT_CORRECTIONS: dict[tuple[str, int], str] = {
    ("2020_4", 29): ("암모니아 냉동기의 증발온도 -20℃, 응축온도 35℃일 때 ① 이론 성적계수와 "
                      "② 실제 성적계수는 약 얼마인가? (단, 팽창밸브 직전의 액온도는 32℃, "
                      "흡입가스는 건포화증기이고, 체적효율은 0.65, 압축효율은 0.80, "
                      "기계효율은 0.9로 한다.)"),
    ("2021_2", 79): "자동제어계에서 과도응답 중 지연시간을 옳게 정의한 것은?",
    ("2025_3", 9): ("다음 그림과 같은 덕트에서 점 ①의 정압 P₁=15mmAq, 속도 V₁=10m/s일 때, "
                    "점 ②에서의 전압은? (단, ①-② 구간의 전압손실은 2mmAq, "
                    "공기의 밀도는 1kg/m³로 한다.)"),
}

QUESTION_CHOICE_CORRECTIONS: dict[tuple[str, int], list[str]] = {
    ("2020_4", 29): ["① 0.5, ② 3.8", "① 3.9, ② 2.8", "① 3.5, ② 2.5", "① 4.3, ② 2.8"],
}


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


def question_signature(stem: str, choices: list[str]) -> str:
    return normalize(" ".join([stem, *choices]))


def clean_block_text(value: str, number: int) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"한솔아카데미.*?(?=\n|$)", " ", value)
    value = re.sub(r"(?:온라인|학원)강의.*?(?=\n|$)", " ", value)
    value = re.sub(r"시행일\s*20\d{2}년\s*\d+회\s*필기", " ", value)
    value = re.sub(r"\S*\s*미리\s*알려드립니다\.?", " ", value)
    value = re.sub(r"제\s*\d\s*과목\s*[:：].*$", " ", value, flags=re.DOTALL)
    value = re.sub(r"TEL\.?\s*\d{3,4}[-－]\d{4}.*$", " ", value, flags=re.IGNORECASE | re.DOTALL)
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


def hansol_answer_hotspots(
    crop_box: tuple[float, float, float, float],
    markers: list[dict[str, Any]],
    text_boxes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build one tight, non-overlapping clickable rectangle per printed answer."""
    x0, top, x1, bottom = crop_box
    width, height = max(1.0, x1 - x0), max(1.0, bottom - top)
    selected: dict[int, dict[str, Any]] = {}
    for marker in markers:
        choice = marker.get("choice")
        if choice not in CIRCLED.values():
            continue
        # Diagrams can also contain circled labels. Printed choices are normally
        # the lowest complete ①~④ set, so retain the lowest occurrence.
        if choice not in selected or marker["top"] > selected[choice]["top"]:
            selected[choice] = marker
    if set(selected) != {1, 2, 3, 4}:
        return []

    # Circled markers on the same printed row share nearly the same baseline.
    # A tolerance derived from glyph height can become larger than the gap
    # between compact 2x2 rows, so use the final crop height instead.
    row_tolerance = max(2.0, height * .012)
    vertical_gaps = sorted(
        abs(left["top"] - right["top"])
        for left in selected.values()
        for right in selected.values()
        if abs(left["top"] - right["top"]) > row_tolerance
    )
    fallback_gap = vertical_gaps[len(vertical_gaps) // 2] if vertical_gaps else height * .065
    output: list[dict[str, Any]] = []

    for choice in sorted(selected):
        marker = selected[choice]
        marker_center_y = (marker["top"] + marker["bottom"]) / 2
        same_row = sorted(
            (other_choice for other_choice, other in selected.items()
             if abs((other["top"] + other["bottom"]) / 2 - marker_center_y) <= row_tolerance),
            key=lambda other_choice: selected[other_choice]["x0"],
        )
        row_index = same_row.index(choice)
        # Each answer owns the space from just before its printed marker to
        # just before the next marker in the same row. This handles 1-column,
        # 2x2 and four-answers-on-one-line layouts without assuming a fixed
        # numbering order, and it does not cut long left-hand text in half.
        owner_left = x0 if row_index == 0 else marker["x0"] - width * .008
        owner_right = (selected[same_row[row_index + 1]]["x0"] - width * .008
                       if row_index + 1 < len(same_row) else x1)
        owner_top = marker["top"] - max(2.0, marker["bottom"] - marker["top"]) * .22
        below = [other for other in selected.values()
                 if other["top"] > marker["top"] + row_tolerance
                 and abs(other["x0"] - marker["x0"]) <= width * .12]
        next_marker = min(below, key=lambda other: other["top"], default=None)
        owner_bottom = (next_marker["top"] - 1 if next_marker
                        else min(bottom, marker["top"] + max(fallback_gap, height * .065)))
        relevant = [box for box in text_boxes
                    if owner_left <= (box["x0"] + box["x1"]) / 2 <= owner_right
                    and owner_top <= (box["top"] + box["bottom"]) / 2 <= owner_bottom
                    and not re.search(r"한솔아카데미|온라인강의|학원강의|inup\.co\.kr|1670[-－]?\d+|TEL", box.get("text", ""), re.I)]
        relevant.append(marker)
        left = max(owner_left, min(box["x0"] for box in relevant) - width * .004)
        rect_top = max(top, min(box["top"] for box in relevant) - height * .004)
        right = min(owner_right, max(box["x1"] for box in relevant) + width * .004)
        rect_bottom = min(owner_bottom, max(box["bottom"] for box in relevant) + height * .004)
        rect = {
            "x": round((left - x0) / width * 100, 2),
            "y": round((rect_top - top) / height * 100, 2),
            "width": round(max(1.0, right - left) / width * 100, 2),
            "height": round(max(1.0, rect_bottom - rect_top) / height * 100, 2),
        }
        output.append({"choice": choice, **rect, "segments": [rect]})
    # Rounded OCR/PDF margins can overlap a neighbouring answer by a few
    # pixels.  Hover, click and selection all use this same rectangle in the
    # app, so split every shared sliver before writing the catalog.
    for _ in range(4):
        changed = False
        for left_index in range(len(output)):
            for right_index in range(left_index + 1, len(output)):
                left_box, right_box = output[left_index], output[right_index]
                overlap_x = min(left_box["x"] + left_box["width"], right_box["x"] + right_box["width"]) - max(left_box["x"], right_box["x"])
                overlap_y = min(left_box["y"] + left_box["height"], right_box["y"] + right_box["height"]) - max(left_box["y"], right_box["y"])
                if overlap_x <= 0 or overlap_y <= 0:
                    continue
                left_center = left_box["x"] + left_box["width"] / 2
                right_center = right_box["x"] + right_box["width"] / 2
                top_center = left_box["y"] + left_box["height"] / 2
                bottom_center = right_box["y"] + right_box["height"] / 2
                # Same-row answers are separated horizontally; same-column
                # answers are separated vertically.  For diagonal OCR noise,
                # trim the axis that loses the smaller relative amount.
                horizontal_cost = overlap_x / max(.01, min(left_box["width"], right_box["width"]))
                vertical_cost = overlap_y / max(.01, min(left_box["height"], right_box["height"]))
                split_x = abs(left_center - right_center) > 18 or horizontal_cost < vertical_cost
                if split_x:
                    first, second = (left_box, right_box) if left_center <= right_center else (right_box, left_box)
                    first_edge = first["x"] + first["width"]
                    boundary = round((first_edge + second["x"]) / 2, 3)
                    first["width"] = round(max(.01, boundary - first["x"]), 3)
                    second_edge = second["x"] + second["width"]
                    second["x"] = boundary
                    second["width"] = round(max(.01, second_edge - boundary), 3)
                else:
                    first, second = (left_box, right_box) if top_center <= bottom_center else (right_box, left_box)
                    first_edge = first["y"] + first["height"]
                    boundary = round((first_edge + second["y"]) / 2, 3)
                    first["height"] = round(max(.01, boundary - first["y"]), 3)
                    second_edge = second["y"] + second["height"]
                    second["y"] = boundary
                    second["height"] = round(max(.01, second_edge - boundary), 3)
                changed = True
        if not changed:
            break

    for item in output:
        item["segments"] = [{key: item[key] for key in ("x", "y", "width", "height")}]
    return sorted(output, key=lambda item: item["choice"])


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


def prepare_question_image(image: Image.Image, remove_highlight: bool) -> tuple[Image.Image, int, int]:
    """Return final image plus the source-crop origin represented at (0, 0).

    The returned offsets let PDF/OCR rectangles follow the exact whitespace
    trim and 14px border applied to the saved WebP.
    """
    image = remove_yellow(image) if remove_highlight else image.convert("RGB")
    gray = ImageOps.grayscale(image)
    mask = gray.point(lambda value: 255 if value < 248 else 0)
    bbox = mask.getbbox()
    if bbox:
        left, upper = max(0, bbox[0] - 8), max(0, bbox[1] - 8)
        image = image.crop((left, upper, min(image.width, bbox[2] + 8), min(image.height, bbox[3] + 8)))
    else:
        left, upper = 0, 0
    image = ImageOps.expand(image, border=14, fill="white")
    return image, left - 14, upper - 14


def save_question_image(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", lossless=True, method=6)


def transform_boxes(
    boxes: list[dict[str, Any]],
    scale_x: float,
    scale_y: float,
    crop_box: tuple[int, int, int, int],
    offset_x: int,
    offset_y: int,
) -> list[dict[str, Any]]:
    transformed = []
    for box in boxes:
        transformed.append({
            **box,
            "x0": box["x0"] * scale_x - crop_box[0] - offset_x,
            "x1": box["x1"] * scale_x - crop_box[0] - offset_x,
            "top": box["top"] * scale_y - crop_box[1] - offset_y,
            "bottom": box["bottom"] * scale_y - crop_box[1] - offset_y,
        })
    return transformed


def remove_joined_page_chrome(
    image: Image.Image,
    text_boxes: list[dict[str, Any]],
    marker_boxes: list[dict[str, Any]],
) -> tuple[Image.Image, list[dict[str, Any]], list[dict[str, Any]]]:
    """Remove an exam-page heading that lands inside a cross-page question.

    The actual question pixels and answer rectangles remain unchanged; only
    the intervening `시행일 / 20xx년 n회 필기` announcement strip is removed.
    """
    anchors = [box for box in text_boxes
               if re.search(r"시행일|20\d{2}년|알려드립니다", str(box.get("text", "")))]
    if not anchors:
        return image, text_boxes, marker_boxes

    top = max(0, int(min(box["top"] for box in anchors) - 34))
    bottom = min(image.height, int(max(box["bottom"] for box in anchors) + 42))
    if bottom <= top or bottom - top > image.height * .32:
        return image, text_boxes, marker_boxes
    cleaned = Image.new("RGB", (image.width, image.height - (bottom - top)), "white")
    cleaned.paste(image.crop((0, 0, image.width, top)), (0, 0))
    cleaned.paste(image.crop((0, bottom, image.width, image.height)), (0, top))

    def adjust(boxes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        removed = bottom - top
        for source_box in boxes:
            center = (source_box["top"] + source_box["bottom"]) / 2
            if center < top:
                result.append({**source_box, "bottom": min(source_box["bottom"], top)})
            elif center > bottom:
                result.append({**source_box,
                               "top": max(source_box["top"], bottom) - removed,
                               "bottom": source_box["bottom"] - removed})
        return result

    return cleaned, adjust(text_boxes), adjust(marker_boxes)


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


def best_stem_explanation(stem: str, answer: int, candidates: list[dict[str, Any]]) -> tuple[str, str, float]:
    """Recover explanations when PDF choice extraction differs but the stem is the same."""
    target = normalize(stem)
    if len(target) < 8:
        return "", "", 0.0
    exact = [item for item in candidates if item["stem"] == target and item["answer"] == answer and item["explanation"]]
    if exact:
        return exact[0]["explanation"], exact[0]["id"], 1.0
    target_chars = set(target)
    best: tuple[float, dict[str, Any] | None] = (0.0, None)
    for item in candidates:
        other = item["stem"]
        if item["answer"] != answer or not item["explanation"] or not other:
            continue
        length_ratio = min(len(target), len(other)) / max(len(target), len(other), 1)
        if length_ratio < .72 or len(target_chars & set(other)) / max(1, len(target_chars)) < .72:
            continue
        score = difflib.SequenceMatcher(None, target, other, autojunk=False).ratio()
        if score > best[0]:
            best = (score, item)
    if best[1] and best[0] >= .975:
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
    parser.add_argument("--save-image", action="append", default=[],
                        help="slug/번호 형식으로 지정한 이미지만 다시 저장")
    args = parser.parse_args()
    scan_hotspots_path = PROJECT_ROOT / "data/hansol-scan-hotspots.json"
    scan_hotspots = json.loads(scan_hotspots_path.read_text(encoding="utf-8")) if scan_hotspots_path.is_file() else {}
    pixel_hotspots_path = PROJECT_ROOT / "data/hansol-pixel-hotspot-overrides.json"
    pixel_hotspots = json.loads(pixel_hotspots_path.read_text(encoding="utf-8")) if pixel_hotspots_path.is_file() else {}

    hvac = load_hvac()
    rounds_by_id = {round_["id"]: round_ for round_ in hvac["rounds"]}
    explanation_candidates = []
    for round_ in hvac["rounds"]:
        for question in round_["questions"]:
            text = question.get("text") or question.get("html") or ""
            explanation_candidates.append({
                "id": f'{round_["id"]}:{question["number"]}',
                "stem": normalize(text),
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
                        scale_x = scale_y = 1.0
                        question_lines = [line for line in ocr_pages[page_index]["lines"]
                            if x0 <= (line["box"][0] + line["box"][2]) / 2 <= x1
                            and top <= (line["box"][1] + line["box"][3]) / 2 <= bottom
                        ]
                        block_text = " ".join(line["text"] for line in question_lines)
                        marker_boxes = []
                        text_boxes = []
                        for line in question_lines:
                            lx0, ltop, lx1, lbottom = map(float, line["box"])
                            text = line["text"]
                            positions = [(index, CIRCLED[symbol]) for index, symbol in enumerate(text) if symbol in CIRCLED]
                            if positions:
                                for position_index, (character_index, choice) in enumerate(positions):
                                    next_index = positions[position_index + 1][0] if position_index + 1 < len(positions) else len(text)
                                    char_left = lx0 + (lx1 - lx0) * character_index / max(1, len(text))
                                    char_right = min(lx1, char_left + max(6.0, lbottom - ltop))
                                    marker_boxes.append({"choice": choice, "x0": char_left, "top": ltop, "x1": char_right, "bottom": lbottom, "text": text[character_index:character_index + 1]})
                                    text_boxes.append({"x0": char_left, "top": ltop,
                                                       "x1": lx0 + (lx1 - lx0) * next_index / max(1, len(text)),
                                                       "bottom": lbottom, "text": text[character_index:next_index]})
                            else:
                                text_boxes.append({"x0": lx0, "top": ltop, "x1": lx1, "bottom": lbottom, "text": text})
                    else:
                        scale_x = page_image.width / document.pages[page_index].width
                        scale_y = page_image.height / document.pages[page_index].height
                        crop_box = (int(x0 * scale_x), int(top * scale_y), int(x1 * scale_x), int(bottom * scale_y))
                        source_page = document.pages[page_index]
                        block_text = source_page.crop((x0, top, x1, bottom)).extract_text() or ""
                        text_boxes = [{"x0": float(word["x0"]), "top": float(word["top"]),
                                       "x1": float(word["x1"]), "bottom": float(word["bottom"]), "text": word["text"]}
                                      for word in source_page.extract_words(x_tolerance=1, y_tolerance=2)
                                      if x0 <= (float(word["x0"]) + float(word["x1"])) / 2 <= x1
                                      and top <= (float(word["top"]) + float(word["bottom"])) / 2 <= bottom]
                        marker_boxes = [{"choice": CIRCLED[character["text"]], "x0": float(character["x0"]),
                                         "top": float(character["top"]), "x1": float(character["x1"]),
                                         "bottom": float(character["bottom"]), "text": character["text"]}
                                        for character in source_page.chars
                                        if character.get("text") in CIRCLED
                                        and x0 <= (float(character["x0"]) + float(character["x1"])) / 2 <= x1
                                        and top <= (float(character["top"]) + float(character["bottom"])) / 2 <= bottom]
                    destination = args.output_assets / source.slug / f"{number:02}.webp"
                    prepared_image, trim_x, trim_y = prepare_question_image(page_image.crop(crop_box), source.year == 2025)
                    marker_boxes = transform_boxes(marker_boxes, scale_x, scale_y, crop_box, trim_x, trim_y)
                    text_boxes = transform_boxes(text_boxes, scale_x, scale_y, crop_box, trim_x, trim_y)
                    layout_crop = (0.0, 0.0, float(prepared_image.width), float(prepared_image.height))
                    answer_hotspots = hansol_answer_hotspots(layout_crop, marker_boxes, text_boxes)
                    # Some two-column PDFs continue the last question of one
                    # column at the top of the next column/page.  Rebuild only
                    # those incomplete crops as one vertically joined image.
                    current_start = starts[number - 1]
                    next_start = starts[number] if number < source.count else None
                    crossed_slot = next_start and (current_start["page"], current_start["column"]) != (next_start["page"], next_start["column"])
                    if not answer_hotspots and not source.scanned and crossed_slot:
                        regions = []
                        current_page = document.pages[current_start["page"]]
                        current_width, current_height = float(current_page.width), float(current_page.height)
                        current_left = 12 if current_start["column"] == 0 else current_width / 2 + 2
                        current_right = current_width / 2 - 2 if current_start["column"] == 0 else current_width - 12
                        regions.append((current_start["page"], current_left, max(0, current_start["top"] - 4), current_right, current_height - 48))
                        next_page = document.pages[next_start["page"]]
                        next_width = float(next_page.width)
                        next_left = 12 if next_start["column"] == 0 else next_width / 2 + 2
                        next_right = next_width / 2 - 2 if next_start["column"] == 0 else next_width - 12
                        regions.append((next_start["page"], next_left, 35.0, next_right, next_start["top"] - 3))

                        pieces = []
                        joined_markers: list[dict[str, Any]] = []
                        joined_text: list[dict[str, Any]] = []
                        joined_copy = []
                        cursor_y = 0
                        for region_page, rx0, rtop, rx1, rbottom in regions:
                            region_source = document.pages[region_page]
                            region_image = Image.open(page_images[region_page])
                            region_scale_x = region_image.width / region_source.width
                            region_scale_y = region_image.height / region_source.height
                            region_crop = (int(rx0 * region_scale_x), int(rtop * region_scale_y),
                                           int(rx1 * region_scale_x), int(rbottom * region_scale_y))
                            piece = region_image.crop(region_crop).convert("RGB")
                            pieces.append(piece)
                            region_words = [{"x0": float(word["x0"]), "top": float(word["top"]),
                                             "x1": float(word["x1"]), "bottom": float(word["bottom"]), "text": word["text"]}
                                            for word in region_source.extract_words(x_tolerance=1, y_tolerance=2)
                                            if rx0 <= (float(word["x0"]) + float(word["x1"])) / 2 <= rx1
                                            and rtop <= (float(word["top"]) + float(word["bottom"])) / 2 <= rbottom]
                            region_markers = [{"choice": CIRCLED[character["text"]], "x0": float(character["x0"]),
                                               "top": float(character["top"]), "x1": float(character["x1"]),
                                               "bottom": float(character["bottom"]), "text": character["text"]}
                                              for character in region_source.chars
                                              if character.get("text") in CIRCLED
                                              and rx0 <= (float(character["x0"]) + float(character["x1"])) / 2 <= rx1
                                              and rtop <= (float(character["top"]) + float(character["bottom"])) / 2 <= rbottom]
                            local_crop = region_crop
                            for target, source_boxes in ((joined_text, region_words), (joined_markers, region_markers)):
                                local_boxes = transform_boxes(source_boxes, region_scale_x, region_scale_y, local_crop, 0, 0)
                                for box in local_boxes:
                                    box["top"] += cursor_y
                                    box["bottom"] += cursor_y
                                    target.append(box)
                            joined_copy.append(region_source.crop((rx0, rtop, rx1, rbottom)).extract_text() or "")
                            cursor_y += piece.height

                        joined_width = max(piece.width for piece in pieces)
                        joined_image = Image.new("RGB", (joined_width, cursor_y), "white")
                        cursor_y = 0
                        for piece in pieces:
                            joined_image.paste(piece, (0, cursor_y))
                            cursor_y += piece.height
                        joined_image, joined_text, joined_markers = remove_joined_page_chrome(
                            joined_image, joined_text, joined_markers)
                        cursor_y = joined_image.height
                        prepared_image, trim_x, trim_y = prepare_question_image(joined_image, source.year == 2025)
                        marker_boxes = transform_boxes(joined_markers, 1, 1, (0, 0, joined_width, cursor_y), trim_x, trim_y)
                        text_boxes = transform_boxes(joined_text, 1, 1, (0, 0, joined_width, cursor_y), trim_x, trim_y)
                        block_text = " ".join(joined_copy)
                        layout_crop = (0.0, 0.0, float(prepared_image.width), float(prepared_image.height))
                        answer_hotspots = hansol_answer_hotspots(layout_crop, marker_boxes, text_boxes)

                    reviewed = REVIEWED_HOTSPOTS.get((source.slug, number))
                    scan_reviewed = scan_hotspots.get(f"{source.slug}/{number}") if source.scanned else None
                    if scan_reviewed:
                        answer_hotspots = scan_reviewed
                    if reviewed:
                        answer_hotspots = []
                        for choice, (rx, ry, rw, rh) in enumerate(reviewed, 1):
                            rect = {"x": rx, "y": ry, "width": rw, "height": rh}
                            answer_hotspots.append({"choice": choice, **rect, "segments": [rect]})
                    pixel_reviewed = pixel_hotspots.get(f"{source.slug}/{number}")
                    if pixel_reviewed:
                        answer_hotspots = pixel_reviewed

                    save_key = f"{source.slug}/{number}"
                    if not args.skip_images and (not args.save_image or save_key in args.save_image):
                        save_question_image(prepared_image, destination)

                    cleaned = clean_block_text(block_text, number)
                    stem, choices = split_question(cleaned)
                    stem = QUESTION_TEXT_CORRECTIONS.get((source.slug, number), stem)
                    choices = QUESTION_CHOICE_CORRECTIONS.get((source.slug, number), choices)
                    answer = answers[number]
                    base_question = None
                    if source_round:
                        signature = question_signature(stem or cleaned, choices)
                        base_question = next((item for item in source_round["questions"]
                                              if question_signature(item.get("text") or item.get("html", ""),
                                                                    [choice.get("text") or choice.get("html", "")
                                                                     for choice in item.get("choices", [])]) == signature), None)
                        if base_question and base_question.get("answer"):
                            # The two scanned 2020 PDFs print questions in a
                            # different order from the answer table. An exact
                            # stem+choice match is safer than the PDF slot.
                            answer = int(base_question["answer"])
                    explanation = ""
                    provenance = ""
                    match_score = 0.0
                    if base_question and base_question.get("answer") == answer and base_question.get("explanation"):
                        explanation = base_question["explanation"]
                        provenance = f'{source.source_round_id}:{number}'
                        match_score = 1.0
                    if not explanation:
                        explanation, provenance, match_score = best_explanation(cleaned, answer, explanation_candidates)
                    if not explanation:
                        explanation, provenance, match_score = best_stem_explanation(stem or cleaned, answer, explanation_candidates)
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
                        "answerHotspots": answer_hotspots,
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
