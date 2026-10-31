// Public existing question banks -> private comparison index. No ebook files.
import fs from 'node:fs';import vm from 'node:vm';
const c={window:{}};for(const name of ['hvac','hvac-hansol'])vm.runInNewContext(fs.readFileSync(`data/${name}.js`,'utf8'),c);
const rows=Object.values(c.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>({id:`${r.id}:${q.number}`,text:q.text||q.html||'',choices:q.choices.map(c=>c.text||c.html||''),answer:q.answer,sourceImage:q.sourceImage||null,images:q.images||[],choiceImages:q.choices.map(c=>c.images||[]),html:q.html||'',choiceHtml:q.choices.map(c=>c.html||'')}))));
fs.mkdirSync('work/hansol-whole-book',{recursive:true});fs.writeFileSync('work/hansol-whole-book/source-index.json',JSON.stringify(rows)+'\n');console.log({existingQuestions:rows.length});
