"""PDF-only direct substitutions. Keep the detailed beginner booklet unchanged."""
from math import pi, sqrt, isclose
from reportlab.platypus import KeepTogether, Table, TableStyle, Image, Spacer, PageBreak, CondPageBreak
from reportlab.lib.colors import HexColor
from PIL import Image as PILImage
from practical_formula_families import CHAPTERS

def f(top, bottom):
    return {'top': [top] if isinstance(top, str) else top, 'bottom': [bottom] if isinstance(bottom, str) else bottom}

def eq(name, top, bottom, answer=''):
    return [name+' = ', f(top, bottom), answer]

DIRECT = {
    'foundation-8': [['Q = 1 × 4.18 × 5 = 20.90 kW']],
    'drill-10': [['Q = 2 × 4.18 × 5 = 41.80 kW']],
    'drill-11': [['Q = 1.2 × 2 × 1.005 × 10 = 24.12 kW']],
    'restored-2026-2-09': [eq('V', '25 × 3,600', '1.2 × 1.01 × (26 - 15)', ' ≈ 6,750.68 m³/h')],
    'restored-2025-1-11': [eq('RT', '10 × 1,000 × 4.2 × (35 - 2)', '2 × 3,600 × 3.86', ' ≈ 49.87 RT')],
    'restored-2023-3-02': [['Q = 1 × {2.1 × [0 - (-10)] + 335 + 4.2 × (100 - 0) + 2,257}'], ['   = 3,033.00 kJ']],
    'restored-2023-2-02': [['Q = 0.6 × 1.0 × (28 - 19) = 5.40 kW']],
    'supplement-20260916-16': [['Q = G × c × (t입구수 - t출구수)'], ['레인지 = t입구수 - t출구수'], ['어프로치 = t출구수 - t외기습구']],
    'restored-2025-3-06': [eq('RT', '1.3 × (1 - 0.1) × 1,675', '3.86', ' ≈ 507.71 RT')],
    'foundation-2': [eq('COP', '12', '3', ' = 4.00')],
    'foundation-3': [['Qc = 12 + 3 = 15.00 kW']],
    'drill-07': [eq('COP', '24', '6', ' = 4.00'), ['Qc = 24 + 6 = 30.00 kW']],
    'drill-09': [eq('COP', '400 - 250', '450 - 400', ' = 3.00')],
    'restored-2024-2-10': [eq('BF', '② - ③', '① - ③'), eq('CF', '① - ②', '① - ③')],
    'foundation-11': [eq('P절대', '(760 - 300) × 101.325', '760', ' ≈ 61.33 kPa')],
    'drill-08': [eq('G', '75', '400 - 250', ' = 0.50 kg/s')],
    'drill-12': [eq('SHF', '21', '30', ' = 0.70'), ['잠열 = 30 - 21 = 9.00 kW']],
    'drill-13': [['Pm = √(0.2 × 1.8) = 0.60 MPa']],
    'drill-14': [eq('P절대', '(760 - 380) × 101.325', '760', ' ≈ 50.66 kPa')],
    'drill-28': [eq('혼합온도', '10 × 32 + 30 × 24', '10 + 30', ' = 26.00°C')],
    'drill-29': [['Q = 2 × (60 - 40) = 40.00 kW']],
    'restored-2026-2-10': [eq('K', '490', '(10 × 10) × (20 - 10.2)', ' = 0.50 W/(m²·°C)')],
    'restored-2026-1-05': [eq('A', '200 × 4.2 × (31 - 28) × 2', '60 × 0.95 × [(40 - 28) + (40 - 31)]', ' ≈ 4.21 m²')],
    'restored-2026-1-06': [eq('L', '2 × π × 150 × 90', '360', ' + 350 + 500 ≈ 1,085.62 mm')],
    'restored-2025-3-07': [eq('출력', '(9,000 + 10,000 + 2,000 + 1,000 + 4,000 + 2,500) × 1.5 × 1.5', '1,000', ' ≈ 64.13 kW')],
    'restored-2025-2-07': [eq('K', '1', [f('1','0.05'),' + ',f('0.10','0.000025'),' + ',f('1','0.009')], ' ≈ 0.000242 W/(m²·K)')],
    'restored-2025-2-08': [eq('N2', '800 × 2', '1.5', ' ≈ 1,066.67 rpm')],
    'restored-2025-1-04': [eq('L', '9,800 × 1,500 × 10', '3,600 × 1,000 × 0.7', ' ≈ 58.33 kW')],
    'restored-2024-3-07': [eq('온도', '-8 × 1 + 24 × 3', '1 + 3', ' = 16.00°C'), eq('절대습도', '0.001 × 1 + 0.008 × 3', '1 + 3', ' = 0.00625 kg/kg(DA)')],
    'restored-2024-3-10': [['l = L - 2 × (A - a)']],
    'restored-2024-2-05': [['Q = 0.5 × (10 × 10) × (20 - 8.2) = 590.00 W']],
    'restored-2024-2-08': [eq('RT', '5 + 6 + 0.1 + 0.9 + 1 + 1.3 + 2 + 4 + 1.8', '3.86', ' ≈ 5.73 RT')],
    'restored-2024-1-06': [eq('G', '12 × 3.86 × 3,600', '1,630 - 545', ' ≈ 153.69 kg/h')],
    'restored-2024-1-09': [eq('온도', '-5 × 1 + 20 × 4', '1 + 4', ' = 15.00°C'), eq('절대습도', '0.001 × 1 + 0.005 × 4', '1 + 4', ' = 0.0042 kg/kg(DA)')],
    'restored-2023-3-04': [eq('SHF', '8.3', '8.3 + 2.8', ' ≈ 0.75')],
    'restored-2023-2-12': [
        ['Q1 급탕 = 3,000 × 4.18 × (60 - 10) = 627,000.00 kJ/h'],
        ['Q2 상용 = (1,000 × 2,256 + Q1) × 1.20 = 3,459,600.00 kJ/h'],
        eq('Q3 정격', 'Q2 × 1.15', '3,600', ' = 1,105.15 kW'),
        eq('효율', 'Q2 × 1.15 × 100', '130 × 40,000', ' ≈ 76.51%'),
    ],
}

