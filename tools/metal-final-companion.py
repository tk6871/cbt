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
src=PdfReader(io.BytesIO(path.read_bytes())); old=PdfReader(base/'metal-curves-final.pdf')
originals=src.pages[-45:]
assert all('시험' in p.extract_text() for p in originals)
pdfmetrics.registerFont(TTFont('K','/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
buf=io.BytesIO(); c=Canvas(buf,pagesize=(842,595)); titles=[]
def txt(x,y,s,size=15,color='#172F3C'):
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
notes('01   재료의 성질: 무엇을 비교하는가?', '근거: 시험범위 PDF 2·9·11~15·18쪽   |   앞장의 열량 공식은 비열을 적용한 추가 예제다.',[
 ('압력은 무게 자체가 아니라, 힘이 얼마나 좁게 모이는지다.',['압력 = 수직으로 누르는 힘 ÷ 면적. 같은 힘으로 누르면 면적이 절반일 때 압력은 두 배다.']),
 ('철·강·구리는 금속, 목재·시멘트·합성수지는 비금속이다.',['황동·청동은 구리 합금이다. 재료를 나눌 때는 색깔보다 바탕이 되는 금속을 본다.']),
 ('비중은 같은 부피끼리, 비열은 같은 질량끼리 비교한다.',['비중: 같은 부피의 물보다 몇 배 무거운가?  비열: 같은 질량을 1℃ 올릴 때 열이 얼마나 필요한가?', '용융점은 녹는 온도다. 자료의 대표 대비는 실온에서도 액체인 수은과 고온에서 녹는 텅스텐이다.']),
 ('보기의 단어로 성질을 분류한다.',['경도·인성은 기계적 성질, 내식성은 화학적 성질, 절삭성은 제작상의 성질이다.', '금속에 불순물이 섞이면 일반적으로 전기 전도율은 낮아진다. 수업자료의 전도율 순서는 은 > 구리 > 금부터다.'])])
notes('02   검사와 가공: 지문의 동사를 찾자','근거: PDF 21·22·24·31·33~35·37·44·46·49~50쪽',[
 ('당긴다 / 누른다 / 반복한다',['인장: 양끝을 당겨 얼마나 버티고 늘어나는지 본다. 경도: 누르는 자국에 얼마나 견디는지 본다.', '로크웰 B는 강구, C는 다이아몬드 원뿔. 피로는 한 번에 안 부러지는 힘도 반복하면 파괴되는 현상이다.']),
 ('표면을 본다 / 액체가 스민다 / 자분이 모인다',['VT는 눈으로 확인, PT는 표면으로 열린 틈에 침투액을 넣는다. MT는 자화한 재료의 결함 근처에', '자속이 새어 자분이 모이는 것을 본다. 내부의 모든 결함을 PT로 찾을 수 있는 것은 아니다.']),
 ('내부를 본다: 되돌아오면 UT, 통과하면 RT',['UT는 초음파의 반사 신호를 읽는다. RT는 X선·감마선이 시험체를 통과해 만든 영상을 읽는다.']),
 ('힘을 뺐을 때 돌아오면 탄성, 모양이 남으면 소성',['열간·냉간의 기준은 재결정 온도다. 단순히 손으로 만져 뜨거운지가 아니다.', '현미경 사진에서 알갱이가 결정립, 서로 다른 알갱이가 만나는 경계가 결정립계다.'])])

def graph(page,title,sub,crop,tags,footer):
    head(title,sub)
    im=Image.open(f'assets/study/metal-exam-{page}.webp')
    l,t,r,b=crop
    im=im.crop((round(l*im.width/660),round(t*im.height/466),round(r*im.width/660),round(b*im.height/466)))
    scale=min(730/(r-l),350/(b-t)); x=(842-(r-l)*scale)/2; top=447
    c.drawImage(ImageReader(im),x,top-(b-t)*scale,(r-l)*scale,(b-t)*scale)
    def pos(a,z):return x+(a-l)*scale,top-(z-t)*scale
    for label,a,z,u,v in tags:
        px,py=pos(a,z);lx,ly=pos(u,v);w=pdfmetrics.stringWidth(label,'K',13)+12
        sx=min(max(px,lx),lx+w);sy=min(max(py,ly-4),ly+14);angle=math.atan2(py-sy,px-sx)
        c.setStrokeColor('#006C71');c.setLineWidth(1.6);c.line(sx,sy,px,py)
        for sign in (-1,1):c.line(px,py,px-8*math.cos(angle+.43*sign),py-8*math.sin(angle+.43*sign))
        c.setFillColor('#E4F6F3');c.roundRect(lx,ly-4,w,19,3,stroke=0,fill=1);txt(lx+6,ly,label,13,'#00504D')
    txt(40,54,footer,14);txt(40,27,f'그림: 시험 표시 원본 PDF {page}쪽  |  청록색 화살표와 설명만 추가',11,'#506771')
    c.showPage()
graph(51,'03   철-탄소 상태도: 파란 점 세 개부터','가로는 탄소 함량, 세로는 온도다. 같은 강을 식히면 탄소량은 그대로여서 수직으로 내려간다.',
 (20,96,577,436),[('J 포정점',159,143,190,122),('C 공정점',401,223,425,190),('S 공석점',210,316,147,370),('A₂: 자성 변화',113,294,34,260)],'냉각 기준: J는 액체+고체 → 고체, C는 액체 → 두 고체, S는 고체 → 두 고체다.')
notes('04   상태도 보기에서 자주 바뀌는 말','근거: PDF 51~53쪽   |   점 이름과 반응 전 상태를 한 쌍으로 기억한다.',[
 ('C · 공정: 1147℃에서 액체가 두 고체로 갈라진다.',['오스테나이트와 시멘타이트가 함께 생긴 조직이 레데뷰라이트다.']),
 ('S · 공석: 출발 물질은 액체가 아니라 고체다.',['오스테나이트가 페라이트와 시멘타이트로 나뉘어 펄라이트가 된다.', '자료 자체에 두 표기가 있다. 51~52쪽의 A₁은 723℃, 53쪽의 공석반응은 727℃다. 제시된 그림을 따른다.']),
 ('J · 포정: 1495℃에서 액체와 고체가 만나 새 고체가 된다.',['새 고체는 오스테나이트다. 세 반응 중 출발 쪽에 액체와 고체가 함께 있는 것이 포정이다.']),
 ('A₂는 768℃에서 자성이 변한다. A₃와 A₄는 결정 구조가 변한다.',['순철을 가열하면 A₃ 부근(약 910~912℃)에서 α → γ, A₄(1394℃)에서 γ → δ로 바뀐다.', '2.11은 온도가 아니다. 자료에서 강과 주철을 구분하는 탄소 함량(%)이다.'])])
graph(79,'05   일반 열처리: 어디서 식혔는가?','빨간 선은 시간에 따라 온도가 어떻게 바뀌었는지 보여 준다. 같은 출발점에서 갈라지는 길을 따라간다.',
 (125,130,552,414),[('담금질: 급냉',340,315,210,292),('불림: 공냉',375,326,380,366),('풀림: 노냉',412,289,448,280),('뜨임: 다시 가열',357,285,388,213)],'급냉하면 단단하지만 깨지기 쉽다. 담금질 뒤 다시 가열하는 뜨임은 경도를 조금 낮추고 인성을 높인다.')
for n,title,tag,x,y,foot in [
 (84,'마퀜칭','첫 수평: 안팎 온도 맞춤',226,331,'처음 짧게 멈춘 목적은 온도 균일화다. 베이나이트 변태가 끝나기 전에 다시 냉각한다.'),
 (85,'마템퍼링','Ms 아래에서 유지',285,362,'수업자료 기준: Ms 아래 약 100~200℃ 유지 후 공냉. 마르텐사이트와 베이나이트 혼합조직이 단서다.'),
 (86,'오스템퍼링','변태 완료까지 유지',347,331,'베이나이트가 생기는 온도에서 충분히 기다린다. 마퀜칭과 달리 변태 완료가 목적이다.'),
 (87,'오스포밍','냉각 전 가공 구간',218,331,'과냉 오스테나이트에서 소성가공한 뒤 냉각한다. 온도 경로만 보지 말고 지문의 ‘가공’을 함께 찾는다.')]:
    graph(n,'06   항온 경로 읽기  /  '+title,'세로로 내려가면 냉각, 수평으로 오른쪽에 가면 같은 온도에서 시간이 흐른다. 빨간 원래 경로를 따라간다.',
     (145,224,432,431),[(tag,x,y,259,307),('시간 →',319,407,340,424),('급냉',201,285,153,250),
       ('변태 시작선',209,287,209,256),('변태 종료선',239,287,285,264),
       ('Ms: 변태 시작 온도',207,353,146,391)],foot)
notes('07   겉만 단단하게: 무엇을 넣었는가?','근거: PDF 88~95쪽   |   마모를 받는 표면과 충격을 받는 내부의 역할을 나누는 것이 목적이다.',[
 ('침탄은 탄소, 질화는 질소를 표면에 넣는다.',['고체 침탄은 목탄 등과 함께 가열한다. 저렴하지만 균일한 깊이와 탄소량을 맞추기 어렵다.', '가스 침탄은 메탄·프로판 등을 쓴다. 조절과 연속 생산이 쉽지만 가스 안전관리와 설비 비용이 따른다.']),
 ('질화: 낮은 온도에서 질화물을 만들어 단단하게 한다.',['침탄 후 경화와 달리 별도의 담금질이 필요 없고 치수 변화가 작다. 대신 오래 걸리고 경화층이 얇다.']),
 ('금속 침투: 표면에 다른 원소를 확산시켜 합금층을 만든다.',['세라다이징 = 아연(방청), 크로마이징 = 크롬(내식·내마모), 칼로라이징 = 알루미늄(고온 산화 방지).', '보로나이징은 붕소, 실리코나이징은 규소다. 이름과 넣는 원소를 먼저 짝짓는다.']),
 ('원문 연습 88~90쪽: 정답 번호보다 조건을 먼저 본다.',['혼합조직 → 강의 기준 마템퍼링. 과냉 상태에서 소성가공 → 오스포밍.', '균열을 줄이려면 Ms까지 급냉한 뒤 Ms~Mf 구간은 서냉한다. 변태 중 생기는 응력을 줄이기 위해서다.'])])
c.save(); sheets=PdfReader(io.BytesIO(buf.getvalue()));w=PdfWriter()
def add(p,name):
    w.add_page(p);w.add_outline_item(name,len(w.pages)-1)
add(src.pages[0],'추가 계산 | 1 kg과 kcal/h')
for i,(page,title) in enumerate(zip(sheets.pages,titles)):
    add(page,title)
    if i==3:add(old.pages[1],'기존 곡선 해설 | J·S·C 위치 복습 (그림 기준값)')
    if i==4:add(old.pages[6],'기존 곡선 해설 | 일반 열처리 네 경로')
for p in originals:add(p,'시험 원문 PDF '+str(int(p.extract_text().strip().split()[0])+1)+'쪽')
with path.open('wb') as out:w.write(out)
