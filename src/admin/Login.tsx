import type {LoginModel} from './adminModels';
import {useState} from 'react';
export function Login({busy,error,submit}:LoginModel){
  const [name,setName]=useState(''),[password,setPassword]=useState('');
  return <section className="admin-auth-card"><div className="admin-brand"><span>CBT</span><div><strong>관리자 센터</strong><small>방문·학습 통계</small></div></div>
    <h1>관리자 로그인</h1>
    <form onSubmit={e=>{e.preventDefault();if(!busy)submit(name,password)}}>
      <label>이메일 또는 사이트 아이디<input required autoComplete="username" value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>비밀번호<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button disabled={busy} type="submit">{busy?'확인 중…':'로그인'}</button>
    </form>{error&&<p role="alert" className="admin-error">{error}</p>}<a className="back-link" href="./">← CBT로 돌아가기</a></section>;
}
