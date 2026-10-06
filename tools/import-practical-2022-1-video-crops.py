#!/usr/bin/env python3
"""Crop manually reviewed public video frames, without rescaling/fabrication."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

# Each native frame was opened individually. Rectangles do not contain answer
# captions/lecture writing. Q6/Q12 are native 720p fallbacks; others are 1080p.
CROPS = [
    (3, 1, 'cbt-2022-1-public-review/2022-1-q03-980-8s.png', 988, [1920,1080], [172,215,713,976], '두 공냉 왕복동 장치 사진 전체, 판서와 자막 제외'),
    (4, 1, 'cbt-2022-1-public-review/2022-1-q04-1313-8s.png', 1321, [1920,1080], [108,412,1012,645], '90도엘보·부싱·캡·45도엘보 순서 보존'),
    (5, 1, 'cbt-2022-1-public-review/2022-1-q05-1332-8s.png', 1340, [1920,1080], [523,145,798,555], '브라켓 밸브 사진과 세 연결부 전체'),
    (6, 1, 'cbt-2022-1-detail-review/2022-1-q06-1534-3s.png', 1537, [1280,720], [132,141,475,409], '실제 액분리기를 지정하는 화살표 포함. 정답 표시된 하단 전체 장치 해설 사진 제외'),
    (7, 1, 'cbt-2022-1-public-review/2022-1-q07-1682-8s.png', 1690, [1920,1080], [180,139,697,1013], '증기트랩 외관과 원문의 단면도 전체, 강사와 답안 판서 제외'),
    (8, 1, 'cbt-2022-1-public-review/2022-1-q08-2096-8s.png', 2104, [1920,1080], [66,239,500,1010], '가·나·다 번호와 세 밸브 사진 전체. 뒤에 나타나는 명칭 자막은 제외'),
    (9, 1, 'cbt-2022-1-pipe-review/2022-1-q09-2307-8s.png', 2315, [1920,1080], [138,252,1658,1040], '가 배관 전체, 5엘보와2티 위치를 다른 회전 장면과 대조'),
    (9, 2, 'cbt-2022-1-pipe-complete-review/2022-1-q09-2321-8s.png', 2329, [1920,1080], [138,239,1533,1020], '나 배관 전체, 끝단·4엘보·3티를 다른 회전 장면과 대조. 원문 좌표축 일부 유지'),
    (10, 1, 'cbt-2022-1-public-review/2022-1-q10-2375-8s.png', 2383, [1920,1080], [566,173,1440,1020], '실제 교류전압계 외관과 V/교류 표시 유지'),
    (11, 1, 'cbt-2022-1-public-review/2022-1-q11-2496-8s.png', 2504, [1920,1080], [654,337,852,598], '원문 세 조광형 버튼 중 손으로 가리지 않은 적색 버튼을 대표 그림으로 분리. 옆 녹색 버튼 일부 유지'),
    (12, 1, 'cbt-2022-1-gauge-review/2022-1-q12-2644-3s.png', 2647, [1280,720], [129,140,603,508], '실제 게이지와 청·적·황 호스 사진. 오른쪽 답안 판서는 제외'),
]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--frame-root',type=Path,required=True)
    args=parser.parse_args();records=[]
    for number,index,relative,time,size,rect,note in CROPS:
        frame=args.frame_root/relative
        with Image.open(frame) as image:
            if list(image.size)!=size:raise ValueError(f'Unexpected dimensions: {frame}')
            if not (0<=rect[0]<rect[2]<=size[0] and 0<=rect[1]<rect[3]<=size[1]):raise ValueError('Invalid rectangle')
            cropped=image.convert('RGB').crop(tuple(rect))
        output=Path(f'assets/hvac-practical/restored/2022-1/hvac-practical-restored-2022-1-{number:02d}-question-video-{index}-v550.png')
        output.parent.mkdir(parents=True,exist_ok=True);cropped.save(output,optimize=True)
        records.append(dict(id=f'hvac-practical-restored-2022-1-{number:02d}',role='question',index=index,
            frame=relative,frameSha256=hashlib.sha256(frame.read_bytes()).hexdigest(),nativeSize=size,
            timestamp=f'{time//3600:02d}:{time//60%60:02d}:{time%60:02d}',crop=rect,output=output.as_posix(),
            outputSize=list(cropped.size),sha256=hashlib.sha256(output.read_bytes()).hexdigest(),reviewNote=note))
    manifest=dict(source=dict(year=2022,session='1',title='에듀강닷컴 2022년 제1회 공조냉동기계산업기사 실기 동영상 복원문제',
        url='https://www.youtube.com/watch?v=csnNvJWbknc',page='https://edukang.tistory.com/973'),
        method='문항별 짧은 공개 영상·개별 원본 프레임·한국어 자동자막 대조 후 원본 픽셀 크롭. 자동자막은 보조 근거이며 문제 사진/판서와 함께 확인. 전체 정답 검증 아님.',
        crops=records,evidence=dict(question12='00:44:07~00:44:30 장치 명칭 및 냉매 충전시 청색/적색/황색 호스 연결 위치 질문 확인'),unresolved=[])
    Path('data/hvac-practical-2022-1-video-crops.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(questions=len(set(c['id'] for c in records)),crops=len(records))))

if __name__=='__main__':main()
