#!/usr/bin/env python3
"""Render review sheets for every HVAC restored-question answer highlight.

The sheets are review artifacts only. They crop the answer area, preserve the
source aspect ratio, and use a separate colour for each choice so misplaced,
truncated, or over-wide PaddleOCR highlight segments are easy to spot.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


CHOICE_COLOURS = {
    1: (0, 102, 255),
    2: (0, 160, 90),
    3: (244, 116, 0),
    4: (190, 30, 150),
}


def read_typescript_object(path: Path) -> dict[str, Any]:
    source = path.read_text(encoding="utf-8")
    match = re.search(r"=\s*(\{.*\})\s*;\s*$", source, re.DOTALL)
    if not match:
        raise ValueError(f"TypeScript 객체를 읽을 수 없습니다: {path}")
    return json.loads(match.group(1))


def font(size: int):
    candidates = (
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    )
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def percent_box(item: dict[str, float], width: int, height: int):
    return (
        item["x"] / 100 * width,
        item["y"] / 100 * height,
        (item["x"] + item["width"]) / 100 * width,
        (item["y"] + item["height"]) / 100 * height,
    )


def unified_boxes(hotspots, segments):
    boxes = []
    for hotspot in hotspots:
        items = segments.get(str(hotspot["choice"]), [])
        if not items:
            boxes.append(dict(hotspot))
            continue
        left = min(item["x"] for item in items)
        top = min(item["y"] for item in items)
        right = max(item["x"] + item["width"] for item in items)
        bottom = max(item["y"] + item["height"] for item in items)
        boxes.append({
            "choice": hotspot["choice"],
            "x": left,
            "y": top,
            "width": right - left,
            "height": bottom - top,
        })

    min_x = min(item["x"] for item in hotspots)
    max_x = max(item["x"] for item in hotspots)
    two_columns = max_x - min_x > 24
    columns = (
        ([box for box in boxes if box["choice"] in (1, 3)],
         [box for box in boxes if box["choice"] in (2, 4)])
        if two_columns else (boxes,)
    )
    if two_columns:
        left_column, right_column = columns
        left_edge = max(box["x"] + box["width"] for box in left_column)
        right_edge = min(box["x"] for box in right_column)
        if left_edge > right_edge:
            boundary = (left_edge + right_edge) / 2
            for box in left_column:
                box["width"] = min(box["width"], boundary - box["x"])
            for box in right_column:
                edge = box["x"] + box["width"]
                box["x"] = max(box["x"], boundary)
                box["width"] = edge - box["x"]
    for column in columns:
        ordered = sorted(column, key=lambda item: item["y"])
        for upper, lower in zip(ordered, ordered[1:]):
            upper_edge = upper["y"] + upper["height"]
            if upper_edge <= lower["y"]:
                continue
            boundary = (upper_edge + lower["y"]) / 2
            upper["height"] = boundary - upper["y"]
            lower_edge = lower["y"] + lower["height"]
            lower["y"] = boundary
            lower["height"] = lower_edge - boundary
    return boxes


def natural_key(path: str):
    match = re.search(r"/(\d{4})_(\d)/(\d+)\.", path)
    if not match:
        return path, 0, 0
    return tuple(int(value) for value in match.groups())


def render_panel(
    root: Path,
    relative: str,
    hotspots: list[dict[str, Any]],
    segments: dict[str, list[dict[str, float]]],
    panel_width: int,
    unified: bool,
):
    with Image.open(root / relative) as source:
        image = source.convert("RGBA")

    boxes = [percent_box(item, image.width, image.height) for item in hotspots]
    for items in segments.values():
        boxes.extend(percent_box(item, image.width, image.height) for item in items)
    left = max(0, math.floor(min(box[0] for box in boxes) - image.width * 0.025))
    top = max(0, math.floor(min(box[1] for box in boxes) - image.height * 0.025))
    right = min(image.width, math.ceil(max(box[2] for box in boxes) + image.width * 0.025))
    bottom = min(image.height, math.ceil(max(box[3] for box in boxes) + image.height * 0.025))

    overlay = Image.new("RGBA", image.size)
    draw = ImageDraw.Draw(overlay)
    missing = []
    normalized = {item["choice"]: item for item in unified_boxes(hotspots, segments)} if unified else {}
    for hotspot in hotspots:
        choice = hotspot["choice"]
        items = segments.get(str(choice), [])
        colour = CHOICE_COLOURS[choice]
        if not items:
            missing.append(choice)
            x1, y1, x2, y2 = percent_box(hotspot, image.width, image.height)
            draw.rectangle((x1, y1, x2, y2), fill=(*colour, 28), outline=(*colour, 255), width=5)
            continue
        visible_items = [normalized[choice]] if unified and items else items
        for item in visible_items:
            x1, y1, x2, y2 = percent_box(item, image.width, image.height)
            radius = max(2, round(min(x2 - x1, y2 - y1) * 0.12))
            draw.rounded_rectangle(
                (x1, y1, x2, y2),
                radius=radius,
                fill=(*colour, 42),
                outline=(*colour, 255),
                width=4,
            )

    image = Image.alpha_composite(image, overlay).crop((left, top, right, bottom)).convert("RGB")
    target_height = max(1, round(image.height * panel_width / image.width))
    image = image.resize((panel_width, target_height), Image.Resampling.LANCZOS)

    header_height = 42
    panel = Image.new("RGB", (panel_width, target_height + header_height), "white")
    header = ImageDraw.Draw(panel)
    short_name = relative.split("/questions/", 1)[-1]
    missing_label = f"  |  미검출: {','.join(map(str, missing))}" if missing else ""
    segment_count = sum(len(items) for items in segments.values())
    header.text((10, 8), f"{short_name}  |  박스 {segment_count}개{missing_label}", font=font(21), fill=(20, 24, 31))
    panel.paste(image, (0, header_height))
    return panel


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path("/private/tmp/cbt-hvac-answer-audit"))
    parser.add_argument("--per-sheet", type=int, default=15)
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--panel-width", type=int, default=560)
    parser.add_argument("--generated-hotspots", type=Path)
    parser.add_argument("--reviewed-hotspots", type=Path)
    parser.add_argument("--segments", type=Path)
    parser.add_argument("--reviewed-segments", type=Path)
    parser.add_argument("--include", action="append", default=[])
    parser.add_argument("--match", default="", help="경로에 이 문자열이 들어간 이미지만 검수")
    parser.add_argument("--unified", action="store_true", help="실제 화면처럼 답마다 통합 박스 한 개를 표시")
    args = parser.parse_args()

    generated = read_typescript_object(args.generated_hotspots or args.root / "src/cbt/generatedHvacHotspots.ts")
    reviewed = read_typescript_object(args.reviewed_hotspots or args.root / "src/cbt/reviewedHvacHotspots.ts")
    hotspots = {**generated, **reviewed}
    segments = read_typescript_object(args.segments or args.root / "src/cbt/generatedHvacAnswerSegments.ts")
    reviewed_segments = read_typescript_object(
        args.reviewed_segments or args.root / "src/cbt/reviewedHvacAnswerSegments.ts"
    )
    segments = {
        path: {**segments.get(path, {}), **reviewed_segments.get(path, {})}
        for path in set(segments) | set(reviewed_segments)
    }
    selected = set(args.include)
    paths = sorted((
        path for path in hotspots
        if (not selected or path in selected) and (not args.match or args.match in path)
    ), key=natural_key)
    if selected - set(paths):
        missing = ", ".join(sorted(selected - set(paths)))
        raise ValueError(f"좌표 데이터에 없는 이미지: {missing}")
    args.output.mkdir(parents=True, exist_ok=True)

    title_font = font(22)
    gap = 14
    sheets = []
    manifest = []
    for sheet_index, start in enumerate(range(0, len(paths), args.per_sheet), 1):
        batch = paths[start : start + args.per_sheet]
        panels = [
            render_panel(args.root, path, hotspots[path], segments.get(path, {}), args.panel_width, args.unified)
            for path in batch
        ]
        rows = math.ceil(len(panels) / args.columns)
        row_heights = [
            max(panel.height for panel in panels[row * args.columns : (row + 1) * args.columns])
            for row in range(rows)
        ]
        legend_height = 48
        sheet_width = args.columns * args.panel_width + (args.columns - 1) * gap
        sheet_height = legend_height + sum(row_heights) + (rows - 1) * gap
        sheet = Image.new("RGB", (sheet_width, sheet_height), (222, 226, 232))
        legend = ImageDraw.Draw(sheet)
        x = 12
        for choice in range(1, 5):
            colour = CHOICE_COLOURS[choice]
            legend.rounded_rectangle((x, 10, x + 28, 38), radius=5, fill=colour)
            legend.text((x + 36, 10), f"{choice}번", font=title_font, fill=(20, 24, 31))
            x += 105

        y = legend_height
        for index, panel in enumerate(panels):
            row, column = divmod(index, args.columns)
            sheet.paste(panel, (column * (args.panel_width + gap), y))
            if column == args.columns - 1 or index == len(panels) - 1:
                y += row_heights[row] + gap

        first = batch[0].split("/questions/", 1)[-1].replace("/", "-").rsplit(".", 1)[0]
        last = batch[-1].split("/questions/", 1)[-1].replace("/", "-").rsplit(".", 1)[0]
        output = args.output / f"{sheet_index:03d}_{first}_{last}.jpg"
        sheet.save(output, quality=94, subsampling=0)
        sheets.append(str(output))
        manifest.append({"sheet": output.name, "images": batch})
        print(f"검수표 {sheet_index:03d}: {batch[0]} ~ {batch[-1]}")

    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"완료: {len(paths)}장, 검수표 {len(sheets)}개, {args.output}")


if __name__ == "__main__":
    main()
