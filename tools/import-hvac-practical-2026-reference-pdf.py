#!/usr/bin/env python3
"""Extract reviewed 2026 HVAC practical figures from two user-provided PDFs.

The source PDFs are not copied into the repository. Only the reviewed figure
regions below are written as PNG files so existing question IDs can keep their
learning history while replacing video stills with cleaner source figures.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


CROPS = [
    # 2026 round 1
    {"round": "2026-1", "number": 1, "role": "question", "page": 1, "crop": [270, 430, 735, 885]},
    {"round": "2026-1", "number": 1, "role": "answer", "page": 1, "crop": [230, 1110, 785, 1270]},
    {"round": "2026-1", "number": 2, "role": "question", "page": 2, "crop": [390, 135, 650, 340]},
    {"round": "2026-1", "number": 2, "role": "answer", "page": 2, "crop": [75, 420, 945, 655]},
    {"round": "2026-1", "number": 3, "role": "question", "page": 2, "crop": [105, 975, 440, 1235]},
    {"round": "2026-1", "number": 4, "role": "question", "page": 3, "crop": [245, 145, 860, 405]},
    {"round": "2026-1", "number": 6, "role": "question", "page": 5, "crop": [85, 185, 560, 635]},
    {"round": "2026-1", "number": 7, "role": "question", "page": 6, "crop": [65, 130, 430, 430]},
    {"round": "2026-1", "number": 8, "role": "question", "page": 6, "crop": [85, 835, 530, 1105]},
    {"round": "2026-1", "number": 9, "role": "question", "page": 7, "crop": [95, 520, 370, 690]},
    {"round": "2026-1", "number": 11, "role": "question", "page": 8, "crop": [70, 390, 450, 650]},
    {"round": "2026-1", "number": 11, "role": "answer", "page": 8, "crop": [80, 850, 930, 1265]},
    {"round": "2026-1", "number": 12, "role": "question", "page": 9, "crop": [300, 175, 710, 620]},
    {"round": "2026-1", "number": 12, "role": "answer", "page": 10, "crop": [80, 455, 930, 835]},
    # 2026 round 2
    {"round": "2026-2", "number": 1, "role": "question", "page": 1, "crop": [180, 470, 835, 855]},
    {"round": "2026-2", "number": 2, "role": "question", "page": 2, "crop": [300, 160, 790, 555]},
    {"round": "2026-2", "number": 3, "role": "question", "page": 3, "crop": [75, 160, 940, 605]},
    {"round": "2026-2", "number": 3, "role": "answer", "page": 3, "crop": [325, 680, 690, 770]},
    {"round": "2026-2", "number": 4, "role": "question", "page": 4, "crop": [75, 210, 940, 1215]},
    {"round": "2026-2", "number": 6, "role": "question", "page": 5, "crop": [65, 320, 425, 485]},
    {"round": "2026-2", "number": 6, "role": "answer", "page": 5, "crop": [75, 580, 935, 825]},
    {"round": "2026-2", "number": 8, "role": "answer", "page": 6, "crop": [80, 195, 930, 745]},
    {"round": "2026-2", "number": 10, "role": "question", "page": 7, "crop": [75, 155, 265, 335]},
    {"round": "2026-2", "number": 11, "role": "question", "page": 7, "crop": [225, 790, 795, 1090]},
    {"round": "2026-2", "number": 12, "role": "question", "page": 8, "crop": [65, 140, 550, 340]},
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def embedded_pages(pdf_path: Path) -> list[Image.Image]:
    reader = PdfReader(pdf_path)
    if reader.is_encrypted and not reader.decrypt(""):
        raise ValueError(f"빈 암호로 열 수 없는 PDF입니다: {pdf_path}")
    pages: list[Image.Image] = []
    for index, page in enumerate(reader.pages, 1):
        images = list(page.images)
        if len(images) != 1:
            raise ValueError(f"{pdf_path.name} {index}쪽의 원본 이미지가 1개가 아닙니다: {len(images)}")
        pages.append(Image.open(BytesIO(images[0].data)).convert("RGB"))
    return pages


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--round1-pdf", type=Path, required=True)
    parser.add_argument("--round2-pdf", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path("assets/hvac-practical/restored"))
    parser.add_argument("--manifest", type=Path, default=Path("data/hvac-practical-2026-reference-pdf.json"))
    args = parser.parse_args()

    sources = {"2026-1": args.round1_pdf, "2026-2": args.round2_pdf}
    pages = {round_id: embedded_pages(path) for round_id, path in sources.items()}
    expected_pages = {"2026-1": 10, "2026-2": 8}
    for round_id, count in expected_pages.items():
        if len(pages[round_id]) != count:
            raise ValueError(f"{round_id} 쪽수 불일치: {len(pages[round_id])} != {count}")

    records = []
    for item in CROPS:
        round_id = item["round"]
        source = pages[round_id][item["page"] - 1]
        crop_box = tuple(item["crop"])
        cropped = source.crop(crop_box)
        filename = f"hvac-practical-restored-{round_id}-{item['number']:02d}-{item['role']}-pdf-v514.png"
        relative = Path(args.output_root) / round_id / filename
        relative.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(relative, format="PNG", optimize=True)
        data = relative.read_bytes()
        records.append({
            **item,
            "sourceSize": list(source.size),
            "output": relative.as_posix(),
            "outputSize": list(cropped.size),
            "sha256": sha256(data),
        })

    manifest = {
        "version": 1,
        "sources": {
            round_id: {
                "label": f"{round_id[:4]}년 {round_id[-1]}회 해설 PDF",
                "pages": len(pages[round_id]),
                "sha256": sha256(path.read_bytes()),
            }
            for round_id, path in sources.items()
        },
        "crops": records,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"crops": len(records), "manifest": str(args.manifest)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
