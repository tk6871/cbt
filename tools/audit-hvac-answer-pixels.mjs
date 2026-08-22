import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();

function readObject(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('= {', source.indexOf('export const')) + 2;
  const end = source.lastIndexOf('}') + 1;
  if (start < 2 || end <= start) throw new Error(`${file}에서 좌표 객체를 찾지 못했습니다.`);
  return JSON.parse(source.slice(start, end));
}

function parseArguments(argv) {
  const options = { image: '', report: '', output: '', segments: 'src/cbt/generatedHvacAnswerSegments.ts', threshold: 120, tolerance: 0.75 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--image') options.image = argv[++index] || '';
    else if (argument === '--report') options.report = argv[++index] || '';
    else if (argument === '--output') options.output = argv[++index] || '';
    else if (argument === '--segments') options.segments = argv[++index] || options.segments;
    else if (argument === '--threshold') options.threshold = Number(argv[++index]);
    else if (argument === '--tolerance') options.tolerance = Number(argv[++index]);
  }
  return options;
}

function readBitmap(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 2) !== 'BM') throw new Error(`${file}: BMP 형식이 아닙니다.`);
  const pixelOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const signedHeight = buffer.readInt32LE(22);
  const bitsPerPixel = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);
  if (width <= 0 || !signedHeight || bitsPerPixel !== 24 || compression !== 0) {
    throw new Error(`${file}: 지원하지 않는 BMP 형식입니다.`);
  }
  const height = Math.abs(signedHeight);
  const topDown = signedHeight < 0;
  const stride = Math.ceil(width * 3 / 4) * 4;
  return { buffer, pixelOffset, width, height, topDown, stride };
}

function pixelAt(bitmap, x, y) {
  const row = bitmap.topDown ? y : bitmap.height - 1 - y;
  const offset = bitmap.pixelOffset + row * bitmap.stride + x * 3;
  return {
    blue: bitmap.buffer[offset],
    green: bitmap.buffer[offset + 1],
    red: bitmap.buffer[offset + 2],
  };
}

