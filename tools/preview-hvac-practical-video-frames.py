#!/usr/bin/env python3
import argparse
import json
import subprocess
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "hvac-practical-restored.json"
DEFAULT_VIDEO_ROOT = Path("/Volumes/CT1000P3/공부")
DEFAULT_OUTPUT_ROOT = Path("/private/tmp/cbt-hvac-practical-frame-preview")
BACKUP_ROOT = ROOT / "work" / "hvac-practical-video-original-crops"


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).lower()


def find_video(video_root: Path, year: int, session: str) -> Path:
    round_tokens = [f"{year}년 제{session}회", f"{year}년 {session}회"]
    candidates = []
    for path in video_root.rglob("*.mp4"):
        name = normalized(path.name)
        if "공조냉동" not in name or "필답형" not in name or "복원" not in name:
            continue
        if not any(normalized(token) in name for token in round_tokens):
            continue
        score = (
            1 if "/na/" in normalized(str(path)) else 0,
            0 if "full ver" in name else 1,
            len(str(path)),
        )
        candidates.append((score, path))
    if not candidates:
        raise FileNotFoundError(f"{year}-{session} 원본 영상을 찾지 못했습니다: {video_root}")
    return sorted(candidates)[0][1]


def probe_video(video: Path) -> tuple[int, int]:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height", "-of", "json", str(video),
    ], check=True, capture_output=True, text=True)
    stream = json.loads(result.stdout)["streams"][0]
    return int(stream["width"]), int(stream["height"])


def ink_weight(image: np.ndarray) -> np.ndarray:
    """Give whiteboard ink and pasted reference images more weight than blank board."""
    gray = image.mean(axis=2)
    board_white = float(np.percentile(gray, 92))
    darkness = np.clip((board_white - gray) / 72.0, 0.0, 1.0)
    return 0.12 + darkness * 5.0


def load_targets(
    year: int,
    session: str,
    source_width: int,
    source_height: int,
    scan_width: int,
    scan_height: int,
) -> list[dict]:
    rows = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    targets = []
    for row in rows:
        if int(row.get("year", 0)) != year or str(row.get("session")) != session:
            continue
        for kind, paths in (("question", row.get("images", [])), ("answer", row.get("answerImages", []))):
            for relative in paths:
                if str(relative).lower().endswith(".svg"):
                    continue
                absolute = ROOT / relative
                backup = BACKUP_ROOT / f"{year}-{session}" / absolute.name
                match_source = backup if backup.is_file() else absolute
                image = Image.open(match_source).convert("RGB")
                thumb_width = max(8, min(scan_width, round(image.width * scan_width / source_width)))
                thumb_height = max(8, min(scan_height, round(image.height * scan_height / source_height)))
                thumb = np.asarray(
                    image.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS),
                    dtype=np.float32,
                )
                targets.append({
                    "id": row["id"],
                    "kind": kind,
                    "relative": relative,
                    "absolute": match_source,
                    "width": image.width,
                    "height": image.height,
                    "thumb": thumb,
                    "thumb_width": thumb_width,
                    "thumb_height": thumb_height,
                    "weight": ink_weight(thumb),
                    "best": [],
                })
    return targets


def scan_video(video: Path, targets: list[dict], fps: float, scan_width: int, scan_height: int) -> None:
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
        "-vf", f"fps={fps},scale={scan_width}:{scan_height}",
        "-pix_fmt", "rgb24", "-f", "rawvideo", "-",
    ]
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    frame_size = scan_width * scan_height * 3
    frame_index = 0
    while True:
        data = process.stdout.read(frame_size)
        if len(data) != frame_size:
            break
        frame = np.frombuffer(data, dtype=np.uint8).reshape((scan_height, scan_width, 3)).astype(np.float32)
        for target in targets:
            height = target["thumb_height"]
            width = target["thumb_width"]
            crop = frame[:height, :width]
            pixel_error = np.mean((crop - target["thumb"]) ** 2, axis=2)
            mse = float(np.sum(pixel_error * target["weight"]) / np.sum(target["weight"]))
            target["best"].append((mse, frame_index / fps))
            target["best"] = sorted(target["best"])[:12]
        frame_index += 1
    process.wait()
    if process.returncode:
        raise RuntimeError(f"영상 프레임 검색 실패: {video}")


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", str(output),
    ], check=True)


