"""Illustrated comparison report. Does not modify question data or source images."""
from pathlib import Path
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A3, landscape
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/hvac-practical-book-video-comparison-2026-10-07.pdf'
SCANS = Path('/private/tmp/cbt-scans-20261006')
ASSETS = ROOT / 'assets/hvac-practical/restored'
pdfmetrics.registerFont(TTFont('Nanum', str(ROOT / 'assets/fonts/NanumGothic-Regular.ttf')))
pdfmetrics.registerFont(TTFont('NanumBold', str(ROOT / 'assets/fonts/NanumGothic-Bold.ttf')))
W, H = landscape(A3)
INK, MUTED = HexColor('#172a3c'), HexColor('#526879')
BLUE, ORANGE = HexColor('#176b91'), HexColor('#ab571c')
BG, LINE = HexColor('#f2f5f7'), HexColor('#d6e0e7')
OUT.parent.mkdir(parents=True, exist_ok=True)
C = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
C.setTitle('공조 필답형 - 책 스캔과 영상 판서 사진 비교')
C.setAuthor('CBT 프로젝트 비교 자료')

def label(text, x, y, size=16, color=INK, bold=False):
    C.setFillColor(color)
    C.setFont('NanumBold' if bold else 'Nanum', size)
    C.drawString(x, y, text)

def paragraph(text, x, top, width, size=15, color=INK, bold=False):
    # The repository's bold font lacks circled digits and Greek delta.
    # Keep the photo originals intact and use unambiguous text equivalents.
    for digit, char in enumerate('①②③④', 1):
        text = text.replace(char, f'({digit})')
    text = text.replace('Y-Δ', 'Y-델타')
    style = ParagraphStyle('body', fontName='NanumBold' if bold else 'Nanum',
        fontSize=size, leading=size*1.5, textColor=color, wordWrap='CJK')
    p = Paragraph(text, style)
    _, h = p.wrap(width, H)
    p.drawOn(C, x, top-h)
    return h

def card(x, y, w, h):
    C.setFillColor(white)
    C.setStrokeColor(LINE)
    C.roundRect(x, y, w, h, 9, fill=1, stroke=1)

def picture(path, x, y, w, h, crop=None):
    with Image.open(path) as source:
        im = source.convert('RGB')
        if crop:
            # Fractional crop of the original scan; no pixel enhancement.
            iw, ih = im.size
            im = im.crop(tuple(round(v * (iw if i % 2 == 0 else ih)) for i, v in enumerate(crop)))
        iw, ih = im.size
        scale = min(w/iw, h/ih)
        dw, dh = iw*scale, ih*scale
        C.drawImage(ImageReader(im), x+(w-dw)/2, y+(h-dh)/2,
            width=dw, height=dh, mask='auto')

def page(title, subtitle, n):
    C.setFillColor(BG)
    C.rect(0, 0, W, H, fill=1, stroke=0)
    label('공조냉동기계산업기사 필답형 | 사진 대조', 36, H-40, 13, BLUE, True)
    label(title, 36, H-83, 28, INK, True)
    label(subtitle, 36, H-111, 13, MUTED)
    C.setStrokeColor(LINE)
    C.line(36, 47, W-36, 47)
    label('2026-10-07 | 번호는 책 기준 | 저장된 판서 프레임 비교, 영상 전체 발언 검수 아님', 36, 27, 11, MUTED)
    C.setFont('Nanum', 11)
    C.drawRightString(W-36, 27, f'{n} / 9')

