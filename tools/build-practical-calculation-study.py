"""Compact booklet: shared formula lessons, then consecutive worked questions."""
from pathlib import Path
from collections import OrderedDict
import json
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether, CondPageBreak
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'tmp/pdfs/practical-calculation-study.json').read_text())
OUT=ROOT/'output/pdf/hvac-practical-calculation-study.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('Nanum',str(ROOT/'assets/fonts/NanumGothic-Regular.ttf')))
pdfmetrics.registerFont(TTFont('NanumBold',str(ROOT/'assets/fonts/NanumGothic-Bold.ttf')))
pdfmetrics.registerFont(TTFont('Math',str(ROOT/'node_modules/katex/dist/fonts/KaTeX_Math-Italic.ttf')))
W,H=A4
MARGIN=39
WIDTH=W-2*MARGIN
INK,GREEN,MUTED=map(HexColor,['#1d3042','#14715e','#536878'])
styles={
    'title':ParagraphStyle('title',fontName='NanumBold',fontSize=18,leading=25,textColor=INK,spaceAfter=10,wordWrap='CJK',keepWithNext=True),
    'head':ParagraphStyle('head',fontName='NanumBold',fontSize=12,leading=18,textColor=GREEN,spaceBefore=8,spaceAfter=4,wordWrap='CJK',keepWithNext=True),
    'body':ParagraphStyle('body',fontName='Nanum',fontSize=11,leading=15.5,textColor=INK,spaceAfter=5,wordWrap='CJK'),
    'small':ParagraphStyle('small',fontName='Nanum',fontSize=9,leading=13,textColor=MUTED,spaceAfter=4,wordWrap='CJK'),
    'formula':ParagraphStyle('formula',fontName='NanumBold',fontSize=12,leading=19,textColor=GREEN,backColor=HexColor('#edf6f3'),borderPadding=7,spaceBefore=6,spaceAfter=10,wordWrap='CJK'),
    'warning':ParagraphStyle('warning',fontName='Nanum',fontSize=11,leading=15.5,textColor=INK,backColor=HexColor('#fff4df'),borderPadding=6,spaceBefore=6,spaceAfter=9,wordWrap='CJK'),
}

def clean(text):
    for a,b in zip('₀₁₂₃₄₅₆₇₈₉','0123456789'): text=text.replace(a,b)
    for i,a in enumerate('①②③④⑤⑥⑦⑧⑨',1): text=text.replace(a,f'({i})')
    return text.replace('⁻⁵','^(-5)').replace('−','-').replace('℃','°C')

def markup(text,style):
    value=clean(text)
    font=pdfmetrics.getFont(styles[style].fontName)
    greek='γρηαδλθΔπ'
    missing={c for c in value if not c.isspace() and ord(c) not in font.face.charToGlyph and c not in greek}
    if missing: raise ValueError(f'Unsupported glyphs: {missing}')
    return ''.join(f'<font name="Math">{c}</font>' if c in greek else escape(c) for c in value).replace('\n','<br/>')

def p(text,style='body'): return Paragraph(markup(text,style),styles[style])
def labeled(label,text,style='body'):
    return Paragraph('<b>'+markup(label,style)+'</b> '+markup(text,style),styles[style])
def section(title,text): return [p(title,'head'),p(text)]
def block_height(block):
    return sum(f.wrap(WIDTH-12,H)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in block)

story=[p('공조 필답형 계산 공부\n단위 · 네 공식 · 숫자 고르기','title'),p('CGT·CR·COP·BF 우선 / 문제와 풀이를 이어 읽는 합본 / 2026-10-19','small')]
for item in DATA['basics'][:5]: story.extend(section(item['title'],item['text']))
story.append(PageBreak())
story.append(p('단위와 조건을 읽는 방법','title'))
for item in DATA['basics'][5:]: story.extend(section(item['title'],item['text']))
story.extend(section('숫자가 보여도 전부 대입하지 않습니다','먼저 무엇을 구하는지 정합니다. 그 식에 쓰는 값, 다른 소문항에 쓰는 값, 이번 식에는 필요 없는 값을 구별합니다. “현열”, “진공압”, “산술평균”, “소수점 몇 자리”는 직접 곱하지 않아도 풀이를 결정하는 조건입니다. 불필요한 숫자와 필요한 조건을 같은 것으로 보지 않습니다.'))
story.append(PageBreak())
for page_index in range(2):
    story.append(p('먼저 외울 한 줄 공식' if page_index==0 else '함께 알아둘 보충 공식','title'))
    story.append(p('공식 이름 → 한 줄 식 → 기호 뜻 → 짧은 암기법. 같은 글자라도 공식마다 뜻이 다릅니다. 보충 공식은 출제 확정이 아닌 복습용입니다.','small'))
    for item in DATA['formulaSummary'][page_index*5:(page_index+1)*5]:
        story.append(KeepTogether([p(item['title'],'head'),p(item['formula'],'formula'),
                                  p(item['when']),p(item['symbols']),labeled('기억',item['remember'])]))
    story.append(PageBreak())
