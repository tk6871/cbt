import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const inputPath = path.resolve(process.argv[2] || 'hvac-manual-hotspots.json');
const outputPath = path.resolve(process.argv[3] || 'src/cbt/reviewedHvacHotspots.ts');
const autoPath = path.join(root, 'src/cbt/generatedHvacHotspots.ts');
const imageRoot = path.join(root, 'assets/hvac/assets/questions');

function readHotspotModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(source.slice(source.indexOf('=') + 1).trim().replace(/;$/, ''));
}

function listImages(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listImages(absolute, relative);
    return /\.(?:jpe?g|png)$/i.test(entry.name)
      ? [`assets/hvac/assets/questions/${relative}`]
      : [];
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function normalize(file, hotspots) {
  if (!Array.isArray(hotspots) || hotspots.length !== 4) {
    throw new Error(`${file}: 답안 좌표가 4개가 아닙니다.`);
  }
  const choices = [...hotspots].sort((left, right) => left.choice - right.choice);
  if (choices.some((hotspot, index) => hotspot.choice !== index + 1)) {
    throw new Error(`${file}: ①·②·③·④가 각각 한 번씩 있어야 합니다.`);
  }
  for (const hotspot of choices) {
    const values = [hotspot.x, hotspot.y, hotspot.width, hotspot.height];
    if (values.some((value) => !Number.isFinite(value))
      || hotspot.x < 0 || hotspot.y < 0 || hotspot.width <= 0 || hotspot.height <= 0
      || hotspot.x + hotspot.width > 100.01 || hotspot.y + hotspot.height > 100.01) {
      throw new Error(`${file}: 이미지 범위를 벗어난 좌표가 있습니다.`);
    }
  }

  const rowStarts = [...new Set(choices.map((hotspot) => hotspot.y))].sort((a, b) => a - b);
  if (![2, 4].includes(rowStarts.length)) {
    throw new Error(`${file}: 지원하지 않는 답안 배치입니다.`);
  }
  const firstRow = rowStarts[0];
  const lastRow = rowStarts.at(-1);
  const normalized = choices.map((hotspot) => {
    const right = hotspot.x + hotspot.width;
    const bottom = hotspot.y + hotspot.height;
    const x = hotspot.x < 2 ? 0 : hotspot.x;
    const expandedRight = right > 98 ? 100 : right;
    const y = hotspot.y === firstRow ? Math.max(0, hotspot.y - 2) : hotspot.y;
    const expandedBottom = hotspot.y === lastRow ? Math.min(100, bottom + 2) : bottom;
    return {
      choice: hotspot.choice,
      x: round(x),
      y: round(y),
      width: round(expandedRight - x),
      height: round(expandedBottom - y),
    };
  });
  if (rowStarts.length === 2) {
    const top = Math.min(...normalized.map((hotspot) => hotspot.y));
    const bottom = Math.max(...normalized.map((hotspot) => hotspot.y + hotspot.height));
    const boundary = Math.min(Math.max(rowStarts[1], top + 7), bottom - 7);
    for (const hotspot of normalized) {
      if (hotspot.y < rowStarts[1]) hotspot.height = round(boundary - hotspot.y);
      else {
        hotspot.y = round(boundary);
        hotspot.height = round(bottom - boundary);
      }
    }
  }
  return normalized;
}

const manual = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const automatic = readHotspotModule(autoPath);
const missing = listImages(imageRoot).filter((file) => !automatic[file]).sort();
const supplied = Object.keys(manual).sort();
if (JSON.stringify(missing) !== JSON.stringify(supplied)) {
  const omitted = missing.filter((file) => !supplied.includes(file));
  const unexpected = supplied.filter((file) => !missing.includes(file));
  throw new Error(`수동 좌표 대상이 일치하지 않습니다. 누락 ${omitted.length}장, 예상 밖 ${unexpected.length}장`);
}

const reviewed = Object.fromEntries(supplied.map((file) => [file, normalize(file, manual[file])]));
const json = JSON.stringify(reviewed, null, 2);
const source = '// 사용자가 원문 이미지에서 ①·②·③·④ 중심을 직접 확인한 좌표입니다.\n'
  + '// 좌우 끝과 첫·마지막 행은 클릭 오차를 고려해 안전하게 확장했습니다.\n'
  + 'export const reviewedHvacHotspots: Record<string, Array<{ choice: number; x: number; y: number; width: number; height: number }>> = '
  + `${json};\n`;
fs.writeFileSync(outputPath, source);
console.log(`수동 좌표 ${supplied.length}장, ${supplied.length * 4}개 반영: ${path.relative(root, outputPath)}`);
