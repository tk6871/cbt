#!/usr/bin/env python3
"""Reproduce reviewed coordinates; no automatic crop inference or data edits."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
TMP=Path('/private/tmp/cbt-practical-remaining-review')
plan=json.loads((ROOT/'data/hvac-practical-remaining-crop-plan.json').read_text())
catalog=json.loads((ROOT/'data/hvac-practical-public-video-sources.json').read_text())['sources']
status_files=list(TMP.glob('*/status.json'))+list(Path('/private/tmp').glob('cbt-practical-remaining-details-*/status.json'))
frames={}
for status in status_files:
    records=json.loads(status.read_text())['results']
    for record in records:
        for frame in record.get('frames',[]):
            stem=Path(frame['path']).name.split('-q')[0]
            suffix=f"{stem}-{record['number']:02d}"
            frames[(suffix,frame['timestamp'])]=frame
records=[]; previews=[]; counts={}
for entry in plan['crops']:
    suffix,timestamp,rect,note=entry[:4]
    role=entry[4] if len(entry)>4 else 'question'
    frame=frames[(suffix,timestamp)]; source=Path(frame['path'])
    with Image.open(source) as original:
        size=list(original.size)
        if size != frame['size'] or not (0<=rect[0]<rect[2]<=size[0] and 0<=rect[1]<rect[3]<=size[1]):
            raise ValueError(f'Invalid native crop: {suffix} {rect} {size}')
        im=original.convert('RGB').crop(rect)
    id='hvac-practical-restored-'+suffix
    year,session,number=suffix.split('-'); counts[id]=counts.get(id,0)+1
    output=Path(f'assets/hvac-practical/restored/{year}-{session.lower()}/{id}-{role}-video-{counts[id]}-v560.png')
    (ROOT/output).parent.mkdir(parents=True,exist_ok=True); im.save(ROOT/output,optimize=True)
    video=next(s for s in catalog if s['year']==int(year) and s['session']==session)
    records.append(dict(id=id,role=role,timestamp=timestamp,sourceUrl=video['url'],
        frame=source.name,frameSha256=hashlib.sha256(source.read_bytes()).hexdigest(),nativeSize=size,crop=rect,
        output=str(output),outputSize=list(im.size),sha256=hashlib.sha256((ROOT/output).read_bytes()).hexdigest(),reviewNote=note))
    preview=Image.new('RGB',(600,520),'white');draw=ImageDraw.Draw(preview)
    draw.text((8,8),f'{suffix} / {im.width}x{im.height} / {timestamp}s',fill='black')
    thumb=im.copy();thumb.thumbnail((580,476));preview.paste(thumb,((600-thumb.width)//2,36));previews.append(preview)
for start in range(0,len(previews),6):
    sheet=Image.new('RGB',(1800,1040),'#ddd')
    for i,preview in enumerate(previews[start:start+6]):sheet.paste(preview,((i%3)*600,(i//3)*520))
    sheet.save(TMP/f'final-crops-{start//6+1:02}.jpg',quality=95)
(ROOT/'data/hvac-practical-remaining-video-crops.json').write_text(json.dumps(dict(
    method='공개 영상 후보와 문제를 직접 대조해 원본 픽셀을 크롭. 전체 영상·정답 검증 완료를 의미하지 않음.',
    crops=records),ensure_ascii=False,indent=2)+'\n')
print(f'{len(records)} crops generated; no question data applied')