FORMULAS = {
    '공기의 현열·송풍량': [['Q현열 = ρ × V × c × Δt'], eq('V (m³/h)', 'Q현열 × 3,600', 'ρ × c × Δt')],
    '정해진 시간에 물을 냉각하기': [eq('RT', '물 질량 × 비열 × 온도차', '시간(h) × 3,600 × 환산값(kW/RT)')],
    '응축기 전열면적': [eq('A', '냉각수량(L/min) × c × (t출구 - t입구) × 2', '60 × K × [(t응축 - t입구) + (t응축 - t출구)]')],
    '펌프 축동력': [eq('L (kW)', 'γ × 유량(m³/h) × H', '3,600 × 1,000 × η')],
    '건조도로 냉동능력 구하기': [eq('RT', 'G × (1 - x) × r', '환산값(kW/RT)')],
    '보일러 부하와 정격출력': [eq('출력(kW)', '부하 합계(W) × 배관계수 × 예열계수', '1,000')],
}

NOTES = {
    'restored-2026-2-09': '분자의3,600은 m³/s를 m³/h로 바꾸는 값입니다. 분모 전체를 괄호로 묶어 나눕니다.',
    'restored-2025-1-11': '분자의1,000은 ton→kg, 분모의3,600은 h→s, 3.86은 kW→RT 환산입니다.',
    'restored-2026-1-05': '60은 분당 유량을 초당으로 바꿉니다. 산술평균의 나누기2를 합친 결과 분자에×2가 들어갑니다.',
    'restored-2025-1-04': '유량이 m³/h인 문제의 식입니다.3,600은 h→s, 1,000은 W→kW, 효율70%는0.7입니다.',
    'restored-2024-1-09': '온도는 섭씨로 바로 평균해도 됩니다. 절대습도는 절대온도와 다르며273을 더하지 않습니다.',
    'restored-2024-3-07': '온도는 섭씨로 바로 평균합니다. 습도는 반올림 전0.00625와 교재의 최종 표기0.01을 구분합니다.',
    'drill-28': '공기량을 각각 곱해 더한 뒤 전체 공기량으로 나눕니다. 섭씨 그대로 계산합니다.',
    'restored-2025-2-07': '10 cm는0.10 m, 2.5×10^(-5)는0.000025입니다. 최종값은 소수점6자리 조건입니다.',
    'restored-2024-2-10': '① 입구공기, ② 출구공기, ③ 코일 장치노점. 두 식 모두 온도차끼리의 비율입니다.',
    'drill-13': '같은 단위의 절대압력을 곱해 루트를 씁니다. 절대온도 변환과는 다른 문제입니다.',
    'restored-2023-3-02': '온도 변화와 녹기·증발하기의 열을 각각 더합니다.335·2,257은 문제에서 준 잠열입니다.',
    'restored-2024-2-08': '표의 냉방부하를 분자에서 바로 더합니다.1 RT가3.86 kW이므로3.86으로 나눕니다.',
}

