#!/usr/bin/env python3
"""Crop individually verified frames. Never downloads a video or fabricates parts."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

# Native 1920x1080 pixels; no lecturer, answer text, or subtitles included.
CROPS = [
    (3,'00:14:59',[80,236,1040,792]),
    (4,'00:21:23',[590,230,1060,1070]),
    (5,'00:25:04',[285,70,1450,775]),
    (6,'00:29:19',[100,264,985,775]),
    (7,'00:37:17',[193,244,909,636]),
    (8,'00:37:40',[105,410,1012,647]),
    (9,'00:39:30',[122,306,990,841]),
    (10,'00:42:47',[135,217,729,584]),
    (11,'00:43:40',[313,0,1607,1080]),
    (12,'00:51:30',[243,248,810,966]),
]
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--frame-dir',type=Path,required=True)
    p.add_argument('--output-root',type=Path,default=Path('assets/hvac-practical/restored/2021-3'))
    args=p.parse_args()
    records=[]
    for n,time,rect in CROPS:
        frame=args.frame_dir/f'cbt-2021-3-q{n}-frame.png'
        image=Image.open(frame).convert('RGB')
        if image.size!=(1920,1080): raise ValueError('Unexpected video dimensions')
        crop=image.crop(tuple(rect))
        output=args.output_root/f'hvac-practical-restored-2021-3-{n:02d}-question-video-v550.png'
        output.parent.mkdir(parents=True,exist_ok=True);crop.save(output,optimize=True)
        records.append(dict(id=f'hvac-practical-restored-2021-3-{n:02d}',role='question',timestamp=time,crop=rect,
            output=output.as_posix(),outputSize=list(crop.size),sha256=hashlib.sha256(output.read_bytes()).hexdigest()))
    manifest=dict(source=dict(title='에듀강닷컴 2021년 제3회 공조냉동기계산업기사 실기 동영상 복원문제',url='https://www.youtube.com/watch?v=nQtCK_Dud0s'),
        method='공개 영상의 해당 문항 구간을 직접 확인한 뒤 그림만 분리. 정답이 아닌 사진을 근거 없이 연결하지 않음.',crops=records,
        followupEvidence=[dict(number=7,method='00:37:17 장치 사진과 추기회수장치 자막을 함께 확인. 정답 자막은 크롭 밖으로 제외.'),
            dict(number=9,method='00:39:30 체크밸브 판서와 실제 부품 사진을 함께 확인. 필터드라이어로 추정하지 않음.'),
            dict(number=12,method='00:51:30 장치 사진과 한국어 자동자막 00:51:20~00:51:44의 터보/원심식 냉동기 설명을 대조. 장치 사진 외 자막·판서 제외.')],
        unresolved=[])
    Path('data/hvac-practical-2021-3-video-crops.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(crops=len(records),unresolved=len(manifest['unresolved']))))
if __name__=='__main__':main()
