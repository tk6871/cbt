import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

// Static JavaScript dependencies plus the mobile entry's awaited app import.
// Subject banks, CSS and user-triggered imports are outside this measurement.
function inspect(entry, revision) {
  const paths = new Set();
  let bytes=0,gzip=0;
  function visit(file) {
    if(paths.has(file))return;
    paths.add(file);
    const source=revision?execFileSync('git',['show',`${revision}:${file}`],{maxBuffer:16*1024*1024}):fs.readFileSync(file);
    bytes+=source.length;gzip+=gzipSync(source).length;
    for(const item of ts.createSourceFile(file,source.toString('utf8'),ts.ScriptTarget.Latest).statements){
      if(!(ts.isImportDeclaration(item)||ts.isExportDeclaration(item)))continue;
      const specifier=item.moduleSpecifier;
      if(specifier&&ts.isStringLiteral(specifier)&&specifier.text.startsWith('.'))visit(path.posix.join(path.posix.dirname(file),specifier.text));
    }
  }
  visit(entry);
  if(entry==='modern/mobile.js')visit('modern/cbt.js');
  return {bytes,gzip,files:[...paths]};
}
const baseline=process.argv[2];
for(const entry of ['modern/cbt.js','modern/mobile.js']){
  const current=inspect(entry);
  if(current.files.some(file=>/textbookPages-v|image-text-candidates-v|FormulaWorkbench-v/.test(file)))throw new Error(`Optional feature loaded at startup: ${entry}`);
  const before=baseline?inspect(entry,baseline):null;
  console.log(JSON.stringify({entry,before,after:current}));
}
