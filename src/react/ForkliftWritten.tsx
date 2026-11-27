import {useEffect,useState} from 'react';
import {WrittenFinalSession} from './WrittenFinalSession';

const tasks=[
 ['엔진 윤활유의 역할을 세 가지 쓰시오.','① 금속 사이에 유막을 만들어 마찰과 마모를 줄인다. ② 마찰부의 열을 운반해 식힌다. ③ 오염물을 씻어 필터로 운반한다.','윤활·냉각·세정. 피스톤 링 주변의 밀봉이나 금속의 방청도 윤활유의 역할이다.'],
 ['전조등·후미등·제동등의 역할을 각각 쓰시오.','전조등은 앞쪽 작업 공간을 비춘다. 후미등은 뒤쪽에 차량의 존재를 알린다. 제동등은 브레이크를 밟았음을 뒤쪽에 알린다.','후미등은 ‘차가 있다’, 제동등은 ‘차가 감속한다’는 신호다.'],
] as const;
const questions=tasks.map(([prompt,answer,explanation])=>({prompt,answer,explanation}));
export function ForkliftWritten({back}:{back:()=>void}){
 const key='school-final-forklift-written-v1';
 const [answers,set]=useState<string[]>(()=>{try{const a:unknown=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(a)&&a.length===2&&a.every(s=>typeof s==='string'))return a;}catch{}return ['',''];});
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(answers));}catch{}},[answers]);
 return <WrittenFinalSession title="지게차 주관식" backLabel="지게차 기말" questions={questions} answers={answers} onBack={back}
   onAnswer={(index,value)=>set(previous=>previous.map((answer,i)=>i===index?value:answer))}/>;
}
