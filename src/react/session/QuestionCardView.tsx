import {clsx as normalizeClass} from 'clsx';
import {lazy, Suspense} from 'react';
import { problemImage, problemImageHtml } from '../../cbt/problemImages';
import ExplanationFigures from './ExplanationFigures';
import ModelSlot from '../ModelSlot';
import { createPortal } from 'react-dom';
import { AnswerChoices } from '../AnswerChoices';
import { PrintedChoices } from '../reader/PrintedChoices';
import type { QuestionCardViewModel } from './QuestionCard';

const MathFormula = lazy(() => import('../practical/MathFormula'));

export function renderQuestionCardView(m: QuestionCardViewModel) {
  const {
    active,
    additionalExplanationSections,
    answerLayout,
    beginnerCalculationAvailable,
    beginnerCalculationOpen,
    bookmarked,
    calculateAnswerHighlights,
    calculationGuide,
    calculationNumberOrigins,
    canReadQuestion,
    circles,
    closeCompactExplanation,
    closeInlineExplanation,
    combatDenseChoices,
    combatUltraShortChoices,
    compactSolveLayout,
    compactTextChoices,
    compactVisualChoices,
    confidence,
    correctSelected,
    displayNumber,
    displayedChoices,
    displayedQuestionMarkup,
    experimentalFeatures,
    explanationAutoCloseSeconds,
    explanationDismissed,
    explanationOpen,
    explanationOrigin,
    fieldReportQuestion,
    hansolQuestion,
    hasReadableChoices,
    hotspotIndicator,
    imageAnswerMode,
    imageOptions,
    imageZoomOpen,
    inlineCompactExplanation,
    issueReportDetails,
    issueReportError,
    issueReportOpen,
    issueReportSending,
    issueReportSubmitted,
    issueReportTypes,
    issueTypeOptions,
    item,
    keepExplanation,
    kept,
    mistakeReason,
    mode,
    modelLesson,
    pinSolution,
    presentation,
    primaryExplanationText,
    primaryImage,
    reactChoices,
    reopenExplanation,
    restoredImageClass,
    restoredQuestion,
    selected,
    selectedAnswerState,
    selectedAreaHighlightStyles,
    selectedMarkerStyle,
    sendIssueReport,
    showQuestionIdentity,
    solveLayout,
    sourceImageOverride,
    sourceTranscription,
    speechSpeaking,
    stopExplanationAutoClose,
    studyNote,
    subjectNumber,
    subjectStart,
    toggleIssueType,
    toggleQuestionSpeech,
    transcribedQuestion,
    transcriptionPending,
    twoColumnTextChoices,
    unifiedHotspots,
    verifiedHotspots,
  } = m;
  const CorrectionNote = presentation === 'book' ? 'details' : 'aside';
  return (
    <>
      <article
        id={m.id}
        data-react-view="question-card"
        onPointerDown={() => {
          m.onActivate?.();
        }}
        onFocus={() => {
          m.onActivate?.();
        }}
        className={normalizeClass([
          'question-card',
          {
            'image-primary': primaryImage,
            'energy-midterm-pdf-card': !!item.question.midtermPdfSources?.length,
            'compact-solve-card': compactSolveLayout,
            'combat-solve-card': solveLayout === 'combat',
            'keyboard-active': active,
            'book-question-card': presentation === 'book',
          },
        ])}
      >
        {subjectStart ? (
          <div className="subject-divider">
            <span>
              {subjectNumber || 1}
              과목
            </span>
            <strong>{item.subject}</strong>
          </div>
        ) : null}
        {presentation !== 'book' ? (
          <header className="question-head">
            {showQuestionIdentity ? (
              <div className="question-current-identity">
                <span>현재 문제</span>
                <strong>{displayNumber}번</strong>
              </div>
            ) : (
              <span aria-hidden="true" className="question-head-spacer" />
            )}
            {item.round.kind !== 'school-midterm' &&
            displayNumber &&
            displayNumber !== item.question.number ? (
              <span className="source-chip">
                {'원문 '}
                {item.question.number}번
              </span>
            ) : null}
            {!subjectStart ? <span className="source-chip subject-source-chip">{item.subject}</span> : null}
            {item.question.answerRate ? (
              <span className="answer-rate">
                {'정답률 '}
                {item.question.answerRate}%
              </span>
            ) : null}
            {fieldReportQuestion ? (
              <span className="source-chip field-report-source-chip">비공식 제보 재구성</span>
            ) : restoredQuestion ? (
              <span className="source-chip">
                CBT 복원문제
                {primaryImage ? ' · 원문 이미지' : ''}
              </span>
            ) : hansolQuestion ? (
              <span className="source-chip hansol-source-chip">한솔아카데미 원문</span>
            ) : null}
            {item.question.targetMapping ? (
              <span className="source-chip target-source-chip">
                {item.question.targetRelevance === 'core' ? '직접 연계' : '유사 보강'}
                {' · '}
                {item.question.sourceQualification}
              </span>
            ) : null}
            {item.round.kind === 'school-midterm' ? (
              <span className="source-chip school-source-chip">{item.question.sourcePage}</span>
            ) : null}
            {item.question.midtermOccurrences?.length ? (
              <details className="source-chip school-source-chip energy-occurrences">
                <summary>
                  {'나왔던 회차 '}
                  {item.question.midtermOccurrences.length}개
                </summary>
                {item.question.midtermLatestSource ? (
                  <span>
                    {'최신 출제: '}
                    {item.question.midtermLatestSource}
                    {' · '}
                  </span>
                ) : null}
                <span>{item.question.midtermOccurrences.join(' · ')}</span>
              </details>
            ) : null}
            {mode === 'learn' ? (
              <button
                type="button"
                onClick={() => {
                  m.onAskAi?.();
                }}
                className="ai-question-button"
              >
                ✦ AI 질문
              </button>
            ) : null}
            <button
              type="button"
              aria-label={bookmarked ? '북마크 제거' : '북마크 추가'}
              onClick={() => {
                m.onToggleBookmark?.();
              }}
              className={normalizeClass(['bookmark-button', { active: bookmarked }])}
            >
              ★
            </button>
            <button
              type="button"
              aria-label={kept ? '현재 문제 킵 해제' : '현재 문제를 나중에 다시 보기'}
              aria-pressed={kept}
              onClick={() => {
                m.onToggleKeep?.();
              }}
              className={normalizeClass(['keep-button', { active: kept }])}
            >
              {kept ? 'KEEP' : '킵'}
            </button>
            <button
              type="button"
              aria-expanded={issueReportOpen}
              onClick={() => {
                m.setIssueReportOpen(!issueReportOpen);
              }}
              className={normalizeClass([
                'question-issue-button',
                { active: issueReportOpen, submitted: issueReportSubmitted },
              ])}
            >
              {issueReportSubmitted ? '✓ 접수됨' : issueReportOpen ? '☑ 이상 신고' : '☐ 이상 신고'}
            </button>
          </header>
        ) : null}
        {issueReportOpen ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendIssueReport();
            }}
            className="question-issue-form"
          >
            <header>
              <div>
                <strong>이 문제에서 이상한 점을 알려주세요</strong>
                <span>여러 항목을 함께 고를 수 있습니다.</span>
              </div>
              <button
                type="button"
                aria-label="신고창 닫기"
                onClick={() => {
                  m.setIssueReportOpen(false);
                }}
              >
                ×
              </button>
            </header>
            <div aria-label="문제 유형" className="question-issue-types">
              {issueTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={issueReportTypes.includes(option.value)}
                  onClick={() => {
                    toggleIssueType(option.value);
                  }}
                  className={normalizeClass([{ active: issueReportTypes.includes(option.value) }])}
                >
                  <span>{issueReportTypes.includes(option.value) ? '✓' : '○'}</span>
                  {option.label}
                </button>
              ))}
            </div>
            <label>
              <span>무엇이 문제인가요?</span>
              <textarea
                value={issueReportDetails}
                onChange={(event) => {
                  m.setIssueReportDetails(event.currentTarget.value);
                }}
                rows={3}
                maxLength={1500}
                placeholder="예: 문제에 필요한 그림이 보이지 않습니다."
              />
            </label>
            {issueReportError ? <p className="question-issue-error">{issueReportError}</p> : null}
            <footer>
              <small>
                {issueReportDetails.length}
                /1500자 · 관리자 확인용으로만 저장됩니다.
              </small>
              <button type="submit" disabled={issueReportSending}>
                {issueReportSending ? '저장 중…' : '이상 문제 저장'}
              </button>
            </footer>
          </form>
        ) : null}
        {(item.id === 'hvac-hansol-2024-2:39' || item.id.endsWith('::hvac-hansol-2024-2:39')) && (
          <p className="reader-page-note" aria-label="문제 조건 정정">
            <strong>정압비열 0.93 kJ/(kg·K)</strong>를 사용하세요. 원문에는 0.221로 인쇄되어 있습니다.{' '}
            <a href="https://www.inup.co.kr/bookstore/reform/reform_view.jsp?id=691" target="_blank" rel="noreferrer">한솔 정오표 · 2024년 2회 39번</a>
          </p>
        )}
        {sourceTranscription?.question ? (
          <div className="question-transcription-control">
            <small>
              {transcribedQuestion
                ? sourceTranscription.status === 'reviewed'
                  ? '원문 대조 텍스트'
                  : 'OCR 임시 텍스트 · 오타 가능'
                : '원문 이미지'}
            </small>
            <button
              type="button"
              onClick={() => {
                m.setSourceImageOverride(!sourceImageOverride);
              }}
            >
              {transcribedQuestion ? '이미지로 보기' : '텍스트로 보기'}
            </button>
          </div>
        ) : null}
        <div className={normalizeClass(['question-content', { 'source-image-content': primaryImage }])}>
          {transcriptionPending ? (
            <p role="status">텍스트 확인 중…</p>
          ) : primaryImage && item.question.sourceImage ? (
            <div className="source-image-frame">
              <div className="source-image-stage">
                <img
                  ref={m.sourceImageRef}
                  src={problemImage(item.question.sourceImage)}
                  width={item.question.sourceImageSize?.[0]}
                  height={item.question.sourceImageSize?.[1]}
                  alt={`${item.question.number}번 문제 원문`}
                  loading="lazy"
                  decoding="async"
                  onLoad={(event) => {
                    calculateAnswerHighlights(event.currentTarget as HTMLImageElement);
                  }}
                  className={normalizeClass([
                    'source-question-image',
                    [restoredImageClass, { 'hansol-source-image': hansolQuestion }],
                  ])}
                />
                {unifiedHotspots.length ? (
                  <div data-react-view="printed-choices" style={{ display: 'contents' }}>
                    <PrintedChoices
                      choices={imageOptions}
                      selected={selected}
                      buttonClass="image-answer-hotspot"
                      onChoose={(n) => m.onChoose?.(n)}
                    />
                  </div>
                ) : null}
                {selected && hotspotIndicator === 'marker' && selectedMarkerStyle ? (
                  <span
                    style={selectedMarkerStyle}
                    aria-hidden="true"
                    className={normalizeClass(['image-answer-pick-marker', selectedAnswerState])}
                  >
                    ✓
                  </span>
                ) : null}
                {(selected && hotspotIndicator === 'area' ? selectedAreaHighlightStyles : []).map(
                  (highlightStyle, highlightIndex) => (
                    <span
                      key={`${selected}-${highlightIndex}`}
                      style={highlightStyle}
                      aria-hidden="true"
                      className={normalizeClass(['image-answer-area-highlight', selectedAnswerState])}
                    />
                  ),
                )}
              </div>
              <div className="source-image-actions">
                {verifiedHotspots.length && selected ? (
                  <small className="source-image-selected-answer">
                    <strong>{circles[selected - 1] || selected}번 선택됨</strong>
                    <span>같은 답을 다시 누르면 취소</span>
                  </small>
                ) : verifiedHotspots.length ? (
                  <small>
                    <span aria-hidden="true">☝</span>
                    {' 이미지의 ①·②·③·④를 눌러 답하세요'}
                  </small>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  aria-label={`${item.question.number}번 문제 원문 크게 보기`}
                  onClick={() => {
                    m.setImageZoomOpen(true);
                  }}
                  className="source-image-zoom-hint"
                >
                  ⌕ 크게 보기
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="compact-question-copy">
                <strong className="compact-question-number">{displayNumber || item.question.number}.</strong>
                <div
                  className="question-text"
                  dangerouslySetInnerHTML={{ __html: problemImageHtml(displayedQuestionMarkup) }}
                />
              </div>
              {(item.question.images || []).map((image) => (
                <img
                  key={image}
                  src={problemImage(image)}
                  alt="문제 참고 그림"
                  loading="lazy"
                  decoding="async"
                  className={normalizeClass(['question-image', restoredImageClass])}
                />
              ))}
            </>
          )}
        </div>
        {item.question.bookCorrection ? (
          <CorrectionNote className="book-correction-note">
            {presentation === 'book' ? <summary>교재 표기 안내 · 원문 비교</summary> : null}
            {mode === 'learn' ? (
              <p>{item.question.bookCorrection.note}</p>
            ) : (
              <p>
                교재와 기존 CBT의 표기 차이를 반영한 문제입니다. 자세한 대조 내용은 학습모드에서 확인할 수
                있습니다.
              </p>
            )}
            {mode === 'learn' && item.question.bookCorrection.originalImage ? (
              <details>
                <summary>수정 전 CBT 원본 비교</summary>
                <img
                  src={problemImage(item.question.bookCorrection.originalImage)}
                  alt="수정 전 CBT 원본 · 교재 정정본과 비교용"
                  loading="lazy"
                  className={normalizeClass(['source-question-image', restoredImageClass])}
                />
              </details>
            ) : null}
          </CorrectionNote>
        ) : null}
        {!transcriptionPending && (!verifiedHotspots.length || imageAnswerMode !== 'hotspot') ? (
          <div className="choice-grid-shell">
            <div
              className={normalizeClass([
                'choice-grid',
                {
                  'image-choice-grid': primaryImage && (answerLayout !== 'inline' || !hasReadableChoices),
                  'image-inline-choice-grid': primaryImage && answerLayout === 'inline' && hasReadableChoices,
                  'compact-choice-grid': twoColumnTextChoices,
                  'compact-visual-choice-grid': compactVisualChoices,
                  'combat-dense-choice-grid': combatDenseChoices,
                  'combat-ultra-choice-grid': combatUltraShortChoices,
                },
              ])}
              data-react-view="answer-choices"
            >
              <AnswerChoices options={reactChoices} choose={(n) => m.onChoose?.(n)} />
            </div>
            {compactTextChoices ? (
              <div
                ref={m.choiceLayoutProbeRef}
                aria-hidden="true"
                className="choice-grid compact-choice-grid choice-layout-probe"
              >
                {item.question.choices.map((choice, index) => (
                  <div key={index} className="choice-button">
                    <span className="choice-number">{circles[index] || index + 1}</span>
                    <span className="choice-copy">
                      <span dangerouslySetInnerHTML={{ __html: problemImageHtml(displayedChoices[index]) }} />
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {mode === 'learn' && selected && !correctSelected ? (
          <div className="retry-message">
            <strong>아직 정답이 아닙니다.</strong>
            <span>다른 보기를 선택해 보세요. 정답과 해설은 맞힌 뒤 표시됩니다.</span>
          </div>
        ) : null}
        {experimentalFeatures ? (
          <details className="beta-question-tools">
            <summary>
              <span>
                <b>BETA</b>
                <strong>내 판단·메모</strong>
              </span>
              <small>
                {confidence === 'sure'
                  ? '확신'
                  : confidence === 'unsure'
                    ? '애매'
                    : confidence === 'guess'
                      ? '찍음'
                      : studyNote
                        ? '메모 있음'
                        : '열기'}
              </small>
            </summary>
            <div className="beta-question-tools-body">
              {canReadQuestion ? (
                <button type="button" onClick={toggleQuestionSpeech} className="beta-read-aloud">
                  {speechSpeaking ? '■ 읽기 멈춤' : '🔊 문제와 보기 읽어주기'}
                </button>
              ) : null}
              {selected ? (
                <section className="beta-confidence-tools">
                  <span>이 답을 고를 때</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetConfidence?.('sure');
                      }}
                      className={normalizeClass([{ active: confidence === 'sure' }])}
                    >
                      ✓ 확신
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetConfidence?.('unsure');
                      }}
                      className={normalizeClass([{ active: confidence === 'unsure' }])}
                    >
                      △ 애매
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetConfidence?.('guess');
                      }}
                      className={normalizeClass([{ active: confidence === 'guess' }])}
                    >
                      ? 찍음
                    </button>
                  </div>
                </section>
              ) : null}
              {selected ? (
                <section className="beta-mistake-tools">
                  <span>다시 볼 이유</span>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetMistakeReason?.('concept');
                      }}
                      className={normalizeClass([{ active: mistakeReason === 'concept' }])}
                    >
                      개념
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetMistakeReason?.('formula');
                      }}
                      className={normalizeClass([{ active: mistakeReason === 'formula' }])}
                    >
                      공식·계산
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetMistakeReason?.('unit');
                      }}
                      className={normalizeClass([{ active: mistakeReason === 'unit' }])}
                    >
                      단위
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        m.onSetMistakeReason?.('careless');
                      }}
                      className={normalizeClass([{ active: mistakeReason === 'careless' }])}
                    >
                      잘못 읽음
                    </button>
                  </div>
                </section>
              ) : null}
              <label className="beta-study-note">
                <span>
                  {'내 메모 '}
                  <small>기기 간 동기화 대상 · 500자</small>
                </span>
                <textarea
                  value={studyNote || ''}
                  rows={2}
                  maxLength={500}
                  placeholder="예: 101.325는 1기압을 kPa로 쓴 값"
                  onChange={(event) => {
                    m.onUpdateStudyNote?.((event.target as HTMLTextAreaElement).value);
                  }}
                />
              </label>
            </div>
          </details>
        ) : null}
        {mode === 'learn' &&
        correctSelected &&
        (explanationDismissed || (compactSolveLayout && !inlineCompactExplanation)) ? (
          <button type="button" onClick={reopenExplanation} className="compact-explanation-trigger">
            <span>
              {'정답 '}
              {item.question.answer}번
            </span>
            <strong>해설 다시 보기</strong>
            <small>열기</small>
          </button>
        ) : null}
        {mode === 'learn' &&
        correctSelected &&
        !explanationDismissed &&
        (!compactSolveLayout || inlineCompactExplanation) ? (
          <div
            className={normalizeClass([
              'explanation-box',
              { 'comcbt-inline-explanation': inlineCompactExplanation },
            ])}
          >
            <div className="explanation-title">
              <span>
                {'정답 '}
                {item.question.answer}번
              </span>
              <strong>정답 해설</strong>
              {pinSolution && presentation !== 'book' ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    keepExplanation();
                  }}
                >
                  해설 고정
                </button>
              ) : null}
              {explanationAutoCloseSeconds ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    stopExplanationAutoClose();
                  }}
                  className="explanation-auto-close"
                >
                  {'자동 닫힘 멈추기 · '}
                  {explanationAutoCloseSeconds}초
                </button>
              ) : null}
              <button
                type="button"
                aria-label="해설 닫기"
                onClick={closeInlineExplanation}
                className="explanation-close-button"
              >
                닫기 ×
              </button>
            </div>
            {primaryExplanationText ? (
              <p className="explanation-copy beginner-primary-explanation">
                <strong>풀이</strong>
                {primaryExplanationText}
              </p>
            ) : !item.question.explanationImages?.length ? (
              <p className="explanation-copy">이 문제에는 상세 해설이 아직 등록되지 않았습니다.</p>
            ) : null}
            {item.question.explanationFormula && (
              <Suspense fallback={null}><MathFormula {...item.question.explanationFormula} /></Suspense>
            )}
            <ExplanationFigures {...{
                images: item.question.explanationImages,
                folded: item.question.originalExplanationImagesFolded,
                imageClass: restoredImageClass,
                onInteract: stopExplanationAutoClose,
              }}
            />
            {modelLesson ? (
              <ModelSlot key={item.id} {...{ kind: modelLesson, active: active, onInteract: stopExplanationAutoClose }}
              />
            ) : null}
            <details onClick={stopExplanationAutoClose} className="explanation-source-note">
              <summary>출처 보기</summary>
              <p>{explanationOrigin.detail}</p>
              {explanationOrigin.url ? (
                <a href={problemImage(explanationOrigin.url)} target="_blank" rel="noopener noreferrer">
                  문제 출처 열기 ↗
                </a>
              ) : null}
            </details>
            <div className="explanation-extra-actions">
              {beginnerCalculationAvailable ? (
                <button
                  type="button"
                  aria-expanded={beginnerCalculationOpen}
                  onClick={() => {
                    stopExplanationAutoClose();
                    m.setBeginnerCalculationOpen(!beginnerCalculationOpen);
                  }}
                  className="explanation-extra-toggle"
                >
                  <span>∑</span>
                  <strong>쉽게 풀어보기</strong>
                  <b>{beginnerCalculationOpen ? '−' : '＋'}</b>
                </button>
              ) : null}
            </div>
            {beginnerCalculationOpen && beginnerCalculationAvailable ? (
              <div className="calculation-explanation beginner-calculation-explanation">
                <div>
                  <span>공식</span>
                  <p>
                    <strong>{calculationGuide.formula}</strong>
                  </p>
                </div>
                {calculationNumberOrigins.length ? (
                  <div>
                    <span>숫자 출처</span>
                    <p>
                      {calculationNumberOrigins.map((origin) => (
                        <span key={origin} className="number-origin-line">
                          {origin}
                        </span>
                      ))}
                    </p>
                  </div>
                ) : null}
                {calculationGuide.substitution ? (
                  <div>
                    <span>계산 순서</span>
                    <p>{calculationGuide.substitution}</p>
                  </div>
                ) : null}
                {calculationGuide.unitTip ? (
                  <div>
                    <span>단위 확인</span>
                    <p>{calculationGuide.unitTip}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {additionalExplanationSections.map((section, index) => (
              <details
                key={`${section.source}-${index}`}
                onClick={stopExplanationAutoClose}
                className="source-explanation-details"
              >
                <summary>
                  <span>추가 해설</span>
                  <strong>{section.label}</strong>
                  <b>열기</b>
                </summary>
                <small>{section.source}</small>
                <p>{section.text}</p>
              </details>
            ))}
          </div>
        ) : null}
        {presentation === 'book' ? (
          <div className="book-question-tools">
            <button
              type="button"
              aria-label={bookmarked ? '북마크 제거' : '북마크 추가'}
              aria-pressed={!!bookmarked}
              onClick={() => {
                m.onToggleBookmark?.();
              }}
            >
              {bookmarked ? '★' : '☆'} <span>저장</span>
            </button>
            <button
              type="button"
              onClick={() => {
                m.onAskAi?.();
              }}
            >
              ✦ AI 질문
            </button>
            <button
              type="button"
              aria-expanded={issueReportOpen}
              onClick={() => {
                m.setIssueReportOpen(!issueReportOpen);
              }}
            >
              {issueReportSubmitted ? '✓ 접수됨' : '이상 신고'}
            </button>
          </div>
        ) : null}
        <>
          {' '}
          {createPortal(
            <>
              {explanationOpen &&
              compactSolveLayout &&
              !inlineCompactExplanation &&
              mode === 'learn' &&
              correctSelected ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${item.question.number}번 해설`}
                  onClick={(event) => {
                    if (event.target === event.currentTarget) closeCompactExplanation();
                  }}
                  className={normalizeClass([
                    'compact-explanation-backdrop',
                    { 'combat-explanation': solveLayout === 'combat' },
                  ])}
                >
                  <section className="compact-explanation-panel">
                    <header>
                      <div>
                        <span>
                          {solveLayout === 'combat'
                            ? 'MISSION DEBRIEF'
                            : `${item.subject} · ${displayNumber || item.question.number}번`}
                        </span>
                        <strong>정답 해설</strong>
                      </div>
                      <button type="button" aria-label="해설 닫기" onClick={closeCompactExplanation}>
                        ×
                      </button>
                    </header>
                    <div className="compact-explanation-scroll">
                      <div className="explanation-title">
                        <span>
                          {'정답 '}
                          {item.question.answer}번
                        </span>
                        <strong>핵심부터 차근차근 확인하세요</strong>
                        {pinSolution && presentation !== 'book' ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              keepExplanation();
                            }}
                          >
                            해설 고정
                          </button>
                        ) : null}
                        {explanationAutoCloseSeconds ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              stopExplanationAutoClose();
                            }}
                            className="explanation-auto-close"
                          >
                            {'자동 닫힘 멈추기 · '}
                            {explanationAutoCloseSeconds}초
                          </button>
                        ) : null}
                      </div>
                      {primaryExplanationText ? (
                        <p className="explanation-copy beginner-primary-explanation">
                          <strong>풀이</strong>
                          {primaryExplanationText}
                        </p>
                      ) : !item.question.explanationImages?.length ? (
                        <p className="explanation-copy">이 문제에는 상세 해설이 아직 등록되지 않았습니다.</p>
                      ) : null}
                      {item.question.explanationFormula && (
                        <Suspense fallback={null}><MathFormula {...item.question.explanationFormula} /></Suspense>
                      )}
                      <ExplanationFigures {...{
                          images: item.question.explanationImages,
                          folded: item.question.originalExplanationImagesFolded,
                          imageClass: restoredImageClass,
                          onInteract: stopExplanationAutoClose,
                        }}
                      />
                      {modelLesson ? (
                        <ModelSlot key={item.id} {...{
                            kind: modelLesson,
                            active: active,
                            onInteract: stopExplanationAutoClose,
                          }}
                        />
                      ) : null}
                      <details onClick={stopExplanationAutoClose} className="explanation-source-note">
                        <summary>출처 보기</summary>
                        <p>{explanationOrigin.detail}</p>
                        {explanationOrigin.url ? (
                          <a
                            href={problemImage(explanationOrigin.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            문제 출처 열기 ↗
                          </a>
                        ) : null}
                      </details>
                      <div className="explanation-extra-actions">
                        {beginnerCalculationAvailable ? (
                          <button
                            type="button"
                            aria-expanded={beginnerCalculationOpen}
                            onClick={() => {
                              stopExplanationAutoClose();
                              m.setBeginnerCalculationOpen(!beginnerCalculationOpen);
                            }}
                            className="explanation-extra-toggle"
                          >
                            <span>∑</span>
                            <strong>쉽게 풀어보기</strong>
                            <b>{beginnerCalculationOpen ? '−' : '＋'}</b>
                          </button>
                        ) : null}
                      </div>
                      {beginnerCalculationOpen && beginnerCalculationAvailable ? (
                        <div className="calculation-explanation beginner-calculation-explanation">
                          <div>
                            <span>공식</span>
                            <p>
                              <strong>{calculationGuide.formula}</strong>
                            </p>
                          </div>
                          {calculationNumberOrigins.length ? (
                            <div>
                              <span>숫자 출처</span>
                              <p>
                                {calculationNumberOrigins.map((origin) => (
                                  <span key={origin} className="number-origin-line">
                                    {origin}
                                  </span>
                                ))}
                              </p>
                            </div>
                          ) : null}
                          {calculationGuide.substitution ? (
                            <div>
                              <span>계산 순서</span>
                              <p>{calculationGuide.substitution}</p>
                            </div>
                          ) : null}
                          {calculationGuide.unitTip ? (
                            <div>
                              <span>단위 확인</span>
                              <p>{calculationGuide.unitTip}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {additionalExplanationSections.map((section, index) => (
                        <details
                          key={`${section.source}-${index}`}
                          onClick={stopExplanationAutoClose}
                          className="source-explanation-details"
                        >
                          <summary>
                            <span>추가 해설</span>
                            <strong>{section.label}</strong>
                            <b>열기</b>
                          </summary>
                          <small>{section.source}</small>
                          <p>{section.text}</p>
                        </details>
                      ))}
                    </div>
                    <footer>
                      <span>다른 문제는 밀리지 않습니다.</span>
                      <button type="button" onClick={closeCompactExplanation}>
                        문제로 돌아가기
                      </button>
                    </footer>
                  </section>
                </div>
              ) : null}
              {imageZoomOpen && item.question.sourceImage ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${item.question.number}번 문제 원문 확대`}
                  onClick={() => {
                    m.setImageZoomOpen(false);
                  }}
                  className="question-image-lightbox"
                >
                  <header
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <strong>{item.question.number}번 원문 이미지</strong>
                    <span>확대된 원본을 스크롤해서 확인하세요.</span>
                    <button
                      type="button"
                      aria-label="확대 이미지 닫기"
                      onClick={() => {
                        m.setImageZoomOpen(false);
                      }}
                    >
                      ×
                    </button>
                  </header>
                  <div
                    onClick={(event) => {
                      if (event.target !== event.currentTarget) return;
                      m.setImageZoomOpen(false);
                    }}
                  >
                    <img
                      src={problemImage(item.question.sourceImage)}
                      alt={`${item.question.number}번 문제 원문 확대`}
                      className={normalizeClass([
                        [restoredImageClass, { 'hansol-source-image': hansolQuestion }],
                      ])}
                    />
                  </div>
                </div>
              ) : null}
            </>,
            document.body,
          )}{' '}
        </>
      </article>
    </>
  );
}
