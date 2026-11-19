import {MemberFollowupHistory} from './MemberFollowupHistory';
import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {AdminAccountsModel} from '../adminController';
import {paginate} from '../presentation';

type Account = AdminAccountsModel['displayedSyncAccounts'][number];
type Note = {user_id:string; assignee_id:string|null; note:string; needs_follow_up:boolean; revision:number; updated_at:string};
const fields = 'user_id,assignee_id,note,needs_follow_up,revision,updated_at';
type Props = {target:string; initialOwner:string; client:SupabaseClient; accounts:Account[]; writable:boolean; loading:boolean; accountError:string; refreshAccounts:()=>Promise<void>};
type Draft = {id:string; assignee:string; text:string; flag:boolean; original:Note|undefined};

export function MemberFollowups({target,initialOwner,client,accounts,writable,loading,accountError,refreshAccounts}:Props) {
  const [notes,setNotes]=useState<Map<string,Note>>(new Map());
  const [ready,setReady]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const [query,setQuery]=useState(''), [flag,setFlag]=useState(initialOwner==='all'?'all':'follow'), [role,setRole]=useState('all');
  const [ownerFilter,setOwnerFilter]=useState(initialOwner);
  const openedTarget=useRef(false);
  const loadedDirectory=useRef<Account[]|null>(null);
  const managers=accounts.filter(a=>a.permissions.manageMembers || a.role==='super_admin');
  const managerNames=new Map(managers.map(a=>[a.userId,a.username]));
  const [activity,setActivity]=useState('all');
  const [sort,setSort]=useState('createdAt'), [page,setPage]=useState(1);
  const [draft,setDraft]=useState<Draft|null>(null), [saving,setSaving]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    loadedDirectory.current=null;
    setReady(false); setError('');
    if(loading)return;
    async function load() {
      const rows=new Map<string,Note>();
      // Walk the saved notes, so accounts with no support history add no queries.
      let after:string|undefined;
      while(accounts.length && !abort.signal.aborted){
        let query=client.from('admin_member_followups').select(fields).order('user_id').limit(200);
        if(after)query=query.gt('user_id',after);
        const res=await query.abortSignal(abort.signal);
        if(res.error) throw res.error;
        const page=res.data as Note[];
        for(const row of page)rows.set(row.user_id,row);
        if(page.length<200)break;
        after=page[page.length-1].user_id;
      }
      if(!abort.signal.aborted){loadedDirectory.current=accounts;setNotes(rows);setReady(true);}
    }
    void load().catch(cause=>{if(!abort.signal.aborted)setError(cause?.code==='PGRST205'?'회원 후속 관리는 서버 업데이트 후 이용할 수 있습니다.':'회원 메모를 불러오지 못했습니다. 새로고침해 주세요.');});
    return ()=>abort.abort();
  },[client,accounts,loading]);
  useEffect(()=>{
    if(!target || openedTarget.current || !ready || loading || loadedDirectory.current!==accounts)return;
    if(!accounts.some(a=>a.userId===target)){setError('해당 회원을 찾을 수 없습니다.');return;}
    openedTarget.current=true;
    const original=notes.get(target);
    setDraft({id:target,original,assignee:original?.assignee_id||'',text:original?.note||'',flag:Boolean(original?.needs_follow_up)});
  },[target,ready,loading,accounts,notes]);
  const dirty=draft && (draft.assignee!==(draft.original?.assignee_id||'') || draft.text!==(draft.original?.note||'') || draft.flag!==Boolean(draft.original?.needs_follow_up));
  const canLeave=()=>!dirty || window.confirm('저장하지 않은 메모를 닫을까요?');
  function open(id:string) {
    if(saving || !canLeave())return;
    const original=notes.get(id);
    setMessage('');setDraft({id,original,assignee:original?.assignee_id||'',text:original?.note||'',flag:Boolean(original?.needs_follow_up)});
  }
  async function save() {
    if(!writable || !draft || saving || !ready || !dirty)return;
    setSaving(true);setMessage('');
    try {
      const values={assignee_id:draft.assignee||null,note:draft.text,needs_follow_up:draft.flag};
      const table=client.from('admin_member_followups');
      const request=draft.original
        ? table.update(values).eq('user_id',draft.id).eq('revision',draft.original.revision)
        : table.insert({...values,user_id:draft.id});
      const res=await request.select(fields).maybeSingle();
      if(res.error?.code==='23505' || (!res.error && !res.data)){
        setMessage('다른 관리자가 먼저 저장했습니다. 입력을 복사한 뒤 새로고침해 최신 메모를 확인해 주세요.');return;
      }
      if(res.error?.code==='23514' || res.error?.code==='23503'){setMessage('담당자 권한이 변경됐습니다. 목록을 새로고침해 다시 선택해 주세요.');return;}
      if(res.error)throw res.error;
      const row=res.data as Note;
      setNotes(old=>new Map(old).set(row.user_id,row));
      setDraft({...draft,original:row});setMessage('저장했습니다.');
    } catch {setMessage('메모를 저장하지 못했습니다. 권한과 연결을 확인해 주세요.');}
    finally {setSaving(false);}
  }
  const keyword=query.trim().toLocaleLowerCase('ko-KR');
  const day=86_400_000, now=Date.now();
  function inActivityGroup(account:Account) {
    switch(activity){
      case 'new':return Date.parse(account.createdAt)>=now-7*day;
      case 'inactive':return Boolean(account.lastSignInAt) && Date.parse(account.lastSignInAt || '')<=now-30*day;
      case 'never':return !account.lastSignInAt;
      default:return true;
    }
  }
  const filtered=accounts.filter(a=>(role==='all'||(a.role||'member')===role)
    &&(ownerFilter==='all'||(notes.get(a.userId)?.assignee_id||'none')===ownerFilter)
    &&inActivityGroup(a) && (flag==='all'||notes.get(a.userId)?.needs_follow_up)
    &&[a.username,a.email].some(v=>v?.toLocaleLowerCase('ko-KR').includes(keyword)))
    .sort((a,b)=>((sort==='createdAt'?b.createdAt:b.lastSignInAt)||'').localeCompare((sort==='createdAt'?a.createdAt:a.lastSignInAt)||''));
  const list=paginate(filtered,page,25);
  const selected=accounts.find(a=>a.userId===draft?.id);
  const label=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'기록 없음';
  return <section className="admin-panel">
    <div className="admin-panel-title"><h2>회원별 운영 기록</h2><p>최근 가입·로그인 순으로 조회하고, 지원이 필요한 회원의 메모를 관리자끼리 공유합니다.</p></div>
    <div className="admin-result-filters">
      <label>회원 검색<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="아이디·이메일"/></label>
      <label>처리 상태<select value={flag} onChange={e=>{setFlag(e.target.value);setPage(1);}}><option value="all">전체</option><option value="follow">후속 확인 필요</option></select></label>
      <label>담당자 필터<select value={ownerFilter} onChange={e=>{setOwnerFilter(e.target.value);setPage(1);}}>
        <option value="all">전체</option><option value="none">미지정</option>{managers.map(a=><option key={a.userId} value={a.userId}>{a.username}</option>)}</select></label>
      <label>회원 역할<select value={role} onChange={e=>{setRole(e.target.value);setPage(1);}}><option value="all">전체</option><option value="member">일반 회원</option><option value="admin">관리자</option><option value="super_admin">슈퍼 관리자</option></select></label>
      <label>계정 활동<select value={activity} onChange={e=>{setActivity(e.target.value);setPage(1);}}><option value="all">전체</option>
        <option value="new">최근 7일 가입</option><option value="inactive">30일 이상 미로그인</option><option value="never">로그인 이력 없음</option></select></label>
      <label>정렬<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="createdAt">최근 가입순</option><option value="lastSignInAt">최근 로그인순</option></select></label>
      <button disabled={saving||loading} onClick={()=>{if(canLeave()){setDraft(null);setMessage('');void refreshAccounts();}}}>목록 새로고침</button>
    </div>
    {(accountError||error) && <p role="alert">{accountError||error}</p>}
    {draft && selected && <form className="admin-member-editor" data-dirty={Boolean(dirty)} onSubmit={e=>{e.preventDefault();void save();}}>
      <h3>{selected.username} 운영 메모</h3>
      <label>담당자 지정<select value={draft.assignee} disabled={!writable||saving} onChange={e=>setDraft({...draft,assignee:e.target.value})}>
        <option value="">미지정</option>{managers.map(a=><option key={a.userId} value={a.userId}>{a.username}</option>)}</select></label>
      <label>관리자 메모<textarea maxLength={2000} rows={3} readOnly={!writable||saving} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label>
      <label><input type="checkbox" checked={draft.flag} disabled={!writable||saving} onChange={e=>setDraft({...draft,flag:e.target.checked})}/> 후속 확인 필요</label>
      {draft.original && <small>마지막 수정 {label(draft.original.updated_at)}</small>}
      <div>{writable && <button type="submit" disabled={!ready||!dirty||saving}>{saving?'저장 중':'메모 저장'}</button>}
      <button type="button" disabled={saving} onClick={()=>{if(canLeave())setDraft(null);}}>닫기</button></div><span role="status">{message}</span>
    </form>}
    {draft && selected && <MemberFollowupHistory key={draft.id+':'+(draft.original?.revision||0)} client={client} userId={draft.id} revision={draft.original?.revision||0}/>}
    <p role="status">{loading||(!ready&&!error)?'회원 기록을 불러오는 중입니다.':`조회한 회원 ${accounts.length}명 중 ${filtered.length}명 표시`}</p>
    <div className="admin-table-wrap"><table><thead><tr><th>회원</th><th>가입</th><th>최근 로그인</th><th>처리 상태</th><th>담당자</th><th>운영 메모</th></tr></thead>
      <tbody>{list.rows.map(a=><tr key={a.userId}><th scope="row">{a.username}</th><td>{label(a.createdAt)}</td><td>{label(a.lastSignInAt)}</td>
        <td>{!ready?'—':notes.get(a.userId)?.needs_follow_up?'후속 확인 필요':'—'}</td><td>{ready?(managerNames.get(notes.get(a.userId)?.assignee_id||'')||'미지정'):'—'}</td><td><button disabled={!ready||saving||loading} onClick={()=>open(a.userId)}>기록 열기</button></td></tr>)}
      {ready&&!loading&&!list.rows.length && <tr><td colSpan={6} className="empty-cell">조건에 맞는 회원이 없습니다.</td></tr>}</tbody></table></div>
    {list.pageCount>1 && <nav aria-label="회원 기록 페이지" className="admin-result-pagination"><button disabled={list.page===1} onClick={()=>setPage(list.page-1)}>이전</button>
    <span>{list.page} / {list.pageCount}</span><button disabled={list.page===list.pageCount} onClick={()=>setPage(list.page+1)}>다음</button></nav>}
  </section>;
}