story.append(p('시험 우선 네 공식','title'))
story.append(p('전달받은 시험범위: 네 유형 중1문제, 경우에 따라2문제. 아래는 공식의 뜻을 이해하는 설명용 예제입니다. 같은 기호·단위 설명은 묶음 앞에서 한 번 읽고 문제에서 적용합니다.','small'))
for family_index,family in enumerate(DATA['examFamilies']):
    if family_index==2: story.append(PageBreak())
    block=[p(family['title'],'head'),p(family['formula'],'formula'),p(family['when']),
           labeled('기호',family['symbols']),labeled('예제',family['example']),
           labeled('단위',family['units']),labeled('기억',family['remember'])]
    story.append(KeepTogether(block))

groups=OrderedDict()
for row in DATA['rows']:
    lesson=row['lesson']
    key=(bool(row['examFamilies']),lesson['title'],lesson['formula'])
    groups.setdefault(key,[]).append(row)

question_headings=[]
number=0
for priority in (True,False):
    story.append(PageBreak())
    story.append(p('시험 우선 13문제' if priority else '보충 계산 23문제','title'))
    story.append(p('같은 공식은 함께 설명하고 문제별 숫자·조건·계산은 바로 아래에 붙였습니다. 기본 반올림은 최종값 둘째 자리, 개별 요구가 있으면 그 조건이 우선입니다.','small'))
    for (is_priority,title,formula),rows in groups.items():
        if is_priority!=priority: continue
        lesson=rows[0]['lesson']
        intro=[p(title+' · 공통 공식과 기호','head'),p(formula,'formula'),
               labeled('기호',' / '.join(lesson['symbols'])),labeled('원리',lesson['why']),
               labeled('단위',' '.join(lesson['units'])),labeled('기억',lesson['memory'])]
        story.append(CondPageBreak(180))
        story.append(KeepTogether(intro))
        for row in rows:
            number+=1
            q,l=row['prompt'],row['lesson']
            source=row['sourceLabel']
            heading=f'{number:02d}. {source}'
            question_headings.append(heading)
            block=[p(heading,'head'),p(q['question'])]
            for asset in ([q['image']] if q.get('image') else [])+q.get('images',[]):
                path=ROOT/asset
                if path.suffix.lower()=='.svg': path=ROOT/'tmp/pdfs'/f'{path.stem}.png'
                with PILImage.open(path) as im: iw,ih=im.size
                scale=min(WIDTH/iw,155/ih)
                image=Image(str(path),width=iw*scale,height=ih*scale)
                image.hAlign='CENTER'
                block.extend([image,Spacer(1,7)])
            s=l['numberSelection']
            block.append(labeled('쓰는 값',s['used']))
            if s.get('unused'): block.append(labeled('이번 식에는 안 씀',s['unused'],'warning'))
            block.append(labeled('조건·함정',s['condition']))
            block.append(labeled('계산','\n'.join(l['steps'])))
            if l.get('examAnswer'): block.append(labeled('최종값',l['examAnswer']))
            rounding=l.get('rounding','')
            if rounding and not rounding.startswith('제공된 채점 안내의 기본 조건'): block.append(p(rounding,'small'))
            if l.get('caution'): block.append(labeled('주의',l['caution'],'small'))
            block.append(Spacer(1,9))
            if block_height(block)<H-104: story.append(KeepTogether(block))
            else: story.extend([CondPageBreak(180),*block])

story.extend([Spacer(1,10),p('근거와 답안 표기','head')])
story.append(p('문항과 그림은 기존 문제은행의 사용자 제공 복원·연습 자료를 따릅니다. 숫자 선택은 지문과 관련 그림을 대조해 추가했습니다. 이번 식에 안 쓰는 값도 다른 소문항에서는 쓰일 수 있습니다.','small'))
for ref in DATA['references']: story.append(p(ref['title']+' / '+ref['url'],'small'))
story.append(p('사용자 제공 IMG_9883.JPG의 채점 안내: 계산과정·단위 기재, 기본 셋째 자리에서 반올림하여 둘째 자리, 개별 요구 우선. 2024년1회 책411쪽8번은 습도 셋째 자리. 2024년3회 책423쪽7번은 계산값0.00625를 답0.01로 표기합니다.','small'))

def footer(canvas,doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#dce5e8'))
    canvas.line(MARGIN,34,W-MARGIN,34)
    canvas.setFont('Nanum',8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN,21,'공조 계산 공부 / 공식 → 숫자 선택 → 풀이 → 단위')
    canvas.drawRightString(W-MARGIN,21,str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=MARGIN,leftMargin=MARGIN,topMargin=35,bottomMargin=47,
                  title='공조 필답형 계산 공부 - 공식·함정·풀이 합본',author='CBT 학습 자료').build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(str(OUT))
text=''.join(''.join((page.extract_text() or '').split()) for page in reader.pages)
assert number==len(DATA['rows'])==36
for heading in question_headings: assert ''.join(clean(heading).split()) in text,heading
for needle in ['1,821','잠열10','높이3','동력10','난방부하','소수점']:
    assert needle in text,needle
assert 'SI' in (reader.pages[0].extract_text() or '')
print(json.dumps({'output':str(OUT),'pages':len(reader.pages),'questions':number,'bytes':OUT.stat().st_size,'unusedValueNotes':sum(bool(r['lesson']['numberSelection'].get('unused')) for r in DATA['rows'])},ensure_ascii=False))
