"""Build the study handout from the seven topics in the supplied course summary."""
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

root = Path(__file__).resolve().parents[1]
for name, weight in [('Study', 'Regular'), ('StudyBold', 'Bold')]:
    pdfmetrics.registerFont(TTFont(name, str(root / f'assets/fonts/NanumGothic-{weight}.ttf')))
pdf = Canvas(str(root / 'output/pdf/sports-leadership-final.pdf'), pagesize=A4, invariant=1)
pdf.setTitle('스포츠리더십 | 2026년 2학기 기말고사 시험범위')
w, h = A4
ink, accent = '#182E37', '#086B66'


def line(x, y, text, size, color=ink, bold=False):
    pdf.setFillColor(HexColor(color))
    pdf.setFont('StudyBold' if bold else 'Study', size)
    pdf.drawString(x, y, text)


def page(number, title):
    line(44, h-50, '스포츠리더십   /   2026년 2학기 기말고사', 11, accent, True)
    line(44, h-99, title, 27, bold=True)
    pdf.setStrokeColor(HexColor('#B5CFCD'))
    pdf.line(44, h-117, w-44, h-117)
    line(44, 29, '수업 정리본 기준  ·  시험범위 복습용', 9, accent)
    line(w-76, 29, f'{number} / 3', 9, accent)
    return h-150


def section(y, title, rows):
    line(44, y, title, 16, accent, True)
    y -= 13
    for label, text in rows:
        p = Paragraph(f'<font name="StudyBold">{escape(label)}</font> &nbsp; {escape(text.replace("−","-"))}',
                      ParagraphStyle('note', fontName='Study', fontSize=11.8, leading=19,
                                     textColor=HexColor(ink), wordWrap='CJK'))
        _, ph = p.wrap(w-98, 700)
        y -= ph
        assert y > 50, (title, label, y)
        p.drawOn(pdf, 50, y)
        y -= 7
    return y-20


y = page(1, '운동의 효과와 종류')
y = section(y, '01   운동의 효과', [
    ('심리적 효과', '운동 후 체온이 오르고 근육이 이완된다. 일상에서 벗어나는 경험과 신체의 활성화, 신경전달물질의 분비는 정서 변화와 관련된다. 정리본은 우울감 개선, 인지능력 향상, 정서 안정을 함께 제시한다.'),
    ('생리적 효과', '심폐기능이 향상되고 심장 용적과 1회 박출량은 커지며 안정 시 심박수는 낮아진다. 산소섭취량·에너지 소비량과 혈중 지질이 변하며, 근육계·골격계·내분비계에도 변화가 생긴다. 심혈관 질환 및 비만 예방도 포함한다.'),
    ('체중 관리', '운동 중·후 충분히 수분을 섭취한다. 한 번 강하게 하기보다 가볍게 규칙적으로 한다. 유산소 운동을 중심으로 하되 근육량을 위해 저항운동도 병행한다.'),
])
y = section(y, '02   운동의 종류', [
    ('등장성', '관절이 움직이며 근육 길이가 변한다. 단축성은 힘을 내며 짧아지는 것, 신장성은 힘을 내면서도 늘어나는 것이다. 예: 아령을 들어 올릴 때와 천천히 내릴 때의 위팔 앞쪽 근육.'),
    ('등척성', '근육의 길이와 관절 각도가 거의 그대로인 채 힘을 낸다. 예: 움직이지 않는 벽 밀기. 정적인 운동으로 재활에도 사용한다.'),
    ('등속성', '움직이는 속도가 일정하다. 힘이나 근육의 길이가 일정하다는 뜻이 아니다.'),
])
section(y, '한눈에 구별하기', [('길이 변화 → 등장성', '자세 고정 → 등척성   /   속도 일정 → 등속성')])
pdf.showPage()

