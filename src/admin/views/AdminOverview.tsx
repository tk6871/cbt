import type { AdminOverviewModel } from '../adminController';
import { lazy } from 'react';
import { OptionalTool } from '../../react/OptionalTool';
const AdminOverviewCharts = lazy(() => import('./AdminOverviewCharts'));
export function renderAdminOverview(m: AdminOverviewModel) {
  const {
    activeNow,
    activeVisitors,
    canManageIssues,
    formatDate,
    issueTypeLabel,
    locationLabel,
    openSection,
    recentOpenIssues,
    recentResults,
    resultModeLabel,
    results,
    viewLabel,
    visits,
  } = m;

  return (
    <>
      <section className="admin-overview">
        <section className="live-access-panel">
          <div className="live-access-heading">
            <div>
              <span className="admin-kicker">LIVE ACCESS</span>
              <h2>현재 접속 중</h2>
              <p>최근 3분 안에 활동 신호를 보낸 접속자입니다.</p>
            </div>
            <strong>
              <i />
              {activeNow}명 접속 중
            </strong>
          </div>
          {activeVisitors.length ? (
            <div className="live-visitor-grid">
              {activeVisitors.map((visitor) => (
                <article key={visitor.visitor_id} className="live-visitor-card">
                  <div className="live-visitor-top">
                    <span>
                      <i />
                      접속 중
                    </span>
                    <code>{visitor.ip_address || 'IP 확인 중'}</code>
                  </div>
                  <dl>
                    <div>
                      <dt>기기</dt>
                      <dd>
                        {visitor.device_type || '-'}
                        {' · '}
                        {visitor.browser || '-'}
                      </dd>
                    </div>
                    <div>
                      <dt>위치</dt>
                      <dd>{locationLabel(visitor)}</dd>
                    </div>
                    <div>
                      <dt>현재 화면</dt>
                      <dd>{viewLabel(visitor.last_path)}</dd>
                    </div>
                    <div>
                      <dt>마지막 신호</dt>
                      <dd>{formatDate(visitor.last_seen)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="live-access-empty">
              <i />
              <div>
                <strong>현재 활동 중인 접속자가 없습니다</strong>
                <span>일반 CBT를 열면 최대 3분 안에 표시됩니다.</span>
              </div>
            </div>
          )}
        </section>
        <OptionalTool title="관리자 통계 그래프"><AdminOverviewCharts results={results} visits={visits}/></OptionalTool>
        <div className="admin-overview-grid">
          {canManageIssues ? (
            <article className="admin-panel admin-compact-panel">
              <div className="admin-panel-title">
                <div>
                  <span>TO DO</span>
                  <h2>먼저 확인할 문제</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openSection('issues');
                  }}
                >
                  전체 보기
                </button>
              </div>
              {recentOpenIssues.length ? (
                <div className="admin-compact-list">
                  {recentOpenIssues.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => {
                        openSection('issues');
                      }}
                    >
                      <b>#{report.id}</b>
                      <span>
                        <strong>
                          {report.qualification || report.qualification_key}
                          {' · '}
                          {report.question_number}번
                        </strong>
                        <small>{report.issue_types.map(issueTypeLabel).join(' · ')}</small>
                      </span>
                      <time>{formatDate(report.created_at)}</time>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="admin-empty-note">대기 중인 문제 신고가 없습니다.</p>
              )}
            </article>
          ) : null}
          <article className="admin-panel admin-compact-panel">
            <div className="admin-panel-title">
              <div>
                <span>LATEST</span>
                <h2>최근 학습 결과</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  openSection('results');
                }}
              >
                전체 보기
              </button>
            </div>
            {recentResults.length ? (
              <div className="admin-result-list">
                {recentResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      openSection('results');
                    }}
                  >
                    <span>
                      <strong>{result.qualification || '-'}</strong>
                      <small>
                        {result.title || '-'}
                        {' · '}
                        {resultModeLabel(result.mode)}
                      </small>
                    </span>
                    <b>{result.score}점</b>
                    <time>{formatDate(result.completed_at)}</time>
                  </button>
                ))}
              </div>
            ) : (
              <p className="admin-empty-note">선택 기간의 학습 결과가 없습니다.</p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
