"""Extract the user-supplied 42-question PDF; print a data patch, preserve its source.

Text is source transcription, NOT automatic factual approval. Images are extracted
directly from PDF objects (not screenshots containing the printed answer).
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
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
rows = []
with pdfplumber.open(args.pdf) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        text = page.extract_text() or ''
        for match in re.finditer(r'(?:^|\n)문제 (\d+)\n(.*?)(?=\n문제 \d+\n|\Z)', text, re.S):
            number, body = int(match[1]), match[2]
            question, separator, answer = body.partition('정답 및 해설')
            rows.append({'id': f'hvac-practical-supplement-20260916-{number:02}',
                         'number': number, 'sourcePage': page_number,
                         'question': re.sub(r'\s+', ' ', question).strip(),
                         'sourceAnswer': answer.strip() if separator else '',
                         'sourceFile': args.pdf.name,
                         'sourceSha256': hashlib.sha256(args.pdf.read_bytes()).hexdigest()})
assert [r['number'] for r in rows] == list(range(1, 43)), 'Expected exactly 42 ordered questions'
reader = PdfReader(args.pdf)
for page_index, number in [(4, 14), (8, 24)]:
    images = list(reader.pages[page_index].images)
    assert len(images) == 1
    asset = f'assets/hvac-practical/supplement-20260916/{number:02}.png'
    rows[number - 1]['image'] = asset
    if args.extract_images:
        target = root / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise RuntimeError(f'Refusing to overwrite {target}')
        images[0].image.convert('RGB').save(target, optimize=True)
print('*** Begin Patch\n*** Add File: data/hvac-practical-supplement-20260916.json')
print('\n'.join('+'+line for line in json.dumps(rows, ensure_ascii=False, indent=2).splitlines()))
print('*** End Patch')
