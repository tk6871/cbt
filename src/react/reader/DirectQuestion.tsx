import {SourceImageStage} from './SourceImageStage';
import continuations from '../../../data/textbook-continuation-images.json';
import {useState,type ReactNode} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import hitboxes from '../../../data/textbook-direct-hitboxes.json';
import {textbookDirectAnswer} from '../../cbt/textbookDirectAnswer';
import {textbookExplanationText} from '../../cbt/textbookExplanationText';
import {textbookAssetUrl,textbookDirectImage,textbookDirectPageMap,type TextbookDirectSource,type TextbookDirectPage,type TextbookDirectPart} from '../../cbt/textbookPages';
import {problemImage} from '../../cbt/problemImages';
import {legacyDirectPrefix} from '../../cbt/textbookAnswerProgress';
import {PrintedChoices} from './PrintedChoices';
import './direct-question.css';

const indexedBoxes: Record<string,number[][]> = hitboxes;
const choiceLabels = ['①','②','③','④'];
function crop(rect:number[],size:number[]){
  const [x,y,w,h]=rect as [number,number,number,number];
  return {width:`${size[0]! / w *100}%`,left:`${-x / w *100}%`,top:`${-y / h *100}%`};
}
type ScanProps = {original:boolean; onFallback:(page:string)=>void};
function Region({part,alt,original,onFallback,children,onChoose}:ScanProps & {part:TextbookDirectPart;alt:string;children?:ReactNode;onChoose?:(n:number)=>void}) {
  const [failed,setFailed]=useState(false);
  const page=textbookDirectPageMap.get(part.page);
  const size=part.size ?? page?.size ?? [1,1];
  const upgraded=part.asset && (continuations as Record<string,string>)[part.asset];
  const image=part.asset ? {asset:upgraded || part.asset,fallbackAsset:part.asset,improved:!!upgraded} : page && textbookDirectImage(page);
  const frame={className:"direct-viewport textbook-explanation-image",style:{aspectRatio:part.rect.slice(2).join('/')}};
  const content=<>
      {image&&<img src={problemImage(textbookAssetUrl(failed?image.fallbackAsset:image.asset))}
        style={crop(part.rect,size)} className={original?'restored-image-original':undefined}
        width={size[0]} height={size[1]} alt={alt} loading="lazy" decoding="async"
        onError={()=>{if(image.improved&&!failed){setFailed(true);onFallback(part.page)}}}/>}
      {children}
    </>;
  return <div className="direct-region" data-page={part.page} data-rect={part.rect.join(',')}>
    {part.label&&<small className="direct-part-label">{part.label} · {part.page}쪽</small>}
    {onChoose ? <SourceImageStage as="figure" {...frame} onChoose={onChoose}>{content}</SourceImageStage> : <figure {...frame}>{content}</figure>}
  </div>;
}

type DirectProps = {source:TextbookDirectSource;page:TextbookDirectPage;original:boolean;showText:boolean};
function SolutionImages({source,page,asset,original,onFallback}:ScanProps & Pick<DirectProps,'source'|'page'> & {asset:string}) {
  const r=page.answerKeyRect;
  return <><div className="direct-solution-parts">{source.solutionParts.map((part,i)=>
    <Region key={i} part={part} original={original} onFallback={onFallback}
      alt={`교재 ${part.page}쪽 ${source.number}번 원문 풀이${i?' 이어짐':''}`}/>)}</div>
    {r&&<><small>인쇄 정답표 · 작게 줄이지 않습니다. 옆으로 밀어 확인하세요.</small>
    <div className="direct-key-scroll" tabIndex={0} aria-label={source.page+'쪽 정답표 가로 스크롤'}>
      <figure className="direct-viewport textbook-explanation-image" style={{aspectRatio:r.slice(2).join('/'),width:r[2]}}>
        <img src={asset} style={crop(r,page.size)} className={original?'restored-image-original':undefined}
          alt={`교재 ${source.page}쪽 인쇄 정답표`} loading="lazy" decoding="async" onError={()=>onFallback(source.page)}/>
      </figure></div></>}
  </>;
}

