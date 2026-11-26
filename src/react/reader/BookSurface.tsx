import {usePrintedStudy} from '../session/usePrintedStudy';
import {lazy, Suspense, useCallback, useState, type ReactNode} from 'react';
import {assetReading} from '../../cbt/printedStudy';
import {useExplanationDisplay} from '../session/useSourceTranscription';
import {TranscribedFigure} from '../session/ExplanationFigures';
import {isImagePrimary} from '../../cbt/catalog';
import {problemImage} from '../../cbt/problemImages';
import type {QuestionItem,StudyMode} from '../../cbt/types';
import {textbookAssetUrl,textbookDirectPageMap,textbookNames,textbookWorkedExamples,type TextbookEntry,type TextbookDirectSource,type TextbookKey} from '../../cbt/textbookPages';
import {BookNavigator,type NavigatorProps} from './BookNavigator';
import {DirectQuestion} from './DirectQuestion';
import {bookSubject,subjectLabel} from '../../cbt/printedSubject';
import {macStudyInput} from '../../cbt/studyGestures';

const MathFormula = lazy(()=>import('../practical/MathFormula'));

export interface PageRow {entry:TextbookEntry;item?:QuestionItem;direct?:TextbookDirectSource}
type RegisterTarget=(id:string,element:HTMLDivElement|null)=>void;
export interface BookSurfaceProps {
  chapterIndex:ReactNode;
  fullRound?:{title:string;open:()=>void};
  answers:Record<string,number>; saveDirect:(id:string,choice:number)=>void;
  navigator:NavigatorProps; book:TextbookKey; start:string; end:string; title:string; loading:boolean; error:string;
  invalid:boolean; matched:number; excluded?:number; directCount:number; pending:number; hasLocations:boolean;
  reference?:string; examples:typeof textbookWorkedExamples; columns:PageRow[][];
  original:boolean; showText:boolean; previous:boolean; next:boolean; register?:RegisterTarget;renderLinked?:(item:QuestionItem,number:number)=>ReactNode;
  navigationRef:(node:HTMLButtonElement|null)=>void;
  openNavigator:(tab:'contents'|'pages')=>void; close:()=>void; calculator:()=>void; settings:()=>void;
  retry:()=>void; play:(mode:StudyMode)=>void; go:(delta:number)=>void;
}
function LinkedQuestionTarget({id,register}:{id:string;register:RegisterTarget}) {
  const attach=useCallback((node:HTMLDivElement|null)=>register(id,node),[id,register]);
  return <div ref={attach} className="book-linked-question"/>;
}
function Example({example,original}:{example:(typeof textbookWorkedExamples)[number];original:boolean}) {
  usePrintedStudy();
  const cls=original?'restored-image-original':undefined;
  const [opened,setOpened] = useState(false);
  const mode=useExplanationDisplay(), [originalQuestion,setOriginalQuestion]=useState(false);
  const html=mode==='image' ? undefined : assetReading(example.question)?.html;
  return <article className="book-worked-example">
    <h2>교재 원문 · {example.title}</h2><p>{example.note}</p>
    <figure className="textbook-explanation-image"><figcaption>교재 {example.pages[0]}쪽 · 문제 {html && <button type="button" onClick={()=>setOriginalQuestion(!originalQuestion)}>{originalQuestion?'텍스트로 보기':'이미지로 보기'}</button>}</figcaption>
      {html && !originalQuestion ? <div className="printed-study" dangerouslySetInnerHTML={{__html:html}} /> :
      <img className={cls} src={problemImage(textbookAssetUrl(example.question))} width={example.questionSize[0]} height={example.questionSize[1]} alt={example.title+' 원문 문제'} loading="lazy"/>}</figure>
    <details onToggle={event=>{if(event.currentTarget.open)setOpened(true)}}><summary>풀이와 답 보기 · 교재 {example.pages.at(-1)}쪽</summary><p><strong>답 {example.answer}</strong></p><p>{example.explanation}</p>
      {opened && example.explanationFormula && <Suspense fallback={null}><MathFormula {...example.explanationFormula}/></Suspense>}
      {(example.explanationTranscribed || assetReading(example.solution)?.html) ? opened && <TranscribedFigure key={example.solution} source={textbookAssetUrl(example.solution)} imageClass={cls}/> :
        <figure className="textbook-explanation-image"><figcaption>교재 원문 풀이·정답</figcaption>
          <img className={cls} src={problemImage(textbookAssetUrl(example.solution))} width={example.solutionSize[0]} height={example.solutionSize[1]} alt={example.title+' 원문 풀이·정답'} loading="lazy"/>
        </figure>}
    </details>
  </article>;
}

