#!/usr/bin/env python3
"""Build reviewed answer rectangles for the 160 final 2020 scan images."""

from __future__ import annotations

import argparse
import itertools
import json
import re
from pathlib import Path

from PIL import Image, ImageOps


CIRCLED = "①②③④"


def marker_candidates(row: dict) -> dict[int, list[dict]]:
    result = {choice: [] for choice in range(1, 5)}
    for text, box, score in zip(row["texts"], row["boxes"], row["scores"]):
        text = str(text)
        x0, y0, x1, y1 = map(float, box)
        positions = [(match.start(), CIRCLED.index(match.group()) + 1) for match in re.finditer(r"[①②③④]", text)]
        for index, (position, choice) in enumerate(positions):
            next_position = positions[index + 1][0] if index + 1 < len(positions) else len(text)
            left = x0 + (x1 - x0) * position / max(1, len(text))
            right = min(x1, left + max(8.0, y1 - y0))
            result[choice].append({"x0": left, "y0": y0, "x1": right, "y1": y1, "score": float(score), "explicit": True})
        if not positions and re.fullmatch(r"[1-4]", text.strip()):
            choice = int(text.strip())
            result[choice].append({"x0": x0, "y0": y0, "x1": x1, "y1": y1, "score": float(score), "explicit": False})
    return result


def layout_score(markers: tuple[dict, ...], width: int, height: int) -> tuple[float, str]:
    x = [(box["x0"] + box["x1"]) / 2 for box in markers]
    y = [(box["y0"] + box["y1"]) / 2 for box in markers]
    confidence = sum(1 - min(1, box["score"]) for box in markers) * .1
    scores = []
    if y[0] < y[1] < y[2] < y[3]:
        scores.append(((max(x) - min(x)) / width + confidence, "column"))
    if x[0] < x[1] and x[2] < x[3] and y[0] < y[2] and y[1] < y[3]:
        score = (abs(y[0] - y[1]) + abs(y[2] - y[3])) / height
        score += (abs(x[0] - x[2]) + abs(x[1] - x[3])) / width + confidence
        scores.append((score, "grid"))
    if x[0] < x[1] < x[2] < x[3] and max(y) - min(y) < height * .12:
        scores.append(((max(y) - min(y)) / height + confidence, "row"))
    return min(scores, default=(999.0, "unknown"))


def choose_markers(candidates: dict[int, list[dict]], width: int, height: int) -> tuple[list[dict], str]:
    if any(not candidates[choice] for choice in range(1, 5)):
        return [], "unknown"
    best = (999.0, (), "unknown")
    for combination in itertools.product(*(candidates[choice] for choice in range(1, 5))):
        score, layout = layout_score(combination, width, height)
        if score < best[0]:
            best = (score, combination, layout)
    return list(best[1]), best[2]


def dark_bbox(gray: Image.Image, cell: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    left, top, right, bottom = cell
    left, top = max(0, left), max(0, top)
    right, bottom = min(gray.width, right), min(gray.height, bottom)
    crop = gray.crop((left, top, right, bottom))
    mask = crop.point(lambda value: 255 if value < 190 else 0)
    # Ignore page separator rules; a one-pixel line must not widen a choice.
    pixels = mask.load()
    for y in range(mask.height):
        if sum(1 for x in range(mask.width) if pixels[x, y]) > mask.width * .82:
            for x in range(mask.width):
                pixels[x, y] = 0
    bbox = mask.getbbox()
    if not bbox:
        return cell
    padding = 6
    return (max(left, left + bbox[0] - padding), max(top, top + bbox[1] - padding),
            min(right, left + bbox[2] + padding), min(bottom, top + bbox[3] + padding))


def build_boxes(image_path: Path, row: dict) -> list[dict]:
    image = Image.open(image_path).convert("RGB")
    width, height = image.size
    markers, layout = choose_markers(marker_candidates(row), width, height)
    if len(markers) != 4 or layout == "unknown":
        return []
    centers_x = [(box["x0"] + box["x1"]) / 2 for box in markers]
    centers_y = [(box["y0"] + box["y1"]) / 2 for box in markers]
    footer_tops = [float(box[1]) for text, box in zip(row["texts"], row["boxes"])
                   if re.search(r"TEL|학원강의|온라인강의", str(text), re.I)]
    gray = ImageOps.grayscale(image)
    marker_bottom = int(max(box["y1"] for box in markers))
    divider_rows = []
    pixels = gray.load()
    for y in range(min(height - 1, marker_bottom + 5), height):
        dark = sum(1 for x in range(width) if pixels[x, y] < 170)
        if dark > width * .72:
            divider_rows.append(y)
            break
    limits = [height - 4]
    if footer_tops:
        limits.append(int(min(footer_tops) - 5))
    if divider_rows:
        limits.append(divider_rows[0] - 4)
    content_bottom = max(marker_bottom + 3, min(limits))
    cells = []
    if layout == "column":
        boundaries = [int(markers[0]["y0"] - 6)]
        boundaries.extend(int((markers[index]["y1"] + markers[index + 1]["y0"]) / 2) for index in range(3))
        boundaries.append(content_bottom)
        for index, marker in enumerate(markers):
            cells.append((int(marker["x0"] - 7), boundaries[index], width - 5, boundaries[index + 1]))
    elif layout == "grid":
        boundary_x = int((max(centers_x[0], centers_x[2]) + min(centers_x[1], centers_x[3])) / 2)
        boundary_y = int((max(centers_y[0], centers_y[1]) + min(centers_y[2], centers_y[3])) / 2)
        cells = [
            (int(markers[0]["x0"] - 7), int(markers[0]["y0"] - 6), boundary_x, boundary_y),
            (boundary_x, int(markers[1]["y0"] - 6), width - 5, boundary_y),
            (int(markers[2]["x0"] - 7), boundary_y, boundary_x, content_bottom),
            (boundary_x, boundary_y, width - 5, content_bottom),
        ]
    else:
        boundaries = [0] + [int((centers_x[index] + centers_x[index + 1]) / 2) for index in range(3)] + [width - 5]
        row_top = int(min(box["y0"] for box in markers) - 6)
        cells = [(max(boundaries[index], int(markers[index]["x0"] - 7)), row_top, boundaries[index + 1], content_bottom) for index in range(4)]

    output = []
    for choice, cell in enumerate(cells, 1):
        left, top, right, bottom = dark_bbox(gray, cell)
        rect = {
            "x": round(left / width * 100, 3), "y": round(top / height * 100, 3),
            "width": round((right - left) / width * 100, 3),
            "height": round((bottom - top) / height * 100, 3),
        }
        output.append({"choice": choice, **rect, "segments": [rect.copy()]})
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ocr", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/hansol-scan-hotspots.json"))
    args = parser.parse_args()
    rows = json.loads(args.ocr.read_text(encoding="utf-8"))
    output = {}
    missing = []
    for row in rows:
        image_path = Path(row["path"])
        slug, filename = image_path.parent.name, image_path.stem
        key = f"{slug}/{int(filename)}"
        boxes = build_boxes(image_path, row)
        if len(boxes) == 4:
            output[key] = boxes
        else:
            missing.append(key)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"images": len(rows), "generated": len(output), "missing": missing}, ensure_ascii=False))


if __name__ == "__main__":
    main()
