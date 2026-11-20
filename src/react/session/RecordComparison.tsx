import {useState} from 'react';
import type {ExamRecord} from '../../cbt/storage';

function choice(record:ExamRecord,id:string) {
  const value=record.answers?.[id] ?? record.wrongAnswers?.find(item=>item.id===id)?.selected;
  if(value)return value+'번';
  return record.answers || value===0 ? '미응답' : '답안 정보 없음';
}

export function RecordComparison({record,previous}:{record:ExamRecord;previous?:ExamRecord}) {
  const [open,setOpen]=useState(false);
  if(!previous || !record.itemIds || !previous.itemIds)return null;
  const seen=new Set(previous.itemIds);
  if(!record.itemIds.some(id=>seen.has(id)))return null;
  const rows=open ? record.itemIds.map((id,index)=>({id,index})).filter(({id})=>seen.has(id)) : [];
  return <details className="record-comparison" onToggle={e=>setOpen(e.currentTarget.open)}><summary>이전 풀이와 답 비교</summary>
    <p>{new Date(previous.finishedAt).toLocaleString('ko-KR')} 풀이와 겹치는 {rows.length}문제</p>
    <table><thead><tr><th>이번 문항</th><th>이전 답</th><th>이번 답</th></tr></thead>
      <tbody>{rows.map(({id,index})=><tr key={id}><th scope="row">{index+1}번</th><td>{choice(previous,id)}</td><td>{choice(record,id)}</td></tr>)}</tbody></table>
  </details>;
}
