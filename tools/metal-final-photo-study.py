"""Build a personal photo-study edition using externally sourced tool photos."""
import io
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

groups = [
 ('금긋기 · 기준 잡기', [
  (4,'금긋기 바늘','뾰족한 금속 바늘로 금속판에 가는 선을 긋는다.'),
  (5,'센터 펀치','끝이 뾰족한 강봉. 드릴이 빗나가지 않도록 구멍 중심에 작은 홈을 낸다.'),
  (6,'컴퍼스','뾰족한 두 다리 사이를 벌려 원과 원호를 긋는다.'),
  (7,'서피스 게이지','무거운 받침에 바늘이 달려 있다. 정반 위에서 밀면 같은 높이의 선이 그어진다.'),
  (8,'V-블록','V자 홈이 둥근 봉을 받친다. 함께 있는 클램프는 봉을 움직이지 않게 한다.'),
  (9,'강철자 · 철자','곧은 눈금자로 길이를 읽거나 직선을 그을 때 기준으로 댄다.'),
  (90,'먹줄통','먹이 묻은 줄을 팽팽히 당겨 튕기면 긴 직선이 남는다.'),
  (10,'추','줄 끝의 추를 매달아 흔들림이 멈추면 수직 방향을 알 수 있다.'),
 ]),
 ('절단 · 다듬질', [
  (15,'판금 가위','가위 모양의 두 날로 얇은 금속판을 자른다.'),
  (16,'정 · 평정','망치로 뒤를 치면 쐐기 모양 날이 들어간다. 사진은 평평한 날의 평정이다.'),
  (17,'쇠톱','활 모양 틀에 가는 톱날을 건다. 얇은 판이나 관에는 촘촘한 날을 고른다.'),
  (170,'줄','줄눈이 금속을 조금씩 깎는다. 평줄은 평면, 둥근 줄은 구멍 안쪽을 다듬는다.'),
  (18,'가스 절단 토치','길게 뻗은 관과 팁이 단서다. 가열한 강에 산소를 보내 절단하는 공구다.'),
  (19,'파이프 커터 · 튜브 커터','관을 물리는 프레임에 둥근 절단 휠과 롤러가 있다.'),
  (20,'볼트 커터','긴 손잡이와 여러 관절을 이용해 굵은 철선이나 볼트를 자른다.'),
  (21,'니퍼','짧고 비스듬히 만나는 날로 가는 철사나 전선을 자른다.'),
 ]),
 ('성형 · 해머', [
  (26,'볼핀 해머','한쪽 끝이 공처럼 둥글다. 리벳이나 금속의 형상을 두드려 다듬는다.'),
  (27,'세팅 해머','평평한 타격면과 쐐기형 반대쪽이 특징이다. 판금 이음매를 정리한다.'),
  (28,'범핑 해머','넓은 타격면으로 판금의 눌린 곳을 펴고 곡면을 다듬는다.'),
  (29,'용접 해머 · 슬래그 해머','한쪽은 뾰족하고 반대쪽은 끌 모양이다. 비드 위의 슬래그를 떼어낸다.'),
  (30,'레이징 해머','판을 골고루 두드려 가장자리를 세우고 접시나 그릇처럼 성형한다.'),
  (31,'연질 해머','플라스틱·우레탄 같은 연질 타격면으로 표면 자국을 줄인다.'),
 ]),
 ('성형 · 집게', [
  (33,'곧은 집게','넓고 납작한 턱이 손잡이 방향으로 곧게 뻗는다. 얇은 판을 잡고 꺾는다.'),
  (34,'굽은 집게','턱이 손잡이에 비스듬히 꺾여 있다. 작업 공간이 좁을 때 편하다.'),
  (35,'콤비네이션 플라이어','한 공구에 잡는 부분과 자르는 날이 있다. 가운데 오목한 턱은 둥근 물체를 물기 쉽다.'),
  (36,'클램프 플라이어','갈라진 ㄷ자 턱으로 겹친 금속을 잠가 용접 전에 위치를 고정한다.'),
  (37,'라운드 노즈 플라이어','주둥이가 둥근 원뿔처럼 끝으로 갈수록 가늘다. 철사 고리를 만든다.'),
  (38,'플랫 노즈 플라이어','턱 안쪽이 평평하다. 얇은 금속이나 철사를 잡고 정밀하게 구부린다.'),
 ]),
 ('성형 · 고정 받침', [
  (40,'굽힘대','긴 직선 모서리를 기준으로 판재를 꺾는다. 사진은 같은 역할의 실물 접기대다.'),
  (41,'판금칼','경사지게 다듬은 긴 모서리를 대고 판을 날카롭게 꺾어 접는다.'),
  (42,'박자목','나무 막대로 판재를 두드려 표면 자국을 줄이면서 굽히거나 접는다.'),
  (43,'판금정','납작한 끝을 굽힘선이나 이음에 대고 두드리는 공구다.'),
  (45,'바이스','작업대에 고정된 두 턱 사이에 재료를 넣고 손잡이를 돌려 물린다.'),
  (46,'C-클램프','C자 프레임의 끝에 달린 나사로 판을 눌러 잠깐 고정한다.'),
  (48,'제관용 구멍 정반','두꺼운 판의 여러 구멍에 핀이나 지그를 꽂아 재료를 받치고 고정한다. 사진은 구멍 작업대 실물 예다.'),
  (49,'스웨이지 블록','다양한 형태의 구멍과 홈에 재료를 대고 두드려 성형한다.'),
  (51,'턴버클','양쪽 나사 방향이 반대다. 가운데 몸통을 돌리면 길이와 장력이 함께 조절된다.'),
 ]),
 ('측정 · 길이, 높이, 두께', [
  (57,'버니어 캘리퍼스','큰 턱은 외경, 작은 턱은 내경, 뒤로 나오는 봉은 깊이를 잰다.'),
  (59,'외측 마이크로미터','C자 프레임 안에 물체를 대고 회전통을 돌려 작은 두께나 외경을 잰다.'),
  (61,'하이트 게이지','받침을 평평한 정반에 놓고 세로 눈금과 바늘로 높이를 읽거나 표시한다.'),
  (75,'줄자','몸통에서 휘어지는 긴 눈금 띠를 뽑아 잰다. 세부 눈금은 정면에서 읽는다.'),
  (84,'마그네틱 베이스','스위치로 자석이 붙고 떨어진다. 측정기나 지그를 철판 위에 고정한다.'),
 ]),
 ('리벳 · 정렬, 받침, 성형', [
  (62,'드리프트','가는 쪽부터 굵어지는 강봉을 어긋난 판의 구멍에 넣어 중심을 맞춘다.'),
  (63,'손받침대','손으로 대는 리벳 받침. 타격 반대편을 받친다. 사진은 같은 역할의 버킹 바 예다.'),
  (64,'지지받침대','아래 받침과 조절 나사로 높이를 맞춘 뒤 리벳 머리를 아래서 지지한다.'),
  (65,'본받침대','오목한 홈으로 기존 리벳 머리를 받친다. 사진은 반구형 홈의 실물 예다.'),
  (66,'리베팅 스냅','반구형 홈을 리벳 꼬리에 대고 타격해 새 둥근 머리를 만든다.'),
  (67,'코킹정','이음 가장자리를 눌러 틈을 줄이는 정이다. 새 리벳 머리를 만드는 도구와 구별한다.'),
  (69,'수동 리벳건','손잡이를 오므리면 맨드릴이 당겨져 뒤쪽 리벳 몸체가 벌어진다.'),
  (690,'충전식 리벳건','손잡이를 여러 번 조이는 대신 모터로 맨드릴을 당긴다.'),
  (70,'블라인드 리벳','짧은 몸체 가운데로 긴 맨드릴이 지나간다. 한쪽 면에서만 작업할 때 쓴다.'),
 ]),
 ('배관 · 체결 · 청소', [
  (71,'동관 밴딩기','둥근 형틀의 홈을 따라 동관을 레버로 굽힌다.'),
  (72,'플레어링툴','클램프가 관을 잡고 원뿔이 관 끝을 나팔 모양으로 벌린다.'),
  (76,'파이프 렌치','톱니 턱이 둥근 강관을 강하게 문다. 턱이 매끈한 몽키 스패너와 구별한다.'),
  (77,'오스터 · 수동 관 나사절삭기','다이 헤드로 강관 바깥을 깎아 수나사를 낸다.'),
  (78,'몽키 스패너','웜 나사로 평평한 턱 간격을 조정해 볼트나 너트를 잡는다.'),
  (81,'바이스 플라이어','뒷나사로 조절하고 손잡이를 닫으면 턱이 잠겨 계속 물고 있다.'),
  (83,'와이어 브러시','금속 솔이 녹이나 용접 후 표면 찌꺼기를 긁어낸다.'),
 ]),
]


