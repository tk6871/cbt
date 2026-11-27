import {lazy, Suspense, useState} from 'react';
import type { PatchViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
import { problemImage } from '../../cbt/problemImages';
const PatchSources = lazy(() => import('./PatchSources'));

export function renderPatchView(m: PatchViewModel) {
  return <PatchView model={m}/>;
}

function PatchView({model: m}: {model: PatchViewModel}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [version, setVersion] = useState('');
  const {
    androidApkUrl,
    checkForUpdate,
    currentVersion,
    openView,
    patchEntries,
    resumeSavedLearning,
    savedLearningSession,
    showAndroidApkPatchDownload,
    spaceName,
    updateChecking,
  } = m;

  return (
    <>
      <section className="patch-heading">
        <div>
          <span>RELEASE NOTES</span>
          <h1>
            {spaceName}
            {' 패치노트'}
          </h1>
          <p>새 기능과 수정 내용을 버전별로 확인할 수 있습니다.</p>
        </div>
        <div className="patch-version-actions">
          <strong>v{currentVersion}</strong>
          <button type="button" aria-expanded={sourcesOpen} aria-controls="patch-sources" onClick={() => setSourcesOpen(!sourcesOpen)}>출처</button>
          {savedLearningSession ? (
            <button type="button" onClick={resumeSavedLearning} className="resume-after-update">
              ▶ 저장한 문제 이어서 풀기
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              openView('showcase');
            }}
            className="feature-lab-entry"
          >
            ◉ 신기술 학습관 NEW
          </button>
          <button
            type="button"
            disabled={updateChecking}
            onClick={() => {
              checkForUpdate(true);
            }}
          >
            {updateChecking ? '확인 중…' : '최신 버전 확인'}
          </button>
        </div>
      </section>
      <div id="patch-sources" tabIndex={-1} hidden={!sourcesOpen}>
        {sourcesOpen && <Suspense fallback={<p role="status">출처를 불러오는 중…</p>}>
          <PatchSources entries={patchEntries} version={version} selectVersion={setVersion}/>
        </Suspense>}
      </div>
      {showAndroidApkPatchDownload ? (
        <section aria-labelledby="patch-apk-download-title" className="patch-apk-download">
          <div aria-hidden="true" className="android-app-mark">
            <svg viewBox="0 0 48 48" role="img">
              <path d="M15 18h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" />
              <path d="m16 18-3-5m19 5 3-5M18 12h12a4 4 0 0 1 4 4v2H14v-2a4 4 0 0 1 4-4Z" />
              <circle cx="19" cy="15" r="1.3" />
              <circle cx="29" cy="15" r="1.3" />
            </svg>
          </div>
          <div>
            <span>ANDROID APP</span>
            <strong id="patch-apk-download-title">휴대폰·태블릿용 정식 APK</strong>
            <small>Android 7.0 이상 · 기존 앱에서 업데이트할 수 있습니다.</small>
          </div>
          <a
            href={problemImage(androidApkUrl)}
            target="_blank"
            rel="noopener"
            aria-label="Android 전용 CBT 정식 APK 받기"
          >
            {'정식 APK 받기 '}
            <b aria-hidden="true">↓</b>
          </a>
        </section>
      ) : null}
      <div className="patch-timeline">
        {patchEntries.map((entry, index) => {
          const changes = <ul>{entry.changes.map((change) => <li key={change}>{change}</li>)}</ul>;
          return (
          <article
            key={`${entry.version}-${entry.date}-${entry.title}`}
            className={normalizeClass([{ latest: index === 0 }])}
          >
            <div className="patch-version">
              <span>v{entry.version}</span>
              <small>{entry.date}</small>
            </div>
            <div>
              <header>
                <h2>{entry.title}</h2>
                {index === 0 ? <b>최신</b> : null}
              </header>
              <p>{entry.summary}</p>
              <div className="patch-tags">
                {(entry.tags || []).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {entry.sources?.length ? <button type="button" className="patch-source-link" aria-controls="patch-sources" onClick={() => {
                setVersion(entry.version);
                setSourcesOpen(true);
                requestAnimationFrame(() => {
                  const panel = document.getElementById('patch-sources');
                  panel?.focus();
                  panel?.scrollIntoView({block: 'start'});
                });
              }}>v{entry.version} 자료 출처</button> : null}
              {entry.changes.length > 4 ? <details><summary>세부 변경 {entry.changes.length}건 보기</summary>{changes}</details> : changes}
            </div>
          </article>
        );})}
      </div>
    </>
  );
}
