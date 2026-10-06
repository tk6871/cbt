#!/usr/bin/env python3
"""Reproduce individually reviewed source-video crops; never synthesize diagrams."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

# year, round, question, frame relative to /private/tmp, native rectangle, note.
# Coordinates were selected after comparing the question and source frames.
CROPS = [
 (2022,'2',3,'public-review/2022-2-q03-617-8s.png',[130,238,758,942],'댐퍼 외관·단면도, 자막과 판서 제외'),
 (2022,'2',4,'public-review/2022-2-q04-896-8s.png',[126,446,955,663],'부싱·45도엘보·레듀샤·캡 순서, 정답 자막 전 프레임'),
 (2022,'2',5,'filter-review/2022-2-q05-939-3s.png',[158,159,836,540],'원문 빨간 화살표와 파란 장치 전체. 아래 대표 사진과 답안 판서 제외'),
 (2022,'2',6,'tools-review/2022-2-q06-1227-13s.png',[84,157,620,579],'가·나·다·라 네 공구와 선택 표기. 원본 720p'),
 (2022,'2',7,'public-review/2022-2-q07-1266-13s.png',[318,147,1602,925],'정답 자막 없는 취출구 정면 전체'),
 (2022,'2',8,'unit-review/2022-2-q08-1468-8s.png',[62,133,499,410],'냉동장치 전체. 내부 구성 정답 자막 전 프레임. 원본 720p'),
 (2022,'2',10,'public-review/2022-2-q10-1829-3s.png',[105,252,908,764],'두 장치 사진과 연결부, 질문 자막 제외'),
 (2022,'2',11,'public-review/2022-2-q11-1988-13s.png',[129,138,476,417],'액분리기 지시 화살표 포함, 전체 실습장치와 구분. 원본 720p'),
 (2022,'2',12,'gauge-review/2022-2-q12-2209-3s.png',[526,94,1326,807],'청·적 게이지와 밸브·호스 식별 가능, 얼굴과 답안 제외'),
 (2022,'3',3,'public-review/2022-3-q03-772-8s.png',[534,282,1386,798],'스크류 압축기 외관 전체. 뒤의 겹쳐진 단면 그림 대신 온전한 외관'),
 (2022,'3',4,'public-review/2022-3-q04-1049-8s.png',[165,258,590,933],'두 4방밸브 외관 전체, 명칭 자막과 회로 해설 제외'),
 (2022,'3',5,'measure-review/2022-3-q05-1463-8s.png',[371,56,1389,948],'측정기·두 리드선·측정점 함께 보존. 손은 실제 작업 장면의 일부'),
 (2022,'3',6,'public-review/2022-3-q06-1776-3s.png',[126,446,941,662],'부싱·캡·45도엘보·레듀샤 순서. 정답 자막 전 프레임'),
 (2022,'3',7,'filter-review/2022-3-q07-1814-3s.png',[158,159,836,540],'원문 지시 화살표·파란 부품, 아래 정답 자막 제외'),
 (2022,'3',8,'public-review/2022-3-q08-2024-8s.png',[126,207,784,763],'세 취출구 외관, 질문과 정답 자막 제외'),
 (2022,'3',9,'separator-review/2022-3-q09-2089-3s.png',[159,146,750,624],'검정 세로 장치와 빨간 지시 화살표 전체'),
 (2022,'3',10,'public-review/2022-3-q10-2293-3s.png',[157,220,418,689],'부품 전체와 단자, 정답 자막 전 프레임'),
 (2022,'3',12,'public-review/2022-3-q12-2492-13s.png',[1202,154,1769,1061],'우측 전동밸브 구동부와 몸체·연결부. 좌측 수동밸브와 구분'),
 (2023,'1',3,'detail-review/2023-1-q03-720-3s.png',[330,621,691,861],'같은 문항 강의에서 제시한 수평형 부품 대표 사진. 상단 명칭 주석 제외'),
 (2023,'1',4,'public-review/2023-1-q04-1054-8s.png',[219,258,705,747],'계기 외관과 관통부 전체, 질문·답안 제외'),
 (2023,'1',5,'disc-review/2023-1-q05-1216-3s.png',[84,214,759,996],'가·나·다 표기와 세 트랩 외관·단면도 전체, 정답 이름 없음'),
 (2023,'1',6,'public-review/2023-1-q06-1273-8s.png',[405,369,864,704],'배관 상부 백색 캡 장치와 연결부. 원본 하단 출처 자막 제외'),
 (2023,'1',7,'public-review/2023-1-q07-1414-13s.png',[166,0,1445,1015],'헤더 도식 전체, 우측 하단 밸브와 연결 경로 확인. 별도 위치 설명 제공'),
 (2023,'1',8,'public-review/2023-1-q08-1575-13s.png',[803,305,1110,665],'펌프 토출 배관의 주름관과 양 플랜지, 명칭 주석 없는 원본'),
 (2023,'1',9,'public-review/2023-1-q09-1760-8s.png',[286,200,696,735],'온도식 팽창밸브와 감온통 전체. 하단 밸브 명칭과 우측 감온통 주석 제외'),
 (2023,'1',10,'public-review/2023-1-q10-2002-13s.png',[380,147,902,570],'밀폐형 압축기 전체와 연결관. 정답 자막 없음. 원본 720p'),
 (2023,'1',11,'public-review/2023-1-q11-2148-13s.png',[386,181,1272,924],'원래 입체 배관·끝단 전체. 완성 평면도는 기존 답안 이미지 유지'),
 (2023,'1',12,'public-review/2023-1-q12-2273-3s.png',[85,237,910,713],'두 배선용 차단기 외관 전체, 답안 판서 전 프레임'),
]

def main():
 p=argparse.ArgumentParser();p.add_argument('--frame-root',type=Path,required=True);args=p.parse_args()
 catalog=json.loads(Path('data/hvac-practical-public-video-sources.json').read_text())['sources']
 records=[];previews=[]
 for year,session,n,relative,rect,note in CROPS:
  frame=args.frame_root/f'cbt-{year}-{session}-{relative}'
  with Image.open(frame) as image:
   size=list(image.size)
   expected=[1280,720] if (year,session,n) in [(2022,'2',6),(2022,'2',8),(2022,'2',11),(2023,'1',10)] else [1920,1080]
   if size!=expected:raise ValueError(f'Native dimensions changed: {frame} {size}')
   if not(0<=rect[0]<rect[2]<=size[0] and 0<=rect[1]<rect[3]<=size[1]):raise ValueError('Invalid crop')
   cropped=image.convert('RGB').crop(rect)
  id=f'hvac-practical-restored-{year}-{session}-{n:02d}'
  output=Path(f'assets/hvac-practical/restored/{year}-{session}/{id}-question-video-1-v550.png')
  output.parent.mkdir(parents=True,exist_ok=True);cropped.save(output,optimize=True)
  time=int(frame.stem.split('-')[-2])+int(frame.stem.split('-')[-1][:-1])
  source=next(s for s in catalog if s['year']==year and s['session']==session)
  records.append(dict(id=id,role='question',index=1,year=year,session=session,sourceUrl=source['url'],
   frame=str(frame.relative_to(args.frame_root)),frameSha256=hashlib.sha256(frame.read_bytes()).hexdigest(),
   nativeSize=size,timestamp=f'{time//3600:02d}:{time//60%60:02d}:{time%60:02d}',crop=rect,
   output=output.as_posix(),outputSize=list(cropped.size),sha256=hashlib.sha256(output.read_bytes()).hexdigest(),reviewNote=note))
  preview=Image.new('RGB',(600,520),'white');draw=ImageDraw.Draw(preview);draw.text((8,8),f'{year}-{session} Q{n} / {cropped.width}x{cropped.height}',fill='black')
  thumb=cropped.copy();thumb.thumbnail((580,480));preview.paste(thumb,((600-thumb.width)//2,35));previews.append(preview)
 for start in range(0,len(previews),4):
  sheet=Image.new('RGB',(1200,1040),'#ddd')
  for j,preview in enumerate(previews[start:start+4]):sheet.paste(preview,((j%2)*600,(j//2)*520))
  sheet.save(args.frame_root/f'cbt-2022-2023-final-{start//4+1}.jpg',quality=95)
 Path('data/hvac-practical-2022-2023-video-crops.json').write_text(json.dumps(dict(
  method='공개 복원 영상의 질문·개별 프레임 대조 후 원본 픽셀 크롭. 강사·정답 자막 제외. 전체 정답 검증 완료 아님.',
  crops=records,evidence={'2022-2-12':'00:37:26~00:37:34 오른쪽 게이지의 고압/저압 구분 질문 확인',
  '2023-1-07':'00:24:00~00:24:06 (가)는 헤더 하단 밸브임을 질문 설명과 대조',
  '2022-3-12':'00:48:19~00:49:46 전동밸브 작동 설명. 기존 전자밸브 플런저 해설과 구별'},unresolved=[]),ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(dict(questions=len(records),crops=len(records))))

if __name__=='__main__':main()
