#!/usr/bin/env python3
"""Expand Hansol answer boxes only where PP-OCR found escaped text pixels.

Joined-choice detections and manually reviewed questions are deliberately left
untouched.  The generated override file makes the repair survive a PDF import.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data/hvac-hansol.js"
DEFAULT_AUDIT_PATH = ROOT / "work/hansol-hotspot-pixel-audit.json"
OVERRIDE_PATH = ROOT / "data/hansol-pixel-hotspot-overrides.json"

REVIEWED = {
    "2018_3:60", "2019_3:60", "2020_1:50", "2020_1:80", "2020_3:14",
    "2020_3:15", "2020_3:74", "2020_4:29", "2021_1:4", "2021_2:17",
    "2021_3:70", "2022_3:59", "2023_3:2", "2024_1:2", "2024_2:2",
}


def load_catalog() -> dict[str, Any]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    match = re.fullmatch(r"window\.CBT_DATA_HANSOL_HVAC=(.*);\s*", source, re.DOTALL)
    if not match:
        raise RuntimeError("한솔 데이터 파일을 읽을 수 없습니다.")
    return json.loads(match.group(1))


def split_overlaps(boxes: list[dict[str, Any]]) -> None:
    for _ in range(6):
        changed = False
        for left_index in range(len(boxes)):
            for right_index in range(left_index + 1, len(boxes)):
                left, right = boxes[left_index], boxes[right_index]
                overlap_x = min(left["x"] + left["width"], right["x"] + right["width"]) - max(left["x"], right["x"])
                overlap_y = min(left["y"] + left["height"], right["y"] + right["height"]) - max(left["y"], right["y"])
                if overlap_x <= 0 or overlap_y <= 0:
                    continue
                left_cx, right_cx = left["x"] + left["width"] / 2, right["x"] + right["width"] / 2
                left_cy, right_cy = left["y"] + left["height"] / 2, right["y"] + right["height"] / 2
                horizontal = abs(left_cx - right_cx) > abs(left_cy - right_cy)
                if horizontal:
                    first, second = (left, right) if left_cx <= right_cx else (right, left)
                    boundary = (first["x"] + first["width"] + second["x"]) / 2
                    first["width"] = boundary - first["x"]
                    edge = second["x"] + second["width"]
                    second["x"], second["width"] = boundary, edge - boundary
                else:
                    first, second = (left, right) if left_cy <= right_cy else (right, left)
                    boundary = (first["y"] + first["height"] + second["y"]) / 2
                    first["height"] = boundary - first["y"]
                    edge = second["y"] + second["height"]
                    second["y"], second["height"] = boundary, edge - boundary
                changed = True
        if not changed:
            break


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT_PATH)
    args = parser.parse_args()
    audit_path = args.audit if args.audit.is_absolute() else ROOT / args.audit
    catalog = load_catalog()
    audit = json.loads(audit_path.read_text(encoding="utf-8"))
    entries: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {}
    for round_ in catalog["rounds"]:
        slug = Path(round_["questions"][0]["sourceImage"]).parent.name
        for question in round_["questions"]:
            entries[f'{slug}:{question["number"]}'] = (round_, question)

    grouped: dict[tuple[str, int], dict[str, float]] = {}
    for finding in audit["findings"]:
        if finding["joinedChoices"] != 1 or finding["question"] in REVIEWED:
            continue
        key = (finding["question"], int(finding["choice"]))
        target = grouped.setdefault(key, {})
        for side, pixels in finding["deficitPixels"].items():
            target[side] = max(target.get(side, 0.0), float(pixels))

    changed_questions: set[str] = set()
    for (question_key, choice), deficits in grouped.items():
        _, question = entries[question_key]
        with Image.open(ROOT / question["sourceImage"]) as image:
            image_width, image_height = image.size
        box = next(item for item in question["answerHotspots"] if int(item["choice"]) == choice)
        left = float(box["x"])
        top = float(box["y"])
        right = left + float(box["width"])
        bottom = top + float(box["height"])
        if "left" in deficits:
            left -= deficits["left"] / image_width * 100 + .12
        if "right" in deficits:
            right += deficits["right"] / image_width * 100 + .12
        if "top" in deficits:
            top -= deficits["top"] / image_height * 100 + .12
        if "bottom" in deficits:
            bottom += deficits["bottom"] / image_height * 100 + .12
        box.update({
            "x": max(0.0, left),
            "y": max(0.0, top),
            "width": min(100.0, right) - max(0.0, left),
            "height": min(100.0, bottom) - max(0.0, top),
        })
        changed_questions.add(question_key)

    overrides: dict[str, list[dict[str, Any]]] = (
        json.loads(OVERRIDE_PATH.read_text(encoding="utf-8"))
        if OVERRIDE_PATH.exists()
        else {}
    )
    for question_key in sorted(changed_questions):
        _, question = entries[question_key]
        boxes = question["answerHotspots"]
        split_overlaps(boxes)
        for box in boxes:
            for name in ("x", "y", "width", "height"):
                box[name] = round(float(box[name]), 3)
            rect = {name: box[name] for name in ("x", "y", "width", "height")}
            box["segments"] = [rect]
        overrides[question_key.replace(":", "/")] = boxes

    CATALOG_PATH.write_text(f'window.CBT_DATA_HANSOL_HVAC={json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))};\n', encoding="utf-8")
    OVERRIDE_PATH.write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "pixelFindingsApplied": len(grouped),
        "questionsChanged": len(changed_questions),
        "manualReviewedSkipped": len(REVIEWED),
        "auditFile": str(audit_path.relative_to(ROOT)),
        "totalOverrideQuestions": len(overrides),
        "overrideFile": str(OVERRIDE_PATH.relative_to(ROOT)),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
