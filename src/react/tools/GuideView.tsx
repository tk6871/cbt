import {lazy,Suspense} from 'react';
import type { GuideViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
import { problemImage } from '../../cbt/problemImages';
const PracticalSearchLibrary = lazy(()=>import('../practical/PracticalSearchLibrary'));
const PracticalCalculationLesson = lazy(()=>import('../practical/PracticalCalculationLesson'));
const PracticalLoadMore = lazy(()=>import('../practical/PracticalLoadMore'));
const PracticalFractionLines = lazy(()=>import('../practical/PracticalFractionLines'));
const PracticalProblemImage = lazy(()=>import('../practical/PracticalProblemImage'));
const MathFormula = lazy(()=>import('../practical/MathFormula'));
const PracticalCalculationLibrary = lazy(()=>import('../practical/PracticalCalculationLibrary'));
const PracticalTrainingTools = lazy(()=>import('../practical/PracticalTrainingTools'));
const PracticalIssueReport = lazy(()=>import('../practical/PracticalIssueReport'));
export function renderGuideView(m: GuideViewModel) {
  const {
    activeStudyGuide,
    calculationLesson,
    changePracticalPage,
    closePracticalMock,
    finishPracticalMock,
    formatPracticalSession,
    formatPracticalTime,
    hvacFieldReportRelatedGroups,
    hvacPracticalAvailable,
    jumpPracticalIndex,
    jumpPracticalUnanswered,
    markPracticalPrompt,
    openCalculator,
    openPracticalCalculations,
    openPracticalLibrary,
    openPracticalMaterial,
    openPracticalRound,
    openPracticalSearchResults,
    openView,
    practicalAbsoluteTemperatureExample,
    practicalAdaptiveLabel,
    practicalAnswerRevealed,
    practicalBatchOptions,
    practicalCalculationCount,
    practicalCalculationPdf,
    practicalCategoryFilter,
    practicalCategoryLabels,
    practicalCategoryOptions,
    practicalContinuous,
    practicalContinuousLimit,
    practicalDifficultyLabels,
    practicalDisplayChoice,
    practicalDraftClosedIds,
    practicalDrafts,
    practicalExamLocked,
    practicalGradeLabel,
    practicalGroupCounts,
    practicalGroupLabel,
    practicalGuideSection,
    practicalHasAnswer,
    practicalHelperIds,
    practicalLatestRound,
    practicalLayout,
    practicalLibraryOpen,
    practicalLibraryTab,
    practicalListNumber,
    practicalMasteredCount,
    practicalMaterialPeriod,
    practicalMistakeLabel,
    practicalNavigatorOpen,
    practicalOptionsOpen,
    practicalPage,
    practicalPageCount,
    practicalPageSize,
    practicalPagedPrompts,
    practicalPartialCount,
    practicalPatternResume,
    practicalPatternSummary,
    practicalPeriodAvailable,
    practicalProgress,
    practicalPromptFilter,
    practicalPrompts,
    practicalProvidedCount,
    practicalReviewCount,
    practicalRoundSummaries,
    practicalRoundYears,
    practicalSearch,
    practicalSelectionLabel,
    practicalSessionActive,
    practicalSessionFinished,
    practicalSessionGradedCount,
    practicalSessionIds,
    practicalSessionPattern,
    practicalSessionRemainingSeconds,
    practicalSessionReport,
    practicalSessionScore,
    practicalSessionTotalPoints,
    practicalSiBasics,
    practicalSimilarCount,
    practicalSolving,
    practicalSourcePrompt,
    practicalSources,
    practicalStudyMode,
    practicalViewedAnswerIds,
    printPracticalSheet,
    replacePracticalDraft,
    resumePracticalPatternMock,
    selectedKey,
    settingsOpen,
    showPracticalReview,
    startHvacFieldReportPractice,
    startPracticalDaily,
    startPracticalMock,
    startPracticalPatternMock,
    startPracticalRelated,
    togglePracticalAnswer,
    updatePracticalAssessment,
    updatePracticalDraft,
    visiblePracticalPrompts,
  } = m;
  if (!activeStudyGuide) return null;
  return (
    <>
      {hvacPracticalAvailable && !practicalSolving ? (
        <nav aria-label="시험 자료실 구분" className="practical-guide-tabs">
          <button
            type="button"
            onClick={() => {
              m.practicalGuideSection = 'practice';
            }}
            className={normalizeClass([{ active: practicalGuideSection === 'practice' }])}
          >
            필답형 문제풀이
          </button>
          <button
            type="button"
            onClick={() => {
              m.practicalGuideSection = 'theory';
            }}
            className={normalizeClass([{ active: practicalGuideSection === 'theory' }])}
          >
            필기 공식·자료
          </button>
        </nav>
      ) : null}
      {!hvacPracticalAvailable || practicalGuideSection === 'theory' ? (
        <>
          <section className="tool-hero guide-hero">
            <div>
              <span>{activeStudyGuide.kicker}</span>
              <h1>{activeStudyGuide.title}</h1>
              <p>{activeStudyGuide.description}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                openView('calculation');
              }}
            >
              계산문제로 연습 →
            </button>
          </section>
          <section className="guide-notice">
            <strong>사용법</strong>
            <p>{activeStudyGuide.notice}</p>
          </section>
          {activeStudyGuide.formulas.length ? (
            <section className="study-formula-grid">
              {activeStudyGuide.formulas.map((formula) => (
                <article key={formula.label}>
                  <span>{formula.label}</span>
                  <Suspense fallback={null}><MathFormula {...{ tex: formula.tex, label: formula.label }}/></Suspense>
                  <p>{formula.note}</p>
                </article>
              ))}
            </section>
          ) : null}
          {selectedKey === 'hvac' || selectedKey === 'hvac-hansol' ? (
            <section className="field-report-practice">
              <div className="field-report-copy">
                <span>2026.08.22 · 비공식 실전 제보</span>
                <h2>제보 키워드로 만든 13문제</h2>
                <p>
                  정확한 원문이 아닌 수험생 기억을 바탕으로 재구성했습니다. 저장소의 반복 기출과 대조한 개념만
                  문제로 만들었고, 문장이 불분명한 내용은 확정 정답처럼 단정하지 않았습니다.
                </p>
                <div className="field-report-stats">
                  <strong>13문제</strong>
                  <span>공기조화 · 냉동 · 설치운영</span>
                  <span>정답 뒤 쉬운 해설</span>
                </div>
                <button type="button" onClick={startHvacFieldReportPractice}>
                  0822 실전 제보 문제 풀기 →
                </button>
              </div>
              <div className="field-report-related">
                <strong>저장소에서 찾은 유사 기출</strong>
                <ul>
                  {hvacFieldReportRelatedGroups.map((group) => (
                    <li key={group.topic}>
                      <b>{group.topic}</b>
                      <span>{group.matches}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {hvacPracticalAvailable && practicalGuideSection === 'practice' ? (
        <section
          className={normalizeClass([
            'practical-study-room',
            {
              'practical-cbt-layout': practicalLayout === 'cbt',
              'practical-multi-layout': practicalLayout === 'list',
            },
          ])}
        >
          <header className="practical-room-header">
            {!practicalLibraryOpen || practicalSessionActive ? (
              <button
                type="button"
                onClick={() => {
                  practicalSessionActive ? closePracticalMock() : openPracticalLibrary();
                }}
                className="practical-library-back"
              >
                ← 회차·자료 목록
              </button>
            ) : null}
            <div>
              <span>WRITTEN CBT</span>
              <h2>
                {practicalLibraryOpen && !practicalSessionActive
                  ? '공조냉동 실기 필답형 훈련관'
                  : practicalSelectionLabel}
              </h2>
              <p>
                {practicalLibraryOpen && !practicalSessionActive
                  ? '풀 자료를 고른 뒤 문제 화면으로 들어갑니다. 회차와 별도 PDF 자료의 진도를 각각 이어서 볼 수 있습니다.'
                  : `${practicalPagedPrompts.length}문제 · 작성한 답안과 채점 기록은 자동 저장됩니다.`}
              </p>
            </div>
            {!practicalSolving ? (
              <strong>
                {practicalPrompts.length}
                문제
              </strong>
            ) : (
              <nav aria-label="필답형 풀이 설정" className="practical-room-actions">
                <button type="button" onClick={openCalculator}>
                  계산기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.settingsOpen = true;
                  }}
                >
                  설정
                </button>
              </nav>
            )}
          </header>
          {practicalLibraryOpen && !practicalSessionActive ? (
            <section aria-label="복원 비율 실전" className="practical-pattern-start">
              <div>
                <strong>실제 복원 구성으로 랜덤 12문제</strong>
                <p>
                  2023년 3회~2026년 2회 9회차의 유형 비율에 맞춰 최근 기출·추가자료·과거 기출 사진문제를
                  섞습니다. 추가자료는 매번1문제 이상 포함하며 같은 문항은 중복 출제하지 않습니다.
                </p>
                <small>
                  추가자료 PDF·사진·공개·연습 포함 · 90분 · 문제별 풀이 확인 가능 · 학습용60점 · 제출 후
                  자가채점 · 공식 출제비율이나 채점표가 아닙니다.
                </small>
              </div>
              <div className="practical-pattern-actions">
                {practicalPatternResume.pattern ? (
                  <button type="button" onClick={resumePracticalPatternMock}>
                    {practicalPatternResume.finished ? '마지막 실전 답안·채점 보기' : '마지막 실전 이어풀기'}
                  </button>
                ) : null}
                <button type="button" onClick={startPracticalPatternMock}>
                  복원 비율 실전 시작
                </button>
                {practicalPatternResume.pattern && !practicalPatternResume.finished ? (
                  <small>목록에 있어도 제한 시간은 계속 흐릅니다.</small>
                ) : null}
              </div>
            </section>
          ) : null}
          {practicalLibraryOpen && !practicalSessionActive ? (
            <details className="practical-overview">
              <summary>학습 현황 · 일반 랜덤 · 자료 출처</summary>
              <div className="practical-exam-facts">
                <span>
                  <b>12문제</b>
                  {' 실제 필답 구성'}
                </span>
                <span>
                  <b>90분</b>
                  {' 공식 시험시간'}
                </span>
                <span>
                  <b>60점</b>
                  {' 필답 배점'}
                </span>
                <span>
                  <b>40점</b>
                  {' 동관 작업'}
                </span>
              </div>
              <div className="practical-source-links">
                {practicalSources.map((source) => (
                  <a key={source.href} href={problemImage(source.href)} target="_blank" rel="noreferrer">
                    {source.label}
                    {' ↗'}
                  </a>
                ))}
              </div>
              <div className="practical-progress-board">
                <div>
                  <span>학습 완료</span>
                  <strong>{practicalMasteredCount}</strong>
                  <small>
                    {'/ '}
                    {practicalPrompts.length}
                  </small>
                </div>
                <div>
                  <span>부분 정답</span>
                  <strong>{practicalPartialCount}</strong>
                  <small>문제</small>
                </div>
                <div>
                  <span>다시 보기</span>
                  <strong>{practicalReviewCount}</strong>
                  <small>문제</small>
                </div>
                <button type="button" onClick={showPracticalReview}>
                  복습 문제 모아보기
                </button>
              </div>
              {!practicalSessionActive ? (
                <div className="practical-quick-start">
                  <button type="button" onClick={startPracticalDaily}>
                    <b>오늘의 필답 5문제</b>
                    <small>오답·부분점수·미학습 우선 · 30분</small>
                  </button>
                  <button type="button" onClick={startPracticalMock}>
                    <b>일반 랜덤 12문제</b>
                    <small>현재 선택 범위 · 90분 · 정답 확인 가능</small>
                  </button>
                  <button type="button" onClick={printPracticalSheet} className="subtle">
                    <b>A4 시험지 출력</b>
                    <small>현재 선택 문제와 별도 답안 공간</small>
                  </button>
                </div>
              ) : null}
            </details>
          ) : null}
          {practicalLibraryOpen && !practicalSessionActive ? (
            <>
              <nav aria-label="필답형 자료 선택" className="practical-library-tabs">
                <button
                  type="button"
                  onClick={() => {
                    m.practicalLibraryTab = 'search';
                  }}
                  className={normalizeClass([{ active: practicalLibraryTab === 'search' }])}
                >
                  <b>⌕ 문제 검색</b>
                  <small>문제·정답·해설·회차 찾기</small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalLibraryTab = 'calculation';
                  }}
                  className={normalizeClass([{ active: practicalLibraryTab === 'calculation' }])}
                >
                  <b>계산·공식 공부</b>
                  <small>
                    {practicalCalculationCount}
                    문제 · SI 단위부터 · PDF
                  </small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalLibraryTab = 'rounds';
                  }}
                  className={normalizeClass([{ active: practicalLibraryTab === 'rounds' }])}
                >
                  <b>회차별 기출</b>
                  <small>
                    {practicalGroupCounts.restored}
                    {'문제 · '}
                    {practicalRoundSummaries.length}
                    회차
                  </small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalLibraryTab = 'materials';
                  }}
                  className={normalizeClass([{ active: practicalLibraryTab === 'materials' }])}
                >
                  <b>추가 자료</b>
                  <small>
                    {'PDF·사진·연습 '}
                    {practicalPrompts.length - practicalGroupCounts.restored}
                    문제
                  </small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalLibraryTab = 'review';
                  }}
                  className={normalizeClass([{ active: practicalLibraryTab === 'review' }])}
                >
                  <b>복습</b>
                  <small>
                    {'부분 정답·다시 보기 '}
                    {practicalReviewCount}
                    문제
                  </small>
                </button>
              </nav>
              {practicalLibraryTab === 'search' ? (
                <Suspense fallback={null}><PracticalSearchLibrary {...{ prompts: practicalPrompts, onOpen: openPracticalSearchResults }}/></Suspense>
              ) : practicalLibraryTab === 'calculation' ? (
                <Suspense fallback={null}><PracticalCalculationLibrary {...{ prompts: practicalPrompts, onStart: openPracticalCalculations }}/></Suspense>
              ) : practicalLibraryTab === 'rounds' ? (
                <section className="practical-round-library">
                  {practicalLatestRound ? (
                    <button
                      type="button"
                      onClick={() => {
                        openPracticalRound(practicalLatestRound.key);
                      }}
                      className="practical-resume-round"
                    >
                      <span>최근 학습</span>
                      <strong>{practicalLatestRound.label}</strong>
                      <small>
                        {practicalLatestRound.answered}
                        {' / '}
                        {practicalLatestRound.total}
                        문제 작성 · 이어풀기 →
                      </small>
                    </button>
                  ) : null}
                  {practicalRoundYears.map(([year, rounds]) => (
                    <div key={year} className="practical-year-group">
                      <header>
                        <h3>{year}년</h3>
                        <span>
                          {rounds.reduce((sum, round) => sum + round.total, 0)}
                          문제
                        </span>
                      </header>
                      <div>
                        {rounds.map((round) => (
                          <button
                            key={round.key}
                            type="button"
                            onClick={() => {
                              openPracticalRound(round.key);
                            }}
                          >
                            <span>{formatPracticalSession(round.session)}</span>
                            <strong>
                              {round.answered
                                ? `${round.answered} / ${round.total} 작성`
                                : `${round.total}문제`}
                            </strong>
                            {round.review ? (
                              <small>
                                {'복습 '}
                                {round.review}
                                문제
                              </small>
                            ) : (
                              <small>
                                {round.answered ? '이어풀기' : '시작하기'}
                                {' →'}
                              </small>
                            )}
                            <i style={{ width: `${Math.round((round.answered / round.total) * 100)}%` }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ) : practicalLibraryTab === 'materials' ? (
                <section className="practical-material-library">
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('supplement');
                    }}
                  >
                    <span>PDF</span>
                    <div>
                      <strong>필답문제2</strong>
                      <small>
                        {'사용자 제공 PDF · '}
                        {practicalGroupCounts.supplement}
                        문제
                      </small>
                    </div>
                    <b>풀기 →</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('photos');
                    }}
                  >
                    <span>IMG</span>
                    <div>
                      <strong>사진·기기 문제</strong>
                      <small>
                        {'사용자 제공 사진 PDF · '}
                        {practicalGroupCounts.photos}
                        문제
                      </small>
                    </div>
                    <b>풀기 →</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('public');
                    }}
                  >
                    <span>WEB</span>
                    <div>
                      <strong>공개 자료</strong>
                      <small>
                        {'공개 출처 필답 · '}
                        {practicalGroupCounts.public}
                        문제
                      </small>
                    </div>
                    <b>풀기 →</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('foundation');
                    }}
                  >
                    <span>기초</span>
                    <div>
                      <strong>기초 연습</strong>
                      <small>
                        {'핵심 개념부터 · '}
                        {practicalGroupCounts.foundation}
                        문제
                      </small>
                    </div>
                    <b>풀기 →</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('drill');
                    }}
                  >
                    <span>심화</span>
                    <div>
                      <strong>유형 연습</strong>
                      <small>
                        {'계산·도면·서술 · '}
                        {practicalGroupCounts.drill}
                        문제
                      </small>
                    </div>
                    <b>풀기 →</b>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPracticalMaterial('provided');
                    }}
                    className="all"
                  >
                    <span>ALL</span>
                    <div>
                      <strong>별도 제공 자료 전체</strong>
                      <small>
                        {'PDF·사진·공개 자료 · '}
                        {practicalProvidedCount}
                        문제
                      </small>
                    </div>
                    <b>모아 풀기 →</b>
                  </button>
                </section>
              ) : (
                <section className="practical-review-library">
                  <div>
                    <span>다시 확인할 문제</span>
                    <strong>{practicalReviewCount}</strong>
                    <small>부분 정답과 다시 보기로 표시한 문제</small>
                  </div>
                  <button type="button" disabled={!practicalReviewCount} onClick={showPracticalReview}>
                    복습 문제 이어풀기 →
                  </button>
                  {!practicalReviewCount ? (
                    <p>문제를 채점할 때 ‘부분 정답’이나 ‘다시 보기’를 누르면 이곳에 자동으로 모입니다.</p>
                  ) : null}
                </section>
              )}
            </>
          ) : (
            <div className="practical-solve-controls">
              <label>
                <span>학습 방식</span>
                <select
                  value={practicalStudyMode}
                  onChange={(event) => {
                    m.practicalStudyMode = event.currentTarget.value as typeof practicalStudyMode;
                  }}
                >
                  <option value="type">문제 → 풀이 확인</option>
                  {!practicalSessionActive ? <option value="memorize">답까지 암기</option> : null}
                </select>
              </label>
              <label>
                <span>표시 개수</span>
                <select
                  value={practicalDisplayChoice}
                  onChange={(event) => {
                    m.practicalDisplayChoice = event.currentTarget.value as typeof practicalDisplayChoice;
                  }}
                  aria-label="필답형 화면 배치"
                >
                  <option value="single">한 문제씩</option>
                  {practicalBatchOptions.map((count) => (
                    <option key={count} value={String(count)}>
                      {count ? `${count}문제씩` : '여러 문제 이어보기'}
                    </option>
                  ))}
                </select>
              </label>
              {!practicalSessionActive ? (
                <button
                  type="button"
                  onClick={() => {
                    m.practicalOptionsOpen = !practicalOptionsOpen;
                  }}
                >
                  {practicalOptionsOpen ? '검색·범위 닫기' : '검색·범위'}
                </button>
              ) : null}
            </div>
          )}
          {practicalSessionActive ? (
            <div
              className={normalizeClass(['practical-mock-status', { finished: practicalSessionFinished }])}
            >
              <div>
                <span>
                  {practicalSessionFinished
                    ? '제출 완료 · 자가 채점'
                    : practicalSessionPattern
                      ? '복원 비율 실전 · 풀이 확인 가능'
                      : practicalSessionIds.length <= 5
                        ? 'TODAY 5 WRITTEN PRACTICE'
                        : '90 MINUTE MOCK TEST'}
                </span>
                <strong>
                  {practicalSessionFinished
                    ? `${practicalSessionScore} / ${practicalSessionTotalPoints}점`
                    : formatPracticalTime(practicalSessionRemainingSeconds)}
                </strong>
                <small>
                  {practicalSessionGradedCount}
                  {' / '}
                  {practicalSessionIds.length}
                  문제 채점
                </small>
                {practicalSessionPattern ? (
                  <small>
                    {'구성 기준 '}
                    {practicalSessionPattern.template}
                    {'회 · '}
                    {practicalPatternSummary(practicalSessionPattern.kinds)}
                  </small>
                ) : null}
              </div>
              <div>
                {!practicalSessionFinished ? (
                  <button
                    type="button"
                    onClick={() => {
                      finishPracticalMock(false);
                    }}
                  >
                    {practicalSessionPattern ? '답안 제출·자가채점' : '실전 종료·점수 보기'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    closePracticalMock();
                  }}
                >
                  목록으로 돌아가기
                </button>
              </div>
            </div>
          ) : null}
          {practicalSessionActive && practicalSessionPattern ? (
            <p>
              {'제출 전 풀이 확인 '}
              {practicalViewedAnswerIds.length}
              문제 · 제출 전에는 풀이를 봐도 시간이 계속 진행됩니다. 점수는 자가채점한 학습용 결과입니다.
            </p>
          ) : null}
          {practicalSessionActive && practicalSessionPattern ? (
            <p>
              {'이번 출제: 회차별 기출 '}
              {practicalPagedPrompts.filter((p) => p.group === 'restored').length}
              {'문제 · 추가자료 '}
              {practicalPagedPrompts.filter((p) => p.group !== 'restored').length}
              문제
            </p>
          ) : null}
          {practicalSessionActive && practicalSessionFinished ? (
            <section className="practical-session-report">
              <header>
                <div>
                  <span>WRITTEN SCORE REPORT</span>
                  <h3>필답형 실전 분석</h3>
                </div>
                <strong>
                  {practicalSessionGradedCount === practicalSessionIds.length
                    ? `${Math.round((practicalSessionScore / Math.max(1, practicalSessionTotalPoints)) * 100)}%`
                    : `${practicalSessionGradedCount}/${practicalSessionIds.length} 채점`}
                </strong>
              </header>
              {practicalSessionGradedCount < practicalSessionIds.length ? (
                <p>
                  아래 답안과 비교해 자가채점해 주세요. 모든 문제를 채점한 뒤 취약 분야를 정리합니다. 미채점은
                  오답 판정이 아닙니다.
                </p>
              ) : (
                <>
                  <div>
                    <article>
                      <span>취약 분야</span>
                      <b>{practicalSessionReport.weakestLabel}</b>
                      <small>다음 복습에서 우선 출제</small>
                    </article>
                    <article>
                      <span>힌트 사용</span>
                      <b>
                        {practicalSessionReport.hints}
                        단계
                      </b>
                      <small>적게 쓸수록 실전 회상에 유리</small>
                    </article>
                    <article>
                      <span>막힘 표시</span>
                      <b>
                        {practicalSessionReport.lowConfidence}
                        문제
                      </b>
                      <small>다시 작성 권장</small>
                    </article>
                  </div>
                  {practicalSessionReport.topMistakes.length ? (
                    <p>
                      <b>반복 실수</b>
                      {practicalSessionReport.topMistakes.map(([reason, count]) => (
                        <span key={reason}>
                          {practicalMistakeLabel(reason)} {count}회
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p>
                      <b>다음 단계</b>
                      <span>각 문제의 부분점수 채점표에서 빠진 요소와 실수 원인을 기록해 보세요.</span>
                    </p>
                  )}
                </>
              )}
            </section>
          ) : null}
          {!practicalLibraryOpen && !practicalSessionActive && practicalOptionsOpen ? (
            <details open={true} className="practical-scope">
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  m.practicalOptionsOpen = false;
                }}
              >
                검색·분야·범위 닫기
              </summary>
              <div aria-label="필답형 문제 묶음 선택" className="practical-filter-tabs">
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'all';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'all' }])}
                >
                  {'전체 '}
                  {practicalPrompts.length}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'restored';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'restored' }])}
                >
                  {'회차별 기출 '}
                  {practicalGroupCounts.restored}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'provided';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'provided' }])}
                >
                  {'추가 자료 전체 '}
                  {practicalProvidedCount}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'public';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'public' }])}
                >
                  {'공개 자료 '}
                  {practicalGroupCounts.public}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'supplement';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'supplement' }])}
                >
                  {'추가 자료 '}
                  {practicalGroupCounts.supplement}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'photos';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'photos' }])}
                >
                  {'사진·기기 자료 '}
                  {practicalGroupCounts.photos}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'foundation';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'foundation' }])}
                >
                  {'기초 연습 '}
                  {practicalGroupCounts.foundation}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'drill';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'drill' }])}
                >
                  {'심화 연습 '}
                  {practicalGroupCounts.drill}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    m.practicalPromptFilter = 'review';
                  }}
                  className={normalizeClass([{ active: practicalPromptFilter === 'review' }])}
                >
                  {'복습 '}
                  {practicalReviewCount}
                </button>
              </div>
              <div aria-label="필답형 분야 선택" className="practical-category-tabs">
                <button
                  type="button"
                  onClick={() => {
                    m.practicalCategoryFilter = 'all';
                  }}
                  className={normalizeClass([{ active: practicalCategoryFilter === 'all' }])}
                >
                  전 분야
                </button>
                {practicalCategoryOptions.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      m.practicalCategoryFilter = key;
                    }}
                    className={normalizeClass([{ active: practicalCategoryFilter === key }])}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="practical-toolbar">
                <label>
                  <span>문제 검색</span>
                  <input
                    value={practicalSearch}
                    onChange={(event) => {
                      m.practicalSearch = event.currentTarget.value;
                    }}
                    type="search"
                    placeholder="예: 과열도, 진공, 냉각수"
                  />
                </label>
                {practicalPeriodAvailable ? (
                  <label className="practical-round-select">
                    <span>자료 기간</span>
                    <select
                      value={practicalMaterialPeriod}
                      onChange={(event) => {
                        m.practicalMaterialPeriod = event.currentTarget
                          .value as typeof practicalMaterialPeriod;
                      }}
                    >
                      <option value="all">전체 기간</option>
                      <option value="since-2023-2">2023년 2회 이후</option>
                      <option value="before-2023-2">2023년 1회 이전</option>
                    </select>
                  </label>
                ) : null}
                <button type="button" onClick={startPracticalMock}>
                  <strong>일반 랜덤 12문제</strong>
                  <small>현재 선택 범위 · 정답 확인 가능</small>
                </button>
              </div>
            </details>
          ) : null}
          {!practicalLibraryOpen || practicalSessionActive ? (
            <>
              {practicalPromptFilter === 'calculation' && !practicalSessionActive ? (
                <details className="practical-si-basics">
                  <summary>SI 단위·기호가 헷갈리면 여기를 열어보세요</summary>
                  {practicalSiBasics.map((item) => (
                    <article key={item.title}>
                      <h4>{item.title}</h4>
                      <p>{item.text}</p>
                    </article>
                  ))}
                  <article>
                    <h4>{practicalAbsoluteTemperatureExample.title}</h4>
                    <p>{practicalAbsoluteTemperatureExample.text}</p>
                    <Suspense fallback={null}><PracticalFractionLines {...{ rows: practicalAbsoluteTemperatureExample.fractions }}/></Suspense>
                  </article>
                  <a href={problemImage(practicalCalculationPdf)} download={true}>
                    같은 내용 PDF 받기 ↓
                  </a>
                </details>
              ) : null}
              <div className="practical-cbt-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    practicalSessionActive ? closePracticalMock() : openPracticalLibrary();
                  }}
                  className="practical-toolbar-back"
                >
                  ← 목록
                </button>
                <span>
                  {practicalPagedPrompts.filter((p) => practicalProgress[p.id]?.grade).length}
                  {' / '}
                  {practicalPagedPrompts.length}
                  {' 채점'}
                </span>
                <button
                  type="button"
                  aria-expanded={practicalNavigatorOpen}
                  onClick={() => {
                    m.practicalNavigatorOpen = !practicalNavigatorOpen;
                  }}
                >
                  문제 번호
                </button>
                <button type="button" onClick={jumpPracticalUnanswered}>
                  미작성 이동
                </button>
              </div>
              {practicalNavigatorOpen ? (
                <nav aria-label="필답형 문제 번호" className="practical-number-grid">
                  {practicalPagedPrompts.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`${practicalSessionActive ? i + 1 + '번' : item.numberLabel || practicalListNumber(i, item) + '번'} ${practicalGradeLabel(practicalProgress[item.id]?.grade)}`}
                      onClick={() => {
                        jumpPracticalIndex(i);
                      }}
                      className={normalizeClass([
                        {
                          active: visiblePracticalPrompts.some((p) => p.id === item.id),
                          answered: practicalHasAnswer(item.id),
                          graded: !!practicalProgress[item.id]?.grade,
                        },
                      ])}
                    >
                      {practicalSessionActive
                        ? i + 1
                        : item.group === 'restored'
                          ? practicalListNumber(i, item)
                          : i + 1}
                    </button>
                  ))}
                </nav>
              ) : null}
              {!visiblePracticalPrompts.length ? (
                <p className="practical-empty">
                  현재 조건에 맞는 문제가 없습니다. 분야나 문제 묶음을 바꿔 보세요.
                </p>
              ) : (
                <div className="practical-question-grid">
                  {visiblePracticalPrompts.map((prompt, index) => (
                    <article
                      key={prompt.id}
                      data-practical-id={prompt.id}
                      data-practical-index={(practicalPage - 1) * practicalPageSize + index}
                      className={normalizeClass([
                        [
                          `grade-${practicalProgress[prompt.id]?.grade || 'none'}`,
                          { 'memorize-mode': practicalStudyMode === 'memorize' },
                        ],
                      ])}
                    >
                      <div className="practical-question-body">
                        <header>
                          <span>{practicalListNumber(index, prompt)}</span>
                          <div>
                            <small>
                              {practicalGroupLabel(prompt.group)}
                              {prompt.year && prompt.session ? (
                                <>
                                  {' · '}
                                  {prompt.year}
                                  {'년 '}
                                  {formatPracticalSession(prompt.session)}{' '}
                                  {prompt.numberLabel || `${prompt.number}번`}
                                </>
                              ) : null}
                              {' · '}
                              {practicalCategoryLabels[prompt.category]}
                              {' · '}
                              {practicalDifficultyLabels[prompt.difficulty]}
                              {' · '}
                              {practicalAdaptiveLabel(prompt)}
                            </small>
                            <h3>{prompt.question}</h3>
                          </div>
                          <b>{practicalGradeLabel(practicalProgress[prompt.id]?.grade)}</b>
                        </header>
                        <Suspense fallback={null}><PracticalIssueReport {...{
                            prompt: practicalSourcePrompt(prompt),
                            displayNumber:
                              Number(practicalListNumber(index, prompt)) ||
                              (practicalPage - 1) * practicalPageSize + index + 1,
                          }}/></Suspense>
                        {prompt.image ? (
                          <Suspense fallback={null}><PracticalProblemImage {...{
                              src: prompt.image,
                              alt: `공조냉동 필답형 ${practicalListNumber(index, prompt)}번 문제 그림`,
                            }}/></Suspense>
                        ) : null}
                        {prompt.images?.length ? (
                          <div className="practical-prompt-images">
                            {prompt.images.map((image, imageIndex) => (
                              <Suspense key={image} fallback={null}><PracticalProblemImage {...{
                                  src: image,
                                  maxHeight: prompt.imageMaxHeight,
                                  alt: `공조냉동 필답형 ${practicalListNumber(index, prompt)}번 문제 그림 ${imageIndex + 1}`,
                                }}/></Suspense>
                            ))}
                          </div>
                        ) : null}
                        {!practicalExamLocked && prompt.group === 'restored' && prompt.sourceUrl ? (
                          <a
                            href={problemImage(prompt.sourceUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="practical-source-video"
                          >
                            ▶ 원문 동작 영상 보기 ↗
                          </a>
                        ) : null}
                      </div>
                      <div className="practical-response-body">
                        {practicalStudyMode !== 'memorize' ? (
                          <div className="practical-answer-actions">
                            <button
                              type="button"
                              onClick={() => {
                                togglePracticalAnswer(prompt.id);
                              }}
                            >
                              {practicalAnswerRevealed(prompt.id) ? '풀이 닫기' : '정답·풀이 보기'}
                            </button>
                            {!practicalSessionActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  startPracticalRelated(prompt);
                                }}
                                className="subtle"
                              >
                                같은 유형 연속 풀기
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {practicalSessionPattern && practicalViewedAnswerIds.includes(prompt.id) ? (
                          <small>제출 전 풀이 확인한 문제</small>
                        ) : null}
                        {(!practicalExamLocked && practicalStudyMode === 'memorize') ||
                        practicalAnswerRevealed(prompt.id) ? (
                          <div className="practical-solution">
                            <p>
                              <b>학습용 핵심 답안</b>
                              {prompt.answer}
                            </p>
                            <details open={true} className="practical-explanation">
                              <summary>이해용 설명 · 접기/펼치기</summary>
                              <p>{prompt.explanation}</p>
                            </details>
                            {calculationLesson(practicalSourcePrompt(prompt)) ? (
                              <Suspense fallback={null}><PracticalCalculationLesson {...{ lesson: calculationLesson(practicalSourcePrompt(prompt))! }}/></Suspense>
                            ) : null}
                            {prompt.answerImages?.length ? (
                              <div className="practical-answer-images">
                                <strong>답안 도식</strong>
                                <div>
                                  {prompt.answerImages.map((image, imageIndex) => (
                                    <img
                                      key={image}
                                      src={problemImage(image)}
                                      alt={`공조냉동 필답형 답안 도식 ${imageIndex + 1}`}
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {prompt.keyPoints?.length ? (
                              <details className="practical-key-points">
                                <summary>채점 핵심어</summary>
                                <ul>
                                  {prompt.keyPoints.map((point) => (
                                    <li key={point}>{point}</li>
                                  ))}
                                </ul>
                              </details>
                            ) : null}
                            {!practicalExamLocked && practicalStudyMode !== 'memorize' ? (
                              <div aria-label="자가 채점" className="practical-self-grade">
                                <span>내 답과 비교해 채점</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    markPracticalPrompt(prompt.id, 'correct');
                                  }}
                                  className={normalizeClass([
                                    { active: practicalProgress[prompt.id]?.grade === 'correct' },
                                  ])}
                                >
                                  {'✓ 정답 '}
                                  {prompt.points}점
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    markPracticalPrompt(prompt.id, 'partial');
                                  }}
                                  className={normalizeClass([
                                    { active: practicalProgress[prompt.id]?.grade === 'partial' },
                                  ])}
                                >
                                  {'△ 부분 '}
                                  {prompt.points / 2}점
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    markPracticalPrompt(prompt.id, 'review');
                                  }}
                                  className={normalizeClass([
                                    { active: practicalProgress[prompt.id]?.grade === 'review' },
                                  ])}
                                >
                                  ↻ 다시 보기
                                </button>
                              </div>
                            ) : null}
                            <small>
                              {prompt.sourceNote}{' '}
                              {prompt.sourceUrl ? (
                                <a href={problemImage(prompt.sourceUrl)} target="_blank" rel="noreferrer">
                                  {['supplement', 'photos'].includes(prompt.group)
                                    ? '보완 근거'
                                    : '원문 보기'}
                                  {' ↗'}
                                </a>
                              ) : null}
                            </small>
                          </div>
                        ) : null}
                        {practicalStudyMode === 'type' ? (
                          <details
                            open={!practicalDraftClosedIds.includes(prompt.id)}
                            onToggle={(event) => {
                              event.currentTarget.open
                                ? (m.practicalDraftClosedIds = practicalDraftClosedIds.filter(
                                    (id) => id !== prompt.id,
                                  ))
                                : !practicalDraftClosedIds.includes(prompt.id) &&
                                  practicalDraftClosedIds.push(prompt.id);
                            }}
                            className="practical-draft"
                          >
                            <summary>
                              답안 직접 입력 · 접기/펼치기
                              {practicalDrafts[prompt.id] ? ' · 작성 답안 있음' : ''}
                            </summary>
                            <label className="practical-answer-input">
                              <span>내 답안</span>
                              <textarea
                                value={practicalDrafts[prompt.id] || ''}
                                disabled={practicalSessionFinished}
                                rows={3}
                                placeholder="답안이나 계산 과정을 적어보세요. 작성 내용은 자동 저장됩니다."
                                onChange={(event) => {
                                  updatePracticalDraft(prompt.id, event.nativeEvent);
                                }}
                              />
                            </label>
                          </details>
                        ) : null}
                        {!practicalExamLocked && practicalStudyMode !== 'memorize' ? (
                          <details
                            onToggle={(event) => {
                              event.currentTarget.open &&
                                !practicalHelperIds.includes(prompt.id) &&
                                (m.practicalHelperIds = [...practicalHelperIds, prompt.id]);
                            }}
                            className="practical-extra-tools"
                          >
                            <summary>힌트 · 답안 골격 · 부분점수 채점</summary>
                            {practicalHelperIds.includes(prompt.id) ? (
                              <Suspense fallback={null}><PracticalTrainingTools {...{
                                  prompt: prompt,
                                  draft: practicalDrafts[prompt.id] || '',
                                  revealed: practicalAnswerRevealed(prompt.id),
                                  assessment: practicalProgress[prompt.id]?.assessment,
                                  similarCount: practicalSimilarCount(prompt),
                                  onUpdate: (event: Parameters<typeof updatePracticalAssessment>[1]) => {
                                    updatePracticalAssessment(prompt.id, event);
                                  },
                                  onInsertTemplate: (event: string) => {
                                    replacePracticalDraft(prompt.id, event);
                                  },
                                  onReveal: () => {
                                    togglePracticalAnswer(prompt.id);
                                  },
                                }}/></Suspense>
                            ) : null}
                          </details>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {practicalContinuous && visiblePracticalPrompts.length < practicalPagedPrompts.length ? (
                <Suspense fallback={null}><PracticalLoadMore {...{
                    onMore: () => {
                      m.practicalContinuousLimit += 20;
                    },
                  }}/></Suspense>
              ) : null}
              {visiblePracticalPrompts.length && !practicalContinuous ? (
                <nav aria-label="필답형 문제 페이지" className="practical-pagination">
                  <button
                    type="button"
                    disabled={practicalPage === 1}
                    onClick={() => {
                      changePracticalPage(practicalPage - 1);
                    }}
                  >
                    {'← '}
                    {practicalPageSize === 1 ? '이전 문제' : '이전 묶음'}
                  </button>
                  <div className="practical-page-center">
                    <span>
                      <b>{practicalPage}</b>
                      {' / '}
                      {practicalPageCount}
                    </span>
                    {practicalPageSize === 1 && practicalStudyMode !== 'memorize' ? (
                      <button
                        type="button"
                        onClick={() => {
                          togglePracticalAnswer(visiblePracticalPrompts[0].id);
                        }}
                      >
                        {practicalAnswerRevealed(visiblePracticalPrompts[0].id) ? '답안 닫기' : '답안 확인'}
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={practicalPage === practicalPageCount}
                    onClick={() => {
                      changePracticalPage(practicalPage + 1);
                    }}
                  >
                    {practicalPageSize === 1 ? '다음 문제' : '다음 묶음'}
                    {' →'}
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
      {!hvacPracticalAvailable || practicalGuideSection === 'theory' ? (
        <div className="hvac-guide-grid">
          {activeStudyGuide.sections.map((section, index) => (
            <article key={section.title}>
              <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h2>{section.title}</h2>
              </header>
              <p>{section.summary}</p>
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
