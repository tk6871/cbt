// Generate a reproducible review inventory and SVG renders; never modifies source media.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw Error('An absolute review output directory is required');
await fs.mkdir(output, {recursive:true});
const restored = JSON.parse(await fs.readFile(path.join(root,'data/hvac-practical-restored.json'),'utf8'));
const publicRows = JSON.parse(await fs.readFile(path.join(root,'data/hvac-practical-moducbt.json'),'utf8'));
const entries = [];
for (const row of [...restored, ...publicRows]) {
  for (const [role, images] of [['question', [...(row.image ? [row.image] : []), ...(row.images || row.sourceImages || [])]], ['answer', row.answerImages || []]]) {
    for (const source of images) {
      const bytes = await fs.readFile(path.join(root, source));
      entries.push({index:entries.length+1, id:row.id, role, source, sha256:crypto.createHash('sha256').update(bytes).digest('hex'), question:row.question, answer:row.answer || row.sourceAnswer});
    }
  }
}
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1920,height:1200}, deviceScaleFactor:1});
  for (const entry of entries.filter(entry => entry.source.endsWith('.svg'))) {
    const data = await fs.readFile(path.join(root,entry.source));
    await page.setContent('<style>body{margin:0}img{display:block}</style><img alt="review">');
    await page.locator('img').evaluate((el, source) => {el.src=source}, `data:image/svg+xml;base64,${data.toString('base64')}`);
    await page.locator('img').evaluate(el => el.decode());
    entry.render = path.join(output, `${entry.index}-svg.png`);
    await page.locator('img').screenshot({path:entry.render});
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(output,'inventory.json'), JSON.stringify(entries,null,2)+'\n');
console.log(`${entries.length} references; ${entries.filter(entry=>entry.render).length} rendered SVGs`);
