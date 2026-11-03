"""Fast book-only fallback from already authorized normal-reader captures.

No model, new OCR, upscaling, resizing, recompression of old assets, or CBT
matching. Preserve whole printed pages; viewport rectangles never remove the
full-page fallback. OCR locates regions only and never supplies displayed copy
or an automatically graded answer.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/hansol-whole-book'
DEST = ROOT / 'assets/hvac-hansol-book/direct-pages'
OUTPUT = ROOT / 'data/hansol-book-direct.json'
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
read = lambda p: json.loads(p.read_text())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
queue = read(WORK / 'batch-review/triage.json')['rows']
# Held answer conflicts remain held. Do not turn them into graded questions.
rows = [r for r in queue if r['risk'] not in ('hold', 'changed')]
page_map = {(p['spread'], p['half']): p for p in read(WORK / 'page-map.json')['pages']}

def runs(mask, minimum=12):
    indexes = np.flatnonzero(mask)
    if not len(indexes):
        return []
    starts = [int(indexes[0])]
    ends = []
    for previous, current in zip(indexes[:-1], indexes[1:]):
        if current - previous > 4:
            ends.append(int(previous) + 1)
            starts.append(int(current))
    ends.append(int(indexes[-1]) + 1)
    return [(a, b) for a, b in zip(starts, ends) if b-a >= minimum]

def marker(text):
    m = re.match(r'^\s*([①②③④])', text)
    if m:
        return '①②③④'.index(m[1])+1
    m = re.match(r'^\s*([l!1-4])(?:\s+|\))', text)
    return (1 if m[1] in 'l!' else int(m[1])) if m else None

pages, locations, warnings = {}, [], []
for spread in sorted({r['spread'] for r in rows}):
    source = WORK / 'screens' / f'spread-{spread:04}.png'
    source_hash = digest(source)
    with Image.open(source) as full:
        width, height = full.size
        pixels = np.asarray(full.convert('RGB'))
        selected = [r for r in rows if r['spread'] == spread]
        for half in sorted({int(r['bounds'][0] >= .5) for r in selected}):
            mapping = page_map[(spread, half)]
            page = mapping['page']
            footer = mapping.get('footerY') or .945
            # Remove application chrome, retain the complete printed page,
            # both columns, the answer table and printed page label.
            crop = [half*width//2 + round(width*.017), round(height*.035),
                    (half+1)*width//2-round(width*.017),
                    min(height, round((footer+.03)*height))]
            x0, y0, x1, y1 = crop
            output = DEST / f'{page}-original.png'
            if args.check:
                assert output.exists(), output
                with Image.open(output) as image:
                    assert image.size == (x1-x0, y1-y0), page
                    assert np.array_equal(np.asarray(image), np.asarray(full.crop(crop))), page
            else:
                DEST.mkdir(parents=True, exist_ok=True)
                # Existing direct pages may be reused, not silently replaced.
                if output.exists():
                    with Image.open(output) as image:
                        assert np.array_equal(np.asarray(image), np.asarray(full.crop(crop))), page
                else:
                    full.crop(crop).save(output)
            page_record = {'page': page, 'spread': spread, 'sourceScreenSha256': source_hash,
                           'sourceCrop': crop, 'asset': str(output.relative_to(ROOT)),
                           'size': [x1-x0, y1-y0], 'sha256': digest(output),
                           'answerKeyRect': [0, max(0, round((footer-.035)*height)-y0),
                                             x1-x0, round(.028*height)]}
            assert page not in pages, page
            pages[page] = page_record
        for row in selected:
            left, top, right, bottom = row['bounds']
            half = int(left >= .5)
            page = row['page']
            record = pages[page]
            px, py, ex, ey = record['sourceCrop']
            a, b = max(px, math.floor(left*width)), max(py, math.floor(top*height)-8)
            c, d = min(ex, math.ceil(right*width)), min(ey, math.ceil(bottom*height))
            assert a < c and b < d, row['key']
            column = int(round(left*4))
            ocr_path = WORK / 'ocr-clean-columns' / f'spread-{spread:04}-clean-column-{column}.json'
            anchors = {}
            if ocr_path.exists():
                for item in read(ocr_path)['rows']:
                    choice = marker(item['text'])
                    if not choice:
                        continue
                    yy = (.07 + item['box'][1]*.83)*height
                    end = (.07 + item['box'][3]*.83)*height
                    if b+12 < yy < d:
                        # Answer/explanation lists on colored paper are not
                        # selectable answer anchors.
                        sy = max(0, min(height-1, int(yy)))
                        sx = max(a, min(c-1, int((left+item['box'][0]*.25)*width)-3))
                        paper = max(min(pixels[yy, xx]) for yy in [sy, min(height-1, sy+5)]
                                    for xx in [max(a, sx-5), min(c-1, sx+2)])
                        if paper >= 246 and choice not in anchors:
                            anchors[choice] = end
            area = pixels[b:d, a:c].astype(np.int16)
            rr, gg, bb = area[:, :, 0], area[:, :, 1], area[:, :, 2]
            light_blue = (rr >= 190) & (rr <= 247) & (gg-rr >= 2) & (bb-rr >= 4) & (bb >= 232)
            light_gray = (rr >= 205) & (rr <= 244) & (np.abs(rr-gg) <= 3) & (np.abs(rr-bb) <= 3)
            # Wide pale panels are the book's explanation boxes, unlike the
            # saturated chapter header or isolated colored circuit strokes.
            panels = runs(((light_blue | light_gray).sum(axis=1) > (c-a)*.55))
            split = None
            if len(anchors) == 4:
                after_choices = max(anchors.values())-b
                matches = [(u, v) for u, v in panels if u > after_choices+2]
                if matches:
                    split = (matches[0][0], matches[-1][1])
            question = [a-px, b-py, c-a, (split[0]-3) if split else d-b]
            solution = [a-px, b-py+split[0]-2, c-a, split[1]-split[0]+4] if split else None
            if split is None:
                warnings.append(row['key'])
            locations.append({'id': f'hansol-direct-{page}-{row["number"]}',
                              'page': page, 'number': row['number'], 'column': row['column'],
                              'questionRect': question, 'solutionRect': solution,
                              'split': bool(split), 'grading': 'self-check-only',
                              'basis': 'existing-normal-reader-original',
                              'review': 'source-first-not-CBT-compared'})
    if not args.check:
        print(f'{spread}: {len(locations)}/{len(rows)} original locations', flush=True)

data = {'date': '2026-11-03', 'basis': '수업용 교재 원문 우선 수록. CBT 개별 대조·정답 검증 완료가 아닙니다.',
        'pages': sorted(pages.values(), key=lambda p: tuple(map(int, p['page'].split('-')))),
        'locations': sorted(locations, key=lambda r: (*map(int, r['page'].split('-')), r['number'])),
        'unseparatedLocations': warnings,
        'limits': '정답 OCR로 자동채점하지 않습니다. 풀이 경계 미분리 원문은 풀이가 함께 포함될 수 있음을 표시하며 원문 쪽 전체를 확인할 수 있습니다. 기존 CBT·검토 보류·업스케일 자산은 변경하지 않습니다.'}
assert len({r['id'] for r in locations}) == len(locations)
if args.check:
    assert read(OUTPUT) == data, 'direct-page index needs regeneration'
else:
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'pages': len(pages), 'locations': len(locations), 'separated': len(locations)-len(warnings),
                  'unseparated': len(warnings), 'bytes': sum((ROOT/p['asset']).stat().st_size for p in pages.values()),
                  'upscaling': False, 'checkedOnly': args.check}))
