import fs from 'node:fs';

function readObject(path) {
  const source = fs.readFileSync(path, 'utf8');
  const start = source.indexOf('= {', source.indexOf('export const')) + 2;
  const end = source.lastIndexOf('}') + 1;
  if (start < 2 || end <= start) throw new Error(`${path}에서 좌표 객체를 찾지 못했습니다.`);
  return JSON.parse(source.slice(start, end));
}

const generated = readObject('src/cbt/generatedHvacHotspots.ts');
const reviewed = readObject('src/cbt/reviewedHvacHotspots.ts');
const segmentsArgument = process.argv.indexOf('--segments');
const segmentsPath = segmentsArgument >= 0
  ? process.argv[segmentsArgument + 1]
  : 'src/cbt/generatedHvacAnswerSegments.ts';
const segments = readObject(segmentsPath);
const hotspots = { ...generated, ...reviewed };
const errors = [];
const missingImages = [];
const missingChoices = [];
let segmentCount = 0;
let multiLineChoices = 0;
let unifiedBoxCount = 0;
let unifiedOverlapCount = 0;
let containedSegmentCount = 0;

function intersection(left, right) {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const edgeX = Math.min(left.x + left.width, right.x + right.width);
  const edgeY = Math.min(left.y + left.height, right.y + right.height);
  return { width: edgeX - x, height: edgeY - y };
}

function unifiedAnswerHotspot(hotspot, choiceSegments) {
  if (!choiceSegments.length) return { ...hotspot };
  const x = Math.min(...choiceSegments.map((segment) => segment.x));
  const y = Math.min(...choiceSegments.map((segment) => segment.y));
  const right = Math.max(...choiceSegments.map((segment) => segment.x + segment.width));
  const bottom = Math.max(...choiceSegments.map((segment) => segment.y + segment.height));
  return { choice: hotspot.choice, x, y, width: right - x, height: bottom - y };
}

function unifiedAnswerHotspots(imageHotspots, imageSegments = {}) {
  const boxes = imageHotspots.map((hotspot) => unifiedAnswerHotspot(hotspot, imageSegments[hotspot.choice] || []));
  const minX = Math.min(...imageHotspots.map((hotspot) => hotspot.x));
  const maxX = Math.max(...imageHotspots.map((hotspot) => hotspot.x));
  const twoColumns = maxX - minX > 24;
  const columns = twoColumns
    ? [boxes.filter((box) => box.choice === 1 || box.choice === 3), boxes.filter((box) => box.choice === 2 || box.choice === 4)]
    : [boxes];
  if (twoColumns) {
    const [leftColumn, rightColumn] = columns;
    const leftEdge = Math.max(...leftColumn.map((box) => box.x + box.width));
    const rightEdge = Math.min(...rightColumn.map((box) => box.x));
    if (leftEdge > rightEdge) {
      const boundary = (leftEdge + rightEdge) / 2;
      for (const box of leftColumn) box.width = Math.min(box.width, boundary - box.x);
      for (const box of rightColumn) {
        const edge = box.x + box.width;
        box.x = Math.max(box.x, boundary);
        box.width = edge - box.x;
      }
    }
  }
  for (const column of columns) {
    const ordered = [...column].sort((left, right) => left.y - right.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const top = ordered[index];
      const bottom = ordered[index + 1];
      const topEdge = top.y + top.height;
      if (topEdge <= bottom.y) continue;
      const boundary = (topEdge + bottom.y) / 2;
      top.height = boundary - top.y;
      const bottomEdge = bottom.y + bottom.height;
      bottom.y = boundary;
      bottom.height = bottomEdge - boundary;
    }
  }
  return boxes;
}

const hotspotCss = fs.readFileSync('src/cbt/cbt.css', 'utf8')
  .match(/\.image-answer-hotspot\s*\{[^}]+\}/)?.[0] || '';
if (/min-(?:width|height)\s*:/.test(hotspotCss)) {
  errors.push('모바일에서 답안 클릭 구역을 겹치게 만드는 CSS 최소 크기가 남아 있습니다.');
}

const questionCard = fs.readFileSync('src/cbt/QuestionCard.vue', 'utf8');
if (!/v-for="hotspot in unifiedHotspots"/.test(questionCard)
  || !/return \[hotspotStyle\(hotspot\)\]/.test(questionCard)) {
  errors.push('마우스 올림·클릭·선택 표시가 같은 단일 답안 박스를 사용하지 않습니다.');
}

