import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

const fixes = [
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
  const round = catalog?.rounds?.find((item) => item.date === fix.date);
  const question = round?.questions?.find((item) => item.number === fix.number);
  if (!question) throw new Error(`${fix.catalogKey} ${fix.date} ${fix.number}번 문항을 찾지 못했습니다.`);

  const before = JSON.stringify(question);
  const after = JSON.stringify({ ...question, ...fix.patch });
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${fix.file}: 대상 문항의 원문 범위를 하나로 특정하지 못했습니다.`);
  }
  fs.writeFileSync(filePath, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
  console.log(`${fix.catalogKey} ${fix.date} ${fix.number}번 반영 완료`);
}
