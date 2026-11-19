import type {ReactNode} from 'react';
import {textbookNames,type TextbookKey,textbookAuditPages} from '../../cbt/textbookPages';

export type NavigationTab='contents'|'pages'|'info';
export interface NavigatorProps {
  book: TextbookKey; start:string; tab:NavigationTab; visited:boolean;
  draftFrom:string; draftTo:string; invalid:boolean; pages:string[]; selectedPages:string[];
  detected?:number; auditSearch:string; auditRows:typeof textbookAuditPages; hasMore:boolean;
  changeTab:(tab:NavigationTab)=>void; changeBook:(key:TextbookKey)=>void;
  changeFrom:(value:string)=>void; changeTo:(value:string)=>void; changeSearch:(value:string)=>void;
  more:()=>void; apply:()=>void; select:(page:string)=>void; close:()=>void; afterClose:()=>void;
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
        {([['contents','교재 목차'],['pages','쪽번호 이동'],['info','연결 현황·안내']] as const).map(([key,title])=>
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
        <section hidden={p.tab!=='info'} className="navigator-info">
          {p.detected!==undefined&&<p className="book-page-audit">{p.start}쪽 · 자동 인식 후보 {p.detected}위치. 최종 문제 수나 개별 검토 완료를 뜻하지 않습니다.</p>}
          {p.book==='hansol'&&<details className="book-comparison-summary">
            <summary>전체 자동 대조 현황 · {textbookAuditPages.length}쪽</summary>
            <p>전체 정상 열람 화면을 비교한 결과입니다. 연결된 문제와 미확정 인식 후보·출제 보류를 구분합니다. 인식 후보 수는 실제 문제 수가 아니며, 전 문항 육안 검증 완료를 뜻하지 않습니다.</p>
            <input value={p.auditSearch} onChange={e=>p.changeSearch(e.target.value)} type="search" aria-label="교재 대조 쪽 검색" placeholder="쪽번호 검색 · 예: 1-108"/>
            <div className="book-audit-list">{p.auditRows.map(row=><button key={row.page} type="button" onClick={()=>p.select(row.page)}>
              <strong>{row.page}쪽</strong><span>연결 {row.linkedPositions} · 미확정 후보 {row.unconfirmedCandidates}{row.heldPositions>0&&<b> · 보류 {row.heldPositions}</b>}</span>
            </button>)}</div>
            {p.hasMore&&<button type="button" onClick={p.more}>80쪽 더 보기</button>}
            {!p.auditRows.length&&<p>해당 쪽번호의 대조 자료가 없습니다.</p>}
          </details>}
          <p className="book-coverage">전체 교재를 대상으로 연결을 진행 중입니다. 아직 모든 페이지의 연결이 끝난 상태는 아닙니다. 대조하지 않은 쪽과 연결하지 못한 문항도 구분합니다. 원문 기출 이미지 안의 번호는 교재 번호와 다를 수 있으며, 위의 ‘교재 ○번’이 책의 번호입니다. 좌우 열이 확인된 페이지는 그 배치를 따르고 나머지는 읽기 순서로 나눕니다. 페이지 선택은 이 기기에 저장하며 풀이 기록은 일반 기출·중간고사와 따로 저장합니다.</p>
        </section>
      </>}
      <footer className="navigator-footer"><span>마지막 쪽과 풀이 기록은 자동 저장됩니다.</span><button type="button" onClick={p.close}>{p.start}쪽 이어서 보기 →</button></footer>
    </div>
  </dialog>;
}
