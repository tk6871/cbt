import fs from 'node:fs';
import vm from 'node:vm';

// Read-only catalog analysis. Only independent review artifacts are generated.
const context = { window: {} };
for (const key of ['energy', 'energy-midterm']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`, 'utf8'), context);
const energy = context.window.CBT_DATA_ENERGY;
const midterm = context.window.CBT_DATA_ENERGY_MIDTERM;
const plain = text => String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const patterns = [
  /집진|사이클론|스크러버|전기식.*먼지/,
  /내부에너지|제\s*1\s*법칙|에너지보존|외부에너지/,
  /탈기|폭기|철.*제거|망간.*제거|가스제거/,
  /(?:고체|액체|기체)연료|연료의.*(?:특징|장점|단점)/,
  /연소(?:실)?온도|화염온도/,
  /상당증발량|증발계수/,
  /STC|ACC|FWC|ABC|자동제어.*약호/i,
  /보염|스테빌라이저|윈드박스/,
  /가용전|용융마개/,
  /신축이음|벨로즈|스위블|신축곡관|슬리브.*이음/,
  /스케[줄쥴]|schedule/i,
  /인터[록로크락]|interlock/i,
  /수트블로|매연.*취출|그을음.*제거/,
  /(?:증기)?트랩|응축수.*배출/,
  /수압시험/,
  /환수식|환수방법|환수방식/,
  /pH|급수.*약품|관수.*(?:처리|알칼리)|인산염|수산화나트륨|히드라진|아황산나트륨/i,
  /가성취화/,
  /역화|백파이어/,
  /도시가스.*(?:표시|고정|배관)|가스배관.*(?:표시|고정)/,
];
const selectedOrigins = new Map(midterm.rounds.flatMap((r, index) => r.questions.map(q => [
  `${String(q._originRoundId || '').replace(/^school-energy-/, '')}:${q._originalNumber}`, index,
])));
const rows = energy.rounds.flatMap(round => round.questions.map(q => {
  const id = `${round.id}:${q.number}`;
  const stem = plain(q.text || q.html || q.ocrText);
  const matches = patterns.map((pattern, index) => pattern.test(stem.replace(/\s/g, '')) ? index : -1).filter(index => index >= 0);
  const selected = selectedOrigins.get(id);
  return { id, year: round.year, session: round.session, number: q.number, stem,
    state: selected !== undefined ? '기존 중간고사' : matches.length === 1 ? '추가 검토 후보' : matches.length > 1 ? '경계 확인 필요' : '20주제 단서 없음',
    topic: selected !== undefined ? midterm.rounds[selected].title : matches.length === 1 ? midterm.rounds[matches[0]].title : '',
    evidence: selected !== undefined ? '기존 선정 대장 유지' : matches.map(index => midterm.rounds[index].title).join(' / ') || '원래 시험의 다른 범위일 수 있음',
    images: [q.sourceImage, ...(q.images || [])].filter(Boolean),
    choices: q.choices.map(c => plain(c.text || c.html)), answer: q.answer,
  };
}));
const originalIds = new Set(rows.map(row => row.id));
for (const round of midterm.rounds) for (const q of round.questions) {
  const id = `${String(q._originRoundId || '').replace(/^school-energy-/, '')}:${q._originalNumber}`;
  if (originalIds.has(id)) continue;
  originalIds.add(id);
  rows.push({ id, year: Number(String(q.sourceQualification || '').match(/20\d{2}/)?.[0] || round.year), session: q.sourceQualification || 'PDF 추가자료', number: q._originalNumber,
    stem: plain(q.text || q.html || q.ocrText), state: '기존 중간고사', topic: round.title,
    evidence: '기존 중간고사 PDF 추가자료 · ' + plain(q.sourcePage),
    images: [q.sourceImage, ...(q.images || [])].filter(Boolean), choices: q.choices.map(c => plain(c.text || c.html)), answer: q.answer });
}
const energyReport = { date: '2026-10-08', mode: 'review-only', total: rows.length, currentMidterm: 179,
  originalEnergyQuestions: 2640,
  limits: '본문의20주제 단서 후보. 실제 교재 수록·출제확률·정답 검증이 아님. 문제은행·출제·기록을 수정하지 않음. 후속 PDF1040개 전체 추가는 미완료.',
  topics: midterm.rounds.map(r => ({ title: r.title, current: r.questions.length, calculation: r.questions.filter(q => q.midtermCalculation).length })),
  states: Object.fromEntries([...new Set(rows.map(row => row.state))].map(state => [state, rows.filter(row => row.state === state).length])), rows,
};
fs.writeFileSync('docs/energy-midterm-classification-review-2026-10-08.json', JSON.stringify(energyReport, null, 2) + '\n');
const cooling = JSON.parse(fs.readFileSync('docs/cooling-midterm-scope-audit-2026-10-08.json', 'utf8'));
function page(title, intro, rows, file, topics = []) {
  const serialized = JSON.stringify({ rows, topics }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title>
<style>:root{color-scheme:light dark;font-family:system-ui,sans-serif}body{margin:0;background:light-dark(#f5f7fa,#0d1723);color:light-dark(#142334,#e7eef9)}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:1.5rem}p{line-height:1.7}nav{display:flex;gap:10px;flex-wrap:wrap;position:sticky;top:0;background:light-dark(#f5f7fa,#0d1723);padding:12px 0}select,input,button{font:inherit;min-height:44px;box-sizing:border-box;border:1px solid #73849b;border-radius:8px;padding:8px;max-width:100%}input{flex:1;min-width:150px}article{border:1px solid #73849b;border-radius:12px;padding:16px;margin:12px 0;background:light-dark(white,#172535)}article h2{font-size:1rem;margin:0 0 8px}small{color:light-dark(#526175,#b0c0d5)}details{margin-top:10px}summary{cursor:pointer;min-height:32px;line-height:32px}img{max-width:100%;height:auto;background:white}footer{display:flex;gap:16px;align-items:center}a{color:light-dark(#165eac,#99c9ff)}@media(max-width:600px){main{padding:14px}nav>*{width:100%}}</style>
<main><h1>${title}</h1><p>${intro}</p><p><a href="../">CBT로 돌아가기</a> · <a href="./${file.replace('.html', '.json')}">분류 대장 JSON</a></p><div id="topics"></div>
<nav><select id="state" aria-label="검토 상태"><option value="">모든 상태</option></select><select id="topic" aria-label="주제"><option value="">모든 주제</option></select><input id="query" type="search" aria-label="문제 검색" placeholder="문제 내용·회차·번호 검색"></nav><p id="count" role="status"></p><div id="list"></div><footer><button id="prev">이전50개</button><span id="position"></span><button id="next">다음50개</button></footer></main>
<script>const data=${serialized};const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let offset=0;const states=[...new Set(data.rows.map(r=>r.state))];const topics=[...new Set(data.rows.map(r=>r.topic).filter(Boolean))];for(const [id,values]of[['state',states],['topic',topics]])for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;$('#'+id).append(option)}if(states.includes('추가 검토 후보'))$('#state').value='추가 검토 후보';if(data.topics.length)$('#topics').innerHTML='<details><summary>현재 중간고사 주제별 수량 확인</summary>'+data.topics.map(t=>'<p>'+esc(t.title)+' · 기존'+t.current+'개 / 계산'+t.calculation+'개</p>').join('')+'</details>';function render(){const state=$('#state').value,topic=$('#topic').value,query=$('#query').value.toLowerCase();const rows=data.rows.filter(r=>(!state||r.state===state)&&(!topic||r.topic===topic)&&(!query||JSON.stringify(r).toLowerCase().includes(query)));offset=Math.min(offset,Math.max(0,Math.floor((rows.length-1)/50)*50));$('#count').textContent=rows.length+'개 · 한 번에50개 표시';$('#list').innerHTML=rows.slice(offset,offset+50).map(r=>'<article><h2>'+esc(r.topic||'분류 보류')+'</h2><small>'+esc(r.id)+' · '+esc(r.state)+'</small><p>'+esc(r.stem)+'</p><small>'+esc(r.evidence)+'</small>'+(r.choices?'<details><summary>기존 보기·정답·그림 확인</summary>'+r.choices.map((c,i)=>'<p>'+(i+1)+'. '+esc(c)+'</p>').join('')+'<p>기존 정답: '+esc(r.answer)+'번</p>'+(r.images||[]).filter(u=>String(u).startsWith('assets/')).map(u=>'<img loading="lazy" src="../'+esc(u)+'" alt="원문 문제 그림">').join('')+'</details>':'')+'</article>').join('');$('#position').textContent=(rows.length?offset+1:0)+'~'+Math.min(offset+50,rows.length);$('#prev').disabled=offset===0;$('#next').disabled=offset+50>=rows.length}for(const id of['state','topic','query'])$('#'+id).addEventListener('input',()=>{offset=0;render()});$('#prev').onclick=()=>{offset-=50;render()};$('#next').onclick=()=>{offset+=50;render()};render();</script></html>`;
  fs.writeFileSync(`docs/${file}`, html);
}
page('에너지설비 분류 검토 전용', '실제 문제 구성은 바꾸지 않았습니다. 기존 에너지2640문제에서20개 수업 주제에 해당하는 후보를 보여줍니다. 후보는 자동 본문 단서이며 시험 출제 확정이나 교재 동일성 확인이 아닙니다. 기존 중간고사179개(PDF 포함)는 그대로 유지합니다. 경계 확인·단서 없음은 누락뿐 아니라 다른 시험 범위도 포함합니다.', rows, 'energy-midterm-classification-review-2026-10-08.html', energyReport.topics);
const coolingRows = cooling.rows.filter(r => r.state !== 'excluded').map(r => ({ ...r,
  topic: r.state === 'safety-separate' ? '안전관리·법규 별도' : r.assignedChapter + ' → ' + r.assignedSection,
  evidence: r.classificationReason || '본문의 과제 맥락·목차 기준 배치', state: r.state === 'safety-separate' ? '안전 별도' : '일반 목차',
}));
// Separate matching filename for the browser's JSON link; do not duplicate the full source report.
fs.writeFileSync('docs/cooling-midterm-classification-review-2026-10-08.json', JSON.stringify({ date: cooling.date, rows: coolingRows }, null, 2) + '\n');
page('냉동공학 목차 분류 검토', '2006년3회~2016년 기존 공조 + 2017~2023년3회 한솔. 원본 문제는 삭제하지 않고 안전관리를 별도 분리했습니다. 이 검토표는 출처별 원본을 중복 포함하여 보여주며, 실제 풀이는 완전 중복을 제외합니다. 목차 분류와 교재 문제의 페이지별 동일성 확인은 다릅니다. 원본 이미지 전체·정답 사실 검증 완료를 뜻하지 않습니다.', coolingRows, 'cooling-midterm-classification-review-2026-10-08.html');
console.log(JSON.stringify({ energy: energyReport.states, cooling: cooling.groups }, null, 2));
