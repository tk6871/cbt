import {useEffect, useRef, useState} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import {Group, Panel, Separator} from 'react-resizable-panels';
import {ChevronLeft, ExternalLink, FileDown, Save, Search} from 'lucide-react';
import {issueImageUrl, issueStatusLabel, issueTypeLabel} from './presentation';
import type {QuestionIssueReport as Report} from './adminController';
import './issue-workspace.css';

interface Props {
  reports: Report[]; saving: Record<number,boolean>; drafts: Record<number,string>;
  messages: Record<number,string>; failed: Record<number,unknown>;
  onClose():void; onExport():void; onUpdateStatus(report:Report,status:Report['status']):void;
  onDraftNote(id:number, text:string):void; onSaveNote(report:Report):void; onRetry(report:Report):void;
}
export default function AdminIssueWorkspace(p:Props) {
  const [query,setQuery]=useState('');
  const [chosen,choose]=useState(p.reports[0]?.id);
  const [narrow,setNarrow]=useState(()=>matchMedia('(max-width:820px)').matches);
  useEffect(()=>{
    const media=matchMedia('(max-width:820px)');
    const update=()=>setNarrow(media.matches);
    media.addEventListener('change',update);
    return ()=>media.removeEventListener('change',update);
  },[]);
  const keyword=query.trim().toLocaleLowerCase('ko-KR');
  const rows=p.reports.filter(r=>[r.qualification||r.qualification_key,r.round_title||r.round_id,r.question_number,r.details,r.question_text].join(' ').toLocaleLowerCase('ko-KR').includes(keyword));
  const selected=rows.find(r=>r.id===chosen) || rows[0];
  const scroll=useRef<HTMLDivElement>(null);
  const list=useVirtualizer({count:rows.length,getScrollElement:()=>scroll.current,estimateSize:()=>82,overscan:7,getItemKey:i=>rows[i].id});
  const image=selected && issueImageUrl(selected.source_image);
  return <section className="issue-workspace"><header>
    <button type="button" onClick={p.onClose}><ChevronLeft size={16}/> 기존 표</button>
    <div><strong>집중 검토</strong><small>목록 · 원문 · 처리 메모를 한 화면에서 확인</small></div>
    <button type="button" onClick={p.onExport}><FileDown size={16}/> JSON</button></header>
    <Group className="issue-splitpanes" orientation={narrow?'vertical':'horizontal'}>
      <Panel defaultSize="24%" minSize="18%"><aside className="issue-workspace-list">
        <label><Search size={15}/><input aria-label="종목·회차·내용 검색" placeholder="종목·회차·내용 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <div ref={scroll} className="issue-virtual-scroll"><div style={{height:list.getTotalSize(),position:'relative'}}>
          {list.getVirtualItems().map(v=>{const r=rows[v.index];return <button key={r.id} type="button" className={selected?.id===r.id?'active':''}
            style={{position:'absolute',top:0,left:0,width:'100%',height:v.size,transform:'translateY('+v.start+'px)'}} onClick={()=>choose(r.id)}>
            <span>#{r.id} · {issueStatusLabel(r.status)}</span><strong>{r.qualification||r.qualification_key} · {r.question_number}번</strong><small>{r.details||'상세 내용 없음'}</small></button>;})}
        </div></div></aside></Panel>
      <Separator aria-label="제보 목록 크기 조절"/>
      <Panel defaultSize="44%" minSize="28%">{selected && <article className="issue-workspace-source">
        <span>{selected.round_title||selected.round_id} · {selected.subject||'과목 미확인'}</span><h2>{selected.qualification||selected.qualification_key} {selected.question_number}번</h2>
        <p>{selected.question_text||'이미지 원문 문제입니다.'}</p>
        {!!selected.choices_snapshot?.length && <ol>{selected.choices_snapshot.map((c,i)=><li key={i}>{i+1}. {c}</li>)}</ol>}
        {image && <><img src={image} alt="제보된 문제 원문"/><a href={image} target="_blank" rel="noopener"><ExternalLink size={15}/> 원본 새 창으로 열기</a></>}
      </article>}</Panel>
      <Separator aria-label="처리 메모 크기 조절"/>
      <Panel defaultSize="32%" minSize="24%">{selected && <aside className="issue-workspace-editor">
        <div><span>신고 유형</span><p>{selected.issue_types.map(t=><b key={t}>{issueTypeLabel(t)}</b>)}</p></div>
        <div><span>사용자 설명</span><p>{selected.details||'-'}</p></div>
        <label>처리 상태<select value={selected.status} disabled={p.saving[selected.id]} onChange={e=>p.onUpdateStatus(selected,e.target.value as Report['status'])}>
          <option value="open">대기</option><option value="reviewing">확인 중</option><option value="resolved">수정 완료</option><option value="deferred">보류</option></select></label>
        <label>관리자 메모<textarea rows={9} maxLength={3000} value={p.drafts[selected.id]??selected.admin_note??''} placeholder="대조 결과·수정 파일·남은 작업" onChange={e=>p.onDraftNote(selected.id,e.target.value)} onBlur={()=>p.onSaveNote(selected)}/></label>
        <small role="status"><Save size={14}/>{p.saving[selected.id] ? '저장 중…' : p.messages[selected.id] || '상태 변경 또는 메모 입력 후 자동 저장'}</small>
        {!!p.failed[selected.id] && <button type="button" disabled={p.saving[selected.id]} onClick={()=>p.onRetry(selected)}>다시 저장</button>}
      </aside>}</Panel>
    </Group></section>;
}
