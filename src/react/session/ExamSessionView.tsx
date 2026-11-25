import './session.css';
import {clsx as normalizeClass} from 'clsx';
import QuestionCard from './QuestionCard';
import type { ExamSessionViewModel } from '../../cbt/studyController';
import {useState} from 'react';
import {macStudyInput} from '../../cbt/studyGestures';
import {readStudyPreference,writeStudyPreference} from '../../cbt/studyInputPreferences';

function MacQuestionSwipeSetting(){
 const [swipe,setSwipe]=useState(()=>readStudyPreference('mac-question-swipe',false));
 return <label className="session-gesture-setting"><input type="checkbox" checked={swipe} onChange={e=>{
   setSwipe(e.target.checked);writeStudyPreference('mac-question-swipe',e.target.checked);
 }}/> 트랙패드로 문항 넘기기</label>;
}

export function renderExamSessionView(m: ExamSessionViewModel) {
  const {
    activateSessionItem,
    activeSessionItem,
    adjustFontScale,
    answerLayout,
    answeredCount,
    betaModeMeta,
    betaQuestionMeta,
    chooseAnswer,
    coolingSessionActive,
    currentItemColumns,
    darkActive,
    examPace,
    examSheetOpen,
    experimentalFeaturesEnabled,
    fontScale,
    formattedTime,
    goToNextKept,
    goToNextUnanswered,
    goToPage,
    goToQuestion,
    hotspotIndicator,
    isMidtermCalculation,
    isSubjectStart,
    jumpToLearningQuestion,
    keptCount,
    learningJumpNumber,
    leaveSession,
    markOmrManualScroll,
    omrFilter,
    omrRows,
    openCalculator,
    pageCount,
    panelCalculator,
    panelNotes,
    prepareAiQuestion,
    questionJudgmentEnabled,
    questionTransitionName,
    resetLearning,
    restoredImageTheme,
    selectedKey,
    session,
    sessionMenuOpen,
    sessionProgress,
    sessionQuestionMax,
    sessionSubjectNumber,
    sessionTitle,
    setFontScale,
    setQuestionConfidence,
    setQuestionMistakeReason,
    setQuestionStudyNote,
    setSessionPageSize,
    settingsOpen,
    solveLayoutMode,
    studyStore,
    submitExam,
    submitLearning,
    toggleBookmark,
    toggleKeep,
    toggleLightDark,
    unansweredCount,
  } = m;
  if (!session) return null;
  return (
    <>
      <header className={normalizeClass(['session-topbar', {'learn-topbar': session.mode === 'learn'}])}>
        <div className="session-leading">
          <button
            type="button"
            onClick={() => {
              leaveSession();
            }}
            aria-label="뒤로가기" className="back-button"
          >
            {'← '}
            <span>뒤로가기</span>
          </button>
          <button
            type="button"
            onClick={() => {
              m.sessionMenuOpen = true;
            }}
            aria-label="풀이 메뉴 열기" aria-expanded={sessionMenuOpen} className="session-menu-button"
          >
            {'☰ '}
            <span>메뉴</span>
          </button>
        </div>
        <div className="session-title">
          <span>
            {solveLayoutMode === 'combat'
              ? 'COMBAT CBT · MISSION'
              : session.mode === 'exam'
                ? 'CBT EXAM'
                : 'LEARNING MODE'}
          </span>
          <strong>{sessionTitle}</strong>
          {solveLayoutMode === 'combat' ? (
            <div className="combat-progress-track">
              <i style={{ width: `${sessionProgress}%` }} />
            </div>
          ) : null}
        </div>
        <div className="session-tools">
          <button
            type="button"
            onClick={() => {
              m.panelCalculator = true;
            }}
          >
            ▦ 계산기
          </button>
          <button
            type="button"
            onClick={() => {
              m.panelNotes = true;
            }}
          >
            풀이 메모
          </button>
          <button
            type="button"
            onClick={() => {
              m.settingsOpen = true;
            }}
          >
            ⚙ 설정
          </button>
          <div aria-label="문자 크기 조절" className="session-font-control">
            <button
              type="button"
              aria-label="문자 작게"
              disabled={fontScale <= 0.8}
              onClick={() => {
                adjustFontScale(-0.1);
              }}
            >
              가−
            </button>
            <button
              type="button"
              title="기본 크기로"
              onClick={() => {
                setFontScale(1);
              }}
            >
              {Math.round(fontScale * 100)}%
            </button>
            <button
              type="button"
              aria-label="문자 크게"
              disabled={fontScale >= 1.6}
              onClick={() => {
                adjustFontScale(0.1);
              }}
            >
              가+
            </button>
          </div>
          {session.mode === 'learn' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                jumpToLearningQuestion();
              }}
              className="session-jump-form"
            >
              <label htmlFor="learning-jump-number">문제 번호</label>
              <input
                id="learning-jump-number"
                value={learningJumpNumber}
                onChange={(event) => {
                  m.learningJumpNumber = event.currentTarget.value;
                }}
                type="number"
                inputMode="numeric"
                min="1"
                max={sessionQuestionMax}
                placeholder={`1~${sessionQuestionMax}`}
                aria-label="이동할 문제 번호"
              />
              <button type="submit">이동</button>
            </form>
          ) : null}
          {session.mode === 'learn' ? (
            <label>
              {' 문제 표시 '}
              <select
                value={session.pageSize}
                onChange={(event) => {
                  setSessionPageSize(Number((event.target as HTMLSelectElement).value));
                }}
              >
                <option value={1}>1문제</option>
                <option value={2}>2문제</option>
                <option value={4}>4문제</option>
                <option value={6}>6문제</option>
              </select>
            </label>
          ) : null}
          {session.mode === 'exam' && (
            <button type="button" className="timer-button">
              남은 시간 <strong>{formattedTime}</strong>
            </button>
          )}
          {session.mode === 'exam' ? (
            <button
              type="button"
              onClick={() => {
                m.examSheetOpen = !examSheetOpen;
              }}
            >
              {examSheetOpen ? 'OMR 닫기' : 'OMR 열기'}
            </button>
          ) : null}
        </div>
        <div
          aria-label="현재 풀이 진행 상태"
          className={normalizeClass([
            'session-status-strip',
            {
              'combat-hud-stats': solveLayoutMode === 'combat',
              'comcbt-status-strip': solveLayoutMode === 'comcbt',
            },
          ])}
        >
          <span>
            <small>진행</small>
            <strong>{sessionProgress}%</strong>
          </span>
          <span>
            <small>완료</small>
            <strong>{answeredCount}</strong>
          </span>
          <button
            type="button"
            disabled={!unansweredCount}
            title={unansweredCount ? '다음 미응답 문제로 이동' : '모든 문제에 답했습니다'}
            onClick={goToNextUnanswered}
            className="session-unanswered-status"
          >
            <small>미응답</small>
            <strong>{unansweredCount}</strong>
          </button>
          <button type="button" disabled={!keptCount} onClick={goToNextKept} className="session-kept-status">
            <small>킵</small>
            <strong>{keptCount}</strong>
          </button>
        </div>
        {examPace ? (
          <div aria-live="polite" className={normalizeClass(['beta-exam-pace', `is-${examPace.tone}`])}>
            <b>β 속도 예측</b>
            <strong>{examPace.label}</strong>
            <span>{examPace.detail}</span>
          </div>
        ) : null}
      </header>
      {sessionMenuOpen ? (
        <button
          type="button"
          aria-label="풀이 메뉴 닫기"
          onClick={() => {
            m.sessionMenuOpen = false;
          }}
          className="session-menu-backdrop"
        />
      ) : null}
      <aside aria-label="풀이 메뉴" inert={!sessionMenuOpen} className={normalizeClass(['session-drawer', { open: sessionMenuOpen }])}>
        <header>
          <div>
            <span>CBT</span>
            <strong>풀이 메뉴</strong>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={() => {
              m.sessionMenuOpen = false;
            }}
          >
            ×
          </button>
        </header>
        <nav>
          {macStudyInput()&&<MacQuestionSwipeSetting/>}
          {session.mode === 'learn' && <button type="button" onClick={()=>{
            resetLearning();
            m.sessionMenuOpen=false;
          }}><span aria-hidden="true">↺</span><strong>이 페이지 선택 초기화</strong></button>}
          <button
            type="button"
            onClick={() => {
              leaveSession('home');
            }}
          >
            <span>⌂</span>
            <div>
              <strong>첫 화면</strong>
              <small>종목 선택과 학습 설정</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              leaveSession('rounds');
            }}
          >
            <span>▤</span>
            <div>
              <strong>회차별 문제</strong>
              <small>전체 기출 회차 선택</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              leaveSession('history');
            }}
          >
            <span>◴</span>
            <div>
              <strong>학습 내역</strong>
              <small>이어하기와 지난 점수</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              leaveSession('wrong');
            }}
          >
            <span>!</span>
            <div>
              <strong>오답노트</strong>
              <small>틀린 문제 다시 풀기</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              leaveSession('coach');
            }}
          >
            <span>✦</span>
            <div>
              <strong>합격 엔진</strong>
              <small>맞춤 복습과 합격 예측</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              leaveSession('updates');
            }}
          >
            <span>◷</span>
            <div>
              <strong>패치노트</strong>
              <small>최근 업데이트 확인</small>
            </div>
          </button>
        </nav>
        <footer>
          <fieldset>
            <legend>풀이 도구</legend>
            <button type="button" onClick={openCalculator}>
              ▦ 공학용 계산기
            </button>
            <button
              type="button"
              onClick={() => {
                m.panelNotes = true;
                m.sessionMenuOpen = false;
              }}
            >
              풀이 메모
            </button>
          </fieldset>
          <fieldset>
            <legend>화면 설정</legend>
            <button
              type="button"
              onClick={() => {
                m.settingsOpen = true;
                m.sessionMenuOpen = false;
              }}
            >
              ⚙ 화면·문제풀이 설정
            </button>
            <button type="button" onClick={toggleLightDark}>
              {darkActive ? '☀ 라이트 모드' : '☾ 다크 모드'}
            </button>
          </fieldset>
        </footer>
      </aside>
      <main className="session-main">
        <section className="question-area">
          {selectedKey === 'energy-midterm' || coolingSessionActive ? (
            <details className="midterm-question-map">
              <summary>
                문제 번호 목록 · 계산
                {session.items.filter(isMidtermCalculation).length}
                문제
              </summary>
              <nav aria-label="중간고사 문제 번호">
                {session.items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${index + 1}번${isMidtermCalculation(item) ? ' 계산 문제' : ''}`}
                    onClick={() => {
                      goToQuestion(index);
                    }}
                    className={normalizeClass([
                      { active: Math.floor(index / session.pageSize) === session.page },
                    ])}
                  >
                    <strong>{index + 1}</strong>
                    {isMidtermCalculation(item) ? (
                      <small className="midterm-calculation-badge">계산</small>
                    ) : null}
                  </button>
                ))}
              </nav>
            </details>
          ) : null}
          <>
            <div
              key={`${session.page}-${session.pageSize}`}
              className={normalizeClass(['question-columns', questionTransitionName, {'reading-one':session.pageSize === 1}])}
            >
              {currentItemColumns.map((column, columnIndex) => (
                <div key={columnIndex} className="question-column">
                  {column.map((item) => (
                    <QuestionCard
                      key={item.id} {...{
                        id: `session-question-${session.items.indexOf(item) + 1}`,
                        item: item,
                        mode: session.mode,
                        selected: session.answers[item.id],
                        readingSize: session.pageSize,
                        onReadingFocus: () => setSessionPageSize(session.pageSize === 1 ? 4 : 1, item),
                        subjectStart: isSubjectStart(item),
                        subjectNumber: sessionSubjectNumber(item),
                        displayNumber: session.items.indexOf(item) + 1,
                        bookmarked: studyStore.bookmarks.includes(item.id),
                        kept: session.kept.includes(item.id),
                        calculationMode: session.calculationMode,
                        imageAnswerMode: answerLayout === 'hotspot' ? 'hotspot' : 'buttons',
                        answerLayout: answerLayout,
                        hotspotIndicator: hotspotIndicator,
                        restoredImageTheme: restoredImageTheme,
                        solveLayout: solveLayoutMode,
                        active: (solveLayoutMode === 'comcbt' || sessionTitle.startsWith('기말고사 · ') || item.round.kind==='textbook-pages') && activeSessionItem?.id === item.id,
                        finalBook: sessionTitle.startsWith('기말고사 · ') && item.round.kind==='textbook-pages',
                        experimentalFeatures: experimentalFeaturesEnabled && questionJudgmentEnabled,
                        confidence: betaModeMeta(item.id, session.mode).confidence,
                        mistakeReason: betaModeMeta(item.id, session.mode).reason,
                        studyNote: betaQuestionMeta(item.id).note,
                        onChoose: (event: Parameters<typeof chooseAnswer>[1]) => {
                          chooseAnswer(item, event);
                        },
                        onToggleBookmark: () => {
                          toggleBookmark(item);
                        },
                        onToggleKeep: () => {
                          toggleKeep(item);
                        },
                        onAskAi: () => {
                          prepareAiQuestion(item);
                        },
                        onActivate: () => {
                          activateSessionItem(item);
                        },
                        onSetConfidence: (event: Parameters<typeof setQuestionConfidence>[1]) => {
                          setQuestionConfidence(item, event);
                        },
                        onSetMistakeReason: (event: Parameters<typeof setQuestionMistakeReason>[1]) => {
                          setQuestionMistakeReason(item, event);
                        },
                        onUpdateStudyNote: (event: Parameters<typeof setQuestionStudyNote>[1]) => {
                          setQuestionStudyNote(item, event);
                        },
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
          <footer className={normalizeClass(['pager', { 'has-unanswered': unansweredCount }])}>
            <button
              type="button"
              disabled={session.page === 0}
              aria-keyshortcuts="ArrowLeft" onClick={() => {
                goToPage(session.page - 1);
              }}
              className="pager-prev"
            >
              ← 이전
            </button>
            <span className="pager-position">
              <strong>{session.page + 1}</strong>
              {' / '}
              {pageCount}
            </span>
            {unansweredCount ? (
              <button type="button" onClick={goToNextUnanswered} className="pager-unanswered-button">
                다음 미응답
              </button>
            ) : null}
            <button
              type="button"
              disabled={session.page >= pageCount - 1}
              onClick={() => {
                goToPage(session.page + 1);
              }}
              className="pager-next"
            >
              다음 →
            </button>
            {session.mode === 'learn' ? (
              <button type="button" onClick={submitLearning} className="learning-result-button">
                학습 결과 보기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  submitExam(false);
                }}
                className="exam-submit-button"
              >
                시험 제출·채점
              </button>
            )}
          </footer>
        </section>
        {session.mode === 'exam' ? (
          <aside className="omr-sheet">
            <header>
              <div>
                <span>ANSWER SHEET</span>
                <strong>답안지</strong>
              </div>
              <div className="omr-summary">
                {keptCount ? (
                  <button type="button" onClick={goToNextKept}>
                    {'킵 '}
                    {keptCount}
                  </button>
                ) : null}
                <>
                  <b key={answeredCount}>
                    {answeredCount}/{session.items.length}
                  </b>
                </>
              </div>
            </header>
              <div aria-label="OMR 빠른 필터" className="omr-filter-bar">
                <button type="button" aria-pressed={omrFilter === 'all'}
                  onClick={() => {
                    m.omrFilter = 'all';
                  }}
                  className={normalizeClass([{ active: omrFilter === 'all' }])}
                >
                  전체
                </button>
                <button type="button" aria-pressed={omrFilter === 'unanswered'}
                  onClick={() => {
                    m.omrFilter = 'unanswered';
                  }}
                  className={normalizeClass([{ active: omrFilter === 'unanswered' }])}
                >
                  {'미응답 '}
                  {unansweredCount}
                </button>
                {solveLayoutMode === 'comcbt' && <>
                <button type="button" aria-pressed={omrFilter === 'kept'}
                  onClick={() => {
                    m.omrFilter = 'kept';
                  }}
                  className={normalizeClass([{ active: omrFilter === 'kept' }])}
                >
                  {'킵 '}
                  {keptCount}
                </button>
                <button type="button" aria-pressed={omrFilter === 'subject'}
                  onClick={() => {
                    m.omrFilter = 'subject';
                  }}
                  className={normalizeClass([{ active: omrFilter === 'subject' }])}
                >
                  현재 과목
                </button>
                </>}
              </div>
            <div
              ref={m.setOmrListRef}
              onPointerDown={markOmrManualScroll}
              onWheel={markOmrManualScroll}
              className="omr-list"
            >
              {omrRows.map(({ item, index }) => (
                <button
                  key={item.id}
                  data-omr-index={index}
                  type="button"
                  onClick={() => {
                    goToQuestion(index);
                  }}
                  className={normalizeClass([
                    {
                      current: Math.floor(index / session.pageSize) === session.page,
                      kept: session.kept.includes(item.id),
                    },
                  ])}
                >
                  <strong>
                    {index + 1}.{session.kept.includes(item.id) ? <i>K</i> : null}
                    {isMidtermCalculation(item) ? (
                      <small className="midterm-calculation-badge">계산</small>
                    ) : null}
                  </strong>
                  {[1, 2, 3, 4].map((choice) => (
                    <span
                      key={choice}
                      onClick={(event) => {
                        event.stopPropagation();
                        chooseAnswer(item, choice);
                      }}
                      className={normalizeClass([{ marked: session.answers[item.id] === choice }])}
                    >
                      {choice}
                    </span>
                  ))}
                </button>
              ))}
              {!omrRows.length ? <p className="omr-empty">해당 문제가 없습니다.</p> : null}
            </div>
            <footer>
              {unansweredCount ? (
                <button type="button" onClick={goToNextUnanswered} className="omr-next-unanswered">
                  다음 미응답
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  submitExam(false);
                }}
              >
                채점하기
              </button>
            </footer>
          </aside>
        ) : null}
      </main>
      <nav
        aria-label="Android 풀이 도구"
        className={normalizeClass(['native-session-bar', { 'has-unanswered': unansweredCount }])}
      >
        <button
          type="button"
          disabled={session.page === 0}
          aria-keyshortcuts="ArrowLeft" onClick={() => {
            goToPage(session.page - 1);
          }}
        >
          <span>‹</span>
          <strong>이전</strong>
        </button>
        {unansweredCount ? (
          <button type="button" onClick={goToNextUnanswered} className="native-unanswered-button">
            <span>?</span>
            <strong>미응답</strong>
            <b>{unansweredCount}</b>
          </button>
        ) : null}
        {session.mode === 'exam' ? (
          <button
            type="button"
            onClick={() => {
              m.examSheetOpen = !examSheetOpen;
            }}
            className={normalizeClass([{ active: examSheetOpen }])}
          >
            <span>OMR</span>
            <strong>답안지</strong>
            {unansweredCount ? <b>{unansweredCount}</b> : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              m.settingsOpen = true;
            }}
          >
            <span>가</span>
            <strong>글씨·설정</strong>
          </button>
        )}
        <button type="button" onClick={openCalculator}>
          <span>▦</span>
          <strong>계산기</strong>
        </button>
        {session.mode === 'exam' && activeSessionItem ? (
          <button
            type="button"
            onClick={() => {
              toggleKeep(activeSessionItem);
            }}
            className={normalizeClass([{ active: session.kept.includes(activeSessionItem.id) }])}
          >
            <span>K</span>
            <strong>킵</strong>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              m.sessionMenuOpen = true;
            }}
          >
            <span>☰</span>
            <strong>메뉴</strong>
          </button>
        )}
        <button
          type="button"
          disabled={session.page >= pageCount - 1}
          onClick={() => {
            goToPage(session.page + 1);
          }}
        >
          <span>›</span>
          <strong>다음</strong>
        </button>
      </nav>
      {solveLayoutMode === 'comcbt' ? (
        <nav aria-label="문제 페이지 이동" className="compact-session-pager">
          <button
            type="button"
            disabled={session.page === 0}
            aria-keyshortcuts="ArrowLeft" onClick={() => {
              goToPage(session.page - 1);
            }}
            className="compact-prev"
          >
            {'← '}
            <span>이전</span>
          </button>
          <div>
            <span>COMCBT PAGE</span>
            <strong>
              {session.page + 1}
              {' / '}
              {pageCount}
            </strong>
            <small>
              {answeredCount}
              {'개 완료 · '}
              {unansweredCount}개 미응답
            </small>
          </div>
          {unansweredCount ? (
            <button type="button" onClick={goToNextUnanswered} className="unanswered-jump">
              미응답
            </button>
          ) : null}
          <button
            type="button"
            disabled={session.page >= pageCount - 1}
            onClick={() => {
              goToPage(session.page + 1);
            }}
            className="compact-next"
          >
            <span>다음</span>
            {' →'}
          </button>
          {session.mode === 'learn' ? (
            <button type="button" onClick={submitLearning} className="compact-submit learning">
              학습 결과 보기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                submitExam(false);
              }}
              className="compact-submit exam"
            >
              시험 제출·채점
            </button>
          )}
        </nav>
      ) : null}
    </>
  );
}