y = page(2, '유산소 운동과 체력')
y = section(y, '03   효과적인 유산소 운동방법', [
    ('시간·빈도', '정리본 수치: 연속 20~60분 또는 10분 이상의 간헐적 운동, 주 3~5회. 최대심박수의 70~85%에서는 20~30분으로 제시한다.'),
    ('강도·소비량', '최대 운동능력의 70% 수준에서 50~60분, 하루 에너지 소비 목표는 150~400 kcal. 최대 운동능력과 최대심박수는 서로 다른 기준이다.'),
    ('강도 판단 요인', '최대산소섭취량, 최대심박수, 목표심박수, 안정 시 심박수, 운동자각도. 유산소 운동과 근력운동을 병행한다.'),
    ('카보넨 공식', '최대심박수 = 220 − 나이. 목표심박수 = (최대심박수 − 안정 시 심박수) × 운동강도 + 안정 시 심박수.'),
    ('계산 예시', '20세, 안정 시 60회/분, 강도 70%라면 (200 − 60) × 0.70 + 60 = 158회/분. 강도 70%는 70이 아니라 0.70을 넣는다.'),
])
section(y, '04   체력의 분류', [
    ('체력', '일상생활이나 신체활동을 적극적으로 수행할 수 있는 능력. 방위체력은 질병과 환경 변화를 이겨 내는 힘이고, 행동체력은 아래 두 종류로 구분한다.'),
    ('건강 관련 행동체력', '근력 = 근육이 내는 힘 / 근지구력 = 근육이 일을 지속하는 능력 / 심폐지구력 = 산소를 공급하면서 활동을 지속하는 능력 / 유연성 = 관절이 움직일 수 있는 범위.'),
    ('운동 관련 행동체력', '순발력 = 순간적으로 강한 힘 / 민첩성 = 목적에 맞게 몸을 빠르게 움직임 / 평형성 = 자세와 균형 유지 / 협응력 = 근육·신경 등 여러 기관의 움직임을 조정.'),
])
pdf.showPage()

y = page(3, '리더십과 스포츠 사회')
y = section(y, '05   스포츠리더십', [
    ('리더십', '구성원에게 동기를 부여하고 조직 활동에 영향을 주어 공동의 목표를 달성하게 하는 기능.'),
    ('특성 이론', '어떤 사람인가? 타고난 성격 등 리더의 안정적인 특성에 주목한다.'),
    ('상황 이론', '어느 상황에 맞는가? 리더의 특성과 상황 통제력의 조합을 본다. 관계 지향은 협조·긍정적 관계, 과제 지향은 과업·목표 달성에 무게를 둔다.'),
    ('행동 이론', '누가 결정하는가? 권위적 = 리더가 결정·지시 / 민주적 = 구성원과 함께 결정하고 피드백으로 수정 / 자유방임적 = 구성원이 결정하고 리더는 상담한다.'),
])
y = section(y, '06   스포츠윤리', [
    ('의미', '스포츠 활동을 통해 사회의 가치·규범·행동 양식을 익힌다. 참가자에게도 지켜야 할 규범이 있다.'),
    ('올림피즘 / 스포츠맨십', '올림피즘은 인간의 균형 있는 발전·존엄·평화를 추구하는 철학. 스포츠맨십은 선수가 갖춰야 할 태도와 도덕적 규범.'),
    ('페어플레이 / 팀워크', '규칙을 지키고 정정당당하게 겨루는 것이 페어플레이. 서로 협력하며 자기 역할을 다하는 것이 팀워크.'),
])
section(y, '07   스포츠의 사회적 기능', [
    ('순기능', '교육(신체·정신·사회적 발달), 오락(기분 전환), 사회성 함양(자기 수양·시민 정신), 사회통합(월드컵 응원처럼 집단이 하나가 됨), 사회정화(선수·관중이 에너지를 발산).'),
    ('역기능', '지나친 국가주의와 승리지상주의(규칙·도덕을 희생), 인종차별(포지션 배분 차별 등), 상업주의(이익만을 목적으로 삼음), 과도한 승부욕 등에서 비롯된 선수·관중의 폭력과 공격성.'),
])
pdf.save()
