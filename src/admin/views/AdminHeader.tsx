import type {ReactNode} from 'react';
import type { AdminHeaderModel } from '../adminController';
import {clsx as normalizeClass} from 'clsx';
export function renderAdminHeader(m: AdminHeaderModel) {
  const {activeNow, canViewAnalytics, canManageIssues, activeSection, days, dataLoading, loadData, logout, realtimeStatus, realtimeLabel, session} = m;
  const periodApplies = ['overview','results','qualifications','daily-report'].includes(activeSection);
  if (!session) return null;
  return (
    <>
      <header className="admin-header"><i className="window-lights" aria-hidden="true"/>
        <div className="admin-brand">
          <span>CBT</span>
          <div>
            <strong>관리자 센터</strong>
            <small>운영 현황 한눈에 보기</small>
          </div>
        </div>
        <div className="admin-header-actions">
          {(canViewAnalytics || canManageIssues) && <div className={normalizeClass(['live-status', `is-${realtimeStatus}`])}>
            <i />
            <div>
              <strong>{realtimeLabel}</strong>
              {canViewAnalytics && <small>현재 {activeNow}명</small>}
            </div>
          </div>}
          {periodApplies && canViewAnalytics && <label>
            조회 기간
            <select
              value={days}
              onChange={(event) => {
                m.days = Number(event.currentTarget.value);
                loadData();
              }}
            >
              <option value={7}>7일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
            </select>
          </label>}
          {!['accounts','member-followups','banks'].includes(activeSection) && <button
            onClick={() => {
              loadData();
            }}
            disabled={dataLoading}
          >
            {dataLoading ? '불러오는 중' : '새로고침'}
          </button>}
          <button onClick={logout} className="logout-button">
            로그아웃
          </button>
        </div>
      </header>
    </>
  );
}

export function renderAdminPageHeading(m: AdminHeaderModel, desk: ReactNode) {
  const {session, allowedPages, activeSection, isSuperAdmin, dataError, lastLoadedAt, formatDate, loadedDays, dataLoading,
    canViewAnalytics, canManageIssues, activeNow, activeToday, answeredTotal, completedResultCount, interruptedResultCount,
    averageScore, results, openIssueCount, openSection} = m;
  const page = allowedPages.find(item => item.id === activeSection);
  if (!page || !session) return null;
  return <>
      <section className="admin-intro">
        <div className="admin-intro-copy">
          <span className="admin-kicker">{page.group}</span>
          <h1 id="admin-page-title" tabIndex={-1}>{page.title}</h1>
        </div>
        <div className="admin-account">
          <span>{isSuperAdmin ? '슈퍼 관리자' : '권한 관리자'}</span>
          <strong>{session.user.user_metadata?.sync_username || session.user.email}</strong>
          <small>{isSuperAdmin ? '모든 운영 권한과 관리자 지정 권한' : '허용된 업무만 표시됩니다.'}</small>
        </div>
      </section>
      {desk}
      {dataError && activeSection !== 'banks' ? (
        <p role="alert" className="admin-error admin-data-error">
          {dataError}
        </p>
      ) : null}
      {(activeSection !== 'overview' || canViewAnalytics) && !['accounts','member-followups','banks'].includes(activeSection) && <p role="status" className="admin-data-scope">
        {lastLoadedAt
          ? `마지막 조회 ${formatDate(lastLoadedAt)}`
          : dataLoading
            ? '운영 기록을 불러오는 중입니다.'
            : '아직 조회된 운영 기록이 없습니다.'}
        <span>{canViewAnalytics && ['overview','results','qualifications','daily-report'].includes(activeSection) ? `최근 ${loadedDays}일 · 최대 학습 결과 1,000건` : activeSection === 'visitors' ? '최근 접속 브라우저 최대 300개' : '최근 문제 제보 최대 1,000건'}</span>
      </p>}
      {canViewAnalytics && activeSection === 'overview' ? (
        <section aria-label="핵심 운영 지표" className="admin-stats">
          <button
            type="button"
            onClick={() => {
              openSection('overview');
            }}
            className="admin-stat-card live-card"
          >
            <span>현재 접속</span>
            <strong>
              {activeNow.toLocaleString()}
              <b>명</b>
            </strong>
            <small>최근 3분 활동</small>
          </button>
          <button
            type="button"
            onClick={() => {
              openSection('visitors');
            }}
            className="admin-stat-card"
          >
            <span>오늘 방문자</span>
            <strong>{activeToday.toLocaleString()}</strong>
            <small>고유 브라우저</small>
          </button>
          <button
            type="button"
            onClick={() => {
              openSection('results');
            }}
            className="admin-stat-card"
          >
            <span>채점된 답안</span>
            <strong>{answeredTotal.toLocaleString()}</strong>
            <small>선택 기간 합계</small>
          </button>
          <button
            type="button"
            onClick={() => {
              openSection('results');
            }}
            className="admin-stat-card"
          >
            <span>전체 응답 결과</span>
            <strong>{completedResultCount.toLocaleString()}</strong>
            <small>
              {'미응답 포함 '}
              {interruptedResultCount}건
            </small>
          </button>
          <button
            type="button"
            onClick={() => {
              openSection('results');
            }}
            className="admin-stat-card"
          >
            <span>평균 점수</span>
            <strong>
              {averageScore}
              <b>점</b>
            </strong>
            <small>{results.length}건 기준</small>
          </button>
          {canManageIssues ? (
            <button
              type="button"
              onClick={() => {
                openSection('issues');
              }}
              className="admin-stat-card issue-stat-card"
            >
              <span>확인 대기</span>
              <strong>
                {openIssueCount.toLocaleString()}
                <b>건</b>
              </strong>
              <small>이상 문제 신고</small>
            </button>
          ) : null}
        </section>
      ) : null}
    </>;
}