export function DirectQuestion({source,page,original,showText,chosen,saveChoice}:DirectProps & {
  chosen:number; saveChoice:(id:string,choice:number)=>void;
}) {
  const key=legacyDirectPrefix+source.id;
  const [storageFailed,setStorageFailed]=useState(false);
  const [solutionOpen,setSolutionOpen]=useState(false),[originalOpen,setOriginalOpen]=useState(false),[fullOpen,setFullOpen]=useState(false);
  const [fallback,setFallback]=useState(false);
  const answer=textbookDirectAnswer(source,page),image=textbookDirectImage(page);
  const asset=problemImage(textbookAssetUrl(fallback?image.fallbackAsset:image.asset))!;
  const text=solutionOpen&&showText?textbookExplanationText(source):undefined;
  function choose(n:number) { setChoice(chosen===n?0:n); }
  function setChoice(next:number) {
    setSolutionOpen(Boolean(next));
    try{saveChoice(source.id,next);if(next)localStorage.setItem(key,String(next));else localStorage.removeItem(key);setStorageFailed(false)}
    catch{setStorageFailed(true)}
  }
  function onFallback(partPage:string){if(partPage===page.page&&image.improved)setFallback(true)}
  const scans={source,page,asset,original,onFallback};
  return <article className="book-direct-question" data-source-id={source.id} data-react-view="direct-question">
    <small className="direct-status">교재 원문 · {answer?'정답표 대조 완료':'자가확인'}{image.improved&&!fallback?' · 2배 화질 개선':''}{fallback?' · 원해상도 대체 표시':''}</small>
    {!source.split&&<p className="direct-caution">풀이가 함께 포함될 수 있는 원문입니다. 아래 ‘원문 쪽 전체 보기’에서 이어지는 그림·풀이도 확인하세요.</p>}
    <div className="direct-question-parts">{source.questionParts.map((part,i)=>{
      const [left,top,w,h]=part.rect as [number,number,number,number];
      const choices=(indexedBoxes[source.id]??[]).flatMap((box,index)=>box[0]===i?[{
        number:index+1,style:{left:(box[1]!-left)/w*100+'%',top:(box[2]!-top)/h*100+'%',width:box[3]!/w*100+'%',height:box[4]!/h*100+'%'},
      }]:[]);
      return <Region key={i} part={part} original={original} onFallback={onFallback} onChoose={choices.length?choose:undefined} alt={`한솔 교재 ${part.page}쪽 ${source.number}번 원문 문제${i?' 이어짐':''}`}>
        <PrintedChoices choices={choices} selected={chosen} buttonClass="printed-choice" onChoose={choose}/>
      </Region>;
    })}</div>
    <div className="direct-choices" role="group" aria-label={`${source.page}쪽 ${source.number}번 내 답안 기록`}>
      {choiceLabels.map((label,i)=><button type="button" key={label} aria-pressed={chosen===i+1} onClick={()=>choose(i+1)}>{label}</button>)}
      <small>{chosen?chosen+'번 선택 · 다시 누르면 취소':'내 답안 선택'}</small>
    </div>
    {!!(answer&&chosen)&&<p className="direct-grade" data-result={chosen===answer?'correct':'wrong'} role="status">{chosen===answer?'맞았어요':'틀렸어요'} · 교재 정답 {answer}번</p>}
    {storageFailed&&<p role="status">현재 기기에 선택을 저장하지 못했습니다.</p>}
    <details open={solutionOpen} className="direct-solution" onToggle={e=>setSolutionOpen(e.currentTarget.open)}>
      <summary>{source.split?'교재 풀이·정답표 확인':'교재 정답표 확인'}</summary>
      {solutionOpen&&<>{!!answer&&<p className="direct-answer-label">정답 {['①','②','③','④'][answer-1]} · {answer}번</p>}{text?<><div className="direct-explanation-text"><small>원문 대조 텍스트</small>
        {text.blocks.map((block,i)=>block.text?<p key={i}>{block.text}</p>:block.tex?<div key={i} className="math-formula" aria-label={block.label||'교재 수식'} dangerouslySetInnerHTML={{__html:katex.renderToString(block.tex,{displayMode:true,throwOnError:false,strict:'ignore'})}}/>:null)}
      </div><details className="direct-solution-original" onToggle={e=>setOriginalOpen(e.currentTarget.open)}>
        <summary>원문 풀이·정답표 이미지 보기</summary>{originalOpen&&<SolutionImages {...scans}/>}
      </details></>:<SolutionImages {...scans}/>}
      <small>{answer?'인쇄 정답표를 대조했습니다. 여기서 채점하며 일반 학습·CBT 점수에는 합산하지 않습니다.':'책에 인쇄된 문제 번호로 확인하세요. 이 원문은 자동채점·점수에 포함하지 않습니다.'}</small></>}
    </details>
    <details className="direct-full-page" onToggle={e=>setFullOpen(e.currentTarget.open)}>
      <summary>원문 쪽 전체 보기 · {source.page}쪽</summary><p>잘린 듯 보이거나 다음 열로 이어지는 문제·풀이를 책 한 쪽 전체에서 확인합니다. 정답표도 포함됩니다. <a href={asset} target="_blank" rel="noopener">원문 이미지 크게 열기 ↗</a></p>
      {fullOpen&&<figure className="textbook-explanation-image"><img src={asset} className={original?'restored-image-original':undefined} width={page.size[0]} height={page.size[1]} alt={`교재 ${source.page}쪽 전체 원문`} onError={()=>onFallback(source.page)}/></figure>}
    </details>
  </article>;
}
