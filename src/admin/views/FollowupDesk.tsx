import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {adminHref} from '../navigation';

type Member={member:string;name:string};
type List<T>={total:number;items:T[]};
type Inbox=List<Member & {id:string;at:string}>;
type Desk={inbox:Inbox;queues:Record<'mine'|'unassigned',List<Member>>|null};
const followups=adminHref('member-followups');
const recordLink=(id:string)=>followups+'?member='+encodeURIComponent(id);

export function FollowupDesk({client,home,writable}:{client:SupabaseClient;home:boolean;writable:boolean}) {
  const [data,setData]=useState<Desk|null>(null);
  const [refresh,setRefresh]=useState(0),[error,setError]=useState(false);
  const [setupPending,setSetupPending]=useState(false);
  const [marking,setMarking]=useState(''),[markError,setMarkError]=useState('');
  const [toastId,setToastId]=useState('');
  const [claiming,setClaiming]=useState(''),[claimMessage,setClaimMessage]=useState('');
  const previousInbox=useRef<Set<string>>(new Set());
  useEffect(()=>{
    const abort=new AbortController();
    let running=false,missingFunction=false;
    async function load(){
      if(running || missingFunction || document.hidden || abort.signal.aborted)return;
      running=true;
      try{
        const res=await client.rpc('cbt_followup_desk',{show_queues:home}).abortSignal(abort.signal);
        if(res.error?.code==='PGRST202'){
          if(!abort.signal.aborted){
            missingFunction=true;
            setSetupPending(true);setData(null);setToastId('');setClaimMessage('');setError(false);
            previousInbox.current.clear();
          }
          return;
        }
        if(res.error){
          if(!abort.signal.aborted && (res.status===401 || res.status===403)){
            setData(null);
            setClaimMessage('');
            setToastId('');
            previousInbox.current.clear();
          }
          throw res.error;
        }
        if(!abort.signal.aborted){setData(res.data);setSetupPending(false);setError(false);}
      }catch{if(!abort.signal.aborted)setError(true);}
      finally{running=false;}
    }
    void load();
    const timer=window.setInterval(load,5000);
    window.addEventListener('focus',load);
    document.addEventListener('visibilitychange',load);
    return ()=>{abort.abort();clearInterval(timer);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',load);};
  },[client,home,refresh]);
  async function claim(item:Member){
    if(!writable || claiming)return;
    setClaiming(item.member);
    setClaimMessage('');
    try{
      const res=await client.rpc('claim_member_followup',{target_member:item.member});
      if(res.error)throw res.error;
      switch(res.data?.status){
        case 'claimed': setClaimMessage(`${item.name} 회원의 후속 건을 맡았습니다.`);break;
        case 'already_mine': setClaimMessage(`${item.name} 회원은 이미 내 담당입니다.`);break;
        case 'taken': setClaimMessage(`${item.name} 회원은 ${res.data.owner} 담당자가 먼저 맡았습니다.`);break;
        case 'closed': setClaimMessage(`${item.name} 회원의 후속 건이 종료되었습니다.`);break;
        default: throw new Error('Unknown claim result');
      }
    }catch{setClaimMessage('배정 결과를 확인하지 못했습니다. 목록에서 담당자를 다시 확인해 주세요.');}
    finally{setClaiming('');setRefresh(value=>value+1);}
  }
  async function mark(id:string,member?:string){
    if(marking)return;
    if(member && document.querySelector('.admin-member-editor[data-dirty="true"]') &&
       !window.confirm('저장하지 않은 메모를 닫고 배정된 회원 기록을 열까요?'))return;
    setMarking(id);setMarkError('');
    try{
      const res=await client.from('admin_followup_notifications').update({seen:true}).eq('id',id).select('id').single();
      if(res.error)throw res.error;
      setToastId(current=>current===id?'':current);
      setRefresh(v=>v+1);
      if(member){
        const href=recordLink(member);
        if(location.hash===href)location.reload();
        else location.hash=href;
      }
    }catch{setMarkError('알림을 읽음으로 표시하지 못했습니다. 다시 시도해 주세요.');}
    finally{setMarking('');}
  }
  const inbox=data?.inbox;
  useEffect(()=>{
    if(!inbox)return;
    const latest=inbox.items[0];
    if(latest && !previousInbox.current.has(latest.id))setToastId(latest.id);
    previousInbox.current=new Set(inbox.items.map(item=>item.id));
  },[inbox]);
  const toast=inbox?.items.find(item=>item.id===toastId);
  return <>
    {toast && <aside className="admin-inbox-toast" aria-label="새 배정 알림"><strong>{toast.name} 회원이 배정됐습니다.</strong>
      <button disabled={!!marking} onClick={()=>void mark(toast.id,toast.member)}>배정된 기록 열기</button>
      <button onClick={()=>setToastId('')}>알림 닫기</button></aside>}
    <div role="status" aria-live="polite" className="admin-inbox-status">{inbox && inbox.total>0 &&
      <strong>새 배정 알림 {inbox.total}건 · {inbox.items[0]?.name}</strong>}</div>
    {inbox && inbox.total>0 && <details className="admin-inbox"><summary>배정 알림 확인</summary>
      <ul>{inbox.items.map(item=><li key={item.id}><span>{item.name} · {new Date(item.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</span>
        <button disabled={!!marking} onClick={()=>void mark(item.id,item.member)}>기록 열기</button>
        <button disabled={!!marking} onClick={()=>void mark(item.id)}>읽음 처리</button></li>)}</ul></details>}
    {markError && <p role="alert">{markError}</p>}
    {error && <p role="status">배정 정보를 갱신하지 못했습니다. <button onClick={()=>setRefresh(v=>v+1)}>다시 조회</button></p>}
    {home && setupPending && <p role="status">회원 후속 관리는 서버 업데이트 후 이용할 수 있습니다. <button onClick={()=>setRefresh(v=>v+1)}>다시 확인</button></p>}
    {home && <div role="status" aria-live="polite" className="admin-claim-status">{claimMessage}</div>}
    {home && !setupPending && <div className="admin-followup-queues">{(['mine','unassigned'] as const).map(kind=>{
      const title=kind==='mine'?'내가 맡은 후속 건':'담당자 없는 후속 건';
      const list=data?.queues?.[kind];
      return <section key={kind} aria-label={title} className="admin-panel"><div className="admin-panel-title">
        <h2>{title}</h2>{list && <strong>{list.total}건</strong>}</div>
        {list ? <><ul>{list.items.map(item=><li key={item.member}><a href={recordLink(item.member)}>{item.name}</a>
            {kind==='unassigned' && writable && <button type="button" disabled={!!claiming}
              aria-label={`${item.name} 내가 맡기`} onClick={()=>void claim(item)}>
              {claiming===item.member?'배정 중…':'내가 맡기'}</button>}</li>)}</ul>
          {list.total===0?<p>후속 확인이 필요한 회원이 없습니다.</p>:<a href={followups+'?queue='+kind}>전체 보기</a>}</>
          : <p>{error?'목록을 확인할 수 없습니다.':'불러오는 중입니다.'}</p>}
      </section>;
    })}</div>}
  </>;
}