ITEMS = [
 dict(round='2024-1', book=12, old=1, scan='Scan0032.jpg', printpage='413-414쪽', time='13:45',
      crop=(.30,.235,.90,.331), state='회로 일부 차이 / 표시등 비교 제한',
      notes='책의 수동 경로에는 <b>RY-b</b> 접점이 있고, 영상 판서에는 해당 접점이 생략되어 있습니다.<br/><br/>책 답안은 THR 작동 때 <b>RL·GL 소등, OL 점등</b>입니다. 영상 오른쪽 표시등은 강사에게 가려져 이 프레임만으로 완전히 대조할 수 없습니다.'),
 dict(round='2024-3', book=11, old=1, scan='Scan0012.jpg', printpage='425쪽', time='05:00',
      crop=(.18,.671,.37,.724), state='빈칸 접점 답 일치',
      notes='책과 영상 모두 <b>① X1-a · ② T-b(한시) · ③ X2-a</b>입니다.<br/><br/>설정 시간이 지나 T-b가 열리면 X2가 꺼지고, X2-a가 열려 GL도 소등되는 흐름입니다.'),
 dict(round='2024-3', book=12, old=2, scan='Scan0013.jpg', printpage='426쪽', time='18:40',
      crop=(.31,.645,.45,.712), state='빈칸 답과 전환 흐름 일치',
      notes='양쪽 모두 <b>① X2 · ② X1 · ③ X2 · ④ X2</b>입니다.<br/><br/>PBS1을 누르면 램프 L1·L2가 직렬로 켜지고, PBS2를 누르면 병렬로 전환됩니다. 그림에 기입할 접점명은 일치합니다.'),
 dict(round='2025-1', book=12, old=2, scan='Scan0018.jpg', printpage='431쪽', time='09:10',
      crop=(.17,.548,.74,.621), state='책 내부 표기 불일치 / 영상에 STOP 추가',
      notes='책 도면은 코일과 표시등 접점이 <b>X</b>인데, 아래 인쇄 답안에는 <b>MC</b>라고 적혀 있습니다.<br/><br/>영상은 MC로 그렸고 책에 없는 <b>STOP</b>도 포함합니다. 큰 타이머 흐름은 유사하지만 완전히 같은 도면은 아닙니다. 저장 장면은 시간 경과 후 상태이며 EOCR 경보 과정까지 확인한 것은 아닙니다.'),
 dict(round='2025-2', book=10, old=1, scan='Scan0023.jpg', printpage='436쪽', time='10:30',
      crop=(.30,.481,.56,.505), state='서로 다른 복원 회로 - 답 교차 적용 금지',
      notes='책은 <b>Y-Δ 기동 회로</b>이고 빈칸은 <b>① MC1 · ② MC2 · ③ MC3</b>입니다.<br/><br/>영상은 EOCR와 릴레이·표시등을 사용하는 다른 회로이며 <b>① EOCR · ② MC1 · ③ MC2</b>로 적혀 있습니다. 단순 오타가 아니므로 영상의 빈칸 답을 책 도면에 그대로 넣으면 안 됩니다.'),
 dict(round='2025-2', book=12, old=2, scan='Scan0024.jpg', printpage='437쪽', time='20:45',
      crop=(.18,.771,.79,.823), state='수동 운전 경로가 서로 다름',
      notes='책에서는 MAN 경로로 <b>MC만 켜지고, AUTO 경로의 RY는 꺼진 상태</b>입니다.<br/><br/>영상은 <b>PB1 → RY1 → RY1-a → MC</b>로 이어지며 별도 T/RY2도 있습니다. 영상의 “RY1이 켜진다”는 내용을 책의 RY에 그대로 적용할 수 없습니다.'),
 dict(round='2025-3', book=12, old=1, scan='Scan0062.jpg', printpage='443쪽', time=None,
      crop=(.18,.50,.79,.553), state='책 인쇄 답안의 접점명 오타',
      notes='책 도면과 영상에는 모두 <b>X2-b</b>인데 책 인쇄 답안만 <b>X1-b</b>라고 적혀 있습니다.<br/><br/>PB2를 누르면 <b>X2 켜짐 → X2-b 열림 → X1 꺼짐 → X1-a 열림 → X2 꺼짐</b> 순서입니다. 같은 도면 안의 접점명과 인쇄 답안이 충돌하는 사례입니다.'),
]

page('책 스캔 vs 영상 판서', '시퀀스 7쌍을 한 장씩 크게 비교하고, 마지막에 사진 개선 전후를 담았습니다.', 1)
card(36, H-237, W-72, 94)
paragraph('<b>읽는 방법</b> &nbsp; 왼쪽은 책 도면, 오른쪽은 저장된 영상 판서입니다. 아래에는 실제 책 답안의 확대 사진과 비교 포인트를 넣었습니다.<br/>책 번호를 우선 표기하고 이전 사이트 번호를 괄호로 병기했습니다. 같은 회차라도 복원 도면이 다르면 답안을 섞지 마세요.', 55, H-158, W-110, 16)
tops = H-277
for i, item in enumerate(ITEMS):
    y = tops-i*55
    C.setFillColor(white if i%2==0 else HexColor('#e9eff3'))
    C.roundRect(36, y-37, W-72, 47, 5, fill=1, stroke=0)
    label(f"{item['round'].replace('-', '년 ')}회  ·  책 {item['book']}번", 53, y-8, 17, INK, True)
    label(item['state'], 342, y-8, 16, BLUE if '일치' in item['state'] and '불일치' not in item['state'] else ORANGE)
    label(f'{i+2}쪽', W-101, y-8, 14, MUTED)
