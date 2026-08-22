#!/usr/bin/env python3
"""Render compact visual-review sheets for Hansol answer rectangles."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
COLORS = ("#1976d2", "#e53935", "#00a76f", "#f59e0b")


def load_catalog() -> dict:
    source = (ROOT / "data/hvac-hansol.js").read_text(encoding="utf-8")
    match = re.fullmatch(r"window\.CBT_DATA_HANSOL_HVAC=(.*);\s*", source, re.DOTALL)
    if not match:
        raise RuntimeError("data/hvac-hansol.js를 읽을 수 없습니다.")
    return json.loads(match.group(1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--round", action="append", dest="rounds", default=[])
    parser.add_argument("--question", action="append", dest="questions", default=[])
    parser.add_argument("--audit", type=Path,
                        help="픽셀 감사 JSON의 실제 검토 후보만 렌더링")
    parser.add_argument("--minimum-deficit", type=float, default=8.0)
    parser.add_argument("--per-sheet", type=int, default=20)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    if args.audit:
        audit = json.loads(args.audit.read_text(encoding="utf-8"))
        args.questions = sorted({item["question"] for item in audit.get("findings", [])
                                 if item.get("joinedChoices") == 1
                                 and max(item.get("deficitPixels", {}).values(), default=0) >= args.minimum_deficit})

    entries = []
    for round_ in load_catalog()["rounds"]:
        first_image = round_["questions"][0]["sourceImage"]
        slug = Path(first_image).parent.name
        if args.rounds and slug not in args.rounds:
            continue
        for question in round_["questions"]:
            if args.questions and f'{slug}:{question["number"]}' not in args.questions:
                continue
            entries.append((slug, question))

    cell_width, cell_height = 420, 310
    columns, rows = 4, 5
    for sheet_index in range(0, len(entries), args.per_sheet):
        sheet = Image.new("RGB", (cell_width * columns, cell_height * rows), "#e7edf5")
        for offset, (slug, question) in enumerate(entries[sheet_index:sheet_index + args.per_sheet]):
            image = Image.open(ROOT / question["sourceImage"]).convert("RGB")
            image.thumbnail((cell_width - 16, cell_height - 34))
            left = (offset % columns) * cell_width + (cell_width - image.width) // 2
            top = (offset // columns) * cell_height + 26
            sheet.paste(image, (left, top))
            draw = ImageDraw.Draw(sheet)
            draw.text(((offset % columns) * cell_width + 8, (offset // columns) * cell_height + 6),
                      f'{slug} / {question["number"]}', fill="#132238", font=ImageFont.load_default())
            for box in question.get("answerHotspots", []):
                x0 = left + image.width * box["x"] / 100
                y0 = top + image.height * box["y"] / 100
                x1 = x0 + image.width * box["width"] / 100
                y1 = y0 + image.height * box["height"] / 100
                color = COLORS[box["choice"] - 1]
                draw.rectangle((x0, y0, x1, y1), outline=color, width=3)
                draw.text((x0 + 2, y0 + 1), str(box["choice"]), fill=color, font=ImageFont.load_default())
        sheet.save(args.output / f'sheet-{sheet_index // args.per_sheet + 1}.jpg', quality=92)

    print(json.dumps({"images": len(entries), "sheets": (len(entries) + args.per_sheet - 1) // args.per_sheet}, ensure_ascii=False))


if __name__ == "__main__":
    main()
