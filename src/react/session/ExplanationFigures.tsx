import {useState} from 'react';
import {problemImage} from '../../cbt/problemImages';
import {useExplanationDisplay,useSourceTranscription} from './useSourceTranscription';
import './transcription-figure.css';

export function TranscribedFigure({source,imageClass,onInteract}:{source:string;imageClass?:string;onInteract?:()=>void}) {
  const {entry,pending}=useSourceTranscription(source);
  const [original,setOriginal]=useState(false);
  const text=!original && entry?.kind==='explanation' ? entry : undefined;
  return <figure className="textbook-explanation-image transcription-figure" onClick={onInteract}>
    <figcaption>교재 원문 해설 {entry&&<button type="button" onClick={()=>setOriginal(!original)}>{text?'이미지로 보기':'텍스트로 보기'}</button>}</figcaption>
    {pending?<small role="status">텍스트 확인 중…</small>:text?<><small>{text.status==='reviewed'?'원문 대조 텍스트':'OCR 임시 텍스트 · 글자·수식이 다르면 이미지로 확인'}</small><p className="transcription-text">{text.text}</p></>:
      <img src={problemImage(source)} className={imageClass} alt="교재 원문 해설" loading="lazy" decoding="async"/>}
  </figure>;
}
export default function ExplanationFigures({images,folded,imageClass,onInteract}:{images?:string[];folded?:boolean;imageClass?:string;onInteract:()=>void}) {
  const mode=useExplanationDisplay();
  const collapse=folded && mode==='text' && !!images?.length;
  const figures=images?.map((source,index)=><TranscribedFigure key={source+':'+index} source={source} imageClass={imageClass} onInteract={collapse?undefined:onInteract}/>);
  return collapse?<details className="original-textbook-explanation" onClick={onInteract}><summary>교재 원문 해설 보기</summary>{figures}</details>:<>{figures}</>;
}
