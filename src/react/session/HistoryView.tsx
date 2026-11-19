import type { HistoryViewModel } from '../../cbt/studyController';

export function renderHistoryView(m: HistoryViewModel) {
  const {
    openView,
    recentExamRecords,
    replayHistoryRecord,
    resumeSavedLearning,
    savedLearningSession,
    selectedCatalog,
  } = m;
  return (
    <>
      <section className="tool-hero history-hero">
        <div>
          <span>LEARNING HISTORY</span>
          <h1>풀었던 문제와 이어할 학습</h1>
          <p>
            {selectedCatalog.name}
            {' · 최근 완료 기록 '}
            {recentExamRecords.length}개
          </p>
        </div>
        {savedLearningSession ? (
          <button type="button" onClick={resumeSavedLearning}>
            마지막 학습 이어하기
          </button>
        ) : null}
      </section>
      <nav aria-label="복습 도구" className="history-tools">
        <button type="button" onClick={()=>openView('wrong')}>오답 노트</button>
        <button type="button" onClick={()=>openView('coach')}>취약 과목 복습</button>
        <button type="button" onClick={()=>openView('stats')}>학습 분석</button>
      </nav>
      {savedLearningSession ? (
        <section className="history-resume-card">
          <div>
            <span>
              {'진행 중 · '}
              {savedLearningSession.mode === 'exam' ? 'CBT 시험' : '학습'}
            </span>
            <strong>{savedLearningSession.title}</strong>
            <small>
              {new Date(savedLearningSession.savedAt).toLocaleString('ko-KR')}
              {' · '}
              {Object.keys(savedLearningSession.answers).length}/{savedLearningSession.itemIds.length}
              문제
            </small>
          </div>
          <button type="button" onClick={resumeSavedLearning}>
            이어서 풀기
          </button>
        </section>
      ) : null}
      {recentExamRecords.length ? (
        <div className="history-grid">
          {recentExamRecords.map((record) => (
            <article key={record.id}>
              <header>
                <span>{record.mode === 'exam' ? 'CBT 시험' : '학습모드'}</span>
                <time>{new Date(record.finishedAt).toLocaleString('ko-KR')}</time>
              </header>
              <h2>{record.title}</h2>
              <div>
                <strong>{record.score}점</strong>
                <span>
                  {record.answered}/{record.total}
                  문제 풀이
                </span>
                <span>
                  {'오답 '}
                  {record.wrongAnswers?.length || 0}개
                </span>
              </div>
              <footer>
                <button
                  type="button"
                  onClick={() => {
                    replayHistoryRecord(record);
                  }}
                >
                  같은 문제 다시 풀기
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : !savedLearningSession ? (
        <section className="empty-state">
          <span>◴</span>
          <h2>아직 학습 내역이 없습니다</h2>
          <p>회차별 문제나 연도별 학습을 시작하면 여기에 날짜·점수·문제 수가 기록됩니다.</p>
          <button
            onClick={() => {
              openView('rounds');
            }}
          >
            회차 선택하기
          </button>
        </section>
      ) : null}
    </>
  );
}
