import fs from 'node:fs';
import crypto from 'node:crypto';

export const verdictPath = 'docs/energy-midterm-duplicate-verdicts-2026-10-12.json';
export const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function applyVerdicts(report, verdicts) {
  if (report.scope !== 'energy-midterm-only' || report.rows.length !== 179 || report.pairs.length !== 76) throw Error('Unexpected review scope');
  if (digest(report.rows) !== verdicts.rowsDigest) throw Error('Reviewed question content changed; review verdicts before reuse');
  const currentIds = report.pairs.map(p => p.id).sort();
  if (digest(currentIds) !== verdicts.pairSetDigest) throw Error('Candidate set changed; review new pairs first');
  for (const [path, sha] of Object.entries(verdicts.assetDigests)) {
    if (crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex') !== sha) throw Error('Reviewed image changed: '+path);
  }
  const reviews = new Map(verdicts.reviews.map(r => [r.id, r]));
  const imported = new Map(verdicts.importedReviews.map(r => [r.id, r]));
  if (reviews.size !== 76 || imported.size !== 10) throw Error('Incomplete or duplicated reviews');
  const states = {same:'확인된 반복', variant:'확인된 변형', different:'다른 문제'};
  for (const p of report.pairs) {
    const review = reviews.get(p.id);
    if (!review || !states[review.decision] || !review.reason) throw Error('Missing verdict: '+p.id);
    p.screening ??= {state:p.state, note:p.note, flags:p.flags};
    p.state = states[review.decision];
    p.note = review.reason;
    p.flags = [...(review.warnings || [])];
    p.review = {...review, userReview:imported.get(p.id) || null};
    p.reviewedSameCorrectContent = review.decision === 'same' ? true : null;
  }
  report.states = Object.fromEntries(Object.values(states).map(s => [s,report.pairs.filter(p=>p.state===s).length]));
  const parent = report.rows.map((_,i)=>i);
  const root = i => parent[i]===i ? i : (parent[i]=root(parent[i]));
  const repeated = new Set();
  for (const p of report.pairs.filter(p=>p.review.decision==='same')) {
    parent[root(p.a)]=root(p.b); repeated.add(p.a); repeated.add(p.b);
  }
  const groups = new Map();
  for (const i of repeated) {const r=root(i); if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  report.groups = [...groups.values()].map(indices=>indices.sort((a,b)=>a-b));
  report.repeatGroups = report.groups.length;
  report.repeatQuestions = repeated.size;
  report.reviewDate = verdicts.date;
  report.reviewedPairs = reviews.size;
  report.reviewComplete = true;
  report.importedReviewCount = imported.size;
  report.warningPairs = report.pairs.filter(p=>p.flags.length).length;
  report.limits = '중간고사179문제의 문자·보기15,931쌍을 선별한76후보를 내용 대조했습니다. 후보에 연결된 원문 이미지36장을 직접 확인했습니다. 반복은 질문·조건·4개 보기의 의미가 같고 순서·표기만 다른 경우입니다. 변형/다른 문제는 합치지 않습니다. 전179문항 정답 사실·최신 법규 검증이나 모든 의미 중복 누락0을 보장하지 않습니다. 원문 문제·정답·이미지·풀이 기록은 변경하지 않았습니다.';
  return report;
}
