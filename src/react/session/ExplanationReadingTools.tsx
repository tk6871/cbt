import {hotspotStyle} from '../../cbt/answerHotspotGeometry';
import type {AnswerHotspot} from '../../cbt/types';
import {useState} from 'react';

const conversions:Record<string,[string,number]> = {
  W:['kW',.001], kW:['W',1000], MW:['kW',1000],
  Pa:['kPa',.001], kPa:['Pa',1000], MPa:['kPa',1000], J:['kJ',.001], kJ:['J',1000],
};
const numberFormat = new Intl.NumberFormat('ko-KR',{maximumSignificantDigits:15});

function HighlightedChoice({text,other}:{text:string;other:string}) {
  const words=text.split(/(\s+)/), reference=other.split(/(\s+)/);
  let start=0, end=0;
  const limit=Math.min(words.length,reference.length);
  while(start<limit && words[start]===reference[start]) start++;
  while(end<limit-start && words[words.length-1-end]===reference[reference.length-1-end]) end++;
  return <>{words.slice(0,start).join('')}<mark>{words.slice(start,words.length-end).join('')}</mark>{words.slice(words.length-end).join('')}</>;
}

export function ExplanationReadingTools({choices,answer,source,hotspot,onInteract}:{choices:string[];answer:number;source?:string;hotspot?:AnswerHotspot;onInteract:()=>void}) {
  const available=choices.map((text,i)=>({text,i})).filter(({text})=>text && !/^(?:[①②③④]|[1-4]번)$/.test(text));
  const first=available.find(row=>row.i===answer-1)?.i ?? available[0]?.i ?? 0;
  const [pair,setPair]=useState([first,available.find(row=>row.i!==first)?.i ?? 0]);
  const [highlight,setHighlight]=useState(true),[converted,setConverted]=useState(false);
  const original=choices[answer-1]?.trim() || '';
  // Convert only complete quantities. Compound units and formula fragments require separate rules.
  const quantity=/^([+−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(MW|kW|W|MPa|kPa|Pa|kJ|J)$/.exec(original);
  const conversion=quantity && conversions[quantity[2]!];
  const value=quantity && Number(quantity[1]!.replace(/,/g,'').replace('−','-'));
  function choose(side:number,newIndex:number) {
    const next=[...pair];
    if(next[1-side]===newIndex) next[1-side]=pair[side]!;
    next[side]=newIndex;setPair(next);
  }
  const [showSource,setShowSource]=useState(false);
  return <>
    {source && hotspot && <details className="reading-overlay" onClick={onInteract} onToggle={e=>setShowSource(e.currentTarget.open)}>
      <summary>원문에서 정답 위치 보기</summary>
      {showSource && <figure><img src={source} alt={'원문 이미지 · 정답 '+answer+'번'}/>
        {(hotspot.segments?.length ? hotspot.segments : [hotspot]).map((area,i)=><i key={i} style={hotspotStyle(area)} aria-hidden="true"/>)}
      </figure>}
    </details>}
    {quantity && conversion && value!==null && Number.isFinite(value) && <div className="reading-unit" onClick={onInteract}>
      <span>정답 보기의 단위</span><output aria-live="polite">{converted ? numberFormat.format(value*conversion[1])+' '+conversion[0] : original}</output>
      <button type="button" onClick={()=>setConverted(!converted)}>{converted?quantity[2]:conversion[0]}로 보기</button>
    </div>}
    {available.length>=2 && <details className="reading-comparison" onClick={onInteract}>
      <summary>두 보기 대조</summary>
      {pair.map((index,side)=><div key={side}><select value={index} aria-label={side?'두 번째 보기':'첫 번째 보기'} onChange={e=>choose(side,Number(e.currentTarget.value))}>
        {available.map(row=><option key={row.i} value={row.i}>{row.i+1}번 보기</option>)}
      </select><p>{highlight ? <HighlightedChoice text={choices[index]||''} other={choices[pair[1-side]!]||''}/> : choices[index]}</p></div>)}
      <button type="button" aria-pressed={highlight} onClick={()=>setHighlight(!highlight)}>달라진 표현 표시</button>
    </details>}
  </>;
}
