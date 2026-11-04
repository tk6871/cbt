"""Local-only 12-question comparison; encode existing upscaled images once.

Never resizes, upscales, edits or replaces production image assets. Generated
files and the review UI stay in the ignored private-notes folder.
"""
import argparse
import hashlib
import json
from pathlib import Path
from time import perf_counter
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/private-notes/image-compression-sample'
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
base = read(ROOT / 'work/private-notes/image-quality-sample/sample-data.json')
protected = read(ROOT / 'tools/hansol-direct-boundary-review.json')['preservedFiles']
known = {p['asset']: p for p in read(ROOT / 'data/hansol-book-ink-hidden.json')['assets']}
for name, expected in protected.items():
    assert sha(ROOT / name) == expected, name
assert len(base['entries']) == 12 and len(base['pages']) == 11
variants = [
    {'key': 'improved', 'label': '업스케일 원본 · 무손실 WebP', 'format': 'WEBP', 'lossless': True},
    {'key': 'webp95', 'label': '압축 WebP · 품질 95', 'format': 'WEBP', 'quality': 95, 'method': 6},
    {'key': 'webp90', 'label': '압축 WebP · 품질 90', 'format': 'WEBP', 'quality': 90, 'method': 6},
    {'key': 'jpeg95', 'label': 'JPG · 품질 95', 'format': 'JPEG', 'quality': 95, 'subsampling': 0, 'optimize': True, 'progressive': True},
]
old = read(OUT / 'sample-data.json') if (OUT / 'sample-data.json').exists() else {}
cached = {p['page']: p for p in old.get('pages', [])}
totals = {v['key']: 0 for v in variants}
started, encoded = perf_counter(), 0
for page in base['pages']:
    source = ROOT / page['improved']['asset']
    if not source.exists(): source=ROOT/'work/problem-webp90/originals'/page['improved']['asset']
    source_sha = sha(source)
    reference = known[page['improved']['asset']]
    assert source_sha == reference['outputSha256']
    with Image.open(source) as im:
        image = im.convert('RGB')
    size = list(image.size)
    assert size == page['improved']['pixels']
    assert size == reference['outputSize']
    page['improved']['sha256'] = source_sha
    for variant in variants[1:]:
        key = variant['key']
        suffix = 'jpg' if variant['format'] == 'JPEG' else 'webp'
        output = OUT / key / f'{page["page"]}.{suffix}'
        options = {k: v for k, v in variant.items() if k not in ('key', 'label', 'format')}
        signature = {'sourceSha256': source_sha, 'format': variant['format'], 'options': options, 'pillow': pillow_version}
        previous = cached.get(page['page'], {}).get(key, {})
        valid = output.exists() and previous.get('encoding') == signature and previous.get('sha256') == sha(output)
        if args.check:
            assert valid, f'{page["page"]}/{key}: missing or changed sample'
        elif not valid:
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, format=variant['format'], **options)
            encoded += 1
        with Image.open(output) as decoded:
            decoded.load()
            assert list(decoded.size) == size and decoded.format == variant['format']
        page[key] = {'asset': str(output.relative_to(ROOT)), 'bytes': output.stat().st_size,
                     'pixels': size, 'sha256': sha(output), 'encoding': signature}
    for variant in variants:
        totals[variant['key']] += page[variant['key']]['bytes']
    print(f'{page["page"]}: verified full-resolution variants', flush=True)
    assert sha(source) == source_sha
for name, expected in protected.items():
    assert sha(ROOT / name) == expected, name
data = {**base, 'compression': True, 'variants': variants, 'totals': totals,
        'note': '같은 개선본을 다른 압축 방식으로 저장한 샘플. 해상도 유지·서비스 이미지 교체 없음.'}
template = (ROOT / 'tools/image-quality-sample.template.html').read_text()
html = template.replace('/* SAMPLE_DATA */', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
manifest = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
if args.check:
    assert (OUT / 'index.html').read_text() == html
    assert (OUT / 'sample-data.json').read_text() == manifest
else:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(html)
    (OUT / 'sample-data.json').write_text(manifest)
print(json.dumps({'questions': 12, 'uniquePages': 11, 'encoded': encoded, 'totals': totals,
                  'savingPercent': {k: round((1-v/totals['improved'])*100, 1) for k, v in totals.items()},
                  'seconds': round(perf_counter()-started, 1), 'check': args.check}, ensure_ascii=False))
