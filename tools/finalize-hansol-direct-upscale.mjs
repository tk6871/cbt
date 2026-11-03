// Audited background release finalizer. No Git, network downloads, originals
// deletion, or source question/answer mutations. Version changes are mechanical
// and guarded against concurrent edits to the prepared files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const work='work/hansol-direct-upscale';fs.mkdirSync(work,{recursive:true});
const baselinePath=`${work}/release-baseline.json`;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const guards=['data/hansol-book-direct.json','data/textbook-pages.json','data/textbook-corrections.json','data/hansol-book-native-audit.json',...['hvac','hvac-hansol','energy','energy-midterm','energy-restored','energy-textbook','hvac-hansol-book'].map(n=>`data/${n}.js`)];
const releaseFiles=['vite.config.ts','index.html','jewelry.html','admin.html','android/app/build.gradle','data/changelog-vue.js','CHANGELOG.md','README.md','src/cbt/App.vue','src/cbt/textbookPages.ts','src/cbt/TextbookDirectQuestion.vue'];
if(process.argv.includes('--prepare')){
 const oldAssets=[...new Set(Object.values(read('data/hansol-book-native-audit.json').images).map(im=>im.asset))];
 const snapshot={date:new Date().toISOString(),protected:Object.fromEntries(guards.map(p=>[p,sha(p)])),protectedAssets:Object.fromEntries(oldAssets.map(p=>[p,sha(p)])),releaseFiles:Object.fromEntries(releaseFiles.map(p=>[p,sha(p)]))};
 if(fs.existsSync(baselinePath)){const prior=read(baselinePath);assert.deepEqual(prior.protected,snapshot.protected);assert.deepEqual(prior.protectedAssets,snapshot.protectedAssets);assert.deepEqual(prior.releaseFiles,snapshot.releaseFiles);}
 else fs.writeFileSync(baselinePath,JSON.stringify(snapshot,null,2)+'\n');
 console.log('Background release baseline ready; protected question banks and release files recorded.');process.exit(0);
}
const baseline=read(baselinePath),source=read('data/hansol-book-direct.json'),manifest=read('data/hansol-book-direct-upscale.json');
assert.equal(manifest.pages.length,397);assert.equal(manifest.sourceIndexSha256,sha('data/hansol-book-direct.json'));
for(const [p,h] of Object.entries({...baseline.protected,...baseline.protectedAssets,...baseline.releaseFiles}))assert.equal(sha(p),h,`${p}: changed since background job preparation; stop without overwriting it`);
for(const row of manifest.pages){assert.equal(sha(row.sourceAsset),row.sourceSha256);assert.equal(sha(row.asset),row.outputSha256);}
const results=[];
function command(name,executable,args){
 const log=`${work}/${name}.log`,out=fs.openSync(log,'w');
 console.log(`VERIFY ${name}`);
 const result=spawnSync(executable,args,{cwd:root,env:{...process.env,CBT_TEST_URL:'http://127.0.0.1:4234'},stdio:['ignore',out,out],timeout:600000});
 fs.closeSync(out);results.push({name,status:result.status,signal:result.signal,log});
 assert.equal(result.status,0,`${name} failed: ${log}${result.error?' '+result.error.message:''}`);
}
// Check code and data before changing any version token.
command('typecheck','npm',['run','typecheck']);
command('text-publication','node',['tools/publish-hansol-text-review.mjs','--check']);
command('native-publication','node',['tools/build-hansol-book-native.mjs','--check']);
command('unit-tests','node',['--test','tools/hansol-values-followup.test.mjs','tools/hansol-values-review.test.mjs','tools/hansol-book-image-validation.test.mjs','tools/textbook-text-correction.test.mjs','tools/hansol-answer-candidates.test.mjs','tools/hansol-batch-review.test.mjs']);
function replaceOnce(file,old,next){const text=fs.readFileSync(file,'utf8');assert.equal(text.split(old).length,2,`${file}: expected exactly one release token`);fs.writeFileSync(file,text.replace(old,next));}
// Mechanical version/cache propagation only, after input guards and checks.
replaceOnce('vite.config.ts',"buildVersion = '628'","buildVersion = '629'");
for(const file of ['index.html','jewelry.html','admin.html','src/cbt/textbookPages.ts']){
 const text=fs.readFileSync(file,'utf8');assert.ok(text.includes('v=628'),file);fs.writeFileSync(file,text.replaceAll('v=628','v=629'));
}
replaceOnce('android/app/build.gradle','versionCode 628','versionCode 629');
replaceOnce('android/app/build.gradle','versionName "5.8"','versionName "5.8.1"');
const entry=`    {
      version:'5.8.1',scope:'industrial',date:'2026.11.03',
      title:'교재 원문397쪽 화질 개선',
      summary:'원문397쪽을 기존 Real-ESRGAN 방식으로 개선하고 문제·풀이·정답표를2배 이미지로 표시합니다.',
      tags:['교재 원문','화질 개선','원본 보존'],
      changes:['기존 Mac Real-ESRGAN x4plus-anime·타일256·4배 처리 후2배 bicubic·lossless WebP를 적용했습니다. 원본 PNG397장과 기존 개선500장은 유지합니다.','표시 크기와 문제·풀이·정답표 좌표는 원래 기준을 유지합니다. 다크/라이트·원본 색상 설정·쪽 이동·답안 기록은 그대로이며 확대본을 읽지 못하면 원해상도로 대신 표시합니다.','화질 개선은 정답 검증이나 풀이 경계127곳의 추가 보완을 뜻하지 않습니다. 원문 자가확인과 기존 자동채점 문제는 계속 구분합니다.']
    },\n`;