function answerSearchCells(hotspots, currentBoxes) {
  const minX = Math.min(...hotspots.map((hotspot) => hotspot.x));
  const maxX = Math.max(...hotspots.map((hotspot) => hotspot.x));
  const twoColumns = maxX - minX > 24;
  const columns = twoColumns
    ? [hotspots.filter((item) => item.choice === 1 || item.choice === 3), hotspots.filter((item) => item.choice === 2 || item.choice === 4)]
    : [hotspots];
  const currentByChoice = new Map(currentBoxes.map((item) => [item.choice, item]));
  let columnBoundary = 100;
  if (twoColumns) {
    const currentLeftEdge = Math.max(...columns[0].map((item) => {
      const box = currentByChoice.get(item.choice);
      return box.x + box.width;
    }));
    const currentRightEdge = Math.min(...columns[1].map((item) => currentByChoice.get(item.choice).x));
    const originalLeftEdge = Math.max(...columns[0].map((item) => item.x + item.width));
    const originalRightEdge = Math.min(...columns[1].map((item) => item.x));
    columnBoundary = currentLeftEdge < currentRightEdge
      ? (currentLeftEdge + currentRightEdge) / 2
      : (originalLeftEdge + originalRightEdge) / 2;
  }
  const cells = new Map();

  for (const [columnIndex, column] of columns.entries()) {
    const orderedColumn = [...column].sort((leftItem, rightItem) => leftItem.y - rightItem.y);
    const left = columnIndex === 0 ? Math.max(0, Math.min(...column.map((item) => item.x)) - 2) : columnBoundary;
    const right = twoColumns && columnIndex === 0
      ? columnBoundary
      : Math.min(100, Math.max(...column.map((item) => item.x + item.width)) + 2);
    for (const [itemIndex, item] of orderedColumn.entries()) {
      const current = currentByChoice.get(item.choice);
      const previous = orderedColumn[itemIndex - 1];
      const next = orderedColumn[itemIndex + 1];
      const topBoundary = previous
        ? (previous.y + previous.height + item.y) / 2
        : Math.max(0, Math.min(item.y, current.y) - 2);
      const bottomBoundary = next
        ? (item.y + item.height + next.y) / 2
        : 100;
      const top = Math.max(0, Math.min(topBoundary, current.y - 2));
      const isLastInColumn = itemIndex === orderedColumn.length - 1;
      const bottom = isLastInColumn
        ? 100
        : Math.min(100, Math.max(bottomBoundary, current.y + current.height + 0.5));
      cells.set(item.choice, { x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return cells;
}

function inspectionCell(searchCell, current) {
  return searchCell;
}

function actualInkBox(bitmap, cell, current, sourceSegments, threshold) {
  const left = Math.max(0, Math.floor(bitmap.width * cell.x / 100));
  const top = Math.max(0, Math.floor(bitmap.height * cell.y / 100));
  const right = Math.min(bitmap.width, Math.ceil(bitmap.width * (cell.x + cell.width) / 100));
  const bottom = Math.min(bitmap.height, Math.ceil(bitmap.height * (cell.y + cell.height) / 100));
  const rowInk = new Uint32Array(Math.max(0, bottom - top));

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const pixel = pixelAt(bitmap, x, y);
      const luminance = pixel.red * 0.2126 + pixel.green * 0.7152 + pixel.blue * 0.0722;
      if (luminance < threshold) {
        rowInk[y - top] += 1;
      }
    }
  }

  const activeRows = [...rowInk.keys()].filter((index) => rowInk[index] >= 2);
  if (!activeRows.length) return null;
  const rowGroups = [];
  for (const row of activeRows) {
    const last = rowGroups.at(-1);
    if (last && row - last.end <= 3) last.end = row;
    else rowGroups.push({ start: row, end: row });
  }
  const currentTop = bitmap.height * current.y / 100 - top;
  const currentBottom = bitmap.height * (current.y + current.height) / 100 - top;
  const currentCenter = (currentTop + currentBottom) / 2;
  const segmentCenters = sourceSegments.length
    ? sourceSegments.map((segment) => bitmap.height * (segment.y + segment.height / 2) / 100 - top)
    : [currentCenter];
  const anchoredGroups = [...new Set(segmentCenters.map((center) => rowGroups.reduce((closest, group) => {
    const distance = Math.abs((group.start + group.end) / 2 - center);
    return !closest || distance < closest.distance ? { group, distance } : closest;
  }, null).group))];
  let firstGroupIndex = Math.min(...anchoredGroups.map((group) => rowGroups.indexOf(group)));
  let lastGroupIndex = Math.max(...anchoredGroups.map((group) => rowGroups.indexOf(group)));
  const maximumContentGap = Math.max(7, Math.round(bitmap.height * 0.08));
  while (lastGroupIndex < rowGroups.length - 1
    && rowGroups[lastGroupIndex + 1].start - rowGroups[lastGroupIndex].end <= maximumContentGap) {
    lastGroupIndex += 1;
  }
  const selectedGroups = rowGroups.slice(firstGroupIndex, lastGroupIndex + 1);
  const firstRow = Math.min(...selectedGroups.map((group) => group.start));
  const lastRow = Math.max(...selectedGroups.map((group) => group.end));
  const columnInk = new Uint32Array(Math.max(0, right - left));
  for (const group of selectedGroups) {
    for (let y = top + group.start; y <= top + group.end; y += 1) {
      for (let x = left; x < right; x += 1) {
        const pixel = pixelAt(bitmap, x, y);
        const luminance = pixel.red * 0.2126 + pixel.green * 0.7152 + pixel.blue * 0.0722;
        if (luminance < threshold) columnInk[x - left] += 1;
      }
    }
  }
  const currentLeft = bitmap.width * current.x / 100 - left;
  const currentRight = bitmap.width * (current.x + current.width) / 100 - left;
  const leftMargin = bitmap.width * 8 / 100;
  const rightMargin = bitmap.width * 4 / 100;
  const columns = [...columnInk.keys()].filter((index) => columnInk[index] >= 2
    && index >= currentLeft - leftMargin
    && index <= currentRight + rightMargin);
  if (!columns.length) return null;

  const padding = 4;
  const inkLeft = Math.max(left, left + columns[0] - padding);
  const inkTop = Math.max(top, top + firstRow - padding);
  const inkRight = Math.min(right, left + columns.at(-1) + 1 + padding);
  const inkBottom = Math.min(bottom, top + lastRow + 1 + padding);
  return {
    x: inkLeft / bitmap.width * 100,
    y: inkTop / bitmap.height * 100,
    width: (inkRight - inkLeft) / bitmap.width * 100,
    height: (inkBottom - inkTop) / bitmap.height * 100,
  };
}

function relevantSegments(hotspot, segments = []) {
  // Wrapped lines can legitimately extend below the old coarse hotspot cell.
  // Dropping those segments here made the audit approve only the first line.
  // Choice ownership is established by the generator and overlap audit, so the
  // pixel audit must inspect every segment that will be used by the browser.
  return segments;
}

function unionSegments(hotspot, segments) {
  if (!segments?.length) return { ...hotspot };
  const selected = relevantSegments(hotspot, segments);
  const x = Math.min(...selected.map((segment) => segment.x));
  const y = Math.min(...selected.map((segment) => segment.y));
  const right = Math.max(...selected.map((segment) => segment.x + segment.width));
  const bottom = Math.max(...selected.map((segment) => segment.y + segment.height));
  return { choice: hotspot.choice, x, y, width: right - x, height: bottom - y };
}

function edgeDeficits(current, actual) {
  return {
    left: Math.max(0, current.x - actual.x),
    top: Math.max(0, current.y - actual.y),
    right: Math.max(0, actual.x + actual.width - (current.x + current.width)),
    bottom: Math.max(0, actual.y + actual.height - (current.y + current.height)),
  };
}

function roundedBox(box) {
  return Object.fromEntries(Object.entries(box).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(2)) : value]));
}

