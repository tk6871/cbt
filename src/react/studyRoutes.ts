import { generatePath, matchRoutes } from 'react-router';

export const studyViews = [
  'home', 'rounds', 'school', 'history', 'wrong', 'search', 'calculation', 'guide',
  'coach', 'beta', 'showcase', 'stats', 'updates', 'settings',
] as const;
export type StudyView = typeof studyViews[number];

const routePath = '/study/:view';
const routes = [{ path: routePath }];

export function isStudyView(value: unknown): value is StudyView {
  return studyViews.some(view => view === value);
}
export function viewFromHash(hash: string): StudyView | undefined {
  if (!hash.startsWith('#/study/')) return;
  const view = matchRoutes(routes, hash.slice(1))?.[0]?.params.view;
  return isStudyView(view) ? view : undefined;
}
export function studyHref(view: StudyView): string {
  const url = new URL(location.href);
  if (url.hash && !viewFromHash(url.hash)) return url.href;
  url.hash = view === 'home' ? '' : generatePath(routePath, { view });
  return url.href;
}
