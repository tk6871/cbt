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
const report={date:'2026-10-12',scope:'cooling-midterm-only',policy:'Readable exact duplicates plus individually reviewed semantic aliases; latest source; preserve differing numerical conditions, units, targets, answers, uncertain visuals and all historical IDs.',
  limits:'범위 원문1180개(기존 대표1037개)의 목록·질문·등록 정답을 확인하고 모든 대표 쌍을 문자 비교했습니다. 상위712후보와 그림/수식/선도 언급 문항의123원문을 개별 대조하고 승인된178묶음만 추가 통합했습니다. 낮은 유사도 미확정 후보는 보존합니다. 모든 정답 사실·현행 법규·전 이미지의 완전한 시각 검증이나 중복 누락0을 보장하지 않습니다.',
  general:audit(coolingMidtermItems(source)),safety:audit(coolingSafetyItems(source))};
fs.writeFileSync('docs/cooling-midterm-consolidation-2026-10-12.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({general:{...report.general,groups:report.general.groups.length},safety:{...report.safety,groups:report.safety.groups.length}},null,2));
