"""Source plates only: render the supplied book and lecture PDF; never synthesize curves."""
from pathlib import Path
import argparse
import subprocess
from tempfile import TemporaryDirectory
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

root=Path(__file__).resolve().parents[1]
args=argparse.ArgumentParser()
args.add_argument('book',type=Path,help='제관공학 보정.pdf (385쪽 스캔)')
args.add_argument('lecture',type=Path,help='제관공학 수업자료 PDF')
inputs=args.parse_args();book=inputs.book
for f,n in [('Regular','Body'),('Bold','Head')]:
    pdfmetrics.registerFont(TTFont(n,str(root/f'assets/fonts/NanumGothic-{f}.ttf')))
c=Canvas(str(root/'output/pdf/metal-curves-final.pdf'),pagesize=A4,invariant=1)
c.setTitle('제관공학 기말 | 두 선도 읽는 법')
pdfmetrics.registerFont(TTFont('Symbols',str(root/'assets/fonts/D2Coding-Regular.ttf')))
def unsupported(t,font):
    return any(not pdfmetrics.getFont(font).face.charToGlyph.get(ord(ch)) for ch in t)
ink='#192E3A'; teal='#006E6B'; coral='#A63F20'; gray='#516777'
def label(x,y,t,size=12,color=ink,font='Body'):
    c.setFillColor(HexColor(color));c.setFont('Symbols' if unsupported(t,font) else font,size);c.drawString(x,y,t)
def path(points,color,width=1.7,dash=False):
    c.saveState();c.setStrokeColor(HexColor(color));c.setLineWidth(width)
    if dash:c.setDash(4,3)
    p=c.beginPath();p.moveTo(*points[0])
    for point in points[1:]:p.lineTo(*point)
    c.drawPath(p);c.restoreState()
