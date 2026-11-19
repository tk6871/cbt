import type { AdminVisitorsModel } from '../adminController';
export function renderAdminVisitors(m: AdminVisitorsModel) {
  const { formatDate, locationDetail, locationLabel, realtimeUpdatedAt, shortId, visitors, displayedVisitors } = m;

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-title">
          <span>RECENT VISITORS</span>
          <h2>최근 접속 IP</h2>
          <p>
            {visitors.length}
            {'개 브라우저 · 마지막 실시간 반영 '}
            {formatDate(realtimeUpdatedAt)}
          </p>
        </div>
        <div className="admin-result-filters"><label>접속 기록 검색
          <input type="search" placeholder="IP·방문자 ID·기기·브라우저·위치" value={m.visitorSearch}
            onChange={event => {m.visitorSearch = event.currentTarget.value;}}/>
        </label><span role="status">{displayedVisitors.length}개 표시</span></div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>최근 접속</th>
                <th>IP 주소</th>
                <th>추정 위치</th>
                <th>방문자 ID</th>
                <th>기기</th>
                <th>접속</th>
                <th>제출 결과</th>
                <th>최근/최고 점수</th>
              </tr>
            </thead>
            <tbody>
              {displayedVisitors.map((visitor) => (
                <tr key={visitor.visitor_id}>
                  <td>{formatDate(visitor.last_seen)}</td>
                  <td>
                    <code>{visitor.ip_address || '-'}</code>
                  </td>
                  <td className="location-cell">
                    <strong>{locationLabel(visitor)}</strong>
                    <small>{locationDetail(visitor)}</small>
                  </td>
                  <td title={visitor.visitor_id}>{shortId(visitor.visitor_id)}</td>
                  <td>
                    {visitor.device_type || '-'}
                    {' · '}
                    {visitor.browser || '-'}
                  </td>
                  <td>{visitor.visit_count}</td>
                  <td>{visitor.exam_count}</td>
                  <td>
                    {visitor.last_score ?? '-'}
                    {' / '}
                    {visitor.best_score ?? '-'}
                  </td>
                </tr>
              ))}
              {!displayedVisitors.length ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    {m.visitorSearch.trim() ? '검색 결과가 없습니다.' : '아직 수집된 방문 기록이 없습니다.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
