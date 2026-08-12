#!/usr/bin/env python3
"""Generate tight, per-line answer highlight segments with PaddleOCR PP-OCRv5.

The existing four answer hotspots remain the click/choice source of truth. Paddle
is used only for text geometry, so an OCR mistake such as ④ -> ③ cannot swap an
answer. Install PaddleOCR in an isolated environment before running this tool.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image
from paddleocr import TextDetection


def read_typescript_object(path: Path) -> dict[str, Any]:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"=\s*(\{.*\})\s*;\s*$", source, re.DOTALL)
    if not match:
        raise ValueError(f"TypeScript 객체를 읽을 수 없습니다: {path}")
    return json.loads(match.group(1))


def round2(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def intersection(left: float, top: float, right: float, bottom: float,
                 other_left: float, other_top: float, other_right: float, other_bottom: float):
    x1 = max(left, other_left)
    y1 = max(top, other_top)
    x2 = min(right, other_right)
    y2 = min(bottom, other_bottom)
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def merge_nearby_segments(segments: list[tuple[float, float, float, float]], image_width: int):
    if not segments:
        return []
    lines: list[list[tuple[float, float, float, float]]] = []
    for segment in sorted(segments, key=lambda item: ((item[1] + item[3]) / 2, item[0])):
        height = segment[3] - segment[1]
        center = (segment[1] + segment[3]) / 2
        target = None
        for line in lines:
            line_top = min(item[1] for item in line)
            line_bottom = max(item[3] for item in line)
            line_center = (line_top + line_bottom) / 2
            if abs(center - line_center) <= max(height, line_bottom - line_top) * 0.5:
                target = line
                break
        if target is None:
            lines.append([segment])
        else:
            target.append(segment)

    merged: list[tuple[float, float, float, float]] = []
    max_gap = image_width * 0.012
    for line in lines:
        ordered = sorted(line, key=lambda item: item[0])
        current = ordered[0]
        for item in ordered[1:]:
            vertical_overlap = min(current[3], item[3]) - max(current[1], item[1])
            min_height = min(current[3] - current[1], item[3] - item[1])
            if item[0] - current[2] <= max_gap and vertical_overlap >= min_height * 0.4:
                current = (min(current[0], item[0]), min(current[1], item[1]), max(current[2], item[2]), max(current[3], item[3]))
            else:
                merged.append(current)
                current = item
        merged.append(current)
    return sorted(merged, key=lambda item: (item[1], item[0]))


def segments_for_hotspot(polys, scores, hotspot, image_width: int, image_height: int, extend_bottom: bool = False):
    cell_left = hotspot["x"] / 100 * image_width
    cell_top = hotspot["y"] / 100 * image_height
    cell_right = (hotspot["x"] + hotspot["width"]) / 100 * image_width
    normal_bottom = (hotspot["y"] + hotspot["height"]) / 100 * image_height
    cell_bottom = min(image_height, normal_bottom + image_height * 0.08) if extend_bottom else normal_bottom
    matches = []
    for poly, score in zip(polys, scores):
        if float(score) < 0.25:
            continue
        xs = [float(point[0]) for point in poly]
        ys = [float(point[1]) for point in poly]
        left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
        clipped = intersection(left, top, right, bottom, cell_left, cell_top, cell_right, cell_bottom)
        if not clipped:
            continue
        x1, y1, x2, y2 = clipped
        detected_area = max(1.0, (right - left) * (bottom - top))
        overlap_area = (x2 - x1) * (y2 - y1)
        height_overlap = (y2 - y1) / max(1.0, bottom - top)
        if overlap_area / detected_area < 0.12 or height_overlap < 0.45:
            continue
        matches.append(clipped)

    merged = merge_nearby_segments(matches, image_width)
    padding_x = image_width * 0.0035
    padding_y = image_height * 0.003
    result = []
    for left, top, right, bottom in merged:
        left = max(cell_left, left - padding_x)
        top = max(cell_top, top - padding_y)
        right = min(cell_right, right + padding_x)
        bottom = min(cell_bottom, bottom + padding_y)
        result.append({
            "x": round2(left / image_width * 100),
            "y": round2(top / image_height * 100),
            "width": round2((right - left) / image_width * 100),
            "height": round2((bottom - top) / image_height * 100),
        })
    return result


def merge_clipped_line_parts(segments):
    merged = []
    for segment in sorted(segments, key=lambda item: (item["y"], item["x"])):
        match = next((item for item in reversed(merged)
                      if abs((item["y"] + item["height"]) - segment["y"]) <= 0.35
                      and abs(item["x"] - segment["x"]) <= 0.45
                      and abs(item["width"] - segment["width"]) <= 0.75), None)
        if match:
            match["height"] = round2(segment["y"] + segment["height"] - match["y"])
        else:
            merged.append(segment)
    return sorted(merged, key=lambda item: (item["y"], item["x"]))


def keep_bottom_answer_line(segments):
    if len(segments) < 2:
        return segments
    bottom = max(item["y"] + item["height"] for item in segments)
    candidates = [item for item in segments if bottom - (item["y"] + item["height"]) <= 1.2]
    return candidates or segments


def write_output(path: Path, result: dict[str, Any]) -> None:
    payload = json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True)
    source = (
        "// PaddleOCR PP-OCRv5 탐지로 생성한 공조 복원문제 답안 글자 좌표입니다.\n"
        "// 답 번호는 OCR이 아니라 기존 검수 클릭 영역을 기준으로 배정합니다.\n"
        "export const hvacAnswerSegments: Record<string, Record<number, Array<{ x: number; y: number; width: number; height: number }>>> = "
        f"{payload};\n"
    )
    path.write_text(source, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generated-hotspots", type=Path, required=True)
    parser.add_argument("--reviewed-hotspots", type=Path, required=True)
    parser.add_argument("--image-root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--include", action="append", default=[])
    args = parser.parse_args()

    generated = read_typescript_object(args.generated_hotspots)
    reviewed = read_typescript_object(args.reviewed_hotspots)
    hotspots = {**generated, **reviewed}
    selected = set(args.include)
    paths = [path for path in sorted(hotspots) if not selected or path in selected]
    if selected - set(paths):
        missing = ", ".join(sorted(selected - set(paths)))
        raise ValueError(f"좌표 데이터에 없는 이미지: {missing}")

    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    detector = TextDetection(model_name="PP-OCRv5_mobile_det")
    result: dict[str, Any] = {}
    started = time.perf_counter()
    for index, relative in enumerate(paths, 1):
        image_path = args.image_root / relative
        with Image.open(image_path) as image:
            width, height = image.size
        prediction = list(detector.predict(str(image_path)))[0].json["res"]
        choices = {}
        image_hotspots = hotspots[relative]
        for hotspot in image_hotspots:
            same_column = [item for item in image_hotspots if abs(item["x"] - hotspot["x"]) < 12]
            one_column_layout = max(item["x"] for item in image_hotspots) - min(item["x"] for item in image_hotspots) < 12
            extend_bottom = one_column_layout and hotspot["y"] == max(item["y"] for item in same_column)
            segments = segments_for_hotspot(
                prediction["dt_polys"], prediction["dt_scores"], hotspot, width, height, extend_bottom
            )
            if not one_column_layout and hotspot["height"] <= 12:
                segments = keep_bottom_answer_line(segments)
            if segments:
                choices[str(hotspot["choice"])] = segments
        one_column = max(item["x"] for item in image_hotspots) - min(item["x"] for item in image_hotspots) < 12
        if one_column:
            for choice in range(2, 5):
                key = str(choice)
                previous_key = str(choice - 1)
                segments = choices.get(key, [])
                if len(segments) < 2:
                    continue
                anchor_index = min(range(len(segments)), key=lambda item: (segments[item]["x"], segments[item]["y"]))
                if anchor_index and min(item["x"] for item in segments[:anchor_index]) - segments[anchor_index]["x"] > 1.5:
                    choices.setdefault(previous_key, []).extend(segments[:anchor_index])
                    choices[previous_key].sort(key=lambda item: (item["y"], item["x"]))
                    choices[key] = segments[anchor_index:]
        for key in list(choices):
            choices[key] = merge_clipped_line_parts(choices[key])
        if choices:
            result[relative] = choices
        if index % 25 == 0 or index == len(paths):
            write_output(args.output, result)
            elapsed = time.perf_counter() - started
            print(f"진행: {index}/{len(paths)}, 좌표 생성: {len(result)}, {elapsed:.1f}초", file=sys.stderr, flush=True)

    write_output(args.output, result)
    print(f"완료: {len(paths)}장 중 {len(result)}장", file=sys.stderr)


if __name__ == "__main__":
    main()
