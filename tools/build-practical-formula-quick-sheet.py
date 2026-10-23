"""One-page Korean-word formula reminder, independent of the detailed booklet."""
from pathlib import Path
from html import escape
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/hvac-practical-formula-quick-sheet.pdf'
for name, filename in [('Nanum', 'NanumGothic-Regular.ttf'), ('NanumBold', 'NanumGothic-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / 'assets/fonts' / filename)))
INK, GREEN, MUTED = map(HexColor, ['#183145', '#116b58', '#536778'])
PAGE_W, PAGE_H = A4
WIDTH = PAGE_W - 72
STYLES = {
    'title': ParagraphStyle('title', fontName='NanumBold', fontSize=21, leading=28, textColor=INK, spaceAfter=6),
    'subtitle': ParagraphStyle('subtitle', fontName='Nanum', fontSize=10.2, leading=15, textColor=MUTED, spaceAfter=8, wordWrap='CJK'),
    'head': ParagraphStyle('head', fontName='NanumBold', fontSize=12.2, leading=18, textColor=GREEN, spaceAfter=5, wordWrap='CJK'),
    'formula': ParagraphStyle('formula', fontName='NanumBold', fontSize=11.5, leading=18, textColor=INK, spaceAfter=4, wordWrap='CJK'),
    'note': ParagraphStyle('note', fontName='Nanum', fontSize=9.4, leading=13.5, textColor=MUTED, spaceAfter=3, wordWrap='CJK'),
    'warning': ParagraphStyle('warning', fontName='NanumBold', fontSize=10, leading=15, textColor=INK, spaceAfter=8, wordWrap='CJK'),
}


def p(text, style='formula'):
    return Paragraph(escape(text).replace('\n', '<br/>'), STYLES[style])


class Fraction(Flowable):
    def __init__(self, label, numerator, denominator):
        super().__init__()
        self.label, self.numerator, self.denominator = label + ' = ', numerator, denominator
        self.spaceBefore, self.spaceAfter = 2, 5

    def wrap(self, availWidth, availHeight):
        self.font = 11.2
        self.label_width = pdfmetrics.stringWidth(self.label, 'NanumBold', self.font)
        self.fraction_width = max(pdfmetrics.stringWidth(s, 'NanumBold', self.font) for s in (self.numerator, self.denominator)) + 8
        self.scale = min(1, availWidth / (self.label_width + self.fraction_width))
        assert self.font * self.scale >= 10, 'Do not squeeze formulas into tiny print'
        self.width = (self.label_width + self.fraction_width) * self.scale
        self.height = 36 * self.scale
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.saveState()
        c.scale(self.scale, self.scale)
        c.setFillColor(INK)
        c.setStrokeColor(GREEN)
        c.setFont('NanumBold', self.font)
        c.drawString(0, 14, self.label)
        center = self.label_width + self.fraction_width / 2
        c.drawCentredString(center, 24, self.numerator)
        c.setLineWidth(.65)
        c.line(self.label_width, 19, self.label_width + self.fraction_width, 19)
        c.drawCentredString(center, 5, self.denominator)
        c.restoreState()


def card(title, *content):
    return [p(title, 'head'), *[p(item) if isinstance(item, str) else item for item in content]]


cards = [
    card('01  CGT · 온도가 바뀔 때',
         '현열량 = 질량 × 비열 × 온도차',
         p('열의 크기: 온도차 = 높은 온도 - 낮은 온도', 'note'),
         Fraction('질량', '현열량', '비열 × 온도차')),
    card('02  CR · 녹거나 증발할 때',
         '잠열량 = 질량 × 1 kg당 잠열',
         p('kg × kJ/kg → kJ. 온도차는 또 곱하지 않기.', 'note'),
         Fraction('질량', '잠열량', '1 kg당 잠열')),
    card('03  COP · 얻은 것 ÷ 넣은 것',
         Fraction('냉동 COP', '냉동능력', '압축기 동력'),
         Fraction('압축기 동력', '냉동능력', '냉동 COP'),
         p('두 값 모두 kW. 방열량 = 냉동능력 + 동력', 'note')),
    card('04  BF · 덜 냉각된 정도',
         Fraction('BF', '출구온도 - 코일온도', '입구온도 - 코일온도'),
         'CF = 1 - BF',
         p('코일온도는 장치노점. BF 0.2 → CF 0.8', 'note')),
    card('05  공기 송풍량',
         Fraction('송풍량', '현열부하(kW)', '밀도 × 비열 × 온도차'),
         p('밀도 kg/m³ · 비열 kJ/(kg·°C) → m³/s\n시간당 m³/h를 물으면 ×3,600. 잠열은 제외.', 'note')),
    card('06  냉매 순환량',
         Fraction('냉매순환량', '냉동능력', '출구 엔탈피 - 입구 엔탈피'),
         p('증발기 기준. kW ÷ kJ/kg → kg/s\n시간당 kg/h를 물으면 ×3,600.', 'note')),
    card('07  벽·바닥의 열 / 필요한 면적',
         '열부하 = 열관류율 × 면적 × 온도차',
         Fraction('면적', '열부하', '열관류율 × 온도차'),
         p('열관류율 W/(m²·°C) → 열부하 W', 'note')),
    card('08  펌프 축동력',
         Fraction('축동력', '비중량 × 유량 × 양정', '1,000 × 효율'),
         p('비중량 N/m³ · 유량 m³/s → 동력 kW\n효율 70%는 0.7. 비중량에 중력을 또 곱하지 않기.', 'note')),
    card('09  현열비 SHF',
         Fraction('현열비', '현열', '현열 + 잠열'),
         p('전체 = 현열 + 잠열. 모두 같은 단위로.\nSHF 0.7이면 전체 열의 70%가 현열.', 'note')),
    card('10  상사법칙 · 회전수 a배',
         '유량 a배 · 양정 a²배 · 동력 a³배',
         p('a = 새 회전수 ÷ 기존 회전수\n2배 → 2·4·8배. 송풍기는 양정 대신 압력.\n같은 장치·밀도·효율 등 상사조건에서 적용.', 'note')),
]

story = [p('시험 직전 · 한글 공식 한 장', 'title'),
         p('공조 필답형 계산 / CGT · CR · COP · BF 먼저, 나머지는 보충 복습', 'subtitle'),
         p('현열과 잠열은 서로 곱하지 않습니다. 구간별로 계산한 뒤 총열량을 물으면 더합니다.', 'warning')]
rows = []
for index in range(0, len(cards), 2):
    rows.append([cards[index], '', cards[index + 1]])
    if index < len(cards) - 2:
        rows.append(['', '', ''])
table = Table(rows, colWidths=[(WIDTH - 12) / 2, 12, (WIDTH - 12) / 2])
commands = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 9),
            ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
for row in range(len(rows)):
    if row % 2:
        commands.extend([('TOPPADDING', (0, row), (-1, row), 2), ('BOTTOMPADDING', (0, row), (-1, row), 2)])
    else:
        for col in (0, 2):
            commands.extend([('BACKGROUND', (col, row), (col, row), HexColor('#edf5f1' if row < 4 else '#f2f5f8')),
                             ('BOX', (col, row), (col, row), .4, HexColor('#cbd9d6'))])
table.setStyle(TableStyle(commands))
story.extend([table, Spacer(1, 9),
              p('CGT·CR에서 흐르는 양 kg/s를 넣으면 결과도 kJ/s = kW.\n시간당 → 초당은 ÷3,600. 계산기에서 분모 전체를 괄호로 묶습니다.', 'note'),
              p('마지막: 문제의 단위·지정 상수·반올림 조건 우선. 별도 조건이 없으면 최종값 소수 둘째 자리.', 'warning')])


def footer(c, doc):
    c.setFont('Nanum', 8)
    c.setFillColor(MUTED)
    c.drawString(36, 21, '상세 풀이·기호·식 바꾸기는 계산 학습 PDF 참고 / 2026-10-23 개정')
    c.drawRightString(PAGE_W - 36, 21, str(doc.page))


OUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=36, rightMargin=36, topMargin=31, bottomMargin=37,
                  title='공조 필답형 - 시험 직전 한글 공식 한 장', author='CBT 학습 자료').build(story, onFirstPage=footer, onLaterPages=footer)
reader = PdfReader(str(OUT))
assert len(reader.pages) == 1, 'Keep this reminder to one readable page'
text = reader.pages[0].extract_text() or ''
for term in ['현열량', '잠열량', 'COP', 'BF', '송풍량', '냉매순환량', '열관류율', '축동력', '현열비', '상사법칙']:
    assert term in text, term
print(json.dumps({'output': str(OUT), 'pages': len(reader.pages), 'formulas': len(cards), 'bytes': OUT.stat().st_size}, ensure_ascii=False))
