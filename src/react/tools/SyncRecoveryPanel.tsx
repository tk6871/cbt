import {useEffect,useState} from 'react';
import {getLearningRecoveryCopies,recoverLearningCopy} from '../../cbt/cloudSync';
import {recoveryPreview,type SyncRecovery} from '../../cbt/syncRecovery';
import './sync-recovery.css';

export default function SyncRecoveryPanel({count,syncing}:{count:number;syncing:boolean}){
  const [copies,setCopies]=useState<SyncRecovery[]>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let current=true;
    void getLearningRecoveryCopies().then(rows=>{if(current)setCopies(rows);}).catch(()=>{
      if(current)setMessage('복구 사본을 읽지 못했습니다. 브라우저의 저장 공간 설정을 확인해 주세요.');
    });
    return ()=>{current=false;};
  },[count]);
  async function restore(row:SyncRecovery,side:'local'|'remote'){
    if(!window.confirm(row.label+'를 선택한 사본으로 복구할까요? 해당 풀이만 바뀌고 시험 점수·다른 문제 기록은 유지됩니다.'))return;
    setBusy(true);
    try{await recoverLearningCopy(row.id,side);setMessage('선택한 풀이를 복구했습니다. 서버에도 다시 동기화합니다.');}
    catch(error){setMessage(error instanceof Error?error.message:'복구에 실패했습니다.');}
    finally{setBusy(false);}
  }
  function exportCopies(){
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,copies},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='cbt-learning-recovery.json';link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="sync-recovery-panel" aria-label="풀이 복구 사본"><p>동기화 때 서로 달랐던 풀이를 이 브라우저에 최근 100건까지 보관합니다. 손글씨는 포함하지 않습니다.</p>
    <button type="button" disabled={!copies.length} onClick={exportCopies}>사본 파일로 보관</button>{message&&<p role="status">{message}</p>}
    {!copies.length&&<p>보관된 다른 풀이가 없습니다.</p>}
    {copies.map(row=><details key={row.id}><summary>{row.label} · {new Date(row.createdAt).toLocaleString('ko-KR')}</summary>
      <div className="sync-recovery-choices">{(['local','remote'] as const).map(side=><div key={side}><strong>{side==='local'?'당시 이 기기 풀이':'당시 서버 풀이'}</strong><pre>{recoveryPreview(row[side])}</pre><button type="button" disabled={busy||syncing} onClick={()=>void restore(row,side)}>이 풀이 복구</button></div>)}</div></details>)}</section>;
}
