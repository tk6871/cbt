import {assetReading} from '../../cbt/printedStudy';
import {SourceImageStage} from '../reader/SourceImageStage';
import {questionSubject,subjectLabel} from '../../cbt/printedSubject';
import {ExplanationReadingTools} from './ExplanationReadingTools';
import {Check, Flag, Pin, Star} from 'lucide-react';
import {clsx as normalizeClass} from 'clsx';
import {lazy, Suspense} from 'react';
import { problemImage, problemImageHtml } from '../../cbt/problemImages';
import ExplanationFigures from './ExplanationFigures';
import ModelSlot from '../ModelSlot';
import { createPortal } from 'react-dom';
import { AnswerChoices } from '../AnswerChoices';
import { PrintedChoices } from '../reader/PrintedChoices';
import type { QuestionCardViewModel } from './QuestionCard';
import {StudyImageButton,StudyImageDialog} from '../StudyImageDialog';

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
    subjectStart,
    toggleIssueType,
    toggleQuestionSpeech,
    transcribedQuestion,
    transcriptionPending,
    twoColumnTextChoices,
    unifiedHotspots,
    verifiedHotspots,
  } = m;
  const { printAvailable, printText, sourcePhoto } = m;
  const keyDifference = m.print?.printedAnswer && m.print.printedAnswer !== item.question.answer
    ? <p className="printed-key-note">인쇄 정답 {circles[m.print.printedAnswer-1]} · 앱 채점 {circles[item.question.answer-1]}</p> : null;
  const supplement = m.print?.learningSolution;
  const learningSolution = supplement && <section className="printed-study">
    <strong>{supplement.label}</strong>
    <div dangerouslySetInnerHTML={{__html:problemImageHtml(supplement.html)}} />
  </section>;
  const focusStudy=m.readingSize===1 && mode==='learn' && !!m.onReadingFocus;
  const veiled=focusStudy && m.veil;
  const firstChoiceTop=imageOptions.length ? Math.min(...imageOptions.map(hit=>parseFloat(String(hit.style.top)))) : NaN;
  const canVeil=!primaryImage || Number.isFinite(firstChoiceTop);
  const readingTools = () => <ExplanationReadingTools choices={m.displayedChoices.map((html,i) =>
    (item.question.choices[i]?.images?.length || /<(?:img|svg|math|sup|sub)\b/i.test(html)) ? '' : m.readableText(html))}
    answer={item.question.answer} onInteract={stopExplanationAutoClose}/>;
  return (
    <>
      <article
        id={m.id}
        data-react-view="question-card"
        data-deferred-original={printText?.deferredOriginal || undefined}
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
        {presentation!=='book' && item.round.kind==='textbook-pages' && <small className="printed-subject">{item.question.sourcePage||item.round.title}</small>}
        {item.round.id==='school-final-forklift' && <small className="printed-subject">{item.question.sourcePage || '수업 범위 기반 · 자체 예상문제'}</small>}
        {item.round.id==='school-final-metal' && <small className="printed-subject">{item.question.sourcePage}</small>}
        {subjectStart && presentation !== 'book' ? (
          <div className="subject-divider" role="heading" aria-level={2}>
            <span>
              {questionSubject(item).ordinal ? questionSubject(item).ordinal+'과목' : '과목'}
            </span>
            <strong>{questionSubject(item).name}</strong>
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
            {!subjectStart ? <span className="source-chip subject-source-chip">{subjectLabel(questionSubject(item))}</span> : null}
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
            {m.onReadingFocus && (m.readingSize === 4 || m.readingSize === 1) && <button type="button"
              className="reading-focus" aria-label={m.readingSize === 4 ? `${displayNumber}번 한 문제로 크게 보기` : '네 문제로 돌아가기'}
              onClick={m.onReadingFocus}>{m.readingSize === 4 ? '집중 보기' : '네 문제로'}</button>}
            <span className="question-utilities">
              <button
                type="button"
                aria-label={bookmarked ? '북마크 제거' : '북마크 추가'} aria-pressed={bookmarked}
                onClick={() => {
                  m.onToggleBookmark?.();
                }}
                className={normalizeClass(['bookmark-button', { active: bookmarked }])}
              >
                <span className="utility-face"><Star size={15} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true"/></span>
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
                <span className="utility-face"><Pin size={13} fill={kept ? 'currentColor' : 'none'} aria-hidden="true"/>킵</span>
              </button>
              <button
                type="button"
                aria-expanded={issueReportOpen}
                aria-label={issueReportSubmitted ? '이상 신고 접수됨' : '이상 신고'}
                onClick={() => {
                  m.setIssueReportOpen(!issueReportOpen);
                }}
                className={normalizeClass([
                  'question-issue-button',
                  { active: issueReportOpen, submitted: issueReportSubmitted },
                ])}
              >
                <span className="utility-face">{issueReportSubmitted ? <Check size={13} aria-hidden="true"/> : <Flag size={13} aria-hidden="true"/>}{issueReportSubmitted ? '접수됨' : <><span className="utility-long-label">이상 </span>신고</>}</span>
              </button>
            </span>
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
            <strong>정압비열 0.93 kJ/(kg·K)</strong>를 사용하세요. 원문에는 0.221로 인쇄되어 있습니다.
          </p>
        )}
        {focusStudy && <details className="focus-reading-tools"><summary>집중 읽기 도구</summary>
          <div>{canVeil && <button type="button" aria-pressed={veiled} onClick={()=>m.setVeil(!veiled)}>{veiled?'보기 다시 표시':'보기 가리기'}</button>}
          <button type="button" aria-pressed={m.ruler} onClick={()=>m.setRuler(!m.ruler)}>읽기 자</button>
          {m.ruler && <label>줄 위치 <input type="range" min="0" max="100" value={m.rulerAt} onChange={e=>m.setRulerAt(Number(e.target.value))}/></label>}</div>
        </details>}
        {m.hasPartReading || printAvailable || sourceTranscription?.question ? (
          <div className="question-transcription-control">
            <small>
              {printText || transcribedQuestion || (m.hasPartReading && m.showAssetReadings)
                ? printText || m.hasPartReading || sourceTranscription?.status === 'reviewed'
                  ? printText?.sourceLabel || (printText?.partial ? '원문 부분 판독' : '원문 대조 텍스트')
                  : 'OCR 임시 텍스트 · 오타 가능'
                : '원문 이미지'}
            </small>
            <button
              hidden={!sourcePhoto && !m.hasPartReading}
              type="button"
              onClick={() => {
                m.setSourceImageOverride(!sourceImageOverride);
              }}
            >
              {printText || transcribedQuestion || (m.hasPartReading && m.showAssetReadings) ? '이미지로 보기' : '텍스트로 보기'}
            </button>
          </div>
        ) : null}
        <div className={normalizeClass(['question-content', { 'source-image-content': primaryImage }])}>
          {focusStudy && m.ruler && <i className="focus-reading-rule" aria-hidden="true" style={{top:m.rulerAt+'%'}}/>}
          {transcriptionPending ? (
            <p role="status">텍스트 확인 중…</p>
          ) : primaryImage && sourcePhoto ? (
            <div className="source-image-frame">
              <SourceImageStage onChoose={n=>m.onChoose?.(n)}>
                <img
                  ref={m.sourceImageRef}
                  src={problemImage(sourcePhoto)}
                  width={printAvailable ? undefined : item.question.sourceImageSize?.[0]}
                  height={printAvailable ? undefined : item.question.sourceImageSize?.[1]}
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
                {!veiled && unifiedHotspots.length ? (
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
                {veiled && canVeil && <span className="focus-choice-veil" style={{top:firstChoiceTop+'%'}}>보기 가림</span>}
              </SourceImageStage>
              <div className="source-image-actions">
                {verifiedHotspots.length && selected ? (
                  <small className="source-image-selected-answer">
                    <strong>{circles[selected - 1] || selected}번 선택됨</strong>
                    <span>같은 답을 다시 누르면 취소</span>
                  </small>
                ) : verifiedHotspots.length ? (
                  <small>
                    <span aria-hidden="true">☝</span>
                    {' 이미지에서 답을 누르세요 · 길게 누르면 확대'}
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
              {(printText ? (printText.figures ?? (printText.visual ? [printText.image] : [])) : item.question.images || []).map((image, index) => m.showAssetReadings && assetReading(image)?.html ? (
                <div key={index} className="printed-study" dangerouslySetInnerHTML={{__html:problemImageHtml(assetReading(image)!.html!)}} />
              ) : (
                <StudyImageButton
                  key={image}
                  src={problemImage(image)!}
                  alt="문제 참고 그림"
                  sourceClass={normalizeClass(['question-image', restoredImageClass])}
                />
              ))}
            </>
          )}
        </div>
        {!veiled && !transcriptionPending && (!verifiedHotspots.length || imageAnswerMode !== 'hotspot') ? (
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
                    <span className="choice-number">{reactChoices[index]?.marker || circles[index] || index + 1}</span>
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
        {mode === 'learn' && correctSelected ? (
        <div className="inline-explanation-slot" ref={m.explanationSlotRef}>
        {explanationDismissed || (compactSolveLayout && !inlineCompactExplanation) ? (
          <button type="button" onClick={reopenExplanation} className="compact-explanation-trigger">
            <span>
              {'정답 '}
              {item.question.answer}번
            </span>
            <strong>해설 다시 보기</strong>
            <small>열기</small>
          </button>
        ) : null}
        {!explanationDismissed &&
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
                  type="button" className="explanation-pin-button"
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
            {keyDifference}
            {m.printedSolution !== undefined ? (
              <div className="printed-study" dangerouslySetInnerHTML={{__html:problemImageHtml(m.printedSolution)}} />
            ) : primaryExplanationText ? (
              <p className="explanation-copy beginner-primary-explanation">
                <strong>{m.print ? '학습 해설' : '풀이'}</strong>
                {primaryExplanationText}
              </p>
            ) : !supplement && !item.question.explanationImages?.length ? (
              <p className="explanation-copy">이 문제에는 상세 해설이 아직 등록되지 않았습니다.</p>
            ) : null}
            {m.printedSolution === undefined && item.question.explanationFormula && (
              <Suspense fallback={null}><MathFormula {...item.question.explanationFormula} /></Suspense>
            )}
            {learningSolution}
            {readingTools()}
            <ExplanationFigures {...{
                images: m.printedSolution !== undefined ? (m.print?.solutionImage ? [m.print.solutionImage] : m.print?.solutionPages || []) : m.finalBook&&item.question.bookCorrection?undefined:item.question.explanationImages,
                folded: m.printedSolution !== undefined || item.question.originalExplanationImagesFolded,
                originalOnly: m.printedSolution !== undefined,
                imageClass: restoredImageClass,
                onInteract: stopExplanationAutoClose,
              }}
            />
            {modelLesson ? (
              <ModelSlot key={item.id} {...{ kind: modelLesson, active: active, onInteract: stopExplanationAutoClose }}
              />
            ) : null}
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

                <p>{section.text}</p>
              </details>
            ))}
          </div>
        ) : null}
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
              <span className="utility-face"><Star size={14} fill={bookmarked ? 'currentColor' : 'none'} aria-hidden="true"/>저장</span>
            </button>
            <button
              type="button"
              onClick={() => {
                m.onAskAi?.();
              }}
            >
              <span className="utility-face">✦ AI 질문</span>
            </button>
            <button
              type="button"
              aria-expanded={issueReportOpen}
              aria-label={issueReportSubmitted ? '이상 신고 접수됨' : '이상 신고'}
              onClick={() => {
                m.setIssueReportOpen(!issueReportOpen);
              }}
            >
              <span className="utility-face"><Flag size={13} aria-hidden="true"/>{issueReportSubmitted ? '접수됨' : <><span className="utility-long-label">이상 </span>신고</>}</span>
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
                            type="button" className="explanation-pin-button"
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
                      {keyDifference}
            {m.printedSolution !== undefined ? (
              <div className="printed-study" dangerouslySetInnerHTML={{__html:problemImageHtml(m.printedSolution)}} />
            ) : primaryExplanationText ? (
                        <p className="explanation-copy beginner-primary-explanation">
                          <strong>{m.print ? '학습 해설' : '풀이'}</strong>
                          {primaryExplanationText}
                        </p>
                      ) : !supplement && !item.question.explanationImages?.length ? (
                        <p className="explanation-copy">이 문제에는 상세 해설이 아직 등록되지 않았습니다.</p>
                      ) : null}
                      {m.printedSolution === undefined && item.question.explanationFormula && (
                        <Suspense fallback={null}><MathFormula {...item.question.explanationFormula} /></Suspense>
                      )}
                      {learningSolution}
            {readingTools()}
                      <ExplanationFigures {...{
                          images: m.printedSolution !== undefined ? (m.print?.solutionImage ? [m.print.solutionImage] : m.print?.solutionPages || []) : m.finalBook&&item.question.bookCorrection?undefined:item.question.explanationImages,
                          folded: m.printedSolution !== undefined || item.question.originalExplanationImagesFolded,
                originalOnly: m.printedSolution !== undefined,
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
              {imageZoomOpen && sourcePhoto && <StudyImageDialog
                src={problemImage(sourcePhoto)!} alt={`${item.question.number}번 문제 원문 확대`}
                sourceClass={normalizeClass([restoredImageClass,{'hansol-source-image':hansolQuestion}])}
                onClose={()=>m.setImageZoomOpen(false)}/>}
            </>,
            document.body,
          )}
        </>
      </article>
    </>
  );
}
