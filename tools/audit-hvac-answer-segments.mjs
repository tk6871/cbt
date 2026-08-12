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
const segments = readObject('src/cbt/generatedHvacAnswerSegments.ts');
const hotspots = { ...generated, ...reviewed };
const errors = [];
const missingImages = [];
const missingChoices = [];
let segmentCount = 0;
let closeAnswerPairs = 0;
const minimumWrappedLines = [
  ['assets/hvac/assets/questions/2023_2/25.jpg', 4, 3],
  ['assets/hvac/assets/questions/2023_3/47.jpg', 4, 2],
];

for (const [image, imageHotspots] of Object.entries(hotspots)) {
  const choices = imageHotspots.map((item) => item.choice).sort((left, right) => left - right);
  if (imageHotspots.length !== 4 || choices.join(',') !== '1,2,3,4') {
    errors.push(`${image}: 클릭 구역이 보기 1·2·3·4를 정확히 한 개씩 포함하지 않습니다.`);
  }
  for (const hotspot of imageHotspots) {
    if (hotspot.width < 2 || hotspot.height < 2) {
      errors.push(`${image}/${hotspot.choice}: 클릭 구역이 너무 작습니다. ${JSON.stringify(hotspot)}`);
    }
  }
}

for (const [image, choice, minimum] of minimumWrappedLines) {
  const count = segments[image]?.[choice]?.length || 0;
  if (count < minimum) {
    errors.push(`${image}/${choice}: 여러 줄 답안이 ${count}줄만 잡혔습니다. 최소 ${minimum}줄이어야 합니다.`);
  }
}

for (const [image, imageSegments] of Object.entries(segments)) {
  const imageHotspots = hotspots[image];
  if (!imageHotspots) {
    errors.push(`${image}: 기존 클릭 좌표가 없습니다.`);
    continue;
  }
  for (const [choiceText, choiceSegments] of Object.entries(imageSegments)) {
    const choice = Number(choiceText);
    const hotspot = imageHotspots.find((item) => item.choice === choice);
    if (!hotspot || !Array.isArray(choiceSegments) || !choiceSegments.length) {
      errors.push(`${image}/${choice}: 답안 또는 줄 좌표 형식이 잘못됐습니다.`);
      continue;
    }
    for (const segment of choiceSegments) {
      segmentCount += 1;
      const values = [segment.x, segment.y, segment.width, segment.height];
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)
        || segment.width <= 0 || segment.height <= 0
        || segment.x + segment.width > 100.01 || segment.y + segment.height > 100.01) {
        errors.push(`${image}/${choice}: 이미지 범위를 벗어난 줄 좌표 ${JSON.stringify(segment)}`);
      }
      const horizontalOverlap = Math.min(segment.x + segment.width, hotspot.x + hotspot.width) - Math.max(segment.x, hotspot.x);
      if (horizontalOverlap <= 0) {
        errors.push(`${image}/${choice}: 클릭 구역과 연결되지 않은 줄 좌표 ${JSON.stringify(segment)}`);
      }
    }
  }

  const minX = Math.min(...imageHotspots.map((item) => item.x));
  const maxX = Math.max(...imageHotspots.map((item) => item.x));
  const boundary = (minX + maxX) / 2;
  const columns = maxX - minX > 24
    ? [imageHotspots.filter((item) => item.x < boundary), imageHotspots.filter((item) => item.x >= boundary)]
    : [imageHotspots];
  for (const column of columns) {
    const ordered = [...column].sort((left, right) => left.y - right.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const current = imageSegments[ordered[index].choice] || [];
      const next = imageSegments[ordered[index + 1].choice] || [];
      if (!current.length || !next.length) continue;
      const currentBottom = Math.max(...current.map((item) => item.y + item.height));
      const nextTop = Math.min(...next.map((item) => item.y));
      if (currentBottom > nextTop + 1.5) {
        closeAnswerPairs += 1;
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

console.log(`PaddleOCR 줄 좌표: ${Object.keys(segments).length}/${Object.keys(hotspots).length}장, ${segmentCount.toLocaleString()}개`);
console.log(`픽셀 분석 대체: 이미지 ${missingImages.length}장, 답안 ${missingChoices.length}개`);
console.log(`인접 답안 패딩 겹침: ${closeAnswerPairs}쌍 (한 답안만 표시하므로 시각 충돌 없음)`);
if (missingImages.length) console.log(`이미지 대체 대상: ${missingImages.join(', ')}`);
if (missingChoices.length) console.log(`답안 대체 대상: ${missingChoices.join(', ')}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('좌표 범위·기존 클릭 구역 연결 검사 통과');
}
