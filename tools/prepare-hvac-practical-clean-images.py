"""Extract verified source pixels only; never overwrite source images or infer diagrams.

Default writes candidates to --output. --apply-assets creates separate clean assets;
--data-patch prints an apply_patch patch for the reviewed data links, without writing JSON.
"""
import argparse
import difflib
import importlib.util
import json
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/hvac-practical-restored.json'
MANIFEST = ROOT / 'data/hvac-practical-image-cleanup.json'


def paths(entry):
    stem = f"hvac-practical-restored-{entry['id']}"
    folder = f"assets/hvac-practical/restored/{entry['id'][:6]}"
    return f'{folder}/{stem}-question-1.png', [
        f'{folder}/{stem}-clean-{i+1}.png' for i in range(len(entry['crops']))
    ]


def checked_crop(image, box):
    x0, y0, x1, y1 = box
    if not (0 <= x0 < x1 <= image.width and 0 <= y0 < y1 <= image.height):
        raise ValueError(f'Out-of-image crop {box} in {image.size}')
    return image.crop(box)


def data_patch(entries):
    before = DATA.read_text()
    rows = json.loads(before)
    for entry in entries:
        source, targets = paths(entry)
        row = next(row for row in rows if row['id'] == f"hvac-practical-restored-{entry['id']}")
        if row.get('images') not in ([source], targets):
            raise ValueError(f"Source links changed; review {entry['id']}")
        row['images'] = targets
        if entry.get('preserveAsAnswer', True):
            row['answerImages'] = list(dict.fromkeys([*row.get('answerImages', []), source]))
    after = json.dumps(rows, ensure_ascii=False, indent=2) + '\n'
    diff = list(difflib.unified_diff(before.splitlines(True), after.splitlines(True), n=3))
    if diff:
        print('*** Begin Patch\n*** Update File: data/hvac-practical-restored.json')
        for line in diff[2:]:
            print('@@' if line.startswith('@@') else line.rstrip('\n'))
        print('*** End Patch')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    parser.add_argument('--apply-assets', action='store_true')
    parser.add_argument('--data-patch', action='store_true')
    parser.add_argument('--ids', nargs='+', help='Only prepare selected reviewed entries')
    args = parser.parse_args()
    entries = json.loads(MANIFEST.read_text())
    if args.ids:
        selected = set(args.ids)
        entries = [entry for entry in entries if entry['id'] in selected]
        if {entry['id'] for entry in entries} != selected:
            raise ValueError('Unknown manifest ID')
    if args.data_patch:
        data_patch(entries)
        return
    if not args.output:
        parser.error('--output is required for candidate/QA output')
    spec = importlib.util.spec_from_file_location('frames', ROOT / 'tools/apply-hvac-practical-video-frame-repairs.py')
    frames = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(frames)
    args.output.mkdir(parents=True, exist_ok=True)
    previews = []
    with tempfile.TemporaryDirectory(prefix='cbt-clean-frames-') as tmp:
        for entry in entries:
            source, targets = paths(entry)
            original = Image.open(ROOT / source).convert('RGB')
            if 'timestamp' in entry:
                video = frames.find_video(frames.DEFAULT_VIDEO_ROOT, entry['id'][:6])
                frame_path = Path(tmp) / 'frame.png'
                frames.extract_frame(video, entry['timestamp'], frame_path)
                original = Image.open(frame_path).convert('RGB')
                for patch in entry.get('patches', []):
                    frames.extract_frame(video, patch['timestamp'], frame_path)
                    alternate = Image.open(frame_path).convert('RGB')
                    if alternate.size != original.size:
                        raise ValueError('Mismatched camera dimensions')
                    original.paste(checked_crop(alternate, patch['crop']), patch['crop'][:2])
            for index, (crop, relative) in enumerate(zip(entry['crops'], targets)):
                image = checked_crop(original, crop)
                if entry.get('numbered'):
                    # Replace removed answer captions with the original order only.
                    labeled = Image.new('RGB', (image.width, image.height + 38), 'white')
                    labeled.paste(image, (0, 38))
                    ImageDraw.Draw(labeled).text((12, 4), str(index+1), fill='black', font=frames.qa_font(26))
                    image = labeled
                candidate = args.output / Path(relative).name
                image.save(candidate, optimize=True)
                if args.apply_assets:
                    destination = ROOT / relative
                    if destination.exists():
                        existing = Image.open(destination).convert('RGB')
                        if existing.size != image.size or existing.tobytes() != image.tobytes():
                            raise ValueError(f'Refusing to overwrite different asset: {destination}')
                    else:
                        image.save(destination, optimize=True)
                previews.append((entry['id'], candidate))
    for start in range(0, len(previews), 6):
        sheet = Image.new('RGB', (1400, 1500), '#e5e7eb')
        draw = ImageDraw.Draw(sheet)
        for i, (id, path) in enumerate(previews[start:start+6]):
            x, y = (i % 2)*700, (i // 2)*500
            image = Image.open(path)
            image.thumbnail((670, 450))
            draw.text((x+12,y+7), path.stem.replace('hvac-practical-restored-', ''), font=frames.qa_font(21), fill='black')
            sheet.paste(image, (x+15+(670-image.width)//2, y+42))
        sheet.save(args.output / f'clean-review-{start//6+1}.jpg', quality=94)
    print(json.dumps({'questions': len(entries), 'assets': len(previews), 'applied': args.apply_assets}))


if __name__ == '__main__':
    main()
