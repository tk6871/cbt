#!/usr/bin/env python3
"""Audit all Hansol answer rectangles against detected text geometry.

The catalog rectangle remains the choice source of truth. PP-OCRv5 detection is
used only to check whether a printed answer line escapes its clickable box.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any

from PIL import Image
from paddleocr import TextDetection


ROOT = Path(__file__).resolve().parents[1]


def load_catalog() -> dict[str, Any]:
    source = (ROOT / "data/hvac-hansol.js").read_text(encoding="utf-8")
    match = re.fullmatch(r"window\.CBT_DATA_HANSOL_HVAC=(.*);\s*", source, re.DOTALL)
    if not match:
        raise RuntimeError("data/hvac-hansol.js를 읽을 수 없습니다.")
    return json.loads(match.group(1))


def intersection(left: tuple[float, float, float, float], right: tuple[float, float, float, float]) -> tuple[float, float]:
    width = min(left[2], right[2]) - max(left[0], right[0])
    height = min(left[3], right[3]) - max(left[1], right[1])
    return max(0.0, width), max(0.0, height)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "work/hansol-hotspot-pixel-audit.json")
    parser.add_argument("--round", action="append", dest="rounds", default=[])
    parser.add_argument("--question", action="append", dest="questions", default=[])
    parser.add_argument("--edge-tolerance-x", type=float, default=.009,
                        help="이미지 폭에 대한 허용 바깥 여백 비율")
    parser.add_argument("--edge-tolerance-y", type=float, default=.03,
                        help="OCR 글상자 상하 여유를 위한 이미지 높이 비율")
    args = parser.parse_args()

    entries: list[tuple[str, dict[str, Any]]] = []
    for round_ in load_catalog()["rounds"]:
        slug = Path(round_["questions"][0]["sourceImage"]).parent.name
        if args.rounds and slug not in args.rounds:
            continue
        for question in round_["questions"]:
            key = f'{slug}:{question["number"]}'
            if args.questions and key not in args.questions:
                continue
            entries.append((key, question))

    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    detector = TextDetection(model_name="PP-OCRv5_mobile_det")
    findings: list[dict[str, Any]] = []
    checked_lines = 0
    started = time.perf_counter()

    for index, (key, question) in enumerate(entries, 1):
        image_path = ROOT / question["sourceImage"]
        with Image.open(image_path) as image:
            width, height = image.size
        prediction = list(detector.predict(str(image_path)))[0].json["res"]
        boxes = []
        for hotspot in question.get("answerHotspots", []):
            boxes.append((
                hotspot["choice"],
                hotspot["x"] / 100 * width,
                hotspot["y"] / 100 * height,
                (hotspot["x"] + hotspot["width"]) / 100 * width,
                (hotspot["y"] + hotspot["height"]) / 100 * height,
            ))

        for poly, score in zip(prediction["dt_polys"], prediction["dt_scores"]):
            if float(score) < .25:
                continue
            xs = [float(point[0]) for point in poly]
            ys = [float(point[1]) for point in poly]
            detected = (min(xs), min(ys), max(xs), max(ys))
            detected_area = max(1.0, (detected[2] - detected[0]) * (detected[3] - detected[1]))
            candidates = []
            for choice, left, top, right, bottom in boxes:
                overlap_width, overlap_height = intersection(detected, (left, top, right, bottom))
                overlap_area = overlap_width * overlap_height
                height_ratio = overlap_height / max(1.0, detected[3] - detected[1])
                if overlap_area / detected_area >= .08 and height_ratio >= .4:
                    candidates.append((overlap_area, choice, (left, top, right, bottom)))
            if not candidates:
                continue
            candidates.sort(reverse=True)
            _, choice, target = candidates[0]
            checked_lines += 1
            tolerance_x = max(2.0, width * args.edge_tolerance_x)
            tolerance_y = max(2.0, height * args.edge_tolerance_y)
            deficits = {
                "left": max(0.0, target[0] - detected[0] - tolerance_x),
                "top": max(0.0, target[1] - detected[1] - tolerance_y),
                "right": max(0.0, detected[2] - target[2] - tolerance_x),
                "bottom": max(0.0, detected[3] - target[3] - tolerance_y),
            }
            if max(deficits.values()) <= 1.5:
                continue
            # A detector can occasionally join two separate side-by-side
            # answers. Keep those as manual-review candidates instead of
            # silently expanding one choice across its neighbour.
            other_hits = sum(1 for overlap_area, *_ in candidates[1:] if overlap_area / detected_area >= .08)
            findings.append({
                "question": key,
                "choice": choice,
                "image": question["sourceImage"],
                "score": round(float(score), 4),
                "joinedChoices": other_hits + 1,
                "deficitPixels": {name: round(value, 2) for name, value in deficits.items() if value > 1.5},
            })

        if index % 50 == 0 or index == len(entries):
            elapsed = time.perf_counter() - started
            print(f"진행: {index}/{len(entries)}, 후보 {len(findings)}, {elapsed:.1f}초", flush=True)

    single_choice_findings = [item for item in findings if item["joinedChoices"] == 1]
    high_review_findings = [item for item in single_choice_findings
                            if max(item["deficitPixels"].values(), default=0) >= 8]
    result = {
        "questions": len(entries),
        "hotspots": sum(len(question.get("answerHotspots", [])) for _, question in entries),
        "detectedAnswerLines": checked_lines,
        "candidateSummary": {
            "rawFindings": len(findings),
            "singleChoiceFindings": len(single_choice_findings),
            "detectorJoinedChoiceFindings": len(findings) - len(single_choice_findings),
            "highReviewFindings": len(high_review_findings),
            "highReviewQuestions": len({item["question"] for item in high_review_findings}),
            "note": "후보 수는 오류 수가 아닙니다. OCR 외곽선과 두 답안 결합 탐지를 포함하며 고위험 검수표는 별도로 육안 확인합니다.",
        },
        "findings": findings,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "findings"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
