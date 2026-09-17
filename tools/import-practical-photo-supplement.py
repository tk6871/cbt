"""Import the 2026-09-17 user PDF without losing cross-page questions.

Print a JSON apply_patch; optionally extract the original embedded image bytes.
Source answers are transcription, not automatically approved study answers.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import pdfplumber
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('pdf', type=Path)
parser.add_argument('--extract-images', action='store_true')
parser.add_argument('--review-pages', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
reader = PdfReader(args.pdf)
rows = []
current = None
answer = False
with pdfplumber.open(args.pdf) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        events = [(line['top'], 'text', line['text']) for line in page.extract_text_lines()]
        events += [(image['top'], 'image', image) for image in page.images]
        images = {image.name.rsplit('.', 1)[0]: image for image in reader.pages[page_number - 1].images}
        for _, kind, value in sorted(events, key=lambda event: event[0]):
            if kind == 'text':
                match = re.fullmatch(r'문제 (\d+)', value)
                if match:
                    number = int(match[1])
                    current = dict(id=f'hvac-practical-photo-20260917-{number:03}', number=number,
                                   sourcePage=page_number, sourceEndPage=page_number,
                                   question='', sourceAnswer='', images=[], imageSources=[],
                                   sourceFile=args.pdf.name, sourceSha256=digest)
                    rows.append(current)
                    answer = False
                elif current:
                    current['sourceEndPage'] = page_number
                    if value == '정답 및 해설':
                        answer = True
                    else:
                        field = 'sourceAnswer' if answer else 'question'
                        current[field] += ('\n' if current[field] else '') + value
            elif current:
                if answer:
                    raise ValueError(f'Unexpected image inside answer: {current["number"]}, page {page_number}')
                source = images[value['name']]
                suffix = Path(source.name).suffix
                asset = f'assets/hvac-practical/photo-20260917/{current["number"]:03}-{len(current["images"])+1}{suffix}'
                current['images'].append(asset)
                current['imageSources'].append(dict(page=page_number, object=value['name'],
                    sha256=hashlib.sha256(source.data).hexdigest(), size=list(source.image.size)))
                current['sourceEndPage'] = page_number
                if args.extract_images:
                    target = root / asset
                    target.parent.mkdir(parents=True, exist_ok=True)
                    if target.exists() and target.read_bytes() != source.data:
                        raise ValueError(f'Refusing to overwrite {target}')
                    if not target.exists():
                        target.write_bytes(source.data)
for row in rows:
    row['question'] = re.sub(r'\s+', ' ', row['question']).strip()
assert [row['number'] for row in rows] == list(range(1, 124))
assert all(row['question'] and row['sourceAnswer'] for row in rows)
assert sum(len(row['images']) for row in rows) == 95
print('*** Begin Patch\n*** Add File: data/hvac-practical-photo-20260917.json')
print('\n'.join('+' + line for line in json.dumps(rows, ensure_ascii=False, indent=2).splitlines()))
print('*** End Patch')

if args.review_pages:
    from PIL import Image, ImageDraw
    pages = sorted(args.review_pages.glob('page-*.png'))
    for start in range(0, len(pages), 4):
        canvas = Image.new('RGB', (1560, 2250), '#dce3ea')
        draw = ImageDraw.Draw(canvas)
        for offset, path in enumerate(pages[start:start+4]):
            image = Image.open(path).convert('RGB')
            image.thumbnail((770, 1090))
            x, y = offset % 2 * 780, offset // 2 * 1125
            canvas.paste(image, (x, y + 25))
            draw.text((x + 5, y + 5), path.stem, fill='black')
        canvas.save(args.review_pages / f'sheet-{start//4+1:02}.jpg', quality=92)
