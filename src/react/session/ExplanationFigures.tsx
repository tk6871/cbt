import {assetReading} from '../../cbt/printedStudy';
import {useState} from 'react';
import {problemImage} from '../../cbt/problemImages';
import {useExplanationDisplay,useSourceTranscription} from './useSourceTranscription';
import './transcription-figure.css';

export function TranscribedFigure({source,imageClass,onInteract}:{source:string;imageClass?:string;onInteract?:()=>void}) {
  const {entry,pending,mode}=useSourceTranscription(source);
  const [original,setOriginal]=useState(false);
  const text=!original && entry?.kind==='explanation' ? entry : undefined;
  const html = mode !== 'image' ? assetReading(source)?.html : undefined;
  return <figure className="textbook-explanation-image transcription-figure" onClick={onInteract}>
    <figcaption>교재 원문 해설 {(entry || html)&&<button type="button" onClick={()=>setOriginal(!original)}>{(text || (html && !original))?'이미지로 보기':'텍스트로 보기'}</button>}</figcaption>
    {html && !original ? <div className="printed-study" dangerouslySetInnerHTML={{__html:html}} /> : pending?<small role="status">텍스트 확인 중…</small>:text?<><small>{text.status==='reviewed'?'원문 대조 텍스트':'OCR 임시 텍스트 · 글자·수식이 다르면 이미지로 확인'}</small><p className="transcription-text">{text.text}</p></>:
      <img src={problemImage(source)} className={imageClass} alt="교재 원문 해설" loading="lazy" decoding="async"/>}
  </figure>;
}
export default function ExplanationFigures({images,folded,originalOnly,imageClass,onInteract}:{images?:string[];folded?:boolean;originalOnly?:boolean;imageClass?:string;onInteract:()=>void}) {
  const mode=useExplanationDisplay();
  const collapse=folded && mode==='text' && !!images?.length;
  const figures=images?.map((source,index)=>originalOnly
    ? <figure className="textbook-explanation-image" key={source+':'+index}>
        <img src={problemImage(source)} alt="인쇄 해설 원본" className={imageClass} loading="lazy" decoding="async"/>
      </figure>
    : <TranscribedFigure key={source+':'+index} source={source} imageClass={imageClass} onInteract={collapse?undefined:onInteract}/>);
  return collapse?<details className="original-textbook-explanation" onClick={onInteract}><summary>교재 원문 해설 보기</summary>{figures}</details>:<>{figures}</>;
}