const options = parseArguments(process.argv.slice(2));
const generated = readObject(path.join(root, 'src/cbt/generatedHvacHotspots.ts'));
const reviewed = readObject(path.join(root, 'src/cbt/reviewedHvacHotspots.ts'));
const reviewedSegments = readObject(path.join(root, 'src/cbt/reviewedHvacAnswerSegments.ts'));
const generatedSegments = readObject(path.resolve(root, options.segments));
// The browser overlays reviewed segments on top of generated OCR segments.
// Audit that same merged data; otherwise a manually fixed box is excluded as
// "reviewed" while the pixel measurement still inspects its stale generator box.
const segments = Object.fromEntries(
  [...new Set([...Object.keys(generatedSegments), ...Object.keys(reviewedSegments)])]
    .map((image) => [image, { ...generatedSegments[image], ...reviewedSegments[image] }]),
);
const hotspots = { ...generated, ...reviewed };
const reviewedKeys = new Set(Object.entries(reviewedSegments).flatMap(([image, choices]) => (
  Object.keys(choices).map((choice) => `${image}/${choice}`)
)));
const images = Object.keys(hotspots).filter((image) => !options.image || image.includes(options.image));
const groups = Map.groupBy(images, (image) => path.dirname(image));
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cbt-hvac-pixel-audit-'));
const candidates = [];
const missing = [];
const actualByImage = {};
let checkedAnswers = 0;

