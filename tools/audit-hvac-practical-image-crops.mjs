import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = ['data/hvac-practical-restored.json', 'data/hvac-practical-moducbt.json'];
const references = new Map();

for (const source of sources) {
  const rows = JSON.parse(fs.readFileSync(path.join(root, source), 'utf8'));
  for (const row of rows) {
    const images = [row.image, ...(row.images || []), ...(row.answerImages || [])].filter(Boolean);
    for (const image of images) {
      const entries = references.get(image) || [];
      entries.push({ id: row.id, source });
      references.set(image, entries);
    }
  }
}

const candidates = [];
const errors = [];
const skippedVectors = [];
for (const [image, rows] of references) {
  if (/\.svg$/i.test(image)) {
    skippedVectors.push(image);
    continue;
  }
  const absolute = path.join(root, image);
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'info', '-loop', '1', '-i', absolute,
    '-vf', 'negate,cropdetect=limit=0.08:round=2:reset=0', '-t', '0.2', '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 2_000_000 });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const size = output.match(/Video:[^\n]*?,\s*(\d{2,5})x(\d{2,5})(?:[,\s])/);
  const crops = [...output.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  if (result.status !== 0 || !size || !crops.length) {
    errors.push({ image, status: result.status, reason: !size ? 'size' : !crops.length ? 'crop' : 'ffmpeg' });
    continue;
  }
  const [width, height] = size.slice(1).map(Number);
  const [cropWidth, cropHeight, left, top] = crops.at(-1).slice(1).map(Number);
  const margins = { top, right: width - left - cropWidth, bottom: height - top - cropHeight, left };
  const touchesRequestedEdge = margins.top <= 4 || margins.right <= 4;
  if (touchesRequestedEdge) candidates.push({ image, width, height, margins, rows });
}

console.log(JSON.stringify({
  referencedImages: references.size,
  candidates: candidates.length,
  skippedVectors: skippedVectors.length,
  errors,
  ...(process.argv.includes('--details') ? { rows: candidates } : {}),
}, null, 2));

if (errors.length) process.exitCode = 1;
