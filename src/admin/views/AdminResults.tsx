import type { AdminResultsModel } from '../adminController';
import {clsx as normalizeClass} from 'clsx';
export function renderAdminResults(m: AdminResultsModel) {
  const {
    dataError,
    filteredResults,
    formatDate,
    loadedDays,
    resultMode,
    resultModeLabel,
    resultPage,
    resultPagination,
    resultResponseLabel,
    resultSearch,
    results,
  } = m;

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-title">
          <span>SESSION RESULTS</span>
          <h2>최근 학습·CBT 결과</h2>
          <p>
            {'문제별 선택은 수집하지 않으며 '}
            {loadedDays}
            {'일 자료 '}
            {results.length}
            {'건 중 '}
            {filteredResults.length}건 표시. 미응답이 있어도 제출한 시험일 수 있습니다.
          </p>
        </div>
        <div className="admin-result-filters">
          <label>
            검색
            <input
              value={resultSearch}
              onChange={(event) => {
                m.resultSearch = event.currentTarget.value;
              }}
              type="search"
              placeholder="종목·회차·학습 범위"
            />
          </label>
          <label>
            모드
            <select
              value={resultMode}
              onChange={(event) => {
                m.resultMode = event.currentTarget.value as typeof resultMode;
              }}
            >
              <option value="all">전체</option>
              <option value="learn">학습</option>
              <option value="exam">CBT</option>
            </select>
          </label>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>제출 시각</th>
                <th>IP 주소</th>
                <th>종목</th>
                <th>학습 범위</th>
                <th>모드</th>
                <th>상태</th>
                <th>총점</th>
                <th>과목별 점수</th>
                <th>정답</th>
              </tr>
            </thead>
            <tbody>
              {resultPagination.rows.map((result) => (
                <tr key={result.id}>
                  <td>{formatDate(result.completed_at)}</td>
                  <td>
                    <code>{result.ip_address || '-'}</code>
                  </td>
                  <td>{result.qualification || '-'}</td>
                  <td>{result.title || '-'}</td>
                  <td>{resultModeLabel(result.mode)}</td>
                  <td>
                    <span
                      className={normalizeClass([result.unanswered_count ? 'exit-chip' : 'complete-chip'])}
                    >
                      {resultResponseLabel(result.unanswered_count)}
                    </span>
                  </td>
                  <td>
                    <strong className="score">{result.score}점</strong>
                  </td>
                  <td>
                    {result.subject_scores?.length ? (
                      <div className="subject-score-list">
                        {result.subject_scores.map((subject) => (
                          <span key={subject.subject}>
                            <b>{subject.subject}</b>
                            {subject.score}점
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td>
                    {result.correct_count}/{result.total_count}
                  </td>
                </tr>
              ))}
              {!filteredResults.length ? (
                <tr>
                  <td colSpan={9} className="empty-cell">
                    {dataError ? '조회 상태를 먼저 확인해 주세요.' : '조건에 맞는 학습·CBT 결과가 없습니다.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav aria-label="학습 결과 페이지" className="admin-result-pagination">
          <button
            type="button"
            disabled={resultPagination.page <= 1}
            onClick={() => {
              m.resultPage = resultPagination.page - 1;
            }}
          >
            이전
          </button>
          <span>
            {resultPagination.page}
            {' / '}
            {resultPagination.pageCount}
            {' · 50건씩'}
          </span>
          <button
            type="button"
            disabled={resultPagination.page >= resultPagination.pageCount}
            onClick={() => {
              m.resultPage = resultPagination.page + 1;
            }}
          >
            다음
          </button>
        </nav>
      </section>
    </>
  );
}
