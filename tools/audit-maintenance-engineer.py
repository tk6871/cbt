"""Verify the new bank against saved public exam DOM and preserved images."""
from pathlib import Path
import hashlib
import json
import runpy
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = runpy.run_path(str(ROOT / 'tools/import-comcbt-craftsman-web.py'))
cache = ROOT / 'work/maintenance-engineer-import'
target = source['Target'](
    'maintenance-engineer', '설비보전기사', '설비보전기사',
    (cache / 'current-index.html', cache / 'old-index.html'), 'CBT_DATA_MAINTENANCE_ENGINEER',
    ((1,20,'설비진단 및 계측'),(21,40,'설비관리'),(41,60,'기계일반 및 기계보전'),(61,80,'공유압 및 자동화')),
    question_count=80,
    legacy_subject_ranges=((1,20,'설비진단 및 계측'),(21,40,'설비관리'),(41,60,'기계일반 및 기계보전'),(61,80,'윤활관리'),(81,100,'공유압 및 자동화')),
    legacy_before_year=2022, legacy_question_count=100, preserve_original_assets=True,
)
data_text = (ROOT / 'data/maintenance-engineer.js').read_text()
bank = json.loads(data_text.split('=',1)[1].strip().removesuffix(';'))
assert bank['key'] == target.key and len(bank['rounds']) == 27
exams = source['list_exams'](target)
rounds = []
assets = {}
for exam in exams:
    round_data, images = source['parse_exam_file'](target, exam, cache / target.key / f'{exam.exam_id}.html')
    rounds.append(round_data)
    assets.update(images)
expected = {'rounds':rounds}
reused = source['reuse_exact_duplicate_explanations'](expected)
assert len(assets) == 265
image_rows = []
for remote, original in assets.items():
    output = ROOT / str(original.relative_to(ROOT)).replace('/original/', '/').rsplit('.',1)[0]
    output = output.with_suffix('.png')
    # Filenames have one extension; original hash remains reproducible.
    with Image.open(original) as im, Image.open(output) as enhanced:
        im.load(); enhanced.load()
        assert enhanced.size == (im.width * 2, im.height * 2), str(output)
        size = list(enhanced.size)
    image_rows.append({'source':str(original.relative_to(ROOT)), 'output':str(output.relative_to(ROOT)),
                       'sourceSha256':hashlib.sha256(original.read_bytes()).hexdigest(),
                       'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(), 'size':size})
by_id = {r['id']:r for r in bank['rounds']}
assert len(by_id) == 27
checked = 0
for original_round in rounds:
    actual = by_id[original_round['id']]
    assert actual['subjects'] == original_round['subjects']
    assert len(actual['questions']) == len(original_round['questions'])
    for actual_q, original_q in zip(actual['questions'], original_round['questions']):
        expected_q = json.loads(json.dumps(original_q))
        def map_path(p):
            return p.replace('/original/', '/').rsplit('.',1)[0] + '.png'
        expected_q['images'] = [map_path(p) for p in expected_q['images']]
        for choice in expected_q['choices']:
            choice['images'] = [map_path(p) for p in choice['images']]
        assert actual_q == expected_q, f"{actual['id']} #{actual_q['number']}"
        assert len(actual_q['choices']) == 4 and 1 <= actual_q['answer'] <= 4
        assert all(c['text'] or c['images'] for c in actual_q['choices'])
        checked += 1
assert checked == 2660
report = {'date':'2026-10-21','qualification':target.name,'rounds':27,'questions':checked,
          'yearRange':[2006,2022],'images':len(assets),'reusedExactTextExplanations':reused,
          'detailedExplanations':sum('등록된 상세 해설은 없습니다.' not in q['explanation'] for r in rounds for q in r['questions']),
          'model':'realesrgan-x4plus-anime','tile':256,'pipeline':'4x-model-to-2x-bicubic',
          'sourceIndexes':['https://www.comcbt.com/xe/webhaesul/10153024','https://www.comcbt.com/xe/webhaesul/10153026'],
          'limits':'구 기출 정답·해설 구조 대조이며 전체 정답의 사실 검증이나 2025년 개편 범위 수록을 뜻하지 않습니다.',
          'assets':image_rows}
if '--write-report' in sys.argv:
    (ROOT / 'data/maintenance-engineer-import-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='assets'},ensure_ascii=False,indent=2))
