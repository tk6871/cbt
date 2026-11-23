"""Vector diagrams and guided examples; source: 제관공학 수업자료 (1), PDF pp.56–60, 88–97."""
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
book=args.parse_args().book
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
def dot(x,y):
    c.setFillColor(HexColor(coral));c.circle(x,y,4,fill=1,stroke=0)
def header(n,title,src):
    label(40,799,'제관공학   /   기말고사 곡선 읽기',11,teal,'Head')
    label(40,757,title,24,ink,'Head');path([(40,734),(555,734)],teal,1)
    label(40,27,('수업자료 PDF '+src+'쪽 기준  ·  그림은 읽기 연습용 개념도') if n<=5 else src,9,gray)
    label(518,27,f'{n+1} / 9',10,gray)
def note(y,title,text):
    label(40,y,title,14,teal,'Head')
    text=''.join('<font name="Symbols">'+ch+'</font>' if unsupported(ch,'Body') else ch for ch in text)
    p=Paragraph(text,ParagraphStyle('body',fontName='Body',fontSize=12,leading=19,wordWrap='CJK'))
    _,h=p.wrap(503,500);p.drawOn(c,44,y-10-h);assert y-10-h>51
    return y-36-h
def plate(page,box,x,y,w,h):
    # Crop only the relevant diagram from the supplied scan; retain its axes.
    with TemporaryDirectory() as tmp:
        dest=Path(tmp)/'source'
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2600','-png',str(book),str(dest)],check=True)
        with Image.open(dest.with_suffix('.png')) as im:
            part=im.crop(tuple(round(v*(im.width/1075 if i%2==0 else im.height/1520)) for i,v in enumerate(box)))
            c.drawImage(ImageReader(part),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c')

# First sheet: overlay a bilingual key ON the original plot. Fixed scan coordinates
# keep each open target ring attached to the printed point as the PDF is zoomed.
c.setPageSize((842,595))
label(24,560,'철-탄소 평형 상태도  |  그림 위에서 바로 읽기',24,ink,'Head')
label(24,535,'가로 = 탄소 함량   /   세로 = 온도   /   세 반응의 화살표는 냉각 기준. 가열할 때는 거꾸로 읽는다.',12,teal)
box=(182,738,827,1310);scale=.67;ox,oy=196,110
plate(21,box,ox,oy,(box[2]-box[0])*scale,(box[3]-box[1])*scale)
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
label(24,40,'교재 37~38쪽 그림 + 수업자료 56~60쪽 표기. 외부 자료는 공석 727℃ 등 다른 관례를 쓰므로 시험 수치는 수업 기준.',10,gray)
label(24,22,'비교 자료: Iowa State University · Phase Equilibria (누르면 열기)',9,teal)
c.linkURL('https://faculty.sites.iastate.edu/tec/files/inline-files/L19%20-%20Phase%20Equilibria%205.pdf',(23,19,340,34))
label(784,22,'1 / 9',10);c.showPage();c.setPageSize(A4)
header(1,'그림을 볼 때, 가로축부터 찾자','56–60, 89–90')
note(703,'먼저 물어볼 것: 오른쪽으로 가면 무엇이 달라질까?',
     '철-탄소 상태도에서는 탄소의 양, TTT 선도에서는 시간이 늘어난다. 둘 다 세로축은 온도지만 같은 가로선의 뜻이 다르다.')
for x,cap,xt,caption in [(74,'철-탄소 상태도','탄소 함량(%)','합금을 정하고 아래로 읽기'),(335,'TTT 선도','시간(초)','같은 온도에서 오른쪽으로 읽기')]:
    label(x,558,cap,17,ink,'Head');path([(x,516),(x,380),(x+175,380)],gray);label(x-5,524,'온도',10);label(x+77,357,xt,11)
    if x<100:
        path([(x+80,501),(x+80,400)],coral,3);path([(x+75,409),(x+80,400),(x+85,409)],coral)
    else:
        path([(x+12,446),(x+150,446)],coral,3);path([(x+141,451),(x+150,446),(x+141,441)],coral)
    label(x-3,322,caption,11,teal,'Head')
y=note(265,'상태도 예시','탄소 0.8%인 강을 식힌다. 탄소를 더 넣은 게 아니므로 가로 좌표 0.8은 그대로다. 온도만 낮아져 점이 아래로 움직인다.')
note(y,'TTT 예시','600℃까지 빨리 식힌 다음 그 온도에서 기다린다. 급냉은 가파르게 내려가는 선, 기다리는 동안은 오른쪽으로 뻗는 수평선으로 그린다.')
c.showPage()

header(2,'철-탄소 상태도에서 세 점 읽기','56–60')
label(40,705,'냉각 기준  ·  강의 그림의 대표점만 표시 (축 간격은 비례하지 않음)',11,gray)
x0=108; path([(x0,657),(x0,430),(527,430)],gray)
for y,t in [(621,'1495℃'),(547,'1147℃'),(476,'723℃')]:
    label(47,y-4,t,11);path([(x0,y),(509,y)],'#B7C9C9',1,True)
for x,y,s in [(146,621,'J  포정'),(227,476,'S  공석'),(429,547,'C  공정')]:
    dot(x,y);label(x+8,y+8,s,12,coral,'Head')
    path([(x,430),(x,y-5)],'#91A7AB',1,True)
label(200,410,'약 0.8%',11);label(405,410,'약 4.2%',11);label(427,387,'탄소 함량 →',11,gray)
y=note(345,'S 공석점  |  출발부터 고체','오스테나이트(γ) 한 종류가 페라이트(α)와 시멘타이트(Fe₃C)로 나뉜다. 두 상이 층을 이루는 혼합조직을 펄라이트라 한다. 강의 기준 723℃.')
y=note(y,'C 공정점  |  액체 하나에서 고체 둘','액체 → 오스테나이트 + 시멘타이트. 이때 생긴 혼합조직은 레데뷰라이트다. 수업 그림은 1147℃, 약 4.2% C로 표시한다.')
note(y,'J 포정점  |  액체와 고체가 만나 고체 하나','액체 + δ철 → γ철(오스테나이트). 1495℃. 이름이 헷갈리면 결과보다 왼쪽의 출발물부터 본다: 액체 하나면 공정, 고체 하나면 공석, 액체와 고체면 포정.')
c.showPage()

header(3,'A₁과 A₂는 무엇이 다른가?','56–60')
y=note(699,'철 원자의 자리 vs 자석의 성질','동소변태는 철 원자가 늘어선 격자 모양이 바뀌는 일이다. 자기변태는 자성이 바뀌는 일이다. 같은 온도 눈금에 있어도 뜻이 다르다.')
for name,t,body in [
 ('A₀','약 210℃','시멘타이트의 자기변태. 순철의 A₂와 대상이 다르다.'),
 ('A₁','723℃','공석 변태 기준선. 공석강을 냉각하면 γ가 펄라이트로 변한다.'),
 ('A₂','768℃','철의 자기변태점. 가열하면 강자성을 잃는다. 결정격자 자체가 바뀌는 점이 아니다.'),
 ('A₃','순철 약 910~912℃','가열하면 α철(체심입방) → γ철(면심입방). 탄소가 들어간 강에서는 A₃ 경계 온도가 달라진다.'),
 ('A₄','순철 약 1394℃','가열하면 γ철 → δ철(체심입방). 녹아서 액체가 되는 것은 아니다.'),
]:
    y=note(y,name+'    '+t,body)
note(y,'연습  |  “768℃에서 격자가 변한다.” 맞을까?',
     '아니다. A₂에서는 자성이 변한다. 자료 56쪽 그림의 A₃는 910℃, 59쪽 목록은 912℃다. 작은 수치 차이보다 α와 γ 사이의 변화를 기억하자.')
c.showPage()

header(4,'TTT: 두 곡선 사이에서 무슨 일이?','88–93')
label(42,701,'오스테나이트를 빠르게 냉각한 뒤 한 온도에서 유지할 때의 개념도',11,gray)
path([(96,667),(96,422),(530,422)],gray);label(48,657,'온도',11);label(436,383,'시간(로그 눈금)',10)
for x,t in [(125,'1'),(236,'10'),(347,'100'),(458,'1000초')]:label(x,405,t,10)
for dx,color in [(0,teal),(97,'#395FA0')]:
    p=c.beginPath();p.moveTo(355+dx,657);p.curveTo(285+dx,648,160+dx,600,161+dx,578);p.curveTo(163+dx,553,239+dx,507,288+dx,470);c.setStrokeColor(HexColor(color));c.setLineWidth(2.2);c.drawPath(p)
label(288,662,'변태 시작선',10,teal);label(393,662,'변태 종료선',10,'#395FA0')
path([(99,452),(526,452)],gray,1,True);label(48,448,'Ms',12)
path([(118,650),(128,578),(339,578)],coral,2.6)
for x,t in [(142,'①'),(208,'②'),(315,'③')]: dot(x,578);label(x-6,586,t,11,coral)
y=note(365,'① 시작 전 → ② 일부 변태 → ③ 변태 완료','빨간 선을 따라가자. ①에선 아직 오스테나이트다. ②는 변태가 진행 중이라 원래 조직과 새 조직이 함께 있다. ③은 이 온도에서 가능한 변태가 끝난 뒤다.')
y=note(y,'새 조직은 유지 온도에 따라 다르다','강의 선도에서 위쪽 변태 구역은 펄라이트, 그 아래 구역은 베이나이트다. 시작선 왼쪽의 돌출된 부분(코)은 변태가 가장 빨리 시작되는 부근이다.')
note(y,'Ms는 세 번째 C곡선이 아니다','Ms는 남은 오스테나이트에서 마르텐사이트가 생기기 시작하는 온도다. 오른쪽으로 오래 기다린다는 뜻이 아니다. 시간축도 1, 10, 100초처럼 같은 간격마다 곱으로 커진다.')
c.showPage()

header(5,'세 냉각 경로, 두 질문으로 구별하기','91–97')
label(40,705,'① Ms 위인가 아래인가?   ② 온도만 맞췄나, 변태 완료까지 기다렸나?',12,teal,'Head')
for j,(t,level,end) in enumerate([('마퀜칭',574,57),('오스템퍼링',594,105),('마템퍼링',525,70)]):
    x=45+174*j;label(x,663,t,15,ink,'Head')
    path([(x,639),(x,483),(x+150,483)],gray,1);path([(x,546),(x+143,546)],gray,1,True);label(x+123,551,'Ms',9,gray)
    path([(x+9,630),(x+20,level),(x+end,level),(x+end+21,495)],coral,2.6)
label(40,463,'세로: 온도  /  가로: 시간  /  점선: Ms  /  빨간 선: 온도가 변한 순서',10,gray)
y=note(421,'마퀜칭: 위에서 잠깐','Ms 바로 위에서 표면과 중심의 온도를 고르게 한 뒤 냉각한다. 남은 오스테나이트가 Ms 아래에서 마르텐사이트로 바뀐다. 안팎 온도차를 줄여 변형·균열 위험을 낮추는 것이 목적이다.')
y=note(y,'오스템퍼링: 위에서 변태 완료까지','베이나이트 구간으로 급냉하고, 끝선까지 충분히 유지한 뒤 냉각한다. 목표는 베이나이트다. 단순히 “Ms 위에서 유지”만으로 마퀜칭과 구별할 수 없다.')
y=note(y,'마템퍼링: 이 수업에서는 아래에서 유지','수업자료 92·95쪽에서는 Ms 아래 100~200℃ 부근에서 유지 후 공냉하여 마르텐사이트와 베이나이트 혼합조직을 얻는 경로로 구분한다. 자료 밖에서는 명칭을 다르게 쓰기도 하므로 여기서는 수업 그림을 기준으로 한다.')
note(y,'가리고 풀기','① 액체 없이 723℃에서 두 고체가 생겼다. ② 자성만 변했다(철). ③ Ms 위에서 베이나이트가 될 때까지 기다렸다.  /  답: ① 공석반응 ② A₂ ③ 오스템퍼링.')
c.showPage()
header(6,'전체 지도 ①  철-탄소 평형 상태도','제관공학 교재 37~38쪽 (스캔 PDF 21~22쪽) · 수업자료 56~60쪽')
plate(21,(106,735,891,1398),37,337,520,384)
y=note(308,'왼쪽 끝에서 위로: 순철 가열','G(912℃)는 α → γ, N(1394℃)은 γ → δ, A(1538℃)는 녹는점이다. A는 그래프 점 이름이고 A₁의 약자가 아니다. A₂(768℃)는 자성 변화라 새 상의 경계선을 찾는 문제가 아니다.')
y=note(y,'가로선을 따라: S는 공석, C는 공정, J는 포정','S: 탄소 0.77%, 723℃, 고체 → 고체 둘. C: 4.30%, 1147℃, 액체 → 고체 둘. J: 1495℃, 액체 + δ → γ. 수업 그림의 0.8%와 4.2%는 교재 표기와 다르므로 문제에 제시된 선도를 기준으로 읽는다.')
note(y,'영역의 숫자를 우리말로','①은 액체, ⑦은 γ(오스테나이트), ⑨는 α와 γ의 공존, ⑪은 α와 Fe₃C의 공존이다. E의 2.11%는 γ에 탄소가 최대로 녹는 조성이지 C점이 아니다.')
c.showPage()
header(7,'전체 지도 ②  항온 변태 곡선','제관공학 교재 47쪽 (스캔 PDF 33쪽) · 수업자료 89~90쪽')
plate(33,(290,258,750,646),55,346,485,376)
y=note(313,'그림 속 표기 번역','왼쪽 숫자는 온도, 아래는 시간, 오른쪽 HRC는 경도다. P는 펄라이트, 상부 B·하부 B는 베이나이트다. 변태 개시점은 시작, 변태 종료점은 끝이라는 뜻이다.')
y=note(y,'직접 짚기: 500℃에서 그대로 기다린다면?','왼쪽 500에서 손가락을 오른쪽으로 움직인다. 첫 곡선 전에는 아직 변태 전, 두 곡선 사이에서는 일부만 변태, 두 번째 곡선을 지나면 완료다. 시간을 물으면 교점에서 아래로 내려가 초(s)를 읽는다.')
note(y,'헷갈리는 P 두 가지','상태도의 P는 점의 이름이고, 이 TTT 그림 영역의 P는 조직 이름이다. 두 그림이 같은 글자를 써도 뜻이 다르다.')
c.showPage()
header(8,'전체 지도 ③  세 열처리를 나란히','제관공학 교재 47쪽 (스캔 PDF 33쪽) · 수업자료 91~95쪽')
plate(33,(88,1098,945,1394),32,502,531,198)
y=note(466,'원도 (a) 오스템퍼  |  변태 구역을 가로지름','유지선이 Ms 위에서 빗금 친 변태 구역을 끝까지 통과한다. 같은 온도에서 충분히 기다려 베이나이트가 되었다는 뜻이다.')
y=note(y,'원도 (b) 마템퍼  |  Ms 아래에서 기다림','유지 위치를 Ms 선과 비교한다. 이 교재는 마르텐사이트와 베이나이트의 혼합조직으로 설명한다.')
y=note(y,'원도 (c) 마퀜칭  |  내부·외부 온도 차부터 줄임','선이 두 가닥인 것은 중심과 표면의 냉각 속도가 다르기 때문이다. Ms 위에서 두 온도를 맞추고 식힌다. 맨 오른쪽 다시 올라가는 구간은 그 뒤의 뜨임이다.')
note(y,'시험 직전, 그림을 가리고 답하기','① 가로축이 탄소 %인가 시간인가? ② S·C·J에서 냉각 전후 액체는 몇 개인가? ③ 유지선은 Ms의 위인가 아래인가? ④ 변태 완료까지 기다렸나? 이 네 질문에 답하고 숫자를 외우면 선을 뒤집어 읽지 않는다.')
c.save()
