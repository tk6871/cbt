import type { CSSProperties } from 'react';
import type { CoachViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
export function renderCoachView(m: CoachViewModel) {
  const {
    coachAnswered,
    coachConfidence,
    coachCoverage,
    coachHasEvidence,
    coachHasUnmeasuredSubjects,
    coachPlans,
    coachSubjectRows,
    displayedPassChance,
    dueRows,
    officialExamRecords,
    passChance,
    predictedScore,
    recentExamAverage,
    reviewSchedule,
    selectedCatalog,
    startCoachPlan,
    startCoachSubject,
    yearFrom,
    yearTo,
  } = m;

  return (
    <>
      <section className="coach-hero">
        <div className="coach-aurora coach-aurora-one" />
        <div className="coach-aurora coach-aurora-two" />
        <div aria-hidden="true" className="coach-orbit">
          <i />
          <i />
          <i />
        </div>
        <div className="coach-hero-copy">
          <span className="coach-kicker">
            <b>✦</b>
            {' PASS INTELLIGENCE 2.0'}
          </span>
          <h1>
            기록이 쌓일수록
            <br />
            <em>합격 전략이 선명해집니다</em>
          </h1>
          <p>
            {selectedCatalog.name}
            {' · '}
            {yearFrom}~{yearTo}년 기록을 분석해 지금 가장 점수가 오를 문제를 고릅니다.
          </p>
          <div className="coach-hero-badges">
            <span>
              {'학습 '}
              {coachAnswered.toLocaleString()}
              문제
            </span>
            <span>
              {'분석 신뢰도 '}
              {coachConfidence}
            </span>
            <span
              className={normalizeClass([
                { danger: coachHasEvidence && coachSubjectRows.some((row) => row.risk) },
              ])}
            >
              {!coachHasEvidence
                ? '기록을 쌓으면 분석합니다'
                : coachSubjectRows.some((row) => row.risk)
                  ? '과락 위험 감지'
                  : coachHasUnmeasuredSubjects
                    ? '아직 풀지 않은 과목 있음'
                    : '과락 위험 안정'}
            </span>
          </div>
        </div>
        <div className="coach-gauge-wrap">
          <div
            style={{ '--coach-angle': `${displayedPassChance * 3.6}deg` } as CSSProperties}
            className="coach-gauge"
          >
            <div>
              <span>예상 합격 가능성</span>
              <strong>
                {coachHasEvidence ? displayedPassChance : '—'}
                {coachHasEvidence ? <small>%</small> : null}
              </strong>
              <b>
                {!coachHasEvidence
                  ? '학습 후 분석'
                  : passChance >= 70
                    ? '합격권'
                    : passChance >= 40
                      ? '상승 구간'
                      : '진단·보강 필요'}
              </b>
            </div>
          </div>
          <small>학습 기록 기반 추정치 · 실제 결과를 보장하지 않음</small>
        </div>
      </section>
      <section className="coach-overview">
        <article className="coach-panel coach-score-panel">
          <header>
            <div>
              <span>READINESS SIGNAL</span>
              <h2>현재 시험 준비도</h2>
            </div>
            <b>{coachConfidence}</b>
          </header>
          <div className="coach-metric-grid">
            <div>
              <span>예상 점수</span>
              <strong>
                {coachHasEvidence ? predictedScore : '—'}
                {coachHasEvidence ? <small>점</small> : null}
              </strong>
              <i style={{ width: `${coachHasEvidence ? predictedScore : 0}%` }} />
            </div>
            <div>
              <span>선택 범위 학습률</span>
              <strong>
                {coachCoverage}
                <small>%</small>
              </strong>
              <i style={{ width: `${coachCoverage}%` }} />
            </div>
            <div>
              <span>지금 복습</span>
              <strong>
                {dueRows.length}
                <small>문제</small>
              </strong>
              <i style={{ width: `${Math.min(100, dueRows.length * 5)}%` }} />
            </div>
            <div>
              <span>최근 모의평균</span>
              <strong>
                {recentExamAverage ?? '—'}
                <small>{recentExamAverage === null ? '' : '점'}</small>
              </strong>
              <i style={{ width: `${recentExamAverage || 0}%` }} />
            </div>
          </div>
          <p>
            정답률, 반복 횟수, 마지막 정오답, 경과 시간, 과목별 과락 위험과 최근 시험 점수를 함께 계산합니다.
          </p>
        </article>
        <article className="coach-panel coach-trend-panel">
          <header>
            <div>
              <span>EXAM TRAJECTORY</span>
              <h2>최근 시험 흐름</h2>
            </div>
            <b>{officialExamRecords.length}회</b>
          </header>
          {officialExamRecords.length ? (
            <div className="coach-trend-chart">
              {[...officialExamRecords.slice(0, 7)].reverse().map((record) => (
                <div key={record.id}>
                  <span
                    style={{ height: `${Math.max(8, record.score)}%` }}
                    className={normalizeClass([{ pass: record.passed }])}
                  >
                    <b>{record.score}</b>
                  </span>
                  <time>
                    {new Date(record.finishedAt).toLocaleDateString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </time>
                </div>
              ))}
              <i className="coach-pass-line">
                <span>60점</span>
              </i>
            </div>
          ) : (
            <div className="coach-empty-trend">
              <span>◎</span>
              <strong>아직 모의시험 기록이 없습니다</strong>
              <small>문제를 풀면 점수와 복습할 과목을 여기서 확인할 수 있습니다.</small>
              <button
                type="button"
                onClick={() => {
                  startCoachPlan('exam');
                }}
              >
                첫 진단시험 시작
              </button>
            </div>
          )}
        </article>
      </section>
      <section className="coach-action-section">
        <header>
          <div>
            <span>ADAPTIVE TRAINING</span>
            <h2>지금 점수가 가장 빨리 오르는 훈련</h2>
          </div>
          <p>현재 기록을 기준으로 문제 순서가 자동으로 다시 계산됩니다.</p>
        </header>
        <div className="coach-plan-grid">
          {coachPlans.map((plan) => (
            <button
              key={plan.key}
              type="button"
              disabled={!plan.count}
              onClick={() => {
                startCoachPlan(plan.key);
              }}
              className={normalizeClass(['coach-plan', `coach-plan-${plan.tone}`])}
            >
              <span>{plan.eyebrow}</span>
              <strong>{plan.title}</strong>
              <p>{plan.description}</p>
              <footer>
                <b>
                  {plan.count}
                  문제
                </b>
                <em>시작하기 →</em>
              </footer>
            </button>
          ))}
        </div>
      </section>
      <section className="coach-detail-grid">
        <article className="coach-panel coach-subject-panel">
          <header>
            <div>
              <span>SUBJECT SHIELD</span>
              <h2>과목별 과락 방어선</h2>
            </div>
            <small>40점 미만 위험 표시</small>
          </header>
          <div className="coach-subject-list">
            {coachSubjectRows.map((row) => (
              <button
                key={row.subject}
                type="button"
                onClick={() => {
                  startCoachSubject(row.subject);
                }}
                className={normalizeClass(['coach-subject-card', { risk: row.risk }])}
              >
                <div>
                  <span>{!row.answered ? '미진단' : row.risk ? '위험' : '안정'}</span>
                  <strong>{row.subject}</strong>
                  <small>
                    {row.answered}/{row.total}
                    {'문제 학습 · '}
                    {row.answered ? `숙련도 ${row.mastery}%` : '학습 후 분석'}
                  </small>
                </div>
                <div
                  style={
                    { '--readiness-angle': `${row.answered ? row.predicted * 3.6 : 0}deg` } as CSSProperties
                  }
                  className="coach-readiness-ring"
                >
                  <strong>{row.answered ? row.predicted : '—'}</strong>
                  <small>예상점수</small>
                </div>
              </button>
            ))}
          </div>
        </article>
        <article className="coach-panel coach-memory-panel">
          <header>
            <div>
              <span>MEMORY QUEUE</span>
              <h2>망각곡선 복습 대기열</h2>
            </div>
            <small>문제를 풀 때마다 자동 변경</small>
          </header>
          <div className="coach-review-schedule">
            {reviewSchedule.map((bucket) => (
              <div key={bucket.label} className={normalizeClass([`review-${bucket.tone}`])}>
                <span>
                  <i />
                  {bucket.label}
                </span>
                <strong>
                  {bucket.count}
                  <small>문제</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="coach-memory-note">
            <b>작동 방식</b>
            <p>
              맞히고 반복할수록 복습 간격을 늘리고, 틀리면 오늘 대기열 맨 앞으로 되돌립니다. 인터넷 없이도 이
              기기의 기록으로 계속 계산합니다.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}
