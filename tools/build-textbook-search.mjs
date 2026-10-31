// OCR is a search aid only. No OCR text replaces the original question image.
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
for(const file of ['energy-textbook','energy-restored','energy-book-earlier'])vm.runInNewContext(fs.readFileSync(`data/${file}.js`,'utf8'),context);
const questions=new Map(Object.values(context.window).flatMap(b=>b.rounds.flatMap(r=>r.questions.map(q=>[`${q._originRoundId||r.id}:${q._originalNumber||q.number}`,q]))));
const entries=JSON.parse(fs.readFileSync('data/textbook-pages.json')).entries;
const texts={};const missing=[];
for(const id of new Set(entries.filter(e=>e.book==='energy'&&e.sourceId).map(e=>e.sourceId))){
 const q=questions.get(id);if(!q?.sourceImage)continue;
 const key=q.sourceImage.split('/').at(-1).replace(/\.(webp|png)$/,'');
 // The 191-question bank has its own reviewed crops; use their matching OCR.
 const work=id.startsWith('school-energy-textbook')?'work/energy-textbook':id.startsWith('energy-book-earlier-')?'work/energy-earlier-full':'work/energy-restored-full';
 const path=`${work}/answer-geometry/ocr/${key}-question.json`;
 const fallback=`work/energy-earlier-full/answer-geometry/ocr/${key}-question.json`;
 const corrected=`${work}/answer-geometry/ocr-corrected/${key}-question.json`;
 const actual=fs.existsSync(corrected)?corrected:fs.existsSync(path)?path:fs.existsSync(fallback)?fallback:null;
 if(!actual){missing.push(id);continue;}
 const rows=JSON.parse(fs.readFileSync(actual)).rows;
 texts[id]=rows.sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]).map(r=>r.text).join(' ').slice(0,2500);
}
fs.writeFileSync('data/energy-textbook-search.json',JSON.stringify({version:1,note:'검색 보조용 OCR. 원문 이미지·보기·정답을 대체하지 않습니다.',texts})+'\n');
console.log({searchQuestions:Object.keys(texts).length,missing});
