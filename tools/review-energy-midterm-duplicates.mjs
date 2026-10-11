import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('data/energy-midterm.js','utf8'),context);
const qs=context.window.CBT_DATA_ENERGY_MIDTERM.rounds.flatMap(r=>r.questions);
const hotspots=JSON.parse(fs.readFileSync('data/energy-midterm-hotspots.json','utf8'));
// OCR is a review aid only. It never rewrites the displayed source image.
for(const q of qs){
 if(!q.sourceImage||q.choices.every(c=>c.text.trim()))continue;
 const stem=q.sourceImage.split('/').pop().replace(/\.webp$/,'');
 const ocr=JSON.parse(fs.readFileSync(`work/energy-answer-geometry/ocr/${stem}.json`,'utf8'));
 const boxes=hotspots[q.sourceImage];
 const answerTop=Math.min(...boxes.map(b=>b.y))/100;
 q.text=ocr.rows.filter(r=>r.box[3]<answerTop+.02).map(r=>r.text).join(' ').replace(/^\d+\s*/, '');
 q.choices=boxes.map(b=>({text:ocr.rows.filter(r=>{const x=(r.box[0]+r.box[2])/2*100,y=(r.box[1]+r.box[3])/2*100;return x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height;}).map(r=>r.text).join(' ').replace(/^[①②③④1-4l!@?)]\s*/, '')}));
}
const norm=s=>s.normalize('NFKC').replace(/<[^>]+>/g,'').replace(/벤튜리|벤츄리/g,'벤투리').replace(/스크레버|스크러버/g,'스크러버').replace(/[^가-힣a-zA-Z0-9]/g,'').replace(/식$/,'');
const grams=s=>new Set([...s].slice(0,-1).map((_,i)=>s.slice(i,i+2)));
const similarity=(a,b)=>{const x=grams(a),y=grams(b);return 2*[...x].filter(v=>y.has(v)).length/Math.max(1,x.size+y.size);};
const describe=q=>({id:`${q._originRoundId}:${q._originalNumber}`,source:q.sourcePage||q.sourceQualification,text:q.text,choices:q.choices.map(c=>c.text),answer:q.answer,image:q.sourceImage||null});
const pairs=[];
for(let i=0;i<qs.length;i++)for(let j=i+1;j<qs.length;j++){
 const a=qs[i],b=qs[j],stem=similarity(norm(a.text),norm(b.text));
 const ac=a.choices.map(c=>norm(c.text)),bc=b.choices.map(c=>norm(c.text));
 const choiceScore=ac.reduce((s,c)=>s+Math.max(...bc.map(d=>similarity(c,d))),0)/4;
 const sameOptions=ac.every(Boolean)&&bc.every(Boolean)&&[...ac].sort().join('|')===[...bc].sort().join('|');
 if(!(stem>=.75&&choiceScore>=.45||stem>=.48&&choiceScore>=.75||sameOptions&&stem>=.35))continue;
 pairs.push({a:describe(a),b:describe(b),stemScore:+stem.toFixed(3),choiceScore:+choiceScore.toFixed(3),sameOptions,sameCorrectContent:norm(a.choices[a.answer-1].text)===norm(b.choices[b.answer-1].text)});
}
fs.mkdirSync('work/energy-answer-geometry',{recursive:true});
fs.writeFileSync('work/energy-answer-geometry/duplicate-candidates.json',JSON.stringify(pairs,null,2)+'\n');
console.log(JSON.stringify(pairs.map((p,i)=>({i,a:p.a.image||p.a.source,b:p.b.image||p.b.source,text:p.a.text,other:p.b.text,choicesA:p.a.choices,choicesB:p.b.choices,answers:[p.a.answer,p.b.answer],stem:p.stemScore,options:p.choiceScore})),null,2));