try {
  let groupIndex = 0;
  for (const [directory, groupImages] of groups) {
    groupIndex += 1;
    const outputDirectory = path.join(temporaryRoot, String(groupIndex));
    fs.mkdirSync(outputDirectory);
    const sourceFiles = groupImages.map((image) => path.join(root, image));
    execFileSync('/usr/bin/sips', ['-s', 'format', 'bmp', ...sourceFiles, '--out', outputDirectory], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    for (const image of groupImages) {
      const bitmapFile = path.join(outputDirectory, `${path.basename(image, path.extname(image))}.bmp`);
      const bitmap = readBitmap(bitmapFile);
      const currentBoxes = hotspots[image].map((hotspot) => unionSegments(hotspot, segments[image]?.[hotspot.choice]));
      const currentByChoice = new Map(currentBoxes.map((item) => [item.choice, item]));
      const searchCells = answerSearchCells(hotspots[image], currentBoxes);
      for (const hotspot of hotspots[image]) {
        checkedAnswers += 1;
        const current = currentByChoice.get(hotspot.choice);
        const choiceSegments = relevantSegments(hotspot, segments[image]?.[hotspot.choice] || []);
        const actual = actualInkBox(bitmap, inspectionCell(searchCells.get(hotspot.choice), current), current, choiceSegments, options.threshold);
        if (!actual) {
          missing.push(`${image}/${hotspot.choice}`);
          continue;
        }
        actualByImage[image] ||= {};
        actualByImage[image][hotspot.choice] = roundedBox(actual);
        const deficits = edgeDeficits(current, actual);
        const maximumDeficit = Math.max(...Object.values(deficits));
        if (maximumDeficit > options.tolerance && !reviewedKeys.has(`${image}/${hotspot.choice}`)) {
          candidates.push({
            image,
            choice: hotspot.choice,
            maximumDeficit: Number(maximumDeficit.toFixed(2)),
            deficits: roundedBox(deficits),
            current: roundedBox(current),
            actual: roundedBox(actual),
          });
        }
      }
    }
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

candidates.sort((left, right) => right.maximumDeficit - left.maximumDeficit);
const report = {
  generatedAt: new Date().toISOString(),
  options,
  images: images.length,
  checkedAnswers,
  missing,
  candidates,
};
if (options.report) fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
if (options.output) {
  const repaired = structuredClone(segments);
  const candidateKeys = new Set(candidates.map((item) => `${item.image}/${item.choice}`));
  for (const image of images) {
    repaired[image] ||= {};
    for (const hotspot of hotspots[image]) {
      const source = repaired[image][hotspot.choice] || [];
      const relevant = relevantSegments(hotspot, source);
      const key = `${image}/${hotspot.choice}`;
      if (!source.length || candidateKeys.has(key)) repaired[image][hotspot.choice] = [actualByImage[image][hotspot.choice]];
      else repaired[image][hotspot.choice] = relevant;
    }
  }
  for (const [image, choices] of Object.entries(reviewedSegments)) {
    repaired[image] ||= {};
    for (const [choice, choiceSegments] of Object.entries(choices)) {
      repaired[image][choice] = structuredClone(choiceSegments);
    }
  }
  const payload = JSON.stringify(repaired, null, 2, Object.keys(repaired).sort());
  const source = [
    '// PaddleOCR PP-OCRv5와 원본 픽셀 대조로 생성한 공조 복원문제 답안 좌표입니다.',
    '// 답 번호는 OCR 인식값이 아니라 기존 검수 클릭 영역을 기준으로 배정합니다.',
    'export const hvacAnswerSegments: Record<string, Record<number, Array<{ x: number; y: number; width: number; height: number }>>> = ',
  ].join('\n');
  fs.writeFileSync(options.output, `${source}${payload};\n`);
}

console.log(`실제 픽셀 대조: ${images.length.toLocaleString()}장 / ${checkedAnswers.toLocaleString()}답안`);
console.log(`글자 픽셀 미검출: ${missing.length.toLocaleString()}답안`);
console.log(`현재 박스가 실제 글자를 ${options.tolerance}%p 넘게 자르는 후보: ${candidates.length.toLocaleString()}답안`);
console.log(`원본 직접 검수 예외: ${reviewedKeys.size.toLocaleString()}답안`);
for (const candidate of candidates.slice(0, 30)) {
  console.log(`${candidate.image}/${candidate.choice}: 최대 ${candidate.maximumDeficit}%p ${JSON.stringify(candidate.deficits)}`);
}
if (options.report) console.log(`상세 보고서: ${options.report}`);
if (options.output) console.log(`픽셀 보정 좌표: ${options.output}`);
