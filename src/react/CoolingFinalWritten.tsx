import {useEffect,useState} from 'react';
import {shuffle} from '../cbt/finalSelection';

// The anchors identify related printed questions, not verbatim written exam questions.
const bank=[
 ['4-10쪽 21번','물-브로마이드리튬 흡수식 냉동기에서 냉매와 흡수제를 각각 쓰시오.','냉매는 물, 흡수제는 브로마이드리튬 수용액이다.','냉매: 물 2점 / 흡수제: 브로마이드리튬 3점'],
 ['4-65쪽 40번','모세관이 냉매를 감압하는 원리와 부하 변화에 대한 한계를 쓰시오.','가늘고 긴 관의 유동 저항으로 압력이 내려간다. 통로가 고정되어 부하에 맞춰 개도를 조절하지 못한다.','유동 저항·압력 강하 3점 / 자동 개도 조절 불가 2점'],
 ['4-76쪽 29번','빙점 위의 식품을 빙점 아래까지 얼릴 때 제거하는 열을 순서대로 쓰시오.','빙점까지 식히는 현열 → 얼리는 동결잠열 → 언 식품을 더 식히는 현열이다.','첫 현열 1점 / 잠열 2점 / 동결 후 현열 2점'],
 ['4-91쪽 36번','2단 압축에서 중간냉각기가 무엇을 냉각하며 왜 필요한지 쓰시오.','저단 압축기에서 나온 냉매 증기를 고단 압축기에 들어가기 전에 식혀 고단의 압축 일과 토출온도를 낮춘다.','어느 증기를 언제 식히는지 3점 / 효과 2점'],
 ['4-154쪽 35번','왕복 압축기의 간극이 커질 때 체적효율이 낮아지는 과정을 설명하시오.','간극에 남은 고압 가스가 흡입 행정에서 재팽창한다. 새 냉매가 들어올 공간이 줄어 체적효율이 낮아진다.','잔류 가스 재팽창 3점 / 새 흡입량 감소 2점'],
 ['4-177쪽 31번','냉동효과의 뜻과 증발기 입·출구 엔탈피를 이용한 식을 쓰시오.','냉매 1 kg이 증발기에서 흡수하는 열량이다. 냉동효과 = 출구 엔탈피 − 입구 엔탈피 [kJ/kg].','단위 질량당 흡수열 2점 / 차의 방향과 단위 3점'],
 ['4-191쪽 38번','감온식 팽창밸브가 감지하는 상태와 조절하는 양을 쓰시오.','증발기 출구의 과열도를 기준으로 밸브 개도를 조절해 증발기에 공급하는 냉매량을 바꾼다.','출구 과열도 3점 / 냉매 공급량 2점'],
 ['5-46쪽 39번','압축비의 식과 게이지압력을 그대로 쓰면 안 되는 이유를 쓰시오.','압축비 = 토출 절대압력 ÷ 흡입 절대압력. 게이지압은 대기압을 0으로 한 값이므로 절대진공 기준으로 바꿔야 한다.','분자·분모 2점 / 두 압력 모두 절대압력·이유 3점'],
 ['5-79쪽 24번','냉각탑의 쿨링 레인지와 어프로치의 차이를 쓰시오.','레인지는 입구 냉각수 온도 − 출구 냉각수 온도, 어프로치는 출구 냉각수 온도 − 입구 공기 습구온도다.','레인지 2점 / 어프로치와 습구온도 3점'],
 ['4-25쪽 28번','동결 없이 식품을 식힐 때 제거할 열량과 필요한 평균 냉동능력의 차이를 쓰시오.','열량은 질량 × 비열 × (처음 온도 − 나중 온도)이다. 이 열량을 냉각 시간으로 나누면 평균 냉동능력이다.','열량식 3점 / 시간으로 나눔 2점'],
];
const storage='school-finals-written-2026-2';
const all=bank.map((_,i)=>i);
type Written={ids:number[];answers:string[];seen:number[]};
const valid=(ids:unknown):ids is number[]=>Array.isArray(ids)&&ids.length>0&&ids.length<=bank.length&&new Set(ids).size===ids.length&&ids.every(i=>Number.isInteger(i)&&!!bank[i]);
function init():Written{
 try{const a=JSON.parse(localStorage.getItem(storage)||'null');if(valid(a?.ids)&&Array.isArray(a.answers)&&a.answers.length===a.ids.length&&a.answers.every((v:unknown)=>typeof v==='string'))return {...a,seen:valid(a.seen)?a.seen:a.ids};}catch{}
 const ids=shuffle(all).slice(0,2);return {ids,answers:['',''],seen:ids};
}
export function CoolingFinalWritten({back}:{back:()=>void}){
 const [state,set]=useState(init);
 useEffect(()=>{try{localStorage.setItem(storage,JSON.stringify(state));}catch{}},[state]);
 const [count,setCount]=useState(String(state.ids.length)),[exclude,setExclude]=useState(true);
 function save(next:typeof state){set(next);}
 const available=exclude?all.filter(i=>!state.seen.includes(i)):all;
 function draw(reset=false){
   if(state.answers.some(Boolean)&&!window.confirm('작성한 답을 비우고 새 문제를 뽑을까요?'))return;
   const ids=shuffle(reset?all:available).slice(0,Number(count));
   save({ids,answers:ids.map(()=>''),seen:[...new Set([...(reset?[]:state.seen),...ids])]});
 }
 const validCount=Number.isInteger(+count)&&+count>=1&&+count<=bank.length;
 return <section className="final-written" aria-label="냉동공학 주관식"><button onClick={back}>← 냉동공학 회차 목록</button>
 <h1>냉동공학 주관식</h1><p>실전 기준은 5점 × 2문제입니다. 교재와 연결한 연습 후보 {bank.length}문제 중 원하는 만큼 뽑아 보세요.</p>
 <div className="written-controls"><label>풀 문제 수 <input type="number" min={1} max={bank.length} value={count} onChange={e=>setCount(e.target.value)}/></label>
 <label><input type="checkbox" checked={exclude} onChange={e=>setExclude(e.target.checked)}/> 이전에 뽑은 문제 제외</label>
 <button disabled={!validCount||+count>available.length} onClick={()=>draw()}>새 문제 뽑기</button>
 {exclude&&<small>아직 안 뽑은 문제 {available.length}개</small>}
 {exclude&&validCount&&+count>available.length&&<button onClick={()=>draw(true)}>추첨 기록 초기화 후 {count}문제 뽑기</button>}</div>
 <h2>이번 연습 · {state.ids.length}문제</h2>
 {state.ids.map((id,n)=><article key={id+'-'+n}><small>관련 교재 {bank[id][0]} · 5점</small><h3>{n+1}. {bank[id][1]}</h3><textarea aria-label={`주관식 ${n+1}번 답안`} value={state.answers[n]} onChange={e=>save({...state,answers:state.answers.map((s,j)=>j===n?e.target.value:s)})}/>
 <details><summary>모범답안·채점 기준</summary><p>{bank[id][2]}</p><small>{bank[id][3]}</small></details></article>)}</section>;
}
