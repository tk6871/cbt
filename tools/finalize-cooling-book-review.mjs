// Rebuild minimal linkage evidence from the locally retained review, not book text.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const dir = 'work/cooling-book-scope/';
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'));
const context = { window: {} };
const sourceHashes = read('source-bank-sha256.json');
for (const name of ['hvac', 'hvac-hansol']) {
  const source = fs.readFileSync(`data/${name}.js`);
  if (createHash('sha256').update(source).digest('hex') !== sourceHashes[name]) {
    throw new Error(`Bank changed since review: ${name}. Re-review before changing the evidence baseline.`);
  }
  vm.runInNewContext(source.toString('utf8'), context);
}
const bank = new Map();
for (const b of Object.values(context.window)) for (const r of b.rounds) for (const q of r.questions) {
  const id = `${q._originRoundId || r.id}:${q._originalNumber || q.number}`;
  if (r.year >= 2006 && r.year <= 2023 && b.key === (r.year >= 2017 ? 'hvac-hansol' : 'hvac')
    && !(r.year === 2006 && r.id < 'hvac-20060816')
    && !(r.year === 2023 && /^\d회$/.test(r.session) && parseInt(r.session, 10) > 3)) bank.set(id, q);
}
const key = (page, number) => `${page}:${number}`;
const answers = new Map(Object.entries(read('ui-answer-locations.json').answers)
  .flatMap(([page, rows]) => rows.map(([n, a]) => [key(page, n), a])));
const decisions = new Map();
for (const r of read('fingerprint-comparison.json').rows) {
  const c = r.candidates.find(c => c.stemEqual && c.firstThreeEqual && c.fourthPrefixEqual && !c.hasGraphics);
  if (!c) continue;
  const agrees = bank.get(c.id)?.answer === answers.get(key(r.page, r.number));
  decisions.set(key(r.page, r.number), { id: c.id,
    status: agrees ? 'confirmed-text' : 'pending-answer-disagreement',
    note: agrees ? '지문·보기 4개·인쇄 정답 번호 일치. 읽어 둔 본문의 보기 끝 경계 확인.' : '보기는 같지만 인쇄 정답 번호와 기존 정답 번호가 다름. 정답 변경 없이 보류.' });
}
for (const r of read('visual-difference-review.json').rows) {
  if (r.page === '2-32' && r.number === 4) {
    decisions.set(key(r.page, r.number), { id: r.id, status: 'pending-printed-word-difference', note: '교재와 기존 자료의 단어가 다름. 원문 유지.' });
    continue;
  }
  if (bank.get(r.id)?.answer !== answers.get(key(r.page, r.number))) throw new Error(`Visual answer mismatch ${r.id}`);
  decisions.set(key(r.page, r.number), { id: r.id, status: 'confirmed-native-transcription', note: '앱 화면에서 수식 배열·조사·기존 표기 차이를 확인. 조건·보기 의미·등록 정답 유지.' });
}
for (const [page, number, id, verdict, note] of read('native-equivalence-review.json').rows) {
  let summary = verdict.startsWith('equivalent') ? '앱 원문에서 문제·보기 4개·등록 정답 대조. 기존 원문은 유지.'
    : '동일한 기존 원문과의 연결 미확정. 검색 후보만으로 연결하지 않음.';
  if (/footer-number-offset/.test(verdict)) summary = '문제·보기 대조. 교재 하단 정답 번호 어긋남은 해설과 대조했고 기존 정답은 변경하지 않음.';
  if (/unit|value|power/.test(verdict)) summary = '단위·계산 수치 또는 보기 값이 기존 자료와 다름. 동일 문제로 자동 연결하지 않음.';
  if (/choice|wording|reordered|unused-conditions/.test(verdict)) summary = '보기 내용·순서 또는 문제 조건이 기존 자료와 다름. 같은 정답 번호만으로 연결하지 않음.';
  if (/lower-bound/.test(verdict)) summary = '교재 기재 회차가 2006년3회 이전. 허용 범위 안의 동일 원문 미연결.';
  if (/non-multiple-choice/.test(verdict)) summary = '객관식 보기 없는 계산 예제. 보기를 임의 생성하지 않음.';
  if (/graphics/.test(verdict)) summary = '교재 수식·도표 확인, 기존 자료의 이미지 보기와 추가 대조 필요.';
  if (/permit-report/.test(verdict)) summary = '교재는 제조신고, 기존 자료는 제조허가를 물음. 질문 대상 차이로 보류.';
  if (/question-target-and-answer/.test(verdict)) summary = '교재는 시험용 가스(질소②), 기존 자료는 시험 매체(물①)를 물음. 질문 대상·정답 차이로 보류.';
  decisions.set(key(page, number), { id, status: verdict.startsWith('equivalent') ? 'confirmed-native' : verdict, note: summary });
}
const fingerprint = q => {
  const text = JSON.stringify([q.text || '', q.html || '', q.ocrText || '',
    q.choices.map(c => [c.text || '', c.html || '', c.images || []]), q.answer, q.images || [], q.sourceImage || '']);
  let h = 14695981039346656037n;
  for (const ch of text) { h ^= BigInt(ch.codePointAt(0)); h = BigInt.asUintN(64, h * 1099511628211n); }
  return h.toString(16);
};
const rows = read('match-candidates.json').rows.map(r => {
  const d = decisions.get(key(r.page, r.number)) || { id: null,
    status: Number(r.page.slice(2)) < 18 ? 'pending-non-multiple-choice-example' : 'pending-full-comparison',
    note: '일치 연결 미확정. 검색 후보만으로 수록·부재를 판정하지 않음.' };
  const confirmed = d.status.startsWith('confirmed');
  if (confirmed && !bank.has(d.id)) throw new Error(`Missing or disallowed source ${d.id}`);
  return { page: r.page, number: r.number, ...d,
    ...(confirmed ? { fingerprint: fingerprint(bank.get(d.id)) } : {}) };
});
if (new Set(rows.map(r => key(r.page, r.number))).size !== rows.length) throw new Error('Duplicate location');
const confirmed = rows.filter(r => r.status.startsWith('confirmed'));
const report = { version: 1, date: '2026-10-14', sourceHashes, totalLocations: rows.length,
  confirmedLocations: confirmed.length, confirmedSourceIds: new Set(confirmed.map(r => r.id)).size,
  pendingLocations: rows.length - confirmed.length,
  limits: '기존 자료와 연결 확인된 부분 목록. 교재 전체 수록 완료·정답 사실 검증·미확인 문제의 부재 증명이 아님. 원문·정답·기록 변경 없음.', rows };
