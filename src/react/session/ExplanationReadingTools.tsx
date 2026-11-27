import {useState} from 'react';

const conversions:Record<string,[string,number]> = {
  W:['kW',.001], kW:['W',1000], MW:['kW',1000],
  Pa:['kPa',.001], kPa:['Pa',1000], MPa:['kPa',1000], J:['kJ',.001], kJ:['J',1000],
};
const numberFormat = new Intl.NumberFormat('ko-KR',{maximumSignificantDigits:15});

export function ExplanationReadingTools({choices,answer,onInteract}:{choices:string[];answer:number;onInteract:()=>void}) {
  const [converted,setConverted]=useState(false);
  const original=choices[answer-1]?.trim() || '';
  // Convert only complete quantities. Compound units and formula fragments require separate rules.
  const quantity=/^([+−-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(MW|kW|W|MPa|kPa|Pa|kJ|J)$/.exec(original);
  const conversion=quantity && conversions[quantity[2]!];
  const value=quantity && Number(quantity[1]!.replace(/,/g,'').replace('−','-'));
  return <>
    {quantity && conversion && value!==null && Number.isFinite(value) && <div className="reading-unit" onClick={onInteract}>
      <span>정답 보기의 단위</span><output aria-live="polite">{converted ? numberFormat.format(value*conversion[1])+' '+conversion[0] : original}</output>
      <button type="button" onClick={()=>setConverted(!converted)}>{converted?quantity[2]:conversion[0]}로 보기</button>
    </div>}
  </>;
}
