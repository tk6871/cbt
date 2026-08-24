import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

const fixes = [
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20231',
    number: 60,
    patch: {
      text: '다음 중 기계설비 기술기준에서 정하는 기계설비에 해당하지 않는 것은?',
      html: '다음 중 기계설비 기술기준에서 정하는 기계설비에 해당하지 않는 것은?',
      choices: [
        { text: '우수배수설비', html: '우수배수설비', images: [] },
        { text: '플랜트설비', html: '플랜트설비', images: [] },
        { text: '가스설비', html: '가스설비', images: [] },
        { text: '오수정화설비', html: '오수정화설비', images: [] },
      ],
      answer: 3,
      explanation:
        '이 문제는 기계설비 기술기준의 설비 목록에 없는 것을 찾는 문제입니다. 우수배수설비, 플랜트설비, 오수정화설비는 기술기준에 포함되지만 가스설비는 이 목록에 포함되지 않습니다. 따라서 정답은 ③ 가스설비입니다.',
      explanationHtml:
        '이 문제는 기계설비 기술기준의 설비 목록에 없는 것을 찾는 문제입니다.<br>우수배수설비, 플랜트설비, 오수정화설비는 기술기준에 포함되지만 가스설비는 이 목록에 포함되지 않습니다.<br>따라서 정답은 ③ 가스설비입니다.',
      explanationConfidence: 'high',
      correctionSource: '국가법령정보센터 기계설비 기술기준 및 2023년 1회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20261',
    number: 14,
    patch: {
      text: '냉각수 출입구 온도차를 5℃, 냉각수의 처리 열량을 4.55kW로 하면 냉각수량(L/min)은? (단, 냉각수의 비열은 4.2kJ/kg·℃로 한다.)',
      html: '냉각수 출입구 온도차를 5℃, 냉각수의 처리 열량을 4.55kW로 하면 냉각수량(L/min)은? (단, 냉각수의 비열은 4.2kJ/kg·℃로 한다.)',
      choices: [
        { text: '10', html: '10', images: [] },
        { text: '13', html: '13', images: [] },
        { text: '18', html: '18', images: [] },
        { text: '20', html: '20', images: [] },
      ],
      answer: 2,
      explanation:
        '열수량식 Q=ṁcΔt를 사용합니다. 냉각수량은 4.55kW÷(4.2kJ/kg·℃×5℃)=0.2167kg/s입니다. 물 1kg은 약 1L이므로 0.2167×60=약 13L/min입니다. 따라서 정답은 ②입니다.',
      explanationHtml:
        '열수량식 Q=ṁcΔt를 사용합니다.<br>냉각수량은 4.55kW÷(4.2kJ/kg·℃×5℃)=0.2167kg/s입니다.<br>물 1kg은 약 1L이므로 0.2167×60=약 13L/min입니다. 따라서 정답은 ②입니다.',
      explanationConfidence: 'high',
      correctionSource: '2026년 1회 수정 배포 PDF',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20262',
    number: 14,
    patch: {
      text: '복사난방에서 바닥패널의 적당한 온도는 얼마인가?',
      html: '복사난방에서 바닥패널의 적당한 온도는 얼마인가?',
      choices: [
        { text: '80℃', html: '80℃', images: [] },
        { text: '60℃', html: '60℃', images: [] },
        { text: '50℃', html: '50℃', images: [] },
        { text: '30℃', html: '30℃', images: [] },
      ],
      answer: 4,
      explanation:
        '바닥복사난방은 넓은 바닥에서 낮은 온도의 복사열을 고르게 전달합니다. 바닥패널 온도를 너무 높이면 발이 불편하고 실내가 과열될 수 있으므로 약 30℃가 적당합니다. 수정 배포 답안표도 ④를 제시하므로 정답은 ④ 30℃입니다.',
      explanationHtml:
        '바닥복사난방은 넓은 바닥에서 낮은 온도의 복사열을 고르게 전달합니다.<br>바닥패널 온도를 너무 높이면 발이 불편하고 실내가 과열될 수 있으므로 약 30℃가 적당합니다.<br>수정 배포 답안표도 ④를 제시하므로 정답은 ④ 30℃입니다.',
      explanationConfidence: 'high',
      correctionSource: '2026년 2회 수정 배포 PDF 답안표 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20211',
    number: 32,
    patch: {
      text: '매시간 30℃의 물 2000kg을 -10℃의 얼음으로 만드는 냉동장치가 있다. 이 냉동장치의 냉각수 입구온도가 32℃, 냉각수 출구온도가 37℃이며, 냉각수량이 60m³/h일 때, 압축기의 소요동력은 얼마인가?',
      html: '매시간 30℃의 물 2000kg을 -10℃의 얼음으로 만드는 냉동장치가 있다. 이 냉동장치의 냉각수 입구온도가 32℃, 냉각수 출구온도가 37℃이며, 냉각수량이 60m³/h일 때, 압축기의 소요동력은 얼마인가?',
      choices: [
        { text: '83kW', html: '83kW', images: [] },
        { text: '88kW', html: '88kW', images: [] },
        { text: '90kW', html: '90kW', images: [] },
        { text: '117kW', html: '117kW', images: [] },
      ],
      answer: 1,
      explanationConfidence: 'high',
      correctionSource: '2021년 1회 배포 PDF 대조 및 잘린 원문 이미지 복원',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20211',
    number: 52,
    patch: {
      text: '120Ω의 저항 4개를 접속하여 가장 작은 저항값을 얻기 위한 회로 접속법은 어느 것인가?',
      html: '120Ω의 저항 4개를 접속하여 가장 작은 저항값을 얻기 위한 회로 접속법은 어느 것인가?',
      choices: [
        { text: '직렬접속', html: '직렬접속', images: [] },
        { text: '병렬접속', html: '병렬접속', images: [] },
        { text: '직병렬접속', html: '직병렬접속', images: [] },
        { text: '병직렬접속', html: '병직렬접속', images: [] },
      ],
      answer: 2,
      explanation:
        '같은 저항을 병렬로 연결할수록 전체 저항은 작아집니다. 120Ω 저항 4개를 모두 병렬로 연결하면 합성저항은 120÷4=30Ω으로 가장 작으므로 정답은 ②입니다.',
      explanationHtml:
        '같은 저항을 병렬로 연결할수록 전체 저항은 작아집니다.<br>120Ω 저항 4개를 모두 병렬로 연결하면 합성저항은 120÷4=30Ω으로 가장 작으므로 정답은 ②입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 1회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20211',
    number: 55,
    patch: {
      text: '그림과 같은 논리회로의 출력 Y는?',
      html: '그림과 같은 논리회로의 출력 Y는?',
      choices: [
        { text: 'Y = AB + AB̅', html: 'Y = AB + AB̅', images: [] },
        { text: 'Y = A̅B + AB', html: 'Y = A̅B + AB', images: [] },
        { text: 'Y = A̅B + AB̅', html: 'Y = A̅B + AB̅', images: [] },
        { text: 'Y = A̅B̅ + AB̅', html: 'Y = A̅B̅ + AB̅', images: [] },
      ],
      images: [],
      answer: 1,
      explanation:
        '위쪽 AND 게이트는 A와 B의 반전값을 받아 AB̅가 되고, 아래쪽 AND 게이트는 A와 B를 받아 AB가 됩니다. 두 출력을 OR로 더하면 Y=AB+AB̅이므로 정답은 ①입니다.',
      explanationHtml:
        '위쪽 AND 게이트는 A와 B의 반전값을 받아 AB̅가 되고, 아래쪽 AND 게이트는 A와 B를 받아 AB가 됩니다.<br>두 출력을 OR로 더하면 Y=AB+AB̅이므로 정답은 ①입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 1회 배포 PDF 대조 및 원문 이미지 복원',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20212',
    number: 25,
    patch: {
      text: '몰리에르 선도상에서 건조도 x에 관한 설명으로 옳은 것은?',
      html: '몰리에르 선도상에서 건조도 x에 관한 설명으로 옳은 것은?',
      choices: [
        { text: '몰리에르 선도의 포화액선상 건조도는 1이다.', html: '몰리에르 선도의 포화액선상 건조도는 1이다.', images: [] },
        { text: '액체 70%, 증기 30%인 냉매의 건조도는 0.70이다.', html: '액체 70%, 증기 30%인 냉매의 건조도는 0.70이다.', images: [] },
        { text: '건조도는 습포화증기 구역 내에서만 존재한다.', html: '건조도는 습포화증기 구역 내에서만 존재한다.', images: [] },
        { text: '건조도라 함은 과열증기 중 증기에 대한 포화액체의 양을 말한다.', html: '건조도라 함은 과열증기 중 증기에 대한 포화액체의 양을 말한다.', images: [] },
      ],
      answer: 3,
      explanation:
        '건조도는 습증기 속에서 증기가 차지하는 질량비입니다. 액체와 증기가 함께 있는 습포화증기 구역에서만 의미가 있으므로 정답은 ③입니다.',
      explanationHtml:
        '건조도는 습증기 속에서 증기가 차지하는 질량비입니다.<br>액체와 증기가 함께 있는 습포화증기 구역에서만 의미가 있으므로 정답은 ③입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 2회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20212',
    number: 31,
    patch: {
      answer: 2,
      explanation:
        '팽창밸브 개도를 작게 하면 증발기로 들어가는 냉매가 줄어 냉동능력과 압축기 흡입압력이 내려갑니다. 냉매가 적게 들어오므로 증발기 출구의 과열도는 커질 수 있지만, 액 냉매가 압축기로 들어가 생기는 액압축은 일어나기 어렵습니다. 따라서 발생 현상과 가장 거리가 먼 것은 ② 증발기에서 액압축이 일어난다입니다.',
      explanationHtml:
        '팽창밸브 개도를 작게 하면 증발기로 들어가는 냉매가 줄어 냉동능력과 압축기 흡입압력이 내려갑니다.<br>냉매가 적게 들어오므로 증발기 출구의 과열도는 커질 수 있지만, 액 냉매가 압축기로 들어가 생기는 액압축은 일어나기 어렵습니다.<br>따라서 발생 현상과 가장 거리가 먼 것은 ② 증발기에서 액압축이 일어난다입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 2회 원문 이미지와 적용 정답 재대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20212',
    number: 58,
    patch: {
      answer: 1,
      explanation:
        '서지 전압은 순간적으로 매우 크게 치솟는 이상 전압입니다. 바리스터는 전압이 급상승하면 저항이 작아져 서지 전류를 흘려 보내므로 보호용으로 사용합니다. 따라서 정답은 ①입니다.',
      explanationHtml:
        '서지 전압은 순간적으로 매우 크게 치솟는 이상 전압입니다.<br>바리스터는 전압이 급상승하면 저항이 작아져 서지 전류를 흘려 보내므로 보호용으로 사용합니다. 따라서 정답은 ①입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 2회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20213',
    number: 2,
    patch: {
      text: '에어와셔에서 공기의 입·출구 엔탈피를 i₁, i₂, 입·출구 수온을 tw₁, tw₂라 할 때 수공기비(L/G)를 나타낸 것은? (단, L: 수량, G: 공기량)',
      html: '에어와셔에서 공기의 입·출구 엔탈피를 i₁, i₂, 입·출구 수온을 tw₁, tw₂라 할 때 수공기비(L/G)를 나타낸 것은? (단, L: 수량, G: 공기량)',
      choices: [
        { text: 'L/G = (i₁-i₂)/(tw₂-tw₁)', html: 'L/G = (i₁-i₂)/(tw₂-tw₁)', images: [] },
        { text: 'L/G = (tw₂-tw₁)/(i₁-i₂)', html: 'L/G = (tw₂-tw₁)/(i₁-i₂)', images: [] },
        { text: 'L/G = (tw₁-tw₂)·(i₁-i₂)', html: 'L/G = (tw₁-tw₂)·(i₁-i₂)', images: [] },
        { text: 'L/G = (i₁-i₂)·(tw₂-tw₁)', html: 'L/G = (i₁-i₂)·(tw₂-tw₁)', images: [] },
      ],
      answer: 1,
      explanation:
        '수공기비 L/G는 물이 잃은 열량과 공기가 얻은 열량이 같다는 열수지에서 구합니다. 따라서 L/G=(i₁-i₂)/(tᴡ₂-tᴡ₁)가 되어 정답은 ①입니다.',
      explanationHtml:
        '수공기비 L/G는 물이 잃은 열량과 공기가 얻은 열량이 같다는 열수지에서 구합니다.<br>따라서 L/G=(i₁-i₂)/(t<sub>w2</sub>-t<sub>w1</sub>)가 되어 정답은 ①입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 3회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20213',
    number: 44,
    patch: {
      answer: 1,
      explanation:
        '리드관 접합에 사용하는 공구에는 익스팬더, 플레어링 툴, 벤딩 툴 등이 있습니다. 사이징 툴은 관의 치수를 바로잡는 공구로서 이 접합 작업에 사용하는 공구가 아니므로 정답은 ①입니다.',
      explanationHtml:
        '리드관 접합에 사용하는 공구에는 익스팬더, 플레어링 툴, 벤딩 툴 등이 있습니다.<br>사이징 툴은 관의 치수를 바로잡는 공구로서 이 접합 작업에 사용하는 공구가 아니므로 정답은 ①입니다.',
      explanationConfidence: 'high',
      correctionSource: '2021년 3회 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20221',
    number: 46,
    patch: {
      text: '캐비테이션 현상의 발생원인으로 옳지 않은 것은?',
      html: '캐비테이션 현상의 발생원인으로 옳지 않은 것은?',
      choices: [
        { text: '흡입양정이 작을 경우', html: '흡입양정이 작을 경우', images: [] },
        { text: '액체 온도가 높을 경우', html: '액체 온도가 높을 경우', images: [] },
        { text: '날개차의 원주속도가 클 경우', html: '날개차의 원주속도가 클 경우', images: [] },
        { text: '날개차의 모양이 적당하지 않을 경우', html: '날개차의 모양이 적당하지 않을 경우', images: [] },
      ],
      answer: 1,
      explanation:
        '캐비테이션은 펌프 흡입부의 압력이 너무 낮아질 때 발생합니다. 흡입양정이 크거나, 액체 온도와 날개차 속도가 높을수록 발생하기 쉽습니다. 따라서 발생 원인이 아닌 것은 흡입양정이 작은 경우인 ①입니다.',
      explanationHtml:
        '캐비테이션은 펌프 흡입부의 압력이 너무 낮아질 때 발생합니다.<br>흡입양정이 크거나, 액체 온도와 날개차 속도가 높을수록 발생하기 쉽습니다. 따라서 발생 원인이 아닌 것은 흡입양정이 작은 경우인 ①입니다.',
      explanationConfidence: 'high',
      correctionSource: '2022년 1회 배포 PDF 대조 및 원문 이미지 복원',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20222',
    number: 33,
    patch: {
      text: '12kW 펌프의 회전수가 800rpm, 토출량 1.5m³/min인 경우 펌프의 토출량을 1.8m³/min으로 하기 위하여 회전수를 얼마로 변화하면 되는가?',
      html: '12kW 펌프의 회전수가 800rpm, 토출량 1.5m³/min인 경우 펌프의 토출량을 1.8m³/min으로 하기 위하여 회전수를 얼마로 변화하면 되는가?',
      choices: [
        { text: '850rpm', html: '850rpm', images: [] },
        { text: '960rpm', html: '960rpm', images: [] },
        { text: '1025rpm', html: '1025rpm', images: [] },
        { text: '1365rpm', html: '1365rpm', images: [] },
      ],
      answer: 2,
      explanation:
        '같은 펌프에서는 토출량이 회전수에 비례합니다. N₂=800×(1.8÷1.5)=960rpm이므로 정답은 ②입니다.',
      explanationHtml:
        '같은 펌프에서는 토출량이 회전수에 비례합니다.<br>N₂=800×(1.8÷1.5)=960rpm이므로 정답은 ②입니다.',
      explanationConfidence: 'high',
      correctionSource: '2022년 2회 배포 PDF 대조 및 원문 이미지 복원',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20223',
    number: 5,
    patch: {
      text: '다음 난방방식 중 자연환기가 많이 일어나도 비교적 난방효율이 좋은 것은?',
      html: '다음 난방방식 중 자연환기가 많이 일어나도 비교적 난방효율이 좋은 것은?',
      choices: [
        { text: '온수난방', html: '온수난방', images: [] },
        { text: '증기난방', html: '증기난방', images: [] },
        { text: '온풍난방', html: '온풍난방', images: [] },
        { text: '복사난방', html: '복사난방', images: [] },
      ],
      answer: 4,
      explanation:
        '자연환기가 많으면 데운 공기가 빠져나가지만, 복사난방은 공기보다 사람과 물체를 직접 데워 그 영향을 덜 받습니다. 따라서 비교적 난방효율이 좋은 복사난방 ④가 정답입니다.',
      explanationHtml:
        '자연환기가 많으면 데운 공기가 빠져나가지만, 복사난방은 공기보다 사람과 물체를 직접 데워 그 영향을 덜 받습니다.<br>따라서 비교적 난방효율이 좋은 복사난방 ④가 정답입니다.',
      explanationConfidence: 'high',
      correctionSource: '2022년 3회 수정 배포 PDF 대조',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20223',
    number: 6,
    patch: {
      text: '감습장치에 해당되지 않는 것은?',
      html: '감습장치에 해당되지 않는 것은?',
      choices: [
        { text: '냉각감습장치', html: '냉각감습장치', images: [] },
        { text: '흡착감습장치', html: '흡착감습장치', images: [] },
        { text: '흡수식감습장치', html: '흡수식감습장치', images: [] },
        { text: '가열감습장치', html: '가열감습장치', images: [] },
      ],
      answer: 4,
      explanation:
        '감습은 공기 중 수분을 줄이는 과정입니다. 냉각으로 수증기를 응축하거나 흡착제·흡수액으로 수분을 제거할 수 있지만, 단순히 가열하면 상대습도만 낮아질 뿐 수분량은 줄지 않습니다. 따라서 감습장치가 아닌 것은 ④ 가열감습장치입니다.',
      explanationHtml:
        '감습은 공기 중 수분을 줄이는 과정입니다.<br>냉각으로 수증기를 응축하거나 흡착제·흡수액으로 수분을 제거할 수 있지만, 단순히 가열하면 상대습도만 낮아질 뿐 수분량은 줄지 않습니다.<br>따라서 감습장치가 아닌 것은 ④ 가열감습장치입니다.',
      explanationConfidence: 'high',
      correctionSource: '2022년 3회 수정 배포 PDF 대조 및 중복 원문 이미지 교체',
    },
  },
  {
    file: 'hvac.js',
    globalName: 'CBT_DATA_HVAC',
    catalogKey: 'hvac',
    roundId: 'hvac-20233',
    number: 3,
    patch: {
      text: '다음 기술내용은 온수난방의 특징을 기술한 것이다. 적합하지 못한 항목은?',
      html: '다음 기술내용은 온수난방의 특징을 기술한 것이다. 적합하지 못한 항목은?',
      choices: [
        { text: '온수온도를 계절적으로 중앙기계실에서 자동적으로 용이하게 조절할 수 있다.', html: '온수온도를 계절적으로 중앙기계실에서 자동적으로 용이하게 조절할 수 있다.', images: [] },
        { text: '연속 운전 시 종합 열손실이 크다.', html: '연속 운전 시 종합 열손실이 크다.', images: [] },
        { text: '증기난방보다 일반적으로 설비비가 많이 든다.', html: '증기난방보다 일반적으로 설비비가 많이 든다.', images: [] },
        { text: '저온방열이므로 안전하고 양호한 온열환경이 얻어진다.', html: '저온방열이므로 안전하고 양호한 온열환경이 얻어진다.', images: [] },
      ],
      answer: 2,
      explanationConfidence: 'high',
      correctionSource: '2023년 3회 배포 PDF의 열 나눔 문제를 한 장으로 복원',
    },
  },
  {
    file: 'safety.js',
    globalName: 'CBT_DATA_SAFETY',
    catalogKey: 'safety',
    date: '20060806',
    number: 14,
    patch: {
      text: '사업장에서 시행되는 교육훈련의 직접 목적으로 볼 수 없는 것은?',
      html: '사업장에서 시행되는 교육훈련의 직접 목적으로 볼 수 없는 것은?',
      answer: 4,
      explanation:
        '교육훈련의 직접 목적은 기업 측면의 능률 향상·인재 육성과 종업원 측면의 생활 향상·인간 완성입니다. 기업의 유지·발전은 교육훈련의 결과로 얻는 간접 목적이므로 정답은 ④입니다.',
      explanationHtml:
        '교육훈련의 직접 목적은 기업 측면의 능률 향상·인재 육성과 종업원 측면의 생활 향상·인간 완성입니다.<br>기업의 유지·발전은 교육훈련의 결과로 얻는 간접 목적이므로 정답은 ④입니다.',
    },
  },
  {
    file: 'energy.js',
    globalName: 'CBT_DATA_ENERGY',
    catalogKey: 'energy',
    date: '20020526',
    number: 5,
    patch: {
      text: '다음 중 이론연소온도(화염온도) t℃를 구하는 식은? (단, H\nh\n: 고발열량, Hℓ : 저발열량, G\nT\n: 연소가스, C\nP\n: 비열)',
      html: '다음 중 이론연소온도(화염온도) t℃를 구하는 식은? (단, H<sub>h</sub> : 고발열량, Hℓ : 저발열량, G<sub>T</sub> : 연소가스, C<sub>P</sub> : 비열)',
      answer: 1,
      explanation:
        '이론연소온도는 저발열량이 연소가스가 받아들이는 현열과 같다고 놓아 구합니다. Hℓ = G_T × C_p × t 이므로, t = Hℓ ÷ (G_T × C_p)입니다. 따라서 정답은 ①입니다.',
      explanationHtml:
        '이론연소온도는 저발열량이 연소가스가 받아들이는 현열과 같다고 놓아 구합니다.<br>Hℓ = G<sub>T</sub> × C<sub>p</sub> × t 이므로, t = Hℓ ÷ (G<sub>T</sub> × C<sub>p</sub>)입니다.<br>따라서 정답은 ①입니다.',
    },
  },
  {
    file: 'maintenance.js',
    globalName: 'CBT_DATA_MAINTENANCE',
    catalogKey: 'maintenance',
    date: '20050306',
    number: 76,
    patch: {
      answer: 3,
      explanation:
        '리드는 나사가 1회전할 때 축 방향으로 이동하는 거리입니다. 2줄 나사의 리드 = 줄 수 × 피치 = 2 × 2 mm = 4 mm입니다. 문제의 10회전은 총 이동거리 40 mm를 뜻할 뿐, 리드에는 곱하지 않습니다. 따라서 정답은 ③입니다.',
      explanationHtml:
        '리드는 나사가 1회전할 때 축 방향으로 이동하는 거리입니다.<br>2줄 나사의 리드 = 줄 수 × 피치 = 2 × 2 mm = 4 mm입니다.<br>문제의 10회전은 총 이동거리 40 mm를 뜻할 뿐, 리드에는 곱하지 않습니다. 따라서 정답은 ③입니다.',
    },
  },
  {
    file: 'jewelry.js',
    globalName: 'CBT_DATA_JEWELRY',
    catalogKey: 'gem-appraiser',
    date: '20090712',
    number: 25,
    patch: {
      explanation:
        '다이아몬드의 D-to-Z 컬러 그레이딩에서는 광원과 그레이딩 트레이 사이를 약 8~10인치(약 20~25cm)로 유지합니다. 보기 중 이 범위에 가장 가까운 값은 약 20cm이므로 정답은 ③입니다.',
      explanationHtml:
        '다이아몬드의 D-to-Z 컬러 그레이딩에서는 광원과 그레이딩 트레이 사이를 약 8~10인치(약 20~25cm)로 유지합니다.<br>보기 중 이 범위에 가장 가까운 값은 약 20cm이므로 정답은 ③입니다.',
      explanationBasis: 'source-correction-and-gia-standard',
    },
  },
];

for (const fix of fixes) {
  const filePath = path.join(root, 'data', fix.file);
  const source = fs.readFileSync(filePath, 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: fix.file });
  const exported = context.window[fix.globalName];
  const catalogs = Array.isArray(exported) ? exported : [exported];
  const catalog = catalogs.find((item) => item?.key === fix.catalogKey);
  const round = catalog?.rounds?.find((item) => fix.roundId ? item.id === fix.roundId : item.date === fix.date);
  const question = round?.questions?.find((item) => item.number === fix.number);
  if (!question) throw new Error(`${fix.catalogKey} ${fix.date} ${fix.number}번 문항을 찾지 못했습니다.`);

  const before = JSON.stringify(question);
  const after = JSON.stringify({ ...question, ...fix.patch });
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${fix.file}: 대상 문항의 원문 범위를 하나로 특정하지 못했습니다.`);
  }
  fs.writeFileSync(filePath, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
  console.log(`${fix.catalogKey} ${fix.roundId || fix.date} ${fix.number}번 반영 완료`);
}
