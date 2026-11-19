import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

type Changes = {note?:[string,string]; followUp?:[boolean,boolean]; assignee?:[string|null,string|null]};
type Entry = {revision:number; changed_at:string; actor_name:string; changes:Changes};
const pageSize=20;

export function MemberFollowupHistory({client,userId,revision}:{client:SupabaseClient;userId:string;revision:number}) {
  const [refresh,setRefresh]=useState(0), [before,setBefore]=useState<number|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]), [more,setMore]=useState(false);
  const [busy,setBusy]=useState(true), [failed,setFailed]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    setBusy(true);setFailed(false);
    async function load() {
      let query=client.from('admin_member_followup_history').select('revision,changed_at,actor_name,changes')
        .eq('user_id',userId).order('revision',{ascending:false}).limit(pageSize+1);
      if(before!==null)query=query.lt('revision',before);
      const res=await query.abortSignal(abort.signal);
      if(abort.signal.aborted)return;
      if(res.error)throw res.error;
      const rows=res.data as Entry[];
      setEntries(old=>before===null?rows.slice(0,pageSize):[...old,...rows.slice(0,pageSize)]);
      setMore(rows.length>pageSize);
    }
    void load().catch(()=>{if(!abort.signal.aborted)setFailed(true);}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
    return ()=>abort.abort();
  },[client,userId,revision,refresh,before]);
  return <section className="admin-followup-history" aria-label="처리 이력">
    <h3>처리 이력</h3>
    <button type="button" disabled={busy} onClick={()=>{setBefore(null);setRefresh(v=>v+1);}}>이력 새로고침</button>
    {failed && <p role="alert">처리 이력을 불러오지 못했습니다. 다시 조회해 주세요.</p>}
    {busy && <p role="status">이력을 불러오는 중입니다.</p>}
    {!busy && !failed && !entries.length && <p>이력 기록을 시작한 뒤 저장된 변경이 없습니다.</p>}
    <ol>{entries.map(({revision,changed_at,actor_name,changes})=><li key={revision}>
      <strong>{actor_name}</strong> <time dateTime={changed_at}>{new Date(changed_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} (한국 시간)</time>
      {changes.assignee && <p>담당자 변경 · {changes.assignee[0]??'미지정'} → {changes.assignee[1]??'미지정'}</p>}
      {changes.followUp && <p>{changes.followUp[1]?'후속 확인 요청':'처리 완료'}</p>}
      {changes.note && <details><summary>메모 변경 내용</summary><p>변경 전 · {changes.note[0]||'없음'}</p><p>변경 후 · {changes.note[1]||'없음'}</p></details>}
    </li>)}</ol>
    {more && !failed && <button type="button" disabled={busy} onClick={()=>setBefore(entries[entries.length-1].revision)}>이전 이력 더 보기</button>}
  </section>;
}
