"""Compact booklet: shared formula lessons, then consecutive worked questions."""
from pathlib import Path
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
from practical_formula_families import CHAPTERS, CARD_LESSONS
from practical_pdf_solutions import NOTES, REARRANGE

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
    'questionLabel':ParagraphStyle('questionLabel',fontName='NanumBold',fontSize=11,leading=16,textColor=HexColor('#183e68'),spaceAfter=4,wordWrap='CJK',keepWithNext=True),
    'solutionLabel':ParagraphStyle('solutionLabel',fontName='NanumBold',fontSize=11,leading=16,textColor=HexColor('#14543d'),spaceBefore=7,spaceAfter=4,wordWrap='CJK',keepWithNext=True),
    'calculation':ParagraphStyle('calculation',fontName='Nanum',fontSize=11,leading=15.5,textColor=INK,spaceAfter=5,wordWrap='CJK',keepWithNext=True),
    'answer':ParagraphStyle('answer',fontName='NanumBold',fontSize=11,leading=16,textColor=GREEN,backColor=HexColor('#edf6f3'),borderPadding=4,spaceBefore=3,spaceAfter=8,wordWrap='CJK'),
}

# Editorial corrections are confined to this study PDF. Bank data stays intact.
STEP_EDITS = {
    '시간당으로: 1.87519×3,600=약 6,750.68 m³/h. 약 6,751 m³/h이며 기존 답안 약 6,750은 거칠게 반올림한 값입니다.':
        '시간당으로: (25÷13.332)×3,600=6,750.68 m³/h. 중간값은 반올림하지 않고 계산합니다.',
    '460×101.325÷760=61.327… kPa, 약 61.3 kPa.':
        '460×101.325÷760=61.328289… kPa → 61.33 kPa.',
    '380×101.325÷760=50.6625 kPa, 약 50.7 kPa.':
        '380×101.325÷760=50.6625 kPa → 50.66 kPa.',
    'N₂=800×(2÷1.5)=1,066.67 rpm, 약 1,067 rpm.':
        'N₂=800×(2÷1.5)=1,066.666… rpm → 1,066.67 rpm.',
    'SHF=8.3÷11.1=0.747747… → 약 0.748 또는 0.75.':
        'SHF=8.3÷11.1=0.747747… → 0.75(단위 없음).',
}

def clean(text):
    for a,b in zip('₀₁₂₃₄₅₆₇₈₉','0123456789'): text=text.replace(a,b)
    for i,a in enumerate('①②③④⑤⑥⑦⑧⑨',1): text=text.replace(a,f'({i})')
    return text.replace('⁻⁵','^(-5)').replace('−','-').replace('℃','°C')

def markup(text,style):
    value=clean(text)
    font=pdfmetrics.getFont(styles[style].fontName)
    greek='γρηαδλθΔπτ'
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
            chars=[(char,'Math' if char in 'γρηαδλθΔπτ' else 'NanumBold') for char in value]
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

class ReadingPhase(Flowable):
    """Remember which question/solution continues onto the next page."""
    width=height=0
    keepWithNext=True
    def __init__(self,label):
        super().__init__()
        self.label=label
    def draw(self):
        self.canv._reading_phase=self.label
        self.canv._phase_fresh=True

class StudyDocument(SimpleDocTemplate):
    def afterFlowable(self,flowable):
        if getattr(flowable,'bookmark_key',None):
            self.canv.bookmarkPage(flowable.bookmark_key)
            self.canv.addOutlineEntry(flowable.bookmark_title,flowable.bookmark_key,0,False)
        if isinstance(flowable,(Paragraph,Table,FractionFormula,Image)) and not getattr(self.canv,'_phase_seen',False):
            self.canv._page_phase=getattr(self.canv,'_reading_phase','')
            self.canv._page_continued=not getattr(self.canv,'_phase_fresh',False)
            self.canv._phase_seen=True
    def afterPage(self):
        page_end(self.canv,self)

