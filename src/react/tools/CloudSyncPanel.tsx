import {lazy, Suspense, useState, useSyncExternalStore, type FormEvent} from 'react';
import {computed} from '@preact/signals-core';
import {
  cloudSyncState,
  findSyncId,
  resetSyncPassword,
  signInForSync,
  signOutFromSync,
  signUpForSync,
  syncLearningData,
  updateSyncPassword,
} from '../../cbt/cloudSync';

type AuthMode = 'login' | 'signup' | 'id' | 'reset';

const SyncRecoveryPanel=lazy(()=>import('./SyncRecoveryPanel'));
const snapshot=computed(()=>({...cloudSyncState}));
const subscribe=(notify:()=>void)=>snapshot.subscribe(notify);
const read=()=>snapshot.value;
const phases={idle:'연결 준비',waiting:'서버 저장 대기',reading:'① 서버 읽기',merging:'② 비교·사본 보관',uploading:'③ 서버 저장',applying:'④ 기기 반영',complete:'서버 저장 확인 완료',offline:'오프라인 · 이 기기 보관',error:'서버 저장 확인 필요'};
const tabs={login:'로그인',signup:'회원가입',id:'아이디 찾기',reset:'비밀번호 찾기'} as const;
const space = window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial';
const identifierStorageKey = `cbt-sync-email-${space}`;
const rememberStorageKey = `cbt-sync-remember-${space}`;

