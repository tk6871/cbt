import {adminHref} from '../navigation';
import type {AdminHeaderModel} from '../adminController';

export function renderAdminNavigation(m: AdminHeaderModel) {
  const groups = Array.from(new Set(m.allowedPages.map(page => page.group)));
  return <nav className="admin-directory" aria-label="관리자 화면 구역">
    <label className="admin-mobile-directory">관리자 목차
      <select value={m.activeSection} onChange={e => {
        const page = m.allowedPages.find(item => item.id === e.currentTarget.value);
        if (page) m.openSection(page.id);
      }}>
        {groups.map(group => <optgroup key={group} label={group}>
          {m.allowedPages.filter(page => page.group === group).map(page => <option key={page.id} value={page.id}>{page.title}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="admin-desktop-directory">{groups.map(group => <div className="admin-menu-group" key={group}>
      <h2>{group}</h2>
      {m.allowedPages.filter(page => page.group === group).map(page =>
        <a key={page.id} href={adminHref(page.id)} aria-current={m.activeSection === page.id ? 'page' : undefined}>
          <i aria-hidden="true" className={'admin-tab-icon icon-'+page.id}/>{page.title}
        </a>)}
    </div>)}</div>
  </nav>;
}