story=[p('공조 필답형 계산 공부\n단위 · 식 바꾸기 · 유형별 풀이','title'),p('SI → 식 읽기·바꾸기 → 유형별 36문제 / 2026-10-23 개정','small')]
for item in DATA['basics'][:5]: story.extend(section(item['title'],item['text']))
story.append(p('먼저 외울 공식 · 이름을 누르면 해당 묶음으로','head'))
quick_keys=['cgt','cr','cop','bf','affinity','pump','circulation','air','transfer','shf']
quick_formulas={
    'cgt':['Q = G × c × Δt'], 'cr':['Q = G × r'],
    'cop':['COP = ',{'top':['Qe'],'bottom':['L']}],
    'bf':['BF = ',{'top':['t출구 - t코일'],'bottom':['t입구 - t코일']}],
    'affinity':['유량 a · 양정 a² · 동력 a³'],
    'pump':['L = ',{'top':['γ × Q × H'],'bottom':['1,000 × η']}],
    'circulation':['G = ',{'top':['Qe'],'bottom':['Δh']}],
    'air':['V = ',{'top':['Q현열'],'bottom':['ρ × c × Δt']}],
    'transfer':['Q = K × A × Δt'],
    'shf':['SHF = ',{'top':['현열'],'bottom':['현열 + 잠열']}],
}
quick_cells=[]
for key in quick_keys:
    item=next(item for item in DATA['formulaSummary'] if item['key']==key)
    chapter_index=next(i for i,ch in enumerate(CHAPTERS,1) if key in ch['cards'])
    label={'cgt':'CGT · 현열','cr':'CR · 잠열','cop':'COP','bf':'BF',
           'affinity':'상사법칙\n회전수 a배','pump':'펌프 축동력',
           'circulation':'냉매순환량','air':'공기 송풍량','transfer':'열관류','shf':'현열비 SHF'}[key]
    link=Paragraph(f'<link href="#chapter-{chapter_index}">{markup(label,"small")}</link>',styles['small'])
    cell=Table([[link,FractionFormula(quick_formulas[key])]],colWidths=[78,WIDTH/2-92])
    cell.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    quick_cells.append(cell)
quick_table=Table([[quick_cells[i],quick_cells[i+1]] for i in range(0,10,2)],colWidths=[WIDTH/2]*2)
quick_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2),('LINEBELOW',(0,0),(-1,-1),.3,HexColor('#dce5e8'))]))
story.append(quick_table)
story.append(PageBreak())
story.append(p('단위와 조건을 읽는 방법','title'))
for item in DATA['basics'][5:]:
    text=item['text']
    if item['title']=='반올림과 시험 답안 쓰기':
        text='제공된 채점 안내는 기본적으로 소수 셋째 자리에서 반올림하여 둘째 자리까지 씁니다. 61.328289…는 셋째 숫자 8을 보고 61.33으로 씁니다. “셋째 자리까지”라면 넷째 숫자 2를 보고 61.328입니다. 개별 문제의 조건이 우선이며 중간값은 유지하고 최종 답만 반올림합니다. 계산과정과 단위도 씁니다.'
    story.extend(section(item['title'],text))
story.extend(section('숫자가 보여도 전부 대입하지 않습니다','먼저 무엇을 구하는지 정합니다. 그 식에 쓰는 값, 다른 소문항에 쓰는 값, 이번 식에는 필요 없는 값을 구별합니다. “현열”, “진공압”, “산술평균”, “소수점 몇 자리”는 직접 곱하지 않아도 풀이를 결정하는 조건입니다. 불필요한 숫자와 필요한 조건을 같은 것으로 보지 않습니다.'))
story.append(p('분수 읽기 · 위를 아래로 나누세요','head'))
story.extend(fraction_rows(DATA['fractionBasics']))
story.append(PageBreak())
story.extend(build_algebra_primer(p,FractionFormula))
groups={}
for row in DATA['rows']:
    lesson=row['lesson']
    groups.setdefault(lesson['title'],[]).append(row)
chapter_lessons=[name for chapter in CHAPTERS for name in chapter['lessons']]
assert len(chapter_lessons)==len(set(chapter_lessons))
assert set(chapter_lessons)==set(groups), (set(chapter_lessons)^set(groups))
summary_by_key={item['key']:item for item in DATA['formulaSummary']}
assert {key for chapter in CHAPTERS for key in chapter['cards']}==set(summary_by_key)

