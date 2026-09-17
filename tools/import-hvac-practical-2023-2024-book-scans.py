#!/usr/bin/env python3
"""Import reviewed figures from the user's 2023-3 through 2024-2 scan archive.

The archive contains photographed solution-book pages whose printed question
order differs from the restored dataset.  Only figure regions are exported;
full pages, printed solutions, handwriting, and the source archive stay out of
the repository.  Question IDs are matched by content through SOURCE_ORDER.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageOps


SOURCE_ORDER = {
    "2023-3": [2, 3, 7, 8, 4, 6, 11, 5, 9, 12, 1, 10],
    "2024-1": [4, 6, 8, 11, 12, 7, 2, 9, 10, 3, 5, 1],
    "2024-2": [4, 6, 12, 9, 5, 8, 10, 11, 3, 7, 1, 2],
}

SOURCE_PAGES = {
    "2023-3": ["Scan0026.jpg", "Scan0026.jpg", "Scan0027.jpg", "Scan0027.jpg", "Scan0028.jpg", "Scan0028.jpg", "Scan0028.jpg", "Scan0029.jpg", "Scan0029.jpg", "Scan0030.jpg", "Scan0030.jpg", "Scan0031.jpg"],
    "2024-1": ["Scan0032.jpg", "Scan0033.jpg", "Scan0033.jpg", "Scan0033.jpg", "Scan0036.jpg", "Scan0036.jpg", "Scan0037.jpg", "Scan0037.jpg", "Scan0038.jpg", "Scan0038.jpg", "Scan0038.jpg", "Scan0039.jpg"],
    "2024-2": ["Scan0041.jpg", "Scan0041.jpg", "Scan0042.jpg", "Scan0042.jpg", "Scan0042.jpg", "Scan0043.jpg", "Scan0043.jpg", "Scan0044.jpg", "Scan0044.jpg", "Scan0044.jpg", "Scan0045.jpg", "Scan0046.jpg"],
}

# Coordinates use EXIF-normalized 1700 x 2338 source pixels.  The regions keep
# only the problem figure and avoid answer text printed elsewhere on the page.
CROPS = [
    {"round": "2023-3", "number": 1, "sourceQuestion": 11, "scan": "Scan0030.jpg", "crop": [560, 1090, 1040, 1540]},
    {"round": "2023-3", "number": 3, "sourceQuestion": 2, "scan": "Scan0026.jpg", "crop": [360, 1290, 1300, 1640]},
    {"round": "2023-3", "number": 5, "sourceQuestion": 8, "scan": "Scan0029.jpg", "crop": [500, 700, 1410, 1320]},
    {"round": "2023-3", "number": 6, "sourceQuestion": 6, "scan": "Scan0028.jpg", "crop": [760, 735, 1220, 1120]},
    {"round": "2023-3", "number": 7, "sourceQuestion": 3, "scan": "Scan0027.jpg", "crop": [500, 430, 1460, 820]},
    {"round": "2023-3", "number": 8, "sourceQuestion": 4, "scan": "Scan0027.jpg", "crop": [500, 1200, 1480, 1480]},
    {"round": "2023-3", "number": 9, "sourceQuestion": 9, "scan": "Scan0029.jpg", "crop": [760, 1900, 1160, 2160]},
    {"round": "2023-3", "number": 10, "sourceQuestion": 12, "scan": "Scan0031.jpg", "crop": [420, 260, 1430, 850]},
    {"round": "2023-3", "number": 11, "sourceQuestion": 7, "scan": "Scan0028.jpg", "crop": [180, 1450, 1260, 1760]},
    {"round": "2023-3", "number": 12, "sourceQuestion": 10, "scan": "Scan0030.jpg", "crop": [430, 570, 1210, 900]},
    {"round": "2024-1", "number": 3, "sourceQuestion": 10, "scan": "Scan0038.jpg", "crop": [480, 430, 1300, 650]},
    {"round": "2024-1", "number": 4, "sourceQuestion": 1, "scan": "Scan0032.jpg", "crop": [360, 590, 1280, 1580]},
    {"round": "2024-1", "number": 5, "sourceQuestion": 11, "scan": "Scan0038.jpg", "crop": [600, 1340, 1160, 1710]},
    {"round": "2024-1", "number": 6, "sourceQuestion": 2, "scan": "Scan0033.jpg", "crop": [650, 590, 1180, 930]},
    {"round": "2024-1", "number": 7, "sourceQuestion": 6, "scan": "Scan0036.jpg", "crop": [520, 1530, 1450, 1790]},
    {"round": "2024-1", "number": 9, "sourceQuestion": 8, "scan": "Scan0037.jpg", "crop": [275, 1530, 1250, 1705]},
    {"round": "2024-1", "number": 11, "sourceQuestion": 4, "scan": "Scan0033.jpg", "crop": [500, 1700, 1480, 2110]},
    {"round": "2024-1", "number": 12, "sourceQuestion": 5, "scan": "Scan0036.jpg", "crop": [500, 650, 1300, 930]},
    {"round": "2024-2", "number": 3, "sourceQuestion": 9, "scan": "Scan0044.jpg", "crop": [600, 790, 1270, 1030]},
    {"round": "2024-2", "number": 4, "sourceQuestion": 1, "scan": "Scan0041.jpg", "crop": [360, 860, 1180, 1210]},
    {"round": "2024-2", "number": 6, "sourceQuestion": 2, "scan": "Scan0041.jpg", "crop": [450, 1580, 1030, 2100]},
    {"round": "2024-2", "number": 9, "sourceQuestion": 4, "scan": "Scan0042.jpg", "crop": [500, 880, 1330, 1300]},
    {"round": "2024-2", "number": 10, "sourceQuestion": 7, "scan": "Scan0043.jpg", "crop": [520, 1300, 930, 1550]},
    {"round": "2024-2", "number": 11, "sourceQuestion": 8, "scan": "Scan0044.jpg", "crop": [600, 240, 1260, 450]},
    {"round": "2024-2", "number": 12, "sourceQuestion": 3, "scan": "Scan0042.jpg", "crop": [600, 270, 1270, 520]},
]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_scans(archive: Path) -> tuple[dict[str, Image.Image], dict[str, str]]:
    images: dict[str, Image.Image] = {}
    hashes: dict[str, str] = {}
    with ZipFile(archive) as zipped:
        for info in zipped.infolist():
            name = Path(info.filename).name
            if not name.lower().endswith((".jpg", ".jpeg")):
                continue
            raw = zipped.read(info)
            image = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert("RGB")
            images[name] = image
            hashes[name] = digest(raw)
    expected = {name for names in SOURCE_PAGES.values() for name in names}
    missing = sorted(expected - images.keys())
    if missing:
        raise ValueError(f"스캔 누락: {', '.join(missing)}")
    return images, hashes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, default=Path("assets/hvac-practical/restored"))
    parser.add_argument("--manifest", type=Path, default=Path("data/hvac-practical-2023-2024-book-scans.json"))
    args = parser.parse_args()

    scans, scan_hashes = read_scans(args.archive)
    records = []
    for item in CROPS:
        source = scans[item["scan"]]
        if source.size != (1700, 2338):
            raise ValueError(f"{item['scan']} 크기 불일치: {source.size}")
        cropped = source.crop(tuple(item["crop"]))
        round_id = item["round"]
        filename = f"hvac-practical-restored-{round_id}-{item['number']:02d}-question-book-scan-v514.png"
        output = args.output_root / round_id / filename
        output.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output, format="PNG", optimize=True)
        records.append({
            **item,
            "role": "question",
            "sourceSize": list(source.size),
            "output": output.as_posix(),
            "outputSize": list(cropped.size),
            "sha256": digest(output.read_bytes()),
        })

    source_mapping = []
    for round_id, numbers in SOURCE_ORDER.items():
        pages = SOURCE_PAGES[round_id]
        for source_number, (target_number, scan) in enumerate(zip(numbers, pages), 1):
            source_mapping.append({
                "round": round_id,
                "sourceQuestion": source_number,
                "targetId": f"hvac-practical-restored-{round_id}-{target_number:02d}",
                "scan": scan,
            })

    manifest = {
        "version": 1,
        "source": {
            "label": "사용자 제공 2023년 3회~2024년 2회 필답형 해설 스캔",
            "archiveSha256": digest(args.archive.read_bytes()),
            "scanCount": len(scans),
            "scanSha256": dict(sorted(scan_hashes.items())),
        },
        "mappingRule": "인쇄 번호가 기존 복원 번호와 달라 문제 문장과 그림으로 대응",
        "duplicatePhotos": [
            ["Scan0034.jpg", "Scan0036.jpg", "2024-1 source questions 5-6"],
            ["Scan0035.jpg", "Scan0037.jpg", "2024-1 source questions 7-8"],
        ],
        "variantDifferences": [],
        "sourceMapping": source_mapping,
        "crops": records,
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"mappedQuestions": len(source_mapping), "crops": len(records), "manifest": str(args.manifest)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
