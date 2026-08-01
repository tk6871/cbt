#!/usr/bin/env python3
"""Stage, validate, and apply Energy Manager CBT image upscales on macOS.

Pipeline:
  1. Convert every source to an RGB PNG input.
  2. Run the arm64 Real-ESRGAN NCNN executable at 4x.
  3. Downscale to 2x with bicubic interpolation.
  4. Preserve JPG names and add PNG files next to original GIF files.

The default command only creates staged files. Nothing in assets/ or data/ is
changed until the explicit ``--apply`` option is supplied.
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


EXPECTED_GIF_COUNT = 225
EXPECTED_JPG_COUNT = 100
EXPECTED_TOTAL_COUNT = EXPECTED_GIF_COUNT + EXPECTED_JPG_COUNT
MODEL_NAME = "realesrgan-x4plus-anime"
PIPELINE_NAME = "4x-model-to-2x-bicubic"

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENERGY_ROOT = PROJECT_ROOT / "assets" / "energy" / "assets"
QUESTION_ROOT = ENERGY_ROOT / "questions"
JPG_ROOT = ENERGY_ROOT / "engineer-2022"
DATA_PATH = PROJECT_ROOT / "data" / "energy.js"
STAGE_ROOT = PROJECT_ROOT / "work" / "energy-upscaled"
TEMP_ROOT = PROJECT_ROOT / "work" / "energy-upscale-temp"
LOG_ROOT = PROJECT_ROOT / "work" / "energy-upscale-logs"
DEFAULT_ENGINE_ROOT = (
    PROJECT_ROOT
    / "tools"
    / "realesrgan"
    / "realesrgan-ncnn-vulkan-20220424-macos"
)
DEFAULT_ENGINE = DEFAULT_ENGINE_ROOT / "realesrgan-ncnn-vulkan"


@dataclass(frozen=True)
class Item:
    index: int
    kind: str
    source: Path
    stage: Path
    old_reference: str
    new_reference: str

    @property
    def input_path(self) -> Path:
        return TEMP_ROOT / "input" / f"{self.index:06d}.png"

    @property
    def four_x_path(self) -> Path:
        return TEMP_ROOT / "4x" / f"{self.index:06d}.png"


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.size


def discover_items() -> list[Item]:
    gifs = sorted(QUESTION_ROOT.rglob("*.gif"))
    jpgs = sorted(
        path
        for path in JPG_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg"}
    )
    if len(gifs) != EXPECTED_GIF_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_GIF_COUNT} Energy GIF files, found {len(gifs)}."
        )
    if len(jpgs) != EXPECTED_JPG_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_JPG_COUNT} Energy JPG files, found {len(jpgs)}."
        )

    items: list[Item] = []
    for source in gifs:
        relative = source.relative_to(ENERGY_ROOT)
        stage = STAGE_ROOT / relative.with_suffix(".png")
        old_reference = source.relative_to(PROJECT_ROOT).as_posix()
        new_reference = source.with_suffix(".png").relative_to(PROJECT_ROOT).as_posix()
        items.append(
            Item(
                index=len(items) + 1,
                kind="gif",
                source=source,
                stage=stage,
                old_reference=old_reference,
                new_reference=new_reference,
            )
        )

    for source in jpgs:
        relative = source.relative_to(ENERGY_ROOT)
        reference = source.relative_to(PROJECT_ROOT).as_posix()
        items.append(
            Item(
                index=len(items) + 1,
                kind="jpg",
                source=source,
                stage=STAGE_ROOT / relative,
                old_reference=reference,
                new_reference=reference,
            )
        )

    if len(items) != EXPECTED_TOTAL_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_TOTAL_COUNT} Energy images, found {len(items)}."
        )
    return items


def application_state(items: list[Item]) -> str:
    data_text = DATA_PATH.read_text(encoding="utf-8")
    gif_items = [item for item in items if item.kind == "gif"]
    old_count = sum(data_text.count(item.old_reference) for item in gif_items)
    new_count = sum(data_text.count(item.new_reference) for item in gif_items)
    if old_count == EXPECTED_GIF_COUNT and new_count == 0:
        return "source"
    if old_count == 0 and new_count == EXPECTED_GIF_COUNT:
        return "applied"
    raise RuntimeError(
        "Energy image references are in a mixed or unexpected state: "
        f"GIF={old_count}, PNG={new_count}."
    )


def validate_applied(items: list[Item]) -> None:
    missing: list[Path] = []
    for item in items:
        destination = item.source if item.kind == "jpg" else item.source.with_suffix(".png")
        if not destination.is_file():
            missing.append(destination)
    if missing:
        preview = "\n".join(str(path) for path in missing[:10])
        raise RuntimeError(f"Missing applied Energy images:\n{preview}")
    print(
        f"ALREADY APPLIED - {EXPECTED_GIF_COUNT} PNG references + "
        f"{EXPECTED_JPG_COUNT} JPG files / missing 0"
    )


def prepare_inputs(items: list[Item]) -> None:
    input_root = TEMP_ROOT / "input"
    four_x_root = TEMP_ROOT / "4x"
    input_root.mkdir(parents=True, exist_ok=True)
    four_x_root.mkdir(parents=True, exist_ok=True)

    for item in items:
        expected = image_size(item.source)
        if item.input_path.exists() and image_size(item.input_path) == expected:
            continue
        with Image.open(item.source) as source:
            item.input_path.parent.mkdir(parents=True, exist_ok=True)
            source.convert("RGB").save(item.input_path, format="PNG")


def run_engine(items: list[Item], engine: Path, tile_size: int) -> None:
    if not engine.is_file():
        raise FileNotFoundError(f"Real-ESRGAN executable is missing: {engine}")
    engine.chmod(engine.stat().st_mode | 0o100)

    pending = [
        item
        for item in items
        if not item.four_x_path.exists()
        or image_size(item.four_x_path)
        != tuple(dimension * 4 for dimension in image_size(item.source))
    ]
    if not pending:
        print("SKIP - all 4x model outputs already passed validation.")
        return

    pending_input = TEMP_ROOT / "pending-input"
    pending_output = TEMP_ROOT / "pending-4x"
    if pending_input.exists():
        shutil.rmtree(pending_input)
    if pending_output.exists():
        shutil.rmtree(pending_output)
    pending_input.mkdir(parents=True)
    pending_output.mkdir(parents=True)

    for item in pending:
        shutil.copy2(item.input_path, pending_input / item.input_path.name)

    LOG_ROOT.mkdir(parents=True, exist_ok=True)
    log_path = LOG_ROOT / "energy-realesrgan.log"
    command = [
        "arch",
        "-arm64",
        str(engine),
        "-i",
        str(pending_input),
        "-o",
        str(pending_output),
        "-n",
        MODEL_NAME,
        "-s",
        "4",
        "-t",
        str(tile_size),
        "-f",
        "png",
    ]
    print(
        f"MODEL - {len(pending)} images / {MODEL_NAME} / "
        f"4x / tile {tile_size}px"
    )
    with log_path.open("w", encoding="utf-8") as log:
        result = subprocess.run(
            command,
            cwd=engine.parent,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
    if result.returncode != 0:
        tail = "\n".join(log_path.read_text(encoding="utf-8").splitlines()[-20:])
        raise RuntimeError(
            f"Real-ESRGAN failed with exit code {result.returncode}.\n{tail}"
        )

    for item in pending:
        output = pending_output / item.four_x_path.name
        if not output.is_file():
            raise RuntimeError(f"Missing 4x output: {output}")
        expected = tuple(dimension * 4 for dimension in image_size(item.source))
        if image_size(output) != expected:
            raise RuntimeError(
                f"Invalid 4x dimensions: {output} / "
                f"{image_size(output)} != {expected}"
            )
        shutil.copy2(output, item.four_x_path)


def create_staged_outputs(items: list[Item], jpeg_quality: int) -> None:
    for position, item in enumerate(items, start=1):
        source_width, source_height = image_size(item.source)
        expected = (source_width * 2, source_height * 2)
        if item.stage.exists() and image_size(item.stage) == expected:
            continue
        if not item.four_x_path.is_file():
            raise RuntimeError(f"Missing 4x model output: {item.four_x_path}")

        item.stage.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(item.four_x_path) as four_x:
            output = four_x.convert("RGB").resize(expected, Image.Resampling.BICUBIC)
            if item.kind == "jpg":
                output.save(
                    item.stage,
                    format="JPEG",
                    quality=jpeg_quality,
                    subsampling=0,
                )
            else:
                output.save(item.stage, format="PNG")
        if position % 25 == 0 or position == len(items):
            print(f"STAGE - {position}/{len(items)}")


def validate(items: list[Item]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for item in items:
        if not item.stage.is_file():
            raise RuntimeError(f"Missing staged image: {item.stage}")
        source_width, source_height = image_size(item.source)
        output_width, output_height = image_size(item.stage)
        if (output_width, output_height) != (
            source_width * 2,
            source_height * 2,
        ):
            raise RuntimeError(f"Invalid staged dimensions: {item.stage}")
        rows.append(
            {
                "Index": item.index,
                "Kind": item.kind,
                "Source": item.source.relative_to(PROJECT_ROOT).as_posix(),
                "Stage": item.stage.relative_to(PROJECT_ROOT).as_posix(),
                "SourceWidth": source_width,
                "SourceHeight": source_height,
                "OutputWidth": output_width,
                "OutputHeight": output_height,
                "SourceBytes": item.source.stat().st_size,
                "OutputBytes": item.stage.stat().st_size,
                "Model": MODEL_NAME,
                "Pipeline": PIPELINE_NAME,
            }
        )

    if len(rows) != EXPECTED_TOTAL_COUNT:
        raise RuntimeError(f"Validated {len(rows)} images, expected 325.")

    STAGE_ROOT.mkdir(parents=True, exist_ok=True)
    manifest_json = STAGE_ROOT / "_manifest.json"
    manifest_csv = STAGE_ROOT / "_manifest.csv"
    manifest_json.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with manifest_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(
        f"VALIDATED - {EXPECTED_GIF_COUNT} GIF→PNG + "
        f"{EXPECTED_JPG_COUNT} JPG / {len(rows)} images"
    )
    return rows


def apply_outputs(items: list[Item]) -> None:
    data_text = DATA_PATH.read_text(encoding="utf-8")
    replacement_count = 0
    for item in items:
        if item.kind != "gif":
            continue
        count = data_text.count(item.old_reference)
        if count != 1:
            raise RuntimeError(
                f"Expected one data reference for {item.old_reference}, found {count}."
            )
        data_text = data_text.replace(item.old_reference, item.new_reference)
        replacement_count += 1
    if replacement_count != EXPECTED_GIF_COUNT:
        raise RuntimeError(
            f"Expected {EXPECTED_GIF_COUNT} replacements, found {replacement_count}."
        )

    for item in items:
        destination = item.source if item.kind == "jpg" else item.source.with_suffix(".png")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item.stage, destination)
    DATA_PATH.write_text(data_text, encoding="utf-8")

    for item in items:
        destination = item.source if item.kind == "jpg" else item.source.with_suffix(".png")
        expected = image_size(item.stage)
        if not destination.is_file() or image_size(destination) != expected:
            raise RuntimeError(f"Applied image validation failed: {destination}")

    print(
        f"APPLIED - {EXPECTED_GIF_COUNT} PNG files, "
        f"{EXPECTED_JPG_COUNT} JPG files, "
        f"{replacement_count} data references"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--engine",
        type=Path,
        default=DEFAULT_ENGINE,
        help="Path to the arm64 Real-ESRGAN NCNN executable.",
    )
    parser.add_argument(
        "--tile-size",
        type=int,
        default=256,
        help="NCNN input tile size. 256 is validated for the M4 Pro 24 GB.",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=94,
        choices=range(80, 101),
        metavar="80-100",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate existing staged files without running the model.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply validated staged files and update GIF references.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.tile_size < 32:
        raise ValueError("Tile size must be at least 32.")
    items = discover_items()
    state = application_state(items)
    if state == "applied":
        validate_applied(items)
        print("Refusing to upscale the already-applied Energy images again.")
        return 0

    if not args.validate_only:
        prepare_inputs(items)
        run_engine(items, args.engine.resolve(), args.tile_size)
        create_staged_outputs(items, args.jpeg_quality)
    validate(items)
    if args.apply:
        apply_outputs(items)
    else:
        print("No project assets changed. Use --apply after reviewing staged files.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise
