import {useMemo} from 'react';
import type {AdminOverviewModel} from '../adminController';

const dateLabel = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
const columns = ['날짜','방문 기록','방문 브라우저','학습 결과','CBT 결과','전체 제출','평균 점수'];
type Props = Pick<AdminOverviewModel,'results'|'visits'> & {days:number; ready:boolean};

export function DailyReport({results,visits,days,ready}:Props) {
  const rows = useMemo(()=>{
    const dates = new Map<string,{visits:number; browsers:Set<string>; learn:number; exam:number; total:number; score:number}>();
    function bucket(stamp:string) {
      const date = dateLabel.format(new Date(stamp));
      let row = dates.get(date);
      if (!row) {row = {visits:0,browsers:new Set(),learn:0,exam:0,total:0,score:0}; dates.set(date,row);}
      return row;
    }
    for (const visit of visits) {const row=bucket(visit.visited_at); row.visits++; row.browsers.add(visit.visitor_id);}
    for (const result of results) {
      const row=bucket(result.completed_at);
      if (result.mode==='exam') row.exam++;
      if (result.mode==='learn') row.learn++;
      row.total++; row.score+=result.score;
    }
    return [...dates].sort(([a],[b])=>b.localeCompare(a)).map(([date,r])=>[date,r.visits,r.browsers.size,r.learn,r.exam,r.total,r.total?(r.score/r.total).toFixed(1):'']);
  },[results,visits]);
  function download() {
    const csv=[columns,...rows].map(row=>row.join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob(['\uFEFF',csv,'\r\n'],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`CBT-일별운영-${days}일-${rows[0][0]}.csv`;link.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="admin-panel"><div className="admin-panel-title"><h2>일별 방문과 제출</h2>
    <p>최근 {days}일에 조회한 방문 기록 최대 3,000건과 학습 결과 최대 1,000건을 한국 시간으로 집계합니다. 활동이 있는 날짜만 표시합니다.</p></div>
    <div className="admin-result-filters"><button type="button" disabled={!ready || !rows.length} onClick={download}>CSV 내려받기</button></div>
    <div className="admin-table-wrap"><table><thead><tr>{columns.map(col=><th key={col} scope="col">{col}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={row[0]}>{row.map((value,i)=><td key={i}>{value===''?'—':value}</td>)}</tr>)}
      {!rows.length && <tr><td colSpan={columns.length} className="empty-cell">표시할 기록이 없습니다.</td></tr>}</tbody></table></div>
  </section>;
}
