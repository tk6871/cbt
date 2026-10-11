"""Read-only contact sheets of existing review images; writes only ignored review output."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
report = json.loads((ROOT / 'docs/energy-duplicate-review-2026-10-11.json').read_text())
indices = sorted({i for pair in report['pairs'] for i in (pair['a'], pair['b'])})
assets = []
for i in indices:
    row = report['rows'][i]
    paths = [row['sourceImage'], *row['images'], *[p for c in row['choices'] for p in c['images']]]
    for path in filter(None, paths):
        if path not in assets:
            assets.append(path)
out = ROOT / 'work/energy-answer-geometry/semantic-review'
out.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 25)
for start in range(0, len(assets), 4):
    sheet = Image.new('RGB', (2000, 1600), '#ddd')
    draw = ImageDraw.Draw(sheet)
    for k, path in enumerate(assets[start:start+4]):
        image = Image.open(ROOT / path).convert('RGB')
        image.thumbnail((970, 740))
        x, y = (k % 2) * 1000 + 15, (k // 2) * 800 + 50
        sheet.paste(image, (x, y))
        draw.text((x, y-38), f'{start+k}: {Path(path).name}', fill='black', font=font)
    sheet.save(out / f'sheet-{start//4+1:02d}.jpg', quality=96)
print(json.dumps(assets, ensure_ascii=False, indent=2))