def make(photos, output):
    sources=json.loads((photos/'sources.json').read_text())
    pdfmetrics.registerFont(TTFont('K','/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
    out=io.BytesIO(); c=Canvas(out,pagesize=(842,595)); anchors=[]
    def txt(x,y,s,size=13,color='#213343'):
        c.setFont('K',size);c.setFillColor(color);c.drawString(x,y,s)
    def wrap(x,y,s,width):
        row=''
        for word in s.split():
            candidate=(row+' '+word).strip()
            if row and pdfmetrics.stringWidth(candidate,'K',12)>width:
                txt(x,y,row,12);y-=15;row=word
            else:row=candidate
        if row:txt(x,y,row,12)
        return y
    for title, items in groups:
        for page in range(0,len(items),6):
            part=items[page:page+6]; name=f'{title} ({page//6+1}/{(len(items)+5)//6})'
            anchors.append(name)
            txt(40,550,'제관공학   /   사진으로 구분하는 수공구',13,'#08746D')
            txt(40,512,name,26)
            for idx,(key,label,detail) in enumerate(part):
                x=40+255*(idx%3); y=478-222*(idx//3)
                txt(x,y,label,17,'#08746D')
                info=sources.get(str(key))
                if info:
                    image_path=photos/f'{key}.jpg'
                    with Image.open(image_path) as im:w,h=im.size
                    scale=min(225/w,133/h)
                    c.drawImage(ImageReader(str(image_path)),x+(225-w*scale)/2,y-145+(133-h*scale)/2,w*scale,h*scale)
                    domain=urlsplit(info['page']).hostname.removeprefix('www.')
                    credit=info.get('credit',domain)
                    txt(x,y-159,credit[:39]+' ↗',9,'#08746D')
                    c.linkURL(info['page'],(x,y-162,x+201,y-146))
                    if info.get('license'):
                        c.linkURL(info['license'],(x+201,y-162,x+225,y-146))
                        txt(x+202,y-159,'CC',9,'#08746D')
                else:
                    txt(x+12,y-86,'같은 형태의 실물 사진 미확인',13,'#62777D')
                end=wrap(x,y-179,detail,231)
                assert end >= y-211, label
            c.showPage()
    c.save()
    pages=PdfReader(io.BytesIO(out.getvalue()))
    original=PdfReader('output/pdf/metal-marked-final.pdf')
    w=PdfWriter()
    def section(pages, labels):
        for p,label in zip(pages,labels,strict=True):
            w.add_page(p);w.add_outline_item(label,len(w.pages)-1)
    orig_labels=[node.title for node in original.outline]
    section(original.pages[:11], orig_labels[:11])
    section(pages.pages,anchors)
    section(original.pages[11:],orig_labels[11:])
    with output.open('wb') as f:w.write(f)
    print(f'{len(w.pages)} pages, {len(anchors)} photo pages, {len(sources)} sources')


if __name__=='__main__':
    make(Path(sys.argv[1]),Path(sys.argv[2]))
