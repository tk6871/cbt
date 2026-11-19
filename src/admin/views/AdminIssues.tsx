import type { AdminIssuesModel } from '../adminController';
import {clsx as normalizeClass} from 'clsx';
import {lazy} from 'react';
import {OptionalTool} from '../../react/OptionalTool';
import {ReviewHistory} from '../ReviewHistory';
const AdminIssueWorkspace=lazy(()=>import('../AdminIssueWorkspace'));
export function renderAdminIssues(m: AdminIssuesModel) {
  const {
    canManageIssues,
    config,
    displayedIssueReports,
    exportIssueReports,
    formatDate,
    issueDrafts,
    issueFailed,
    issueImageUrl,
    issueMessages,
    issueSaving,
    issueSearch,
    issueStatusFilter,
    issueStatusLabel,
    issueTypeLabel,
    issueWorkspaceOpen,
    retryIssue,
    reviewToken,
    saveIssueNote,
    session,
    updateIssueReport,
  } = m;

  return (
    <>
      <section className="admin-panel issue-report-panel">
        {config?.reviewApiUrl && canManageIssues ? (
          <ReviewHistory key={session?.user.id} url={config.reviewApiUrl} token={reviewToken}/>
        ) : null}
        <div className="admin-panel-title issue-panel-title">
          <div>
            <span>QUESTION REVIEW QUEUE</span>
            <h2>이상 문제 관리</h2>
            <p>문제 파일을 수정할 때 JSON으로 내보내 그대로 대조할 수 있습니다.</p>
          </div>
          <div className="issue-panel-actions">
            <label>
              검색
              <input
                value={issueSearch}
                onChange={(event) => {
                  m.issueSearch = event.currentTarget.value;
                }}
                type="search"
                placeholder="종목·회차·문제·내용"
              />
            </label>
            <label>
              상태
              <select
                value={issueStatusFilter}
                onChange={(event) => {
                  m.issueStatusFilter = event.currentTarget.value as typeof issueStatusFilter;
                }}
              >
                <option value="open">대기</option>
                <option value="reviewing">확인 중</option>
                <option value="resolved">수정 완료</option>
                <option value="deferred">보류</option>
                <option value="all">전체</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!displayedIssueReports.length}
              onClick={() => {
                m.issueWorkspaceOpen = !issueWorkspaceOpen;
              }}
            >
              {issueWorkspaceOpen ? '기존 표 보기' : '집중 검토'}
            </button>
            <button type="button" disabled={!displayedIssueReports.length} onClick={exportIssueReports}>
              JSON 내보내기
            </button>
          </div>
        </div>
        {issueWorkspaceOpen ? (
          <OptionalTool title="문제 제보 집중 검토"><AdminIssueWorkspace
            {...{
              reports: displayedIssueReports,
              saving: {...issueSaving},
              drafts: {...issueDrafts},
              messages: {...issueMessages},
              failed: {...issueFailed},
              onClose: () => {
                m.issueWorkspaceOpen = false;
              },
              onExport: exportIssueReports,
              onUpdateStatus: (
                report: Parameters<typeof updateIssueReport>[0],
                status: typeof report.status,
              ) => updateIssueReport(report, { status }),
              onDraftNote: (id: number, note: string) => (issueDrafts[id] = note),
              onSaveNote: saveIssueNote,
              onRetry: retryIssue,
            }}
          /></OptionalTool>
        ) : (
          <div className="admin-table-wrap issue-table-wrap">
            <table className="issue-report-table">
              <thead>
                <tr>
                  <th>접수</th>
                  <th>문제</th>
                  <th>신고 유형·내용</th>
                  <th>문제 원문</th>
                  <th>처리 상태</th>
                  <th>관리자 메모</th>
                </tr>
              </thead>
              <tbody>
                {displayedIssueReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <strong>#{report.id}</strong>
                      <small>{formatDate(report.created_at)}</small>
                      <small>v{report.app_version || '-'}</small>
                    </td>
                    <td className="issue-question-cell">
                      <strong>{report.qualification || report.qualification_key}</strong>
                      <span>{report.round_title || report.round_id}</span>
                      <b>
                        {report.subject || '-'}
                        {' · '}
                        {report.question_number}번
                      </b>
                      <code>{report.question_id}</code>
                    </td>
                    <td className="issue-detail-cell">
                      <div>
                        {report.issue_types.map((type) => (
                          <span key={type}>{issueTypeLabel(type)}</span>
                        ))}
                      </div>
                      <p>{report.details}</p>
                    </td>
                    <td className="issue-source-cell">
                      <p>{report.question_text || '원문 이미지 문제'}</p>
                      {report.configured_answer ? (
                        <small>
                          {'설정 정답 '}
                          {report.configured_answer}번
                        </small>
                      ) : (
                        <small>서술형·정답 번호 없음</small>
                      )}
                      {issueImageUrl(report.source_image) ? (
                        <a href={issueImageUrl(report.source_image)} target="_blank" rel="noopener">
                          문제 이미지 열기
                        </a>
                      ) : null}
                    </td>
                    <td>
                      <select
                        value={report.status}
                        disabled={issueSaving[report.id]}
                        onChange={(event) => {
                          updateIssueReport(report, {
                            status: event.currentTarget.value as typeof report.status,
                          });
                        }}
                        className={normalizeClass(['issue-status-select', `is-${report.status}`])}
                      >
                        <option value="open">대기</option>
                        <option value="reviewing">확인 중</option>
                        <option value="resolved">수정 완료</option>
                        <option value="deferred">보류</option>
                      </select>
                      <small>{issueStatusLabel(report.status)}</small>
                    </td>
                    <td className="issue-note-cell">
                      <textarea
                        value={issueDrafts[report.id] ?? report.admin_note ?? ''}
                        rows={3}
                        maxLength={3000}
                        aria-label="관리자 메모"
                        placeholder="수정 파일·확인 결과 메모"
                        onChange={(event) => {
                          issueDrafts[report.id] = event.currentTarget.value;
                        }}
                        onBlur={() => {
                          saveIssueNote(report);
                        }}
                      />
                      <small role="status">
                        {issueSaving[report.id]
                          ? '저장 중…'
                          : issueMessages[report.id] || '입력 후 다른 곳을 누르면 저장'}
                      </small>
                      {issueFailed[report.id] ? (
                        <button
                          type="button"
                          disabled={issueSaving[report.id]}
                          onClick={() => {
                            retryIssue(report);
                          }}
                        >
                          다시 저장
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!displayedIssueReports.length ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      선택한 상태의 이상 문제 신고가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
