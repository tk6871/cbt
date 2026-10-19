"""Build the beginner booklet from the same reviewed lessons used by Vue.

First bundle/run export-practical-calculation-study.ts. Source assets are read
without modification. A4 pages use embedded Korean fonts and plain math symbols.
"""
from pathlib import Path
import json
import re
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'tmp/pdfs/practical-calculation-study.json').read_text())
OUT = ROOT / 'output/pdf/hvac-practical-calculation-study.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Nanum', str(ROOT / 'assets/fonts/NanumGothic-Regular.ttf')))
pdfmetrics.registerFont(TTFont('NanumBold', str(ROOT / 'assets/fonts/NanumGothic-Bold.ttf')))
pdfmetrics.registerFont(TTFont('Math', str(ROOT / 'node_modules/katex/dist/fonts/KaTeX_Math-Italic.ttf')))
W,H = A4
INK, GREEN, MUTED = map(HexColor, ['#1d3042','#14715e','#536878'])
styles = {
    'title': ParagraphStyle('title', fontName='NanumBold', fontSize=19, leading=26, textColor=INK, spaceAfter=12, wordWrap='CJK'),
    'head': ParagraphStyle('head', fontName='NanumBold', fontSize=12, leading=18, textColor=GREEN, spaceBefore=9, spaceAfter=4, keepWithNext=True, wordWrap='CJK'),
    'body': ParagraphStyle('body', fontName='Nanum', fontSize=11, leading=16.5, textColor=INK, spaceAfter=5, wordWrap='CJK'),
    'small': ParagraphStyle('small', fontName='Nanum', fontSize=9, leading=14, textColor=MUTED, spaceAfter=6, wordWrap='CJK'),
    'index': ParagraphStyle('index', fontName='Nanum', fontSize=9, leading=14, textColor=INK, spaceAfter=2, wordWrap='CJK'),
    'formula': ParagraphStyle('formula', fontName='NanumBold', fontSize=13, leading=22, textColor=GREEN, backColor=HexColor('#edf6f3'), borderPadding=9, spaceBefore=8, spaceAfter=12, wordWrap='CJK'),
}

def clean(text):
    # Nanum has no subscript digits or circled numerals; use readable equivalents.
    for a,b in zip('₀₁₂₃₄₅₆₇₈₉','0123456789'): text = text.replace(a,b)
    for i,a in enumerate('①②③④⑤⑥⑦⑧⑨',1): text = text.replace(a,f'({i})')
    return text.replace('⁻⁵','^(-5)').replace('−','-').replace('℃','°C')

def p(text, style='body'):
    value = clean(text)
    # Fail before publication if a new symbol cannot be rendered by the embedded font.
    font = pdfmetrics.getFont(styles[style].fontName)
    greek='γρηαδλθΔπ'
    missing = {c for c in value if not c.isspace() and ord(c) not in font.face.charToGlyph and c not in greek}
    if missing: raise ValueError(f'Unsupported glyphs: {missing}')
    markup=''.join(f'<font name="Math">{c}</font>' if c in greek else escape(c) for c in value)
    return Paragraph(markup.replace('\n','<br/>'), styles[style])

story=[]
def section(title, text):
    story.extend([p(title,'head'), p(text)])

story.append(p('공조 필답형 계산 공부\nSI 단위부터 차근차근','title'))
story.append(p('숫자를 넣는 이유, 기호의 뜻, 단위가 나뉘는 과정을 함께 읽는 학습 자료 · 2026-10-19','small'))
for item in DATA['basics'][:5]: section(item['title'],item['text'])
story.append(PageBreak())
story.append(p('단위는 어떻게 없어질까?','title'))
for item in DATA['basics'][5:]: section(item['title'],item['text'])
section('시험에서 적는 순서','공식 쓰기 -> 숫자와 단위 넣기 -> 계산 -> 문제에서 정한 자리로 반올림한 최종값. 답만 적지 말고 계산과정을 함께 씁니다. 공통 기준보다 개별 문항의 요구사항이 우선입니다.')
story.append(PageBreak())
for family in DATA['examFamilies']:
    story.append(p(family['title'],'title'))
    story.append(p('전달받은 시험범위: CGT·CR·COP·BF 중 1문제, 경우에 따라 2문제. 아래 수치는 기호와 단위를 이해하는 연습 예제입니다.','small'))
    story.append(p(family['formula'],'formula'))
    section('이 공식을 고르는 순간',family['when'])
    section('기호는 무슨 뜻일까?',family['symbols'])
    section('아주 쉬운 예제',family['example'])
    section('단위가 왜 이렇게 남을까?',family['units'])
    section('한 줄로 기억',family['remember'])
    story.append(PageBreak())
story.append(p('계산 유형 찾아보기','title'))
story.append(p('수치 계산 33문제 + 공식 쓰기 3문제. 회차별 복원 21문제와 기초·심화·추가 자료 15문제입니다. 문제 번호는 책 기준이며 이전 내부 ID 순서와 다를 수 있습니다.','small'))
for i,row in enumerate(DATA['rows'],1):
    q,l=row['prompt'],row['lesson']
    source = f"{q['year']}년 {q['session']}회 {q.get('number','추가')}번" if q.get('year') else {'foundation':'기초 연습','drill':'심화 연습','supplement':'추가 자료'}.get(q['group'],q['group'])
    badge='/'.join(f.upper() for f in row['examFamilies']) or '보충'
    story.append(p(f"{i:02d}. [{badge}] {l['title']} / {source}",'index'))
