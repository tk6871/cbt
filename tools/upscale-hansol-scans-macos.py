#!/usr/bin/env python3
"""Upscale the 2020 Hansol scan crops with the established Mac pipeline."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENGINE = (PROJECT_ROOT / "tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos"
                  / "realesrgan-ncnn-vulkan")
TARGETS = ("2020_1", "2020_3")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", type=Path, default=DEFAULT_ENGINE)
    parser.add_argument("--tile-size", type=int, default=256)
    args = parser.parse_args()

    source_root = PROJECT_ROOT / "assets/hvac-hansol/questions"
    backup_root = PROJECT_ROOT / "work/hansol-original-scans"
    total = 0
    with tempfile.TemporaryDirectory(prefix="cbt-hansol-upscale-") as temporary:
        temporary_root = Path(temporary)
        for target in TARGETS:
            source = source_root / target
            originals = backup_root / target
            model_input = temporary_root / f"{target}-input"
            output = temporary_root / target
            originals.mkdir(parents=True, exist_ok=True)
            model_input.mkdir(parents=True, exist_ok=True)
            output.mkdir(parents=True, exist_ok=True)
            items = sorted(source.glob("*.webp"))
            if len(items) != 80:
                raise RuntimeError(f"{target}: 80장이 필요하지만 {len(items)}장입니다.")
            sizes = {}
            for item in items:
                shutil.copy2(item, originals / item.name)
                with Image.open(item) as image:
                    sizes[item.stem] = image.size
                    image.convert("RGB").save(model_input / f"{item.stem}.png", "PNG")
            subprocess.run([
                "arch", "-arm64", str(args.engine),
                "-i", str(model_input), "-o", str(output),
                "-n", "realesrgan-x4plus-anime", "-s", "4",
                "-t", str(args.tile_size), "-f", "png",
            ], cwd=args.engine.parent, check=True)
            generated = sorted(output.glob("*.png"))
            if len(generated) != 80:
                raise RuntimeError(f"{target}: Real-ESRGAN 결과가 {len(generated)}장입니다.")
            for result in generated:
                original_size = sizes[result.stem]
                expected = (original_size[0] * 2, original_size[1] * 2)
                with Image.open(result) as image:
                    resized = image.convert("RGB").resize(expected, Image.Resampling.BICUBIC)
                    resized.save(source / f"{result.stem}.webp", "WEBP", lossless=True, method=6)
                total += 1
            print(f"{target}: 80장 완료 (4배 모델 → 2배 bicubic)")
    print(f"완료: {total}장, 원본 보존: {backup_root.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
