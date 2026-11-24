"""Rebuild the front matter, keeping the formula card and the 45 marked originals."""
import io, math
from pathlib import Path
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

base=Path('output/pdf'); path=base/'metal-marked-final.pdf'
src=PdfReader(io.BytesIO(path.read_bytes()))
originals=src.pages[-45:]
assert all('시험' in p.extract_text() for p in originals)
pdfmetrics.registerFont(TTFont('K','/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
buf=io.BytesIO(); c=Canvas(buf,pagesize=(842,595)); titles=[]
def txt(x,y,s,size=15,color='#172F3C'):
    assert x + pdfmetrics.stringWidth(s,'K',size) <= 829, s
    c.setFillColor(color);c.setFont('K',size);c.drawString(x,y,s)
def head(title,sub):
    titles.append(title);txt(40,550,'제관공학   /   기말 핵심 정리',13,'#08746D')
    txt(40,503,title,28);txt(40,472,sub,14)
def notes(title,sub,parts):
    head(title,sub)
    for i,(label,lines) in enumerate(parts):
        y=422-i*99;txt(42,y,label,19,'#08746D')
        for j,line in enumerate(lines):txt(44,y-26-j*20,line)
    c.showPage()
head('1 kW를 kcal/h로 바꾸기','kW와 kcal/h는 모두 에너지를 얼마나 빠르게 쓰거나 전달하는지를 나타낸다.')
c.setFillColor('#E9F4F1');c.roundRect(40,342,761,103,10,fill=1,stroke=0)
txt(64,383,'1 kW  =',24,'#075D58')
txt(240,403,'1 kJ/s × 3,600 s/h',21,'#075D58')
c.setStrokeColor('#08776F');c.line(215,390,475,390)
txt(259,362,'4.1868 kJ/kcal',19,'#075D58')
txt(500,384,'≈ 860 kcal/h',26,'#075D58')
txt(43,307,'①  3,600을 곱하는 이유',19,'#08746D')
txt(45,277,'1 kW는 1초에 1 kJ다. 1시간은 3,600초라서 1시간당 3,600 kJ가 된다.')
txt(43,231,'②  4.1868로 나누는 이유',19,'#08746D')
txt(45,201,'1 kcal는 4.1868 kJ(국제표 기준)다. kJ를 kcal로 바꾸면 3,600 ÷ 4.1868 ≈ 859.85 kcal/h다.')
txt(43,147,'시험 직전 기억:  kW × 860 ≈ kcal/h   |   kcal/h ÷ 860 ≈ kW',20,'#08746D')
txt(45,108,'예: 2.5 kW ≈ 2.5 × 860 = 2,150 kcal/h.')
txt(45,46,'환산 기준: NIST SP 811, Appendix B.9',11,'#506771')
c.linkURL('https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9',(45,40,320,60))
c.showPage()
notes('01   재료의 성질: 무엇을 비교하는가?', '근거: 시험범위 PDF 2·9·11~15·18쪽',[
 ('압력은 무게 자체가 아니라, 힘이 얼마나 좁게 모이는지다.',['압력 = 수직으로 누르는 힘 ÷ 면적. 같은 힘으로 누르면 면적이 절반일 때 압력은 두 배다.']),
 ('철·강·구리는 금속, 목재·시멘트·합성수지는 비금속이다.',['황동·청동은 구리 합금이다. 재료를 나눌 때는 색깔보다 바탕이 되는 금속을 본다.']),
 ('비중은 같은 부피끼리, 비열은 같은 질량끼리 비교한다.',['비중: 같은 부피의 물보다 몇 배 무거운가?  비열: 같은 질량을 1℃ 올릴 때 열이 얼마나 필요한가?', '용융점은 녹는 온도다. 자료의 대표 대비는 실온에서도 액체인 수은과 고온에서 녹는 텅스텐이다.']),
 ('보기의 단어로 성질을 분류한다.',['경도·인성은 기계적 성질, 내식성은 화학적 성질, 절삭성은 제작상의 성질이다.', '금속에 불순물이 섞이면 일반적으로 전기 전도율은 낮아진다. 전도율을 큰 순서로 놓으면 은 > 구리 > 금이다.'])])
notes('02   검사와 가공: 지문의 동사를 찾자','근거: PDF 21·22·24·31·33~35·37·44·46·49~50쪽',[
 ('당긴다 / 누른다 / 반복한다',['인장: 양끝을 당겨 얼마나 버티고 늘어나는지 본다. 경도: 누르는 자국에 얼마나 견디는지 본다.', '로크웰 B는 강구, C는 다이아몬드 원뿔. 피로는 한 번에 안 부러지는 힘도 반복하면 파괴되는 현상이다.']),
 ('표면을 본다 / 액체가 스민다 / 자분이 모인다',['VT는 눈으로 확인, PT는 표면으로 열린 틈에 침투액을 넣는다. MT는 자화한 재료의 결함 근처에', '자속이 새어 자분이 모이는 것을 본다. 내부의 모든 결함을 PT로 찾을 수 있는 것은 아니다.']),
 ('내부를 본다: 되돌아오면 UT, 통과하면 RT',['UT는 초음파의 반사 신호를 읽는다. RT는 X선·감마선이 시험체를 통과해 만든 영상을 읽는다.']),
 ('힘을 뺐을 때 돌아오면 탄성, 모양이 남으면 소성',['열간·냉간의 기준은 재결정 온도다. 단순히 손으로 만져 뜨거운지가 아니다.', '현미경 사진에서 알갱이가 결정립, 서로 다른 알갱이가 만나는 경계가 결정립계다.'])])

def wrapped(x,y,value,width,size=13,color='#172F3C'):
    parts=value.split()
    row=''
    for word in parts:
        candidate=f'{row} {word}'.strip()
        if row and pdfmetrics.stringWidth(candidate,'K',size)>width:
            txt(x,y,row,size,color);y-=18;row=word
        else: row=candidate
    if row:txt(x,y,row,size,color);y-=18
    return y

def graph(page,title,sub,crop,tags,side,steps):
    head(title,sub)
    im=Image.open(f'assets/study/metal-exam-{page}.webp')
    l,t,r,b=crop
    im=im.crop((round(l*im.width/660),round(t*im.height/466),round(r*im.width/660),round(b*im.height/466)))
    # Mask slide decoration outside the plot, not the diagram or its axes.
    if page in (51,79):
        from PIL import ImageDraw
        start=529 if page==51 else 525
        end=152 if page==51 else 150
        ImageDraw.Draw(im).rectangle(((start-l)*im.width/(r-l),0,im.width,(end-t)*im.height/(b-t)),fill='white')
    scale=min(545/(r-l),294/(b-t)); x=38+(545-(r-l)*scale)/2; top=445
    c.drawImage(ImageReader(im),x,top-(b-t)*scale,(r-l)*scale,(b-t)*scale)
    def pos(a,z):return x+(a-l)*scale,top-(z-t)*scale
    for label,a,z,u,v in tags:
        px,py=pos(a,z);lx,ly=pos(u,v);w=pdfmetrics.stringWidth(label,'K',12)+10
        sx=min(max(px,lx),lx+w);sy=min(max(py,ly-4),ly+12);angle=math.atan2(py-sy,px-sx)
        c.setStrokeColor('#006C71');c.setLineWidth(1.6);c.line(sx,sy,px,py)
        for sign in (-1,1):c.line(px,py,px-8*math.cos(angle+.43*sign),py-8*math.sin(angle+.43*sign))
        c.setFillColor('#E4F6F3');c.roundRect(lx,ly-4,w,17,3,stroke=0,fill=1);txt(lx+5,ly,label,12,'#00504D')
    y=431
    for term,meaning in side:
        txt(596,y,term,14,'#08746D')
        y=wrapped(596,y-19,meaning,207,12)-7
    assert y>=146,(page,y)
    c.setStrokeColor('#C9E3DF');c.line(40,139,801,139)
    y=117
    for label,meaning in steps:
        assert pdfmetrics.stringWidth(label,'K',14) <= 145,label
        txt(40,y,label,14,'#08746D')
        y=wrapped(194,y,meaning,607,13)-5
    assert y>=12,(page,y)
    txt(40,16,f'기말 핵심 정리  ·  {len(titles)}쪽',10,'#506771')
    c.showPage()
graph(51,'03   철-탄소 상태도: 기호와 영역','가로는 탄소 함량(%), 세로는 온도(℃). 같은 강을 식힐 때는 같은 탄소 함량에서 수직으로 내려간다.',
 (20,98,565,436),[('J 포정점',159,143,184,118),('C 공정점',401,223,421,166),
  ('S 공석점',210,316,237,336),('액체',393,158,369,117),('오스테나이트',170,222,124,248),
  ('액체 + 시멘타이트',504,197,414,120),('페라이트',125,329,40,349)],
 [('L = 액체','철과 탄소가 녹은 상태다.'),('α = 페라이트','탄소를 조금만 품는 철의 고체상.'),('γ = 오스테나이트','고온에서 탄소를 더 잘 품는 철의 고체상.'),('δ = 델타 페라이트','순철 쪽의 아주 높은 온도에서 나타나는 고체상.'),('Fe₃C = 시멘타이트','철 원자 3개와 탄소 원자 1개 비율의 단단한 탄화철.')],
 [('① +는 함께 있다는 뜻','γ+L은 오스테나이트 결정과 아직 녹아 있는 액체, Fe₃C+L은 시멘타이트와 액체가 함께 있는 구간이다.'),
  ('② 괄호는 조직 묶음','A₁ 아래의 (α+Fe₃C)는 펄라이트를 뜻한다. 오른쪽 바깥에 Fe₃C가 또 붙으면 펄라이트 밖에도 시멘타이트가 있다는 뜻이다.'),
  ('③ 0.8%에서 아래로','그림의 0.8% 세로줄에서 γ 영역을 지나 S점을 만나면, 그 아래는 페라이트와 시멘타이트가 층을 이룬 펄라이트다.')])
notes('04   상태도 경계: 선을 지나면 무엇이 바뀌나?','영역 안에서는 상태를 읽고, 경계에 닿으면 무엇이 새로 생기는지 읽는다.',[
 ('C · 공정: 1147℃에서 액체가 두 고체로 갈라진다.',['오스테나이트와 시멘타이트가 함께 생긴 조직이 레데뷰라이트다.']),
 ('S · 공석: 출발 물질은 액체가 아니라 고체다.',['오스테나이트가 페라이트와 시멘타이트로 나뉘어 펄라이트가 된다.', '앞 그림에서 S점에 이어진 A₁ 선은 723℃다. 공석 온도를 727℃로 표시한 그림도 있다.']),
 ('J · 포정: 1495℃에서 액체와 고체가 만나 새 고체가 된다.',['새 고체는 오스테나이트다. 세 반응 중 출발 쪽에 액체와 고체가 함께 있는 것이 포정이다.']),
 ('A₂는 768℃에서 자성이 변한다. A₃와 A₄는 결정 구조가 변한다.',['순철을 가열하면 A₃ 부근(약 910~912℃)에서 α → γ, A₄(1394℃)에서 γ → δ로 바뀐다.', '아래 탄소축의 2.11은 온도가 아니다. 강과 주철을 가르는 탄소 함량을 나타낸다.'])])
graph(79,'05   일반 열처리: 같은 출발, 다른 식히는 법','빨간 선을 왼쪽에서 오른쪽으로 따라간다. 위쪽은 높은 온도, 아래쪽은 낮은 온도다.',
 (125,135,553,414),[('가열',204,306,149,307),('높은 온도 유지',270,192,235,163),
 ('담금질',346,342,276,370),('불림',378,332,412,356),('풀림',415,294,457,259),('뜨임',446,240,456,209)],
 [('Quenching = 담금질','빠르게 식혀 단단한 마르텐사이트를 만든다. 깨지기 쉬워질 수 있다.'),
 ('Normalizing = 불림','꺼내서 공기 중에서 식힌다. 풀림보다 빠르다.'),
 ('Annealing = 풀림','그림은 가열로 안에서 천천히 식히는 완전 풀림이다. 가공하기 쉽게 한다.'),
 ('Tempering = 뜨임','담금질 뒤 다시 데워 깨지기 쉬운 성질을 줄인다.')],
 [('① 올라감 → 평평함','가열한 다음 높은 온도에서 유지한다. 수평 구간은 시간만 지나고 온도는 그대로다.'),
 ('② 처음 내려가는 길','가장 가파른 길이 담금질, 중간이 불림(공냉), 가장 완만한 길이 풀림(노냉)이다.'),
 ('③ 다시 올라가는 길','뜨임만 담금질 후에 재가열한다. 두 번째 유지선은 변태 기준을 나타낸 회색 점선보다 낮다.')])
ttt_key=[
 ('A = Austenite','오스테나이트. 처음 냉각할 때의 조직.'),
 ('P = Pearlite','펄라이트. 비교적 높은 온도에서 생성.'),
 ('B = Bainite','베이나이트. P보다 낮은 온도에서 생성.'),
 ('M = Martensite','마르텐사이트. Ms 아래에서 생성 시작.'),
 ('C / F / +','C는 시멘타이트, F는 페라이트. +는 공존.') ]
for n,title,tags,steps in [
 (84,'마퀜칭 (Marquenching)',
  [('② 온도 맞춤',224,331,228,310),('③ Ms 아래로 냉각',260,373,265,381),('④ 다시 데우는 구간',369,342,308,306)],
  [('① 급냉 ② 온도 맞춤','Ms 위에서 잠깐 기다려 겉과 속의 온도 차를 줄인다. 베이나이트 변태가 끝날 때까지 기다리는 것이 아니다.'),
   ('③ 다시 냉각','Ms 아래에서 남은 오스테나이트가 마르텐사이트로 바뀌기 시작한다.'),
   ('④ 아래에서 다시 상승','이 그림에는 이후 재가열도 함께 그려져 있다. 마퀜칭을 가려내는 핵심은 앞의 짧은 유지다.')]),
 (85,'마템퍼링 (Martempering)',
  [('② Ms 아래 유지',294,362,279,340),('③ 공냉',402,382,362,403)],
  [('① Ms 아래까지 급냉','급하게 내려가는 선이 Ms 기준선을 지난 다음에 옆으로 꺾인다.'),
   ('② 낮은 온도에서 유지','이 그림에서는 Ms 아래의 수평선이 단서다. 가로로 이동하므로 낮은 온도가 그대로 유지된다.'),
   ('③ 유지 뒤 공냉','끝의 빨간 선이 다시 내려간다. 이 경로의 결과는 마르텐사이트와 베이나이트가 함께 있는 조직이다.')]),
 (86,'오스템퍼링 (Austempering)',
  [('② 베이나이트 구간 유지',337,331,250,345),('③ 유지 후 냉각',398,351,339,374)],
  [('① Ms 위에서 멈춤','아래까지 단숨에 내리지 않고 베이나이트가 만들어지는 온도에서 멈춘다.'),
   ('② 변태 완료까지','수평선을 따라 오른쪽으로 간다. 시작선 전에는 변태 전, 두 선 사이는 일부 변태, 종료선 뒤는 변태 완료다.'),
   ('③ 그 뒤에 냉각','목표 조직은 베이나이트다. 마퀜칭의 짧은 정지와 달리 원하는 조직이 완성될 때까지 기다린다.')]),
 (87,'오스포밍 (Ausforming)',
  [('② 이때 소성가공',219,331,230,310),('③ 가공 뒤 급냉',238,365,253,379)],
  [('① 과냉 오스테나이트','빠르게 식혀도 곧바로 전부 변태하지 않는다. 왼쪽 A 영역에서 오스테나이트가 남아 있다.'),
   ('② 모양을 바꿈','짧은 수평 구간에 대응하는 작업은 소성가공이다. 빨간 경로만으로는 힘을 가하는 과정이 보이지 않는다.'),
   ('③ 가공 뒤 냉각','다시 Ms 아래로 내려가 마르텐사이트가 생긴다. 정답을 가르는 단서는 변태 전에 가공했다는 점이다.')])]:
    graph(n,'06   '+title,'세로는 온도(℃), 가로는 시간(s). 눈금 10 → 100 → 1000은 같은 간격마다 시간이 10배라는 뜻이다.',
     (144,224,426,431),[('① 급냉',201,285,153,244),('변태 시작선',210,285,211,268),
       ('변태 종료선',239,285,271,264),('Ms',193,352,163,358),
       ('펄라이트',400,270,430,263),('베이나이트',401,320,430,323),*tags],ttt_key,steps)
notes('07   겉만 단단하게: 무엇을 넣었는가?','근거: PDF 88~95쪽   |   마모를 받는 표면과 충격을 받는 내부의 역할을 나누는 것이 목적이다.',[
 ('침탄은 탄소, 질화는 질소를 표면에 넣는다.',['고체 침탄은 목탄 등과 함께 가열한다. 저렴하지만 균일한 깊이와 탄소량을 맞추기 어렵다.', '가스 침탄은 메탄·프로판 등을 쓴다. 조절과 연속 생산이 쉽지만 가스 안전관리와 설비 비용이 따른다.']),
 ('질화: 낮은 온도에서 질화물을 만들어 단단하게 한다.',['침탄 후 경화와 달리 별도의 담금질이 필요 없고 치수 변화가 작다. 대신 오래 걸리고 경화층이 얇다.']),
 ('금속 침투: 표면에 다른 원소를 확산시켜 합금층을 만든다.',['세라다이징 = 아연(방청), 크로마이징 = 크롬(내식·내마모), 칼로라이징 = 알루미늄(고온 산화 방지).', '보로나이징은 붕소, 실리코나이징은 규소다. 이름과 넣는 원소를 먼저 짝짓는다.']),
 ('열처리 경로: 정답 번호보다 조건을 먼저 본다.',['Ms 아래 유지 후 혼합조직 → 이 자료의 마템퍼링. 과냉 상태에서 소성가공 → 오스포밍.', '균열을 줄이려면 Ms까지 급냉한 뒤 Ms~Mf 구간은 서냉한다. Mf는 마르텐사이트 변태가 끝나는 온도다.'])])
c.save(); sheets=PdfReader(io.BytesIO(buf.getvalue()));w=PdfWriter()
def add(p,name):
    w.add_page(p);w.add_outline_item(name,len(w.pages)-1)
for page,title in zip(sheets.pages,titles,strict=True):
    add(page,title)
for p in originals:add(p,'시험 원문 PDF '+str(int(p.extract_text().strip().split()[0])+1)+'쪽')
with path.open('wb') as out:w.write(out)
