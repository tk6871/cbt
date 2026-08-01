#!/usr/bin/env python3
"""Stage, validate, and apply CBT image upscales on Apple Silicon Macs.

The tool never runs Real-ESRGAN against already-upscaled destination files.
HVAC restored-question originals are extracted from Git history, while embedded
subject images are always read from their preserved GIF originals.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
import subprocess
import tarfile
import time
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORK_ROOT = PROJECT_ROOT / "work" / "image-upscale-macos"
SOURCE_ROOT = WORK_ROOT / "source"
STAGE_ROOT = WORK_ROOT / "stage"
TEMP_ROOT = WORK_ROOT / "temp"
LOG_ROOT = WORK_ROOT / "logs"
MANIFEST_ROOT = WORK_ROOT / "manifests"
ENGINE_ROOT = (
    PROJECT_ROOT
    / "tools"
    / "realesrgan"
    / "realesrgan-ncnn-vulkan-20220424-macos"
)
DEFAULT_ENGINE = ENGINE_ROOT / "realesrgan-ncnn-vulkan"
MODEL_NAME = "realesrgan-x4plus-anime"
PIPELINE_NAME = "4x-model-to-2x-bicubic"
HVAC_ORIGINAL_REVISION = "1d38c97^"


@dataclass(frozen=True)
class Target:
    key: str
    source_relative: Path
    source_extensions: tuple[str, ...]
    output_extension: str | None
    expected_count: int
    source_revision: str | None = None
    data_relative: Path | None = None


@dataclass(frozen=True)
class Item:
    source: Path
    source_relative: Path
    stage: Path
    destination: Path
    output_extension: str
    width: int
    height: int


TARGETS = {
    "hvac-restored": Target(
        key="hvac-restored",
        source_relative=Path("assets/hvac/assets/questions"),
        source_extensions=(".jpg", ".jpeg", ".png"),
        output_extension=None,
        expected_count=1020,
        source_revision=HVAC_ORIGINAL_REVISION,
    ),
    "hvac-comcbt": Target(
        key="hvac-comcbt",
        source_relative=Path("assets/hvac/assets/comcbt"),
        source_extensions=(".gif",),
        output_extension=".png",
        expected_count=1348,
    ),
    "safety": Target(
        key="safety",
        source_relative=Path("assets/safety/assets/comcbt"),
        source_extensions=(".gif",),
        output_extension=".png",
        expected_count=481,
        data_relative=Path("data/safety.js"),
    ),
    "maintenance": Target(
        key="maintenance",
        source_relative=Path("assets/maintenance/comcbt"),
        source_extensions=(".gif",),
        output_extension=".png",
        expected_count=820,
        data_relative=Path("data/maintenance.js"),
    ),
}


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        image.load()
        return image.size


def safe_extract(archive_path: Path, destination: Path) -> None:
    destination_resolved = destination.resolve()
    with tarfile.open(archive_path) as archive:
        for member in archive.getmembers():
            member_path = (destination / member.name).resolve()
            if (
                member_path != destination_resolved
                and destination_resolved not in member_path.parents
            ):
                raise RuntimeError(f"Unsafe archive member: {member.name}")
        archive.extractall(destination, filter="data")


def ensure_historical_source(target: Target) -> Path:
    if not target.source_revision:
        return PROJECT_ROOT / target.source_relative

    extraction_root = SOURCE_ROOT / target.key
    source_root = extraction_root / target.source_relative
    existing = (
        sorted(
            path
            for path in source_root.rglob("*")
            if path.is_file() and path.suffix.lower() in target.source_extensions
        )
        if source_root.is_dir()
        else []
    )
    if len(existing) == target.expected_count:
        return source_root

    if extraction_root.exists():
        shutil.rmtree(extraction_root)
    extraction_root.mkdir(parents=True)
    archive_path = SOURCE_ROOT / f"{target.key}.tar"
    command = [
        "git",
        "archive",
        "--format=tar",
        f"--output={archive_path}",
        target.source_revision,
        "--",
        target.source_relative.as_posix(),
    ]
    subprocess.run(command, cwd=PROJECT_ROOT, check=True)
    safe_extract(archive_path, extraction_root)
    archive_path.unlink()

    extracted = sorted(
        path
        for path in source_root.rglob("*")
        if path.is_file() and path.suffix.lower() in target.source_extensions
    )
    if len(extracted) != target.expected_count:
        raise RuntimeError(
            f"{target.key}: extracted {len(extracted)}, "
            f"expected {target.expected_count}"
        )
    return source_root


def collect_items(target: Target) -> list[Item]:
    source_root = ensure_historical_source(target)
    sources = sorted(
        path
        for path in source_root.rglob("*")
        if path.is_file() and path.suffix.lower() in target.source_extensions
    )
    if len(sources) != target.expected_count:
        raise RuntimeError(
            f"{target.key}: found {len(sources)} sources, "
            f"expected {target.expected_count}"
        )

    items: list[Item] = []
    seen_destinations: set[Path] = set()
    for source in sources:
        relative = source.relative_to(source_root)
        output_extension = target.output_extension or source.suffix.lower()
        output_relative = relative.with_suffix(output_extension)
        stage = STAGE_ROOT / target.key / output_relative
        if target.source_revision:
            destination = PROJECT_ROOT / target.source_relative / output_relative
        else:
            destination = source.with_suffix(output_extension)
        if destination in seen_destinations:
            raise RuntimeError(f"{target.key}: duplicate destination {destination}")
        seen_destinations.add(destination)
        width, height = image_size(source)
        if width < 1 or height < 1:
            raise RuntimeError(f"{target.key}: invalid image {source}")
        items.append(
            Item(
                source=source,
                source_relative=target.source_relative / relative,
                stage=stage,
                destination=destination,
                output_extension=output_extension,
                width=width,
                height=height,
            )
        )
    return items


def valid_stage(item: Item) -> bool:
    if not item.stage.is_file():
        return False
    try:
        return image_size(item.stage) == (item.width * 2, item.height * 2)
    except Exception:
        return False


def group_key(item: Item) -> str:
    relative_parent = item.source_relative.parent.as_posix()
    digest = hashlib.sha1(relative_parent.encode("utf-8")).hexdigest()[:10]
    return f"{item.source_relative.parent.name}-{digest}"


def run_group(
    target: Target,
    items: list[Item],
    engine: Path,
    tile_size: int,
    jpeg_quality: int,
    group_position: int,
    group_count: int,
) -> None:
    pending = [item for item in items if not valid_stage(item)]
    if not pending:
        print(
            f"SKIP {target.key} group {group_position}/{group_count} "
            f"- {len(items)} already validated",
            flush=True,
        )
        return

    key = group_key(items[0])
    group_temp = TEMP_ROOT / target.key / key
    input_root = group_temp / "input"
    output_root = group_temp / "4x"
    if group_temp.exists():
        shutil.rmtree(group_temp)
    input_root.mkdir(parents=True)
    output_root.mkdir(parents=True)

    by_name: dict[str, Item] = {}
    for position, item in enumerate(pending, start=1):
        input_name = f"{position:04d}-{item.source.stem}.png"
        if input_name in by_name:
            raise RuntimeError(f"{target.key}: duplicate temporary name {input_name}")
        by_name[input_name] = item
        with Image.open(item.source) as source:
            source.convert("RGB").save(input_root / input_name, format="PNG")

    LOG_ROOT.mkdir(parents=True, exist_ok=True)
    log_path = LOG_ROOT / f"{target.key}.log"
    command = [
        "arch",
        "-arm64",
        str(engine),
        "-i",
        str(input_root),
        "-o",
        str(output_root),
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
        f"MODEL {target.key} group {group_position}/{group_count} "
        f"- {len(pending)} images",
        flush=True,
    )
    started = time.monotonic()
    with log_path.open("a", encoding="utf-8") as log:
        log.write(
            f"\nGROUP {group_position}/{group_count} {key} "
            f"images={len(pending)} tile={tile_size}\n"
        )
        result = subprocess.run(
            command,
            cwd=engine.parent,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
        )
    if result.returncode != 0:
        tail = "\n".join(log_path.read_text(encoding="utf-8").splitlines()[-30:])
        raise RuntimeError(
            f"{target.key}: Real-ESRGAN failed with {result.returncode}\n{tail}"
        )

    for input_name, item in by_name.items():
        four_x = output_root / input_name
        if not four_x.is_file():
            raise RuntimeError(f"{target.key}: missing 4x output {four_x}")
        if image_size(four_x) != (item.width * 4, item.height * 4):
            raise RuntimeError(f"{target.key}: invalid 4x dimensions {four_x}")
        item.stage.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(four_x) as model_output:
            final_image = model_output.convert("RGB").resize(
                (item.width * 2, item.height * 2),
                Image.Resampling.BICUBIC,
            )
            temporary_stage = item.stage.with_name(
                f".{item.stage.stem}.tmp{item.stage.suffix}"
            )
            if item.output_extension in (".jpg", ".jpeg"):
                final_image.save(
                    temporary_stage,
                    format="JPEG",
                    quality=jpeg_quality,
                    subsampling=0,
                )
            else:
                final_image.save(temporary_stage, format="PNG")
            temporary_stage.replace(item.stage)
        if not valid_stage(item):
            raise RuntimeError(f"{target.key}: invalid staged output {item.stage}")

    shutil.rmtree(group_temp)
    elapsed = time.monotonic() - started
    print(
        f"DONE {target.key} group {group_position}/{group_count} "
        f"- {len(pending)} images / {elapsed:.1f}s",
        flush=True,
    )


def stage_target(
    target: Target,
    engine: Path,
    tile_size: int,
    jpeg_quality: int,
) -> None:
    items = collect_items(target)
    grouped: dict[Path, list[Item]] = {}
    for item in items:
        grouped.setdefault(item.source.parent, []).append(item)
    groups = sorted(grouped.values(), key=lambda group: group[0].source.as_posix())
    complete = sum(1 for item in items if valid_stage(item))
    print(
        f"START {target.key} - sources={len(items)} "
        f"staged={complete} groups={len(groups)}",
        flush=True,
    )
    for position, group in enumerate(groups, start=1):
        run_group(
            target,
            group,
            engine,
            tile_size,
            jpeg_quality,
            position,
            len(groups),
        )
    print(f"STAGED {target.key} - {len(items)} images", flush=True)


def validate_target(target: Target, tile_size: int) -> list[dict[str, object]]:
    items = collect_items(target)
    rows: list[dict[str, object]] = []
    for item in items:
        if not valid_stage(item):
            raise RuntimeError(f"{target.key}: invalid or missing stage {item.stage}")
        output_width, output_height = image_size(item.stage)
        rows.append(
            {
                "Target": target.key,
                "Source": item.source_relative.as_posix(),
                "Stage": item.stage.relative_to(PROJECT_ROOT).as_posix(),
                "Destination": item.destination.relative_to(PROJECT_ROOT).as_posix(),
                "SourceWidth": item.width,
                "SourceHeight": item.height,
                "OutputWidth": output_width,
                "OutputHeight": output_height,
                "SourceBytes": item.source.stat().st_size,
                "OutputBytes": item.stage.stat().st_size,
                "Model": MODEL_NAME,
                "TileSize": tile_size,
                "Pipeline": PIPELINE_NAME,
                "SourceRevision": target.source_revision or "working-tree-original",
            }
        )
    if len(rows) != target.expected_count:
        raise RuntimeError(
            f"{target.key}: validated {len(rows)}, expected {target.expected_count}"
        )

    MANIFEST_ROOT.mkdir(parents=True, exist_ok=True)
    json_path = MANIFEST_ROOT / f"{target.key}.json"
    csv_path = MANIFEST_ROOT / f"{target.key}.csv"
    json_path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"VALIDATED {target.key} - {len(rows)} images", flush=True)
    return rows


def replace_data_references(target: Target, items: list[Item]) -> int:
    if not target.data_relative:
        return 0
    data_path = PROJECT_ROOT / target.data_relative
    data_text = data_path.read_text(encoding="utf-8")
    replacements = 0
    for item in items:
        old_reference = item.source_relative.as_posix()
        new_reference = old_reference.rsplit(".", 1)[0] + item.output_extension
        old_count = data_text.count(old_reference)
        new_count = data_text.count(new_reference)
        if old_count == 1 and new_count == 0:
            data_text = data_text.replace(old_reference, new_reference)
            replacements += 1
        elif old_count == 0 and new_count == 1:
            continue
        else:
            raise RuntimeError(
                f"{target.key}: unexpected references for {old_reference}: "
                f"old={old_count}, new={new_count}"
            )
    temporary = data_path.with_name(f".{data_path.name}.upscale.tmp")
    temporary.write_text(data_text, encoding="utf-8")
    temporary.replace(data_path)
    return replacements


def apply_target(target: Target, tile_size: int) -> None:
    validate_target(target, tile_size)
    items = collect_items(target)
    for position, item in enumerate(items, start=1):
        item.destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = item.destination.with_name(
            f".{item.destination.name}.upscale.tmp"
        )
        shutil.copy2(item.stage, temporary)
        temporary.replace(item.destination)
        if position % 100 == 0 or position == len(items):
            print(
                f"APPLY {target.key} - {position}/{len(items)}",
                flush=True,
            )
    replacements = replace_data_references(target, items)
    missing = [item.destination for item in items if not item.destination.is_file()]
    invalid = [
        item.destination
        for item in items
        if image_size(item.destination) != (item.width * 2, item.height * 2)
    ]
    if missing or invalid:
        raise RuntimeError(
            f"{target.key}: applied validation failed, "
            f"missing={len(missing)}, invalid={len(invalid)}"
        )
    print(
        f"APPLIED {target.key} - images={len(items)} "
        f"references_replaced={replacements}",
        flush=True,
    )


def inventory_target(target: Target) -> None:
    items = collect_items(target)
    staged = sum(1 for item in items if valid_stage(item))
    destinations = sum(1 for item in items if item.destination.is_file())
    print(
        json.dumps(
            {
                "target": target.key,
                "sources": len(items),
                "staged_valid": staged,
                "destinations_present": destinations,
                "source_revision": target.source_revision
                or "working-tree-original",
            },
            ensure_ascii=False,
        )
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "mode",
        choices=("inventory", "stage", "validate", "apply"),
    )
    parser.add_argument(
        "--targets",
        nargs="+",
        choices=tuple(TARGETS),
        default=list(TARGETS),
    )
    parser.add_argument("--engine", type=Path, default=DEFAULT_ENGINE)
    parser.add_argument("--tile-size", type=int, default=256)
    parser.add_argument("--jpeg-quality", type=int, default=94)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.tile_size < 32 or args.tile_size > 512:
        raise ValueError("tile size must be between 32 and 512")
    if args.jpeg_quality < 80 or args.jpeg_quality > 100:
        raise ValueError("JPEG quality must be between 80 and 100")
    engine = args.engine.resolve()
    if args.mode == "stage" and not engine.is_file():
        raise FileNotFoundError(engine)

    selected = [TARGETS[key] for key in args.targets]
    for target in selected:
        if args.mode == "inventory":
            inventory_target(target)
        elif args.mode == "stage":
            stage_target(target, engine, args.tile_size, args.jpeg_quality)
        elif args.mode == "validate":
            validate_target(target, args.tile_size)
        elif args.mode == "apply":
            apply_target(target, args.tile_size)


if __name__ == "__main__":
    main()