def fit_image(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), "white")
    canvas.paste(copy, ((width - copy.width) // 2, (height - copy.height) // 2))
    return canvas


def timeline_sheet(
    video: Path,
    output_dir: Path,
    round_key: str,
    start: float,
    end: float,
    step: float,
) -> Path:
    frames_dir = output_dir / f"timeline-frames-{start:g}-{end:g}-{step:g}"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for stale in frames_dir.glob("frame-*.png"):
        stale.unlink()
    timestamps = []
    timestamp = start
    while timestamp < end:
        timestamps.append(timestamp)
        timestamp += step
    frames = []
    for index, timestamp in enumerate(timestamps, 1):
        frame = frames_dir / f"frame-{index:03d}.png"
        extract_frame(video, timestamp, frame)
        frames.append(frame)
    columns = 4
    rows = (len(frames) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 480, rows * 294), "#e7ecf2")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for index, frame_path in enumerate(frames):
        x = (index % columns) * 480
        y = (index // columns) * 294
        thumbnail = Image.open(frame_path).convert("RGB").resize((480, 270), Image.Resampling.LANCZOS)
        sheet.paste(thumbnail, (x, y + 24))
        draw.text((x + 8, y + 7), f"{timestamps[index]:.1f}s", fill="black", font=font)
    output = output_dir / f"{round_key}-timeline-{start:g}-{end:g}-{step:g}.jpg"
    sheet.save(output, quality=92)
    return output


def contact_sheets(targets: list[dict], output_dir: Path, round_key: str) -> list[str]:
    font = ImageFont.load_default()
    sheets = []
    for page, start in enumerate(range(0, len(targets), 4), 1):
        group = targets[start:start + 4]
        sheet = Image.new("RGB", (1600, 4 * 300), "#e7ecf2")
        draw = ImageDraw.Draw(sheet)
        for row_index, target in enumerate(group):
            top = row_index * 300
            current = fit_image(Image.open(target["absolute"]).convert("RGB"), 760, 260)
            full = fit_image(Image.open(target["preview"]).convert("RGB"), 760, 260)
            sheet.paste(current, (10, top + 30))
            sheet.paste(full, (830, top + 30))
            label = f"{target['id']} {target['kind']}  t={target['timestamp']:.1f}s  mse={target['mse']:.2f}"
            draw.text((12, top + 8), label, fill="black", font=font)
            draw.text((700, top + 8), "현재", fill="#b02020", font=font)
            draw.text((1500, top + 8), "원본 전체", fill="#1d5eaa", font=font)
        path = output_dir / f"{round_key}-contact-{page:02d}.jpg"
        sheet.save(path, quality=92)
        sheets.append(str(path))
    return sheets


def main() -> None:
    parser = argparse.ArgumentParser(description="잘린 공조 필답형 이미지를 원본 영상 전체 프레임과 대조합니다.")
    parser.add_argument("--round", required=True, help="예: 2024-1")
    parser.add_argument("--fps", type=float, default=1.0, help="초당 검색 프레임 수")
    parser.add_argument("--scan-width", type=int, default=160, help="검색용 축소 영상 너비")
    parser.add_argument("--scan-height", type=int, default=90, help="검색용 축소 영상 높이")
    parser.add_argument("--video-root", type=Path, default=DEFAULT_VIDEO_ROOT)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument(
        "--timeline",
        help="지정 구간 전체 프레임 검수표. 시작:끝:간격(초), 예: 0:600:20",
    )
    args = parser.parse_args()

    year_text, session = args.round.split("-", 1)
    year = int(year_text)
    video = find_video(args.video_root, year, session)
    source_width, source_height = probe_video(video)
    output_dir = args.output_root / args.round
    output_dir.mkdir(parents=True, exist_ok=True)
    if args.timeline:
        start, end, step = (float(value) for value in args.timeline.split(":"))
        if start < 0 or end <= start or step <= 0:
            raise ValueError("--timeline은 시작:끝:간격이며 끝>시작, 간격>0이어야 합니다.")
        output = timeline_sheet(video, output_dir, args.round, start, end, step)
        print(json.dumps({
            "round": args.round,
            "video": str(video),
            "timeline": [start, end, step],
            "contactSheet": str(output),
        }, ensure_ascii=False, indent=2))
        return
    targets = load_targets(
        year,
        session,
        source_width,
        source_height,
        args.scan_width,
        args.scan_height,
    )
    if not targets:
        raise RuntimeError(f"{args.round}에 대조할 래스터 이미지가 없습니다.")

    scan_video(video, targets, args.fps, args.scan_width, args.scan_height)
    manifest = []
    for target in targets:
        mse, timestamp = target["best"][0]
        preview = output_dir / f"{Path(target['relative']).stem}-full.png"
        extract_frame(video, timestamp, preview)
        target["mse"] = mse
        target["timestamp"] = timestamp
        target["preview"] = preview
        manifest.append({
            "id": target["id"],
            "kind": target["kind"],
            "image": target["relative"],
            "sourceSize": [target["width"], target["height"]],
            "timestamp": timestamp,
            "mse": round(mse, 4),
            "preview": str(preview),
            "alternatives": [
                {"timestamp": round(candidate_time, 3), "mse": round(candidate_mse, 4)}
                for candidate_mse, candidate_time in target["best"][:8]
            ],
        })
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps({
        "round": args.round,
        "video": str(video),
        "videoSize": [source_width, source_height],
        "fps": args.fps,
        "scanSize": [args.scan_width, args.scan_height],
        "items": manifest,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sheets = contact_sheets(targets, output_dir, args.round)
    print(json.dumps({
        "round": args.round,
        "video": str(video),
        "targets": len(targets),
        "manifest": str(manifest_path),
        "contactSheets": sheets,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
