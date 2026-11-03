// Complete a prepared local release only after the clean-image GPU job passes.
// No Git/network writes. Journaled release edits can resume after test failure.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import assert from 'node:assert/strict';import {spawnSync,spawn} from 'node:child_process';
process.chdir(path.resolve(import.meta.dirname,'..'));
const work='work/hansol-ink-hidden',read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const protectedFiles=['data/hansol-book-direct.json','data/textbook-pages.json','data/textbook-corrections.json','data/hansol-book-native-audit.json',...['hvac','hvac-hansol','energy','energy-midterm','energy-restored','energy-textbook','hvac-hansol-book'].map(n=>`data/${n}.js`),...read('data/hansol-book-direct.json').pages.map(p=>p.asset),...Object.values(read('data/hansol-book-native-audit.json').images).map(im=>im.asset)];
const releaseFiles=['vite.config.ts','index.html','jewelry.html','admin.html','android/app/build.gradle','data/changelog-vue.js','CHANGELOG.md','README.md','src/cbt/App.vue','src/cbt/textbookPages.ts','src/cbt/textbookInkHidden.ts','src/cbt/TextbookDirectQuestion.vue'];
const baselinePath=`${work}/release-baseline.json`,journalPath=`${work}/release-journal.json`;
if(process.argv.includes('--prepare')){
 const snapshot={date:new Date().toISOString(),protected:Object.fromEntries(protectedFiles.map(p=>[p,sha(p)])),releaseFiles:Object.fromEntries(releaseFiles.map(p=>[p,sha(p)]))};
 if(fs.existsSync(baselinePath))assert.deepEqual(read(baselinePath),{...snapshot,date:read(baselinePath).date});
 else fs.writeFileSync(baselinePath,JSON.stringify(snapshot,null,2)+'\n');
 console.log('Clean-image release baseline prepared; originals and seven bank files protected.');process.exit(0);
}
const preflight=process.argv.includes('--preflight');
const baseline=read(baselinePath),staged=preflight?read(`${work}/jobs.json`):undefined;
const manifest=preflight?{...staged,assets:staged.jobs}:read('data/hansol-book-ink-hidden.json');
for(const [p,h] of Object.entries(baseline.protected))assert.equal(sha(p),h,`${p}: protected input changed`);
assert.equal(manifest.sourceIndexSha256,sha('data/hansol-book-direct.json'));
const affectedPages=manifest.assets.filter(r=>r.kind==='page').length;
assert.equal(affectedPages,14);assert.equal(manifest.retainedPages.length,383);
assert.equal(manifest.assets.filter(r=>r.kind!=='page').length+manifest.retained.length,500);
for(const r of [...manifest.assets,...manifest.retained]){assert.equal(sha(r.oldAsset),r.oldSha256);assert.equal(sha(r.sourceAsset),r.sourceSha256);if(r.asset&&!preflight)assert.equal(sha(r.asset),r.outputSha256);}
let edits;
if(fs.existsSync(journalPath))edits=read(journalPath).edits;
else{
 for(const [p,h] of Object.entries(baseline.releaseFiles))assert.equal(sha(p),h,`${p}: changed since preparation`);
 const next=new Map(releaseFiles.map(p=>[p,fs.readFileSync(p,'utf8')]));
 function once(p,from,to){const v=next.get(p);assert.equal(v.split(from).length,2,`${p}: release token mismatch`);next.set(p,v.replace(from,to));}
 once('vite.config.ts',"buildVersion = '628'","buildVersion = '629'");
 for(const p of ['index.html','jewelry.html','admin.html','src/cbt/textbookPages.ts']){assert.ok(next.get(p).includes('v=628'));next.set(p,next.get(p).replaceAll('v=628','v=629'));}
 once('android/app/build.gradle','versionCode 628','versionCode 629');once('android/app/build.gradle','versionName "5.8"','versionName "5.8.1"');
 const count=manifest.assets.filter(r=>r.kind!=='page').length;
 const entry=`    {version:'5.8.1',scope:'industrial',date:'2026.11.04',title:'교재 필기 부분만 깨끗하게 교체',summary:'필기 영향이 있는 부분만 교보 필기 숨김 원문으로 교체하고 화질을 개선했습니다.',tags:['교재 원문','필기 숨김','기존 이미지 유지'],changes:['교보 눈 버튼으로 필기 레이어를 숨긴 원문을 확인했습니다. 색을 지우거나 글자·도면을 AI로 다시 그리지 않았습니다.','필기 영향이 있던 원문14쪽과 문제·풀이${count}장만 교체·개선했습니다. 영향 없는383쪽·기존 개선474장은 그대로 유지하며 이전 자산도 보존합니다.','문제·정답·풀이 영역·선택 기록·다크/라이트는 유지합니다. 교체한 확대본을 읽지 못하면 필기 없는 원해상도 쪽으로 표시합니다. 풀이 경계127곳의 보완이나 전체 정답 검증 완료를 뜻하지 않습니다.']},\n`;
 once('data/changelog-vue.js','  const entries = [\n','  const entries = [\n'+entry);
 once('data/changelog-vue.js',"changelog.versions.industrial = '5.8';","changelog.versions.industrial = '5.8.1';");once('data/changelog-vue.js',"changelog.currentVersion = '5.8';","changelog.currentVersion = '5.8.1';");
 once('CHANGELOG.md','# 변경 기록\n\n',`# 변경 기록\n\n## v5.8.1 - 2026-11-04\n\n- 필기 영향이 있는 원문14쪽과 문제·풀이${count}장만 교보 필기 숨김 원문으로 교체·개선했습니다. 영향 없는383쪽·기존 개선474장과 이전 원본은 유지합니다. 인쇄 글자·도면의 색을 삭제하지 않고 문제/정답/선택 좌표는 보존합니다.\n- 다크/라이트·원본 색상 표시를 유지하고 교체한 확대 쪽 연결 실패 시 필기 없는 원해상도 쪽으로 대체합니다. 정답 검증·풀이 경계127곳의 보완 완료를 뜻하지 않습니다.\n\n`);
 once('README.md','- 이미 완료된 화질 개선 결과는 유지합니다. 새 업스케일링은 보류하고, 필요한 새 교재 이미지는 원래 해상도로도 연결할 수 있습니다. 이미지 선택·다크/라이트는 동일하게 지원합니다.','- 교재 필기를 숨긴 원문과 화질 개선본을 표시합니다. 이전 원본·개선본과 선택 좌표는 보존하며 이미지 선택·다크/라이트를 지원합니다.');
 once('src/cbt/App.vue','NEW · v5.8</span>','NEW · v5.8.1</span>');once('src/cbt/App.vue','<h2>교재 원문으로 먼저 풀기</h2>','<h2>필기 없는 교재 원문, 더 선명하게</h2>');
 once('src/cbt/App.vue','기존 CBT·해설·기록과 완료된 화질 개선은 유지하고 새 업스케일링은 하지 않았습니다.','교보에서 필기를 숨긴 원문을 다시 가져와 화질을 개선했습니다. 기존 CBT·해설·기록·선택 좌표와 이전 자산은 보존합니다.');
 edits=[...next].map(([file,after])=>({file,beforeHash:baseline.releaseFiles[file],afterHash:hash(after),after}));
 fs.writeFileSync(journalPath,JSON.stringify({date:new Date().toISOString(),edits},null,2)+'\n');
}
if(preflight){console.log('Release edits validated and journaled; no version/cache files changed.');process.exit(0);}
for(const r of edits){const current=sha(r.file);assert.ok(current===r.beforeHash||current===r.afterHash,`${r.file}: concurrent edit; stop`);if(current===r.beforeHash)fs.writeFileSync(r.file,r.after);}
const results=[];
function run(name,executable,args,env={}){
 const log=`${work}/${name}.log`,fd=fs.openSync(log,'w');console.log(`VERIFY ${name}`);
 const p=spawnSync(executable,args,{env:{...process.env,...env},stdio:['ignore',fd,fd],timeout:600000});fs.closeSync(fd);
 results.push({name,status:p.status,signal:p.signal,log});assert.equal(p.status,0,`${name} failed: ${log} ${p.error?.message||''}`);
}
run('typecheck','npm',['run','typecheck']);run('text-publication','node',['tools/publish-hansol-text-review.mjs','--check']);run('native-publication','node',['tools/build-hansol-book-native.mjs','--check']);
run('unit-tests','node',['--test','tools/hansol-values-followup.test.mjs','tools/hansol-values-review.test.mjs','tools/hansol-book-image-validation.test.mjs','tools/textbook-text-correction.test.mjs','tools/hansol-answer-candidates.test.mjs','tools/hansol-batch-review.test.mjs']);
run('build','npm',['run','build']);run('pwa','npm',['run','test:pwa']);run('changelog-identity','node',['tools/audit-changelog-identity.mjs']);
// Dedicated local test server; no dependency on a long-lived preview process.
const server=spawn('python3',['-m','http.server','4235','--bind','127.0.0.1'],{stdio:'ignore'});
try{run('clean-image-browser-tests','node',['node_modules/@playwright/test/cli.js','test','tools/hansol-ink-hidden.spec.ts','tools/hansol-direct-pages.spec.ts','--project=desktop'],{CBT_TEST_URL:'http://127.0.0.1:4235'});}finally{server.kill();}
for(const [p,h] of Object.entries(baseline.protected))assert.equal(sha(p),h,`${p}: protected input changed during release`);
const report={date:new Date().toISOString(),status:'finished-local-release',version:'5.8.1',cache:629,pages:affectedPages,nativeReplacements:manifest.assets.length-affectedPages,retainedPreviousImages:manifest.retained.length,retainedPages:manifest.retainedPages.length,screens:332,checks:results,protectedInputsUnchanged:true,git:'not run; connected GitHub write previously403'};
fs.writeFileSync(`${work}/result.json`,JSON.stringify(report,null,2)+'\n');
const summary=`# v5.8.1 — 필기 영향이 있는 부분만 교체\n\n- 교보 눈 버튼으로 빨간 체크·검은 필기만 숨겨지고 인쇄 원문은 남는 것을 확인했습니다. 정상 열람332화면을 비교용으로 저장했습니다.\n- 사용자 정정에 따라 전체397쪽 재처리는 중단했습니다. 필기 영향이 있는 원문${report.pages}쪽·문제/풀이${report.nativeReplacements}장만 기존 Real-ESRGAN4배→2배bicubic·tile256·losslessWebP로 개선·교체했습니다. 영향 없는383쪽·이전 개선474장은 그대로입니다. 불필요한 새 캡처/출력은 비공개work로 옮겨 보존했고 배포하지 않습니다.\n- 이전 원본/개선본·일반은행6+교재은행1·정답·좌표·다크/라이트·선택기록 유지. 교체한 쪽 확대본 실패 시 필기 없는 원해상도로 대체합니다. 색 삭제/인페인팅/책파일 추출/설치·다운로드 없음.\n- 실제 성공: ${results.map(r=>r.name).join(', ')}. 실물기기/Safari/실계정동기화/APK/실배포 미검사. Android설정629/5.8.1만 변경했습니다.\n- 풀이 경계127곳·정답 검증·전체 개별 대조·커밋/Push/배포는 별도 미완료입니다. Git 플러그인403을 다른 경로로 우회하지 않았습니다. 교보 진도84% 복귀는 미확인이며 보기 복원 실제 상태는 reader-restoration.json을 확인합니다.\n\n로그: work/hansol-ink-hidden/result.json·각 검사.log.\n`;
fs.writeFileSync('docs/summary-2026-11-03-v581-ink-hidden.md',summary);
const file='WORK_STATE.md',state=fs.readFileSync(file,'utf8'),start='<!-- hansol-direct-upscale-status:start -->',end='<!-- hansol-direct-upscale-status:end -->';
assert.equal(state.split(start).length,2);assert.equal(state.split(end).length,2);
const block=`${start}\n### 2026-11-04 v5.8.1 — 필기 영향40개만 교체·로컬 완료\n\n- 눈 버튼으로 빨간 체크·검은 필기는 숨겨지고 인쇄 원문은 남음을 직접 확인했다. 정상332화면을 비교용 저장했다. 전체397쪽 재처리는 사용자 정정으로중단하고 필기 영향14쪽+26문제/풀이만 개선·교체했다. 영향 없는383쪽/기존 개선474장 유지. 불필요한 새 파일은work로 옮겨보존하며 배포하지 않는다.\n- 기존Mac Real-ESRGAN4배→2배bicubic·tile256·losslessWebP 사용. 이전 캡처/397PNG/500개 개선본/일반은행6+교재은행1/문제·정답·좌표 보존을 검사했다. 색삭제/인페인팅/새 설치·다운로드/보안변경/Git우회 없음.\n- 실제 성공: ${results.map(r=>r.name).join(' · ')}. 실물기기/Safari/실계정동기화/APK/실배포 미검사. 공개5.8.1·캐시629·Android설정629/5.8.1만 변경.\n- 풀이경계127·정답검증/채점화·전체개별대조·커밋/Push/배포는 남는다. 교보한쪽보기/필기숨김·창1024×800복원, 진도84%복귀미확인. 실제상태reader-restoration.json참조. 결과work/hansol-ink-hidden/result.json·summary docs/summary-2026-11-03-v581-ink-hidden.md.\n${end}`;
fs.writeFileSync(file,state.slice(0,state.indexOf(start))+block+state.slice(state.indexOf(end)+end.length));
console.log(JSON.stringify(report,null,2));
