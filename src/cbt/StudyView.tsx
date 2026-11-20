import {GemLighting} from '../react/GemLighting';
import {Fragment, lazy, Suspense} from 'react';
import type {QuestionItem,StudyMode} from './types';
import {clsx as normalizeClass} from 'clsx';
import {problemImage,problemImageHtml} from './problemImages';
import QuestionCard from '../react/session/QuestionCard';
import RoundsLoading from '../react/RoundsLoading';
import ThemeStudyCover from '../react/ThemeStudyCover';
import {FinalExams} from '../react/FinalExams';
import {StudyHome} from '../react/StudyHome';
import TextbookLibrary, {getTextbookReader} from '../react/reader/TextbookLibrary';
import {RoundList} from '../react/RoundList';
import {ToolPanels} from '../react/ToolPanels';
import {SubjectPicker,MaterialSwitch} from '../react/LearningNavigation';
import {StudyTransition,StudyPortal} from '../react/StudyTransition';
import type {StudyController} from './studyController';

const CoolingMidterm=lazy(()=>import('../react/tools/CoolingMidterm'));
const CloudSyncPanel=lazy(()=>import('../react/tools/CloudSyncPanel'));
const StudySettings = lazy(()=>import('../react/tools/StudySettings'));
const SchoolExamManager = lazy(()=>import('../react/tools/SchoolExamManager'));

