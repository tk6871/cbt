// Synchronize references, keeping earlier reviews for unchanged bytes.
import fs from 'node:fs';
import crypto from 'node:crypto';
const path='docs/hvac-practical-full-image-audit-2026-09-15.json';
const report=JSON.parse(fs.readFileSync(path,'utf8'));
const crops=[...JSON.parse(fs.readFileSync('data/hvac-practical-october-scans.json','utf8')).crops,
  ...JSON.parse(fs.readFileSync('data/hvac-practical-2021-3-video-crops.json','utf8')).crops,
  ...JSON.parse(fs.readFileSync('data/hvac-practical-2022-1-video-crops.json','utf8')).crops,
  ...JSON.parse(fs.readFileSync('data/hvac-practical-2022-2023-video-crops.json','utf8')).crops,
  ...JSON.parse(fs.readFileSync('data/hvac-practical-2021-video-crops.json','utf8')).crops];
const cropBySource=new Map(crops.map(c=>[c.output,c]));
const restored=JSON.parse(fs.readFileSync('data/hvac-practical-restored.json','utf8'));
const publicRows=JSON.parse(fs.readFileSync('data/hvac-practical-moducbt.json','utf8'));
const current=[...restored,...publicRows].flatMap(r=>[
  ...[...(r.image?[r.image]:[]),...(r.images||r.sourceImages||[])].map(source=>({id:r.id,role:'question',source})),
  ...(r.answerImages||[]).map(source=>({id:r.id,role:'answer',source}))]);
const key=e=>`${e.id}|${e.role}|${e.source}`;
const exact=new Map(report.entries.map(e=>[key(e),e]));
const old=report.entries;
let next=Math.max(...old.map(e=>e.index))+1;
const used=new Set();
const entries=current.map(e=>{
  const hash=crypto.createHash('sha256').update(fs.readFileSync(e.source)).digest('hex');
  const same=exact.get(key(e));
  if(same&&same.sha256===hash){used.add(same.index);return same;}
  const crop=cropBySource.get(e.source);
  const previous=old.find(o=>o.id===e.id&&o.role===e.role&&!used.has(o.index));
  const moved=old.find(o=>o.id===e.id&&o.source===e.source&&o.sha256===hash);
  if(!crop&&!moved) throw new Error(`New unreviewed reference: ${e.source}`);
  const result={index:previous?.index??next++, ...e,sha256:hash,size:crop?.outputSize??moved.size,
    sheet:previous?.sheet??0,status:'repaired',reviewMethod:crop?.scan?'source-scan-and-individual-crop':'source-video-and-individual-crop',
    note:crop?.scan?`해설 스캔 ${crop.scan} 인쇄 ${crop.sourceQuestion}번과 내용 대응, 최종 그림 개별 확인.`:
      crop?`에듀강 ${crop.id.split('-')[3]}년 ${crop.id.split('-')[4]}회 공개 영상 ${crop.timestamp} 확인, 그림만 분리. ${crop.reviewNote||''}`:'입체 배관 원문을 문제에 복원하고 기존 완성 평면도는 답안에만 연결.',
    sourceComparison:crop?.scan?'user-provided-book-scan':'public-restoration-video',repairedInThisAudit:true,repairVersion:'5.5'};
  if(previous){result.previousSource=previous.source;result.previousSha256=previous.sha256;result.previousNote=previous.note;}
  used.add(result.index);return result;
});
const liveKeys=new Set(entries.map(key));
report.supersededReferences=[...(report.supersededReferences||[]),...old.filter(e=>!liveKeys.has(key(e))).map(e=>({...e,supersededReason:'2026-10-06 원문 대조 후 연결 교체·상충 답안 이미지 연결 해제. 원본 파일 보존.'}))];
report.entries=entries.sort((a,b)=>a.index-b.index);
report.scope=`현재 연결된 ${entries.length}개 이미지 참조. 이미지가 없는 문항은 별도 2026-10-06 누락 후보 보고서에서 관리함.`;
report.method=`기존 개별 검수 기록을 보존하고 새 스캔 그림52개·2021년1·2·3회/2022년1·2·3회/2023년1회 공개 영상 그림${crops.filter(c=>!c.scan).length}개를 원문/최종 크롭으로 직접 대조. 전체 문항 정답 검증 완료를 의미하지 않음.`;
report.statusCounts=entries.reduce((c,e)=>(c[e.status]=(c[e.status]||0)+1,c),{});
fs.writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({references:entries.length,addedOrReplacedCrops:crops.length,statusCounts:report.statusCounts}));