section('읽을 때의 기준','문항의 수치와 단위는 기존 복원·연습 자료를 따릅니다. 중간값은 계산 이해를 위해 충분히 남겼고, 시험 최종값 예시에는 기본 둘째 자리 또는 확인된 개별 조건을 적용했습니다. 기초·심화 문제도 같은 기준으로 답안 쓰기를 연습합니다. 기존 참고답안과 자리수가 다를 수 있습니다.')
story.append(PageBreak())

for i,row in enumerate(DATA['rows'],1):
    block_start=len(story)
    q,l=row['prompt'],row['lesson']
    source = f"{q['year']}년 {q['session']}회 · 책 {q.get('number','추가')}번" if q.get('year') else {'foundation':'기초 연습','drill':'심화 연습','supplement':'추가 자료'}.get(q['group'],q['group'])
    story.append(p(f"{i:02d}  {l['title']}",'title'))
    story.append(p(f"{source} / {l['topic']} / {'수치 계산' if l['kind']=='numeric' else '공식 쓰기'}",'small'))
    if row['examFamilies']: story.append(p('시험 우선 유형: '+' / '.join(f.upper() for f in row['examFamilies']),'small'))
    section('문제',q['question'])
    for asset in ([q['image']] if q.get('image') else []) + q.get('images',[]):
        path=ROOT/asset
        if path.suffix.lower() == '.svg':
            # The PDF-only PNG is rendered with bundled sharp; source SVG stays intact.
            path=ROOT/'tmp/pdfs'/f'{path.stem}.png'
        with PILImage.open(path) as im: iw,ih=im.size
        scale=min((W-88)/iw,200/ih)
        image=Image(str(path),width=iw*scale,height=ih*scale)
        image.hAlign='CENTER'
        story.extend([image,Spacer(1,8)])
    story.append(p(l['formula'],'formula'))
    section('기호는 무슨 뜻일까?', '\n'.join(l['symbols']))
    section('왜 이렇게 계산할까?',l['why'])
    split_at=len(story)
    section('숫자 넣어 풀기','\n'.join(f"{j}. {step}" for j,step in enumerate(l['steps'],1)))
    section('단위가 왜 이렇게 남을까?', '\n'.join(l['units']))
    if l.get('examAnswer'):
        section('시험 답안의 최종값 예시',l['examAnswer'])
        story.append(p(l['rounding'],'small'))
    section('한 줄로 기억',l['memory'])
    if l.get('caution'): section('이 문제의 조건',l['caution'])
    story.append(p('문항 연결: '+q['id'],'small'))
    block=story[block_start:]
    required=sum(f.wrap(W-100,H)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in block)
    if required > H-110:
        # Start the worked calculation on a fresh page rather than leaving a few
        # lines or an answer by itself after an accidental page overflow.
        story[split_at:split_at]=[PageBreak(),p(f"{i:02d}  {l['title']} - 풀이",'title'),p(source,'small')]
    story.append(PageBreak())

story.append(p('공식 원리 참고 자료','title'))
story.append(p('문항과 그림은 사용자가 제공한 자료 및 기존 프로젝트 문제은행의 해당 문항을 대조했습니다. 설명은 학습을 위해 추가했습니다. 아래 자료는 기본 원리와 단위 환산의 근거이며, 모든 복원 답안의 공식 채점기준을 뜻하지 않습니다.'))
for reference in DATA['references']:
    section(reference['title'],reference['url'])
section('반올림 조건 대조','사용자 제공 IMG_9883.JPG의 채점 유의사항 3~5번: 계산과정 기재, 기본 소수 셋째 자리에서 반올림하여 둘째 자리, 개별 요구사항 우선, 단위 기재. 2024년 1회 책 411쪽 8번은 절대습도를 셋째 자리까지 기입. 2024년 3회 책 423쪽 7번은 인쇄 답안에서도 0.00625를 0.01로 표기합니다.')

def footer(canvas,doc):
    canvas.saveState()
    canvas.setStrokeColor(HexColor('#dce5e8'))
    canvas.line(44,40,W-44,40)
    canvas.setFont('Nanum',8)
    canvas.setFillColor(MUTED)
    canvas.drawString(44,26,'공조 필답형 계산 공부 / 공식 · 숫자 대입 · 단위')
    canvas.drawRightString(W-44,26,str(doc.page))
    canvas.restoreState()

SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=40,bottomMargin=54,
                  title='공조 필답형 계산 공부 - SI 단위부터 공식과 풀이',author='CBT 학습 자료').build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(str(OUT))
text='\n'.join(page.extract_text() or '' for page in reader.pages)
for row in DATA['rows']:
    assert row['prompt']['id'] in text, row['prompt']['id']
assert 'SI' in (reader.pages[0].extract_text() or '')
print(json.dumps({'output':str(OUT),'pages':len(reader.pages),'questions':len(DATA['rows']),'bytes':OUT.stat().st_size},ensure_ascii=False))
