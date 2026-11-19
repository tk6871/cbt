import {lazy} from 'react';
import {OptionalTool} from '../react/OptionalTool';
import {FollowupDesk} from './views/FollowupDesk';
import {MemberFollowups} from './views/MemberFollowups';
import {DailyReport} from './views/DailyReport';
import {renderAdminNavigation} from './views/AdminNavigation';
import {QualificationReport, renderIssueStatus} from './views/AdminReports';
import {Login} from './Login';
import {createAdminController} from './adminController';
import {useControllerView} from '../react/useControllerView';
import {renderAdminHeader, renderAdminPageHeading} from './views/AdminHeader';
import {renderAdminOverview} from './views/AdminOverview';
import {renderAdminIssues} from './views/AdminIssues';
import {renderAdminVisitors} from './views/AdminVisitors';
import {renderAdminResults} from './views/AdminResults';
import {renderAdminAccounts} from './views/AdminAccounts';

const BankInventory = lazy(() => import('./views/BankInventory'));

export function AdminApp() {
  return useControllerView(createAdminController, renderAdmin);
}

function renderAdmin(controller: ReturnType<typeof createAdminController>) {
  const a = controller.access;
  if (!a.configured) return <main className="admin-page"><section className="admin-auth-card setup-card">
    <span className="admin-kicker">ADMIN SETUP</span><h1>관리자 통계 연결이 꺼져 있습니다</h1>
    <p><code>cloud-config.js</code>에 Supabase 주소와 공개 키를 입력하고 <b>enabled</b>를 켜면 관리자 로그인이 활성화됩니다.</p>
    <a href="./관리자_방문기록_설정방법.txt">설정 방법 열기</a>
  </section></main>;
  if (!a.session) return <main className="admin-page"><div data-react-view="admin-login"><Login busy={a.loading} error={a.loginError} submit={a.submitCredentials}/></div></main>;
  return <main className="admin-page">
    <div data-react-view="admin-header" style={{display:'contents'}}>{renderAdminHeader(controller.adminHeaderModel)}</div>
    <div className="admin-layout">
      {renderAdminNavigation(controller.adminHeaderModel)}
      <div className="admin-content">
        {renderAdminPageHeading(controller.adminHeaderModel, a.canViewMembers && controller.adminAccountsModel.client &&
          <FollowupDesk writable={controller.adminAccountsModel.canManageMembers} key={a.session.user.id} client={controller.adminAccountsModel.client} home={a.activeSection==='overview'}/>)}
        {a.canManageIssues && a.activeSection === 'banks' && <OptionalTool title="문제은행 현황"><BankInventory/></OptionalTool>}
        {a.canViewAnalytics && a.activeSection === 'daily-report' && <DailyReport results={controller.adminOverviewModel.results}
          visits={controller.adminOverviewModel.visits} days={controller.adminHeaderModel.loadedDays}
          ready={Boolean(controller.adminHeaderModel.lastLoadedAt) && !controller.adminHeaderModel.dataLoading && !controller.adminHeaderModel.dataError}/>}
        {a.canViewAnalytics && a.activeSection === 'qualifications' && <QualificationReport results={controller.adminResultsModel.results}/>}
        {a.canManageIssues && a.activeSection === 'issue-status' && renderIssueStatus(controller.adminIssuesModel)}
        {a.canViewAnalytics && a.activeSection === 'overview' && <div data-react-view="admin-overview" style={{display:'contents'}}>{renderAdminOverview(controller.adminOverviewModel)}</div>}
        {a.canManageIssues && a.activeSection === 'issues' && <div data-react-view="admin-issues" style={{display:'contents'}}>{renderAdminIssues(controller.adminIssuesModel)}</div>}
        {a.canViewAnalytics && a.activeSection === 'visitors' && <div data-react-view="admin-visitors" style={{display:'contents'}}>{renderAdminVisitors(controller.adminVisitorsModel)}</div>}
        {a.canViewAnalytics && a.activeSection === 'results' && <div data-react-view="admin-results" style={{display:'contents'}}>{renderAdminResults(controller.adminResultsModel)}</div>}
        {a.canViewMembers && a.activeSection === 'member-followups' && controller.adminAccountsModel.client && <MemberFollowups
          key={[a.session.user.id,a.followupQueue,a.followupTarget].join(':')} target={a.followupTarget}
          initialOwner={a.followupQueue==='mine'?a.session.user.id:a.followupQueue==='unassigned'?'none':'all'}
          client={controller.adminAccountsModel.client} accounts={controller.adminAccountsModel.syncAccounts}
          writable={controller.adminAccountsModel.canManageMembers} loading={controller.adminAccountsModel.accountLoading}
          accountError={controller.adminAccountsModel.accountError} refreshAccounts={controller.adminAccountsModel.loadSyncAccounts}/>}
        {a.canViewMembers && a.activeSection === 'accounts' && <div data-react-view="admin-accounts" style={{display:'contents'}}>{renderAdminAccounts(controller.adminAccountsModel)}</div>}
      </div>
    </div>
  </main>;
}
