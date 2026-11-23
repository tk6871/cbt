import {useState} from 'react';

const tasks=[
 ['윤활유','엔진 윤활유의 역할을 세 가지 쓰시오.','① 금속 사이에 유막을 만들어 마찰과 마모를 줄인다. ② 마찰부의 열을 운반해 식힌다. ③ 오염물을 씻어 필터로 운반한다.','윤활·냉각·세정. 피스톤 링 주변의 밀봉이나 금속의 방청도 윤활유의 역할이다.'],
 ['등화장치','전조등·후미등·제동등의 역할을 각각 쓰시오.','전조등은 앞쪽 작업 공간을 비춘다. 후미등은 뒤쪽에 차량의 존재를 알린다. 제동등은 브레이크를 밟았음을 뒤쪽에 알린다.','후미등은 ‘차가 있다’, 제동등은 ‘차가 감속한다’는 신호다.'],
] as const;
export function ForkliftWritten({back}:{back:()=>void}){
 const key='school-final-forklift-written-v1';
 const [answers,set]=useState<string[]>(()=>{try{const a:unknown=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(a)&&a.length===2&&a.every(s=>typeof s==='string'))return a;}catch{}return ['',''];});
 return <section className="final-written"><button onClick={back}>← 지게차 기말</button><h1>지게차 주관식</h1><p>안내받은 두 주제로 만든 예상 질문입니다. 먼저 써 보고 핵심 단어를 비교하세요.</p>
 {tasks.map(([topic,q,a,hint],i)=><article key={topic}><small>{i+1}번 · {topic}</small><h3>{q}</h3><textarea aria-label={topic+' 답안'} value={answers[i]} onChange={e=>{const next=answers.map((a,n)=>n===i?e.target.value:a);set(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}}}/><details><summary>예시답안·핵심 단어</summary><p>{a}</p><small>{hint}</small></details></article>)}</section>;
}