def plate(page,box,x,y,w,h,practice=None,slide=False):
    # Crop only the relevant diagram from the supplied scan; retain its axes.
    with TemporaryDirectory() as tmp:
        dest=Path(tmp)/'source'
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2600','-png',str(inputs.lecture if slide else book),str(dest)],check=True)
        with Image.open(dest.with_suffix('.png')) as im:
            sw,sh=(650,460) if slide else (1075,1520)
            part=im.crop(tuple(round(v*(im.width/sw if i%2==0 else im.height/sh)) for i,v in enumerate(box)))
            if practice:
                part.convert('RGB').save(root/'assets/study'/practice,format='WEBP',quality=90,method=6)
            c.drawImage(ImageReader(part),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c')

# First sheet: overlay a bilingual key ON the original plot. Fixed scan coordinates
# keep each open target ring attached to the printed point as the PDF is zoomed.
c.setPageSize((842,595))
label(24,560,'철-탄소 평형 상태도  |  그림 위에서 바로 읽기',24,ink,'Head')
label(24,535,'가로 = 탄소 함량   /   세로 = 온도   /   세 반응의 화살표는 냉각 기준. 가열할 때는 거꾸로 읽는다.',12,teal)
box=(182,738,827,1310);scale=.67;ox,oy=196,110
plate(21,box,ox,oy,(box[2]-box[0])*scale,(box[3]-box[1])*scale,'metal-fe-c.webp')
def marked(px,py,side,y,name,detail,color):
    x=ox+(px-box[0])*scale; target=oy+(box[3]-py)*scale
    tx=22 if side=='left' else 633; end=187 if side=='left' else 628
    mid=end+(12 if side=='left' else -12)
    path([(x,target),(mid,y-4),(end,y-4)],color,1.1)
    c.setStrokeColor(HexColor(color));c.setLineWidth(1.7);c.circle(x,target,3.2,fill=0,stroke=1)
    label(tx,y,name,12,color,'Head');label(tx,y-18,detail,10)
marked(274,816,'left',491,'A · 순철의 녹는점 1538℃','가열 시 δ 고체 → 액체',teal)
marked(284,833,'left',439,'J · 포정점 1495℃','액체 + δ 고체 → γ 고체',coral)
marked(275,867,'left',388,'N · A₄점 1394℃','순철 가열 시 γ → δ',teal)
marked(278,1044,'left',314,'G · A₃점 912℃','순철 가열 시 α → γ',teal)
marked(281,1096,'left',248,'A₂ · 768℃ 눈높이','자성만 변함. 상 경계가 아니다.',gray)
marked(339,1110,'left',185,'S · 공석점 / A₁ 723℃','γ → α + 탄화철 = 펄라이트',coral)
marked(558,850,'right',480,'L · 액체 영역','이 영역 안에서는 모두 액체',teal)
marked(605,960,'right',397,'C · 공정점 1147℃','액체 → γ + 탄화철 = 레데뷰라이트',coral)
marked(437,960,'right',340,'E · γ의 탄소 고용 한계','2.11% C. C점(4.30%)과 구별',teal)
marked(333,981,'right',280,'γ · 오스테나이트','고체 한 종류. 액체가 아니다.',teal)
marked(596,1188,'right',197,'α + Fe₃C · 두 상 공존','페라이트와 시멘타이트가 함께 있다.',teal)
label(24,84,'세 점만 가리고 말하기',13,teal,'Head')
label(24,64,'S: 고체 하나 → 고체 둘     C: 액체 하나 → 고체 둘     J: 액체와 고체 → 고체 하나',13)
def finish(n,source):
    label(24,22,source,10,gray);label(785,22,f'{n} / 8',10,gray);c.showPage()
def title(t,sub):
    label(24,555,t,24,ink,'Head');label(24,529,sub,12,teal)
def slide(n,box,x,y,w,h,asset=None):
    plate(n,box,x,y,w,h,asset,slide=True)
def tip(x,y,name,detail):
    label(x,y,name,14,teal,'Head');label(x,y-22,detail,11)
def tag(point,caption,text,color=teal):
    """Source-registered overlay; coordinates in the 800px proof, from top left."""
    def xy(pos):return (pos[0]*842/800,595-pos[1]*842/800)
    px,py=xy(point);x,y=xy(caption)
    width=pdfmetrics.stringWidth(text,'Head',10)+8
    path([(px,py),(max(x,min(px,x+width)),y+3)],color,1)
    c.setStrokeColor(HexColor(color));c.setLineWidth(1.3);c.circle(px,py,3.5,stroke=1,fill=0)
    c.setFillColor(HexColor('#ffffff'));c.roundRect(x,y-2,width,14,3,fill=1,stroke=0)
    label(x+4,y+1,text,10,color,'Head')
finish(1,'교재 37~38쪽 원도  ·  점·온도·영역 표시는 원도 밖 설명에서 해당 위치로 연결했다.')
title('수업 슬라이드의 파란 세 점','같은 세 점을 교수님 그림에서 다시 찾자. 탄소 %와 온도가 만나는 위치를 읽는다.')
slide(56,(22,94,561,429),20,160,525,340)
tag((144,140),(158,120),'J 포정점',coral)
tag((190,299),(143,278),'S 공석점',coral)
tag((365,214),(376,199),'C 공정점',coral)
tip(552,454,'왼쪽 위 · J 포정점','1495℃. 액체와 δ철이 만나 γ철이 된다.')
tip(552,372,'왼쪽 아래 · S 공석점','723℃. γ → 페라이트 + 시멘타이트.')
tip(552,290,'오른쪽 · C 공정점','1147℃. 액체 → γ + 시멘타이트.')
label(28,123,'두 자료의 숫자가 다를 때',15,teal,'Head')
label(28,95,'공석: 슬라이드 0.8% / 교재 0.77%. 공정: 슬라이드 4.2% / 교재 4.30%. 문제에서 제시한 그림을 기준으로 읽는다.',12)
label(28,66,'A₁ = 공석 변태, A₂ = 철의 자기변태(768℃). A₂에서는 자성만 바뀌고 결정격자가 바뀌지 않는다.',12)
finish(2,'수업 슬라이드 55 (PDF 56쪽) 원도 · 강의자료 58~59번 슬라이드의 표·반응 설명과 대조.')
title('같은 탄소강인데, 왜 사진이 다를까?','현미경으로 찍은 실제 조직. 무늬가 다른 부분을 먼저 찾은 뒤 아래 원래 캡션을 읽자.')
slide(57,(20,106,622,385),25,191,785,314)
tip(27,151,'왼쪽 SM45C · 밝은 바탕과 어두운 부분','밝은 페라이트 바탕 사이로 어두운 펄라이트가 보인다.')
tip(432,151,'오른쪽 STC3 · 가느다란 망','슬라이드에서 설명하는 흰 망상 조직은 시멘타이트다.')
label(28,69,'α, γ는 상의 이름이고, 펄라이트는 페라이트와 시멘타이트가 층을 이루는 조직이다. 어두운 곳을 모두 탄소라고 읽지 않는다.',11)
finish(3,'수업 슬라이드 56 (PDF 57쪽)  ·  현미경 사진 두 장과 원래 배율·캡션을 보존.')
label(24,560,'전체 지도 ②  항온변태곡선  |  500℃에서 오른쪽으로',23,ink,'Head')
label(24,534,'가로 = 시간(로그 눈금)   /   왼쪽 세로 = 온도   /   오른쪽 HRC = 경도. 탄소 함량을 읽는 그림이 아니다.',12,teal)
box=(290,258,750,646);scale=.92;ox,oy=200,123
plate(33,box,ox,oy,(box[2]-box[0])*scale,(box[3]-box[1])*scale,'metal-ttt.webp')
marked(375,377,'left',430,'① 첫 곡선 · 변태 시작','500℃에서 이 선 전은 변태 전.',teal)
marked(430,377,'left',349,'② 두 번째 곡선 · 종료','두 선 사이에서는 일부만 변태.',coral)
marked(528,352,'right',435,'P · 펄라이트','이쪽 온도에서 유지해 생긴 조직.',teal)
marked(560,401,'right',363,'상부 B · 상부 베이나이트','B는 베이나이트의 첫 글자.',teal)
marked(565,431,'right',286,'하부 B · 하부 베이나이트','상부 B보다 낮은 온도에서 생성.',teal)
marked(483,554,'left',203,'아래 눈금 · 시간(초)','교점에서 수직으로 내려 읽는다.',gray)
label(24,97,'손가락으로 풀기',14,teal,'Head')
label(24,72,'500℃ 눈금에서 출발 → 오른쪽으로 ①을 만나면 변태 시작 → ②를 지나면 이 온도에서의 변태 완료.',13)
label(24,48,'왜 수평인가? 기다리는 동안 시간만 지나고 온도는 그대로다. 계속 식히는 불림과는 경로가 다르다.',11,gray)
finish(4,'교재 47쪽 원도 · HRC는 경도. 강종마다 곡선 위치가 달라 시간 숫자를 다른 강에 그대로 쓰지 않는다.')
title('수업 그림에서 TTT 읽기','왼쪽은 기본 선도, 오른쪽은 수업자료에 이미 그려진 냉각 경로다. 빨간 선은 새로 그린 것이 아니다.')
slide(89,(113,180,570,415),18,233,393,258)
slide(90,(113,180,570,415),428,233,393,258)
tag((70,185),(62,113),'코: 변태 시작이 가장 빠름')
tag((94,187),(115,211),'변태 종료선',coral)
tag((438,245),(430,342),'Ms: 마르텐사이트 시작')
tip(25,187,'① 어느 온도에서 기다리나?','온도가 그대로면 오른쪽으로 간다. 가로축은 시간이다.')
tip(428,187,'② 코를 피했나, 변태 영역에 들어갔나?','빨리 식혀 Ms 아래로 내려가면 남은 γ에서 마르텐사이트가 생긴다.')
label(25,102,'A = 오스테나이트    P = 펄라이트    B = 베이나이트    M = 마르텐사이트    Ms = 마르텐사이트 변태 시작 온도',12)
finish(5,'수업 슬라이드 88·89 (PDF 89·90쪽)의 원도. 연속 냉각의 정확한 변태량·온도는 CCT 선도로 읽는다.')
title('세 가지 항온 열처리: 수평으로 머문 곳 찾기','위는 수업 슬라이드의 빨간 경로, 아래는 교재 47쪽 원도. 교재와 강의의 그림 순서가 다르다.')
for j,(n,t,tiptext) in enumerate([(91,'마퀜칭','Ms 위에서 안팎 온도를 맞춘다.'),(92,'마템퍼링','수업 기준: Ms 아래 유지 후 공냉.'),(93,'오스템퍼링','베이나이트 변태가 끝날 때까지 유지.')]):
    x=20+j*274
    slide(n,(82 if n==91 else 141,219,426,430),x,287,259,195)
    label(x,490,t,15,teal,'Head');label(x,270,tiptext,11)
plate(33,(88,1098,945,1394),52,51,737,203)
tag((119,202),(22,184),'온도 맞추기')
tag((407,229),(409,251),'Ms 아래 유지')
tag((702,202),(653,225),'변태 완료까지 유지')
finish(6,'수업 슬라이드 90~92 (PDF 91~93쪽) · 아래 교재 (a) 오스템퍼 / (b) 마템퍼 / (c) 마퀜칭.')
title('뜨임·불림·풀림: 수업 원도에서 비교','왼쪽은 온도 이력 네 가지, 오른쪽은 담금질 뒤 다시 가열하는 뜨임의 확대 설명이다.')
slide(86,(122,133,550,421),22,199,418,293,'metal-heat-lecture.webp')
slide(82,(35,242,374,424),452,205,354,250)
tag((224,295),(143,271),'담금질 · 급냉',coral)
tag((253,284),(252,330),'불림 · 공냉')
tag((289,249),(301,250),'풀림 · 노냉')
tag((264,199),(271,181),'뜨임 · 재가열',coral)
tip(24,160,'불림 Normalizing / 풀림 Annealing','불림은 가열로 밖에서 공냉, 완전 풀림은 로 안에서 노냉한다.')
tip(452,160,'담금질 Quenching / 뜨임 Tempering','급냉이 담금질. 담금질 뒤 A₁ 아래로 재가열하면 뜨임이다.')
label(24,70,'이 그림은 열처리 순서를 보여 주는 온도–시간 그림이다. TTT의 변태 시작·종료선과 같은 선이 아니다.',12)
finish(7,'수업 슬라이드 85·81 (PDF 86·82쪽). 영문 이름과 원래 곡선·눈금을 그대로 사용.')
title('외부 원도 두 장으로 눈에 익히기','교재와 모양이 달라도 가로축부터 보면 된다. 왼쪽은 탄소 함량, 오른쪽 그림 왼쪽 축 아래의 Czas [s]는 시간(초)이다.')
for x,name in [(24,'fe'),(429,'ttt')]:
    c.drawImage(str(root/f'assets/study/metal-external-{name}.png'),x,139,381,360,preserveAspectRatio=True,anchor='c',mask='auto')
tag((249,142),(261,127),'액체')
tag((96,223),(156,230),'오스테나이트')
tag((546,182),(389,183),'베이나이트 변태')
tag((546,150),(392,145),'펄라이트 변태')
tip(26,115,'왼쪽 · ciecz는 액체, γ는 오스테나이트','색과 영역을 읽는 비교용. 시험 온도는 수업 그림에서 확인한다.')
tip(425,115,'오른쪽 · A → P / A → B','오스테나이트가 펄라이트 또는 베이나이트로 바뀐다는 뜻이다.')
for x,filename in [(25,'Fe-Fe3C_phasediagr.svg'),(430,'TTT_diagram.svg')]:
    label(x,52,'원본 열기: '+filename,10,teal)
    c.linkURL('https://commons.wikimedia.org/wiki/File:'+filename,(x,49,x+220,66))
finish(8,'두 그림: Joanna Kośmider, Wikimedia Commons, Public Domain (PD-self), 2011. 원도 비율 유지 · 한글 해설 별도.')
c.save()

# Use the same labelled plates after answering. The question itself keeps the
# unlabelled source crop so it does not reveal the answer before the attempt.
with TemporaryDirectory() as tmp:
    for page,name in [(1,'phase'),(4,'ttt'),(6,'holds'),(7,'heat')]:
        dest=Path(tmp)/name
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2050','-png',
                        str(root/'output/pdf/metal-curves-final.pdf'),str(dest)],check=True)
        with Image.open(dest.with_suffix('.png')) as im:
            im.convert('RGB').save(root/'assets/study'/f'metal-key-{name}.webp',quality=90,method=6)
