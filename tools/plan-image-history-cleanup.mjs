// Read-only Git inspection; writes an ignored plan, never rewrites or pushes refs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const destination = 'work/private-notes/git-history-2026-11-04';
const mapping = JSON.parse(fs.readFileSync('data/problem-images-webp90.json', 'utf8')).mappings;
const retired = JSON.parse(fs.readFileSync('work/private-notes/retired-public-v59/manifest.json', 'utf8')).entries;
const removed = [...new Set([...Object.keys(mapping), ...retired.map(entry => entry.source)])].sort();
const tracked = new Set(git('ls-tree', '-r', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean));
for (const source of removed) {
  if (tracked.has(source)) throw new Error(`Refusing to remove a current file: ${source}`);
  if (source.includes('\n') || source.startsWith('/') || source.split('/').includes('..')) throw new Error(`Unsafe path: ${source}`);
}
const stats = {};
let currentBytes = 0;
for (const entry of git('ls-tree', '-r', '-l', '-z', 'HEAD').split('\0').filter(Boolean)) {
  const [metadata, file] = entry.split('\t');
  const bytes = Number(metadata.trim().split(/\s+/).at(-1));
  if (!Number.isFinite(bytes)) continue;
  currentBytes += bytes;
  const root = file.includes('/') ? file.split('/')[0] : '(root)';
  stats[root] = (stats[root] || 0) + bytes;
}
const plan = {
  createdAt: new Date().toISOString(),
  sourceHead: git('rev-parse', 'HEAD').trim(),
  sourceTree: git('rev-parse', 'HEAD^{tree}').trim(),
  refs: git('show-ref').trim().split('\n'),
  sourceCommitCount: Number(git('rev-list', '--count', 'main').trim()),
  removePaths: removed.length,
  compressedOriginalPaths: Object.keys(mapping).length,
  retiredPaths: retired.length,
  currentFiles: tracked.size,
  currentBytes,
  currentBytesByRoot: Object.fromEntries(Object.entries(stats).sort((a,b) => b[1] - a[1])),
};
fs.mkdirSync(destination, { recursive: true });
if (fs.existsSync(path.join(destination, 'plan.json'))) throw new Error('Existing plan: inspect it instead of overwriting');
fs.writeFileSync(path.join(destination, 'remove-paths.txt'), removed.map(p => `literal:${p}`).join('\n') + '\n');
fs.writeFileSync(path.join(destination, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify(plan, null, 2));
