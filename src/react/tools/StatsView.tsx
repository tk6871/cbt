import type { StatsViewModel } from '../../cbt/studyController';
export function renderStatsView(m: StatsViewModel) {
  const { selectedCatalog, stats, subjectStats } = m;

  return (
    <>
      <section className="stats-hero">
        <div>
          <span>LEARNING REPORT</span>
          <h1>
            {selectedCatalog.name}
            {' 학습 통계'}
          </h1>
          <p>기존 CBT에서 푼 기록과 새 화면의 기록을 함께 표시합니다.</p>
        </div>
        <strong>
          {stats.accuracy}
          <small>%</small>
        </strong>
      </section>
      <section className="stats-grid">
        <article>
          <span>전체 문제</span>
          <strong>{stats.total.toLocaleString()}</strong>
          <small>수록 문항</small>
        </article>
        <article>
          <span>학습 문제</span>
          <strong>{stats.answered.toLocaleString()}</strong>
          <small>
            {'학습률 '}
            {stats.coverage}%
          </small>
        </article>
        <article>
          <span>맞힌 문제</span>
          <strong>{stats.correct.toLocaleString()}</strong>
          <small>최근 선택 기준</small>
        </article>
        <article>
          <span>복습 필요</span>
          <strong>{stats.wrong.toLocaleString()}</strong>
          <small>현재 오답</small>
        </article>
      </section>
      <section className="subject-report">
        <header>
          <div>
            <span>SUBJECT ANALYSIS</span>
            <h2>과목별 학습 현황</h2>
          </div>
          <small>최근 선택한 답 기준</small>
        </header>
        {subjectStats.map((row) => (
          <div key={row.subject} className="subject-row">
            <div>
              <strong>{row.subject}</strong>
              <span>
                {row.answered.toLocaleString()}/{row.total.toLocaleString()}
                문제 학습
              </span>
            </div>
            <div className="subject-bar">
              <i style={{ width: `${row.accuracy}%` }} />
            </div>
            <b>{row.accuracy}%</b>
          </div>
        ))}
      </section>
    </>
  );
}