SHORT = {
    'foundation-8':'물의 양에 비열과 오른 온도5°C를 곱합니다. kg/s를 사용하므로 답은kW입니다.',
    'drill-10':'물의 양×비열×온도차입니다. 비열 단위의K 때문에273을 더하지 않습니다.',
    'drill-11':'밀도×풍량이 초당 공기 질량입니다. 여기에 비열과 온도차를 곱합니다.',
    'restored-2023-2-02':'선도에서 가열 전19°C, 후28°C를 읽어 온도차9°C를 넣습니다.',
    'supplement-20260916-16':'G는kg/s, c는물 비열입니다. 어프로치는 외기 건구가 아닌 습구온도를 씁니다.',
    'restored-2025-3-06':'1-건조도는 아직 액체인 몫입니다. 그 액체가 증발하며 얻는 열을 계산해RT로 바꿉니다.',
    'foundation-2':'얻는 냉동능력을 넣은 동력으로 나눕니다. COP에는 단위가 없습니다.',
    'foundation-3':'응축기는 증발기에서 받은 열과 압축기가 넣은 일을 합쳐 밖으로 내보냅니다.',
    'drill-07':'COP는 냉동능력÷입력입니다. 응축기 방열량은 두 값을 더합니다.',
    'drill-09':'위는 증발기 냉동효과, 아래는 압축기가 보탠 일입니다. 엔탈피는 온도가 아닙니다.',
    'foundation-11':'대기압760에서 빠진 진공압300을 뺀 뒤, 같은1기압의 환산비로kPa를 구합니다.',
    'drill-08':'전체 열을 냉매1 kg이 가져가는 열로 나누면 초당 필요한냉매kg이 됩니다.',
    'drill-12':'전체 열 중 현열의 비율을 구합니다. 잠열은 전체에서 현열을 뺍니다.',
    'drill-14':'대기압에서 진공압을 빼고mmHg를kPa로 바꿉니다.273은 사용하지 않습니다.',
    'drill-29':'공기1 kg에서 뺀 열에 초당 흐르는 공기kg을 곱합니다.',
    'restored-2026-2-10':'바닥면적과 온도차를 곱한 값으로 전체 손실열을 나눕니다.',
    'restored-2026-1-06':'직선부 두 개에 원둘레 중90/360만큼의 곡선부를 더합니다. π는 원주율입니다.',
    'restored-2025-3-07':'표의 부하를 더하고 두 여유계수를 곱한 뒤, W를kW로 바꿉니다.',
    'restored-2025-2-08':'유량이 늘어난 비율을 원래 회전수에 곱합니다.',
    'restored-2024-3-10':'양쪽에서 이음쇠 길이만큼 줄이되, 나사 물림길이는 다시 남겨 둡니다.',
    'restored-2024-2-05':'열관류율에 바닥면적과 실내·지중 온도차를 곱합니다.',
    'restored-2024-1-06':'RT를시간당 열량으로 바꾼 뒤 냉매1 kg이 가져가는 열로 나눕니다.',
    'restored-2023-3-04':'현열비는 전체 열량 중 현열의 몫입니다.',
    'restored-2023-2-12':'긴 식만Q1(급탕)·Q2(상용)·Q3(정격)로 나눴습니다. 다음 식에는 반올림 전 값을 넣으며, 효율은 기존 복원답안 기준입니다.',
}