for (const [image, imageHotspots] of Object.entries(hotspots)) {
  const choices = imageHotspots.map((item) => item.choice).sort((left, right) => left - right);
  if (imageHotspots.length !== 4 || choices.join(',') !== '1,2,3,4') {
    errors.push(`${image}: 답안 좌표가 보기 1·2·3·4를 정확히 한 개씩 포함하지 않습니다.`);
  }

  const boxes = unifiedAnswerHotspots(imageHotspots, segments[image]);
  unifiedBoxCount += boxes.length;
  for (const box of boxes) {
    const values = [box.x, box.y, box.width, box.height];
    if (values.some((value) => !Number.isFinite(value))
      || box.x < 0 || box.y < 0 || box.width <= 0 || box.height <= 0
      || box.x + box.width > 100.01 || box.y + box.height > 100.01) {
      errors.push(`${image}/${box.choice}: 통합 답안 박스가 이미지 범위를 벗어났습니다. ${JSON.stringify(box)}`);
    }
  }
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const overlap = intersection(boxes[leftIndex], boxes[rightIndex]);
      if (overlap.width > 0.001 && overlap.height > 0.001) {
        unifiedOverlapCount += 1;
        errors.push(`${image}/${boxes[leftIndex].choice}-${boxes[rightIndex].choice}: 통합 답안 박스가 겹칩니다.`);
      }
    }
  }

  for (const hotspot of imageHotspots) {
    const choiceSegments = segments[image]?.[hotspot.choice] || [];
    if (choiceSegments.length > 1) multiLineChoices += 1;
    const box = boxes.find((item) => item.choice === hotspot.choice);
    for (const segment of choiceSegments) {
      const overlap = intersection(box, segment);
      const retainedArea = Math.max(0, overlap.width) * Math.max(0, overlap.height);
      const sourceArea = segment.width * segment.height;
      if (retainedArea / sourceArea >= 0.9) containedSegmentCount += 1;
      else errors.push(`${image}/${hotspot.choice}: 통합 박스가 OCR 조각을 90% 이상 포함하지 못합니다. ${JSON.stringify(segment)}`);
    }
  }
}

const boxRegressions = [
  ['assets/hvac/assets/questions/2023_2/29.jpg', 2, 'x', 59.16],
  ['assets/hvac/assets/questions/2023_2/29.jpg', 4, 'x', 59.05],
  ['assets/hvac/assets/questions/2022_2/23.jpg', 2, 'x', 56.84],
  ['assets/hvac/assets/questions/2022_2/23.jpg', 4, 'x', 57.05],
  ['assets/hvac/assets/questions/2024_3/11.jpg', 3, 'y', 73.74],
  ['assets/hvac/assets/questions/2021_1/57.jpg', 2, 'x', 43.62],
  ['assets/hvac/assets/questions/2023_1/54.jpg', 1, 'x', 8.62],
  ['assets/hvac/assets/questions/2024_2/57.jpg', 2, 'x', 57.79],
  ['assets/hvac/assets/questions/2024_2/57.jpg', 4, 'x', 57.79],
  ['assets/hvac/assets/questions/2025_1/13.jpg', 2, 'x', 8.62],
  ['assets/hvac/assets/questions/2025_2/12.jpg', 1, 'x', 8.62],
];
for (const [image, choice, axis, maximum] of boxRegressions) {
  const boxes = unifiedAnswerHotspots(hotspots[image], segments[image]);
  const box = boxes.find((item) => item.choice === choice);
  if (!box || box[axis] > maximum + 0.001) {
    errors.push(`${image}/${choice}: 번호·분수 포함 회귀 검사 실패 (${axis}=${box?.[axis]})`);
  }
}

for (const [image, imageSegments] of Object.entries(segments)) {
  const imageHotspots = hotspots[image];
  if (!imageHotspots) {
    errors.push(`${image}: 기존 답안 좌표가 없습니다.`);
    continue;
  }
  for (const [choiceText, choiceSegments] of Object.entries(imageSegments)) {
    const choice = Number(choiceText);
    if (!imageHotspots.some((item) => item.choice === choice) || !Array.isArray(choiceSegments) || !choiceSegments.length) {
      errors.push(`${image}/${choice}: 답안 또는 OCR 좌표 형식이 잘못됐습니다.`);
      continue;
    }
    for (const segment of choiceSegments) {
      segmentCount += 1;
      const values = [segment.x, segment.y, segment.width, segment.height];
      if (values.some((value) => !Number.isFinite(value))
        || segment.x < 0 || segment.y < 0 || segment.width <= 0 || segment.height <= 0
        || segment.x + segment.width > 100.01 || segment.y + segment.height > 100.01) {
        errors.push(`${image}/${choice}: 이미지 범위를 벗어난 OCR 좌표 ${JSON.stringify(segment)}`);
      }
    }
  }
}

for (const [image, imageHotspots] of Object.entries(hotspots)) {
  if (!segments[image]) missingImages.push(image);
  for (const hotspot of imageHotspots) {
    if (!segments[image]?.[hotspot.choice]?.length) missingChoices.push(`${image}/${hotspot.choice}`);
  }
}

console.log(`PaddleOCR 좌표: ${Object.keys(segments).length}/${Object.keys(hotspots).length}장, ${segmentCount.toLocaleString()}개`);
console.log(`답안별 단일 박스: ${unifiedBoxCount.toLocaleString()}개 (여러 조각 통합 ${multiLineChoices.toLocaleString()}개)`);
console.log(`통합 박스에 연결된 OCR 조각: ${containedSegmentCount.toLocaleString()}/${segmentCount.toLocaleString()}개`);
console.log(`통합 답안 박스 겹침: ${unifiedOverlapCount}건`);
console.log(`픽셀 분석 대체: 이미지 ${missingImages.length}장, 답안 ${missingChoices.length}개`);
if (missingImages.length) console.log(`이미지 대체 대상: ${missingImages.join(', ')}`);
if (missingChoices.length) console.log(`답안 대체 대상: ${missingChoices.join(', ')}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('마우스 올림·클릭·선택 단일 박스와 전체 좌표 검사 통과');
}
