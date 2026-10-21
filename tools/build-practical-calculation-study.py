"""Compact booklet: shared formula lessons, then consecutive worked questions."""
from pathlib import Path
from collections import OrderedDict
import json
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether, CondPageBreak, Flowable, Table, TableStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage
from pypdf import PdfReader
from practical_algebra_primer import build_algebra_primer

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
    'reference':ParagraphStyle('reference',fontName='Nanum',fontSize=8.5,leading=11,textColor=MUTED,spaceAfter=3,wordWrap='CJK'),
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
def math_box(parts,size=11):
    boxes=[]
    for part in parts:
        if isinstance(part,str):
            value=clean(part)
            chars=[(char,'Math' if char in 'γρηαδλθΔπ' else 'NanumBold') for char in value]
            width=sum(pdfmetrics.stringWidth(char,font,size) for char,font in chars)
            def draw(canvas,x,y,chars=chars,size=size):
                canvas.setFillColor(GREEN)
                for char,font in chars:
                    canvas.setFont(font,size)
                    canvas.drawString(x,y+size*.25,char)
                    x+=pdfmetrics.stringWidth(char,font,size)
            boxes.append((width,size*1.35,draw))
        else:
            top=math_box(part['top'],size*.93)
            bottom=math_box(part['bottom'],size*.93)
            width=max(top[0],bottom[0])+8
            height=top[1]+bottom[1]+10
            def draw(canvas,x,y,top=top,bottom=bottom,width=width):
                bottom[2](canvas,x+(width-bottom[0])/2,y)
                canvas.setStrokeColor(GREEN)
                canvas.setLineWidth(.7)
                canvas.line(x,y+bottom[1]+5,x+width,y+bottom[1]+5)
                top[2](canvas,x+(width-top[0])/2,y+bottom[1]+10)
            boxes.append((width,height,draw))
    width=sum(b[0] for b in boxes)
    height=max((b[1] for b in boxes),default=0)
    def draw(canvas,x,y):
        for w,h,render in boxes:
            render(canvas,x,y+(height-h)/2)
            x+=w
    return width,height,draw

class FractionFormula(Flowable):
    def __init__(self,parts):
        super().__init__()
        self.box=math_box(parts)
        self.spaceBefore=4
        self.spaceAfter=7
    def wrap(self,availWidth,availHeight):
        self.scale=min(1,availWidth/max(1,self.box[0]))
        self.width=self.box[0]*self.scale
        self.height=self.box[1]*self.scale
        return self.width,self.height
    def draw(self):
        self.canv.saveState()
        self.canv.scale(self.scale,self.scale)
        self.box[2](self.canv,0,0)
        self.canv.restoreState()

def fraction_rows(rows,notes=True):
    block=[]
    for row in rows:
        block.append(FractionFormula(row['parts']))
        if notes and row.get('note'): block.append(p(row['note'],'small'))
    return block

def formula_block(item,notes=True):
    rows=item.get('formulaFractions',[])
    return fraction_rows(rows,notes) if rows else [p(item['formula'],'formula')]

def block_height(block):
    return sum(f.wrap(WIDTH-12,H)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in block)

story=[p('공조 필답형 계산 공부\n단위 · 네 공식 · 숫자 고르기','title'),p('CGT·CR·COP·BF 우선 / 분수식과 풀이를 이어 읽는 합본 / '+DATA['date'],'small')]
for item in DATA['basics'][:5]: story.extend(section(item['title'],item['text']))
story.append(PageBreak())
story.append(p('단위와 조건을 읽는 방법','title'))
for item in DATA['basics'][5:]: story.extend(section(item['title'],item['text']))
story.extend(section('숫자가 보여도 전부 대입하지 않습니다','먼저 무엇을 구하는지 정합니다. 그 식에 쓰는 값, 다른 소문항에 쓰는 값, 이번 식에는 필요 없는 값을 구별합니다. “현열”, “진공압”, “산술평균”, “소수점 몇 자리”는 직접 곱하지 않아도 풀이를 결정하는 조건입니다. 불필요한 숫자와 필요한 조건을 같은 것으로 보지 않습니다.'))
story.append(p('분수 읽기 · 위를 아래로 나누세요','head'))
story.extend(fraction_rows(DATA['fractionBasics']))
story.append(PageBreak())
story.extend(build_algebra_primer(p,FractionFormula))
for page_index in range(2):
    story.append(p('먼저 외울 한 줄 공식' if page_index==0 else '함께 알아둘 보충 공식','title'))
    story.append(p('공식 이름 → 한 줄 식 → 기호 뜻 → 짧은 암기법. 같은 글자라도 공식마다 뜻이 다릅니다. 보충 공식은 출제 확정이 아닌 복습용입니다.','small'))
    cells=[]
    for item in DATA['formulaSummary'][page_index*5:(page_index+1)*5]:
        cells.append([p(item['title'],'head'),*formula_block(item,notes=False),
                      p(item['when']),p(item['symbols']),labeled('기억',item['remember'])])
    table=Table([[cells[i],cells[i+1] if i+1<len(cells) else ''] for i in range(0,len(cells),2)],colWidths=[WIDTH/2]*2)
    table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#dce5e8'))]))
    story.append(table)
    story.append(PageBreak())
story.append(p('시험 우선 네 공식','title'))
story.append(p('전달받은 시험범위: 네 유형 중1문제, 경우에 따라2문제. 아래는 공식의 뜻을 이해하는 설명용 예제입니다. 같은 기호·단위 설명은 묶음 앞에서 한 번 읽고 문제에서 적용합니다.','small'))
for family_index,family in enumerate(DATA['examFamilies']):
    if family_index==2: story.append(PageBreak())
    block=[p(family['title'],'head'),*formula_block(family),p(family['when']),
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
        intro=[p(title+' · 공통 공식과 기호','head'),*formula_block(lesson),
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
            question_end=len(block)
            s=l['numberSelection']
            block.append(labeled('쓰는 값',s['used']))
            if s.get('unused'): block.append(labeled('이번 식에는 안 씀',s['unused'],'warning'))
            block.append(labeled('조건·함정',s['condition']))
            block.extend(fraction_rows(l.get('fractions',[])))
            block.append(labeled('계산','\n'.join(l['steps'])))
            if l.get('examAnswer'): block.append(labeled('최종값',l['examAnswer']))
            rounding=l.get('rounding','')
            if rounding and not rounding.startswith('제공된 채점 안내의 기본 조건'): block.append(p(rounding,'small'))
            if l.get('caution'): block.append(labeled('주의',l['caution'],'small'))
            block.append(Spacer(1,9))
            story.extend([CondPageBreak(180),KeepTogether(block[:question_end]),*block[question_end:]])

story.extend([Spacer(1,10),p('근거와 답안 표기','head')])
story.append(p('문항·그림·숫자는 기존 복원·연습 자료를 대조했습니다. 이번 식의 미사용 값도 다른 소문항에는 필요할 수 있습니다. 채점 안내는 사용자 제공 IMG_9883.JPG를 따르며 반올림 예외는 해당 문항 풀이에 표시했습니다.','small'))
for ref in DATA['references']: story.append(p(ref['title']+' / '+ref['url'],'reference'))

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
