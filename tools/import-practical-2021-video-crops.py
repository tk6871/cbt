#!/usr/bin/env python3
"""Reproduce manually reviewed 2021-1/2 original-pixel question crops."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

# round, question, image index, source frame, native crop, review note
CROPS = [
 ('1',3,1,'public-review/2021-1-q03-983-13s.png',[152,0,1768,1080],'공냉 왕복동 압축기 외관 전체. 검은 테두리·강사 제외'),
 ('1',4,1,'public-review/2021-1-q04-1567-8s.png',[382,4,1538,1076],'오일 조정기 전면과 연결부 전체. 원문 전면 표시 유지'),
 ('1',5,1,'public-review/2021-1-q05-1914-13s.png',[352,70,1495,986],'헤더와 우측 하단 밸브 연결부. 문항에 위치 설명 추가'),
 ('1',6,1,'public-review/2021-1-q06-2140-13s.png',[52,208,1040,948],'가·나·다·라 네 배관과 끝단 전체. 강사·수량 판서 제외'),
 ('1',7,1,'gauge-review/2021-1-q07-2215-13s.png',[620,460,1280,1076],'두 압력게이지·밸브·호스 연결부. 실제 작업 장갑은 원문 일부'),
 ('1',8,1,'public-review/2021-1-q08-2468-13s.png',[268,144,1628,1080],'릴레이·소켓·핀 전체. 명칭 해설 전 프레임'),
 ('1',9,1,'public-review/2021-1-q09-2510-13s.png',[535,0,1090,1080],'두 수면계와 연결부. 원문 카메라 프레임의 하단 연결관은 이어짐'),
 ('1',10,1,'public-review/2021-1-q10-2811-13s.png',[432,0,1488,1080],'가 트랩의 단면과 원문 표기'),
 ('1',10,2,'bucket-review/2021-1-q10-2828-3s.png',[442,0,1480,1080],'나 트랩의 외관과 원문 표기'),
 ('1',10,3,'trap-review/2021-1-q10-2836-3s.png',[459,0,1461,1080],'다 트랩의 외관과 원문 표기. 단면의 정답 힌트 영문은 제외'),
 ('1',11,1,'public-review/2021-1-q11-2915-3s.png',[266,162,781,660],'리머 손잡이·끝부분 전체. 강사·질문 자막 제외'),
 ('1',12,1,'public-review/2021-1-q12-3002-3s.png',[84,234,913,713],'두 차단기 단자·외관 전체. 명칭 판서 제외'),
 ('2',3,1,'plate-review/2021-2-q03-828-13s.png',[171,306,818,672],'원문 빨간 사각형으로 지목한 부품과 냉매용기. 정답 이름 제외'),
 ('2',4,1,'public-review/2021-2-q04-1117-13s.png',[0,82,1920,1000],'A·B와 배관·바이패스 전체. 검은 테두리만 제외'),
 ('2',5,1,'valve-review/2021-2-q05-1439-13s.png',[168,134,752,880],'밸브 외관·단면·양 끝 내부 사진. 강사 제외'),
 ('2',6,1,'detail-review/2021-2-q06-1507-3s.png',[774,0,1296,1074],'헤더 우측 끝과 원문 가 화살표·밸브 전체. 왼쪽 배관은 원문에서도 프레임 밖'),
 ('2',7,1,'detail-review/2021-2-q07-1626-3s.png',[256,156,810,1008],'릴레이와 소켓·핀 사진 두 장 전체'),
 ('2',8,1,'public-review/2021-2-q08-1660-3s.png',[170,156,843,777],'여과 필터 원문 사진. 강사·질문 자막 제외'),
 ('2',9,1,'public-review/2021-2-q09-1956-3s.png',[170,190,860,570],'같은 문항 상단의 두 밸브 대표 외관. 하단 다른 모델과 명칭 자막 제외'),
 ('2',10,1,'pipe-review/2021-2-q10-2008-8s.png',[54,100,1045,942],'네 배관 가·나·다·라 전체. 1회와 다른 나 배관을 보존. 원문 번호 표기 유지'),
 ('2',11,1,'public-review/2021-2-q11-2060-3s.png',[195,198,849,616],'냉동장치 전체와 연결부. 질문·보기 판서 제외'),
 ('2',12,1,'public-review/2021-2-q12-2363-3s.png',[100,249,908,772],'두 차단기의 외관과 단자. 정답 판서 전 프레임'),
]

def main():
 p=argparse.ArgumentParser();p.add_argument('--frame-root',type=Path,required=True);args=p.parse_args()
 catalog=json.loads(Path('data/hvac-practical-public-video-sources.json').read_text())['sources']
 records=[];previews=[]
 for session,n,index,relative,rect,note in CROPS:
  frame=args.frame_root/f'cbt-2021-{session}-{relative}'
  with Image.open(frame) as original:
   size=list(original.size)
   if size!=[1920,1080]:raise ValueError(f'Unexpected native dimensions: {frame} {size}')
   if not(0<=rect[0]<rect[2]<=size[0] and 0<=rect[1]<rect[3]<=size[1]):raise ValueError('Invalid crop')
   cropped=original.convert('RGB').crop(rect)
  id=f'hvac-practical-restored-2021-{session}-{n:02d}'
  output=Path(f'assets/hvac-practical/restored/2021-{session}/{id}-question-video-{index}-v550.png')
  output.parent.mkdir(parents=True,exist_ok=True);cropped.save(output,optimize=True)
  time=int(frame.stem.split('-')[-2])+int(frame.stem.split('-')[-1][:-1])
  source=next(s for s in catalog if s['year']==2021 and s['session']==session)
  records.append(dict(id=id,role='question',index=index,year=2021,session=session,sourceUrl=source['url'],
   frame=str(frame.relative_to(args.frame_root)),frameSha256=hashlib.sha256(frame.read_bytes()).hexdigest(),
   nativeSize=size,timestamp=f'{time//3600:02d}:{time//60%60:02d}:{time%60:02d}',crop=rect,
   output=output.as_posix(),outputSize=list(cropped.size),sha256=hashlib.sha256(output.read_bytes()).hexdigest(),reviewNote=note))
  preview=Image.new('RGB',(600,520),'white');draw=ImageDraw.Draw(preview)
  draw.text((8,8),f'2021-{session} Q{n} #{index} / {cropped.width}x{cropped.height}',fill='black')
  thumb=cropped.copy();thumb.thumbnail((580,480));preview.paste(thumb,((600-thumb.width)//2,35));previews.append(preview)
 for start in range(0,len(previews),4):
  sheet=Image.new('RGB',(1200,1040),'#ddd')
  for j,preview in enumerate(previews[start:start+4]):sheet.paste(preview,((j%2)*600,(j//2)*520))
  sheet.save(args.frame_root/f'cbt-2021-final-{start//4+1}.jpg',quality=95)
 Path('data/hvac-practical-2021-video-crops.json').write_text(json.dumps(dict(
  method='공개 원문의 질문·개별 프레임 대조 후 원본 픽셀 크롭. 전체 정답 검증 완료 아님.',
  crops=records,evidence={'2021-1-07':'00:37:15~00:40:51 명칭과 청·적·황 호스 연결 질문',
  '2021-1-09':'00:45:41~00:46:43 명칭·설치목적·2개 설치 이유',
  '2021-1-10':'00:47:28~00:48:29 세 트랩 사진·설명 대조',
  '2021-1-04':'00:26:24~00:26:44 원문 오일 조정기 답안과 대조, 기존 정답 유지'},unresolved=[]),ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(dict(questions=len(set(c['id'] for c in records)),crops=len(records))))

if __name__=='__main__':main()
