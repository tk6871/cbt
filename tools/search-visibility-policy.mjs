// GitHub Pages project sites cannot set arbitrary response headers. Put the
// indexing request in the initial HTML, not only in the rendered Vue screen.
// Do not block crawling in robots.txt: crawlers must read this noindex tag.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
export const searchRobotsPolicy='noindex,nofollow,noimageindex,nosnippet';
const tag=`<meta name="robots" content="${searchRobotsPolicy}">`;
const robots=/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>\s*/gi;
const charset=/<meta\b[^>]*\bcharset\s*=\s*["']?[^>]+>\s*/i;

export function withSearchExclusion(html){
 const clean=html.replace(robots,'');
 if(/<head\b[^>]*>/i.test(clean))return clean.replace(/<head\b[^>]*>\s*/i,match=>`${match.trimEnd()}\n  ${tag}\n  `);
 // Some retained static reports use an implicit HTML head.
 assert.ok(charset.test(clean),'HTML needs an early metadata section');
 return clean.replace(charset,match=>`${match.trimEnd()}\n${tag}\n`);
}
export function searchPolicyPages(){
 const result=fs.readdirSync(root).filter(p=>p.endsWith('.html'));
 function walk(folder){for(const e of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){
  if(e.isSymbolicLink())continue;
  const p=path.posix.join(folder,e.name);
  if(e.isDirectory()&&!['node_modules','realesrgan','.cache'].includes(e.name))walk(p);else if(e.isFile()&&p.endsWith('.html'))result.push(p);
 }}
 for(const folder of ['docs','tools'])walk(folder);
 return result.sort();
}
export function auditSearchExclusion({write=false}={}){
 const pages=searchPolicyPages();let changed=0;
 for(const p of pages){
  const file=path.join(root,p),before=fs.readFileSync(file,'utf8'),after=withSearchExclusion(before);
  if(write&&after!==before){fs.writeFileSync(file,after);changed++;}
  const html=write?after:before;
  const matches=[...html.matchAll(/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>/gi)];
  assert.equal(matches.length,1,`${p}: one robots tag required`);
  assert.ok(matches[0][0].includes(`content="${searchRobotsPolicy}"`),`${p}: exclusion policy missing`);
  const body=html.search(/<body\b|<main\b|<nav\b|<h1\b/i);
  assert.ok(body<0||matches[0].index<body,`${p}: robots tag must precede page body`);
 }
 return {pages:pages.length,changed,scope:'initial HTML only; not access control or GitHub repository privacy'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditSearchExclusion({write:process.argv.includes('--write')})));
