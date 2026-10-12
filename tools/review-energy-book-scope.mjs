// Manual source comparison, not an OCR-score acceptance rule.
// Re-run from repository root. Private OCR/render caches are unnecessary here.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { energyMidtermBookChecks } from './energy-midterm-references.mjs';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const source = fs.readFileSync('data/energy-midterm.js');
assert.equal(sha(source), '5c0c1953885b07f06150ffab77b8f4dc61b87c39f2ce0d5e7c5e65beb8e3f4bd', '문제은행이 바뀌었습니다. 이전 대조 판정을 자동 재사용하지 마세요.');
const context = { window: {} };
vm.runInNewContext(source.toString(), context);
const bank = context.window.CBT_DATA_ENERGY_MIDTERM;
const labels = { previous: '기존 수록 근거', same: '이번 동일 문항 확인', variant: '관련 변형 - 동일 수록 미확인', theory: '이론·해설 대응만 확인', unresolved: '동일 수록 미확인' };
// short origin key | verdict | PDF page | book question number (0=not established) | reason
const reviewText = `
20020908:61|same|625|33|질문과 네 보기 내용 일치. 보기 순서는 다름.
20030316:17|theory|137|0|세정 집진 설명은 있으나 해당 네 보기 객관식은 미확인.
20030831:12|unresolved|515|0|집진 분류표와 다른 질문만 확인. 해당 객관식은 미확인.
20030831:13|theory|137|0|집진 원리는 대응하나 해당 질문과 네 보기 조합 미확인.
20050306:4|variant|370|9|원심력 장치 질문과 건식 아닌 장치 질문이 다르고 정답 내용도 다름.
20140525:16|variant|325|1|원문은 여과 집진, 교재 후보는 전기 집진. 장치가 다름.
20140920:14|variant|325|2|장치를 고르는 질문과 사용 힘을 고르는 질문이 반대 방향.
20150531:4|variant|491|72|집진 선정 조건의 틀린 보기가 먼지 색/산소 농도로 다름.
20180915:3|same|339|3|질문과 네 보기 내용 일치.
20020310:21|same|431|1|질문과 네 보기 내용 일치. 보기 순서는 다름.
20020310:25|same|433|14|질문과 네 보기 내용 일치. 보기 순서는 다름.
20020310:39|variant|432|10|200 kPa·kJ와 2 kgf/cm²·kcal 조건이 달라 동일 계산문항으로 확정하지 않음.
20020526:32|same|465|13|질문과 네 보기 내용 일치.
20020908:21|unresolved|538|0|상위 검색 후보는 다른 문제. 해당 네 보기 문항 미확인.
20020908:30|variant|326|5|200 kJ와 외부 일 입력 조건이 교재의 40 kJ·일 출력 조건과 다름.
20020908:39|unresolved|450|0|50 kcal·5000 kgf·m 조건의 동일 문항을 찾지 못함.
20030316:38|variant|326|5|10 kcal·4270 kgf·m 조건과 교재 40 kJ·30 kJ 조건이 다름.
20030525:21|variant|403|18|원문 Q≠W와 교재 절댓값 Q/W 부등식 표기가 달라 동일 확정 보류.
20040905:21|theory|6|0|제1법칙 이론 대응. 해당 네 공식 보기 객관식은 미확인.
20040905:27|variant|432|7|내부에너지 정답 개념은 같으나 나머지 식과 질문 표현이 다름.
20040905:32|unresolved|387|0|단열 압축 150℃·비열 조건의 동일 문항 미확인.
20050320:33|variant|433|14|제1법칙 정답 개념은 같으나 네 보기 조합이 다름.
20120304:27|variant|480|0|정적 가열 10 kg·20→100℃ 조건과 후보의 조건이 다름.
20130310:34|variant|622|17|300 kPa·0.5→0.7·50→110 kJ와 후보 200 kPa·0.4→0.6·80→120 kJ는 다른 수치.
20140302:14|variant|340|0|법칙의 설명/법칙명을 묻는 방향과 보기 구성이 다름.
20140525:3|variant|431|1|에너지 보존 개념은 같으나 질문과 네 보기 조합이 다름.
20150531:18|unresolved|466|0|내부에너지·엔탈피 오답 진술을 포함한 동일 문항 미확인.
20170305:6|unresolved|480|0|단열 비열 조건과 검색 후보의 엔트로피 조건이 달라 동일 문항 미확인.
20200606:18|same|403|18|질문과 네 보기의 수식 표기 일치.
20190427:68|same|380|68|질문과 네 보기 내용 일치.
20120304:63|variant|492|75|물리적 처리 아닌 것/화학적 처리 아닌 것의 질문과 정답이 다름.
20170923:73|same|518|45|질문과 네 보기 내용 일치.
20180915:66|same|350|66|질문과 네 보기 내용 일치.
20190921:2|same|384|2|질문과 네 보기 내용 일치.
20120304:17|unresolved|371|0|고체연료 장점을 묻는 원문과 액체연료 후보가 달라 동일 수록 미확인.
20050306:6|unresolved|450|0|예혼합 연소 특징의 해당 네 보기 객관식 미확인.
20150919:12|variant|545|17|기체 버너의 틀린 보기가 조절범위/공기비 제어로 다름.
20150919:17|variant|402|10|기체연료 질문은 있으나 온도 분포 진술 등 네 보기 구성이 다름.
20160306:1|same|545|17|질문과 네 보기 내용 일치. 561쪽15번에도 대응 후보가 있음.
20170305:4|variant|402|10|기체연료 체적당 발열량 진술 등 보기 구성이 다름.
20170507:12|variant|402|10|회분이 많다는 오답 등 원문 네 보기와 교재 후보가 다름.
20190427:15|same|371|15|질문과 네 보기 내용 일치.
20200606:10|same|402|10|질문과 네 보기 내용 일치.
20200822:8|same|417|8|질문과 네 보기 내용 일치.
20020526:5|same|465|12|네 공식의 의미와 조건 일치. 보기 순서 차이를 원문으로 확인.
20150308:36|theory|210|0|보일러 마력 공식은 본문에 있으나 네 공식 보기 문항 미확인.
20150531:26|theory|607|0|539Ge=GHLη 관계가 해설에 있으나 해당 공식 선택 문항은 미확인.
20150919:29|theory|375|36|상당증발량 정의는 해설에 있으나 교재 객관식은 용량 진술 질문.
20160306:23|variant|344|0|5마력→78.25와 1마력 환산 질문은 수치가 다름.
20160508:26|variant|334|57|증발량2000은 같아도 엔탈피715/급수15와 600/30 조건이 다름.
20160508:38|theory|375|36|1기압100℃ 정의가 해설에 있으나 해당 보기 조합의 객관식은 미확인.
20160508:51|variant|334|57|3500·640/20과 2000·600/30은 다른 계산 조건.
20170507:26|same|628|52|질문과 네 보기 내용 일치.
20150919:54|variant|621|13|보염기 아닌 보기의 원문 대류형과 교재 평행류형이 다름. 질문 표현도 다름.
20030316:12|theory|486|0|버너타일·에어레지스터 역할은 대응하나 장치 아닌 것 질문과 다름.
20130310:19|variant|609|0|크레이머 포함 장치 종류 질문과 교재의 역할 아닌 것 질문은 다름.
20150308:43|same|579|30|질문과 네 보기 내용 일치.
20020908:78|theory|118|0|신축이음 설치 목적은 본문에 있으나 해당 객관식은 미확인.
20130310:64|variant|568|50|스위블 원리와 정답 개념은 같지만 질문 축약 및 루프/신축곡관 등 보기 표기가 달라 엄격한 동일 수록에서는 보류.
20140302:50|same|568|50|질문과 네 보기 의미 일치. 영문 병기 생략만 있음.
20190303:39|same|360|39|질문과 네 보기 내용 일치.
20170507:69|variant|583|0|인터록 아닌 보기가 고수위/고온도 등으로 다름.
20200822:55|same|425|55|질문과 네 보기 내용 일치.
20030316:78|variant|594|32|트랩 작동 원리는 같으나 네 트랩 종류 보기 구성이 다름.
20050306:77|unresolved|435|0|검색 후보는 유량계 설치 문제. 해당 트랩 주의 문항 미확인.
20060305:72|theory|172|0|자동 응축수 배출 설명은 있으나 해당 네 보기 객관식은 미확인.
20140302:73|theory|169|0|버킷 트랩·역지밸브 설명은 있으나 해당 객관식 미확인.
20150531:60|unresolved|504|0|트랩 누설 원인의 해당 보기 조합 미확인.
20150919:49|same|594|32|질문과 네 보기 내용 일치.
20170507:64|same|578|25|질문과 네 보기 내용 일치. 보일러 설비라는 도입 표현만 추가.
20170923:52|unresolved|343|0|검색 후보는 액주식 압력계. 트랩 구비조건의 해당 객관식 미확인.
20190427:54|same|378|54|질문과 네 보기 내용 일치.
20200606:49|same|409|49|질문과 네 보기 내용 일치.
20200606:73|same|413|73|질문과 네 보기 내용 일치.
20160306:64|variant|491|0|최고사용압력1.6 MPa와 후보2.0 MPa가 달라 같은 계산문항으로 확정하지 않음.
20180304:77|same|323|77|질문과 네 보기 내용 일치.
20140920:62|variant|336|68|환수 방식 아닌 것과 가장 빠른 방식의 질문은 다름.
20170305:78|variant|336|68|진공펌프·설치 제약 조건이 원문 질문에 있으나 교재 질문은 빠른 환수만 묻고 나머지는 해설에 있음.
20190921:66|same|396|66|질문과 네 보기 내용 일치.
20030525:70|variant|336|69|급수/관수 대상과 인산염/인산나트륨 표기가 달라 동일 확정 보류.
20030831:66|variant|381|0|약품의 CaCO3 방지 용도와 산세척 중화 용도를 묻는 질문은 다름.
20050306:78|unresolved|320|0|알칼리 처리의 해당 네 긴 진술 객관식 미확인.
20050320:74|theory|248|0|pH 처리 본문은 있으나 탈기가 포함된 해당 네 보기 문항 미확인.
20170305:70|same|505|58|질문과 네 보기 내용 일치.
20140525:79|theory|246|0|가성취화 방지 약품은 설명에 있으나 해당 객관식은 미확인.
20140920:78|theory|163|0|점화 전 환기 설명은 있으나 해당 네 보기 문항 미확인. 427쪽 검색 후보는 수트블로워 질문.
20170923:69|theory|163|0|점화 전 환기 설명은 있으나 해당 네 보기 문항 미확인. 427쪽 검색 후보는 수트블로워 질문.
20161001:64|variant|336|70|배관 외부 표시의 틀린 보기가 최고사용온도/가스제조일자로 다름.
`.trim();
const decisions = new Map(reviewText.split('\n').map(line => {
  const [key, status, page, number, reason] = line.split('|');
  assert.ok(labels[status] && Number(page) > 0 && reason);
  return [key, { status, pdfPage: Number(page), bookQuestionNumber: Number(number) || null, reason }];
}));
assert.equal(decisions.size, 88);
const rows = bank.rounds.flatMap((round, topicIndex) => round.questions.map(q => {
  const id = `${q._originRoundId}:${q._originalNumber}`;
  const shortKey = id.replace('school-energy-energy-industrial-', '');
  const previous = q.bookVerified;
  const decision = previous ? null : decisions.get(shortKey);
  assert.ok(previous || decision, `Missing manual decision: ${id}`);
  const prior = energyMidtermBookChecks.find(r => shortKey === `${r.date}:${r.number}`);
  const evidence = previous ? (q.midtermPdfSources?.length ? q.midtermPdfSources.map(r => ({ ...r, kind: 'previous-pdf-source' })) : prior ? [{ ...prior, kind: 'previous-book-check' }] : []) : [{ pdfPage: decision.pdfPage, bookQuestionNumber: decision.bookQuestionNumber, kind: decision.status === 'same' ? 'current-visual-match' : 'comparison-only-not-inclusion-evidence' }];
  assert.ok(evidence.length, `Missing source reference: ${id}`);
  const status = previous ? 'previous' : decision.status;
  return {
    id, fingerprint: sha(JSON.stringify(q)), topic: topicIndex + 1, topicTitle: round.title,
    sourceLabel: q.sourceQualification || q.sourcePage, active: !q.midtermDuplicateOf,
    duplicateOf: q.midtermDuplicateOf || null, calculation: !!q.midtermCalculation,
    status, statusLabel: labels[status], confirmed: previous || status === 'same',
    reason: previous ? '이전에 원문 대조해 기록한 수록 근거 유지. 이번에 91개를 전부 다시 시각 검수한 것은 아님.' : decision.reason,
    evidence, question: q.text || '', choices: q.choices.map(c => c.text || c.html || ''),
    storedAnswer: q.answer, sourceImage: q.sourceImage || null,
  };
}));
assert.equal(rows.length, 179);
assert.equal(new Set(rows.map(r => r.id)).size, 179);
const count = predicate => rows.filter(predicate).length;
const report = {
  date: '2026-10-12', appVersion: '5.8.6', scope: '에너지설비 중간고사 교재 수록 대조 - 앱 필터 미적용',
  source: { name: '에너지설비.pdf', pages: 634, sha256: '840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d' },
  bankSha256: sha(source),
  method: '634쪽 Apple Vision 검색 보조. 기존 수록 확인91개는 이전 근거를 유지하고 미확인88개의 질문·네 보기와 상위 후보 원문64쪽의22검수 시트 및 추가 전체 페이지를 시각 대조. 검색 유사도만으로 수록 승인하지 않음.',
  limits: '교재634쪽을 모두 눈으로 읽은 전수 검수나 정답 사실 검증은 아님. 미확인은 부재 증명이 아님. 숫자·단위·질문 대상·오답 내용이 다른 변형과 이론/해설에만 있는 내용은 동일 문항 수록으로 확정하지 않음. 계산 기본6/11 및 앱의 출제·기록은 변경 없음.',
  counts: { raw: rows.length, active: count(r => r.active), retired: count(r => !r.active), previous: count(r => r.status === 'previous'), newConfirmed: count(r => r.status === 'same'), confirmedRaw: count(r => r.confirmed), confirmedActive: count(r => r.confirmed && r.active), unconfirmedRaw: count(r => !r.confirmed), unconfirmedActive: count(r => !r.confirmed && r.active), byStatus: Object.fromEntries(Object.keys(labels).map(s => [s, count(r => r.status === s)])) },
  topics: bank.rounds.map((r, i) => ({ topic: i + 1, title: r.title, active: count(q => q.topic === i + 1 && q.active), confirmed: count(q => q.topic === i + 1 && q.active && q.confirmed), unconfirmed: count(q => q.topic === i + 1 && q.active && !q.confirmed) })), rows,
};
assert.equal(report.counts.newConfirmed, 28);
assert.equal(report.counts.confirmedRaw, 119);
assert.equal(report.counts.confirmedActive, 100);
const base = 'docs/energy-midterm-book-scope-2026-10-12';
fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2) + '\n');
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = JSON.stringify(report).replaceAll('<', '\\u003c');
fs.writeFileSync(`${base}.html`, `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>에너지 중간고사 교재 수록 대조</title><style>
:root{color-scheme:dark light;font-family:system-ui,sans-serif}body{margin:auto;padding:24px;max-width:1250px;background:light-dark(#f6f8fb,#101924);color:light-dark(#172333,#e7edf5);line-height:1.6}h1{font-size:26px}button,input,select{font:inherit;padding:9px;border:1px solid #7b8b9e;border-radius:8px;max-width:100%;box-sizing:border-box}a{color:light-dark(#135fb7,#8bc1ff)}.notice,article{padding:18px;border:1px solid #66788e;border-radius:12px;margin:14px 0}.notice{background:light-dark(#e9f1fc,#1b2d44)}.filters{display:flex;gap:12px;flex-wrap:wrap;position:sticky;top:0;padding:12px;background:light-dark(#f6f8fb,#101924);z-index:1}.muted{opacity:.75}.badge{display:inline-block;border-radius:5px;padding:2px 9px;background:light-dark(#dbe6f5,#33485f);margin-right:8px}.same,.previous{border-left:5px solid #38a97f}.variant{border-left:5px solid #e9ae43}summary{cursor:pointer}li{overflow-wrap:anywhere}img{display:block;max-width:100%;background:white;margin-top:12px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #66788e}h2{font-size:19px}article p{margin:8px 0}code{overflow-wrap:anywhere}details{margin:12px 0}</style>
<h1>에너지 중간고사: 교재 수록 대조</h1><p>2026-10-12 · 앱5.8.6 유지 · 원본·풀이 기록·출제 필터 변경 없음</p>
<div class="notice"><strong>기존91개 + 이번28개 = 수록 근거119개</strong><br>기록용179ID 기준. 중복 제외 후 현재 대표154개 중 확인100개·미확인54개.<br>미확인은 ‘책에 없다’는 뜻이 아닙니다. 변형·본문 설명만 대응하는 경우를 동일 문항과 구분했습니다.</div>
<p>${esc(report.method)}</p><p class="muted">${esc(report.limits)}</p><p>페이지는 <strong>PDF 첫 장을1쪽으로 센 위치</strong>이며 책 인쇄 쪽수와 다릅니다. 원본 PDF·OCR 전문·스캔 페이지는 공개하지 않습니다. 기존 앱 문제만 아래에서 확인합니다.</p>
<details><summary>20주제별 현재 대표 수록 확인 수량</summary><table><thead><tr><th>주제</th><th>현재</th><th>확인</th><th>미확인</th></tr></thead><tbody>${report.topics.map(t => `<tr><td>${esc(t.title)}</td><td>${t.active}</td><td>${t.confirmed}</td><td>${t.unconfirmed}</td></tr>`).join('')}</tbody></table></details>
<div class="filters"><label>판정 <select id="status"><option value="all">전체</option><option value="new">이번 검토88개</option><option value="same">이번 확인28개</option><option value="unconfirmed">수록 미확인60개</option><option value="previous">기존 근거91개</option></select></label><label>문항 <select id="active"><option value="active">현재 대표154개</option><option value="all">과거ID 포함179개</option></select></label><input id="search" type="search" aria-label="주제·문제·출처 검색" placeholder="주제·문제·출처 검색"></div><p id="count" role="status"></p><main id="rows"></main>
<script type="application/json" id="report">${json}</script><script>
const report=JSON.parse(document.querySelector('#report').textContent),root=document.querySelector('#rows');
const escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const status=document.querySelector('#status').value,active=document.querySelector('#active').value,query=document.querySelector('#search').value.toLowerCase();const rows=report.rows.filter(r=>(active==='all'||r.active)&&(status==='all'||status==='new'&&r.status!=='previous'||status==='unconfirmed'&&!r.confirmed||r.status===status)&&JSON.stringify(r).toLowerCase().includes(query));document.querySelector('#count').textContent=rows.length+'개 표시';root.innerHTML=rows.map(r=>'<article class="'+r.status+'"><span class="badge">'+escapeHtml(r.statusLabel)+'</span><span class="muted">'+(r.active?'현재 대표':'과거 기록용ID')+(r.calculation?' · 계산':'')+'</span><h2>'+escapeHtml(r.topicTitle)+' / '+escapeHtml(r.sourceLabel)+'</h2><p>'+escapeHtml(r.question)+'</p><p><strong>대조:</strong> '+escapeHtml(r.reason)+'</p><p class="muted">'+r.evidence.map(e=>'PDF '+e.pdfPage+'쪽'+(e.bookQuestionNumber?' · '+e.bookQuestionNumber+'번':'')+(e.year?' · '+e.year+'년 '+e.session+'회 '+e.number+'번':'')).join(' / ')+'</p><details><summary>기존 앱 보기·등록 답안 확인</summary><ol>'+r.choices.map(c=>'<li>'+escapeHtml(c)+'</li>').join('')+'</ol><p>앱 등록 정답: '+r.storedAnswer+'번 (이번 사실 검증 판정 아님)</p>'+(r.sourceImage?'<img loading="lazy" src="../'+escapeHtml(r.sourceImage)+'" alt="기존 앱 문제 원문">':'')+'<p><code>'+escapeHtml(r.id)+'</code></p></details></article>').join('')}
for(const id of ['status','active','search'])document.querySelector('#'+id).addEventListener(id==='search'?'input':'change',render);render();
</script></html>\n`);
console.log(JSON.stringify(report.counts, null, 2));