fs.writeFileSync('data/cooling-midterm-book-review.json', JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync('data/cooling-midterm-book-verified.json', JSON.stringify({
  totalLocations: report.totalLocations, confirmedLocations: report.confirmedLocations,
  pendingLocations: report.pendingLocations,
  entries: confirmed.map(r => [r.id, r.fingerprint]),
}, null, 2) + '\n');
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>냉동 교재 본문 대조</title><style>body{font:17px/1.6 system-ui;max-width:1200px;margin:32px auto;padding:0 20px;background:#111827;color:#e5e7eb}select,input{font:inherit;padding:10px;color:inherit;background:#1f2937;border:1px solid #64748b;border-radius:8px}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #374151}small{color:#a5b4c7}a{color:#93c5fd}.ok{color:#86efac}h1{font-size:28px}@media(max-width:650px){td,th{padding:8px;font-size:14px}td:last-child{max-width:180px;overflow-wrap:anywhere}}</style><h1>냉동 교재 본문 대조</h1><p>${rows.length}위치 · 연결 확인 ${confirmed.length}위치 / ${report.confirmedSourceIds}원문 · 보류 ${report.pendingLocations}위치</p><p>${esc(report.limits)}</p><p>본문의 단원별 핵심·실전·예제를 대상으로 하며 맨 뒤 회차별 부록은 제외합니다. 안전관리는 별도 유지합니다. 정답 충돌과 단위·수치·보기 차이는 연결 확인에서 제외합니다.</p><label>판정 <select id="filter"><option value="all">전체</option><option value="confirmed">연결 확인</option><option value="pending">보류·추가 확인</option><option value="answer">정답 차이</option></select></label> <label>검색 <input id="search" placeholder="쪽·번호·원문 ID"></label><p id="count"></p><table><thead><tr><th>교재 위치</th><th>원문 ID</th><th>판정·근거</th></tr></thead><tbody>${rows.map(r => `<tr data-status="${esc(r.status)}"><td>${esc(r.page)} · ${r.number}번</td><td>${esc(r.id || '미연결')}</td><td><strong class="${r.status.startsWith('confirmed') ? 'ok' : ''}">${r.status.startsWith('confirmed') ? '연결 확인' : '보류'}</strong><br><small>${esc(r.note)}</small></td></tr>`).join('')}</tbody></table><script>const filter=document.querySelector('#filter'),search=document.querySelector('#search'),rows=[...document.querySelectorAll('tbody tr')];function update(){let count=0;for(const row of rows){const status=row.dataset.status,visible=(filter.value==='all'||status.startsWith(filter.value)||filter.value==='answer'&&status.includes('answer'))&&row.textContent.toLowerCase().includes(search.value.toLowerCase());row.hidden=!visible;if(visible)count++;}document.querySelector('#count').textContent=count+'위치 표시';}filter.onchange=update;search.oninput=update;update();</script></html>`;
fs.writeFileSync('docs/cooling-book-review-2026-10-14.html', html);
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