paragraph('<b>범위와 한계</b><br/>제공된 책 스캔과 기존 저장 판서 프레임만 비교했습니다. 전체 영상 음성, 모든 회차의 시퀀스, 가려진 장면은 검증 완료가 아닙니다. 이 PDF 제작에서는 문제·정답·해설을 변경하지 않았습니다.', 52, 125, W-104, 15, MUTED)
C.showPage()

colw = (W-90)/2
for n, item in enumerate(ITEMS, 2):
    r, old = item['round'], item['old']
    stem = f'hvac-practical-restored-{r}-{old:02}'
    book = ASSETS/r/f'{stem}-question-scan-v550.png'
    video = ASSETS/r/f"{stem}-answer-1{'-reviewed-v514' if r != '2024-1' else ''}.png"
    when = f" · 저장 장면 {item['time']}" if item['time'] else ' · 저장 장면 (시간 미기록)'
    page(f"{r.replace('-', '년 ')}회 · 책 {item['book']}번", f"이전 사이트 {old}번 | {item['state']}", n)
    label('책 스캔 · 도면', 36, H-146, 17, BLUE, True)
    label('영상 판서'+when, 54+colw, H-146, 17, ORANGE, True)
    main_y, main_h = 302, H-466
    for x in (36, 54+colw):
        card(x, main_y, colw, main_h)
    if r == '2024-3' and old == 2:
        # A little more right margin than the existing site crop for PBS2.
        picture(SCANS/item['scan'], 46, main_y+10, colw-20, main_h-20,
            (.325,.13,.85,.403))
    else:
        picture(book, 46, main_y+10, colw-20, main_h-20)
    picture(video, 64+colw, main_y+10, colw-20, main_h-20)
    label(f"책 인쇄 답안 확대 · {item['printpage']}", 36, 277, 15, BLUE, True)
    label('비교 포인트', 54+colw, 277, 15, ORANGE, True)
    card(36, 72, colw, 189)
    card(54+colw, 72, colw, 189)
    picture(SCANS/item['scan'], 46, 82, colw-20, 169, item['crop'])
    used = paragraph(item['notes'], 70+colw, 248, colw-32, 15)
    assert used < 167, (r, used)
    C.showPage()

page('사진 비교 · 액분리기', '2024년 3회 책 4번 (이전 사이트 12번) | 원본과 개선본은 같은 표시 크기로 배치', 9)
stem = 'hvac-practical-restored-2024-3-12'
paths = [ASSETS/'2024-3'/f'{stem}-question-scan-v550.png',
         ASSETS/'2024-3'/f'{stem}-question-upscaled-v551.png',
         ASSETS/'2024-3'/f'{stem}-answer-1.png']
boxes = [(36,280,245,385), (299,280,245,385), (562,280,W-598,385)]
for path, box, title in zip(paths, boxes, ['책 원본 · 116 × 270', '개선본 · 232 × 540', '영상 판서 · 액분리기 위치']):
    label(title, box[0], 686, 16, BLUE if path != paths[2] else ORANGE, True)
    card(*box)
    if path == paths[2]:
        picture(path, box[0]+8, box[1]+8, box[2]-16, box[3]-16)
    else:
        picture(path, box[0]+10, box[1]+22, box[2]-20, 341)
card(36, 80, W-72, 170)
paragraph('<b>개선 방식</b> &nbsp; Mac M4 Pro / arm64 Real-ESRGAN x4plus-anime, 타일 256px. 4배 처리 후 2배 bicubic 축소.<br/><br/><b>눈으로 확인할 점</b> &nbsp; 몸체·윤곽은 더 뚜렷해졌지만 작은 라벨 글자는 모델이 바꿔 그린 흔적이 있습니다. 글자 판독이나 정답의 증거로 쓰면 안 됩니다. 영상 판서는 증발기와 압축기 사이의 액분리기 위치를 설명하는 별도 표현입니다.<br/><br/>원본은 보존되어 있습니다. 이 페이지를 위한 추가 업스케일링·이미지 교체는 하지 않았습니다.', 54, 233, W-108, 16)
C.showPage()
C.save()
print(OUT)
print('9 pages; 7 diagram pairs; 7 printed-answer crops; 1 photo comparison')
