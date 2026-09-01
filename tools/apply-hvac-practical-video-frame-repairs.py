#!/usr/bin/env python3
import argparse
import json
import shutil
import subprocess
import tempfile
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "hvac-practical-video-frame-repairs.json"
DEFAULT_VIDEO_ROOT = Path("/Volumes/CT1000P3/공부")
BACKUP_ROOT = ROOT / "work" / "hvac-practical-video-original-crops"


def qa_font(size: int):
    for path in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def render_qa_sheets(repairs: list[dict], output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    title_font = qa_font(24)
    label_font = qa_font(18)
    per_sheet = 5
    for round_key in sorted({row["round"] for row in repairs}):
        rows = [row for row in repairs if row["round"] == round_key]
        for page_start in range(0, len(rows), per_sheet):
            page_rows = rows[page_start:page_start + per_sheet]
            canvas = Image.new("RGB", (1200, 90 + 410 * len(page_rows)), "white")
            draw = ImageDraw.Draw(canvas)
            draw.text((24, 20), f"{round_key}  BEFORE / AFTER", fill="black", font=title_font)
            for row_index, row in enumerate(page_rows):
                target = ROOT / row["image"]
                backup = BACKUP_ROOT / row["round"] / target.name
                y = 80 + row_index * 410
                label = target.stem.replace("hvac-practical-restored-", "")
                draw.text((24, y), label, fill="black", font=label_font)
                for column, source in enumerate((backup, target)):
                    image = Image.open(source).convert("RGB")
                    image.thumbnail((560, 350), Image.Resampling.LANCZOS)
                    x = 20 + column * 590 + (560 - image.width) // 2
                    image_y = y + 32 + (350 - image.height) // 2
                    canvas.paste(image, (x, image_y))
                    draw.rectangle((20 + column * 590, y + 32, 580 + column * 590, y + 382), outline="#777", width=2)
            page = page_start // per_sheet + 1
            output = output_dir / f"{round_key}-qa-{page}.jpg"
            canvas.save(output, "JPEG", quality=90)
            outputs.append(output)
    return outputs


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).lower()


def find_video(video_root: Path, round_key: str) -> Path:
    year, session = round_key.split("-", 1)
    tokens = [f"{year}년 제{session}회", f"{year}년 {session}회"]
    candidates = []
    for path in video_root.rglob("*.mp4"):
        name = normalized(path.name)
        if "공조냉동" not in name or "필답형" not in name or "복원" not in name:
            continue
        if not any(normalized(token) in name for token in tokens):
            continue
        score = (1 if "/na/" in normalized(str(path)) else 0, 0 if "full ver" in name else 1, len(str(path)))
        candidates.append((score, path))
    if not candidates:
        raise FileNotFoundError(f"{round_key} 원본 영상을 찾지 못했습니다: {video_root}")
    return sorted(candidates)[0][1]


def extract_frame(video: Path, timestamp: float, output: Path) -> None:
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{timestamp:.3f}", "-i", str(video), "-frames:v", "1", str(output),
    ], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="검수된 공조 필답형 영상 프레임으로 잘린 이미지를 복원합니다.")
    parser.add_argument("--apply", action="store_true", help="검수 목록을 실제 이미지에 적용")
    parser.add_argument("--qa-output", type=Path, help="교체 전후 검수표를 저장할 폴더")
    parser.add_argument("--video-root", type=Path, default=DEFAULT_VIDEO_ROOT)
    args = parser.parse_args()

    repairs = json.loads(MANIFEST.read_text(encoding="utf-8"))
    videos = {round_key: find_video(args.video_root, round_key) for round_key in sorted({row["round"] for row in repairs})}
    checked = []
    for row in repairs:
        target = ROOT / row["image"]
        if not target.is_file():
            raise FileNotFoundError(target)
        crop = tuple(int(value) for value in row["crop"])
        if len(crop) != 4 or crop[0] < 0 or crop[1] < 0 or crop[2] <= crop[0] or crop[3] <= crop[1]:
            raise ValueError(f"잘못된 crop: {row}")
        current = Image.open(target)
        checked.append({
            "image": row["image"],
            "sourceSize": list(current.size),
            "outputSize": [crop[2] - crop[0], crop[3] - crop[1]],
            "preserveCurrent": bool(row.get("preserveCurrent")),
        })
    if args.qa_output and not args.apply:
        outputs = render_qa_sheets(repairs, args.qa_output)
        print(json.dumps({"mode": "qa", "sheets": [str(path) for path in outputs]}, ensure_ascii=False, indent=2))
        return
    if not args.apply:
        print(json.dumps({"mode": "check", "repairs": len(checked), "items": checked}, ensure_ascii=False, indent=2))
        return

    with tempfile.TemporaryDirectory(prefix="cbt-hvac-practical-frame-repair-") as temp_dir_text:
        temp_dir = Path(temp_dir_text)
        for index, row in enumerate(repairs, 1):
            target = ROOT / row["image"]
            backup = BACKUP_ROOT / row["round"] / target.name
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                shutil.copy2(target, backup)

            frame_path = temp_dir / f"frame-{index:03d}.png"
            extract_frame(videos[row["round"]], float(row["timestamp"]), frame_path)
            frame = Image.open(frame_path).convert("RGB")
            crop = tuple(int(value) for value in row["crop"])
            if crop[2] > frame.width or crop[3] > frame.height:
                raise ValueError(f"영상 범위를 벗어난 crop: {row}")
            repaired = frame.crop(crop)
            if row.get("preserveCurrent"):
                # 재실행해도 이미 확장된 결과를 다시 붙이지 않고 최초 원본을 사용한다.
                current = Image.open(backup).convert("RGB")
                mask = Image.new("L", current.size, 255)
                mask_draw = ImageDraw.Draw(mask)
                feather = min(24, current.width, current.height)
                for offset in range(feather):
                    alpha = round(255 * (feather - 1 - offset) / max(1, feather - 1))
                    mask_draw.line((current.width - feather + offset, 0, current.width - feather + offset, current.height), fill=alpha)
                    mask_draw.line((0, current.height - feather + offset, current.width, current.height - feather + offset), fill=alpha)
                repaired.paste(current, (0, 0), mask)
            output = temp_dir / f"output-{index:03d}.png"
            repaired.save(output, format="PNG", optimize=True)
            shutil.copy2(output, target)

    result = {
        "mode": "apply",
        "repairs": len(repairs),
        "backup": str(BACKUP_ROOT),
    }
    if args.qa_output:
        result["qaSheets"] = [str(path) for path in render_qa_sheets(repairs, args.qa_output)]
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
