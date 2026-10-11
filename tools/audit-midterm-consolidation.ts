import fs from 'node:fs';
import vm from 'node:vm';
import { coolingMidtermItems, coolingSafetyItems, uniqueSchoolItems, schoolItemKey } from '../src/cbt/schoolQuestionBank';
import { coolingCalculation } from '../src/cbt/coolingPractice';
import { questionId, subjectFor } from '../src/cbt/catalog';
import type { Catalog } from '../src/cbt/types';

const context={window:{} as Record<string,Catalog>};
for(const key of ['hvac','hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const source=Object.values(context.window).flatMap(c=>c.rounds.flatMap(r=>r.questions.map(q=>({
  round:{...r,qualificationKey:c.key},question:q,id:questionId(r,q),subject:subjectFor(r,q),
}))));
const audit=(pool:ReturnType<typeof coolingMidtermItems>)=>{
  const active=uniqueSchoolItems(pool);
  const groups=active.map(representative=>{
    const members=pool.filter(item=>schoolItemKey(item)===schoolItemKey(representative));
    return {representative:representative.id,text:representative.question.text,
      correct:representative.question.choices[representative.question.answer-1]?.text,
      occurrences:representative.question.midtermOccurrences,
      members:members.map(item=>({id:item.id,year:item.round.year,session:item.round.session,date:item.round.date,answer:item.question.answer,text:item.question.text,choices:item.question.choices.map(c=>c.text)}))};
  }).filter(g=>g.members.length>1);
  return {stored:pool.length,active:active.length,excluded:pool.length-active.length,
    calculation:active.filter(coolingCalculation).length,groups};
};
const report={date:'2026-10-12',scope:'cooling-midterm-only',policy:'Exact readable question and correct content; latest source, preserve every numerical condition/unit/sign, uncertain visual questions and historical IDs.',
  limits:'같은 문장의 문자·정답 내용과 기존 완전 일치를 통합합니다. 다른 표현의 전체 의미 중복·그림 의미·정답 사실 전수 검증은 미완료입니다.',
  general:audit(coolingMidtermItems(source)),safety:audit(coolingSafetyItems(source))};
fs.writeFileSync('docs/cooling-midterm-consolidation-2026-10-12.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({general:{...report.general,groups:report.general.groups.length},safety:{...report.safety,groups:report.safety.groups.length}},null,2));