export function renderStudy(m:StudyController['model']) {
const TextbookReader = getTextbookReader();
const {SCHOOL_EXAM_CATALOG_KEY, activeStudyGuide, aiImageBusy, aiPromptHasImage, aiPromptOpen, aiPromptText, androidApkPopupOpen, androidApkUrl, animateViewDetails, answerLayout, appHydrating, applyPreset, applyUpdate, availableYears, beginSession, betaViewModel, bookForStudyId, calculationViewModel, canShareAiQuestion, catalogDisplayQuestionCount, catalogs, changeContextQualification, changeSetting, checkForUpdate, chooseTextbookAnswer, choosingTextbook, clearSavedLearningSession, closeTextbookReader, closeTool, coachViewModel, coolingArchive, coolingCompleted, coolingError, coolingItems, coolingLoading, coolingSafetyPool, coolingSavedSession, coolingUnusedIds, coolingWrongIds, copyAiPrompt, copyAiQuestionImage, currentSunjaeImage, currentVersion, curriculum, darkActive, dynamicUiEnabled, energyCalculationExcluded, energyCalculationReviewItems, energyCalculationReviewOpen, energyDefaultCalculationExcluded, energyMidtermBookCount, energyMidtermDirectCount, energyMidtermEligibleQuestions, energyMidtermPdfCount, energyMidtermPriorityGroups, energyMidtermQuestionCount, energyMidtermRelatedCount, energySourceMode, examResult, examSessionViewModel, examSheetOpen, experienceTransitionPhase, experimentalFeaturesEnabled, gradeViewModel, guideError, guideLoaded, guideLoading, guideViewModel, historyViewModel, homeScopeTrigger, hotspotIndicator, hvacPracticalAvailable, importLearningData, includeHansolInRandom, isJewelry, learningImportInput, loadCoolingMidterm, loadCurrentScope, loadTextbookPages, mobileMenuOpen, nativeCalculatorOpen, nativeMoreOpen, officialExamQuestionCount, officialRule, openAiAssistant, openCalculator, openCoolingSearch, openPwaRecoveryFromError, openQualificationRounds, openRegularRounds, openSchoolSetSearch, openTextbookPages, openView, panelCalculator, panelNotes, patchViewModel, pendingQualification, pinnedSolution, practicalSolving, predictionRange, preferredPageSize, prepareAiQuestion, problemImage, pwaRegistrationError, qualificationGroups, qualificationLoadError, qualificationLoadPercent, qualificationMeta, quickPreset, rangeRounds, reactHome, renderBetaView, renderCalculationView, renderCoachView, renderExamSessionView, renderGradeView, renderGuideView, renderHistoryView, renderPatchView, renderSearchView, renderShowcaseView, renderStatsView, renderWrongView, replayHistoryRecord, resetCoolingDraws, resolvedDisplayMode, responsiveImageAttrs, restoreOriginalImage, restoredImageTheme, resumeCoolingArchived, resumeSavedLearning, retryStudyGuide, roundCards, roundsCollection, savedLearningSession, schoolExamData, scopeError, scopeLoading, searchViewModel, selectQualification, selectTextbook, selectedCatalog, selectedItems, selectedKey, selectedSubjects, session, setAllEnergyCalculations, settingsAction, settingsContext, settingsExpanded, settingsOpen, settingsValues, shareAiQuestion, showAndroidApkPopup, showHydrationSkeleton, showcaseViewModel, sidebarThemeStyle, simpsonsBurnsImage, simpsonsFunnyImageAt, simpsonsKingSizeImage, simpsonsThemeImage, solveLayoutMode, spaceName, spaceScope, startBalancedExam, startCoolingMidterm, startEnergyMidterm, startHvacPrediction60, startRandomLearning60, startRangeLearning, startSchoolExamRound, startSchoolQuestionSet, startTextbookReader, stats, statsViewModel, studyGuideAvailable, studyStore, subjectQuestionCount, sunjaeImageAt, sunjaeImageIndex, sunjaePortraitImageAt, sunjaeRotationLabel, sunjaeRotationSeconds, textbookError, textbookItems, textbookKey, textbookLoading, textbookModule, textbookPagesOpen, textbookReaderOpen, themeBackdropStyle, toastMessage, toggleBookmark, toggleLightDark, updateAvailable, updateChecking, updateQualificationFromSetup, updateSchoolExamData, view, viewTitle, viewTransitionName, visibleRounds, visualStyle, visualTransitionPhase, visualTransitionTarget, wrongViewModel, yearFrom, yearTo}=m;
return <>
{visualStyle !== 'default' && <div className="fan-wallpaper" aria-hidden="true" style={themeBackdropStyle}/>}
{(!session && !textbookReaderOpen) ? (<div style={themeBackdropStyle} className={normalizeClass(["app-frame", {
      'practical-solving': practicalSolving,
      'visual-style-leaving': visualTransitionPhase === 'leaving',
      'visual-style-entering': visualTransitionPhase === 'entering',
      'style-to-simpsons': visualTransitionTarget === 'simpsons',
      'style-to-sunjae': visualTransitionTarget === 'sunjae',
      'style-to-default': visualTransitionTarget === 'default',
      'experience-home-leaving': experienceTransitionPhase === 'home-leaving',
      'experience-home-entering': experienceTransitionPhase === 'home-entering',
    }])}><StudyPortal disabled={!mobileMenuOpen}><>{(!practicalSolving) ? (<aside key={mobileMenuOpen ? 'mobile-open' : 'site-menu'} style={sidebarThemeStyle} onKeyDown={event => { if(event.key !== 'Escape') return; event.stopPropagation(); m.mobileMenuOpen = false; }} className={normalizeClass(["sidebar", { open: mobileMenuOpen, 'theme-photo-rail': visualStyle !== 'default' }])}>{(mobileMenuOpen) ? (<button type={"button"} aria-label={"메뉴 닫기"} onClick={() => { m.mobileMenuOpen = false; }} className={"mobile-menu-close"}>{"메뉴 닫기 ×"}</button>) : null}
<button type={"button"} onClick={() => { openView('home'); }} className={"brand"}><span >{(visualStyle === 'sunjae') ? (<img key={`sunjae-brand-${sunjaeImageIndex}`} {...responsiveImageAttrs(currentSunjaeImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(currentSunjaeImage)} alt={""}/>) : (visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsKingSizeImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsKingSizeImage)} alt={""}/>) : <Fragment >{isJewelry ? 'GEM' : 'CBT'}</Fragment>}</span>
<div ><strong >{spaceName}</strong>
<small >{visualStyle === 'simpsons' ? 'SPRINGFIELD STUDY' : visualStyle === 'sunjae' ? 'LOVELY RUNNER STUDY' : isJewelry ? 'JEWELRY STUDY' : 'SMART STUDY'}</small></div></button>
{(visualStyle === 'simpsons') ? (<figure className={"theme-sidebar-feature simpsons-sidebar-feature"}><img {...responsiveImageAttrs(simpsonsKingSizeImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsKingSizeImage)} alt={"꽃무늬 옷을 입은 킹 사이즈 호머 심슨"}/>
<figcaption ><strong >{"KING-SIZE HOMER"}</strong>
<small >{"공부할 준비부터 하자!"}</small></figcaption></figure>) : (visualStyle === 'sunjae') ? (<figure className={"theme-sidebar-feature sunjae-sidebar-feature"}><StudyTransition name={"sunjae-photo-fade"} stageKey={`sunjae-sidebar-${currentSunjaeImage}`} ><img key={`sunjae-sidebar-${currentSunjaeImage}`} {...responsiveImageAttrs(currentSunjaeImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(currentSunjaeImage)} alt={"선재 테마 메뉴의 류선재·변우석 사진"}/></StudyTransition>
<figcaption ><strong >{"오늘도 나랑 같이 달릴래?"}</strong>
<small >{sunjaeRotationSeconds ? `${sunjaeRotationLabel(sunjaeRotationSeconds)}마다 내가 찾아올게` : '오늘은 이 모습으로 기다릴게'}</small></figcaption></figure>) : null}
<nav ><button onClick={() => { openView('home'); }} className={normalizeClass([{ active: view === 'home' }])}><span data-theme-symbol={"⌂"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(0), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(0))} alt={""} className={"theme-nav-character simpsons-scene-grin"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-home-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""} className={"theme-nav-character crop-sunjae-face"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-home"}/>}</span>
{"홈"}</button>
<button onClick={() => { void openRegularRounds(); }} className={normalizeClass([{ active: view === 'rounds' }])}><span data-theme-symbol={"▤"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(1), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(1))} alt={""} className={"theme-nav-character simpsons-scene-cool"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-rounds-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(1), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={""} className={"theme-nav-character crop-sunjae-night"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-rounds"}/>}</span>
{"회차별 문제"}</button>
{(!isJewelry) ? (<button onClick={() => { openView('school'); }} className={normalizeClass([{ active: view === 'school' }])}><span data-theme-symbol={"✎"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(6), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(6))} alt={""} className={"theme-nav-character simpsons-scene-doctor"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-school"}/>}</span>
{"기말고사"}</button>) : null}
<button onClick={() => { openView('history'); }} className={normalizeClass([{ active: view === 'history' }])}><span data-theme-symbol={"◴"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(8), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(8))} alt={""} className={"theme-nav-character simpsons-scene-exercise"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-history-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(3), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(3))} alt={""} className={"theme-nav-character crop-sunjae-face"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-history"}/>}</span>
{"복습·학습 내역"}</button>
<button onClick={() => { openView('wrong'); }} className={normalizeClass([{ active: view === 'wrong' }])}><span data-theme-symbol={"!"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(2), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(2))} alt={""} className={"theme-nav-character simpsons-scene-phone"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-wrong-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(2), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(2))} alt={""} className={"theme-nav-character crop-sunjae-sad"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-wrong"}/>}</span>
{"오답노트 "}
{(stats.wrong) ? (<b >{stats.wrong}</b>) : null}</button>
<button onClick={() => { openView('search'); }} className={normalizeClass([{ active: view === 'search' }])}><span data-theme-symbol={"⌕"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(3), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(3))} alt={""} className={"theme-nav-character simpsons-scene-bart"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-search-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(3), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(3))} alt={""} className={"theme-nav-character crop-sunjae-face"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-search"}/>}</span>
{"문제 검색"}</button>
<button onClick={() => { openView('calculation'); }} className={normalizeClass([{ active: view === 'calculation' }])}><span data-theme-symbol={"∑"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(4), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(4))} alt={""} className={"theme-nav-character simpsons-scene-doctor"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-calculation-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""} className={"theme-nav-character crop-sunjae-cherry"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-calculation"}/>}</span>
{"계산문제만 풀기"}</button>
{(studyGuideAvailable) ? (<button onClick={() => { openView('guide'); }} className={normalizeClass([{ active: view === 'guide' }])}><span data-theme-symbol={"▣"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(5), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(5))} alt={""} className={"theme-nav-character simpsons-scene-hardhat"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-guide-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(1), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={""} className={"theme-nav-character crop-sunjae-cherry"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-guide"}/>}</span>
{"시험 자료실"}</button>) : null}
<button onClick={() => { openView('updates'); }} className={normalizeClass([{ active: view === 'updates' }])}><span data-theme-symbol={"◷"}>{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(7), '64px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(7))} alt={""} className={"theme-nav-character simpsons-scene-exhausted"}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-updates-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""} className={"theme-nav-character crop-sunjae-night"}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-updates"}/>}</span>
{"패치노트"}</button></nav>
<a href={problemImage(isJewelry ? 'index.html' : 'jewelry.html')} className={"space-portal"}><span >{isJewelry ? 'CBT' : '◇'}</span>
<div ><strong >{isJewelry ? '산업기사 CBT' : '보석관'}</strong>
<small >{"독립 학습 페이지로 이동"}</small></div>
<b >{"›"}</b></a>
<div className={"sidebar-foot"}><button type={"button"} onClick={openCalculator}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(4), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(4))} alt={""}/>) : <Fragment >{"▦"}</Fragment>}</span>
{"공학용 계산기"}</button>
<button type={"button"} onClick={() => { openView('settings'); }} className={normalizeClass([{ active: view === 'settings' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsBurnsImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsBurnsImage)} alt={""}/>) : <Fragment >{"⚙"}</Fragment>}</span>
{"전체 설정"}</button></div></aside>) : null}
{(mobileMenuOpen) ? (<button aria-label={"메뉴 닫기"} onClick={() => { m.mobileMenuOpen = false; }} className={"mobile-backdrop"}/>) : null}</></StudyPortal>
<main inert={mobileMenuOpen} className={"main-area"}>{(!practicalSolving) ? (<header className={"topbar"}><i className="window-lights" aria-hidden="true"/><button type={"button"} aria-label={"메뉴 열기"} onClick={() => { m.mobileMenuOpen = true; }} className={"menu-button"}>{"☰ "}
<span >{"메뉴"}</span></button>
<div className={"topbar-context"}><strong >{viewTitle}</strong>
<SubjectPicker {...{groups:qualificationGroups,selected:selectedKey,name:view==='school'?'기말고사':selectedCatalog.name,onSelect:changeContextQualification}}/></div>
<div className={"top-actions"}><button type={"button"} aria-label={"문제 검색 열기"} onClick={() => { openView('search'); }}>{"⌕ "}
<span >{"검색"}</span></button>
<button type={"button"} aria-label={"공학용 계산기 열기"} onClick={openCalculator}>{"▦ "}
<span >{"계산기"}</span></button>
<button type={"button"} aria-label={darkActive ? '라이트 모드로 전환' : '다크 모드로 전환'} onClick={toggleLightDark} className={"theme-quick-button"}>{darkActive ? '☀' : '☾'}
{" "}
<span >{darkActive ? '라이트 모드' : '다크 모드'}</span></button>
{(view !== 'settings') ? (<button type={"button"} aria-label={"설정 열기"} onClick={() => { m.settingsOpen = true; }}>{"⚙ "}
<span >{"설정"}</span></button>) : null}</div></header>) : null}
{(pendingQualification) ? (<RoundsLoading {...{"percent": qualificationLoadPercent}}/>) : null}
{(scopeError && selectedCatalog.isPlaceholder && !(view==='rounds' && textbookPagesOpen)) ? (<p role={"alert"}>{scopeError}
{" "}
<button type={"button"} onClick={loadCurrentScope}>{"다시 불러오기"}</button></p>) : null}
{(qualificationLoadError) ? (<p role={"alert"}>{qualificationLoadError}</p>) : null}
<div className={normalizeClass(["page-content", { 'mobile-book-navigation': resolvedDisplayMode === 'mobile' && view === 'rounds' && textbookPagesOpen }])}>{(selectedKey === 'maintenance-engineer' && !session) ? (<p role={"note"} className={"qualification-scope-notice"}>{"설비보전기사 수록 범위: 2006~2022년 공개 기출 27회차. 2022년 4과목과 이전 5과목을 구분합니다. 2025년부터 개편된 현행 과목과는 다르며, 최신 시험 준비 시 출제기준을 함께 확인하세요."}</p>) : null}
{(selectedKey === 'safety-engineer' && !session) ? (<p role={"note"} className={"qualification-scope-notice"}>{"산업안전기사 2018~2022년 구 6과목 기출. 현행 모의시험이 아니며, 법령 문항의 답은 출제 당시 기준일 수 있습니다. "}
<a href={"https://safetygwajang.com/?audience=jobseeker"} target={"_blank"} rel={"noopener noreferrer"}>{"회차 자료: 안전과장"}</a></p>) : null}
{(showHydrationSkeleton) ? (<div aria-label={"학습 화면을 준비하는 중"} className={"dashboard-skeleton"}><i className={"skeleton-title"}/>
<i />
<i />
<i />
<i className={"skeleton-wide"}/></div>) : <StudyTransition name={viewTransitionName} stageKey={view} afterEnter={()=>{animateViewDetails(view)}}><div key={view} data-entrance={viewTransitionName ? view : undefined} className={normalizeClass(["view-stage", { 'sunjae-fan-dashboard': visualStyle === 'sunjae' && view === 'home', 'simpsons-fan-dashboard': visualStyle === 'simpsons' && dynamicUiEnabled && view === 'home' }])}>{(view === 'settings') ? (<Suspense fallback={<p role="status">설정을 불러오는 중…</p>}><StudySettings {...{"mode": "page", "values": settingsValues, "context": settingsContext, "onChange": changeSetting, "onAction": settingsAction}}><Suspense fallback={null}><CloudSyncPanel description="로그인 없이도 공부할 수 있습니다. 다른 기기와 기록을 연결할 때만 로그인하세요."/></Suspense></StudySettings></Suspense>) : (view === 'home') ? (<Fragment >{(visualStyle === 'default') ? (<div data-react-view="study-home"><StudyHome {...reactHome}/></div>) : null}
{(visualStyle==='simpsons'||visualStyle==='sunjae') ? (<ThemeStudyCover {...{"styleName": visualStyle, "subject": selectedKey, "subjectName": selectedCatalog.name, "jewelry": isJewelry, "portrait": visualStyle==='sunjae'?currentSunjaeImage:'assets/theme/simpsons/springfield.webp', "answered": stats.answered, "accuracy": stats.accuracy, "onResume": savedLearningSession ? resumeSavedLearning : undefined, "onRounds": openRegularRounds, "onSecondary": () => { isJewelry?openView('wrong'):openTextbookPages(); }, "onSettings": () => { m.settingsOpen=true; }}}/>) : null}
{isJewelry && <GemLighting/>}
{(visualStyle === 'sunjae' && dynamicUiEnabled) ? (<section className={"sunjae-fan-home"}><div className={"sunjae-fan-workspace"}><section className={"sunjae-qualification-album"}><header ><div ><span >{"01 · PICK OUR COURSE"}</span>
<h2 >{"오늘 나랑 어떤 종목 달릴래?"}</h2></div>
<p >{"사진을 넘기듯 골라봐. 고르면 내가 공부 범위를 바로 바꿔줄게."}</p></header>
<div className={"sunjae-album-track"}>{qualificationGroups.flatMap(group => group.items).map((catalog, catalogIndex) => <button key={catalog.key} type={"button"} onClick={() => { selectQualification(catalog.key); }} className={normalizeClass([{ selected: selectedKey === catalog.key }])}><img {...responsiveImageAttrs(sunjaeImageAt(catalogIndex + 1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaeImageAt(catalogIndex + 1))} alt={""}/>
<span >{selectedKey === catalog.key ? '우리 오늘 이거 하자' : '같이 골라볼래?'}</span>
<strong >{catalog.name}</strong>
<small >{catalog.roundCount ?? catalog.rounds.length}
{"회차 · "}
{catalogDisplayQuestionCount(catalog).toLocaleString()}
{"문제"}</small></button>)}</div></section>
<section className={"sunjae-study-ticket"}><div className={"sunjae-ticket-photo"}><img {...responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={"공부 계획을 함께 고르는 선재"}/>
<p ><strong >{"범위는 내가 정리해둘게."}</strong>
<span >{"너는 시작 버튼만 눌러. 나랑 끝까지 가자."}</span></p></div>
<div className={"sunjae-ticket-controls"}><header ><span >{"02 · MAKE OUR PLAN"}</span>
<h2 >{"우리 오늘 공부 약속"}</h2></header>
<div className={"sunjae-ticket-presets"}><button onClick={() => { applyPreset(5); }} className={normalizeClass([{ active: quickPreset === 5 }])}>{"최근 5년"}</button>
<button onClick={() => { applyPreset(10); }} className={normalizeClass([{ active: quickPreset === 10 }])}>{"최근 10년"}</button>
<button onClick={() => { applyPreset(0); }} className={normalizeClass([{ active: quickPreset === 0 }])}>{"전체"}</button></div>
<div className={"sunjae-ticket-fields"}><label ><span >{"종목"}</span>
<select value={selectedKey} onChange={e=>updateQualificationFromSetup(e.nativeEvent)}>{qualificationGroups.flatMap(group => group.items).map((catalog) => <option key={catalog.key} value={catalog.key}>{catalog.name}</option>)}</select></label>
<label ><span >{"시작"}</span>
<select value={yearFrom} onChange={event => { m.yearFrom = Number(event.currentTarget.value) as typeof yearFrom; }}>{([...availableYears].reverse()).map((year) => <option key={year} value={year}>{year}
{"년"}</option>)}</select></label>
<label ><span >{"끝"}</span>
<select value={yearTo} onChange={event => { m.yearTo = Number(event.currentTarget.value) as typeof yearTo; }}>{(availableYears).map((year) => <option key={year} value={year}>{year}
{"년"}</option>)}</select></label>
<label ><span >{"출제 체계"}</span>
<select value={curriculum} onChange={event => { m.curriculum = event.currentTarget.value as typeof curriculum; }}><option value={"all-mapped"}>{selectedCatalog.isVirtual ? '통폐합 목표 과목 · 유사 보강 포함' : ((selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? '통합 3과목 · 구문제 포함' : (selectedKey === 'information-engineer' ? '현행 5과목 · 구문제 연결' : '전체 기출문제 포함'))}</option>
{(!selectedCatalog.isVirtual) ? (<option value={"current"}>{selectedKey === 'maintenance-engineer' ? '수록 최신 4과목 · 2022년' : '현재 과목 체계만'}</option>) : null}
{(selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? (<option value={"legacy-original"}>{"구 4과목 원형"}</option>) : null}
{(selectedKey === 'information-engineer' || selectedKey === 'maintenance-engineer') ? (<option value={"legacy-original"}>{"구 5과목 원형"}</option>) : null}</select></label></div>
<div className={"sunjae-ticket-summary"}><span ><b >{yearFrom}
{"~"}
{yearTo}</b>
{"년"}</span>
<span ><b >{rangeRounds.length}</b>
{"회차"}</span>
<span ><b >{selectedItems.length.toLocaleString()}</b>
{"문제"}</span></div></div></section>
<section className={"sunjae-choose-together"}><header ><span >{"03 · WHAT SHALL WE DO?"}</span>
<h2 >{"오늘 나랑 뭐 할래?"}</h2>
<p >{"네가 고르면 바로 옆에서 같이 시작할게."}</p></header>
<div ><button type={"button"} onClick={startRangeLearning}><img {...responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""}/>
<span >{"천천히 같이 보자"}</span>
<strong >{"학습모드"}</strong>
<small >{"즉시 채점 · 쉬운 해설"}</small></button>
<button type={"button"} onClick={startRandomLearning60}><img {...responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""}/>
<span >{"오늘은 딱 60문제"}</span>
<strong >{"랜덤 60문제"}</strong>
<small >{"과목 균형 · 자동 이어하기"}</small></button>
<button type={"button"} onClick={startBalancedExam}><img {...responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={""}/>
<span >{"내가 채점해줄게"}</span>
<strong >{"랜덤시험"}</strong>
<small >{"과목 균형 · OMR · 타이머"}</small></button>
<button type={"button"} onClick={() => { void openRegularRounds(); }}><img {...responsiveImageAttrs(sunjaePortraitImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(2))} alt={""}/>
<span >{"원하는 날을 골라"}</span>
<strong >{"회차별 문제"}</strong>
<small >{yearFrom}
{"~"}
{yearTo}
{"년"}</small></button>
<button type={"button"} onClick={() => { openView('wrong'); }}><img {...responsiveImageAttrs(sunjaePortraitImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(3))} alt={""}/>
<span >{"이번엔 같이 맞히자"}</span>
<strong >{"오답만 보기"}</strong>
<small >{stats.wrong.toLocaleString()}
{"문제 기다리는 중"}</small></button></div></section>
<section className={"sunjae-memory-wall"}><div ><span >{"04 · OUR RECORD"}</span>
<h2 >{"우리 같이 달린 만큼"}</h2>
<p >{"오늘도 여기까지 온 거, 내가 다 기억하고 있어."}</p>
<div className={"progress-track"}><i style={{ width: `${stats.coverage}%` }}/></div>
<strong >{stats.coverage}
{"%"}</strong></div>
<dl ><div ><dt >{"전체"}</dt>
<dd >{stats.total.toLocaleString()}</dd></div>
<div ><dt >{"푼 문제"}</dt>
<dd >{stats.answered.toLocaleString()}</dd></div>
<div ><dt >{"맞힌 문제"}</dt>
<dd >{stats.correct.toLocaleString()}</dd></div>
<div ><dt >{"북마크"}</dt>
<dd >{stats.bookmarks.toLocaleString()}</dd></div></dl>
<img {...responsiveImageAttrs(sunjaeImageAt(8), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaeImageAt(8))} alt={"학습 기록 옆의 변우석 사진"}/></section>
<section className={normalizeClass(["sunjae-release-note", { ready: updateAvailable }])}><span >{updateAvailable ? '새 소식이 왔어' : `지금은 v${currentVersion} 최신이야`}</span>
<strong >{updateAvailable ? '내가 새 화면을 준비했어. 같이 보러 갈래?' : '업데이트도 내가 확인해둘게.'}</strong>
<div >{(updateAvailable) ? (<button onClick={applyUpdate}>{"새 버전 적용"}</button>) : <button disabled={updateChecking} onClick={() => { checkForUpdate(true); }}>{updateChecking ? '확인 중…' : '업데이트 확인'}</button>}
<button onClick={() => { openView('updates'); }}>{"우리 기록 보기"}</button></div></section></div></section>) : null}
{(visualStyle !== 'default' && (visualStyle !== 'sunjae' || !dynamicUiEnabled)) ? (<section className={"qualification-section"}><div className={"section-title"}><div ><h1 >{"종목 선택"}</h1>
<p >{"종목을 누르면 회차와 문제를 볼 수 있습니다."}</p></div>
<div className={"compact-stats"}><span >{"학습"}
<strong >{stats.answered.toLocaleString()}</strong></span>
<span >{"정답률"}
<strong >{stats.accuracy}
{"%"}</strong></span>
<span >{"오답"}
<strong >{stats.wrong.toLocaleString()}</strong></span></div></div>
<div className={"subject-groups"}>{(qualificationGroups).map((group) => <section key={group.label} className={"subject-group"}><h3 >{group.label}</h3>
<div className={"qualification-grid"}>{(group.items).map((catalog, catalogIndex) => <button key={catalog.key} type={"button"} aria-pressed={selectedKey === catalog.key} onClick={() => { selectQualification(catalog.key); }} className={normalizeClass(["qualification-card", [qualificationMeta[catalog.key]?.className, { selected: selectedKey === catalog.key }]])}>{(visualStyle === 'sunjae') ? (<img {...responsiveImageAttrs(sunjaeImageAt(catalogIndex + 1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaeImageAt(catalogIndex + 1))} alt={""} className={"sunjae-card-photo"}/>) : (visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(catalogIndex), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(catalogIndex))} alt={""} className={"simpsons-card-photo"}/>) : null}
<span className={"qualification-icon"}>{qualificationMeta[catalog.key]?.icon}</span>
<span className={"qualification-copy"}><strong >{catalog.name}</strong>
<small >{catalog.roundCount ?? catalog.rounds.length}
{catalog.key === 'energy-midterm' ? '주제' : '회차'}
{" · "}
{catalogDisplayQuestionCount(catalog).toLocaleString()}
{"문제"}</small>
<em >{qualificationMeta[catalog.key]?.description}</em></span>
<b aria-hidden={"true"}>{selectedKey === catalog.key ? '✓' : '›'}</b></button>)}</div></section>)}</div></section>) : null}
{(savedLearningSession) ? (<section className={"resume-learning-card"}><div ><span >{"자동 저장된 "}
{savedLearningSession.mode === 'exam' ? 'CBT 시험' : '학습'}</span>
<strong >{savedLearningSession.title}</strong>
<small >{Object.keys(savedLearningSession.answers).length}
{" / "}
{savedLearningSession.itemIds.length}
{"문제 풀이 · 다른 기기에서도 이어집니다"}</small></div>
<button type={"button"} onClick={resumeSavedLearning}>{"이어서 풀기"}</button>
<button type={"button"} onClick={clearSavedLearningSession} className={"secondary"}>{"기록 지우기"}</button></section>) : null}
{(selectedCatalog.isPlaceholder) ? (<section className={"study-builder"}><button ref={m.setHomeScopeTrigger} type={"button"} disabled={scopeLoading} onClick={loadCurrentScope}>{scopeLoading?'학습 범위를 불러오는 중…':'연도와 출제 체계 설정'}</button></section>) : ((visualStyle !== 'sunjae' || !dynamicUiEnabled) && selectedKey !== SCHOOL_EXAM_CATALOG_KEY) ? (<section className={"study-builder"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(4), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(4))} alt={"공부 계획을 확인하는 닥터 닉"} className={"simpsons-builder-mascot"}/>) : null}
<div className={"builder-heading"}><div ><span >{"STUDY SETUP"}</span>
<h2 >{"연도와 출제 체계를 정하세요"}</h2></div>
<div className={"preset-buttons"}><button onClick={() => { applyPreset(5); }} className={normalizeClass([{ active: quickPreset === 5 }])}>{"최근 5년"}</button>
<button onClick={() => { applyPreset(10); }} className={normalizeClass([{ active: quickPreset === 10 }])}>{"최근 10년"}</button>
<button onClick={() => { applyPreset(0); }} className={normalizeClass([{ active: quickPreset === 0 }])}>{"전체"}</button></div></div>
<div className={"builder-controls"}><label className={"qualification-control"}><span >{"자격증 종목"}</span>
<select value={selectedKey} onChange={e=>updateQualificationFromSetup(e.nativeEvent)}>{qualificationGroups.flatMap(group => group.items).map((catalog) => <option key={catalog.key} value={catalog.key}>{catalog.name}</option>)}</select></label>
<label ><span >{"시작 연도"}</span>
<select value={yearFrom} onChange={event => { m.yearFrom = Number(event.currentTarget.value) as typeof yearFrom; }}>{([...availableYears].reverse()).map((year) => <option key={year} value={year}>{year}
{"년"}</option>)}</select></label>
<span className={"range-arrow"}>{"→"}</span>
<label ><span >{"끝 연도"}</span>
<select value={yearTo} onChange={event => { m.yearTo = Number(event.currentTarget.value) as typeof yearTo; }}>{(availableYears).map((year) => <option key={year} value={year}>{year}
{"년"}</option>)}</select></label>
<label className={"curriculum-control"}><span >{"출제 체계"}</span>
<select value={curriculum} onChange={event => { m.curriculum = event.currentTarget.value as typeof curriculum; }}><option value={"all-mapped"}>{selectedCatalog.isVirtual ? '통폐합 목표 과목 · 유사 보강 포함' : ((selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? '통합 3과목 · 구문제 포함' : '전체 기출문제 포함')}</option>
{(!selectedCatalog.isVirtual) ? (<option value={"current"}>{selectedKey === 'maintenance-engineer' ? '수록 최신 4과목 · 2022년' : '현재 과목 체계만'}</option>) : null}
{(selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? (<option value={"legacy-original"}>{"구 4과목 원형"}</option>) : null}
{(selectedKey === 'information-engineer' || selectedKey === 'maintenance-engineer') ? (<option value={"legacy-original"}>{"구 5과목 원형"}</option>) : null}</select></label></div>
<div className={"scope-summary"}><div ><span >{"선택 범위"}</span>
<strong >{yearFrom}
{"~"}
{yearTo}
{"년"}</strong>
<small >{rangeRounds.length}
{"회차 사용"}</small></div>
<div ><span >{"출제 가능"}</span>
<strong >{selectedItems.length.toLocaleString()}
{"문제"}</strong>
<small >{officialRule?.scoring === 'total-only' ? `공식 ${officialExamQuestionCount}문제 구성` : '과목별 균형 출제'}</small></div>
<div ><span >{"실전 구성"}</span>
<strong >{officialRule?.scoring === 'total-only' ? `${officialExamQuestionCount}문제` : `${selectedSubjects.length}과목 × 20문제`}</strong>
<small >{officialRule?.note || '공식 기준 확인 필요'}</small></div></div>
{(selectedCatalog.isVirtual) ? (<p className={"target-exam-note"}>{" 보석감정사 옛 4과목은 현재 큐넷 4과목으로 직접 통폐합하고, 귀금속가공 3종목의 보석 관련 문항만 유사 보강으로 사용합니다. 실전 랜덤시험은 과목마다 직접 연계 15문제와 유사 보강 최대 5문제를 섞습니다. "}</p>) : null}
<div className={"subject-strip"}>{(selectedSubjects).map((subject, index) => <article key={subject}><span >{index + 1}
{"과목"}</span>
<strong >{subject}</strong>
<small >{subjectQuestionCount(subject).toLocaleString()}
{"문제"}</small></article>)}</div>
{(selectedKey === 'hvac') ? (<label className={"hansol-random-toggle"}><input checked={includeHansolInRandom} onChange={event => { m.includeHansolInRandom = event.currentTarget.checked as typeof includeHansolInRandom; }} type={"checkbox"}/>
<span ><strong >{"랜덤 문제에 한솔 섞기"}</strong>
<small >{"ON이면 현재 선택한 "}
{yearFrom}
{"~"}
{yearTo}
{"년에 해당하는 한솔 문제도 후보에 합치며, 같은 문제는 한 번만 남깁니다."}</small></span>
<i aria-hidden={"true"}/></label>) : null}
<div className={"start-actions"}><button type={"button"} onClick={startRangeLearning} className={"learning-start"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(1))} alt={""} className={"simpsons-action-photo"}/>) : null}
<span >{"차근차근 익히기"}</span>
<strong >{"선택 범위 학습모드"}</strong>
<small >{"한 화면 "}
{preferredPageSize}
{"문제 · 즉시 채점 · 쉬운 해설"}</small></button>
<button type={"button"} onClick={startRandomLearning60} className={"random-learning-start"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(8), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(8))} alt={""} className={"simpsons-action-photo"}/>) : null}
<span >{"연도 범위에서 골고루"}</span>
<strong >{"랜덤 60문제 학습"}</strong>
<small >{selectedKey === 'hvac' && includeHansolInRandom ? '일반 공조 + 한솔 후보' : (officialRule?.scoring === 'total-only' ? `공식 ${officialExamQuestionCount}문제 구성` : '과목 균형')}
{" · 즉시 채점 · 자동 이어하기"}</small></button>
{(selectedKey === 'hvac') ? (<section className={"prediction-start-card"}><header ><div ><span >{"0822 제보 + "}
{includeHansolInRandom ? '일반·한솔' : '일반 공조'}
{" 반복 기출"}</span>
<strong >{"시험 예상 60문제"}</strong>
<small >{"제보 13문제 고정 · 유사 기출 47문제 랜덤 · 3과목 × 20문제"}</small></div>
<b >{"예상"}</b></header>
<div aria-label={"시험 예상 문제 연도 범위"} className={"prediction-range-options"}><button type={"button"} onClick={() => { m.predictionRange = 'selected'; }} className={normalizeClass([{ active: predictionRange === 'selected' }])}>{"현재 설정 "}
{yearFrom}
{"~"}
{yearTo}</button>
<button type={"button"} onClick={() => { m.predictionRange = 'recent'; }} className={normalizeClass([{ active: predictionRange === 'recent' }])}>{"최근 10년"}</button>
<button type={"button"} onClick={() => { m.predictionRange = 'all'; }} className={normalizeClass([{ active: predictionRange === 'all' }])}>{"전회차 2002~2026"}</button></div>
<div className={"prediction-mode-actions"}><button type={"button"} onClick={() => { startHvacPrediction60('learn'); }}><span >{"해설을 바로 보며"}</span>
<strong >{"예상 60 학습모드"}</strong></button>
<button type={"button"} onClick={() => { startHvacPrediction60('exam'); }}><span >{"OMR·타이머로"}</span>
<strong >{"예상 60 CBT"}</strong></button></div>
<p >{"출제를 보장하는 공식 예상문제가 아니라, 8월 22일 제보와 저장소의 반복 출제 개념을 우선한 시험 직전 훈련입니다."}</p></section>) : null}
<button type={"button"} onClick={startBalancedExam} className={"exam-start"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(5), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(5))} alt={""} className={"simpsons-action-photo"}/>) : null}
<span >{"실제 시험처럼"}</span>
<strong >{officialRule?.scoring === 'total-only' ? '공식 구성 랜덤시험' : '과목 균형 랜덤시험'}</strong>
<small >{officialRule?.scoring === 'total-only' ? `${officialExamQuestionCount}문제` : '과목별 20문제'}
{selectedKey === 'hvac' && includeHansolInRandom ? ' · 한솔 후보 포함' : ''}
{" · OMR · 타이머"}</small></button>
<button type={"button"} onClick={() => { void openRegularRounds(); }} className={"round-start"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(7), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(7))} alt={""} className={"simpsons-action-photo"}/>) : null}
<span >{"연도 순서대로"}</span>
<strong >{"회차별 기출문제"}</strong>
<small >{yearFrom}
{"~"}
{yearTo}
{"년 목록 보기"}</small></button></div></section>) : null}
{((visualStyle !== 'sunjae' || !dynamicUiEnabled)) ? (<section className={"progress-panel"}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(6), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(6))} alt={"심슨 가족의 운동 장면"} className={"simpsons-progress-photo"}/>) : null}
<div ><span >{"현재 종목 학습률"}</span>
<strong >{stats.coverage}
{"%"}</strong>
<div className={"progress-track"}><i style={{ width: `${stats.coverage}%` }}/></div></div>
<dl ><div ><dt >{"전체 문제"}</dt>
<dd >{stats.total.toLocaleString()}</dd></div>
<div ><dt >{"푼 문제"}</dt>
<dd >{stats.answered.toLocaleString()}</dd></div>
<div ><dt >{"맞힌 문제"}</dt>
<dd >{stats.correct.toLocaleString()}</dd></div>
<div ><dt >{"북마크"}</dt>
<dd >{stats.bookmarks.toLocaleString()}</dd></div></dl></section>) : null}
{(visualStyle !== 'sunjae' || !dynamicUiEnabled || pwaRegistrationError) ? (<section aria-label={pwaRegistrationError ? '오프라인 저장 상태' : undefined} className={normalizeClass(["home-release-card", { ready: updateAvailable }])}>{(visualStyle === 'simpsons' && dynamicUiEnabled) ? (<img {...responsiveImageAttrs(simpsonsBurnsImage, 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsBurnsImage)} alt={"손가락을 맞댄 번즈"} className={"simpsons-release-photo"}/>) : null}
<div className={"home-release-icon"}>{updateAvailable ? '↻' : '✓'}</div>
<div ><span >{updateAvailable ? 'NEW VERSION READY' : pwaRegistrationError ? 'OFFLINE' : 'LATEST VERSION'}</span>
<strong >{updateAvailable ? '새 버전을 바로 적용할 수 있습니다' : pwaRegistrationError ? '오프라인 준비를 마치지 못했습니다' : `현재 v${currentVersion} 최신 버전을 사용 중입니다`}</strong>
{(pwaRegistrationError) ? (<small role={"status"}>{"온라인으로 계속 풀 수 있습니다. 설정의 ‘기록·동기화’에서도 복구 화면을 열 수 있습니다."}</small>) : <small >{updateAvailable ? '학습 기록은 유지되고 화면과 기능만 최신 상태로 바뀝니다.' : '새 업데이트가 있는지 언제든 다시 확인할 수 있습니다.'}</small>}</div>
<div className={"home-release-actions"}>{(pwaRegistrationError) ? (<button type={"button"} onClick={openPwaRecoveryFromError}>{"자동 복구 열기"}</button>) : null}
{(updateAvailable) ? (<button type={"button"} onClick={applyUpdate} className={"apply"}>{"신버전 적용"}</button>) : <button type={"button"} disabled={updateChecking} onClick={() => { checkForUpdate(true); }}>{updateChecking ? '확인 중…' : '업데이트 확인'}</button>}
<button type={"button"} onClick={() => { openView('updates'); }}>{"패치노트 보기"}</button></div></section>) : null}</Fragment>) : (view === 'school') ? (<FinalExams start={m.startFinalExam} archive={subject=>void openQualificationRounds(subject==='cooling'?SCHOOL_EXAM_CATALOG_KEY:'energy-midterm')}>
{(savedLearningSession?.qualificationKey === SCHOOL_EXAM_CATALOG_KEY && !coolingSavedSession) ? (<section className={"resume-learning-card"}><div ><span >{"자동 저장된 학교 시험 "}
{savedLearningSession.mode === 'exam' ? 'CBT' : '학습'}</span>
<strong >{savedLearningSession.title}</strong>
<small >{Object.keys(savedLearningSession.answers).length}
{" / "}
{savedLearningSession.itemIds.length}
{"문제 풀이"}</small></div>
<button type={"button"} onClick={resumeSavedLearning}>{"이어서 풀기"}</button></section>) : null}
<Suspense fallback={<p role="status">학교 시험을 불러오는 중…</p>}><SchoolExamManager {...{"data": schoolExamData, "onUpdate": updateSchoolExamData, "onStart": startSchoolExamRound, "onStartSet": startSchoolQuestionSet, "onSearch": openSchoolSetSearch}}/></Suspense></FinalExams>) : (view === 'rounds') ? (<Fragment >{(!isJewelry) ? (<MaterialSwitch {...{active:roundsCollection==='textbook'?1:0,
            actions:[openRegularRounds,openTextbookPages]}}/>) : null}
{(roundsCollection === 'textbook' && !isJewelry) ? (<Fragment >{(savedLearningSession?.itemIds.every(id=>!!bookForStudyId(id))) ? (<section className={"resume-learning-card"}><div ><strong >{savedLearningSession.title}</strong>
<small >{"저장된 교재 풀이"}</small></div>
<button onClick={resumeSavedLearning}>{"이어서 풀기"}</button></section>) : null}
<Suspense fallback={<p role="status">교재를 불러오는 중…</p>}><TextbookLibrary key={textbookKey} choosing={choosingTextbook} pages={textbookModule} book={textbookKey} items={textbookItems} loading={textbookLoading} error={textbookError} onBook={selectTextbook} onOpen={startTextbookReader} onRound={m.startHansolBookRound} onStudy={m.startBookRound} onRetry={loadTextbookPages}/></Suspense></Fragment>) : (roundsCollection === 'cooling' && !isJewelry) ? (<Fragment >{(coolingSavedSession && savedLearningSession) ? (<section className={"resume-learning-card"}><div ><span >{"자동 저장된 중간고사 "}
{savedLearningSession.mode === 'exam' ? 'CBT' : '학습'}</span>
<strong >{savedLearningSession.title}</strong>
<small >{Object.keys(savedLearningSession.answers).length}
{" / "}
{savedLearningSession.itemIds.length}
{"문제 풀이"}</small></div>
<button type={"button"} onClick={resumeSavedLearning}>{"이어서 풀기"}</button></section>) : null}
<Suspense fallback={<p role="status">공조·한솔 문제를 불러오는 중입니다…</p>}><CoolingMidterm {...{"items": coolingItems, "safetyItems": coolingSafetyPool, "wrongIds": coolingWrongIds, "attemptedIds": coolingItems.filter(item => studyStore.attempts[item.id]).map(item => item.id), "unusedIds": coolingUnusedIds, "sessions": coolingArchive, "history": coolingCompleted, "loading": coolingLoading, "error": coolingError, "onRetry": loadCoolingMidterm, "onSearch": openCoolingSearch, "onStart": startCoolingMidterm, "onResetDraws": resetCoolingDraws, "onResume": resumeCoolingArchived, "onReplay": (id:string) => { const record = coolingCompleted.find(item => item.id === id); if (record) replayHistoryRecord(record); }}}/></Suspense></Fragment>) : <Fragment >{(selectedKey === 'energy-midterm' && savedLearningSession?.qualificationKey === 'energy-midterm') ? (<section className={"resume-learning-card"}><div ><span >{"자동 저장된 에너지 중간고사 "}
{savedLearningSession.mode === 'exam' ? 'CBT' : '학습'}</span>
<strong >{savedLearningSession.title}</strong>
<small >{Object.keys(savedLearningSession.answers).length}
{" / "}
{savedLearningSession.itemIds.length}
{"문제 풀이"}</small></div>
<button type={"button"} onClick={resumeSavedLearning}>{"이어서 풀기"}</button></section>) : null}
<section className={"rounds-heading"}><div ><span >{selectedKey === 'energy-midterm' ? 'MIDTERM PRACTICE' : 'PAST EXAMS'}</span>
<h1 >{selectedCatalog.name}
{selectedKey === 'energy-midterm' ? '' : ' 기출문제'}</h1>
<p >{selectedKey === 'energy-midterm' ? `출제 메모의 ${visibleRounds.length}개 주제 · 관련 기출 ${energyMidtermQuestionCount}문제` : `수록된 전체 ${visibleRounds.length}회차`}</p></div>
<div className="round-bank-actions">
{(selectedKey === 'hvac' || selectedKey === 'hvac-hansol') && <button type="button" onClick={() => openQualificationRounds(selectedKey === 'hvac' ? 'hvac-hansol' : 'hvac')}>{selectedKey === 'hvac' ? '한솔 공조 기출 회차 보기' : '일반 공조 기출 회차 보기'}</button>}
<button type="button" onClick={() => openView('home')}>← 종목 선택으로</button></div></section>
{(selectedKey === 'energy-midterm') ? (<section className={"energy-midterm-intro"}><fieldset className={"energy-source-picker"}><legend >{"풀기 전에 문제 출처 선택"}</legend>
<label ><input checked={energySourceMode === "textbook"} onChange={event => { m.energySourceMode = event.currentTarget.value as typeof energySourceMode; }} type={"radio"} value={"textbook"} name={"energy-midterm-source"}/>
{"에너지 교재 문제"}</label>
<label ><input checked={energySourceMode === "combined"} onChange={event => { m.energySourceMode = event.currentTarget.value as typeof energySourceMode; }} type={"radio"} value={"combined"} name={"energy-midterm-source"}/>
{"CBT + 에너지 교재"}</label>
<p >{energySourceMode === 'textbook' ? '교재에 실린 원문 문제·보기·정답·해설로 풉니다.' : '이전에 사용하던 CBT 문제 목록과 문제·해설 방식 그대로 풉니다.'}
{" 선택은 새 풀이에만 적용하며, 풀던 문제와 기존 기록은 유지됩니다."}</p></fieldset>
<p >{"출처를 고른 다음 아래 모음 또는 1~20번 주제로 풀면 됩니다. 현재 출처 "}
{energyMidtermQuestionCount}
{"문제 중 계산 설정을 반영한 "}
{energyMidtermEligibleQuestions.length}
{"문제가 선택됩니다. 오답·점수는 일반 기출과 분리됩니다."}</p>
<p className={"energy-topic-note"}>{"같은 질문·같은 정답은 최신 회차만 출제하고 ‘나왔던 회차’를 표시합니다. 계산 수치·정답 내용이 다른 문제는 유지합니다."}</p>
<div className={"energy-midterm-priority-grid energy-midterm-main-groups"}><article ><h2 >{"시험범위에 맞는 문제 "}
<span >{energyMidtermDirectCount}
{"문제"}</span></h2>
<p >{"교수님 출제 메모와 직접 대응하는 주제"}</p>
<div className={"energy-midterm-actions"}><button type={"button"} aria-label={"시험범위만 학습"} onClick={() => { startEnergyMidterm('learn', true, false, 'direct'); }}>{"학습모드"}</button>
<button type={"button"} aria-label={"시험범위만 CBT"} onClick={() => { startEnergyMidterm('exam', true, false, 'direct'); }}>{"CBT 시험"}</button></div></article>
<article ><h2 >{"추가 예상만 "}
<span >{energyMidtermRelatedCount}
{"문제"}</span></h2>
<p >{"관련 주제·질문 취지가 불명확한 보강 문제"}</p>
<div className={"energy-midterm-actions"}><button type={"button"} aria-label={"추가 예상만 학습"} onClick={() => { startEnergyMidterm('learn', true, false, 'related'); }}>{"학습모드"}</button>
<button type={"button"} aria-label={"추가 예상만 CBT"} onClick={() => { startEnergyMidterm('exam', true, false, 'related'); }}>{"CBT 시험"}</button></div></article></div>
<div className={"energy-midterm-actions energy-midterm-random-actions"}><button type={"button"} onClick={() => { startEnergyMidterm('learn'); }}>{"랜덤20문제 학습"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('exam'); }}>{"랜덤20문제 CBT"}</button></div>
<p className={"energy-midterm-evidence-note"}>{"랜덤20은 시험범위+추가 예상에서 주제별1개씩 뽑습니다. 추가 예상을 빼려면 위의 ‘시험범위만’을 선택하세요."}</p>
<div className={"energy-calculation-controls"}><strong >{"계산 문제: "}
{energyMidtermEligibleQuestions.filter(q => q.midtermCalculation).length}
{"개 포함"}</strong>
<div ><button type={"button"} onClick={() => { m.energyCalculationExcluded = [...energyDefaultCalculationExcluded]; }}>{"기본 6번·11번"}</button>
<button type={"button"} onClick={() => { setAllEnergyCalculations(true); }}>{"계산 전체 On"}</button>
<button type={"button"} onClick={() => { setAllEnergyCalculations(false); }}>{"계산 전체 Off"}</button></div>
<p >{"기본은6번 상당증발량·11번 스케줄번호만 On입니다. 랜덤20은 두 주제에서 계산을1개씩 뽑고, 전체·주제별 풀기도 체크 설정을 따릅니다. 2번 내부에너지 등 다른 주제의 계산은 개별 체크나 전체On으로 포함하세요. 새 풀이에만 적용하며 이어풀기 답안은 유지합니다."}</p></div>
<details onToggle={event => { m.energyCalculationReviewOpen = (event.target as HTMLDetailsElement).open; }} className={"energy-calculation-review"}><summary >{"계산 문제만 보기 · 전체"}
{energyCalculationReviewItems.length}
{"개"}</summary>
{(energyCalculationReviewOpen) ? (<Fragment ><p >{"분류 확인용입니다. 위의On/Off와 관계없이 모든 주제의 계산 문제를 표시합니다. 각 문항을 펼쳐 원문을 확인하세요. 답안·풀이 기록은 바뀌지 않습니다."}</p>
{(energyCalculationReviewItems).map((item) => <details key={item.id} className={"energy-calculation-review-item"}><summary >{item.round.title}
{" · "}
{item.question.sourcePage?.split(' · ')[0]}</summary>
<QuestionCard {...{"item": item, "mode": "exam", "displayNumber": item.question.number, "restoredImageTheme": restoredImageTheme}}/></details>)}</Fragment>) : null}</details>
<details className={"energy-midterm-subgroups"}><summary >{"기존4개 묶음을 각각 풀기"}</summary>
<div className={"energy-midterm-priority-grid"}>{(energyMidtermPriorityGroups).map((group) => <article key={group.key}><h2 >{group.title}
{" "}
<span >{group.count}
{"문제"}</span></h2>
<p >{group.note}</p>
<div className={"energy-midterm-actions"}><button type={"button"} onClick={() => { startEnergyMidterm('learn', true, false, undefined, group.key); }}>{group.title}
{" 학습"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('exam', true, false, undefined, group.key); }}>{group.title}
{" CBT"}</button></div></article>)}</div></details>
<details className={"energy-midterm-other-actions"}><summary >{"전체 함께 풀기·교재·PDF 선택"}</summary>
<p >{"20문제는 실제 시험 문항 수이며 예상문제 수 제한이 아닙니다. 랜덤20은 전체20주제에서 각각1개씩 뽑습니다. 실제 출제를 보장하지 않습니다."}</p>
<div className={"energy-midterm-actions"}><button type={"button"} onClick={() => { startEnergyMidterm('learn', true, false, undefined, 'pdf'); }}>{"후기 PDF"}
{energyMidtermPdfCount}
{"문제 학습"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('exam', true, false, undefined, 'pdf'); }}>{"후기 PDF"}
{energyMidtermPdfCount}
{"문제 CBT"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('learn', true, true); }}>{"교재 대응"}
{energyMidtermBookCount}
{"문제 학습"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('learn', true); }}>{"전체"}
{energyMidtermEligibleQuestions.length}
{"문제 학습"}</button>
<button type={"button"} onClick={() => { startEnergyMidterm('exam', true); }}>{"전체"}
{energyMidtermEligibleQuestions.length}
{"문제 CBT"}</button></div></details>
<details ><summary >{"자료가 애매하거나 기출과 다른 부분"}</summary>
<p >{"수업PPT는 급수pH6~9(적정8.5)·관수11~11.8, 교재260쪽은 급수6.5~9·관수10.5~11.5로 다릅니다. 후기 PDF의 특정 원통보일러 급수7~9도 해당 조건으로만 읽으세요. 보염장치/윈드박스와 CO₂/수트블로워는 구분합니다. 메모의 약품명·배관33 경계는 미확정입니다. 후기 PDF13회차 전체1,040개를 넣은 것은 아니며 중간고사20주제의 검토 문항만 연결했습니다. 보류했던14개도 원문 경계를 직접 확인해 반영했습니다."}</p></details></section>) : null}
<div data-react-view="round-list-host"><RoundList rows={roundCards} theme={visualStyle}/></div></Fragment>}</Fragment>) : (view === 'history') ? (<div style={{display:"contents"}} data-react-view={"history"}>{renderHistoryView(historyViewModel)}</div>) : (view === 'wrong') ? (<div style={{display:"contents"}} data-react-view={"wrong"}>{renderWrongView(wrongViewModel)}</div>) : (view === 'search') ? (<div style={{display:"contents"}} data-react-view={"search-view"}>{renderSearchView(searchViewModel)}</div>) : (view === 'calculation') ? (<div style={{display:"contents"}} data-react-view={"calculation-view"}>{renderCalculationView(calculationViewModel)}</div>) : (view === 'guide' && !guideLoaded) ? (<section aria-live={"polite"} className={"guide-notice"}><strong >{guideLoading ? '시험 자료를 불러오는 중입니다…' : '시험 자료실'}</strong>
{(guideError) ? (<p role={"alert"}>{guideError}</p>) : null}
{(!guideLoading) ? (<button type={"button"} onClick={retryStudyGuide}>{"다시 불러오기"}</button>) : null}</section>) : (view === 'guide' && activeStudyGuide) ? (<div style={{display:"contents"}} data-react-view={"guide-view"}>{renderGuideView(guideViewModel)}</div>) : (view === 'coach') ? (<div style={{display:"contents"}} data-react-view={"coach-view"}>{renderCoachView(coachViewModel)}</div>) : (view === 'beta') ? (<div style={{display:"contents"}} data-react-view={"beta-view"}>{renderBetaView(betaViewModel)}</div>) : (view === 'showcase') ? (<div style={{display:"contents"}} data-react-view={"showcase-view"}>{renderShowcaseView(showcaseViewModel)}</div>) : (view === 'stats') ? (<div style={{display:"contents"}} data-react-view={"stats-view"}>{renderStatsView(statsViewModel)}</div>) : <div style={{display:"contents"}} data-react-view={"patch-view"}>{renderPatchView(patchViewModel)}</div>}</div></StudyTransition>}</div></main>
{(showAndroidApkPopup) ? (<button type={"button"} aria-label={"Android 앱 다운로드 안내 열기"} onClick={() => { m.androidApkPopupOpen = true; }} className={"android-apk-floating-trigger"}><span >{"ANDROID"}</span>
<strong >{"앱 받기"}</strong></button>) : null}
<StudyTransition name={"modal-fade"} stageKey={undefined} >{(showAndroidApkPopup && androidApkPopupOpen) ? (<div onClick={event => { if(event.target !== event.currentTarget)return; m.androidApkPopupOpen = false; }} className={"android-apk-popup-backdrop"}><section role={"dialog"} aria-modal={"true"} aria-labelledby={"android-apk-popup-title"} className={"android-apk-popup"}><button type={"button"} aria-label={"Android 앱 안내 닫기"} onClick={() => { m.androidApkPopupOpen = false; }} className={"android-apk-popup-close"}>{"×"}</button>
<div aria-hidden={"true"} className={"android-app-mark"}><svg viewBox={"0 0 48 48"} role={"img"}><path d={"M15 18h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z"}/>
<path d={"m16 18-3-5m19 5 3-5M18 12h12a4 4 0 0 1 4 4v2H14v-2a4 4 0 0 1 4-4Z"}/>
<circle cx={"19"} cy={"15"} r={"1.3"}/>
<circle cx={"29"} cy={"15"} r={"1.3"}/></svg></div>
<span >{"ANDROID 전용"}</span>
<h2 id={"android-apk-popup-title"}>{"CBT 앱으로 더 편하게 풀어보세요"}</h2>
<p >{"휴대폰·태블릿 전용 화면과 터치 메뉴를 사용할 수 있습니다."}</p>
<small >{"Android 7.0 이상 · 약 8MB"}</small>
<div className={"android-apk-popup-actions"}><button type={"button"} onClick={() => { m.androidApkPopupOpen = false; }}>{"나중에"}</button>
<a href={problemImage(androidApkUrl)} target={"_blank"} rel={"noopener"} onClick={() => { m.androidApkPopupOpen = false; }}>{"정식 APK 다운로드 "}
<b aria-hidden={"true"}>{"↓"}</b></a></div></section></div>) : null}</StudyTransition>
{(!practicalSolving) ? (<nav inert={mobileMenuOpen} aria-label="학습 Dock" className="mobile-tabbar glass-dock"><button data-tip="홈" aria-label="홈" onClick={() => { openView('home'); }} className={normalizeClass([{ active: view === 'home' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(0))} alt={""}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-mobile-home-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(0))} alt={""}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-home"}/>}</span>
<small>홈</small></button>
<button data-tip="회차" aria-label="회차" onClick={() => { void openRegularRounds(); }} className={normalizeClass([{ active: view === 'rounds' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(1))} alt={""}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-mobile-rounds-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={""}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-rounds"}/>}</span>
<small>회차</small></button>
<button data-tip="오답" aria-label="오답" onClick={() => { openView('wrong'); }} className={normalizeClass([{ active: view === 'wrong' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(2))} alt={""}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-mobile-wrong-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(2))} alt={""}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-wrong"}/>}</span>
<small>오답</small></button>
<button data-tip="검색" aria-label="검색" onClick={() => { openView('search'); }} className={normalizeClass([{ active: view === 'search' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(3))} alt={""}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-mobile-search-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(3))} alt={""}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-search"}/>}</span>
<small>검색</small></button>
{!isJewelry && <button data-tip="기말고사" aria-label="기말고사" onClick={()=>openView('school')} className={view==='school'?'active':''}><span aria-hidden="true">✎</span><small>기말고사</small></button>}
<button data-tip="통계" aria-label="통계" onClick={() => { openView('stats'); }} className={normalizeClass([{ active: view === 'stats' }])}><span >{(visualStyle === 'simpsons') ? (<img {...responsiveImageAttrs(simpsonsFunnyImageAt(5), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(simpsonsFunnyImageAt(5))} alt={""}/>) : (visualStyle === 'sunjae') ? (<img key={`sunjae-mobile-stats-${sunjaeImageIndex}`} {...responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')} onError={restoreOriginalImage} src={problemImage(sunjaePortraitImageAt(1))} alt={""}/>) : <i aria-hidden={"true"} className={"study-menu-icon menu-stats"}/>}</span>
<small>통계</small></button></nav>) : null}
{(!practicalSolving) ? (<nav aria-label={"Android 앱 메뉴"} inert={mobileMenuOpen} className={"native-app-tabbar"}><button onClick={() => { m.nativeMoreOpen = false; openView('home'); }} className={normalizeClass([{ active: view === 'home' }])}><span >{"⌂"}</span>
<strong >{"홈"}</strong></button>
<button onClick={() => { m.nativeMoreOpen = false; void openRegularRounds(); }} className={normalizeClass([{ active: view === 'rounds' }])}><span >{"▤"}</span>
<strong >{"회차"}</strong></button>
<button onClick={() => { m.nativeMoreOpen = false; openView('wrong'); }} className={normalizeClass([{ active: view === 'wrong' }])}><span >{"!"}</span>
<strong >{"오답"}</strong>
{(stats.wrong) ? (<b >{Math.min(99, stats.wrong)}</b>) : null}</button>
<button onClick={() => { m.nativeMoreOpen = false; openView('search'); }} className={normalizeClass([{ active: view === 'search' }])}><span >{"⌕"}</span>
<strong >{"검색"}</strong></button>
<button onClick={() => { m.nativeMoreOpen = !nativeMoreOpen; }} className={normalizeClass([{ active: nativeMoreOpen }])}><span >{"•••"}</span>
<strong >{"더보기"}</strong></button></nav>) : null}
<StudyTransition name={"modal-fade"} stageKey={undefined} >{(nativeMoreOpen) ? (<div onClick={event => { if(event.target !== event.currentTarget)return; m.nativeMoreOpen = false; }} className={"native-more-backdrop"}><section className={"native-more-sheet"}><header ><div ><span >{"QUICK MENU"}</span>
<strong >{"더보기"}</strong></div>
<button type={"button"} aria-label={"더보기 닫기"} onClick={() => { m.nativeMoreOpen = false; }}>{"×"}</button></header>
<nav >{!isJewelry && <button type="button" onClick={()=>{m.nativeMoreOpen=false;openView('school')}}><span>✎</span><strong>기말고사</strong></button>}<button type={"button"} onClick={() => { m.nativeMoreOpen = false; openView('history'); }}><span >{"◴"}</span>
<div ><strong >{"학습 내역"}</strong>
<small >{"이어하기·점수·재도전"}</small></div></button>
<button type={"button"} onClick={() => { m.nativeMoreOpen = false; openView('calculation'); }}><span >{"∑"}</span>
<div ><strong >{"계산문제"}</strong>
<small >{"공식부터 차근차근"}</small></div></button>
{(studyGuideAvailable) ? (<button type={"button"} onClick={() => { m.nativeMoreOpen = false; openView('guide'); }}><span >{"▣"}</span>
<div ><strong >{"시험 자료실"}</strong>
<small >{"공식·핵심 개념"}
{hvacPracticalAvailable ? '·필답형' : ''}</small></div></button>) : null}
<button type={"button"} onClick={() => { m.nativeMoreOpen = false; openCalculator(); }}><span >{"▦"}</span>
<div ><strong >{"계산기"}</strong>
<small >{"공학용 계산 도구"}</small></div></button>
<button type={"button"} onClick={() => { m.nativeMoreOpen = false; m.settingsOpen = true; }}><span >{"⚙"}</span>
<div ><strong >{"설정"}</strong>
<small >{"테마·글씨·문제 화면"}</small></div></button>
<button type={"button"} onClick={() => { m.nativeMoreOpen = false; openView('updates'); }}><span >{"◷"}</span>
<div ><strong >{"업데이트"}</strong>
<small >{"패치노트 확인"}</small></div></button></nav></section></div>) : null}</StudyTransition></div>) : (!session && textbookReaderOpen && appHydrating) ? (<p role={"status"} className={"library-note"}>{"저장한 풀이 기록을 불러오는 중…"}</p>) : (!session && textbookReaderOpen) ? (<Suspense fallback={<p role="status">교재를 펼치는 중…</p>}><TextbookReader {...{"onRound": m.startHansolBookRound, "book": textbookKey, "items": textbookItems, "loading": textbookLoading, "error": textbookError, "answerLayout": answerLayout, "hotspotIndicator": hotspotIndicator, "restoredImageTheme": restoredImageTheme, "onClose": closeTextbookReader, "onSettings": () => { m.settingsOpen=true; }, "onCalculator": () => { openCalculator(); }, "onBook": selectTextbook, "onRetry": loadTextbookPages, "onChoose": chooseTextbookAnswer, "onBookmark": toggleBookmark, "onAi": prepareAiQuestion, "onStart": (payload:{items:QuestionItem[];mode:StudyMode;label:string})=>beginSession(payload.mode,payload.label,payload.items)}}/></Suspense>) : (session) ? (<div className={normalizeClass(["session-shell", {
      'exam-mode': session.mode === 'exam',
      'sheet-closed': !examSheetOpen,
      'layout-standard': solveLayoutMode === 'standard',
      'layout-comcbt': solveLayoutMode === 'comcbt',
      'layout-combat': solveLayoutMode === 'combat',
      'standard-image-fit': true,
      'experience-session-entering': experienceTransitionPhase === 'session-entering',
      'experience-session-leaving': experienceTransitionPhase === 'session-leaving',
    }])}>{(panelCalculator || panelNotes || pinnedSolution) ? (<div data-react-view="study-tools"><ToolPanels {...{calculator:panelCalculator, notes:panelNotes, solution:pinnedSolution, scope:spaceScope, close:closeTool}}/></div>) : null}
<div style={{display:"contents"}} data-react-view={"exam-session"}>{renderExamSessionView(examSessionViewModel)}</div>
{(examResult) ? (<div style={{display:"contents"}} data-react-view={"grade"}>{renderGradeView(gradeViewModel)}</div>) : null}</div>) : null}
{(settingsOpen && (view !== 'settings' || session)) ? (<Suspense fallback={<p role="status">설정을 불러오는 중…</p>}><StudySettings {...{"mode": settingsExpanded ? 'full' : 'quick', "values": settingsValues, "context": settingsContext, "onChange": changeSetting, "onAction": settingsAction}}><Suspense fallback={null}><CloudSyncPanel description="로그인 없이도 공부할 수 있습니다. 다른 기기와 기록을 연결할 때만 로그인하세요."/></Suspense></StudySettings></Suspense>) : null}
<input ref={m.setLearningImportInput} type={"file"} accept={"application/json,.json"} hidden={true} onChange={e=>importLearningData(e.nativeEvent)}/>
<StudyTransition name={"modal-fade"} stageKey={undefined} >{(nativeCalculatorOpen) ? (<section className={"native-calculator-shell"}><header ><div ><span >{"ANDROID TOOL"}</span>
<strong >{"공학용 계산기"}</strong></div>
<button type={"button"} onClick={() => { m.nativeCalculatorOpen = false; }}>{"풀이로 돌아가기"}</button></header>
<iframe src={"calculator.html?native=1"} title={"공학용 계산기"}/></section>) : null}</StudyTransition>
{(aiPromptOpen) ? (<div onClick={event => { if(event.target !== event.currentTarget)return; m.aiPromptOpen = false; }} className={"ai-prompt-backdrop"}><section className={"ai-prompt-modal"}><header ><div ><span >{"BEGINNER AI TUTOR"}</span>
<h2 >{"정답 검증 + 초보자용 해설 프롬프트"}</h2></div>
<button type={"button"} aria-label={"AI 질문 창 닫기"} onClick={() => { m.aiPromptOpen = false; }}>{"×"}</button></header>
{(aiPromptHasImage) ? (<div className={"ai-image-notice"}><span >{"▧"}</span>
<div ><strong >{"문제 이미지를 실제 첨부할 수 있습니다"}</strong>
<small >{"URL 캐시 오류를 피하려면 프롬프트를 붙여넣은 뒤 `문제 이미지 복사`도 눌러 ChatGPT에 붙여넣으세요. 모바일은 `질문+이미지 공유`를 사용할 수 있습니다."}</small></div></div>) : null}
<p >{"문제 전체를 다시 보여주고 설정 정답·실제 정답·기존 해설을 검증한 뒤 쉬운 설명을 하도록 구성했습니다."}</p>
<textarea value={aiPromptText} onChange={event => { m.aiPromptText = event.currentTarget.value as typeof aiPromptText; }} aria-label={"AI 질문 프롬프트"} spellCheck={"false"}/>
<footer ><button type={"button"} onClick={copyAiPrompt} className={"ai-copy-button"}>{"프롬프트 복사"}</button>
{(aiPromptHasImage) ? (<button type={"button"} disabled={aiImageBusy} onClick={copyAiQuestionImage} className={"ai-image-copy-button"}>{aiImageBusy ? '이미지 준비 중…' : '문제 이미지 복사'}</button>) : null}
{(aiPromptHasImage && canShareAiQuestion) ? (<button type={"button"} disabled={aiImageBusy} onClick={shareAiQuestion} className={"ai-share-button"}>{"질문+이미지 공유"}</button>) : null}
<button type={"button"} onClick={openAiAssistant} className={"ai-open-button"}>{"프롬프트 복사 후 ChatGPT 열기 →"}</button></footer></section></div>) : null}
<StudyTransition name={"toast"} stageKey={undefined} >{(updateAvailable && !session && !practicalSolving && !textbookReaderOpen) ? (<aside className={"update-notice"}><div ><span >{"NEW VERSION"}</span>
<strong >{"새로운 CBT 업데이트가 준비됐습니다"}</strong>
<small >{"버튼을 누르면 최신 화면과 패치노트가 적용됩니다."}</small></div>
<button type={"button"} onClick={applyUpdate}>{"업데이트 적용"}</button></aside>) : null}</StudyTransition>
<StudyTransition name={"toast"} stageKey={undefined} >{(toastMessage) ? (<div className={"toast-message"}>{toastMessage}</div>) : null}</StudyTransition>
<StudyPortal disabled={false}><>{(visualTransitionPhase) ? (<div aria-hidden={"true"} className={normalizeClass(["visual-style-motion", [`motion-${visualTransitionPhase}`, `motion-to-${visualTransitionTarget}`]])}><i />
<i />
<i />
<strong >{visualTransitionTarget === 'simpsons' ? 'SPRINGFIELD UI' : visualTransitionTarget === 'sunjae' ? 'LOVELY RUNNER UI' : 'CBT UI'}</strong>
<span >{"화면을 옮기는 중"}</span></div>) : null}</></StudyPortal>
</>;
}