export default function CloudSyncPanel({description}:{description:string}){
  const cloud=useSyncExternalStore(subscribe,read);
  const [recoveryOpen,setRecoveryOpen]=useState(false);
  const [rememberedIdentifier,setRememberedIdentifier] = useState(()=>localStorage.getItem(identifierStorageKey) || '');
  const [open,setOpen] = useState(false);
  const [mode,setAuthMode] = useState<AuthMode>('login');
  const [identifier,setIdentifier] = useState(rememberedIdentifier);
  const [password,setPassword] = useState('');
  const [passwordConfirm,setPasswordConfirm] = useState('');
  const [recoveryCode,setRecoveryCode] = useState('');
  const [issuedRecoveryCode,setIssuedRecoveryCode] = useState('');
  const [rememberIdentifier,setRememberIdentifier] = useState(()=>localStorage.getItem(rememberStorageKey) !== 'false');
  const [changePasswordOpen,setChangePasswordOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  function setMode(nextMode: AuthMode): void {
    setAuthMode(nextMode);
    setPassword('');
    setPasswordConfirm('');
    setRecoveryCode('');
    setIssuedRecoveryCode('');
    setMessage('');
  }

  function saveRememberedIdentifier(): void {
    localStorage.setItem(rememberStorageKey, String(rememberIdentifier));
    if (rememberIdentifier) {
      setRememberedIdentifier(identifier.trim());
      localStorage.setItem(identifierStorageKey, identifier.trim());
    } else {
      setRememberedIdentifier('');
      localStorage.removeItem(identifierStorageKey);
    }
  }

  async function copyText(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setMessage('복구코드를 복사했습니다. 다른 사람이 볼 수 없는 곳에 보관하세요.');
    } catch {
      setMessage(`복구코드: ${value}`);
    }
  }

  async function login(): Promise<void> {
    if (!identifier.trim() || !password) {
      setMessage('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    const error = await signInForSync(identifier, password);
    setBusy(false);
    setMessage(error || '로그인했습니다. 이 기기와 클라우드 기록을 안전하게 합칩니다.');
    if (!error) {
      saveRememberedIdentifier();
      setPassword('');
    }
  }

  async function signup(): Promise<void> {
    if (!identifier.trim() || password.length < 8) {
      setMessage('사용할 아이디와 8자 이상의 비밀번호를 입력해 주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setMessage('두 비밀번호가 서로 다릅니다.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await signUpForSync(identifier, password);
    setBusy(false);
    setIssuedRecoveryCode(result.recoveryCode || '');
    setMessage(result.error || '계정을 만들고 로그인했습니다. 아래 복구코드를 꼭 저장하세요.');
    if (!result.error) {
      saveRememberedIdentifier();
      setPassword('');
      setPasswordConfirm('');
    }
  }

  async function findId(): Promise<void> {
    if (!recoveryCode.trim()) {
      setMessage('가입할 때 받은 복구코드를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await findSyncId(recoveryCode);
    setBusy(false);
    if (result.username) setIdentifier(result.username);
    setMessage(result.error || `찾은 아이디는 “${result.username}”입니다.`);
  }

  async function resetPassword(): Promise<void> {
    if (!identifier.trim() || !recoveryCode.trim() || password.length < 8) {
      setMessage('아이디·복구코드·8자 이상의 새 비밀번호를 입력해 주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      setMessage('두 비밀번호가 서로 다릅니다.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await resetSyncPassword(identifier, recoveryCode, password);
    setBusy(false);
    setIssuedRecoveryCode(result.recoveryCode || '');
    setMessage(result.error || '비밀번호를 바꿨습니다. 아래 새 복구코드를 저장한 뒤 로그인하세요.');
    if (!result.error) {
      saveRememberedIdentifier();
      setPassword('');
      setPasswordConfirm('');
      setRecoveryCode('');
    }
  }

  async function saveNewPassword(): Promise<void> {
    if (password !== passwordConfirm) {
      setMessage('두 비밀번호가 서로 다릅니다.');
      return;
    }
    setBusy(true);
    setMessage('');
    const error = await updateSyncPassword(password);
    setBusy(false);
    setMessage(error || '새 비밀번호로 변경했습니다. 자동 로그인이 유지됩니다.');
    if (!error) {
      setPassword('');
      setPasswordConfirm('');
      setChangePasswordOpen(false);
    }
  }

  async function logout(): Promise<void> {
    await signOutFromSync();
    setOpen(false);
    setChangePasswordOpen(false);
    setPassword('');
    setPasswordConfirm('');
    setMessage('');
  }

  function syncTimeLabel(): string {
    if (!cloud.lastSyncedAt) return '아직 동기화하지 않음';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(cloud.lastSyncedAt));
  }
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    try {
      if(cloud.email) await saveNewPassword();
      else await ({login,signup,id:findId,reset:resetPassword})[mode]();
    } catch {
      setMessage('요청을 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {setBusy(false);}
  }
  const changing=Boolean(cloud.email);
  const newPassword=changing || mode==='signup' || mode==='reset';
  const needIdentifier=!changing && mode!=='id';
  const needRecovery=!changing && (mode==='id'||mode==='reset');
  const showForm=changing?(changePasswordOpen||cloud.mustChangePassword):open;
  const title=changing?'새 비밀번호 설정':({login:'동기화 로그인',signup:'새 계정 만들기',id:'아이디 찾기',reset:'비밀번호 재설정'})[mode];
  const hint=changing?'학습 기록은 그대로 유지됩니다.':({login:'메일 없이 만든 아이디로 로그인합니다.',signup:'아이디와 8자 이상의 비밀번호로 가입합니다.',id:'가입할 때 받은 복구코드로 바로 확인합니다.',reset:'저장한 복구코드로 새 비밀번호를 만듭니다.'})[mode];
  const button=changing?'새 비밀번호 저장':({login:'로그인',signup:'회원가입',id:'아이디 확인',reset:'비밀번호 변경'})[mode];
  return <div className="setting-group cloud-sync-setting">
    <div className="cloud-sync-heading"><div><span>기기 간 학습 기록 동기화</span><p className="setting-description">{description}</p></div><small>최근 동기화<br/><b>{syncTimeLabel()}</b></small></div>
    {changing&&<>
      <div className="cloud-sync-account"><div><strong>{cloud.email}</strong><small>{cloud.message || '기기 간 기록 동기화가 연결되었습니다.'}</small></div>
        <i className={'is-'+cloud.status}>{cloud.status==='syncing'?'동기화 중':cloud.status==='error'?'확인 필요':'연결됨'}</i></div>
      <p className="cloud-sync-help" role="status" data-phase={cloud.phase}>{phases[cloud.phase]}</p>
      <details className="cloud-sync-recovery" onToggle={e=>setRecoveryOpen(e.currentTarget.open)}><summary>다른 풀이 사본·복구 ({cloud.recoveryCount})</summary>
        {recoveryOpen&&<Suspense fallback={<p role="status">복구 사본을 여는 중…</p>}><SyncRecoveryPanel key={cloud.email} count={cloud.recoveryCount} syncing={cloud.status==='syncing'}/></Suspense>}</details>
      {cloud.mustChangePassword&&<p className="cloud-sync-help">관리자가 발급한 임시 비밀번호로 로그인했습니다. 지금 새 비밀번호로 바꿔 주세요.</p>}
    </>}
    {issuedRecoveryCode&&<div className="cloud-sync-recovery-code"><span>{mode==='reset'?'새 복구코드':'내 복구코드'}</span><strong>{issuedRecoveryCode}</strong><button type="button" onClick={()=>void copyText(issuedRecoveryCode)}>복사</button><button type="button" onClick={()=>setIssuedRecoveryCode('')}>보관 완료</button></div>}
    {!showForm?(changing?<div className="cloud-sync-actions">
      <button type="button" disabled={cloud.status==='syncing'} onClick={()=>void syncLearningData()}>지금 동기화</button>
      <button type="button" className="secondary" onClick={()=>{setChangePasswordOpen(true);setMessage('');}}>비밀번호 변경</button>
      <button type="button" className="secondary" onClick={()=>{setIssuedRecoveryCode('');void logout();}}>로그아웃</button></div>:
      <button type="button" className="cloud-sync-open" onClick={()=>{setOpen(true);setMode('login');}}>로그인·회원가입</button>):
    <div className={changing?'cloud-sync-recovery':'cloud-sync-auth-shell'}>
      {!changing&&<nav aria-label="동기화 계정 메뉴">{(Object.keys(tabs) as AuthMode[]).map(tab=><button type="button" key={tab} disabled={busy} className={tab===mode?'active':''} aria-pressed={tab===mode} onClick={()=>setMode(tab)}>{tabs[tab]}</button>)}</nav>}
      <form className="cloud-sync-form" onSubmit={submit}>
        <div className="cloud-sync-form-title"><b>{title}</b><small>{hint}</small></div>
        {mode==='id'&&!changing&&rememberedIdentifier&&<div className="cloud-sync-remembered-id"><span>이 기기에 기억된 아이디</span><button type="button" onClick={()=>{setMode('login');setIdentifier(rememberedIdentifier);}}>{rememberedIdentifier}</button></div>}
        {needIdentifier&&<label><span>아이디</span><input type="text" autoComplete="username" required minLength={mode==='signup'?4:undefined} maxLength={mode==='signup'?24:undefined} placeholder={mode==='signup'?'한글·영문·숫자 4~24자':'4~24자'} value={identifier} onChange={e=>setIdentifier(e.target.value.trim())}/></label>}
        {needRecovery&&<label><span>복구코드</span><input autoComplete="off" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX" value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.trim())}/></label>}
        {(changing||mode!=='id')&&<label><span>{changing||mode==='reset'?'새 비밀번호':'비밀번호'}</span><input type="password" autoComplete={newPassword?'new-password':'current-password'} minLength={8} maxLength={newPassword?72:undefined} required placeholder="8자 이상" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
        {newPassword&&<label><span>{mode==='signup'&&!changing?'비밀번호 확인':'새 비밀번호 확인'}</span><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required placeholder="한 번 더 입력" value={passwordConfirm} onChange={e=>setPasswordConfirm(e.target.value)}/></label>}
        {!changing&&mode==='login'&&<><label className="cloud-sync-remember"><input type="checkbox" checked={rememberIdentifier} onChange={e=>setRememberIdentifier(e.target.checked)}/><span>아이디 기억</span><small>로그인 세션도 이 기기에 안전하게 유지됩니다.</small></label>
          <p className="cloud-sync-help">기존 이메일 계정은 아이디 칸에 이메일을 그대로 입력해 로그인할 수 있습니다.</p></>}
        {needRecovery&&<p className="cloud-sync-help">{mode==='id'?'복구코드까지 잊었다면 관리자에게 임시 비밀번호 발급을 요청하세요.':'복구코드도 없다면 관리자에게 임시 비밀번호를 요청한 뒤 로그인해서 변경할 수 있습니다.'}</p>}
        {message&&<p aria-live="polite">{message}</p>}
        <div>{(!issuedRecoveryCode||changing)&&<button type="submit" disabled={busy}>{busy?'처리 중…':button}</button>}
        {!cloud.mustChangePassword&&<button type="button" disabled={busy} className="text-button" onClick={()=>{setOpen(false);setChangePasswordOpen(false);setMode('login');}}>닫기</button>}</div>
      </form></div>}
    {!showForm&&message&&<p aria-live="polite">{message}</p>}
  </div>;
}
