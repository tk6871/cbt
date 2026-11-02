import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,valuesIn,differenceMarkup,digest,validateDecision} from './hansol-batch-review-lib.mjs';
import {pageHtml} from './hansol-batch-review-page.mjs';
const source={id:'test:1',text:'옳은 것은?',choices:['1','2','3','4'],answer:2};
const base={page:'2-32',number:1,stem:'옳은 것은?',choices:['1','2','3','4'],printedAnswer:2,candidates:[{stemScore:1,choiceScore:1}],source};
test('정답·부정 지문과 값 차이를 우선하며 그림은 별도 표기',()=>{
 assert.equal(classify({...base,printedAnswer:3}).risk,'answer');
 assert.equal(classify({...base,stem:'옳지 않은 것은?'}).risk,'answer');
 assert.equal(classify({...base,choices:['10 kPa','2','3','4']}).risk,'values');
 assert.equal(classify({...base,requiresImageComparison:true}).risk,'figure');
 assert.equal(classify({...base,source:{...source,choiceImages:[['figure.png']]}}).risk,'figure');
 assert.equal(classify({...base,choices:['dQ=0','2','3','4'],source:{...source,choices:['dQ=0','2','3','4']}}).risk,'figure');
 assert.equal(classify(base).risk,'wording');
 assert.equal(classify({...base,stem:'옳은 것은 ?'}).fields[0].same,true);
 assert.equal(classify({...base,choices:['1.2','2','3','4'],source:{...source,choices:['12','2','3','4']}}).fields[1].same,false);
 assert.equal(classify({...base,kind:'reviewed-unresolved'}).risk,'hold');
 assert.equal(classify({...base,candidates:[{stemScore:.4}]}).risk,'search');
 assert.equal(classify({...base,changedConfirmed:true}).risk,'changed');
});
test('숫자·단위는 경고 신호이며 문자열 정규화로 정답을 확정하지 않음',()=>{
 assert.deepEqual(valuesIn('① 10 kPa, 273.15 K'),['10kPa','273.15K']);
 assert.deepEqual(valuesIn('−5 ℃'),['-5°C']);
 assert.notDeepEqual(valuesIn('1 kcal'),valuesIn('4.186 kJ'));
 assert.ok(!('confirmed' in classify(base)));
});
test('차이 표시가 숫자·순서 변경을 드러내고 HTML을 실행하지 않음',()=>{
 const diff=differenceMarkup('온도 273 K <script>x</script>','온도 300 K');
 assert.match(diff.book,/<mark>273<\/mark>/);assert.match(diff.source,/<mark>300<\/mark>/);
 assert.ok(!diff.book.includes('<script>'));assert.ok(diff.book.includes('&lt;'));
 assert.equal(differenceMarkup('같은 문장','같은 문장').book,'같은 문장');
 assert.match(differenceMarkup('A B','B A').book,/<mark>/);
});
test('기록은 원본 해시·책 번호·정답·직접 확인을 모두 검사',()=>{
 const row={...base,key:'2-32:1',fingerprint:digest(base),risk:'wording'};
 const d={key:row.key,fingerprint:row.fingerprint,sourceId:source.id,result:'same',checked:true,actualNumber:1,bookAnswer:2,note:''};
 assert.equal(validateDecision(row,d),'');
 for(const change of [{fingerprint:'old'},{sourceId:'other:2'},{checked:false},{actualNumber:2},{bookAnswer:3}])assert.notEqual(validateDecision(row,{...d,...change}),'');
 assert.notEqual(validateDecision({...row,risk:'search'},d),'');
 assert.notEqual(validateDecision(row,{...d,result:'different'}),'');
 assert.equal(validateDecision(row,{...d,result:'different',note:'단위 변경'}),'');
 assert.equal(validateDecision(row,{...d,result:'hold',checked:false,bookAnswer:null}),'');
});
test('비공개 비교판에 원본·보기 그림·보류·재개/내보내기 동선 유지',()=>{
 for(const token of ['book-crop','choice-figure','source-figures','확인 후 선택','원문 동일','계속 보류','fingerprint','localStorage.setItem','URL.createObjectURL','kind:'])assert.ok(pageHtml.includes(token),token);
 assert.ok(!pageHtml.includes('fetch(\'https://'));assert.ok(!pageHtml.includes('localStorage.clear'));
});
