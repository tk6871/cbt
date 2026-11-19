import {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import type {QuestionItem} from '../../cbt/types';
import type {ContentsRow} from '../../cbt/textbookContents';
import {readBookSelection, type BookSelection} from '../../cbt/textbookReaderState';
import {textbookNames, type TextbookKey} from '../../cbt/textbookRoutes';
import './textbookLibrary.css';

const loadTree = () => import('./ContentsTree');
const ContentsTree = lazy(() => loadTree().then(module => ({default:module.ContentsTree})));
type Pages = typeof import('../../cbt/textbookPages').browserTextbookData;
interface Props {
  book: TextbookKey;
  choosing: boolean;
  loading: boolean;
  error: string;
  items: QuestionItem[];
  pages?: Pages;
  onBook(book:TextbookKey): void;
  onOpen(selection:BookSelection): void;
  onRound(id:string): void;
  onStudy(items:QuestionItem[], label:string): void;
  onRetry(): void;
}

export default function TextbookLibrary({book,choosing,loading,error,items,pages,onBook,onOpen,onRound,onStudy,onRetry}:Props) {
  useEffect(()=>{if(!choosing)void loadTree().catch(()=>{});},[choosing]);
  const [selection,setSelection] = useState(() => readBookSelection(book));
  const [picked,setPicked] = useState<ContentsRow>();
  const [draft,setDraft] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const byId = useMemo(() => new Map(items.map(item => [item.id,item])),[items]);
  const available = useMemo(() => {
    if (!pages) return [];
    const rows = picked?.entries ?? pages.textbookEntries.filter(entry => entry.book===book && entry.page===selection.from);
    return pages.readableBookPages(book,selection.from,selection.to,rows,new Set(byId.keys()));
  },[book,byId,pages,picked,selection]);
  const round = useMemo(() => {
    if (!picked || !pages || !/^(energy-exam|hansol-mock|hansol-latest)-/.test(picked.node.id)) return [];
    const numbered = new Map<number,QuestionItem>();
    for (const entry of picked.entries) {
      const item = byId.get(pages.textbookStudyId(entry));
      if (item && !entry.reviewHold && !numbered.has(entry.number)) numbered.set(entry.number,item);
    }
    const count = book==='energy' ? 80 : 60;
    return Array.from({length:count},(_,i)=>numbered.get(i+1)).filter((item):item is QuestionItem => !!item);
  },[book,byId,pages,picked]);
  const normalized = pages?.normalizeBookPage(draft) ?? '';
  const valid = book==='hansol' ? /^[1-9]\d*-[1-9]\d*$/.test(normalized) : /^[1-9]\d*$/.test(normalized) && Number(normalized)<=645;
  function pick(row:ContentsRow) {
    setPicked(row);
    setSelection({from:row.node.from || row.entries[0]?.page || '',to:row.node.to || '',contentsId:row.node.id,contentsLabel:[...row.path.slice(1),row.node.title].join(' › ')});
  }
  const openPage = (from:string) => onOpen({...selection,from});
  return <section className="textbook-library" aria-label="교재 고르기">
    <header className="library-heading"><div><small>MY TEXTBOOK</small><h1>책을 펼쳐 공부하기</h1><p>{choosing?'공부할 교재를 선택하세요.':'목차에서 단원을 고르거나, 수업 중인 쪽을 바로 여세요.'}</p></div>
      {!choosing && pages && <button ref={trigger} className="library-page-jump" onClick={()=>{setDraft(selection.from);dialog.current?.showModal();}}>쪽번호로 바로 열기 ↗</button>}
    </header>
    <div className="library-books" aria-label="교재 선택">{(Object.keys(textbookNames) as TextbookKey[]).map(key=><button key={key} aria-pressed={!choosing && book===key} onClick={()=>onBook(key)}>
      <span className={'book-spine '+key} aria-hidden="true">{key==='hansol'?'HVAC':'ENERGY'}</span><span><small>{key==='hansol'?'공조냉동기계산업기사':'에너지관리산업기사'}</small><strong>{textbookNames[key]}</strong><em>{key==='hansol'?'과목 · 장 · 핵심예상 · 모의고사':'이론 · 기출 · CBT 복원'}</em></span><b aria-hidden="true">{!choosing && book===key?'✓':'→'}</b>
    </button>)}</div>
    {error && <p role="alert">{error} <button onClick={onRetry}>다시 불러오기</button></p>}
    {!choosing && !pages && loading && <p role="status">교재 목차를 불러오는 중…</p>}
    {!choosing && pages && <div className="library-desk">
      <div className="library-index"><div className="index-caption"><span>CONTENTS</span><strong>목차</strong></div>
        <Suspense fallback={<p role="status">목차를 불러오는 중…</p>}><ContentsTree book={book} items={items} selected={selection.contentsId} onSelect={pick}/></Suspense></div>
      <aside className={'library-selection'+(picked?' has-picked':'')} aria-label="선택한 교재 범위">
        <small>{picked?'선택한 단원':'마지막으로 펼친 쪽'}</small><h2>{picked?.node.title || selection.from+'쪽'}</h2>{picked && <p className="selection-path">{picked.path.join(' / ')}</p>}
        <div className="selection-page-label"><span>PAGE</span><strong>{selection.from}{selection.to && ' — '+selection.to}</strong></div>
        {loading && <p role="status">문제를 불러오는 중…</p>}
        <button className="library-open" disabled={loading} onClick={()=>openPage((picked && available[0]?.page) || selection.from)}>{picked?'이 단원 펼치기':'이어서 펼치기'} →</button>
        {!loading && !!round.length && picked && <button className="library-open" onClick={()=>onStudy(round,picked.node.title)}>교재 회차 {round.length}문제 풀기</button>}
        {!!round.length && picked?.entries.filter(e=>e.reviewHold).map(e=><button key={e.page+'-'+e.number} className="library-page-jump" onClick={()=>onOpen({from:e.page,to:'',contentsId:'',contentsLabel:''})}>채점 보류 {e.number}번 · 교재 조건과 풀이 확인</button>)}
        {picked?.node.roundBankId && <button className="library-open" onClick={()=>onRound(picked.node.roundBankId!)}>한솔 기출 60문제 전체 풀기</button>}
        {!!available.length && <div className="library-page-list"><h3>풀이할 수 있는 쪽</h3><div>{available.map(row=><button key={row.page} onClick={()=>openPage(row.page)}><strong>{row.page}</strong><small>{row.count?row.count+'문제':row.direct?'원문 '+row.direct+'개':'예제 '+row.examples+'개'}</small></button>)}</div></div>}
        <p className="library-note">답안과 마지막으로 펼친 쪽은 자동 저장됩니다.</p>
      </aside>
    </div>}
    <dialog ref={dialog} className="library-page-dialog" aria-labelledby="library-page-title" onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}>
      <form onSubmit={e=>{e.preventDefault();if(valid){dialog.current?.close();onOpen({from:normalized,to:'',contentsId:'',contentsLabel:''});}}}>
        <header><h2 id="library-page-title">어느 쪽을 펼칠까요?</h2><button type="button" aria-label="쪽 선택 닫기" onClick={()=>dialog.current?.close()}>×</button></header>
        <p>{textbookNames[book]} · 책에 적힌 쪽번호를 입력하세요.</p><label>쪽번호<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} placeholder={book==='hansol'?'예: 4-10':'예: 442'} autoComplete="off"/></label>
        {book==='hansol' && <small>한 쪽을 열려면 부록 번호도 함께 입력하세요. 예: 4-10</small>}<button type="submit" disabled={!valid} className="library-open">문제 풀기 →</button>
      </form>
    </dialog>
  </section>;
}