export function BookSurface(p:BookSurfaceProps) {
  const pageButtonLabel=p.start+'쪽 · 쪽번호 선택';
  const starts=new Set<number>();let previous='';
  for(const {entry,item} of p.columns.flat()){
    const label=subjectLabel(bookSubject(p.book,entry.page,entry.number,item));
    if(label!==previous)starts.add(entry.number);previous=label;
  }
  return <><header className="reader-toolbar">
    <button type="button" className="reader-back" aria-label="교재 목록으로 돌아가기" onClick={p.close}>← <span>목록</span></button>
    <div className="reader-title"><h1>{textbookNames[p.book]}</h1></div>
    <button ref={p.navigationRef} type="button" className="reader-navigator-trigger" onClick={()=>p.openNavigator('contents')}>☷ 목차·쪽 선택 <b>{p.start}쪽</b></button>
    <button type="button" aria-label="공학용 계산기 열기" onClick={p.calculator}>▦</button>
    <button type="button" aria-label="교재 풀이 설정" onClick={p.settings}>⚙ <span>설정</span></button>
  </header>
  <main className="reader-main" data-mac-swipe={macStudyInput()?'true':undefined}>
    {p.chapterIndex}
    {p.invalid&&<p role="alert">끝 쪽은 시작 쪽보다 뒤여야 합니다. 한 페이지는 시작 쪽만 입력하세요.</p>}
    {p.loading?<p role="status">교재에 연결된 원문을 불러오는 중…</p>:p.error?<p role="alert">{p.error} <button onClick={p.retry}>다시 불러오기</button></p>:<>
      <div className="book-page-result" aria-live="polite"><div><h2>{p.title||p.start+'쪽'+(p.end?' ~ '+p.end+'쪽':'')}</h2>
        <p><strong>{p.matched}문제</strong>{p.excluded?' · 제외 '+p.excluded+'문제':''}{p.directCount?' · 교재 원문 '+p.directCount+'개':''}{p.end?` · 범위 ${p.start}~${p.end}쪽 · 아래는 ${p.start}쪽`:''}</p></div>
        <div className="book-play">{p.fullRound && <button onClick={p.fullRound.open}>{p.fullRound.title} 한솔 기출 60문제 전체 풀기</button>}<button disabled={!p.matched||p.invalid} onClick={()=>p.play('learn')}>범위를 모아 일반 학습</button><button disabled={!p.matched||p.invalid} onClick={()=>p.play('exam')}>범위를 모아 CBT 시험</button></div></div>
      {p.directCount>0&&<p className="reader-page-note direct-reading-notice">교재 원문은 ①~④로 답을 고를 수 있습니다. ‘정답표 대조 완료’ 문항은 바로 채점되고, ‘자가확인’은 풀이·인쇄 정답표에서 확인하세요. 선택은 이 기기에 저장되고 일반 학습·CBT 점수에는 합산하지 않습니다.</p>}
      {(p.reference||!p.hasLocations||p.examples.length>0)&&<div className="reader-page-note">
        {p.reference?<p>{p.reference}</p>:!p.hasLocations&&!p.examples.length&&<p>이 쪽에는 현재 풀 수 있는 문항이 없습니다.</p>}
        {p.examples.length?<p>본문 예제 {p.examples.length}개 · 객관식 시험에는 넣지 않습니다.</p>:null}
      </div>}
      {(p.hasLocations||p.examples.length>0)&&<article className={'book-sheet'+(p.columns.some(c=>!c.length)?' one-print-column':'')} key={p.book+p.start} aria-label="교재 페이지 풀이">
        <header className="printed-page-heading"><div><small>{p.book==='hansol'?'HANSOL · 공조냉동':'ENERGY · 에너지설비'}</small><strong>{p.title.split(' › ').at(-1)||'기출 · 예상문제'}</strong></div>
          <button type="button" className="printed-page-number" aria-label={pageButtonLabel} onClick={()=>p.openNavigator('pages')}>{p.start} <span>쪽 ▾</span></button></header>
        {p.examples.map(ex=><Example key={ex.id} example={ex} original={p.original}/>)}
        {p.hasLocations&&<div className="book-sheet-columns">{p.columns.map((column,i)=><div className="book-sheet-column" key={i}>
          {column.map(({entry,item,direct})=>{
            const page=direct&&textbookDirectPageMap.get(entry.page);
            const embedded=direct||(item&&isImagePrimary(item)&&item.question.bookSourceNumber===entry.number);
            return <section className="book-sheet-question" key={entry.number}>
              {starts.has(entry.number)?<div className="subject-divider"><strong>{subjectLabel(bookSubject(p.book,entry.page,entry.number,item))}</strong></div>:<small className="printed-subject">{subjectLabel(bookSubject(p.book,entry.page,entry.number,item))}</small>}
              <h3 aria-label={'교재 '+entry.number+'번'} className={embedded?'printed-number-embedded':undefined}><span>{String(entry.number).padStart(2,'0')}</span><small>교재 {entry.number}번</small></h3>
              {item?(p.renderLinked?<div className="book-linked-question">{p.renderLinked(item,entry.number)}</div>:<LinkedQuestionTarget id={item.id} register={p.register!}/>):direct&&page?<DirectQuestion chosen={p.answers[direct.id] || 0} saveChoice={p.saveDirect} key={direct.id} source={direct} page={page} original={p.original} showText={p.showText}/>:<p className="book-pending">이 문항은 아직 준비 중입니다.</p>}
            </section>;
          })}
        </div>)}</div>}
        {!p.columns.some(c=>c.length)&&!p.examples.length&&<p className="book-pending">{p.reference||'이 쪽에는 현재 풀 수 있는 문항이 없습니다.'}</p>}
        <footer><button aria-keyshortcuts="ArrowLeft" title="이전 쪽 (←)" disabled={!p.previous} onClick={()=>p.go(-1)}>← 이전 쪽</button><strong><button type="button" aria-label={pageButtonLabel} onClick={()=>p.openNavigator('pages')}>{p.start}</button></strong><button aria-keyshortcuts="ArrowRight" title="다음 쪽 (→)" disabled={!p.next} onClick={()=>p.go(1)}>다음 쪽 →</button></footer>
      </article>}
    </>}
  </main><BookNavigator {...p.navigator}/></>;
}
