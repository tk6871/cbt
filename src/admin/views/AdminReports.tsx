import {useMemo, useState} from 'react';
import type {AdminIssuesModel, AdminResultsModel, QuestionIssueStatus} from '../adminController';

const statuses: QuestionIssueStatus[] = ['open','reviewing','resolved','deferred'];

export function renderIssueStatus(m: AdminIssuesModel) {
  const counts = {open:0, reviewing:0, resolved:0, deferred:0};
  for (const report of m.issueReports) counts[report.status]++;
  return <section className="admin-panel" aria-labelledby="issue-status-title">
    <div className="admin-panel-title"><h2 id="issue-status-title">상태별 제보</h2>
      <p>조회된 제보 {m.issueReports.length.toLocaleString()}건 · 상태를 선택하면 해당 제보 목록이 열립니다.</p>
    </div>
    <div className="admin-issue-counts">{statuses.map(status =>
      <button type="button" key={status} onClick={() => m.showIssues(status)}>
        <span>{m.issueStatusLabel(status)}</span><strong>{counts[status]}건</strong><span aria-hidden="true">›</span>
      </button>
    )}</div>
  </section>;
}

export function QualificationReport({results}: Pick<AdminResultsModel,'results'>) {
  const [mode, setMode] = useState('all');
  const rows = useMemo(() => {
    const groups = new Map<string,{count:number; score:number; complete:number}>();
    for (const item of results) {
      if (mode !== 'all' && item.mode !== mode) continue;
      const name = item.qualification?.trim() || '종목 미기재';
      const row = groups.get(name) || {count:0, score:0, complete:0};
      row.count++;
      row.score += item.score;
      if (!item.unanswered_count) row.complete++;
      groups.set(name,row);
    }
    return [...groups.entries()].sort(([a,x],[b,y]) => y.count - x.count || a.localeCompare(b,'ko'));
  },[results,mode]);
  return <section className="admin-panel" aria-labelledby="qualification-title">
    <div className="admin-panel-title"><h2 id="qualification-title">종목별 제출 결과</h2>
      <p>선택한 조회 기간에 제출된 결과의 평균 점수와 모든 문항에 응답한 횟수입니다.</p>
    </div>
    <div className="admin-result-filters"><label>풀이 모드
      <select value={mode} onChange={e => setMode(e.currentTarget.value)}>
        <option value="all">전체</option><option value="learn">학습</option><option value="exam">CBT</option>
      </select>
    </label></div>
    <div className="admin-table-wrap"><table><thead><tr>
      <th scope="col">종목</th><th scope="col">제출</th><th scope="col">평균 점수</th><th scope="col">전체 응답</th>
    </tr></thead><tbody>{rows.map(([name,row]) =>
      <tr key={name}><th scope="row">{name}</th><td>{row.count}건</td><td>{(row.score/row.count).toFixed(1)}점</td><td>{row.complete}건</td></tr>
    )}{!rows.length && <tr><td colSpan={4} className="empty-cell">조건에 맞는 제출 결과가 없습니다.</td></tr>}</tbody></table></div>
  </section>;
}
