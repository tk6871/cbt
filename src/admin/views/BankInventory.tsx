import {useState} from 'react';
import banks from '../../../data/admin-bank-index.json';

export default function BankInventory() {
  const [search,setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase('ko-KR');
  const shown = banks.filter(bank => (bank.name+' '+bank.key).toLocaleLowerCase('ko-KR').includes(needle));
  return <section className="admin-panel"><div className="admin-panel-title"><h2>등록 자료집</h2>
    <p>회차형 원본 자료집 기준입니다. 자료집을 펼치면 회차별 제목과 문항 수를 확인할 수 있습니다.</p></div>
    <div className="admin-result-filters"><label>자료집 검색<input type="search" value={search} onChange={e=>setSearch(e.target.value)} /></label>
      <span role="status">{shown.length}개 자료집 · {shown.reduce((n,b)=>n+b.rounds.length,0).toLocaleString()}회차 · {shown.reduce((n,b)=>n+b.rounds.reduce((s,r)=>s+r.questions,0),0).toLocaleString()}문항</span></div>
    {shown.map(bank=><details className="admin-bank" key={bank.key}><summary>{bank.name} <small>{bank.rounds.length}회차 · {bank.rounds.reduce((n,r)=>n+r.questions,0).toLocaleString()}문항</small></summary>
      <ul>{bank.rounds.map(round=><li key={round.id}>{round.title} <b>{round.questions}문항</b></li>)}</ul></details>)}
    {!shown.length && <p>검색 조건에 맞는 자료집이 없습니다.</p>}
  </section>;
}
