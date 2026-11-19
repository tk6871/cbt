import type { AdminAccountsModel } from '../adminController';
import {clsx as normalizeClass} from 'clsx';
export function renderAdminAccounts(m: AdminAccountsModel) {
  const {
    accountError,
    accountLoading,
    accountSearch, accountPagination,
    adminAccess,
    canManageMembers,
    copyCredentials,
    displayedSyncAccounts,
    formatDate,
    isSuperAdmin,
    issueTemporaryPassword,
    issuedCredentials,
    loadSyncAccounts,
    roleSavingId,
    saveAccountRole,
  } = m;

  return (
    <>
      <section className="admin-panel account-panel">
        <div className="admin-panel-title account-panel-title">
          <div>
            <span>{'MEMBERS & ACCESS'}</span>
            <h2>회원 가입 목록과 관리자 권한</h2>
            <p>가입·최근 로그인 상태를 확인하고, 슈퍼 관리자는 업무별 권한을 나눠 줄 수 있습니다.</p>
          </div>
          <div className="account-panel-tools">
            <input
              value={accountSearch}
              onChange={(event) => {
                m.accountSearch = event.currentTarget.value;
              }}
              type="search"
              placeholder="아이디·이메일 검색"
            />
            <button
              type="button"
              disabled={accountLoading}
              onClick={() => {
                loadSyncAccounts();
              }}
            >
              {accountLoading ? '불러오는 중…' : '회원 새로고침'}
            </button>
          </div>
        </div>
        {accountError ? <p className="admin-account-message">{accountError}</p> : null}
        {issuedCredentials ? (
          <article className="issued-credentials">
            <div>
              <span>방금 발급한 로그인 정보</span>
              <strong>{issuedCredentials.username}</strong>
              <small>사용자가 임시 비밀번호로 로그인하면 설정 화면에서 새 비밀번호로 바꾸게 됩니다.</small>
            </div>
            <dl>
              <div>
                <dt>임시 비밀번호</dt>
                <dd>{issuedCredentials.temporaryPassword}</dd>
              </div>
              <div>
                <dt>새 복구코드</dt>
                <dd>{issuedCredentials.recoveryCode}</dd>
              </div>
            </dl>
            <button type="button" onClick={copyCredentials}>
              한 번에 복사
            </button>
          </article>
        ) : null}
        <div className="admin-table-wrap account-table-wrap">
          <table className="member-table">
            <thead>
              <tr>
                <th>회원</th>
                <th>가입</th>
                <th>최근 로그인</th>
                <th>역할</th>
                {isSuperAdmin ? <th>세부 권한</th> : null}
                <th>계정 처리</th>
              </tr>
            </thead>
            <tbody>
              {accountPagination.rows.map((account) => (
                <tr key={account.userId}>
                  <td className="member-identity">
                    <strong>{account.username}</strong>
                    <small>{account.accountType === 'site_id' ? '사이트 아이디' : account.email}</small>
                  </td>
                  <td>{formatDate(account.createdAt)}</td>
                  <td>{formatDate(account.lastSignInAt)}</td>
                  <td>
                    {isSuperAdmin ? (
                      <select
                        value={account.role || ''}
                        onChange={(event) => {
                          account.role = (event.currentTarget.value || null) as typeof account.role;
                        }}
                        disabled={account.userId === adminAccess?.userId}
                        className="role-select"
                      >
                        <option value="">일반 회원</option>
                        <option value="admin">관리자</option>
                        <option value="super_admin">슈퍼 관리자</option>
                      </select>
                    ) : (
                      <span className={normalizeClass(['role-chip', `is-${account.role || 'member'}`])}>
                        {account.role === 'super_admin'
                          ? '슈퍼 관리자'
                          : account.role === 'admin'
                            ? '관리자'
                            : '일반 회원'}
                      </span>
                    )}
                  </td>
                  {isSuperAdmin ? (
                    <td className="permission-cell">
                      {account.role ? (
                        <>
                          <label>
                            <input
                              checked={account.permissions.viewAnalytics}
                              onChange={(event) => {
                                account.permissions.viewAnalytics = event.currentTarget.checked;
                              }}
                              type="checkbox"
                              disabled={account.role === 'super_admin'}
                            />
                            통계
                          </label>
                          <label>
                            <input
                              checked={account.permissions.manageIssues}
                              onChange={(event) => {
                                account.permissions.manageIssues = event.currentTarget.checked;
                              }}
                              type="checkbox"
                              disabled={account.role === 'super_admin'}
                            />
                            문제 제보
                          </label>
                          <label>
                            <input
                              checked={account.permissions.viewMembers}
                              onChange={(event) => {
                                account.permissions.viewMembers = event.currentTarget.checked;
                              }}
                              type="checkbox"
                              disabled={account.role === 'super_admin'}
                            />
                            회원 조회
                          </label>
                          <label>
                            <input
                              checked={account.permissions.manageMembers}
                              onChange={(event) => {
                                account.permissions.manageMembers = event.currentTarget.checked;
                              }}
                              type="checkbox"
                              disabled={account.role === 'super_admin'}
                            />
                            회원 복구·메모 편집
                          </label>
                        </>
                      ) : (
                        <span>권한 없음</span>
                      )}
                      <button
                        type="button"
                        disabled={roleSavingId === account.userId || account.userId === adminAccess?.userId}
                        onClick={() => {
                          saveAccountRole(account);
                        }}
                      >
                        {roleSavingId === account.userId ? '저장 중' : '권한 저장'}
                      </button>
                    </td>
                  ) : null}
                  <td>
                    {account.accountType === 'site_id' && canManageMembers ? (
                      <button
                        type="button"
                        disabled={accountLoading}
                        onClick={() => {
                          issueTemporaryPassword(account);
                        }}
                        className="temp-password-button"
                      >
                        임시 비밀번호
                      </button>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                </tr>
              ))}
              {!accountLoading && !displayedSyncAccounts.length ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="empty-cell">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              ) : null}
              {accountLoading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="empty-cell">
                    회원 계정을 불러오는 중입니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav className="admin-result-pagination" aria-label="회원 목록 페이지">
          <span>검색 결과 {displayedSyncAccounts.length.toLocaleString()}명</span>
          <button type="button" disabled={accountPagination.page<=1} onClick={()=>{m.accountPage=accountPagination.page-1;}}>이전</button>
          <span>{accountPagination.page} / {accountPagination.pageCount}</span>
          <button type="button" disabled={accountPagination.page>=accountPagination.pageCount} onClick={()=>{m.accountPage=accountPagination.page+1;}}>다음</button>
        </nav>
      </section>
    </>
  );
}
