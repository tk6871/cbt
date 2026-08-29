#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [rowsPath, assetsPath] = process.argv.slice(2);

if (!rowsPath || !assetsPath) {
  throw new Error('사용법: node tools/import-hvac-practical-source.mjs <문항 JSON> <브라우저 자산 JSON>');
}

const rows = JSON.parse(fs.readFileSync(rowsPath, 'utf8'));
const bundle = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
const assetsByUrl = new Map((bundle.assets || []).map((asset) => [asset.url, asset]));
const outputRoot = path.join(root, 'assets/hvac-practical/moducbt');
fs.mkdirSync(outputRoot, { recursive: true });

const output = rows
  .filter((row) => row.number <= 47 && row.question)
  .map((row) => {
    let image = '';
    if (row.imageUrl) {
      const asset = assetsByUrl.get(row.imageUrl);
      if (!asset) throw new Error(`${row.number}번 이미지 자산을 찾을 수 없습니다.`);
      const extension = asset.contentType === 'image/png' ? 'png' : 'jpg';
      const filename = `${String(row.number).padStart(2, '0')}.${extension}`;
      fs.copyFileSync(asset.path, path.join(outputRoot, filename));
      image = `assets/hvac-practical/moducbt/${filename}`;
    }
    return {
      id: `moducbt-hvac-practical-${row.number}`,
      number: row.number,
      question: row.question,
      sourceAnswer: (row.answerLines || []).join('\n'),
      image,
      sourceUrl: 'https://www.moducbt.com/exam/solution/4200',
    };
  });

const outputPath = path.join(root, 'data/hvac-practical-moducbt.json');
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ questions: output.length, images: output.filter((row) => row.image).length, outputPath }, null, 2));
