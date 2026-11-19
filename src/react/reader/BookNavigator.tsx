import type {ReactNode} from 'react';
import {textbookNames,type TextbookKey} from '../../cbt/textbookPages';

export type NavigationTab='contents'|'pages';
export interface NavigatorProps {
  book: TextbookKey; start:string; tab:NavigationTab; visited:boolean;
  draftFrom:string; draftTo:string; invalid:boolean; pages:string[]; selectedPages:string[];
  changeTab:(tab:NavigationTab)=>void; changeBook:(key:TextbookKey)=>void;
  changeFrom:(value:string)=>void; changeTo:(value:string)=>void;
  apply:()=>void; select:(page:string)=>void; close:()=>void; afterClose:()=>void;
  dialogRef:(el:HTMLDialogElement|null)=>void; contentsRef?:(el:HTMLDivElement|null)=>void; contents?:ReactNode;
}
export function BookNavigator(p:NavigatorProps) {
  return <dialog ref={p.dialogRef} id="textbook-navigator" className="book-navigator" aria-labelledby="book-navigator-title"
    onClose={p.afterClose} onClick={e=>{if(e.target===e.currentTarget)p.close()}}>
    <div className="book-navigator-body">
      <header className="navigator-header"><div><h2 id="book-navigator-title">어디부터 풀까요?</h2><p>목차를 펼치거나 책에 적힌 쪽번호로 이동하세요.</p></div>
        <button type="button" aria-label="목차·쪽 선택 닫기" onClick={p.close}>×</button></header>
      <div className="book-tabs" aria-label="교재 선택">{(Object.keys(textbookNames) as TextbookKey[]).map(key=>
        <button key={key} type="button" aria-pressed={p.book===key} onClick={()=>p.changeBook(key)}>{textbookNames[key]}</button>)}</div>
      <nav className="navigator-tabs" aria-label="교재 탐색 방식">
        {([['contents','교재 목차'],['pages','쪽번호 이동']] as const).map(([key,title])=>
          <button key={key} type="button" aria-pressed={p.tab===key} onClick={()=>p.changeTab(key)}>{title}</button>)}
      </nav>
      {p.visited&&<>
        <div hidden={p.tab!=='contents'} ref={p.contentsRef} className="navigator-contents">{p.contents}</div>
        <section hidden={p.tab!=='pages'} className="navigator-page-panel">
          <h3>책에 인쇄된 쪽번호</h3><p>한솔의 <b>4-10</b>은 4~10쪽 범위가 아닌 한 페이지입니다.</p>
          <form className="page-picker" onSubmit={e=>{e.preventDefault();p.apply()}}>
            <label>시작 쪽<input value={p.draftFrom} onChange={e=>p.changeFrom(e.target.value)}
              list={'book-pages-'+p.book} placeholder={p.book==='hansol'?'예: 4-10':'예: 442'} autoComplete="off"/></label>
            <label>끝 쪽 <small>여러 쪽을 모아 풀 때만</small><input value={p.draftTo} onChange={e=>p.changeTo(e.target.value)}
              list={'book-pages-'+p.book} placeholder="한 쪽이면 비워 두세요" autoComplete="off"/></label>
            <datalist id={'book-pages-'+p.book}>{p.pages.map(page=><option key={page} value={page}/>)}</datalist>
            <button type="submit" disabled={p.invalid}>이 쪽 열기 →</button>
          </form>
          {p.invalid&&<p role="status">책의 쪽번호를 입력하세요. 끝 쪽을 입력한다면 시작 쪽보다 뒤여야 합니다.</p>}
          <details><summary>등록된 쪽에서 고르기 · {p.pages.length}쪽</summary><div className="registered-book-pages">
            {p.pages.map(page=><button type="button" key={page} aria-pressed={p.selectedPages.includes(page)} onClick={()=>p.select(page)}>{page}</button>)}
          </div></details>
        </section>
      </>}
      <footer className="navigator-footer"><span>마지막 쪽과 풀이 기록은 자동 저장됩니다.</span><button type="button" onClick={p.close}>{p.start}쪽 이어서 보기 →</button></footer>
    </div>
  </dialog>;
}
