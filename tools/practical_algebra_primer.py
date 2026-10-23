"""Beginner algebra pages; uses the booklet's existing text and fraction drawing."""
from reportlab.platypus import PageBreak, KeepTogether


def build_algebra_primer(p, FractionFormula):
    story=[]

    def heading(title, intro):
        story.extend([p(title,'title'),p(intro,'small')])

    def block(title, explanation, equations=(), after=None):
        content=[p(title,'head'),p(explanation)]
        for equation in equations:
            content.append(FractionFormula(equation) if isinstance(equation,list) else p(equation,'formula'))
        if after: content.append(p(after))
        story.append(KeepTogether(content))

    def f(top,bottom):
        return {'top':[top] if isinstance(top,str) else top,'bottom':[bottom] if isinstance(bottom,str) else bottom}

    heading('식 읽기와 이항 · 이것만 먼저','공식은 양들의 관계를 글자로 적은 것입니다. 모르는 글자만 남기면 답을 구할 수 있습니다.')
    block('글자는 숫자 자리, =는 양쪽이 같다는 뜻',
          'Q나 G, x는 양의 이름입니다. 아는 숫자를 넣는 것이 대입. x+3=8에 x=5를 넣어 5+3=8인지 확인하는 것이 검산입니다.')
    block('왜 더하고 곱할까요?',
          '+는 합치기: 열 12+3=15. -는 차이: 30°C-20°C=10°C.\n×는 같은 몫 모으기: 1 kg당 10 kJ인 물 3 kg에는 10×3=30 kJ.\n÷는 몫 찾기: 총열 30 kJ÷1 kg당 10 kJ=3 kg.')
    block('붙어 있는 글자와 괄호 읽기',
          '3x=3×x, GcΔt=G×c×Δt입니다. Δt는 온도차 한 값. x와 ×는 다릅니다. 괄호 → 곱셈·나눗셈 → 덧셈·뺄셈 순서입니다. 같은 순위는 왼쪽부터. 2+3×4=14, (2+3)×4=20입니다.')
    block('양쪽에 같은 계산을 하면 x만 남습니다',
          '양팔저울을 생각하세요. 한쪽만 바꾸면 같지 않습니다. 더해진 것은 양쪽에서 빼고, 곱해진 것은 양쪽을 나눕니다.',
          ['x + 5 = 12 → 양쪽 -5 → x = 7\nx - 5 = 12 → 양쪽 +5 → x = 17\n3 × x = 12 → 양쪽 ÷3 → x = 4\nx ÷ 3 = 4 → 양쪽 ×3 → x = 12'],
          '+5가 반대편에서 -5로 보이는 정리가 이항입니다. 곱해진 3은 -3으로 바꾸지 않습니다. 0으로는 나눌 수 없습니다.')
    block('모르는 글자가 분모에 있으면?',
          '12÷x=4에서 양쪽에 x를 곱하면 12=4×x. 다시 양쪽을 4로 나눕니다.',
          [[f('12','x'),' = 4 → 12 = 4 × x → x = ',f('12','4'),' = 3']],
          '검산: 12÷3=4. 분모의 x를 그냥 올린 것이 아니라 같은 계산을 양쪽에 했습니다.')
    block('c를 구할 때 Q는 어디에 남을까요?',
          'Q = G × c × Δt에서 양쪽을 G×Δt로 나눕니다. Q는 왼쪽 분자에 남습니다.',
          [[f('Q','G × Δt'),' = ',f('G × c × Δt','G × Δt')],
           [f('Q','G × Δt'),' = c × 1 = c  →  c = ',f('Q','G × Δt')]],
          '오른쪽의 (G×Δt)÷(G×Δt)=1이라 c만 남습니다. Q는 약분하지 않았습니다! 마지막은 등호 양쪽 자리만 바꿨습니다. 분수를 뒤집은 게 아닙니다.\n'
          'c/1=c. 분모 1은 빈칸이 아닙니다. Q/1을 G×Δt로 나누면 분모는 1×G×Δt가 됩니다. (G×Δt≠0)')
    story.append(PageBreak())

    heading('Q = G × c × Δt · 한 문제로 식 바꾸기','예제: 열 41.8 kJ로 물의 온도를 5°C 올렸습니다. 물의 비열이 4.18일 때 물은 몇 kg일까요?')
    block('공식의 글자를 먼저 읽습니다',
          'Q(큐)=열량[kJ], G(지)=질량[kg], c(씨)=비열[kJ/(kg·℃)], Δt(델타 티)=온도차[℃]. 물의 양 × 1 kg을 1℃ 데우는 열 × 올릴 온도입니다.',
          ['Q = G × c × Δt'],
          'Δt는 한 값입니다. G에 kg/s를 넣는 흐름 문제라면 결과 Q도 kJ/s, 즉 kW가 됩니다.')
    block('숫자를 아는 자리부터 채웁니다',
          '모르는 물의 양 G만 글자로 남깁니다. 비열 4.18 × 온도차 5 = 20.9는 물 1 kg을 5℃ 데우는 데 필요한 열입니다.',
          ['41.8 = G × 4.18 × 5 = G × 20.9'])
    block('양쪽을 20.9로 나누면 G만 남습니다',
          '총열 41.8 안에 “1 kg당 필요한 열 20.9”가 몇 몫인지 나눕니다. 등식도 양쪽을 20.9로 나누면 됩니다.',
          [[f('41.8','20.9'),' = ',f('G × 20.9','20.9')],
           ['G = ',f('Q','c × Δt'),' = ',f('41.8','4.18 × 5'),' = 2 kg']],
          '20.9÷20.9=1이라서 G만 남습니다. 계산기 입력: 41.8÷(4.18×5). 괄호 없이 41.8÷4.18×5를 누르면 50이므로 틀립니다.')
    block('답의 단위가 kg인 이유와 검산',
          '비열×온도차에서 ℃가 약분되어 kJ/kg가 남습니다. 열량 kJ를 1 kg당 열 kJ/kg로 나누면 kg입니다.',
          [[f('kJ','kJ/kg'),' = kg'],'검산: 2 × 4.18 × 5 = 41.8 kJ'],
          '검산은 구한 2 kg을 원래 식에 넣어 처음 열량 41.8 kJ가 나오는지 보는 것입니다.')
    block('온도차 Δt를 모른다면?',
          '이번에는 Δt 옆에 곱해진 G×c로 양쪽을 나눕니다.',
          [['Δt = ',f('Q','G × c'),' = ',f('41.8','2 × 4.18'),' = 5 °C']],
          '비열은 c=Q÷(G×Δt). 온도차 5℃는 최종 온도가 아닙니다. 처음 15℃에서 5℃ 올렸으면 15+5=20℃입니다.')
    story.append(PageBreak())

    return story
