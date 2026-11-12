import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import katex from 'katex';

const base = 'https://safetygwajang.com/data/';
const key = 'safety-engineer', name = '산업안전기사';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines = value => esc(value).replace(/\n/g, '<br>');
async function get(file) {
  const res = await fetch(base + file, { signal: AbortSignal.timeout(15000) });
  assert(res.ok, `${file}: HTTP ${res.status}`);
  return res.json();
}
function passage(p) {
  switch (p.type) {
    case 'table': return `<table><caption>${esc(p.caption)}</caption><thead><tr>${p.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${p.rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'list': return `<p>${esc(p.title)}</p><ul>${p.items.map(i=>`<li>${lines(i)}</li>`).join('')}</ul>`;
    case 'callout': case 'text': return `<p>${p.title ? `<strong>${esc(p.title)}</strong><br>` : ''}${lines(p.content)}</p>`;
    case 'katex': return katex.renderToString(p.content, { displayMode: !!p.display, trust: false, throwOnError: false, output: 'mathml' });
    // Image context keeps the SVG inert; never insert source SVG markup inline.
    case 'svg':
      assert(/^\s*<svg\b/i.test(p.content));
      return `<figure><img src="data:image/svg+xml;base64,${Buffer.from(p.content).toString('base64')}" alt="${esc(p.alt || p.caption || '문제 도면')}" style="max-width:100%;width:380px"><figcaption>${esc(p.caption)}</figcaption></figure>`;
    default: throw new Error(`Unknown passage type: ${p.type}`);
  }
}
const index = (await get('index.json')).filter(x=>x.title.startsWith('산업안전기사 필기') && /^\d{4}-\d{2}-\d{2}$/.test(x.id));
assert.equal(index.length, 14, 'Unexpected scope change: review new index before importing');
const rounds = [];
for (const entry of index) {
  const data = await get(entry.id + '.json');
  assert.equal(data.questions.length, 120);
  assert.equal(data.subjects.length, 6);
  const date = entry.id.replaceAll('-', '');
  const questions = data.questions.map((q,i)=>{
    assert.equal(q.no, i+1);
    assert(typeof q.question === 'string' && q.question.trim());
    assert(q.choices.length === 4 && q.choices.every(c=>typeof c==='string' && c.trim()));
    assert(Number.isInteger(q.answer) && q.answer>=1 && q.answer<=4);
    const subject = data.subjects.find(s=>q.no>=s.range[0] && q.no<=s.range[1]);
    assert(subject);
    return {number:q.no, text:q.question, html:lines(q.question)+(q.passage||[]).map(passage).join(''), choices:q.choices.map(text=>({text,html:lines(text)})), answer:q.answer, _subject:subject.name, source:'안전과장 공개 회차', problemUrl:`https://safetygwajang.com/exam?exam=${entry.id}`};
  });
  rounds.push({id:key+'-'+date, qualificationKey:key, qualification:name, shortQualification:name, kind:key, date, sortKey:date, year:Number(date.slice(0,4)), title:`${name} · ${entry.date} 기출문제`, subjects:data.subjects.map(s=>s.name), questions});
}
assert.equal(new Set(rounds.map(r=>r.id)).size, rounds.length);
writeFileSync('data/safety-engineer.js', 'window.CBT_DATA_SAFETY_ENGINEER='+JSON.stringify({key,name,shortName:name,rounds})+';\n');
console.log(`${rounds.length} rounds, ${rounds.reduce((a,r)=>a+r.questions.length,0)} questions`);
