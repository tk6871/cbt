"""Create read-only contact sheets of CURRENT images (not the old crop backups)."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round')
    parser.add_argument('--min-year', type=int, default=2024)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    rows = json.loads((ROOT / 'data/hvac-practical-restored.json').read_text())
    repairs = {r['image'] for r in json.loads((ROOT / 'data/hvac-practical-video-frame-repairs.json').read_text())}
    groups = {}
    for row in rows:
        key = f"{row['year']}-{row['session']}"
        if row['year'] < args.min_year or (args.round and key != args.round):
            continue
        for kind, paths in [('question', row.get('images', [])), ('answer', row.get('answerImages', []))]:
            for path in paths:
                if path.endswith('.svg'):
                    continue
                groups.setdefault(key, []).append((row['id'], kind, path))
    args.output.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 19)
    result = []
    for key, entries in sorted(groups.items(), reverse=True):
        for start in range(0, len(entries), 6):
            subset = entries[start:start+6]
            sheet = Image.new('RGB', (1600, 3 * 510), '#dae1e9')
            draw = ImageDraw.Draw(sheet)
            for index, (id, kind, path) in enumerate(subset):
                x, y = (index % 2) * 800, (index // 2) * 510
                image = Image.open(ROOT / path).convert('RGB')
                original_size = image.size
                image.thumbnail((780, 450))
                sheet.paste(image, (x+10+(780-image.width)//2, y+50+(450-image.height)//2))
                label = f"{id.replace('hvac-practical-restored-', '')} {kind} {original_size}"
                draw.text((x+12, y+8), label, font=font, fill='black')
                if path in repairs:
                    draw.text((x+12, y+29), 'previously repaired', font=font, fill='#3058a0')
            target = args.output / f'{key}-current-{start//6+1}.jpg'
            sheet.save(target, quality=94)
            result.append(str(target))
    print(json.dumps({'images': sum(map(len, groups.values())), 'sheets': result}, indent=2))


if __name__ == '__main__':
    main()