replaceOnce('data/changelog-vue.js','  const entries = [\n','  const entries = [\n'+entry);
replaceOnce('data/changelog-vue.js',"changelog.versions.industrial = '5.8';","changelog.versions.industrial = '5.8.1';");
replaceOnce('data/changelog-vue.js',"changelog.currentVersion = '5.8';","changelog.currentVersion = '5.8.1';");
replaceOnce('CHANGELOG.md','# 변경 기록\n\n',`# 변경 기록\n\n## v5.8.1 - 2026-11-03\n\n- 교재 원문397쪽을 기존 Real-ESRGAN x4plus-anime·타일256·4배→2배 bicubic·lossless WebP로 개선했습니다. 원본397장과 기존 개선500장을 보존합니다.\n- 표시 크기·문제/풀이/정답표 좌표·선택 기록은 원래 기준을 유지합니다. 다크/라이트와 확대본 연결 실패 시 원해상도 대체 표시를 지원합니다.\n- 정답 검증·127곳의 풀이 경계 보완·전체 개별 대조 완료를 뜻하지 않습니다.\n\n`);
replaceOnce('README.md','- 이미 완료된 화질 개선 결과는 유지합니다. 새 업스케일링은 보류하고, 필요한 새 교재 이미지는 원래 해상도로도 연결할 수 있습니다. 이미지 선택·다크/라이트는 동일하게 지원합니다.','- 교재 원문397쪽의 화질 개선 결과와 이전 개선본을 함께 유지합니다. 원래 표시 좌표·쪽 배치·다크/라이트를 보존하고 확대본을 읽지 못하면 원해상도로 표시합니다. 원본 이미지는 삭제하지 않습니다.');
replaceOnce('src/cbt/App.vue','NEW · v5.8</span>','NEW · v5.8.1</span>');
replaceOnce('src/cbt/App.vue','<h2>교재 원문으로 먼저 풀기</h2>','<h2>교재 원문397쪽, 더 선명하게</h2>');
replaceOnce('src/cbt/App.vue','기존 CBT·해설·기록과 완료된 화질 개선은 유지하고 새 업스케일링은 하지 않았습니다.','교재 원문397쪽은4배 처리 후2배 화질 개선을 적용했습니다. 기존 CBT·해설·기록과 원본·이전 개선본은 보존합니다.');
command('build','npm',['run','build']);
command('pwa','npm',['run','test:pwa']);
command('changelog-identity','node',['tools/audit-changelog-identity.mjs']);
command('upscale-browser-tests','npx',['playwright','test','tools/hansol-direct-upscale.spec.ts','tools/hansol-direct-pages.spec.ts','--project=desktop']);
for(const [p,h] of Object.entries({...baseline.protected,...baseline.protectedAssets}))assert.equal(sha(p),h,`${p}: protected input changed`);
const bytes=manifest.pages.reduce((n,r)=>n+fs.statSync(r.asset).size,0);
const report={date:new Date().toISOString(),status:'finished-local-release',version:'5.8.1',cache:629,pages:397,bytes,checks:results,protectedInputsUnchanged:true,git:'not-run; connected GitHub write previously returned403',remaining:['풀이 경계127곳','정답 검증·채점 문제화','필요 시 개별 대조','GitHub 커밋·Push·배포']};
fs.writeFileSync(`${work}/result.json`,JSON.stringify(report,null,2)+'\n');
const summary=`# v5.8.1 — 교재 원문397쪽 화질 개선\n\n자동 실행 결과: **로컬 적용·검사 완료**\n\n- 기존 Mac Real-ESRGAN x4plus-anime·타일256·한 번에1장·4배→2배 bicubic·lossless WebP로397쪽을 처리했습니다. 새 이미지${bytes}바이트입니다. 원본397PNG와 이전500개 개선 이미지는 보존합니다.\n- 원래 좌표 기준을 유지해 문제·풀이·정답표 표시 영역이 바뀌지 않습니다. 다크/라이트·원본 색상·답안 기록을 유지하며 확대본 연결 실패 시 원해상도로 대체합니다.\n- 모든 확대본의SHA·2배 크기·전역 명암/가장자리 상관도를 확인했습니다. 글자·정답의 학술 검증이나759문항 육안 전수 검증은 아닙니다.\n- 실행 성공: ${results.map(r=>r.name).join(', ')}. 실물 기기·Safari·APK·실계정 동기화·실배포는 미검사입니다. Android 설정만629/5.8.1이며 APK는 생성하지 않았습니다.\n- 남은 일: 풀이 경계127곳, 정답 검증·채점 문제화, 필요한 개별 대조, 커밋·Push·배포. 화질 개선으로 이 항목을 완료 처리하지 않습니다.\n- Git은 실행하지 않았습니다. 앞선 연결 GitHub 쓰기403 이후 터미널 Git·Desktop 등으로 우회하지 않았습니다.\n\n실제 결과·로그: work/hansol-direct-upscale/result.json 및 각 검사.log. 작업 재개는 같은 업스케일링 스크립트를 사용하며 검증 완료397쪽을 다시 처리하지 않습니다.\n`;
fs.writeFileSync('docs/summary-2026-11-03-v581-direct-upscale.md',summary);
// Replace only the designated generated status block; preserve all other
// handover notes and concurrent user additions to WORK_STATE.
const statePath='WORK_STATE.md',state=fs.readFileSync(statePath,'utf8');
const start='<!-- hansol-direct-upscale-status:start -->',end='<!-- hansol-direct-upscale-status:end -->';
assert.equal(state.split(start).length,2);assert.equal(state.split(end).length,2);
const block=`${start}\n### 2026-11-03 v5.8.1 — 원문397쪽 업스케일링 로컬 완료\n\n-397쪽을 기존Mac arm64 Real-ESRGAN x4plus-anime·타일256·1:1:1스레드·4배→2배bicubic·losslessWebP로 처리했다. 새이미지${bytes}바이트. 원본397PNG·기존500확대본·문제/좌표/정답/일반은행7파일은 보존한다.\n- 원래좌표와2배이미지를 분리연결하며 확대본오류시 원해상도로 대체한다. 다크/라이트·원본색상·선택기록 유지.\n- 실제성공검사: ${results.map(r=>r.name).join(' · ')}. 실물기기/Safari/APK/실계정동기화/실배포 미검사. 공개5.8.1·캐시629·Android설정629/5.8.1만갱신. 기존큰청크/Zod경고 여부는build.log참조.\n- 풀이경계127·정답검증/채점화·필요시개별대조·커밋/Push/배포는 남는다. Git작업은 실행하지않고 앞선403을 우회하지않았다.\n- 최종실행결과 work/hansol-direct-upscale/result.json, summary docs/summary-2026-11-03-v581-direct-upscale.md. 새모델설치/다운로드/원본삭제/공유압축 없음.\n${end}`;
fs.writeFileSync(statePath,state.slice(0,state.indexOf(start))+block+state.slice(state.indexOf(end)+end.length));
console.log(JSON.stringify(report,null,2));
