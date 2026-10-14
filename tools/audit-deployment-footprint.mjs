// Read-only audit. A missing literal reference is NOT proof an asset is unused:
// question banks, CSS, saved sessions and external links can construct paths.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding:'utf8' }).split('\0'))].filter(file => file && fs.existsSync(file));
const groups = {};
for (const file of files) {
  const key = file.includes('/') ? file.split('/')[0] : '(root)';
  const row = groups[key] ||= { files:0, bytes:0 };
  row.files++;
  row.bytes += fs.statSync(file).size;
}
const manifest = JSON.parse(fs.readFileSync('data/responsive-images.json','utf8'));
const referenced = new Set(Object.values(manifest).flatMap(entry=>entry.variants.map(v=>v.src)));
const unusedDerivatives = fs.readdirSync('assets/responsive').filter(file=>!referenced.has(`assets/responsive/${file}`));
const buildVersion = fs.readFileSync('vite.config.ts','utf8').match(/const buildVersion = '(\d+)'/)[1];
const staleChunks = fs.readdirSync('modern/chunks').filter(file=>/-v\d+/.test(file)&&!file.includes(`-v${buildVersion}`));
const main = fs.readFileSync(`modern/chunks/main-v${buildVersion}.js`);
const guide = fs.readFileSync(`modern/chunks/qualificationStudyGuides-v${buildVersion}.js`);
const suspicious = files.filter(file=>/(?:\.DS_Store$|ui-framework-lab\.html$|\.apk$|\.zip$|\.mp4$|\.m4a$)/i.test(file));
console.log(JSON.stringify({ buildVersion, groups, main:{bytes:main.length,gzip:gzipSync(main).length},
  deferredGuide:{bytes:guide.length,gzip:gzipSync(guide).length},
  unusedDerivatives, staleChunks, reviewOnly:suspicious,
  policy:'No original assets, work tools, history or unproven candidates are deleted.' },null,2));
if (unusedDerivatives.length || staleChunks.length) process.exitCode=1;
