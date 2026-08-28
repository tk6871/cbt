#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogs = [
  { file: 'data/energy.js', key: 'energy', prefix: 'em', variable: 'CBT_DATA_ENERGY' },
  { file: 'data/maintenance.js', key: 'maintenance', prefix: 'bd', variable: 'CBT_DATA_MAINTENANCE' },
];
const visualWords = /그림|도표|선도|블록선도|도면|파형/i;

function readCatalog(filename) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  return JSON.parse(source.slice(source.indexOf('=') + 1, source.lastIndexOf(';')));
}

function references(question) {
  return [
    question.sourceImage,
    ...(question.images || []),
    ...(question.choices || []).flatMap((choice) => choice.images || []),
  ].filter(Boolean);
}

async function download(url, output) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) return false;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 80) return false;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes);
  return true;
}

for (const entry of catalogs) {
  const catalog = readCatalog(entry.file);
  let restoredQuestions = 0;
  let restoredFiles = 0;
  for (const round of catalog.rounds) {
    const date = String(round.id).match(/(\d{8})/)?.[1];
    if (!date) continue;
    for (const question of round.questions) {
      const prompt = String(question.text || question.html || '').replace(/<[^>]+>/g, ' ');
      if (!visualWords.test(prompt) || references(question).length) continue;
      const baseName = `${entry.prefix}${date}m${question.number}`;
      const outputDir = path.join(root, 'assets', entry.key, 'comcbt-restored', date, 'images');
      const publicDir = `assets/${entry.key}/comcbt-restored/${date}/images`;
      const mainName = `${baseName}.gif`;
      const mainUrl = `https://img.comcbt.com/cbt/data/${entry.prefix}/${entry.prefix}${date}/${mainName}`;
      const mainAdded = await download(mainUrl, path.join(outputDir, mainName));
      if (mainAdded) {
        question.images = [...(question.images || []), `${publicDir}/${mainName}`];
        restoredFiles += 1;
      }
      let choiceAdded = false;
      for (let choiceIndex = 0; choiceIndex < 4; choiceIndex += 1) {
        const choiceName = `${baseName}b${choiceIndex + 1}.gif`;
        const choiceUrl = `https://img.comcbt.com/cbt/data/${entry.prefix}/${entry.prefix}${date}/${choiceName}`;
        if (await download(choiceUrl, path.join(outputDir, choiceName))) {
          const choice = question.choices[choiceIndex];
          choice.images = [...(choice.images || []), `${publicDir}/${choiceName}`];
          restoredFiles += 1;
          choiceAdded = true;
        }
      }
      if (mainAdded || choiceAdded) {
        question.visualSource = `https://www.comcbt.com/cbt/problem/${String(question.source || '').match(/problem\/(\d+)\//)?.[1] || ''}/${question.number}/`;
        restoredQuestions += 1;
      }
    }
  }
  fs.writeFileSync(path.join(root, entry.file), `window.${entry.variable} = ${JSON.stringify(catalog)};\n`);
  console.log(`${entry.key}: 원문 그림 복구 ${restoredQuestions}문제 / ${restoredFiles}파일`);
}