def audit_arithmetic():
    pairs = [
        (1*4.18*5,20.9),(2*4.18*5,41.8),(1.2*2*1.005*10,24.12),
        (25*3600/(1.2*1.01*(26-15)),6750.68),(10*1000*4.2*(35-2)/(2*3600*3.86),49.87),
        (1*(2.1*(0-(-10))+335+4.2*(100-0)+2257),3033),(.6*1*(28-19),5.4),
        (1.3*(1-.1)*1675/3.86,507.71),(12/3,4),(12+3,15),(24/6,4),(24+6,30),
        ((400-250)/(450-400),3),((760-300)*101.325/760,61.33),(75/(400-250),.5),
        (21/30,.7),(30-21,9),(sqrt(.2*1.8),.6),((760-380)*101.325/760,50.66),
        ((10*32+30*24)/(10+30),26),(2*(60-40),40),(490/((10*10)*(20-10.2)),.5),
        (200*4.2*(31-28)*2/(60*.95*((40-28)+(40-31))),4.21),
        (2*pi*150*90/360+350+500,1085.62),((9000+10000+2000+1000+4000+2500)*1.5*1.5/1000,64.125),
        (800*2/1.5,1066.67),(9800*1500*10/(3600*1000*.7),58.33),
        ((-8+24*3)/4,16),((.001+.008*3)/4,.00625),(.5*10*10*(20-8.2),590),
        (22.1/3.86,5.73),(12*3.86*3600/(1630-545),153.69),((-5+20*4)/5,15),
        ((.001+.005*4)/5,.0042),(8.3/(8.3+2.8),.75),(3000*4.18*(60-10),627000),
        ((1000*2256+3000*4.18*(60-10))*1.2,3459600),
        ((1000*2256+3000*4.18*(60-10))*1.2*1.15/3600,1105.15),
        ((1000*2256+3000*4.18*(60-10))*1.2*1.15*100/(130*40000),76.51),
    ]
    for actual, expected in pairs:
        assert abs(actual-expected)<.00501, (actual, expected)
    assert isclose(1/(1/.05+.1/.000025+1/.009),.000242,abs_tol=.0000005)
    return len(pairs)+1

