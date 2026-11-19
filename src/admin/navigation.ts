import {generatePath, matchPath} from 'react-router';

export const adminPages = [
  {id:'overview', group:'운영', title:'운영 요약', permission:'viewAnalytics'},
  {id:'visitors', group:'운영', title:'접속 기록', permission:'viewAnalytics'},
  {id:'daily-report', group:'운영', title:'일별 운영 보고서', permission:'viewAnalytics'},
  {id:'issues', group:'문제 관리', title:'문제 제보', permission:'manageIssues'},
  {id:'issue-status', group:'문제 관리', title:'제보 처리 현황', permission:'manageIssues'},
  {id:'banks', group:'문제 관리', title:'문제은행 현황', permission:'manageIssues'},
  {id:'results', group:'학습 분석', title:'학습 결과', permission:'viewAnalytics'},
  {id:'qualifications', group:'학습 분석', title:'종목별 성적', permission:'viewAnalytics'},
  {id:'accounts', group:'회원 관리', title:'회원·권한', permission:'viewMembers'},
  {id:'member-followups', group:'회원 관리', title:'회원 후속 관리', permission:'viewMembers'},
] as const;

export type AdminPage = typeof adminPages[number];
export type AdminSection = AdminPage['id'];

export function adminSectionFromHash(hash: string) {
  const path = hash.split('?')[0]?.slice(1) || '';
  return matchPath('/admin/:section', path)?.params.section;
}

export function adminHref(id: AdminSection) {
  return '#' + generatePath('/admin/:section', {section:id});
}
