"""Private OCR review sheets from existing captures, never a text publisher."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/textbook-explanation-text'
IDS = '''1-34-37 1-103-15 1-106-36 1-135-3 1-226-4
3-25-3 3-61-11 3-65-45 3-118-6 3-134-31 3-135-34 3-146-25
3-175-3 3-266-3 3-266-39 3-266-40 3-267-46 3-328-56 3-332-76 3-351-47
4-100-25 4-130-46 4-138-25 4-164-23 4-185-8 4-190-32 4-190-33
5-9-27 5-90-26 5-99-7 4-182-51 4-129-41'''.split()
read = lambda p: json.loads((ROOT / p).read_text())
book = read('data/hansol-book-direct.json')
fixes = {r['id']: r for r in read('data/hansol-book-direct-boundaries.json')['entries']}
pages = {r['page']: r for r in book['pages']}
OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype(str(ROOT / 'assets/fonts/NanumGothic-Regular.ttf'), 21)
tiles, candidates = [], []
for short in IDS:
    row = next(r for r in book['locations'] if r['id'] == 'hansol-direct-' + short)
    parts = fixes.get(row['id'], {}).get('solutionParts') or [{'page': row['page'], 'rect': row['solutionRect']}]
    crops, lines = [], []
    for part in parts:
        p = pages.get(part['page'])
        if part.get('asset'):
            im = Image.open(ROOT / part['asset']).convert('RGB')
        else:
            clean = ROOT / f'work/hansol-ink-hidden/screens/spread-{p["spread"]:04}.png'
            im = Image.open(clean).crop(p['sourceCrop']).convert('RGB') if clean.exists() else Image.open(ROOT / p['asset']).convert('RGB')
        x, y, w, h = part['rect']
        crops.append(im.crop((x, y, x+w, y+h)))
        if p and not part.get('asset'):
            col = (0 if p['sourceCrop'][0] < 1440 else 2) + (0 if x < 671 else 1)
            cache = ROOT / f'work/hansol-whole-book/ocr-clean-columns/spread-{p["spread"]:04}-clean-column-{col}.json'
            if cache.exists():
                for r in json.loads(cache.read_text())['rows']:
                    cy = (.07 + (r['box'][1]+r['box'][3])/2*.83)*1982-p['sourceCrop'][1]
                    if y <= cy <= y+h:
                        lines.append(r['text'])
    tile = Image.new('RGB', (711, sum(c.height for c in crops)+60), 'white')
    ImageDraw.Draw(tile).text((12, 8), short, font=font, fill='#064e3b')
    top = 48
    for c in crops:
        tile.paste(c, (15, top)); top += c.height
    tiles.append(tile)
    candidates.append({'id': row['id'], 'parts': parts, 'ocrCandidates': lines})
for start in range(0, len(tiles), 6):
    rows = []
    for j in range(start, min(start+6, len(tiles)), 2):
        pair = tiles[j:j+2]
        strip = Image.new('RGB', (1422, max(t.height for t in pair)+12), '#b7c5c5')
        for k, t in enumerate(pair): strip.paste(t, (k*711, 0))
        rows.append(strip)
    sheet = Image.new('RGB', (1422, sum(r.height for r in rows)), '#b7c5c5')
    top = 0
    for r in rows: sheet.paste(r, (0, top)); top += r.height
    path = OUT / f'review-{start:02}.png'
    sheet.save(path)
    print(path)
(OUT / 'candidates.json').write_text(json.dumps(candidates, ensure_ascii=False, indent=2)+'\n')