# Keep formulas near the related questions rather than repeating them in
# separate summary, priority, and supplementary sections.
def chapter_guide(chapter, chapter_index):
    content=[p(chapter['hint'])]
    cards=[]
    for key in chapter['cards']:
        item=summary_by_key[key]
        cards.append([p(item['title'],'head'),*formula_block(item,notes=False),
                      p(item['symbols'],'small'),p(item['remember'],'small')])
    if cards:
        columns=3 if len(cards)==3 else 2
        table=Table([[cards[i+j] if i+j<len(cards) else '' for j in range(columns)] for i in range(0,len(cards),columns)],colWidths=[WIDTH/columns]*columns)
        table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#dce5e8'))]))
        content.append(table)
    assert len(REARRANGE[chapter_index-1])==len(chapter['changes'])
    for (title,explanation,equations),short in zip(chapter['changes'], REARRANGE[chapter_index-1]):
        block=[labeled(title+' ·',short)]
        # Side-by-side fraction rows share one baseline when they fit.
        if equations:
            combined=[]
            for equation in equations:
                combined.extend((['    ;    '] if combined else [])+equation)
            if math_box(combined)[0]<=WIDTH:
                block.append(FractionFormula(combined))
            else:
                block.extend(FractionFormula(equation) for equation in equations)
        content.append(KeepTogether(block))
    return content

question_headings=[]
number=0
for chapter_index,chapter in enumerate(CHAPTERS,1):
    story.append(ReadingPhase(''))
    if chapter_index>1: story.append(CondPageBreak(330))
    chapter_heading=p(f'{chapter_index:02d} · '+chapter['title'],'title')
    chapter_heading.bookmark_key=f'chapter-{chapter_index}'
    chapter_heading.bookmark_title=chapter['title']
    story.append(chapter_heading)
    if chapter_index==1:
        story.append(p('파란 상자=문제 / 초록 제목=해설. “시험 우선”13개도 유형별로 함께 배치했습니다. 기본 반올림은 최종값 둘째 자리이며 문제의 별도 조건이 우선입니다.','small'))
    story.extend(chapter_guide(chapter,chapter_index))
    for title in chapter['lessons']:
        rows=groups[title]
        lesson=rows[0]['lesson']
        intro=[p(title,'head')]
        if not all(r['prompt']['id'] in NOTES for r in rows):
            intro.append(labeled('왜 이 계산?',lesson['why']))
        if title not in CARD_LESSONS:
            intro.extend([*formula_block(lesson,notes=False),labeled('기호',' / '.join(lesson['symbols']),'small')])
        intro.append(labeled('단위',' '.join(lesson['units']),'small'))
        story.append(CondPageBreak(block_height(intro)+120))
        story.append(ReadingPhase(''))
        story.append(KeepTogether(intro))
        for row in rows:
            number+=1
            q,l=row['prompt'],row['lesson']
            source=row['sourceLabel']
            heading=f'{number:02d}. {source}'
            question_headings.append(heading)
            priority_label=' · 시험 우선' if row['examFamilies'] else ''
            block=[p(f'문제 {number:02d} | {source}{priority_label}','questionLabel'),p(q['question'])]
            for asset in ([q['image']] if q.get('image') else [])+q.get('images',[]):
                path=ROOT/asset
                if path.suffix.lower()=='.svg': path=ROOT/'tmp/pdfs'/f'{path.stem}.png'
                with PILImage.open(path) as im: iw,ih=im.size
                diagram_height=125 if q['id']=='hvac-practical-restored-2024-2-10' else 155
                scale=min((WIDTH-20)/iw,diagram_height/ih)
                image=Image(str(path),width=iw*scale,height=ih*scale)
                image.hAlign='CENTER'
                block.extend([image,Spacer(1,7)])
            question_panel=Table([[block]],colWidths=[WIDTH])
            question_panel.setStyle(TableStyle([
                ('BACKGROUND',(0,0),(-1,-1),HexColor('#edf3fb')),
                ('BOX',(0,0),(-1,-1),.7,HexColor('#688bb2')),
                ('LINEBEFORE',(0,0),(0,-1),3,HexColor('#315f91')),
                ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
                ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
            ]))
            block=[ReadingPhase(f'해설 {number:02d} | {source}'),p(f'해설 {number:02d} | 풀이','solutionLabel')]
            s=l['numberSelection']
            if s.get('unused'): block.append(labeled('이번 식에는 안 씀',s['unused'],'warning'))
            short_notes=NOTES.get(q['id'])
            if not short_notes: block.append(labeled('판단',s['condition']))
            # Fractions show the final substitution; the preceding short steps
            # explain the intermediate quantities before that substitution.
            for step in short_notes or l['steps']:
                block.append(p(STEP_EDITS.get(step,step),'calculation'))
            substitution=fraction_rows(l.get('fractions',[]),notes=False)
            for equation in substitution[:-1]: equation.keepWithNext=True
            block.extend(substitution)
            if l.get('examAnswer'): block.append(labeled('답',l['examAnswer'],'answer'))
            rounding=l.get('rounding','')
            if rounding and not rounding.startswith('제공된 채점 안내의 기본 조건'): block.append(p(rounding,'small'))
            caution=l.get('caution','')
            if '문항 ID의 09' in caution:
                caution='교재의 개별 조건: 절대습도는 소수점 셋째 자리까지. 0.0042 → 0.004입니다.'
            if caution: block.append(labeled('주의',caution,'small'))
            block.append(Spacer(1,4))
            pair=[ReadingPhase(f'문제 {number:02d} | {source}'),question_panel,*block]
            # Short questions and their complete answer travel together. Longer
            # ones may split, but the question is not orphaned at a page foot.
            if block_height([question_panel,*block])<=350 or q['id']=='hvac-practical-restored-2024-2-10':
                story.append(KeepTogether(pair))
            else:
                story.extend([CondPageBreak(block_height([question_panel])+125),*pair])

