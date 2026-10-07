import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('data/hvac-practical-restored.json','utf8'));
const old=JSON.parse(fs.readFileSync('docs/hvac-practical-missing-visuals-2026-10-06.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('data/hvac-practical-remaining-video-crops.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('data/hvac-practical-public-video-sources.json','utf8'));
const history=JSON.parse(fs.readFileSync('data/hvac-practical-remaining-review-history.json','utf8'));
const partial=new Set(['hvac-practical-restored-2019-3-07','hvac-practical-restored-2020-3-05','hvac-practical-restored-2020-1-09']);
const entries=old.imageDependentWithoutMedia.map(candidate=>{
 const row=rows.find(r=>r.id===candidate.id);
 const crops=manifest.crops.filter(c=>c.id===row.id);
 const video=catalog.sources.find(s=>s.year===row.year&&s.session===String(row.session));
 const chapter=video.chapters.find(c=>c.number===row.number);
 const status=crops.some(c=>c.role==='question')?'question-image-added':crops.some(c=>c.role==='answer')?'answer-image-only':'dynamic-video-only';
 return {id:row.id,status,sourceUrl:`${video.url}&t=${chapter.startSeconds}s`,outputs:crops.map(c=>c.output)};
});
for(const e of entries)e.limitation=e.status==='answer-image-only'?'사진에 장치명이 있어 문제에는 표시하지 않음. 무기명 원본 미확보.':e.status==='dynamic-video-only'?'안전 작업 동작은 정지 사진으로 재현하지 않음. 원문 영상 필요.':partial.has(e.id)?'대표 사진에서 전체 회전·원래 위치 기호를 재현하지 못함. 원문 영상 함께 확인.':'사진 대조는 원문 전체 동작의 검증 완료가 아님.';
const report={date:'2026-10-07',version:'5.6',originalCandidates:entries.length,crops:manifest.crops.length,
 changedQuestions:history.changes.length,expandedChoiceAnswers:15,sourceLinks:192,
 statusCounts:entries.reduce((c,e)=>(c[e.status]=(c[e.status]||0)+1,c),{}),entries,
 remaining:['2018-3-12·2020-2A-04 무기명 문제용 원본 사진','2019-2-06 드릴 작업은 원문 동작 영상 확인 필요','2019-3-07·2020-3-05 입체 배관 대표 화면의 화면 밖 부분·전체 회전','2020-1-09 원문 (가)~(라) 위치 도면 미확보, 고온 증발기 출구로 문장 보완','2023-2 책 미대응 보일러 변형','일부 기존 이미지 대장의 source-needed/repair/quality-review 항목과 전312문항 공식 정답 사실 검증'],
 limitation:'108개 초기/추가 후보 클립과 제한된 후속 구간·원문 자동자막·최종90크롭을 직접 확인. 전체 영상 음성 전부 청취 또는312문항 정답 사실검증 완료 아님. 이름만으로 유사 부품을 바꾸지 않음.'};
fs.writeFileSync('docs/hvac-practical-remaining-review-2026-10-07.json',JSON.stringify(report,null,2)+'\n');
const md=`# v5.6 공조 필답형 후속 검수 — 2026-10-07\n\n기존 무그림 후보${report.originalCandidates}개는 문제 사진 추가${report.statusCounts['question-image-added']}개 / 답안 사진만${report.statusCounts['answer-image-only']}개로 구분했다. 후보 목록 외 드릴 안전 작업1문항은 동작 영상 전용이다. 새 사진은 총90개(후보 외 추가 그림 포함), 변경102문항이다. 가·나·번호만 있던15개 답안에 동작/판단 근거를 보강했다. 기존 ID·책95개 대응·학습 저장 구조·원본 파일은 보존했다.\n\n2023-1 2번은 공개 원문06:17~11:22에서 RL은 전원 직결, GL만 자기유지 운전이라는 설명을 확인했다. 저장 보기의 나 회로는 달랐으므로 제어부만 다시 작성했으며 기존 파일과 교정 전 문장은 이력에 보존했다. 2020-3 12번 스프링식 안전밸브,2020-4 7번 오일레귤레이터,2019-3 6번 EOCR은 외형 의심 후 원문 자동자막을 다시 대조해 기존 답안을 유지했다.\n\n## 아직 남은 제한\n\n${report.remaining.map(s=>'- '+s).join('\n')}\n\n${report.limitation}\n\n## 기존 후보 개별 기록\n\n|문항 ID|이번 처리|남은 제한|\n|---|---|---|\n${entries.map(e=>`|${e.id}|${e.status}|${e.limitation}|`).join('\n')}\n\n좌표·원문 시점·해시는 data/hvac-practical-remaining-video-crops.json, 적용 전후102문항은 data/hvac-practical-remaining-review-history.json. [현재 전체 이미지 대장](hvac-practical-full-image-audit-2026-09-15.html).\n`;
fs.writeFileSync('docs/hvac-practical-remaining-review-2026-10-07.md',md);
console.log(JSON.stringify({candidates:report.originalCandidates,statusCounts:report.statusCounts}));
