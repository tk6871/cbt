#!/usr/bin/env python3
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser(description="저장된 필답형 크롭 이미지가 나온 원본 영상 시각을 찾습니다.")
    parser.add_argument("image")
    parser.add_argument("video")
    parser.add_argument("--fps", type=float, default=1.0)
    parser.add_argument("--extract")
    args = parser.parse_args()

    target = np.asarray(Image.open(args.image).convert("RGB").resize((64, 44), Image.Resampling.LANCZOS), dtype=np.float32)
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", args.video,
        "-vf", f"fps={args.fps},scale=96:54", "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    frame_size = 96 * 54 * 3
    best = []
    index = 0
    while True:
        data = process.stdout.read(frame_size)
        if len(data) != frame_size:
            break
        frame = np.frombuffer(data, dtype=np.uint8).reshape((54, 96, 3)).astype(np.float32)
        for y in (0, 5, 10):
            crop = frame[y:y + 44, :64]
            score = float(np.mean((crop - target) ** 2))
            best.append((score, index / args.fps, y * 20))
        best = sorted(best)[:8]
        index += 1
    process.wait()

    for score, timestamp, source_y in best:
        print(f"time={timestamp:.3f}s sourceY={source_y}px mse={score:.2f}")

    if args.extract and best:
        output = Path(args.extract)
        output.parent.mkdir(parents=True, exist_ok=True)
        timestamp = best[0][1]
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}",
            "-i", args.video, "-frames:v", "1", str(output),
        ], check=True)


if __name__ == "__main__":
    main()