story.extend([ReadingPhase(''),Spacer(1,4),p('근거: 기존 복원·연습 자료와 사용자 제공 채점 안내를 대조했습니다. 반올림 예외는 각 문항에 표시하며, 이번 식의 미사용 값도 다른 소문항에는 필요할 수 있습니다.','reference')])
reference_links=['<link color="#315f91" href="'+escape(ref['url'],quote=True)+'">'+markup(ref['title'],'reference')+'</link>' for ref in DATA['references']]
story.append(Paragraph('원문 열기: '+' / '.join(reference_links),styles['reference']))

def footer(canvas,doc):
    canvas._phase_seen=False
    canvas._page_phase=''
    canvas._phase_fresh=False
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#dce5e8'))
    canvas.line(MARGIN,34,W-MARGIN,34)
    canvas.setFont('Nanum',8)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN,21,'공조 계산 공부 / 공식 → 숫자 선택 → 풀이 → 단위')
    canvas.drawRightString(W-MARGIN,21,str(doc.page))
    canvas.restoreState()

def page_end(canvas,doc):
    label=getattr(canvas,'_page_phase','')
    if label.startswith('해설') and getattr(canvas,'_page_continued',False):
        canvas.saveState()
        canvas.setFont('NanumBold',8.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN,H-22,label+(' · 해설 계속' if getattr(canvas,'_page_continued',False) else ''))
        canvas.restoreState()

StudyDocument(str(OUT),pagesize=A4,rightMargin=MARGIN,leftMargin=MARGIN,topMargin=35,bottomMargin=47,
              title='공조 필답형 계산 공부 - 공식·함정·풀이 합본',author='CBT 학습 자료').build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(str(OUT))
text=''.join(''.join((page.extract_text() or '').split()) for page in reader.pages)
assert number==len(DATA['rows'])==36
assert set(NOTES)<=set(row['prompt']['id'] for row in DATA['rows'])
for i,heading in enumerate(question_headings,1):
    assert ''.join(clean(f'문제 {i:02d} | {heading.split(". ",1)[1]}').split()) in text,heading
    assert ''.join(f'해설 {i:02d}'.split()) in text
for needle in ['1,821','잠열10','높이3','동력10','난방부하','소수점']:
    assert needle in text,needle
assert 'SI' in (reader.pages[0].extract_text() or '')
assert len(reader.outline)==7
assert sum(bool(row['examFamilies']) for row in DATA['rows'])==13
for row in DATA['rows']:
    assert ''.join(clean(row['prompt']['question']).split()) in text, row['id']
    if row['lesson'].get('examAnswer'):
        assert ''.join(clean(row['lesson']['examAnswer']).split()) in text, row['id']
# Do not silently add a near-empty final page for a single reference line.
assert len(''.join((reader.pages[-1].extract_text() or '').split()))>250
print(json.dumps({'output':str(OUT),'pages':len(reader.pages),'questions':number,'bytes':OUT.stat().st_size,'unusedValueNotes':sum(bool(r['lesson']['numberSelection'].get('unused')) for r in DATA['rows'])},ensure_ascii=False))