def build_story(data, root, width, p, labeled, FractionFormula, math_box, ReadingPhase):
    from reportlab.platypus import Paragraph
    assert set(DIRECT)=={row['prompt']['id'].replace('hvac-practical-','') for row in data['rows']}
    assert set(DIRECT)==set(NOTES)|set(SHORT)
    checks=audit_arithmetic()
    story=[p('공조 필답형 계산\n공식 · 한 번에 대입 · 짧은 해설','title'),
           p('36문제 / 문제와 그림 유지 / 2026-10-25','small'),
           p('먼저 보는 단위 · SI','head')]
    for line in [
        '1 ton=1,000 kg / 1 h=3,600 s / 1 min=60 s / 물1 L≈1 kg.',
        '1 kW=1 kJ/s / W→kW는÷1,000 / 이 문제들의1 RT 환산값은3.86 kW.',
        '시간당 유량→초당 유량은÷3,600. 초당 풍량→시간당 풍량은×3,600.',
        '온도차5°C=5 K입니다. 온도차에273.15를 더하지 않습니다. 혼합온도도 이 자료의 조건에서는 섭씨로 바로 계산합니다.',
        '효율70%는0.70. 기본적으로 최종 답만 소수 셋째 자리에서 반올림해 둘째 자리까지 쓰되, 개별 조건을 우선합니다.',
    ]: story.append(p(line))
    story.extend([p('분수 한 개 = 계산기에서는 한 번의 나누기','head'),
                  FractionFormula(eq('V','25 × 3,600','1.2 × 1.01 × (26 - 15)',' ≈ 6,750.68 m³/h')),
                  p('입력: (25×3600)÷(1.2×1.01×(26-15)). 위 전체와 아래 전체를 각각 괄호로 묶습니다.'),
                  p('중간값을 외워 넣지 않고 문제 숫자를 바로 대입합니다. 곱셈만 있는Q=G×c×Δt는 분수로 만들지 않습니다.'),
                  p('기존 필답 해설의 계산 관계를 합친 풀이입니다. 여러 답을 묻는 아주 긴 식만Q1·Q2처럼 나눕니다.','small'),
                  p('더 자세한 기호·이항·계산 이유는 기존32쪽 상세본에 그대로 남겨 두었습니다.','small'),PageBreak()])
    groups={}
    for row in data['rows']: groups.setdefault(row['lesson']['title'],[]).append(row)
    number=0
    headings=[]
    fraction_sizes=[]
    for ci,ch in enumerate(CHAPTERS,1):
        story.extend([ReadingPhase(''),CondPageBreak(220)])
        heading=p(f'{ci:02d} · '+ch['title'],'title')
        heading.bookmark_key=f'chapter-{ci}'
        heading.bookmark_title=ch['title']
        chapter_heading=heading
        for title in ch['lessons']:
            rows=groups[title]
            for ri,row in enumerate(rows):
                number+=1
                q,l=row['prompt'],row['lesson']
                short=q['id'].replace('hvac-practical-','')
                label=f'{number:02d}. {row["sourceLabel"]}'
                headings.append(label)
                body=[p(title,'questionLabel')] if ri==0 else []
                body.extend([p(f'문제 {number:02d} | {row["sourceLabel"]}'+(' · 시험 우선' if row['examFamilies'] else ''),'questionLabel'),p(q['question'])])
                for asset in ([q['image']] if q.get('image') else [])+q.get('images',[]):
                    path=root/asset
                    if path.suffix.lower()=='.svg': path=root/'tmp/pdfs'/f'{path.stem}.png'
                    with PILImage.open(path) as im: iw,ih=im.size
                    scale=min((width-20)/iw,140/ih)
                    img=Image(str(path),iw*scale,ih*scale); img.hAlign='CENTER'
                    body.extend([img,Spacer(1,5)])
                panel=Table([[body]],colWidths=[width])
                panel.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),HexColor('#edf3fb')),('BOX',(0,0),(-1,-1),.6,HexColor('#688bb2')),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
                solution=[ReadingPhase(f'해설 {number:02d} | {row["sourceLabel"]}'),p(f'해설 {number:02d} | 한 번에 대입','solutionLabel')]
                if l['kind']!='formula':
                    solution.append(p('공식','small'))
                    formula=FORMULAS.get(title) or [x['parts'] for x in l.get('formulaFractions',[])] or [[l['formula']]]
                    if title=='COP와 응축기 방열량' and short=='foundation-2': formula=[eq('COP','Qe','L')]
                    if short=='foundation-3': formula=[['Qc = Qe + L']]
                    if short=='drill-11': formula=[['Q = ρ × V × c × Δt']]
                    for parts in formula: solution.append(FractionFormula(parts))
                    solution.append(p('한 번에 대입','small'))
                for parts in DIRECT[short]:
                    flow=FractionFormula(parts)
                    flow.wrap(width,999)
                    fraction_sizes.append(11*flow.scale)
                    solution.append(flow)
                if l.get('examAnswer'): solution.append(labeled('답',l['examAnswer'],'answer'))
                explanation=NOTES.get(short) or SHORT.get(short)
                if explanation: solution.append(labeled('짧은 해설',explanation))
                used=l['numberSelection']
                if used.get('unused'): solution.append(labeled('넣지 않는 값',used['unused'],'small'))
                rounding=l.get('rounding','')
                if rounding and not rounding.startswith('제공된 채점 안내의 기본 조건'): solution.append(p(rounding,'small'))
                caution=l.get('caution','')
                if '문항 ID의 09' in caution: caution='교재의 개별 조건: 절대습도는 소수점 셋째 자리까지.0.0042 → 0.004.'
                if caution and short in ['restored-2023-2-12','restored-2024-1-09','restored-2024-3-07']:
                    solution.append(labeled('주의',caution,'small'))
                solution.append(Spacer(1,7))
                height=panel.wrap(width,999)[1]+sum(x.wrap(width,999)[1]+x.getSpaceBefore()+x.getSpaceAfter() for x in solution)
                pair=[ReadingPhase(f'문제 {number:02d} | {row["sourceLabel"]}'),panel,*solution]
                if chapter_heading is not None:
                    height+=chapter_heading.wrap(width,999)[1]+chapter_heading.getSpaceAfter()
                    pair.insert(0,chapter_heading)
                    chapter_heading=None
                if height<650: story.append(KeepTogether(pair))
                else: story.extend([CondPageBreak(panel.wrap(width,999)[1]+100),*pair])
    story.extend([ReadingPhase(''),p('표기 기준: 기존 문제·그림·최종 답과 문제별 반올림 조건을 유지했습니다. 상당증발량·효율의 복원 불확실성도 각 문항에 남겼습니다.','reference')])
    assert min(fraction_sizes)>=10.5, min(fraction_sizes)
    return story, headings, number, checks
