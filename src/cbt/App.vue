<script setup lang="ts">
import {legacyRef} from "./legacySignalRefs";
import {saveTextbookAnswer, textbookAnswersIn} from './textbookAnswerProgress';
import {renderSearchView} from "../react/tools/SearchView";
import {renderCalculationView} from "../react/tools/CalculationView";
import {renderGuideView} from "../react/tools/GuideView";
import {renderCoachView} from "../react/tools/CoachView";
import {renderBetaView} from "../react/tools/BetaView";
import {renderShowcaseView} from "../react/tools/ShowcaseView";
import {renderStatsView} from "../react/tools/StatsView";
import {renderPatchView} from "../react/tools/PatchView";
import {proxyRefs} from "vue";
import ReactSurface from "../react/ReactSurface.vue";
import { renderHistoryView } from "../react/session/HistoryView";
import { renderWrongView } from "../react/session/WrongView";
import { renderExamSessionView } from "../react/session/ExamSessionView";
import { renderGradeView } from "../react/session/GradeView";

import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import '../react/hybrid.css';
import '../react/materials.css';
import {pinSolutionKey,type PinnedSolution,type ToolName} from '../react/workspaceTypes';
import type { StudyHomeProps } from '../react/studyModels';
import {allowMobileModel,setMobileModel} from '../react/modelPreference';
import { isStudyView, studyHref, viewFromHash, type StudyView } from '../react/studyRoutes';
import ThemeStudyCover from './ThemeStudyCover.vue';
import NavigationMount from '../react/NavigationMount.vue';
import { animate, stagger } from 'motion';
import { visibleMotionTargets } from './viewMotion';
import { pluginExperiences } from './pluginExperiences';
import { responsiveImageAttrs, restoreOriginalImage } from './responsiveImages';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch } from 'vue';
import {
  GEM_APPRAISER_TARGET_KEY,
  ensureCatalogLoaded,
  latestSubjects,
  loadReferenceRounds,
  questionId,
  questionItems,
  roundsInRange,
  shuffle,
  sortedRounds,
  subjectFor,
  subjectsForScope,
  yearsFor,
} from './catalog';
import QuestionCard from './QuestionCard.vue';
import RoundsLoading from './RoundsLoading.vue';
import {problemImage} from './problemImages';
import {explanationDisplay, setExplanationDisplay} from './explanationDisplay';
import QuestionLibraryPreview from './QuestionLibraryPreview.vue';
import { pageItems } from './listPresentation';
import { energyMidtermPractice, energyDefaultCalculationTopics, energyDefaultCalculationExcluded, restoreEnergyCalculationExcluded } from './energyMidtermPractice';
import { energySourceRounds, energySourceLabel, type EnergySourceMode } from './energyTextbook';
import PracticalLoadMore from './PracticalLoadMore.vue';
import PracticalProblemImage from './PracticalProblemImage.vue';
import PracticalIssueReport from './PracticalIssueReport.vue';
import { calculationLesson, calculationPrompts, practicalCalculationPdf, practicalSiBasics, orderPracticalCalculations, practicalAbsoluteTemperatureExample } from './practicalCalculations';
const PracticalFractionLines = defineAsyncComponent(() => import('./PracticalFractionLines.vue'));
const PracticalCalculationLibrary = defineAsyncComponent(() => import('./PracticalCalculationLibrary.vue'));
const PracticalSearchLibrary = defineAsyncComponent(() => import('./PracticalSearchLibrary.vue'));
import { matchesPracticalText } from './practicalSearch';
const PracticalCalculationLesson = defineAsyncComponent(() => import('./PracticalCalculationLesson.vue'));
const CloudSyncPanel = defineAsyncComponent(() => import('./CloudSyncPanel.vue'));
const ToolPanelsMount = defineAsyncComponent(()=>import('../react/ToolPanelsMount.vue'));
const panelCalculator = ref(false), panelNotes = ref(false);
const pinnedSolution = ref<PinnedSolution|null>(null);
provide(pinSolutionKey, solution => { pinnedSolution.value=solution; });
function closeTool(name:ToolName) {
  if(name==='calculator') panelCalculator.value=false;
  if(name==='notes') panelNotes.value=false;
  if(name==='explanation') pinnedSolution.value=null;
}
const RoundListMount=defineAsyncComponent(()=>import('../react/RoundListMount.vue'));
const roundCards=computed(()=>visibleRounds.value.map(round=>{
  const energy=selectedKey.value==='energy-midterm';
  const school=round.kind==='school-midterm';
  const excluded=energy && energyCalculationExcluded.value.includes(round.id);
  const calculations=energy?round.questions.filter(q=>q.midtermCalculation).length:0;
  const record=roundRecordMap.value.get(round.id);
  const total=round.questions.length;
  return {
    id:round.id,title:round.title,qualification:round.shortQualification||round.qualification||selectedCatalog.value.name,
    year:round.year,school,restored:isRestoredRound(round),
    description:energy?`${energyTopicQuestions(round).length}문제 선택${excluded?' · 전체'+total+'문제 중 계산 제외':''}`:`${total}문제 · ${round.subjects.length}과목 · 시험 ${roundExamMinutes(round)}분`,
    scope:school?`시험범위${round.questions.filter(q=>q.midtermMatch==='direct').length} · 관련 예상${round.questions.filter(q=>q.midtermMatch==='related').length}${['school-energy-topic-6','school-energy-topic-11'].includes(round.id)?' · 계산 출제 예상':''}`:'',
    subjects:energy?[]:round.subjects,hint:school?round.questions[0]?.teacherHint:undefined,
    record:record?{score:record.score,date:new Date(record.finishedAt).toLocaleDateString('ko-KR'),latest:lastRoundRecord.value?.roundId===round.id}:undefined,
    calculation:calculations?{count:calculations,included:!excluded,set:(on:boolean)=>setEnergyTopicCalculation(round.id,on)}:undefined,
    answered:roundAnswered(round),total,progress:roundProgress(round),wrong:roundWrongGroupMap.value.get(round.id)?.items.length??0,
    start:()=>startRound(round,'learn'),restart:()=>restartRoundLearning(round),openWrong:()=>openRoundWrongAnswers(round),exam:()=>startRound(round,'exam'),
  };
}));
import StudyHomeMount from '../react/StudyHomeMount.vue';
const reactHome = computed<StudyHomeProps>(() => ({
  name: selectedCatalog.value.name, selected: selectedKey.value,
  groups: qualificationGroups.map(group => ({
    label: group.label,
    items: group.items.map(item => ({
      key: item.key, name: item.name,
      icon: qualificationMeta[item.key]?.icon ?? '◇',
      color: qualificationMeta[item.key]?.className ?? '',
      rounds: item.roundCount ?? item.rounds.length,
      questions: catalogDisplayQuestionCount(item),
    })),
  })),
  loadingStats: appHydrating.value, answered: stats.value.answered, accuracy: stats.value.accuracy, wrong: stats.value.wrong,
  resume: Boolean(savedLearningSession.value),
  onRounds: () => selectQualification(selectedKey.value),
  onSelect: selectQualification, onBook: isJewelry ? undefined : openTextbookPages, onResume: resumeSavedLearning,
}));
const StudySettings = defineAsyncComponent(() => import('./StudySettings.vue'));
import type { SettingsValues, SettingChange, SettingsAction } from './settingsCatalog';
const SchoolExamManager = defineAsyncComponent(() => import('./SchoolExamManager.vue'));
const CoolingMidterm = defineAsyncComponent(() => import('./CoolingMidterm.vue'));
const TextbookPages = defineAsyncComponent(() => import('./TextbookPages.vue'));
import TextbookLibrary from './TextbookLibrary.vue';
import {saveBookSelection,type BookSelection} from './textbookReaderState';
import { fetchTextbookSources } from './staticTextbookSources';
import { loadTextbookSupplement } from './textbookSupplement';
import { textbookSourceKeys, bookForStudyId, type TextbookKey } from './textbookRoutes';
import { coolingMidtermItems, coolingSafetyItems, coolingRecordSourceItems, coolingMidtermTitle, normalizedSchoolSubject, coolingRecordItem, coolingRecordId, coolingOriginalId, isCoolingRecord, coolingUnusedItems, uniqueSchoolItems, coolingItemsWithOccurrences, type CoolingDrawState } from './schoolQuestionBank';
import { coolingCalculation, coolingPracticeSelection } from './coolingPractice';
import { orderCoolingSimilar } from './coolingSimilarOrder';
import OptionalFeatureBoundary from '../components/OptionalFeatureBoundary.vue';
import { applyUiLabPreferences, useUiLab } from './uiLab';
import { isCalculationItem } from './calculationGuide';
import {
  SCHOOL_EXAM_CATALOG_KEY,
  loadSchoolExamData,
  normalizeSchoolExamData,
  saveSchoolExamData,
  schoolExamCatalog,
  type SchoolExamData,
} from './schoolExam';
import {
  clearCloudLearningState,
  cloudSyncState,
  initializeCloudSync,
  scheduleLearningSync,
  syncLearningData,
} from './cloudSync';
import { hvacFieldReportRelatedGroups, hvacFieldReportRound } from './hvacFieldReportPractice';
import {
  hvacCalculatorMemory,
  hvacCalculatorMemoryGroups,
  hvacCalculatorSheetNotes,
  hvacFrequentFormulas,
} from './hvacCalculatorSheet';
import { buildHvacPredictionSet } from './hvacPrediction';
import { studyGuideKeys, useStudyGuideData } from './useStudyGuideData';
const guide=useStudyGuideData();
const {loadStudyGuide}=guide;
const practicalPrompts=legacyRef(guide.practicalPrompts);
const practicalSources=legacyRef(guide.practicalSources);
const studyGuidePages=legacyRef(guide.studyGuidePages);
const guideLoaded=legacyRef(guide.guideLoaded);
const guideLoading=legacyRef(guide.guideLoading);
const guideError=legacyRef(guide.guideError);
import { matchesPracticalMaterialPeriod, type PracticalMaterialPeriod } from './practicalMaterialPeriod';
import { buildPracticalPattern, mockSessionPrompts, practicalPatternSummary, validPracticalPattern, type PracticalPattern } from './practicalMock';
import { practicalBatchOptions, restorePracticalBatch, restorePracticalMode } from './practicalDisplay';
import {
  practicalCategoryLabels,
  practicalDifficultyLabels,
  type PracticalAssessment,
  type PracticalCategory,
  type PracticalMistakeReason,
  type PracticalPrompt,
} from './hvacPracticalTypes';
import { qualificationRuleFor } from './qualificationRules';
import {
  applyDynamicUiPreference,
  applyTheme,
  applyVisualStyle,
  currentDynamicUiEnabled,
  currentTheme,
  currentVisualStyle,
  db,
  hydrateIndexedDb,
  loadExamRecords,
  markBookmarkSyncState,
  persistStudyStoreNow,
  recordAttempt,
  recordExam,
  type ExamRecord,
  type VisualStyle,
} from './storage';
import { controllerStudyStore as studyStore } from './controllerStudyStore';
import type { AttemptRecord, Catalog, CurriculumScope, Question, QuestionItem, Round, SessionState, StudyMode } from './types';

const MathFormula = defineAsyncComponent(() => import('./MathFormula.vue'));
const PracticalTrainingTools = defineAsyncComponent(() => import('./PracticalTrainingTools.vue'));
const FormulaWorkbench = defineAsyncComponent(() => import('./FormulaWorkbench.vue'));

type ViewName = StudyView;
type CoachPlanKey = 'due' | 'weak' | 'calculation' | 'subject' | 'exam';
type UpscalePreviewKind = 'original' | 'improved';
type VisualTransitionPhase = 'leaving' | 'entering' | null;
type ExperienceTransitionPhase = 'home-leaving' | 'session-entering' | 'session-leaving' | 'home-entering' | null;
type SunjaeResultPhase = 'grading' | 'reveal';
type AnswerLayout = 'classic' | 'inline' | 'hotspot';
type HotspotIndicator = 'marker' | 'area';
type RestoredImageTheme = 'auto' | 'original';
type SolveLayoutMode = 'standard' | 'comcbt' | 'combat';
type OmrFilter = 'all' | 'unanswered' | 'kept' | 'subject';
type DisplayPreference = 'auto' | 'mobile' | 'desktop';
type FontFamilyPreference = 'regular' | 'bold' | 'd2coding' | 'd2coding-bold';
type PredictionRange = 'selected' | 'recent' | 'all';
type PracticalPromptFilter = 'all' | PracticalPrompt['group'] | 'provided' | 'review' | 'calculation' | 'search';
type PracticalGrade = 'correct' | 'partial' | 'review';
type PracticalProgress = { draft?: string; grade?: PracticalGrade; assessment?: PracticalAssessment; deleted?: boolean; updatedAt: number };
type PracticalStudyMode = 'type' | 'memorize';
type PracticalSessionSnapshot = { ids: string[]; deadline: number; finished: boolean; stoppedSeconds: number; pattern?: PracticalPattern; viewedAnswerIds?: string[] };
type BetaConfidence = 'sure' | 'unsure' | 'guess';
type BetaMistakeReason = 'concept' | 'formula' | 'unit' | 'careless';
type BetaModeMeta = {
  confidence?: BetaConfidence;
  reason?: BetaMistakeReason;
  correct?: boolean;
  at?: number;
};
type BetaQuestionMeta = {
  confidence?: BetaConfidence;
  reason?: BetaMistakeReason;
  note?: string;
  at?: number;
  modes?: Partial<Record<StudyMode, BetaModeMeta>>;
};
type ExamResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  official: boolean;
  criteria: string;
  source?: string;
  subjectRows: Array<{ subject: string; correct: number; total: number; score: number; passed: boolean }>;
};
type CbtHistoryState = {
  cbtSpace: string;
  view: ViewName;
  sessionId?: string;
  practicalRoom?: boolean;
  textbookRoom?: boolean;
  textbookCollection?: boolean;
  choosingTextbook?: boolean;
};
type MasteryRow = QuestionItem & {
  mastery: number;
  recall: number;
  dueAt: number;
  due: boolean;
  attempted: boolean;
};
type SavedLearningSession = {
  id?: string;
  version: 1;
  qualificationKey: string;
  mode?: StudyMode;
  roundId?: string;
  title: string;
  itemIds: string[];
  answers: Record<string, number>;
  kept: string[];
  page: number;
  pageSize: number;
  startedAt: number;
  remainingSeconds?: number;
  calculationMode?: boolean;
  savedAt: number;
};
type ClearedLearningSession = {
  version: 1;
  itemIds: [];
  savedAt: number;
  cleared: true;
};
type SessionReturnState = {
  view: ViewName;
  scrollY: number;
  roundId?: string;
};

const isJewelry = window.CBT_APP_SPACE === 'jewelry';
const spaceName = isJewelry ? '보석·귀금속 학습관' : '산업기사 통합 CBT';
const spaceScope = isJewelry ? 'jewelry' : 'industrial';
const simpsonsThemeImage = 'assets/theme/simpsons/homer-bart-choke-2x.webp';
const restoredDarkPreviewImage = 'assets/hvac/assets/questions/2022_1/43.jpg';
const simpsonsKingSizeImage = 'assets/theme/simpsons/king-size-homer.jpg';
const simpsonsBurnsImages = [
  'assets/theme/simpsons/mr-burns-excellent.jpg',
  'assets/theme/simpsons/mr-burns-excellent-pink.jpg',
  'assets/theme/simpsons/mr-burns-excellent-smithers.jpg',
];
const simpsonsBurnsImage = simpsonsBurnsImages[Math.floor(Math.random() * simpsonsBurnsImages.length)] || simpsonsBurnsImages[0];
const simpsonsFunnyImages = [
  'assets/theme/simpsons/homer-serious-hd.jpg',
  'assets/theme/simpsons/homer-bart-hospital-hd.jpg',
  'assets/theme/simpsons/king-size-homer-grin.jpg',
  'assets/theme/simpsons/king-size-homer-cool.jpg',
  'assets/theme/simpsons/king-size-homer-phone.jpg',
  'assets/theme/simpsons/king-size-homer-bart.jpg',
  'assets/theme/simpsons/king-size-homer-dr-nick.jpg',
  'assets/theme/simpsons/king-size-homer-hardhat.jpg',
  'assets/theme/simpsons/king-size-homer-exercise.jpg',
  'assets/theme/simpsons/king-size-homer-exhausted.jpg',
];
const simpsonsHeroScenes = [simpsonsFunnyImages[0], simpsonsFunnyImages[1], simpsonsFunnyImages[3], simpsonsBurnsImage];
const sunjaeThemeBanner = 'assets/theme/sunjae/sunjae-cherry-capture.jpg';
const sunjaePraiseImage = 'assets/theme/sunjae/sunjae-smile-capture.jpg';
const sunjaeEncourageImage = 'assets/theme/sunjae/sunjae-encourage.jpg';
const sunjaeGradingImage = 'assets/theme/sunjae/wooseok-restaurant-portrait.jpg';
const sunjaeCherryImage = 'assets/theme/sunjae/sunjae-cherry-capture.jpg';
const sunjaeImages = [
  sunjaeCherryImage,
  sunjaePraiseImage,
  sunjaeEncourageImage,
  'assets/theme/sunjae/sunjae-campus.png',
  'assets/theme/sunjae/wooseok-restaurant-portrait.jpg',
  'assets/theme/sunjae/wooseok-blue-backstage.jpg',
];
const sunjaePortraitImages = [
  sunjaePraiseImage,
  'assets/theme/sunjae/sunjae-campus.png',
  sunjaeCherryImage,
  'assets/theme/sunjae/wooseok-restaurant-portrait.jpg',
];
const savedSunjaeRotationValue = localStorage.getItem('unified-cbt-sunjae-rotation-seconds');
const savedSunjaeRotationSeconds = savedSunjaeRotationValue === null ? Number.NaN : Number(savedSunjaeRotationValue);
const sunjaeRotationChoices = [0, 5, 10, 30, 60, 180, 300];
const schoolExamData = ref(loadSchoolExamData());
const schoolCatalog = reactive(schoolExamCatalog(schoolExamData.value));
const { initialCatalogs } = defineProps<{initialCatalogs: Catalog[]}>();
const catalogs = reactive([...initialCatalogs, ...(!isJewelry ? [schoolCatalog] : [])]);
const referenceRounds = loadReferenceRounds();
const qualificationMeta: Record<string, { icon: string; className: string; description: string }> = {
  hvac: { icon: '❄', className: 'blue', description: '공조·냉동·설치운영' },
  'hvac-hansol': { icon: 'H', className: 'hansol-blue', description: '한솔 원문 · 별도 회차 학습' },
  safety: { icon: '⛑', className: 'orange', description: '안전관리·위험방지' },
  energy: { icon: '♨', className: 'green', description: '열·연소·설비관리' },
  'energy-midterm': { icon: '♨', className: 'green', description: '중간고사20주제 · 전용 오답·점수' },
  maintenance: { icon: '⚙', className: 'violet', description: '자동화·진단·기계정비' },
  'maintenance-engineer': { icon: '⚙', className: 'violet', description: '기사 기출 · 진단·관리·보전·공유압' },
  'electric-craftsman': { icon: '⚡', className: 'blue', description: '전기이론·기기·설비' },
  'gas-craftsman': { icon: '◉', className: 'green', description: '가스안전·장치·일반' },
  'hazardous-craftsman': { icon: '◆', className: 'orange', description: '화재예방·위험물 취급' },
  'information-engineer': { icon: 'IT', className: 'violet', description: '설계·개발·DB·프로그래밍·시스템' },
  'forklift-craftsman': { icon: '▣', className: 'orange', description: '주행·적재·운반·하역·안전관리' },
  'gem-appraiser': { icon: '◇', className: 'jewel-red', description: '보석학·감별·다이아몬드' },
  'gem-appraiser-target': { icon: '✦', className: 'jewel-target', description: '큐넷 4과목 통합 모의시험' },
  'precious-industrial': { icon: '◆', className: 'jewel-gold', description: '장신구·귀금속 가공' },
  'precious-craftsman': { icon: '◈', className: 'jewel-teal', description: '재료·가공·작업안전' },
  'precious-master': { icon: '✦', className: 'jewel-purple', description: '귀금속가공 종합' },
  [SCHOOL_EXAM_CATALOG_KEY]: { icon: '✎', className: 'school-navy', description: '중간·기말 · 주관식 암기 · 교재 범위' },
};

const studyResourceKeys = new Set(['hvac-hansol', 'energy-midterm', SCHOOL_EXAM_CATALOG_KEY]);
const qualificationGroups = [
  { label: '자격증 기출', items: catalogs.filter(catalog => !studyResourceKeys.has(catalog.key)) },
  { label: '교재 · 학교시험', items: catalogs.filter(catalog => studyResourceKeys.has(catalog.key)) },
].filter(group => group.items.length);

const qualificationStorageKey = `modern-cbt-qualification-${spaceScope}`;
const learningSessionStorageKey = `unified-cbt-learning-session-${spaceScope}`;
const learningSessionProgressKey = 'activeLearningSessionV1';
const savedQualification = localStorage.getItem(qualificationStorageKey);
const selectedKey = ref(catalogs.some((item) => item.key === savedQualification) ? savedQualification! : catalogs[0]?.key || '');
const isRegularQualification = (key: string) => key !== SCHOOL_EXAM_CATALOG_KEY && key !== 'energy-midterm';
const regularQualificationStorageKey = `${qualificationStorageKey}-last-regular`;
const savedRegularQualification = localStorage.getItem(regularQualificationStorageKey);
let lastRegularQualification = isRegularQualification(selectedKey.value) ? selectedKey.value
  : catalogs.find(item => item.key === savedRegularQualification && isRegularQualification(item.key))?.key
    || catalogs.find(item => isRegularQualification(item.key))?.key || '';
const displayPreference = ref<DisplayPreference>(window.CBT_DISPLAY_PREFERENCE === 'mobile' || window.CBT_DISPLAY_PREFERENCE === 'desktop'
  ? window.CBT_DISPLAY_PREFERENCE : 'auto');
const resolvedDisplayMode = window.CBT_DISPLAY_MODE || 'desktop';
const savedFontFamily = localStorage.getItem('unified-cbt-font-family');
const fontFamilyPreference = ref<FontFamilyPreference>(savedFontFamily === 'bold' || savedFontFamily === 'd2coding' || savedFontFamily === 'd2coding-bold'
  ? savedFontFamily : 'regular');
document.documentElement.dataset.fontFamily = fontFamilyPreference.value;
const view = ref<ViewName>('home');
const textbookPagesOpen = ref(false);
const choosingTextbook = ref(false);
const textbookReaderOpen = ref(false);
const textbookKey = ref<TextbookKey>(localStorage.getItem('cbt-textbook-selected')==='energy'?'energy':'hansol');
const textbookLoading = ref(false);
const textbookError = ref('');
let textbookLoadRevision = 0;
const roundsCollection = computed(() => textbookPagesOpen.value ? 'textbook' : !isJewelry && selectedKey.value === SCHOOL_EXAM_CATALOG_KEY ? 'cooling' : 'regular');
const settingsReturnView = ref<ViewName>('home');
const curriculum = ref<CurriculumScope>('all-mapped');
const yearFrom = ref(0);
const yearTo = ref(0);
const session = ref<SessionState | null>(null);
watch(()=>session.value?.id,()=>{pinnedSolution.value=null;panelCalculator.value=false;panelNotes.value=false});
const examResult = ref<ExamResult | null>(null);
const mobileMenuOpen = ref(false);
const sessionMenuOpen = ref(false);
const examSheetOpen = ref(false);
const toastMessage = ref('');
const theme = ref(currentTheme());
const visualStyle = ref<VisualStyle>(currentVisualStyle());
const sunjaeImageIndex = ref(0);
const sunjaeRotationSeconds = ref(sunjaeRotationChoices.includes(savedSunjaeRotationSeconds) ? savedSunjaeRotationSeconds : 180);
const dynamicUiEnabled = ref(currentDynamicUiEnabled());
const { active: uiLabActive, motion: uiLabMotion } = useUiLab();
const experimentalFeaturesEnabled = ref(localStorage.getItem('unified-cbt-experimental-features') !== 'false');
document.documentElement.dataset.experimentalFeatures = experimentalFeaturesEnabled.value ? 'on' : 'off';
const visualTransitionPhase = ref<VisualTransitionPhase>(null);
const visualTransitionTarget = ref<VisualStyle>(visualStyle.value);
const experienceTransitionPhase = ref<ExperienceTransitionPhase>(null);
const navigationDirection = ref<1 | -1>(1);
const questionDirection = ref<1 | -1>(1);
const quickPreset = ref<5 | 10 | 0>(10);
const predictionRange = ref<PredictionRange>('selected');
const includeHansolInRandom = ref(localStorage.getItem('unified-cbt-random-include-hansol') !== 'false');
const settingsOpen = ref(false);
const settingsExpanded = ref(false);
watch(settingsOpen, open => { if (!open) settingsExpanded.value = false; });
const nativeMoreOpen = ref(false);
const nativeCalculatorOpen = ref(false);
const formulaWorkbenchOpen = ref(false);
const learningImportInput = ref<HTMLInputElement | null>(null);
const updateAvailable = ref(Boolean(window.CBT_UPDATE_AVAILABLE));
const pwaRegistrationError = ref(Boolean(window.CBT_PWA_REGISTRATION_ERROR));
const updateChecking = ref(false);
const openUpdatesAfterRefreshKey = `cbt-open-updates-after-refresh-${spaceScope}`;
const searchQuery = ref('');
const searchResultIds = ref<string[]>([]);
const searchReady = ref(false);
const searchScope = ref<'current' | 'hvac' | 'selected' | 'all'>(['hvac', 'hvac-hansol'].includes(selectedKey.value) ? 'hvac' : 'current');
const searchCatalogKeys = ref<string[]>(['hvac', 'hvac-hansol']);
const searchSubject = ref('all');
const searchLoading = ref(false);
const searchError = ref('');
const searchTotal = ref(0);
let searchRequestId = 0;
let searchLoadSequence = 0;
const coolingLoading = ref(false);
const coolingError = ref('');
const searchSetId = ref('');
const newSearchSetTitle = ref('냉동공학 중간고사 · 선택 문제');
const searchBookmarksOnly = ref(false);
const wrongRoundFilter = ref('');
const wrongTypeFilter = ref<'all' | 'calculation'>('all');
const calculationSubjectFilter = ref('all');
const calculationRoundFilter = ref('all');
const calculationResultFilter = ref<'all' | 'wrong'>('all');
const calculationPage = ref(1);
const bookmarkRoundFilter = ref('all');
const questionJudgmentEnabled = ref(localStorage.getItem('unified-cbt-question-judgment') === 'true');
const betaModeFilter = ref<StudyMode>('learn');
const learningJumpNumber = ref('');
const fontScale = ref(Math.min(1.6, Math.max(.8, Number(studyStore.fontScale) || 1)));
const recentExamRecords = ref<ExamRecord[]>([]);
const coolingExamRecords = ref<ExamRecord[]>([]);
const coolingSessionActive = computed(() => Boolean(session.value?.items.length && session.value.items.every(item => isCoolingRecord(item.id))));
const sessionQualificationKey = computed(() => coolingSessionActive.value ? SCHOOL_EXAM_CATALOG_KEY : selectedKey.value);
const officialRule = computed(() => coolingSessionActive.value ? undefined : qualificationRuleFor(selectedKey.value));
const officialExamQuestionCount = computed(() => officialRule.value?.totalQuestions
  || (selectedSubjects.value.length * (officialRule.value?.questionsPerSubject || 20)));
const officialExamRecords = computed(() => recentExamRecords.value.filter((record) => !record.mode || record.mode === 'exam'));
const displayedPassChance = ref(0);
const displayedResultScore = ref(0);
const sunjaeResultPhase = ref<SunjaeResultPhase>('reveal');
const appHydrating = ref(true);
// The first mobile home can navigate from the catalog index while Dexie restores
// history. Keep result and study screens behind their existing hydration gate.
const showHydrationSkeleton = computed(() => {
  if (!appHydrating.value || !dynamicUiEnabled.value) return false;
  if (resolvedDisplayMode === 'mobile' && visualStyle.value === 'default') {
    if (view.value === 'home' && selectedCatalog.value.isPlaceholder && !savedLearningSession.value) return false;
    if (view.value === 'rounds' && textbookPagesOpen.value) return false;
  }
  return true;
});
const isNativeApp = document.documentElement.dataset.nativeApp === 'true';
const androidApkUrl = 'https://github.com/tk6871/cbt/releases/download/android-latest/industrial-cbt-latest.apk';
const platformUserAgent = navigator.userAgent || '';
const isIosDevice = /iPad|iPhone|iPod/i.test(platformUserAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroidDevice = /Android/i.test(platformUserAgent);
const showAndroidApkPopup = isAndroidDevice && !isNativeApp;
const showAndroidApkPatchDownload = !isIosDevice;
const androidApkPopupOpen = ref(false);
const androidApkPopupSeenKey = 'unified-cbt-android-apk-popup-seen-v351';
const prefersReducedMotion = ref(matchMedia('(prefers-reduced-motion: reduce)').matches);
const upscalePreviewKind = ref<UpscalePreviewKind | null>(null);
const aiPromptOpen = ref(false);
const aiPromptText = ref('');
const aiPromptHasImage = ref(false);
const aiPromptImageUrls = ref<string[]>([]);
const aiPromptImageFilename = ref('cbt-question.png');
const aiImageBusy = ref(false);
const canShareAiQuestion = typeof navigator.share === 'function';
const savedAnswerLayout = localStorage.getItem('unified-cbt-answer-layout');
const answerLayout = ref<AnswerLayout>(savedAnswerLayout === 'inline' || savedAnswerLayout === 'hotspot' ? savedAnswerLayout : 'classic');
const savedHotspotIndicator = localStorage.getItem('unified-cbt-hotspot-indicator');
const hotspotIndicator = ref<HotspotIndicator>(savedHotspotIndicator === 'area' ? 'area' : 'marker');
const savedRestoredImageTheme = localStorage.getItem('unified-cbt-restored-image-theme');
const restoredImageTheme = ref<RestoredImageTheme>(
  savedRestoredImageTheme === 'original' ? 'original' : 'auto',
);
const savedSolveLayout = localStorage.getItem('unified-cbt-solve-layout');
const solveLayoutMode = ref<SolveLayoutMode>(
  savedSolveLayout === 'comcbt' || savedSolveLayout === 'combat' ? savedSolveLayout : 'standard',
);
const omrFilter = ref<OmrFilter>('all');
const activeSessionItemId = ref('');
let sessionReturnState: SessionReturnState | null = null;
const omrListRef = ref<HTMLElement | null>(null);
let timerHandle = 0;
let toastHandle = 0;
let searchHandle = 0;
let resizeSettleHandle = 0;
let resizeAnimationFrame = 0;
let sunjaeRotationHandle = 0;
let sunjaeResultHandle = 0;
let learningSessionSaveHandle = 0;
let searchWorker: Worker | null = null;
let motionMediaQuery: MediaQueryList | null = null;
let motionPreferenceHandler: ((event: MediaQueryListEvent) => void) | null = null;
let nativeBackHandle: PluginListenerHandle | null = null;
let suspendedSession: SessionState | null = null;
let suspendedExamResult: ExamResult | null = null;
let omrManualScrollUntil = 0;
const historyScope = `cbt-${spaceScope}`;
const viewOrder: ViewName[] = ['home', 'rounds', 'school', 'history', 'wrong', 'search', 'calculation', 'guide', 'coach', 'beta', 'stats', 'updates', 'showcase', 'settings'];
const viewScrollPositions = new Map<ViewName, number>();

const selectedCatalog = computed<Catalog>(() => catalogs.find((item) => item.key === selectedKey.value) || catalogs[0]);
const sourceCatalogs = catalogs.filter((catalog) => !catalog.isVirtual);
const currentSunjaeImage = computed(() => sunjaeImages[sunjaeImageIndex.value % sunjaeImages.length] || sunjaeThemeBanner);
const themeBackdropStyle = computed<Record<string, string>>(() => {
  if (visualStyle.value === 'sunjae') return { '--theme-main-photo': `url("${new URL(currentSunjaeImage.value, document.baseURI).href}")` };
  if (visualStyle.value === 'simpsons') return {
    '--theme-main-photo': `url("${new URL(simpsonsThemeImage, document.baseURI).href}")`,
    '--simpsons-sidebar-photo': `url("${new URL(simpsonsKingSizeImage, document.baseURI).href}")`,
  };
  return {} as Record<string, string>;
});
const sidebarThemeStyle = computed<Record<string, string>>(() => {
  if (visualStyle.value === 'simpsons') return {
    backgroundImage: `linear-gradient(180deg, rgba(255,217,15,.16), rgba(255,217,15,.34)), url("${simpsonsKingSizeImage}")`,
    backgroundPosition: '52% 50%',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  };
  if (visualStyle.value === 'sunjae') return {
    backgroundImage: `linear-gradient(165deg, rgba(225,244,255,.56), rgba(255,232,244,.64)), url("${currentSunjaeImage.value}")`,
    backgroundPosition: '50% 20%',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  };
  return {} as Record<string, string>;
});
const availableYears = computed(() => {
  const years = yearsFor(selectedCatalog.value);
  if (selectedKey.value !== 'energy') return years;
  return [...new Set([...years, ...referenceRounds.map((round) => Number(round.year))])]
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
});
const rangeRounds = computed(() => {
  const rounds = roundsInRange(selectedCatalog.value, yearFrom.value, yearTo.value);
  if (selectedKey.value === 'energy') {
    return [...referenceRounds.filter((round) => round.year >= yearFrom.value && round.year <= yearTo.value), ...rounds];
  }
  return rounds;
});
const energySourceMode = ref<EnergySourceMode>((() => {
  try { return localStorage.getItem('cbt-energy-midterm-source-v1') === 'combined' ? 'combined' : 'textbook'; }
  catch { return 'textbook'; }
})());
watch(energySourceMode, mode => { try { localStorage.setItem('cbt-energy-midterm-source-v1', mode); } catch {} });
const visibleRounds = computed(() => {
  const rounds = sortedRounds(selectedCatalog.value);
  if (selectedKey.value === 'energy-midterm') return energySourceRounds(rounds, energySourceMode.value);
  if (selectedKey.value !== 'energy') return rounds;
  return [...referenceRounds, ...rounds].sort((a, b) =>
    b.year - a.year || String(b.date || b.session || '').localeCompare(String(a.date || a.session || ''), 'ko', { numeric: true }));
});
const energyMidtermQuestionCount = computed(() => visibleRounds.value.reduce((sum, round) => sum + round.questions.length, 0));
function catalogDisplayQuestionCount(catalog: Catalog): number {
  if (catalog.key === 'energy-midterm' && !catalog.isPlaceholder)
    return energySourceRounds(catalog.rounds, energySourceMode.value).reduce((sum,r)=>sum+r.questions.length,0);
  return catalog.questionCount ?? catalog.rounds.reduce((sum,r)=>sum+r.questions.length,0);
}
const energyCalculationExcluded = ref<string[]>((() => {
  try {
    const read = (key: string): unknown => {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    };
    const saved = read('cbt-energy-midterm-calculation-excluded-v3');
    const legacy = read('cbt-energy-midterm-calculation-excluded-v2');
    return restoreEnergyCalculationExcluded(saved, legacy);
  } catch { return [...energyDefaultCalculationExcluded]; }
})());
watch(energyCalculationExcluded, value => {
  try { localStorage.setItem('cbt-energy-midterm-calculation-excluded-v3', JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
}, { deep:true, immediate:true });
const energyCalculationReviewOpen = ref(false);
const energyCalculationReviewItems = computed(() => selectedKey.value === 'energy-midterm'
  ? visibleRounds.value.flatMap(round => roundToItems({ ...round, questions:round.questions.filter(q => q.midtermCalculation) })) : []);
function energyTopicQuestions(round: Round): Question[] {
  return energyCalculationExcluded.value.includes(round.id) ? round.questions.filter(q => !q.midtermCalculation) : round.questions;
}
function setEnergyTopicCalculation(roundId: string, enabled: boolean): void {
  energyCalculationExcluded.value = enabled ? energyCalculationExcluded.value.filter(id => id !== roundId) : [...new Set([...energyCalculationExcluded.value, roundId])];
}
function setAllEnergyCalculations(enabled: boolean): void {
  energyCalculationExcluded.value = enabled ? [] : visibleRounds.value.filter(r => r.questions.some(q => q.midtermCalculation)).map(r => r.id);
}
const energyMidtermEligibleQuestions = computed(() => visibleRounds.value.flatMap(energyTopicQuestions));
const energyMidtermBookCount = computed(() => energyMidtermEligibleQuestions.value.filter(q => q.bookVerified).length);
const energyMidtermDirectCount = computed(() => energyMidtermEligibleQuestions.value.filter(q => q.midtermPriority !== 'related').length);
const energyMidtermRelatedCount = computed(() => energyMidtermEligibleQuestions.value.filter(q => q.midtermPriority === 'related').length);
const energyMidtermPdfCount = computed(() => energyMidtermEligibleQuestions.value.filter(q => q.midtermPdfSources?.length).length);
const energyMidtermPriorityGroups = computed(() => [
  {key:'repeat' as const,title:'교재·CBT 반복 예상',note:'시험범위 · 2020년까지 기출 ↔ 교재2021~2025년 반복·변형'},
  {key:'recent' as const,title:'교재2021~2025년 예상',note:'시험범위 · 교재의 후기 문제 중 직접 맞는 질문'},
  {key:'note' as const,title:'시험범위에 맞는 기출',note:'시험범위 · 앞의 두 묶음에 포함되지 않은 기출'},
  {key:'related' as const,title:'주제 관련 추가 예상',note:'범위 보강 · 같은 주제의 다른 질문과 불명확한 내용'},
].map(g=>({...g,count:energyMidtermEligibleQuestions.value.filter(q=>q.midtermPriority===g.key).length})));
const selectedSubjects = computed(() => subjectsForScope(selectedCatalog.value, curriculum.value));
const selectedItems = computed(() => selectedKey.value === 'energy-midterm'
  ? visibleRounds.value.flatMap(round => roundToItems({ ...round, questions:energyTopicQuestions(round) }))
  : questionItems(selectedCatalog.value, yearFrom.value, yearTo.value, curriculum.value));
const targetItemMap = new Map((catalogs.find((catalog) => catalog.key === GEM_APPRAISER_TARGET_KEY)?.rounds || [])
  .flatMap((round) => round.questions.map((question) => ({
    round,
    question,
    subject: subjectFor(round, question),
    id: questionId(round, question),
  })))
  .map((item) => [item.id, item]));
const allItems = computed(() => [
  ...sourceCatalogs.flatMap((catalog) => sortedRounds(catalog)),
  ...referenceRounds,
  ...(!isJewelry ? [hvacFieldReportRound] : []),
].flatMap((round) => round.questions.map((question) => ({
  round,
  question,
  subject: subjectFor(round, question),
  id: questionId(round, question),
}))));
const coolingItems = computed(() => coolingMidtermItems(allItems.value).map(coolingRecordItem));
const coolingSafetyPool = computed(() => coolingSafetyItems(allItems.value).map(coolingRecordItem));
const textbookSupplement = shallowRef<QuestionItem[]>([]);
const textbooksReady = new Set<TextbookKey>();
type TextbookModule = typeof import('./textbookPages').browserTextbookData;
const prepareEnergyBook = shallowRef<typeof import('./energyQuestionLayout').prepareEnergyBookItem>();
const textbookModule = shallowRef<TextbookModule>();
let textbookImport: Promise<TextbookModule> | undefined;
function loadTextbookModule(): Promise<TextbookModule> {
  return textbookImport ??= import('./textbookPages').then(({browserTextbookData}) => {
    textbookModule.value = browserTextbookData;
    return browserTextbookData;
  }).catch(error => { textbookImport = undefined; throw error; });
}
const textbookItems = computed(() => textbookModule.value?.buildTextbookItems([...allItems.value,...textbookSupplement.value],prepareEnergyBook.value) ?? []);
const textbookAnswers = computed(() => textbookAnswersIn(studyStore.progress || {}));
const itemMap = computed(() => new Map([...allItems.value, ...textbookItems.value, ...coolingRecordSourceItems(allItems.value).map(coolingRecordItem), ...coolingItemsWithOccurrences(coolingItems.value), ...coolingItemsWithOccurrences(coolingSafetyPool.value)].map((item) => [item.id, item])));
const coolingDrawKey = 'school-cooling-midterm-draws';
const coolingArchiveKey = 'school-cooling-midterm-sessions';
const coolingDrawState = computed<CoolingDrawState>(() => {
  const value = studyStore.progress?.[coolingDrawKey] as CoolingDrawState | undefined;
  return { ids: Array.isArray(value?.ids) ? value.ids.filter(id => typeof id === 'string') : [], resetAt: Number(value?.resetAt) || 0, savedAt: Number(value?.savedAt) || 0 };
});
const coolingUnusedIds = computed(() => coolingUnusedItems(coolingItems.value, coolingItems.value, coolingDrawState.value, studyStore.attempts).map(item => item.id));
const coolingArchive = computed(() => {
  const value = studyStore.progress?.[coolingArchiveKey] as { sessions?: SavedLearningSession[] } | undefined;
  return (Array.isArray(value?.sessions) ? value.sessions : []).filter(saved => saved.id && Array.isArray(saved.itemIds)
    && saved.itemIds.length && saved.itemIds.every(isCoolingRecord)).sort((a, b) => b.savedAt - a.savedAt);
});
const coolingCompleted = computed(() => coolingExamRecords.value.filter(record => record.itemIds?.length && record.itemIds.every(isCoolingRecord)));
function saveCoolingArchive(saved: SavedLearningSession): void {
  if (!saved.id || !saved.itemIds.every(isCoolingRecord)) return;
  studyStore.progress ||= {};
  studyStore.progress[coolingArchiveKey] = { sessions: [saved, ...coolingArchive.value.filter(item => item.id !== saved.id)], savedAt: Date.now() };
}
function resetCoolingDraws(): void {
  if (!confirm('랜덤 출제 순환을 다시 시작할까요? 중간고사 오답·점수·이어풀기 기록은 그대로 유지됩니다.')) return;
  studyStore.progress ||= {};
  studyStore.progress[coolingDrawKey] = { ids: [], resetAt: Date.now(), savedAt: Date.now() };
}
function resumeCoolingArchived(id: string): void {
  const saved = coolingArchive.value.find(item => item.id === id);
  if (!saved) return;
  savedLearningSession.value = saved;
  void resumeSavedLearning();
}
function learningProgressValue(): SavedLearningSession | ClearedLearningSession | null {
  const value = studyStore.progress?.[learningSessionProgressKey];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as SavedLearningSession | ClearedLearningSession;
  if (candidate.version !== 1 || !Array.isArray(candidate.itemIds) || !Number(candidate.savedAt)) return null;
  if (!candidate.itemIds.length) return (candidate as ClearedLearningSession).cleared ? candidate : null;
  return candidate as SavedLearningSession;
}

function readLocalLearningSession(): SavedLearningSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(learningSessionStorageKey) || 'null') as SavedLearningSession | null;
    if (!saved || saved.version !== 1 || !Array.isArray(saved.itemIds) || !saved.itemIds.length) return null;
    return saved;
  } catch {
    localStorage.removeItem(learningSessionStorageKey);
    return null;
  }
}

function readSavedLearningSession(): SavedLearningSession | null {
  const local = readLocalLearningSession();
  const synced = learningProgressValue();
  if (synced && synced.savedAt >= Number(local?.savedAt || 0)) {
    if (!synced.itemIds.length) {
      localStorage.removeItem(learningSessionStorageKey);
      return null;
    }
    localStorage.setItem(learningSessionStorageKey, JSON.stringify(synced));
    return synced as SavedLearningSession;
  }
  return local;
}
const savedLearningSession = ref<SavedLearningSession | null>(readSavedLearningSession());
const coolingSavedSession = computed(() => Boolean(savedLearningSession.value?.itemIds.length && (savedLearningSession.value.itemIds.every(isCoolingRecord)
  || savedLearningSession.value.title.startsWith(`${coolingMidtermTitle} ·`))));
if (savedLearningSession.value && !learningProgressValue()) {
  studyStore.progress ||= {};
  studyStore.progress[learningSessionProgressKey] = savedLearningSession.value;
}
const legacyWrongItems = computed(() => (selectedKey.value === SCHOOL_EXAM_CATALOG_KEY
  ? [...allItems.value.filter(item => item.round.qualificationKey === SCHOOL_EXAM_CATALOG_KEY), ...coolingItems.value]
  : allItems.value).filter((item) => {
  const targetItem = selectedCatalog.value.isVirtual
    ? item.question.targetRelevance !== 'peripheral'
    : selectedKey.value === SCHOOL_EXAM_CATALOG_KEY || item.round.qualificationKey === selectedKey.value;
  return targetItem && studyStore.wrong[item.id];
}));
const wrongRoundGroups = computed(() => {
  const groups = new Map<string, { roundId: string; title: string; year: number; session: string; finishedAt: number; items: QuestionItem[]; attempts: number }>();
  recentExamRecords.value.forEach((record) => {
    if (!record.roundId || !record.wrongAnswers?.length) return;
    const existing = groups.get(record.roundId) || {
      roundId: record.roundId,
      title: record.title,
      year: record.year || 0,
      session: record.session || '',
      finishedAt: record.finishedAt,
      items: [],
      attempts: 0,
    };
    const ids = new Set(existing.items.map((item) => item.id));
    record.wrongAnswers.forEach((wrong) => {
      const item = itemMap.value.get(wrong.id);
      if (item && !ids.has(item.id)) {
        existing.items.push(item);
        ids.add(item.id);
      }
    });
    existing.finishedAt = Math.max(existing.finishedAt, record.finishedAt);
    existing.attempts += 1;
    groups.set(record.roundId, existing);
  });
  legacyWrongItems.value.forEach((item) => {
    const existing = groups.get(item.round.id) || {
      roundId: item.round.id,
      title: item.round.title,
      year: item.round.year,
      session: item.round.session || item.round.date || '',
      finishedAt: Number(studyStore.attempts[item.id]?.at) || 0,
      items: [],
      attempts: 0,
    };
    if (!existing.items.some((existingItem) => existingItem.id === item.id)) existing.items.push(item);
    existing.finishedAt = Math.max(existing.finishedAt, Number(studyStore.attempts[item.id]?.at) || 0);
    existing.attempts = Math.max(1, existing.attempts);
    groups.set(item.round.id, existing);
  });
  return [...groups.values()].sort((a, b) => b.finishedAt - a.finishedAt);
});
const wrongItems = computed(() => {
  if (wrongRoundGroups.value.length) {
    const selected = wrongRoundGroups.value.find((group) => group.roundId === wrongRoundFilter.value)
      || wrongRoundGroups.value[0];
    return selected.items;
  }
  return legacyWrongItems.value;
});
const wrongQuestionIds = computed(() => new Set(
  wrongRoundGroups.value.flatMap((group) => group.items.map((item) => item.id)),
));
const displayedWrongItems = computed(() => wrongTypeFilter.value === 'calculation'
  ? wrongItems.value.filter(isCalculationItem)
  : wrongItems.value);
const selectedWrongCalculationCount = computed(() => wrongItems.value.filter(isCalculationItem).length);
const selectedWrongRoundId = computed(() => wrongRoundGroups.value.find((group) => group.roundId === wrongRoundFilter.value)?.roundId
  || wrongRoundGroups.value[0]?.roundId
  || '');
const wrongAnswerDetailMap = computed(() => {
  const details = new Map<string, { selected: number; answer: number }>();
  recentExamRecords.value.forEach((record) => {
    if (record.roundId !== selectedWrongRoundId.value) return;
    record.wrongAnswers?.forEach((wrong) => {
      if (!details.has(wrong.id)) details.set(wrong.id, { selected: wrong.selected, answer: wrong.answer });
    });
  });
  wrongItems.value.forEach((item) => {
    const attempt = studyStore.attempts[item.id];
    if (!details.has(item.id) && attempt && !attempt.lastCorrect) {
      details.set(item.id, { selected: attempt.lastChoice, answer: item.question.answer });
    }
  });
  return details;
});
const roundWrongGroupMap = computed(() => new Map(wrongRoundGroups.value.map((group) => [group.roundId, group])));
const roundRecordMap = computed(() => {
  const records = new Map<string, ExamRecord>();
  recentExamRecords.value.forEach((record) => {
    if (!record.roundId || (record.mode && record.mode !== 'exam') || records.has(record.roundId)) return;
    records.set(record.roundId, record);
  });
  return records;
});
const lastRoundRecord = computed(() => recentExamRecords.value.find((record) => record.roundId && (!record.mode || record.mode === 'exam')) || null);
const searchResults = computed(() => {
  const lookup = selectedCatalog.value.isVirtual && searchScope.value === 'current' ? targetItemMap : itemMap.value;
  return searchResultIds.value.map((id) => lookup.get(id)).filter((item): item is QuestionItem => Boolean(item));
});
const searchKeys = computed(() => searchScope.value === 'hvac' ? ['hvac', 'hvac-hansol']
  : searchScope.value === 'selected' ? searchCatalogKeys.value
    : searchScope.value === 'all' ? catalogs.filter(catalog => !catalog.isVirtual).map(catalog => catalog.key)
      : selectedCatalog.value.isVirtual ? sourceCatalogs.map(catalog => catalog.key) : [selectedKey.value]);
const searchScopeLabel = computed(() => searchScope.value === 'hvac' ? '공조 + 한솔 공조'
  : searchScope.value === 'all' ? '전체 종목' : searchScope.value === 'selected' ? `${searchKeys.value.length}개 종목` : selectedCatalog.value.name);
const searchSubjects = computed(() => [...new Set(allItems.value.filter(item => searchKeys.value.includes(item.round.qualificationKey || ''))
  .map(normalizedSchoolSubject))].sort((a, b) => a.localeCompare(b, 'ko')));
const coolingWrongIds = computed(() => coolingItems.value.filter(item => studyStore.attempts[item.id]
  && !studyStore.attempts[item.id].lastCorrect).map(item => item.id));
const searchableCatalogItems = computed(() => {
  if (selectedCatalog.value.isVirtual && searchScope.value === 'current') return [...targetItemMap.values()]
    .filter(item => searchSubject.value === 'all' || normalizedSchoolSubject(item) === searchSubject.value);
  const items = allItems.value;
  return items.filter(item => searchKeys.value.includes(item.round.qualificationKey || '')
    && (searchSubject.value === 'all' || normalizedSchoolSubject(item) === searchSubject.value));
});
const bookmarkedCatalogItems = computed(() => searchableCatalogItems.value
  .filter((item) => studyStore.bookmarks.includes(item.id)));
const bookmarkRounds = computed(() => {
  const rows = new Map<string, { id: string; label: string; year: number; count: number }>();
  bookmarkedCatalogItems.value.forEach((item) => {
    const existing = rows.get(item.round.id);
    if (existing) {
      existing.count += 1;
      return;
    }
    rows.set(item.round.id, {
      id: item.round.id,
      label: `${item.round.year}년 ${item.round.session || item.round.date || item.round.title.replace(/^.*?:\s*/, '')}`,
      year: item.round.year,
      count: 1,
    });
  });
  return [...rows.values()].sort((a, b) => b.year - a.year || b.label.localeCompare(a.label, 'ko', { numeric: true }));
});
const displayedSearchResults = computed(() => {
  const filterBookmarkRound = (items: QuestionItem[]) => items.filter((item) =>
    bookmarkRoundFilter.value === 'all' || item.round.id === bookmarkRoundFilter.value);
  if (searchQuery.value.length >= 2) {
    return searchBookmarksOnly.value
      ? filterBookmarkRound(searchResults.value.filter((item) => studyStore.bookmarks.includes(item.id)))
      : searchResults.value;
  }
  return searchBookmarksOnly.value
    ? filterBookmarkRound(bookmarkedCatalogItems.value)
    : [];
});
const hiddenPatchTerms = /선재|변우석|류선재|선재 업고 튀어|tvN/i;
const patchEntries = computed(() => (window.CBT_CHANGELOG?.entries || [])
  .filter((entry) => (entry.scope || 'industrial') === spaceScope)
  .filter((entry) => !hiddenPatchTerms.test(entry.title) && !hiddenPatchTerms.test(entry.summary || ''))
  .map((entry) => ({
    ...entry,
    tags: (entry.tags || []).filter((tag) => !hiddenPatchTerms.test(tag)),
    changes: (entry.changes || []).filter((change) => !hiddenPatchTerms.test(change)),
  })));
const currentVersion = computed(() => window.CBT_CHANGELOG?.versions?.[spaceScope] || patchEntries.value[0]?.version || '-');
const featureImageItem = computed(() => {
  const scoped = selectedCatalog.value.isVirtual
    ? [...targetItemMap.values()]
    : allItems.value.filter((item) => item.round.qualificationKey === selectedKey.value);
  return scoped.find((item) => item.question.sourceImage)
    || scoped.find((item) => item.question.images?.length || item.question.choices.some((choice) => choice.images?.length))
    || scoped[0];
});
const upscaleComparison = computed(() => isJewelry
  ? {
      subject: '보석관 보기 이미지',
      original: 'assets/jewelry/gem-appraiser/9260/gf20100711m60b1.gif',
      originalSize: '76 × 45px · 원본 GIF',
      improved: 'assets/jewelry/gem-appraiser/9260/gf20100711m60b1.png',
      improvedSize: '152 × 90px · 개선 PNG',
      count: '보석관 56개 이미지',
    }
  : {
      subject: '산업안전 논리회로 도표',
      original: 'assets/safety/assets/comcbt/20140525/images/kv20140525m24.gif',
      originalSize: '207 × 149px · 원본 GIF',
      improved: 'assets/safety/assets/comcbt/20140525/images/kv20140525m24.png',
      improvedSize: '414 × 298px · 개선 PNG',
      count: '전 종목 4,050개 이미지',
    });
const upscalePreview = computed(() => {
  if (!upscalePreviewKind.value) return null;
  const original = upscalePreviewKind.value === 'original';
  return {
    src: original ? upscaleComparison.value.original : upscaleComparison.value.improved,
    title: `${upscaleComparison.value.subject} · ${original ? '원본' : '업스케일링 후'}`,
    size: original ? upscaleComparison.value.originalSize : upscaleComparison.value.improvedSize,
  };
});
const darkActive = computed(() =>
  theme.value === 'dark'
  || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
const motionAllowed = computed(() => dynamicUiEnabled.value
  && !prefersReducedMotion.value
  && (!uiLabActive.value || uiLabMotion.value !== 'off'));
const viewTransitionName = computed(() => motionAllowed.value
  ? (navigationDirection.value > 0 ? 'view-forward' : 'view-backward')
  : '');
const questionTransitionName = computed(() => motionAllowed.value
  ? (questionDirection.value > 0 ? 'question-forward' : 'question-backward')
  : '');
const viewTitle = computed(() => ({
  home: '학습 홈',
  rounds: '회차별 문제',
  school: '학교 시험 준비',
  history: '학습 내역',
  wrong: '오답노트',
  search: '문제 검색',
  calculation: '계산문제만 풀기',
  guide: studyGuidePages.value[selectedKey.value]?.title || '시험 자료실',
  coach: '합격 엔진',
  beta: '베타 학습 도구',
  showcase: '신기술 학습관',
  stats: '학습 분석',
  updates: '패치노트',
  settings: '전체 설정',
})[view.value]);
const activeStudyGuide = computed(() => studyGuidePages.value[selectedKey.value] || null);
const studyGuideAvailable = computed(() => studyGuideKeys.has(selectedKey.value));
const hvacPracticalAvailable = computed(() =>
  (selectedKey.value === 'hvac' || selectedKey.value === 'hvac-hansol')
  && (Boolean(cloudSyncState.email) || location.hostname === '127.0.0.1' || location.hostname === 'localhost'));
const practicalPromptFilter = ref<PracticalPromptFilter>('all');
const practicalCategoryFilter = ref<'all' | PracticalCategory>('all');
const practicalRoundFilter = ref('all');
const practicalMaterialPeriod = ref<PracticalMaterialPeriod>('all');
const practicalPeriodAvailable = computed(() => ['all', 'restored', 'review'].includes(practicalPromptFilter.value));
const practicalPeriodCounts = computed(() => ({
  recent: practicalPrompts.value.filter(prompt => matchesPracticalMaterialPeriod(prompt, 'since-2023-2')).length,
  earlier: practicalPrompts.value.filter(prompt => matchesPracticalMaterialPeriod(prompt, 'before-2023-2')).length,
}));
const practicalSearch = ref('');
const practicalSearchIds = ref<string[]>([]);
const practicalSearchIdSet = computed(() => new Set(practicalSearchIds.value));
const practicalCalculationIds = ref<string[]>([]);
const practicalGuideSection = ref<'practice' | 'theory'>('practice');
const practicalPage = ref(1);
let practicalCursorRestoring = true;
function persistPracticalCursor(): void {
  if (practicalCursorRestoring) return;
  localStorage.setItem('cbt-practical-cursor', JSON.stringify({
    page: practicalPage.value, filter: practicalPromptFilter.value, category: practicalCategoryFilter.value,
    round: practicalRoundFilter.value, materialPeriod: practicalMaterialPeriod.value,
    search: practicalSearch.value, limit: practicalContinuousLimit.value,
    calculationIds: practicalCalculationIds.value,
    searchIds: practicalSearchIds.value,
    libraryTab: practicalLibraryTab.value, libraryScrollY: practicalLibraryScrollY,
  }));
}
const practicalStudyModeStorageKey = 'unified-cbt-hvac-practical-study-mode-v1';
const storedPracticalStudyMode = localStorage.getItem(practicalStudyModeStorageKey);
const practicalStudyMode = ref<PracticalStudyMode>(restorePracticalMode(storedPracticalStudyMode));
const practicalLayout = ref(localStorage.getItem('cbt-practical-layout') === 'list' ? 'list' : 'cbt');
const practicalOptionsOpen = ref(false);
const practicalNavigatorOpen = ref(false);
let practicalLibraryScrollY = 0;
const practicalHelperIds = ref<string[]>([]);
const practicalDraftClosedIds = ref<string[]>([]);
const practicalBatchSize = ref(restorePracticalBatch(localStorage.getItem('cbt-practical-batch-size')));
const practicalContinuousLimit = ref(20);
const practicalContinuous = computed(() => practicalLayout.value === 'list' && practicalBatchSize.value === 0);
const practicalDisplayChoice = computed({
  get: () => practicalLayout.value === 'cbt' ? 'single' : String(practicalBatchSize.value),
  set: (value: string) => {
    const index = (practicalPage.value - 1) * practicalPageSize.value;
    practicalLayout.value = value === 'single' ? 'cbt' : 'list';
    if (value !== 'single') practicalBatchSize.value = Number(value);
    practicalPage.value = Math.floor(index / practicalPageSize.value) + 1;
    if (practicalContinuous.value) practicalContinuousLimit.value = Math.max(20, index + 1);
  },
});
const practicalPageSize = computed(() => practicalLayout.value === 'cbt' ? 1 : practicalBatchSize.value || practicalPrompts.value.length);
watch(practicalLayout, (layout) => {
  localStorage.setItem('cbt-practical-layout', layout);
});
watch(practicalBatchSize, (size) => {
  localStorage.setItem('cbt-practical-batch-size', String(size));
});
const practicalCategoryOptions = Object.entries(practicalCategoryLabels) as [PracticalCategory, string][];
const practicalProgressStorageKey = 'unified-cbt-hvac-practical-progress-v1';
const practicalSessionStorageKey = 'unified-cbt-hvac-practical-session-v1';
const practicalPatternResumeStorageKey = 'unified-cbt-hvac-practical-pattern-resume-v1';

function loadPracticalProgress(): Record<string, PracticalProgress> {
  try {
    const synced = studyStore.progress?.hvacPracticalV2;
    const parsed = synced && typeof synced === 'object' && !Array.isArray(synced)
      ? synced as Record<string, PracticalProgress>
      : JSON.parse(localStorage.getItem(practicalProgressStorageKey) || '{}') as Record<string, PracticalProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadPracticalSession(storageKey = practicalSessionStorageKey): PracticalSessionSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null') as PracticalSessionSnapshot | null;
    if (!parsed || !Array.isArray(parsed.ids)) throw new Error('invalid practical session');
    return {
      // Validate against the bank only after it loads; never erase saved work
      // just because this optional module has not been downloaded yet.
      ids: parsed.ids.filter((id) => typeof id === 'string'),
      deadline: Number(parsed.deadline) || 0,
      finished: Boolean(parsed.finished),
      stoppedSeconds: Math.max(0, Number(parsed.stoppedSeconds) || 0),
      pattern: validPracticalPattern(parsed.pattern) ? parsed.pattern : undefined,
      viewedAnswerIds: Array.isArray(parsed.viewedAnswerIds) ? [...new Set(parsed.viewedAnswerIds.filter(id => typeof id === 'string' && parsed.ids.includes(id)))] : [],
    };
  } catch {
    return { ids: [], deadline: 0, finished: false, stoppedSeconds: 0 };
  }
}

const loadedPracticalProgress = loadPracticalProgress();
const loadedPracticalSession = loadPracticalSession();
const practicalPatternResume = ref<PracticalSessionSnapshot>(loadPracticalSession(practicalPatternResumeStorageKey));
const practicalProgress = reactive<Record<string, PracticalProgress>>(loadedPracticalProgress);
const practicalDrafts = reactive<Record<string, string>>(Object.fromEntries(
  Object.entries(loadedPracticalProgress).filter(([, progress]) => !progress.deleted).map(([id, progress]) => [id, progress.draft || '']),
));
const practicalRevealedIds = ref<string[]>(loadedPracticalSession.pattern && loadedPracticalSession.finished ? loadedPracticalSession.ids : []);
const practicalViewedAnswerIds = ref<string[]>(loadedPracticalSession.viewedAnswerIds || []);
const practicalSessionIds = ref<string[]>(loadedPracticalSession.ids);
const practicalSessionDeadline = ref(loadedPracticalSession.deadline);
const practicalSessionFinished = ref(loadedPracticalSession.finished);
const practicalSessionStoppedSeconds = ref(loadedPracticalSession.stoppedSeconds);
const practicalSessionPattern = ref<PracticalPattern | undefined>(loadedPracticalSession.pattern);
const practicalPromptById = computed(() => new Map([...practicalPrompts.value, ...mockSessionPrompts(practicalPrompts.value, practicalSessionPattern.value)].map(prompt => [prompt.id, prompt])));
const practicalClock = ref(Date.now());
let practicalTimerHandle = 0;

const practicalSessionActive = computed(() => practicalSessionIds.value.length > 0);
const practicalExamLocked = computed(() => practicalSessionActive.value && !!practicalSessionPattern.value && !practicalSessionFinished.value);
const practicalLibraryOpen = ref(!practicalSessionActive.value);
// A solving room is separate from the site's navigation, just like a CBT session.
const practicalSolving = computed(() => view.value === 'guide' && hvacPracticalAvailable.value
  && guideLoaded.value && practicalGuideSection.value === 'practice'
  && (!practicalLibraryOpen.value || practicalSessionActive.value));
watch(practicalSolving, () => {
  mobileMenuOpen.value = false;
  nativeMoreOpen.value = false;
});
const practicalLibraryTab = ref<'rounds' | 'materials' | 'review' | 'calculation' | 'search'>('rounds');
const practicalCalculationCount = computed(() => calculationPrompts(practicalPrompts.value).length);
const practicalReviewCount = computed(() => practicalPrompts.value.filter((prompt) => {
  const grade = practicalProgress[prompt.id]?.grade;
  return grade === 'partial' || grade === 'review';
}).length);
const practicalMasteredCount = computed(() => practicalPrompts.value.filter((prompt) => practicalProgress[prompt.id]?.grade === 'correct').length);
const practicalPartialCount = computed(() => practicalPrompts.value.filter((prompt) => practicalProgress[prompt.id]?.grade === 'partial').length);
const practicalGroupCounts = computed(() => practicalPrompts.value.reduce<Record<PracticalPrompt['group'], number>>((counts, prompt) => {
  counts[prompt.group] += 1;
  return counts;
}, { public: 0, restored: 0, foundation: 0, drill: 0, supplement: 0, photos: 0 }));
const practicalProvidedGroups = new Set<PracticalPrompt['group']>(['public', 'supplement', 'photos']);
const practicalProvidedCount = computed(() => [...practicalProvidedGroups]
  .reduce((count, group) => count + practicalGroupCounts.value[group], 0));
const practicalProvidedFilterActive = computed(() => practicalPromptFilter.value === 'provided'
  || (practicalPromptFilter.value !== 'review' && practicalProvidedGroups.has(practicalPromptFilter.value as PracticalPrompt['group'])));
const practicalRoundOptions = computed(() => {
  const rounds = new Map<string, string>();
  for (const prompt of practicalPrompts.value) {
    if (!prompt.year || !prompt.session) continue;
    if (!matchesPracticalMaterialPeriod(prompt, practicalMaterialPeriod.value)) continue;
    rounds.set(`${prompt.year}-${prompt.session}`, `${prompt.year}년 ${formatPracticalSession(prompt.session)}`);
  }
  return [...rounds.entries()].sort(([a], [b]) => b.localeCompare(a, 'ko', { numeric: true }));
});
const practicalRoundSummaries = computed(() => {
  const rounds = new Map<string, PracticalPrompt[]>();
  for (const prompt of practicalPrompts.value) {
    if (prompt.group !== 'restored' || !prompt.year || !prompt.session) continue;
    const key = `${prompt.year}-${prompt.session}`;
    rounds.set(key, [...(rounds.get(key) || []), prompt]);
  }
  return [...rounds.entries()].map(([key, prompts]) => {
    const first = prompts[0];
    const answered = prompts.filter((prompt) => Boolean(
      practicalDrafts[prompt.id]?.trim() || practicalProgress[prompt.id]?.grade,
    )).length;
    const graded = prompts.filter((prompt) => Boolean(practicalProgress[prompt.id]?.grade)).length;
    const review = prompts.filter((prompt) => ['partial', 'review'].includes(practicalProgress[prompt.id]?.grade || '')).length;
    const updatedAt = Math.max(0, ...prompts.map((prompt) => practicalProgress[prompt.id]?.updatedAt || 0));
    return {
      key,
      year: Number(first.year),
      session: String(first.session),
      label: `${first.year}년 ${formatPracticalSession(String(first.session))}`,
      total: prompts.length,
      answered,
      graded,
      review,
      updatedAt,
    };
  }).sort((a, b) => b.year - a.year || b.session.localeCompare(a.session, 'ko', { numeric: true }));
});
const practicalRoundYears = computed(() => {
  const years = new Map<number, typeof practicalRoundSummaries.value>();
  for (const round of practicalRoundSummaries.value) years.set(round.year, [...(years.get(round.year) || []), round]);
  return [...years.entries()].sort(([a], [b]) => b - a);
});
const practicalLatestRound = computed(() => practicalRoundSummaries.value
  .filter((round) => round.updatedAt > 0)
  .sort((a, b) => b.updatedAt - a.updatedAt)[0] || null);
const practicalSelectionLabel = computed(() => {
  if (practicalSessionActive.value) return practicalSessionIds.value.length <= 5 ? '오늘의 필답' : '필답형 실전';
  if (practicalRoundFilter.value !== 'all') return practicalRoundSummaries.value.find((round) => round.key === practicalRoundFilter.value)?.label || '회차별 기출';
  return ({
    restored: '회차별 기출 전체', provided: '추가 자료 전체', public: '공개 자료', supplement: '필답문제2 PDF',
    photos: '사진·기기 PDF', foundation: '기초 연습', drill: '심화 연습', review: '복습 문제', all: '전체 필답 문제', calculation: '필답형 계산·공식 공부', search: '필답형 검색 결과',
  } as Record<PracticalPromptFilter, string>)[practicalPromptFilter.value];
});
const practicalFilteredPrompts = computed(() => {
  const query = practicalSearch.value.trim().toLocaleLowerCase('ko');
  return practicalPrompts.value.filter((prompt) => {
    const progress = practicalProgress[prompt.id];
    const sourceMatches = practicalPromptFilter.value === 'all'
      || (practicalPromptFilter.value === 'search' && practicalSearchIdSet.value.has(prompt.id))
      || (practicalPromptFilter.value === 'calculation' && Boolean(calculationLesson(prompt))
        && (!practicalCalculationIds.value.length || practicalCalculationIds.value.includes(prompt.id)))
      || (practicalPromptFilter.value === 'review'
        ? progress?.grade === 'partial' || progress?.grade === 'review'
        : practicalPromptFilter.value === 'provided'
          ? practicalProvidedGroups.has(prompt.group)
          : prompt.group === practicalPromptFilter.value);
    const categoryMatches = practicalCategoryFilter.value === 'all' || prompt.category === practicalCategoryFilter.value;
    const roundMatches = practicalRoundFilter.value === 'all'
      || `${prompt.year || ''}-${prompt.session || ''}` === practicalRoundFilter.value;
    const queryMatches = !query || matchesPracticalText(`${prompt.question} ${prompt.answer} ${prompt.explanation}`, query);
    return sourceMatches && categoryMatches && roundMatches && queryMatches
      && matchesPracticalMaterialPeriod(prompt, practicalMaterialPeriod.value);
  });
});
const practicalPagedPrompts = computed(() => practicalSessionActive.value
  ? practicalSessionIds.value.map((id) => practicalPromptById.value.get(id)).filter((prompt): prompt is PracticalPrompt => Boolean(prompt))
  : practicalPromptFilter.value === 'calculation' ? orderPracticalCalculations(practicalFilteredPrompts.value) : practicalFilteredPrompts.value);
const practicalPageCount = computed(() => Math.max(1, Math.ceil(practicalPagedPrompts.value.length / practicalPageSize.value)));
const visiblePracticalPrompts = computed(() => {
  if (practicalContinuous.value) return practicalPagedPrompts.value.slice(0, practicalContinuousLimit.value);
  const start = (practicalPage.value - 1) * practicalPageSize.value;
  return practicalPagedPrompts.value.slice(start, start + practicalPageSize.value);
});
watch([practicalPromptFilter, practicalCategoryFilter, practicalRoundFilter, practicalMaterialPeriod, practicalSearch], () => {
  if (practicalCursorRestoring) return;
  practicalPage.value = 1;
  practicalContinuousLimit.value = 20;
});
watch(practicalMaterialPeriod, () => {
  if (practicalRoundFilter.value !== 'all' && !practicalRoundOptions.value.some(([key]) => key === practicalRoundFilter.value)) {
    practicalRoundFilter.value = 'all';
  }
});
watch([practicalPage, practicalPromptFilter, practicalCategoryFilter, practicalRoundFilter, practicalMaterialPeriod, practicalSearch, practicalContinuousLimit], persistPracticalCursor);
watch(guideLoaded, async loaded => {
  if (!loaded) return;
  practicalSessionIds.value = practicalSessionIds.value.filter(id => practicalPromptById.value.has(id));
  if (!practicalSessionIds.value.length) practicalLibraryOpen.value = true;
  try {
    const cursor = JSON.parse(localStorage.getItem('cbt-practical-cursor') || '{}');
    if (['all','public','restored','foundation','drill','supplement','photos','provided','review','calculation','search'].includes(cursor.filter)) practicalPromptFilter.value = cursor.filter;
    if (Array.isArray(cursor.searchIds)) practicalSearchIds.value = [...new Set<string>(cursor.searchIds.filter((id: unknown): id is string => typeof id === 'string' && practicalPromptById.value.has(id)))];
    if (Array.isArray(cursor.calculationIds)) practicalCalculationIds.value = cursor.calculationIds.filter((id: unknown) => typeof id === 'string' && practicalPrompts.value.some(p => p.id === id && calculationLesson(p)));
    if (['rounds', 'materials', 'review', 'calculation', 'search'].includes(cursor.libraryTab)) practicalLibraryTab.value = cursor.libraryTab;
    else if (cursor.filter === 'search') practicalLibraryTab.value = 'search';
    else if (cursor.filter === 'calculation') practicalLibraryTab.value = 'calculation';
    else if (['provided','public','supplement','photos','foundation','drill'].includes(cursor.filter)) practicalLibraryTab.value = 'materials';
    if (Number.isFinite(cursor.libraryScrollY)) practicalLibraryScrollY = Math.max(0, cursor.libraryScrollY);
    if (cursor.category === 'all' || cursor.category in practicalCategoryLabels) practicalCategoryFilter.value = cursor.category;
    if (practicalPeriodAvailable.value && ['all', 'since-2023-2', 'before-2023-2'].includes(cursor.materialPeriod)) practicalMaterialPeriod.value = cursor.materialPeriod;
    if (cursor.round === 'all' || practicalRoundOptions.value.some(([key]) => key === cursor.round)) practicalRoundFilter.value = cursor.round;
    if (typeof cursor.search === 'string') practicalSearch.value = cursor.search.slice(0, 200);
    await nextTick();
    practicalPage.value = Math.min(practicalPageCount.value, Math.max(1, Number(cursor.page) || 1));
    practicalContinuousLimit.value = Math.min(practicalPrompts.value.length, Math.max(20, Number(cursor.limit) || 20));
    await nextTick();
  } catch { /* Previous learning answers remain independent of the view cursor. */ }
  practicalCursorRestoring = false;
});
watch(practicalPromptFilter, (filter) => {
  if (filter !== 'all' && filter !== 'restored' && filter !== 'review') {
    practicalRoundFilter.value = 'all';
    practicalMaterialPeriod.value = 'all';
  }
});
watch(practicalStudyMode, (mode) => {
  localStorage.setItem(practicalStudyModeStorageKey, mode);
});
const practicalSessionRemainingSeconds = computed(() => {
  if (!practicalSessionActive.value) return 0;
  if (practicalSessionFinished.value) return practicalSessionStoppedSeconds.value;
  return Math.max(0, Math.ceil((practicalSessionDeadline.value - practicalClock.value) / 1000));
});
const practicalSessionScore = computed(() => practicalSessionIds.value.reduce((total, id) => {
  const progress = practicalProgress[id];
  const prompt = practicalPromptById.value.get(id);
  if (!prompt) return total;
  if (typeof progress?.assessment?.score === 'number') return total + progress.assessment.score;
  return total + (progress?.grade === 'correct' ? prompt.points : progress?.grade === 'partial' ? prompt.points / 2 : 0);
}, 0));
const practicalSessionTotalPoints = computed(() => practicalSessionIds.value.reduce((total, id) => total + (practicalPromptById.value.get(id)?.points || 0), 0));
const practicalSessionGradedCount = computed(() => practicalSessionIds.value.filter((id) => Boolean(practicalProgress[id]?.grade)).length);
const practicalSessionReport = computed(() => {
  const mistakes = new Map<PracticalMistakeReason, number>();
  const categories = new Map<PracticalCategory, { score: number; total: number }>();
  let hints = 0;
  let lowConfidence = 0;
  for (const id of practicalSessionIds.value) {
    const prompt = practicalPromptById.value.get(id);
    const progress = practicalProgress[id];
    if (!prompt) continue;
    const current = categories.get(prompt.category) || { score: 0, total: 0 };
    current.total += prompt.points;
    current.score += typeof progress?.assessment?.score === 'number'
      ? progress.assessment.score
      : progress?.grade === 'correct' ? prompt.points : progress?.grade === 'partial' ? prompt.points / 2 : 0;
    categories.set(prompt.category, current);
    hints += progress?.assessment?.hintLevel || 0;
    if (progress?.assessment?.confidence === 'low') lowConfidence += 1;
    for (const reason of progress?.assessment?.mistakeReasons || []) mistakes.set(reason, (mistakes.get(reason) || 0) + 1);
  }
  const weakest = [...categories.entries()].sort(([, a], [, b]) => (a.score / Math.max(1, a.total)) - (b.score / Math.max(1, b.total)))[0];
  return {
    hints,
    lowConfidence,
    weakestLabel: weakest ? practicalCategoryLabels[weakest[0]] : '없음',
    topMistakes: [...mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
  };
});

function persistPracticalProgress(): void {
  localStorage.setItem(practicalProgressStorageKey, JSON.stringify(practicalProgress));
  studyStore.progress ||= {};
  studyStore.progress.hvacPracticalV2 = JSON.parse(JSON.stringify(practicalProgress));
  persistStudyStoreNow();
  scheduleLearningSync();
}

function refreshPracticalProgressFromCloud(): void {
  const synced = studyStore.progress?.hvacPracticalV2;
  if (!synced || typeof synced !== 'object' || Array.isArray(synced)) return;
  Object.keys(practicalProgress).forEach((id) => delete practicalProgress[id]);
  Object.assign(practicalProgress, synced as Record<string, PracticalProgress>);
  Object.keys(practicalDrafts).forEach((id) => delete practicalDrafts[id]);
  Object.entries(practicalProgress).filter(([, progress]) => !progress.deleted).forEach(([id, progress]) => { practicalDrafts[id] = progress.draft || ''; });
  localStorage.setItem(practicalProgressStorageKey, JSON.stringify(practicalProgress));
}

function persistPracticalSession(): void {
  if (!practicalSessionActive.value) {
    localStorage.removeItem(practicalSessionStorageKey);
    return;
  }
  const snapshot: PracticalSessionSnapshot = {
    ids: practicalSessionIds.value,
    deadline: practicalSessionDeadline.value,
    finished: practicalSessionFinished.value,
    stoppedSeconds: practicalSessionStoppedSeconds.value,
    pattern: practicalSessionPattern.value,
    viewedAnswerIds: practicalViewedAnswerIds.value.filter(id => practicalSessionIds.value.includes(id)),
  };
  localStorage.setItem(practicalSessionStorageKey, JSON.stringify(snapshot));
  if (snapshot.pattern) {
    practicalPatternResume.value = snapshot;
    localStorage.setItem(practicalPatternResumeStorageKey, JSON.stringify(snapshot));
  }
}

function updatePracticalDraft(id: string, event: Event): void {
  const draft = (event.target as HTMLTextAreaElement).value;
  practicalDrafts[id] = draft;
  practicalProgress[id] = { ...practicalProgress[id], draft, deleted: false, updatedAt: Date.now() };
  practicalProgress[id].assessment = {
    ...practicalProgress[id].assessment,
    firstStartedAt: practicalProgress[id].assessment?.firstStartedAt || Date.now(),
  };
  persistPracticalProgress();
}

function replacePracticalDraft(id: string, draft: string): void {
  if (practicalExamLocked.value) return;
  const previous = practicalDrafts[id] || '';
  if (previous.trim() && !draft.startsWith(previous) && !confirm('작성 중인 답안이 있습니다. 새 연습 양식으로 바꿀까요?')) return;
  practicalDrafts[id] = draft;
  practicalDraftClosedIds.value = practicalDraftClosedIds.value.filter(closedId => closedId !== id);
  practicalProgress[id] = {
    ...practicalProgress[id],
    draft,
    assessment: {
      ...practicalProgress[id]?.assessment,
      firstStartedAt: practicalProgress[id]?.assessment?.firstStartedAt || Date.now(),
    },
    deleted: false,
    updatedAt: Date.now(),
  };
  persistPracticalProgress();
}

function updatePracticalAssessment(id: string, assessment: PracticalAssessment): void {
  if (practicalExamLocked.value) return;
  practicalProgress[id] = {
    ...practicalProgress[id],
    draft: practicalDrafts[id] || '',
    assessment,
    deleted: false,
    updatedAt: Date.now(),
  };
  persistPracticalProgress();
}

function practicalSimilarCount(prompt: PracticalPrompt): number {
  const keyPoints = new Set((prompt.keyPoints || []).flatMap((point) => point.normalize('NFKC').split(/[^0-9a-z가-힣]+/i)).filter((word) => word.length >= 2));
  return practicalPrompts.value.filter((candidate) => candidate.id !== prompt.id && candidate.category === prompt.category
    && (!keyPoints.size || (candidate.keyPoints || []).some((point) => [...keyPoints].some((word) => point.includes(word))))).length;
}

function hasPracticalProgress(id: string): boolean {
  const progress = practicalProgress[id];
  return Boolean(progress && !progress.deleted && (progress.grade || progress.draft || progress.assessment));
}

function practicalAdaptiveLabel(prompt: PracticalPrompt): string {
  const assessment = practicalProgress[prompt.id]?.assessment;
  if (!assessment?.attempts) return '첫 도전';
  if ((assessment.hintLevel || 0) === 0 && assessment.confidence === 'high') return '실전 숙달';
  if ((assessment.attempts || 0) >= 2 && (assessment.score || 0) < prompt.points) return '집중 복습';
  return '단계 상승';
}

function practicalAnswerRevealed(id: string): boolean {
  return practicalRevealedIds.value.includes(id);
}

function togglePracticalAnswer(id: string): void {
  if (practicalExamLocked.value && !practicalAnswerRevealed(id) && !practicalViewedAnswerIds.value.includes(id)) {
    practicalViewedAnswerIds.value.push(id);
    persistPracticalSession();
  }
  practicalRevealedIds.value = practicalAnswerRevealed(id)
    ? practicalRevealedIds.value.filter((value) => value !== id)
    : [...practicalRevealedIds.value, id];
}

function markPracticalPrompt(id: string, grade: PracticalGrade): void {
  if (practicalExamLocked.value) return;
  const previousAssessment = practicalProgress[id]?.assessment;
  const prompt = practicalPromptById.value.get(id);
  const points = prompt?.points || 5;
  const appliedScore = grade === 'correct' ? points : grade === 'review' ? 0
    : typeof previousAssessment?.score === 'number' && previousAssessment.score > 0 && previousAssessment.score < points
      ? previousAssessment.score : points / 2;
  const currentDraft = practicalDrafts[id]?.trim() || '';
  const history = previousAssessment?.answerHistory || [];
  const nextHistory = currentDraft && history.at(-1)?.draft !== currentDraft
    ? [...history, { draft: currentDraft, score: appliedScore, gradedAt: Date.now() }].slice(-3)
    : history;
  practicalProgress[id] = {
    ...practicalProgress[id],
    draft: practicalDrafts[id] || '',
    grade,
    assessment: {
      ...previousAssessment,
      score: appliedScore,
      attempts: (previousAssessment?.attempts || 0) + 1,
      lastGradedAt: Date.now(),
      answerHistory: nextHistory,
    },
    deleted: false,
    updatedAt: Date.now(),
  };
  if (!practicalAnswerRevealed(id)) practicalRevealedIds.value = [...practicalRevealedIds.value, id];
  persistPracticalProgress();
}

function resetPracticalPrompt(id: string): void {
  practicalProgress[id] = { deleted: true, updatedAt: Date.now() };
  delete practicalDrafts[id];
  practicalRevealedIds.value = practicalRevealedIds.value.filter((value) => value !== id);
  persistPracticalProgress();
}

function practicalGradeLabel(grade?: PracticalGrade): string {
  if (grade === 'correct') return '정답';
  if (grade === 'partial') return '부분 정답';
  if (grade === 'review') return '다시 보기';
  return '미채점';
}

function practicalGroupLabel(group: PracticalPrompt['group']): string {
  if (group === 'public') return '공개 자료';
  if (group === 'restored') return '회차별 복원';
  if (group === 'foundation') return '기초 연습';
  if (group === 'supplement') return '추가 자료 · 필답문제2';
  if (group === 'photos') return '사진·기기 자료 · 가지1';
  return '심화 연습';
}

function formatPracticalSession(session: string): string {
  const variant = session.match(/^(\d+)([AB])$/i);
  return variant ? `${variant[1]}회 ${variant[2].toUpperCase()}형` : `${session}회`;
}

function scrollPracticalRoomStart(behavior: ScrollBehavior = 'auto', promptId?: string): void {
  const root = document.documentElement;
  const previousOverflowAnchor = root.style.overflowAnchor;
  root.style.overflowAnchor = 'none';
  void nextTick(() => {
    window.setTimeout(() => {
      const room = document.querySelector<HTMLElement>('.practical-study-room');
      if (!room) return;
      const target = promptId
        ? [...room.querySelectorAll<HTMLElement>('[data-practical-id]')].find(element => element.dataset.practicalId === promptId) || room
        : room;
      const top = target.getBoundingClientRect().top + window.scrollY - 82;
      window.scrollTo({ top: Math.max(0, top), behavior });
    }, 80);
    window.setTimeout(() => {
      root.style.overflowAnchor = previousOverflowAnchor;
    }, 700);
  });
}

function rememberPracticalLibrary(): void {
  if (!practicalLibraryOpen.value || practicalSessionActive.value) return;
  practicalLibraryScrollY = window.scrollY;
  persistPracticalCursor();
  if (ownHistoryState()?.view === 'guide' && !ownHistoryState()?.practicalRoom) {
    history.pushState({ ...viewHistoryState('guide'), practicalRoom: true }, '', studyHref('guide'));
  }
}

function openPracticalLibrary(tab: 'rounds' | 'materials' | 'review' | 'calculation' | 'search' = practicalLibraryTab.value, fromHistory = false): void {
  if (!fromHistory && ownHistoryState()?.practicalRoom) {
    history.back();
    return;
  }
  practicalLibraryTab.value = tab;
  practicalLibraryOpen.value = true;
  practicalNavigatorOpen.value = false;
  void nextTick(() => window.requestAnimationFrame(() => window.scrollTo({
    top: practicalLibraryScrollY,
    behavior: 'instant',
  })));
}

async function openPracticalSearchResults(ids: string[], selectedId?: string): Promise<void> {
  const validIds = [...new Set(ids)].filter(id => practicalPromptById.value.has(id));
  if (!validIds.length) return;
  rememberPracticalLibrary();
  practicalSearchIds.value = validIds;
  practicalPromptFilter.value = 'search';
  practicalRoundFilter.value = 'all';
  practicalMaterialPeriod.value = 'all';
  practicalCategoryFilter.value = 'all';
  practicalSearch.value = '';
  practicalLibraryOpen.value = false;
  practicalNavigatorOpen.value = false;
  await nextTick();
  const index = Math.max(0, practicalPagedPrompts.value.findIndex(prompt => prompt.id === selectedId));
  practicalPage.value = Math.floor(index / practicalPageSize.value) + 1;
  if (practicalContinuous.value) practicalContinuousLimit.value = Math.max(20, index + 1);
  persistPracticalCursor();
  scrollPracticalRoomStart('auto', selectedId);
}

function openPracticalCalculations(ids: string[], memorize: boolean): void {
  const valid = new Set(calculationPrompts(practicalPrompts.value).map(p => p.id));
  practicalCalculationIds.value = [...new Set(ids)].filter(id => valid.has(id));
  if (!practicalCalculationIds.value.length) return;
  rememberPracticalLibrary();
  practicalPromptFilter.value = 'calculation';
  practicalRoundFilter.value = 'all';
  practicalMaterialPeriod.value = 'all';
  practicalCategoryFilter.value = 'all';
  practicalSearch.value = '';
  practicalRevealedIds.value = practicalRevealedIds.value.filter(id => !practicalCalculationIds.value.includes(id));
  practicalStudyMode.value = memorize ? 'memorize' : 'type';
  practicalPage.value = 1;
  practicalLibraryOpen.value = false;
  practicalNavigatorOpen.value = false;
  persistPracticalCursor();
  scrollPracticalRoomStart();
}

function openPracticalRound(key: string): void {
  const sameRound = practicalPromptFilter.value === 'restored' && practicalRoundFilter.value === key
    && practicalCategoryFilter.value === 'all' && practicalMaterialPeriod.value === 'all' && !practicalSearch.value;
  const previousPage = sameRound ? practicalPage.value : undefined;
  rememberPracticalLibrary();
  practicalPromptFilter.value = 'restored';
  practicalRoundFilter.value = key;
  practicalMaterialPeriod.value = 'all';
  practicalCategoryFilter.value = 'all';
  practicalSearch.value = '';
  const prompts = practicalPagedPrompts.value;
  const lastEdited = prompts.reduce((best, prompt, index) => {
    const at = practicalProgress[prompt.id]?.updatedAt || 0;
    return at > best.at ? {at, index} : best;
  }, {at: 0, index: 0});
  // Filter watchers reset pagination when switching rounds. Restore after that reset.
  void nextTick(() => {
    if (practicalRoundFilter.value !== key || practicalLibraryOpen.value) return;
    practicalPage.value = Math.min(practicalPageCount.value, previousPage ?? Math.floor(lastEdited.index / practicalPageSize.value) + 1);
  });
  practicalLibraryOpen.value = false;
  practicalNavigatorOpen.value = false;
  scrollPracticalRoomStart();
}

function openPracticalMaterial(filter: Extract<PracticalPromptFilter, 'provided' | 'public' | 'supplement' | 'photos' | 'foundation' | 'drill'>): void {
  rememberPracticalLibrary();
  practicalPromptFilter.value = filter;
  practicalRoundFilter.value = 'all';
  practicalMaterialPeriod.value = 'all';
  practicalCategoryFilter.value = 'all';
  practicalSearch.value = '';
  practicalPage.value = 1;
  practicalLibraryOpen.value = false;
  practicalNavigatorOpen.value = false;
  scrollPracticalRoomStart();
}

function practicalListNumber(index: number, prompt?: PracticalPrompt): string {
  if (!practicalSessionActive.value && prompt?.numberLabel) return '+';
  if (!practicalSessionActive.value && practicalPromptFilter.value !== 'calculation' && prompt?.group === 'restored' && prompt.number) return String(prompt.number).padStart(2, '0');
  const number = ((practicalPage.value - 1) * practicalPageSize.value) + index + 1;
  return String(number).padStart(2, '0');
}

function changePracticalPage(nextPage: number): void {
  practicalPage.value = Math.min(practicalPageCount.value, Math.max(1, nextPage));
  practicalNavigatorOpen.value = false;
  void nextTick(() => document.querySelector('.practical-question-grid')
    ?.scrollIntoView({ behavior: motionAllowed.value ? 'smooth' : 'instant', block: 'start' }));
}

function jumpPracticalIndex(index: number): void {
  if (!practicalContinuous.value) changePracticalPage(Math.floor(index / practicalPageSize.value) + 1);
  else practicalContinuousLimit.value = Math.max(practicalContinuousLimit.value, index + 1);
  practicalNavigatorOpen.value = false;
  void nextTick(() => document.querySelector(`[data-practical-index="${index}"]`)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

function practicalHasAnswer(id: string): boolean {
  return Boolean(practicalDrafts[id]?.trim() || practicalProgress[id]?.grade
    || localStorage.getItem(`unified-cbt-hvac-practical-pad-v1:${id}`));
}

function jumpPracticalUnanswered(): void {
  const items = practicalPagedPrompts.value;
  const start = practicalPage.value * practicalPageSize.value;
  for (let offset = 0; offset < items.length; offset++) {
    const i = (start + offset) % items.length;
    if (!practicalHasAnswer(items[i].id)) {
      jumpPracticalIndex(i);
      return;
    }
  }
  showToast('모든 문제에 답안을 작성했습니다.');
}

function formatPracticalTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function uniquePracticalCandidates(candidates: PracticalPrompt[]): PracticalPrompt[] {
  const seen = new Set<string>();
  return candidates.filter((prompt) => {
    const key = `${prompt.question} ${prompt.answer}`.normalize('NFKC').toLocaleLowerCase('ko').replace(/[^0-9a-z가-힣]+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preparePracticalSessionPrompts(prompts: PracticalPrompt[]): void {
  practicalViewedAnswerIds.value = [];
  const now = Date.now();
  for (const prompt of prompts) {
    const previous = practicalProgress[prompt.id]?.assessment;
    practicalProgress[prompt.id] = {
      assessment: previous?.attempts || previous?.answerHistory?.length
        ? { attempts: previous.attempts, answerHistory: previous.answerHistory }
        : undefined,
      deleted: false,
      updatedAt: now,
    };
    practicalDrafts[prompt.id] = '';
  }
  persistPracticalProgress();
}

function startPracticalMock(): void {
  const candidates = uniquePracticalCandidates(practicalFilteredPrompts.value);
  const selected = shuffle(candidates).slice(0, Math.min(12, candidates.length));
  if (!selected.length) {
    showToast('현재 조건에 맞는 필답형 문제가 없습니다.');
    return;
  }
  rememberPracticalLibrary();
  practicalSessionPattern.value = undefined;
  preparePracticalSessionPrompts(selected);
  practicalSessionIds.value = selected.map((prompt) => prompt.id);
  practicalSessionFinished.value = false;
  practicalSessionStoppedSeconds.value = 0;
  practicalSessionDeadline.value = Date.now() + 90 * 60 * 1000;
  practicalClock.value = Date.now();
  practicalPage.value = 1;
  practicalRevealedIds.value = [];
  practicalLibraryOpen.value = false;
  if (practicalStudyMode.value === 'memorize') practicalStudyMode.value = 'type';
  persistPracticalSession();
  showToast(selected.length === 12 ? '필답형 12문제 실전을 시작합니다.' : `${selected.length}문제 맞춤 연습을 시작합니다.`);
  void nextTick(() => document.querySelector('.practical-study-room')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function practicalSourcePrompt(prompt: PracticalPrompt): PracticalPrompt {
  const pattern = practicalSessionPattern.value;
  const index = practicalSessionIds.value.indexOf(prompt.id);
  return pattern && index >= 0 ? practicalPrompts.value.find(p => p.id === pattern.sourceIds[index]) || prompt : prompt;
}

function startPracticalPatternMock(): void {
  if (practicalPatternResume.value.pattern && !practicalPatternResume.value.finished
    && !confirm('진행 중인 마지막 복원 비율 실전이 있습니다. 이어풀기 대신 새 시험으로 바꿀까요? 기존 회차 학습은 유지됩니다.')) return;
  try {
    const built = buildPracticalPattern(practicalPrompts.value);
    const pattern: PracticalPattern = { attempt: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, template: built.template, sourceIds: built.prompts.map(p => p.id), kinds: built.kinds };
    const prompts = mockSessionPrompts(practicalPrompts.value, pattern);
    // Fresh IDs isolate both typed answers and S-Pen ink from round learning.
    rememberPracticalLibrary();
    preparePracticalSessionPrompts(prompts);
    practicalSessionPattern.value = pattern;
    practicalSessionIds.value = prompts.map(p => p.id);
    practicalSessionFinished.value = false;
    practicalSessionStoppedSeconds.value = 0;
    practicalSessionDeadline.value = Date.now() + 90 * 60 * 1000;
    practicalClock.value = Date.now();
    practicalPage.value = 1;
    practicalRevealedIds.value = [];
    practicalHelperIds.value = [];
    practicalLibraryOpen.value = false;
    if (practicalStudyMode.value === 'memorize') practicalStudyMode.value = 'type';
    persistPracticalSession();
    showToast('복원 비율 실전 12문제를 시작합니다. 문제별 풀이를 볼 수 있으며, 채점은 제출 후 진행합니다.');
    void nextTick(() => document.querySelector('.practical-study-room')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch (error) { showToast(error instanceof Error ? error.message : '실전 문제를 구성하지 못했습니다.'); }
}

function resumePracticalPatternMock(): void {
  const saved = practicalPatternResume.value;
  if (!saved.pattern || mockSessionPrompts(practicalPrompts.value, saved.pattern).length !== 12) { showToast('이어풀기 자료를 불러오지 못했습니다. 자료를 다시 불러와 주세요.'); return; }
  rememberPracticalLibrary();
  practicalSessionPattern.value = saved.pattern;
  practicalSessionIds.value = [...saved.ids];
  practicalSessionDeadline.value = saved.deadline;
  practicalSessionStoppedSeconds.value = saved.stoppedSeconds;
  practicalSessionFinished.value = saved.finished;
  practicalClock.value = Date.now();
  practicalRevealedIds.value = saved.finished ? [...saved.ids] : [];
  practicalViewedAnswerIds.value = [...(saved.viewedAnswerIds || [])];
  practicalPage.value = 1;
  practicalLibraryOpen.value = false;
  if (practicalStudyMode.value === 'memorize') practicalStudyMode.value = 'type';
  persistPracticalSession();
}

function startPracticalDaily(): void {
  const ranked = uniquePracticalCandidates(practicalFilteredPrompts.value).sort((a, b) => {
    const aProgress = practicalProgress[a.id];
    const bProgress = practicalProgress[b.id];
    const rank = (progress?: PracticalProgress) => progress?.grade === 'review' ? 0 : progress?.grade === 'partial' ? 1 : !progress?.grade ? 2 : 3;
    return rank(aProgress) - rank(bProgress) || (aProgress?.updatedAt || 0) - (bProgress?.updatedAt || 0);
  }).slice(0, 5);
  if (!ranked.length) {
    showToast('현재 조건에 맞는 필답형 문제가 없습니다.');
    return;
  }
  rememberPracticalLibrary();
  practicalSessionPattern.value = undefined;
  preparePracticalSessionPrompts(ranked);
  practicalSessionIds.value = ranked.map((prompt) => prompt.id);
  practicalSessionFinished.value = false;
  practicalSessionStoppedSeconds.value = 0;
  practicalSessionDeadline.value = Date.now() + 30 * 60 * 1000;
  practicalClock.value = Date.now();
  practicalPage.value = 1;
  practicalRevealedIds.value = [];
  practicalLibraryOpen.value = false;
  if (practicalStudyMode.value === 'memorize') practicalStudyMode.value = 'type';
  persistPracticalSession();
  showToast('오답과 미학습 문제를 우선한 오늘의 필답 5문제를 시작합니다.');
}

function startPracticalRelated(prompt: PracticalPrompt): void {
  const sourceWords = new Set((prompt.keyPoints || []).flatMap((point) => point.normalize('NFKC').split(/[^0-9a-z가-힣]+/i)).filter((word) => word.length >= 2));
  const related = uniquePracticalCandidates(practicalPrompts.value.filter((candidate) => candidate.category === prompt.category
    && (candidate.id === prompt.id || !sourceWords.size || (candidate.keyPoints || []).some((point) => [...sourceWords].some((word) => point.includes(word))))));
  const selected = [prompt, ...shuffle(related.filter((candidate) => candidate.id !== prompt.id))].slice(0, 10);
  practicalSessionPattern.value = undefined;
  preparePracticalSessionPrompts(selected);
  practicalSessionIds.value = selected.map((candidate) => candidate.id);
  practicalSessionFinished.value = false;
  practicalSessionStoppedSeconds.value = 0;
  practicalSessionDeadline.value = Date.now() + 45 * 60 * 1000;
  practicalClock.value = Date.now();
  practicalPage.value = 1;
  practicalRevealedIds.value = [];
  practicalLibraryOpen.value = false;
  if (practicalStudyMode.value === 'memorize') practicalStudyMode.value = 'type';
  persistPracticalSession();
  showToast(`${practicalCategoryLabels[prompt.category]} 같은 유형 ${selected.length}문제를 시작합니다.`);
}

function printPracticalSheet(): void {
  document.documentElement.classList.add('printing-practical');
  window.print();
  window.setTimeout(() => document.documentElement.classList.remove('printing-practical'), 500);
}

function practicalMistakeLabel(reason: PracticalMistakeReason): string {
  return ({ formula: '공식', substitution: '대입', calculation: '계산', unit: '단위', keyword: '핵심어', count: '개수 누락', diagram: '도면', time: '시간 부족' })[reason];
}

function finishPracticalMock(timedOut = false): void {
  if (!practicalSessionActive.value || practicalSessionFinished.value) return;
  practicalSessionStoppedSeconds.value = practicalSessionRemainingSeconds.value;
  practicalSessionFinished.value = true;
  persistPracticalSession();
  if (practicalSessionPattern.value) practicalRevealedIds.value = [...practicalSessionIds.value];
  showToast(timedOut ? '제한 시간이 지나 실전 연습을 종료했습니다.' : '필답형 연습을 제출했습니다. 답안과 비교해 자가 채점해 주세요.');
}

function closePracticalMock(returnToLibrary = true): void {
  if (!practicalSessionPattern.value && !practicalSessionFinished.value && practicalSessionGradedCount.value < practicalSessionIds.value.length
    && !confirm('현재 필답형 실전 연습을 닫을까요? 작성한 답과 채점 기록은 보존됩니다.')) return;
  if (practicalSessionPattern.value) persistPracticalSession();
  practicalSessionIds.value = [];
  practicalSessionPattern.value = undefined;
  practicalSessionDeadline.value = 0;
  practicalSessionFinished.value = false;
  practicalSessionStoppedSeconds.value = 0;
  practicalRevealedIds.value = [];
  practicalPage.value = 1;
  persistPracticalSession();
  if (returnToLibrary) openPracticalLibrary();
}

function showPracticalReview(): void {
  rememberPracticalLibrary();
  closePracticalMock(false);
  if (practicalSessionActive.value) return;
  practicalPromptFilter.value = 'review';
  practicalCategoryFilter.value = 'all';
  practicalSearch.value = '';
  if (!practicalReviewCount.value) {
    practicalLibraryTab.value = 'review';
    practicalLibraryOpen.value = true;
    showToast('아직 다시 볼 필답형 문제가 없습니다.');
    return;
  }
  practicalPage.value = 1;
  practicalLibraryOpen.value = false;
}
const stats = computed(() => {
  const all = selectedCatalog.value.rounds.flatMap((round) => round.questions.map((question) => questionId(round, question)));
  const answered = all.filter((id) => studyStore.attempts[id]);
  const correct = answered.filter((id) => studyStore.attempts[id]?.lastCorrect);
  const wrong = all.filter((id) => studyStore.wrong[id]);
  const bookmarks = all.filter((id) => studyStore.bookmarks.includes(id));
  return {
    total: selectedCatalog.value.isPlaceholder ? selectedCatalog.value.questionCount ?? 0 : all.length,
    answered: answered.length,
    correct: correct.length,
    wrong: wrong.length,
    bookmarks: bookmarks.length,
    accuracy: answered.length ? Math.round((correct.length / answered.length) * 100) : 0,
    coverage: all.length ? Math.round((answered.length / all.length) * 100) : 0,
  };
});
const currentItems = computed(() => {
  if (!session.value) return [];
  const start = session.value.page * session.value.pageSize;
  return session.value.items.slice(start, start + session.value.pageSize);
});
const currentItemColumns = computed(() => {
  const items = currentItems.value;
  const split = Math.ceil(items.length / 2);
  return [items.slice(0, split), items.slice(split)].filter((column) => column.length);
});
const pageCount = computed(() => session.value ? Math.ceil(session.value.items.length / session.value.pageSize) : 0);
const answeredCount = computed(() => session.value ? Object.keys(session.value.answers).length : 0);
const unansweredCount = computed(() => Math.max(0, (session.value?.items.length || 0) - answeredCount.value));
const keptCount = computed(() => session.value?.kept.length || 0);
const activeSessionItem = computed(() => {
  if (!session.value) return undefined;
  return session.value.items.find((item) => item.id === activeSessionItemId.value) || currentItems.value[0];
});
const omrRows = computed(() => {
  if (!session.value) return [];
  const activeSubject = activeSessionItem.value?.subject;
  return session.value.items.map((item, index) => ({ item, index })).filter(({ item }) => {
    if (omrFilter.value === 'unanswered') return session.value?.answers[item.id] == null;
    if (omrFilter.value === 'kept') return session.value?.kept.includes(item.id);
    if (omrFilter.value === 'subject') return item.subject === activeSubject;
    return true;
  });
});
const sessionProgress = computed(() => session.value?.items.length
  ? Math.round(answeredCount.value / session.value.items.length * 100)
  : 0);
const preferredPageSize = computed(() => resolvedDisplayMode !== 'mobile' && solveLayoutMode.value === 'comcbt' ? 6 : 4);
const sessionQuestionMax = computed(() => session.value?.items.length || 0);
const formattedTime = computed(() => {
  const total = Math.max(0, session.value?.remainingSeconds || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
});
function examDurationSeconds(questionCount: number): number {
  if (selectedKey.value === 'energy-midterm') return Math.max(60, questionCount * 90);
  if (selectedKey.value === 'maintenance-engineer') return Math.max(60, questionCount * 90);
  const rule = officialRule.value;
  if (!rule) return Math.max(90 * 60, Math.ceil(questionCount * 90));
  const officialQuestionCount = rule.totalQuestions
    || (Math.max(1, selectedSubjects.value.length) * (rule.questionsPerSubject || 20));
  return Math.max(60, Math.ceil(questionCount / officialQuestionCount * rule.examMinutes * 60));
}
const examPace = computed(() => {
  if (!experimentalFeaturesEnabled.value || session.value?.mode !== 'exam' || session.value.finished) return null;
  const totalSeconds = examDurationSeconds(session.value.items.length);
  const elapsedSeconds = Math.max(0, totalSeconds - session.value.remainingSeconds);
  if (answeredCount.value < 2 || elapsedSeconds < 20) {
    return { ready: false, label: '2문제부터 계산', detail: '답안 속도 측정 중', tone: 'measuring' };
  }
  const secondsPerQuestion = elapsedSeconds / answeredCount.value;
  const neededSeconds = Math.round(secondsPerQuestion * unansweredCount.value);
  const marginSeconds = session.value.remainingSeconds - neededSeconds;
  const tone = marginSeconds >= 15 * 60 ? 'safe' : marginSeconds >= 5 * 60 ? 'steady' : 'risk';
  return {
    ready: true,
    label: `${formatStudyDuration(neededSeconds)} 뒤 완료 예상`,
    detail: `문제당 ${Math.round(secondsPerQuestion)}초 · ${marginSeconds >= 0 ? `${formatStudyDuration(marginSeconds)} 여유` : `${formatStudyDuration(Math.abs(marginSeconds))} 부족`}`,
    tone,
  };
});
const sessionTitle = computed(() => session.value?.title || '산업기사 통합 CBT');
const subjectStats = computed(() => {
  const subjects = selectedSubjects.value;
  return subjects.map((subject) => {
    const items = selectedItems.value.filter((item) => item.subject === subject);
    const attempts = items.filter((item) => studyStore.attempts[item.id]);
    const correct = attempts.filter((item) => studyStore.attempts[item.id]?.lastCorrect).length;
    const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
    return { subject, total: items.length, answered: attempts.length, correct, accuracy };
  });
});
const masteryRows = computed<MasteryRow[]>(() => selectedItems.value.map((item) => {
  const attempt = studyStore.attempts[item.id];
  const dueAt = nextReviewAt(attempt);
  return {
    ...item,
    mastery: attemptMastery(attempt),
    recall: recallProbability(attempt),
    dueAt,
    due: Boolean(attempt && dueAt <= Date.now()),
    attempted: Boolean(attempt),
  };
}));
const betaTaggedRows = computed(() => selectedItems.value.map((item) => ({
  item,
  meta: betaModeMeta(item.id, betaModeFilter.value),
  note: betaQuestionMeta(item.id).note,
}))
  .filter((row) => row.meta.confidence || row.note || row.meta.reason));
const betaLowConfidenceRows = computed(() => betaTaggedRows.value
  .filter((row) => row.meta.confidence === 'unsure' || row.meta.confidence === 'guess')
  .sort((a, b) => (a.meta.confidence === 'guess' ? -1 : 0) - (b.meta.confidence === 'guess' ? -1 : 0)
    || Number(b.meta.at || 0) - Number(a.meta.at || 0)));
const betaMemoRows = computed(() => betaTaggedRows.value.filter((row) => Boolean(row.note?.trim())));
const betaFalseConfidenceRows = computed(() => betaTaggedRows.value.filter((row) =>
  row.meta.confidence === 'sure' && row.meta.correct === false));
const betaReasonRows = computed(() => ([
  { key: 'concept' as const, label: '개념 부족', count: betaTaggedRows.value.filter((row) => row.meta.reason === 'concept').length },
  { key: 'formula' as const, label: '공식·계산', count: betaTaggedRows.value.filter((row) => row.meta.reason === 'formula').length },
  { key: 'unit' as const, label: '단위 실수', count: betaTaggedRows.value.filter((row) => row.meta.reason === 'unit').length },
  { key: 'careless' as const, label: '문제 잘못 읽음', count: betaTaggedRows.value.filter((row) => row.meta.reason === 'careless').length },
]));
const betaWeakRows = computed(() => selectedItems.value.map((item) => {
  const meta = betaModeMeta(item.id, betaModeFilter.value);
  const history = betaModeHistory(item.id, betaModeFilter.value);
  let score = 0;
  if (meta.confidence === 'guess') score += 4;
  else if (meta.confidence === 'unsure') score += 2;
  if (meta.correct === false) score += 3;
  if (meta.reason) score += 1;
  if (history.attempts) score += Math.round(history.wrongRate * 4);
  if (history.latestWrong) score += 2;
  return { item, meta, history, score };
}).filter((row) => row.score >= 3)
  .sort((a, b) => b.score - a.score || b.history.wrongRate - a.history.wrongRate || Number(b.meta.at || 0) - Number(a.meta.at || 0)));
const betaModeSummaries = computed(() => (['learn', 'exam'] as StudyMode[]).map((mode) => {
  const rows = selectedItems.value.map((item) => ({ item, meta: betaModeMeta(item.id, mode) }));
  const weak = selectedItems.value.filter((item) => {
    const meta = betaModeMeta(item.id, mode);
    const history = betaModeHistory(item.id, mode);
    const score = (meta.confidence === 'guess' ? 4 : meta.confidence === 'unsure' ? 2 : 0)
      + (meta.correct === false ? 3 : 0)
      + (meta.reason ? 1 : 0)
      + (history.attempts ? Math.round(history.wrongRate * 4) : 0)
      + (history.latestWrong ? 2 : 0);
    return score >= 3;
  }).length;
  return {
    mode,
    sure: rows.filter((row) => row.meta.confidence === 'sure').length,
    unsure: rows.filter((row) => row.meta.confidence === 'unsure').length,
    guess: rows.filter((row) => row.meta.confidence === 'guess').length,
    weak,
  };
}));
const coachAnswered = computed(() => masteryRows.value.filter((item) => item.attempted).length);
const coachHasEvidence = computed(() => coachAnswered.value > 0);
const coachHasUnmeasuredSubjects = computed(() => coachSubjectRows.value.some(row => !row.answered));
const coachCoverage = computed(() =>
  masteryRows.value.length ? Math.round((coachAnswered.value / masteryRows.value.length) * 100) : 0);
const coachSubjectRows = computed(() => selectedSubjects.value.map((subject) => {
  const items = masteryRows.value.filter((item) => item.subject === subject);
  const attempted = items.filter((item) => item.attempted);
  const accurate = attempted.filter((item) => studyStore.attempts[item.id]?.lastCorrect).length;
  const accuracy = attempted.length ? Math.round((accurate / attempted.length) * 100) : 0;
  const mastery = attempted.length
    ? Math.round(attempted.reduce((sum, item) => sum + item.mastery, 0) / attempted.length)
    : 0;
  const coverage = items.length ? Math.round((attempted.length / items.length) * 100) : 0;
  const predicted = clampScore(Math.round(
    (accuracy * .56 + mastery * .29 + 50 * .15) * (.55 + .45 * Math.sqrt(coverage / 100 || 0)),
  ));
  return {
    subject,
    total: items.length,
    answered: attempted.length,
    accuracy,
    mastery,
    coverage,
    predicted,
    risk: attempted.length > 0 && predicted < 40,
  };
}));
const weakestSubject = computed(() =>
  [...coachSubjectRows.value].sort((a, b) => a.predicted - b.predicted || a.coverage - b.coverage)[0]);
const recentExamAverage = computed(() => {
  const rows = officialExamRecords.value.slice(0, 5);
  return rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : null;
});
const predictedScore = computed(() => {
  if (!coachSubjectRows.value.length) return 0;
  const subjectPrediction = coachSubjectRows.value.reduce((sum, row) => sum + row.predicted, 0) / coachSubjectRows.value.length;
  return clampScore(Math.round(recentExamAverage.value === null
    ? subjectPrediction
    : subjectPrediction * .58 + recentExamAverage.value * .42));
});
const passChance = computed(() => {
  if (!coachAnswered.value) return 0;
  const logistic = 100 / (1 + Math.exp(-(predictedScore.value - 60) / 7.5));
  const coverageFactor = .38 + .62 * Math.sqrt(coachCoverage.value / 100);
  const minimumSubject = Math.min(...coachSubjectRows.value.map((row) => row.predicted));
  const cutRisk = minimumSubject < 40 ? .58 + Math.max(0, minimumSubject - 20) / 100 : 1;
  return Math.max(3, Math.min(98, Math.round(logistic * coverageFactor * cutRisk)));
});
const coachConfidence = computed(() => {
  if (coachCoverage.value < 5) return '진단 필요';
  if (coachCoverage.value < 20) return '초기 분석';
  if (coachCoverage.value < 45) return '보통';
  if (officialExamRecords.value.length < 2) return '높음';
  return '매우 높음';
});
const dueRows = computed(() => masteryRows.value
  .filter((item) => item.attempted && (item.due || !studyStore.attempts[item.id]?.lastCorrect))
  .sort((a, b) => a.recall - b.recall || a.dueAt - b.dueAt));
const weakRows = computed(() => masteryRows.value
  .filter((item) => item.attempted)
  .sort((a, b) => a.mastery - b.mastery || a.recall - b.recall));
const unseenRows = computed(() => masteryRows.value.filter((item) => !item.attempted));
const calculationRows = computed(() => masteryRows.value.filter(isCalculationItem));
const calculationWrongRows = computed(() => calculationRows.value.filter((item) => wrongQuestionIds.value.has(item.id)));
const calculationSubjects = computed(() => [...new Set(calculationRows.value.map((item) => item.subject))]);
const calculationRounds = computed(() => {
  const rows = new Map<string, { id: string; label: string; year: number; count: number; wrongCount: number }>();
  calculationRows.value.forEach((item) => {
    const existing = rows.get(item.round.id);
    if (existing) {
      existing.count += 1;
      if (wrongQuestionIds.value.has(item.id)) existing.wrongCount += 1;
      return;
    }
    rows.set(item.round.id, {
      id: item.round.id,
      label: `${item.round.year}년 ${item.round.session || item.round.date || item.round.title.replace(/^.*?:\s*/, '')}`,
      year: item.round.year,
      count: 1,
      wrongCount: wrongQuestionIds.value.has(item.id) ? 1 : 0,
    });
  });
  return [...rows.values()].sort((a, b) => b.year - a.year || b.label.localeCompare(a.label, 'ko', { numeric: true }));
});
const formulaRenderSamples = [
  { title: '공기 현열', plain: 'Q = 공기 밀도 × 풍량 × 공기 비열 × 온도차', tex: 'Q = \\rho \\dot{V} c_p \\Delta T' },
  { title: '이상기체 상태변화', plain: 'P₁V₁/T₁ = P₂V₂/T₂', tex: '\\frac{P_1 V_1}{T_1} = \\frac{P_2 V_2}{T_2}' },
  { title: '대수평균온도차', plain: 'LMTD = (ΔT₁-ΔT₂) ÷ ln(ΔT₁/ΔT₂)', tex: '\\mathrm{LMTD} = \\frac{\\Delta T_1 - \\Delta T_2}{\\ln(\\Delta T_1 / \\Delta T_2)}' },
  {
    title: '실제 원문 인식 · 2025년 3회 26번',
    plain: '\\mathrm{COP}=\\frac{i_{4}-i_{3}}{i_{3}-i_{2}}',
    tex: '\\mathrm{COP}=\\frac{i_{4}-i_{3}}{i_{3}-i_{2}}',
    sourceImage: 'assets/hvac/formula-samples/2025_3_26_choice1.png',
  },
];
const filteredCalculationRows = computed(() => calculationRows.value.filter((item) =>
  (calculationResultFilter.value === 'all' || wrongQuestionIds.value.has(item.id))
  &&
  (calculationSubjectFilter.value === 'all' || item.subject === calculationSubjectFilter.value)
  && (calculationRoundFilter.value === 'all' || item.round.id === calculationRoundFilter.value)));
const calculationPagination = computed(() => pageItems(filteredCalculationRows.value, calculationPage.value));
watch([calculationSubjectFilter, calculationRoundFilter, calculationResultFilter, selectedKey], () => { calculationPage.value = 1; });
const coachPlans = computed<Array<{ key: CoachPlanKey; eyebrow: string; title: string; description: string; count: number; tone: string }>>(() => [
  {
    key: 'due',
    eyebrow: 'FORGOTTEN CURVE',
    title: dueRows.value.length ? '오늘의 망각 복습' : weakRows.value.length ? '최근 학습 복습' : '처음 문제 익히기',
    description: dueRows.value.length ? '복습 시기가 된 문제와 최근 오답부터 다시 풉니다.' : weakRows.value.length ? '지금 복습 대기 문제가 없어, 이미 푼 문제부터 다시 봅니다.' : '아직 학습 기록이 없어, 처음 보는 문제로 연습을 시작합니다.',
    count: Math.min(20, dueRows.value.length || weakRows.value.length || unseenRows.value.length),
    tone: 'mint',
  },
  {
    key: 'weak',
    eyebrow: 'WEAK POINT',
    title: weakRows.value.length ? '취약 문제 집중' : '기초 진단 학습',
    description: weakRows.value.length ? '학습한 문제 중 숙련도가 낮은 문제를 최대20개 선별합니다.' : '최대20문제를 풀어 현재 이해도를 확인합니다. 아직 취약 문제로 판단한 것은 아닙니다.',
    count: Math.min(20, weakRows.value.length || unseenRows.value.length),
    tone: 'coral',
  },
  {
    key: 'calculation',
    eyebrow: 'FORMULA DRILL',
    title: '계산문제 훈련',
    description: '공식·단위·수치 계산이 필요한 문제만 모읍니다.',
    count: Math.min(20, calculationRows.value.length),
    tone: 'violet',
  },
  {
    key: 'subject',
    eyebrow: 'CUT-LINE SHIELD',
    title: `${weakestSubject.value?.subject || '선택 과목'} ${weakestSubject.value?.answered ? '집중 학습' : '첫 진단'}`,
    description: weakestSubject.value?.answered ? '현재 학습 기록상 보강이 필요한 과목부터 연습합니다.' : '아직 풀지 않은 과목을 먼저 확인합니다. 미학습을 과락으로 판단하지 않습니다.',
    count: Math.min(20, masteryRows.value.filter((item) => item.subject === weakestSubject.value?.subject).length),
    tone: 'amber',
  },
  {
    key: 'exam',
    eyebrow: 'PREDICTIVE MOCK',
    title: '합격 예측 모의고사',
    description: officialRule.value?.scoring === 'total-only'
      ? `현재 범위에서 공식 구성 ${officialExamQuestionCount.value}문제를 출제합니다.`
      : '현재 범위에서 과목별 20문제를 균형 출제합니다.',
    count: Math.min(officialExamQuestionCount.value, masteryRows.value.length),
    tone: 'blue',
  },
]);
const reviewSchedule = computed(() => {
  const now = Date.now();
  const day = 86_400_000;
  const attempted = masteryRows.value.filter((item) => item.attempted);
  return [
    { label: '지금 복습', count: attempted.filter((item) => item.dueAt <= now).length, tone: 'now' },
    { label: '24시간 이내', count: attempted.filter((item) => item.dueAt > now && item.dueAt <= now + day).length, tone: 'soon' },
    { label: '7일 이내', count: attempted.filter((item) => item.dueAt > now + day && item.dueAt <= now + 7 * day).length, tone: 'week' },
    { label: '기억 안정', count: attempted.filter((item) => item.dueAt > now + 7 * day).length, tone: 'safe' },
  ];
});

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function attemptMastery(attempt?: AttemptRecord): number {
  if (!attempt) return 0;
  const accuracy = attempt.count ? attempt.correctCount / attempt.count : 0;
  const recency = recallProbability(attempt) / 100;
  const repetition = Math.min(1, attempt.count / 5);
  const recentResult = attempt.lastCorrect ? 1 : 0;
  return clampScore(Math.round(
    accuracy * 47
    + recentResult * 23
    + repetition * 16
    + recency * 14,
  ));
}

function recallProbability(attempt?: AttemptRecord): number {
  if (!attempt) return 0;
  const elapsedDays = Math.max(0, (Date.now() - attempt.at) / 86_400_000);
  const stabilityDays = attempt.lastCorrect
    ? Math.min(45, 1.7 + attempt.correctCount * attempt.correctCount * 1.25 + attempt.count * .7)
    : .35;
  return clampScore(Math.round(100 * Math.exp(-elapsedDays / stabilityDays)));
}

function nextReviewAt(attempt?: AttemptRecord): number {
  if (!attempt) return 0;
  if (!attempt.lastCorrect) return attempt.at;
  const intervalDays = Math.min(30, .8 + attempt.correctCount * attempt.correctCount * 1.15 + attempt.count * .45);
  return attempt.at + intervalDays * 86_400_000;
}

function stripMarkup(value?: string): string {
  const node = document.createElement('div');
  node.innerHTML = value || '';
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

async function refreshExamHistory(): Promise<void> {
  const key = selectedKey.value;
  const [records, coolingRecords] = await Promise.all([loadExamRecords(key), loadExamRecords(SCHOOL_EXAM_CATALOG_KEY)]);
  coolingExamRecords.value = coolingRecords;
  if (key !== selectedKey.value) return;
  recentExamRecords.value = records;
  const availableRoundIds = new Set(recentExamRecords.value.flatMap((record) => record.roundId ? [record.roundId] : []));
  if (!wrongRoundFilter.value || !availableRoundIds.has(wrongRoundFilter.value)) {
    wrongRoundFilter.value = recentExamRecords.value.find((record) => record.roundId && record.wrongAnswers?.length)?.roundId || '';
  }
}

function animateCoachDashboard(): void {
  if (!motionAllowed.value) {
    displayedPassChance.value = passChance.value;
    return;
  }
  displayedPassChance.value = 0;
  animate(0, passChance.value, {
    duration: .95,
    ease: [0.2, 0.8, 0.2, 1],
    onUpdate: (value) => { displayedPassChance.value = Math.round(value); },
  });
  animate(
    '.coach-panel,.coach-plan,.coach-subject-card',
    { opacity: [0, 1], y: [20, 0], scale: [.985, 1] },
    { duration: .52, delay: stagger(.055) },
  );
}

function animateViewDetails(next: ViewName): void {
  if (!motionAllowed.value) {
    if (next === 'coach') displayedPassChance.value = passChance.value;
    return;
  }
  const selectors: Partial<Record<ViewName, string>> = {
    home: '.android-app-promo,.simpsons-home-hero,.qualification-card,.study-builder,.subject-strip article,.start-actions button,.progress-panel dl > div,.home-release-card',
    rounds: '.round-card',
    wrong: '.tool-hero,.question-library article,.empty-state',
    search: '.search-command,.search-summary,.question-library article,.empty-state',
    showcase: '.feature-hero,.feature-theme-preview,.feature-upscale-compare,.feature-tour-card,.feature-action-card,.feature-latest',
    stats: '.stats-hero,.stats-grid article,.subject-report,.subject-row',
    updates: '.patch-heading,.patch-timeline article',
  };
  const selector = selectors[next];
  if (selector) {
    const targets = visibleMotionTargets(selector);
    if (targets.length) {
    animate(
      targets,
      visualStyle.value === 'simpsons'
        ? { opacity: [0, 1], y: [30, 0], rotate: [-1.2, 0], scale: [.96, 1] }
        : { opacity: [0, 1], y: [20, 0], scale: [.985, 1] },
      {
        duration: visualStyle.value === 'simpsons' ? .58 : .46,
        delay: stagger(visualStyle.value === 'simpsons' ? .065 : .045),
        ease: visualStyle.value === 'simpsons' ? [0.16, 1.15, 0.3, 1] : [0.2, 0.8, 0.2, 1],
      },
    );
    }
  }
  if (next === 'rounds') {
    const targets = visibleMotionTargets('.round-progress i');
    if (targets.length) {
    animate(
      targets,
      { scaleX: [0, 1] },
      { duration: .72, delay: stagger(.035), ease: [0.2, 0.8, 0.2, 1] },
    );
    }
  }
  if (next === 'stats') {
    animate(
      '.subject-bar i',
      { scaleX: [0, 1] },
      { duration: .82, delay: stagger(.08), ease: [0.2, 0.8, 0.2, 1] },
    );
  }
  if (next === 'coach') animateCoachDashboard();
}

function setDefaultYears(yearsBack = 10): void {
  const years = availableYears.value;
  if (!years.length) {
    yearFrom.value = 0;
    yearTo.value = new Date().getFullYear();
    return;
  }
  const latest = Math.max(...years);
  yearTo.value = latest;
  yearFrom.value = yearsBack === 0 ? Math.min(...years) : Math.max(Math.min(...years), latest - yearsBack + 1);
}

const pendingQualification = ref('');
const qualificationLoadPercent = ref(0);
const qualificationLoadError = ref('');
let qualificationRequest = 0;

async function switchQualification(key: string): Promise<boolean> {
  const request = ++qualificationRequest;
  const origin = view.value;
  pendingQualification.value = key;
  qualificationLoadPercent.value = 0;
  qualificationLoadError.value = '';
  try {
    const target = catalogs.find(catalog => catalog.key === key);
    if (target?.isPlaceholder || (key === 'energy' && !window.CBT_DATA_ENERGY_RESTORED)
      || (key === 'energy-midterm' && !window.CBT_DATA_ENERGY_TEXTBOOK)) {
      await loadQuestionSources([key]);
    }
    if (request !== qualificationRequest || view.value !== origin) return false;
    qualificationLoadPercent.value = 50;
    configureQualification(key);
    await nextTick();
    if (request !== qualificationRequest || view.value !== origin) return false;
    qualificationLoadPercent.value = 100;
    return true;
  } catch {
    if (request === qualificationRequest && view.value === origin) {
      qualificationLoadError.value = '종목 자료를 불러오지 못했습니다. 같은 종목을 다시 선택해 주세요.';
    }
    return false;
  } finally {
    if (request === qualificationRequest) pendingQualification.value = '';
  }
}

function configureQualification(key: string): void {
  textbookReaderOpen.value = false;
  textbookPagesOpen.value = false;
  const current = ownHistoryState();
  if (current?.view === 'rounds' && (current.textbookCollection || current.textbookRoom)) {
    history.replaceState(viewHistoryState('rounds'), '', location.href);
  }
  if (isRegularQualification(key)) {
    lastRegularQualification = key;
    localStorage.setItem(regularQualificationStorageKey, key);
  } else if (lastRegularQualification) {
    localStorage.setItem(regularQualificationStorageKey, lastRegularQualification);
  }
  selectedKey.value = key;
  localStorage.setItem(qualificationStorageKey, key);
  curriculum.value = 'all-mapped';
  calculationSubjectFilter.value = 'all';
  calculationRoundFilter.value = 'all';
  calculationResultFilter.value = 'all';
  wrongTypeFilter.value = 'all';
  bookmarkRoundFilter.value = 'all';
  setDefaultYears(key === GEM_APPRAISER_TARGET_KEY ? 0 : quickPreset.value);
  if (searchQuery.value.length >= 2) requestSearch();
  void refreshExamHistory();
}

async function openRegularRounds(): Promise<void> {
  const key = isRegularQualification(selectedKey.value) ? selectedKey.value : lastRegularQualification;
  if (!key) return;
  await openQualificationRounds(key);
}

async function openQualificationRounds(key: string): Promise<void> {
  if (await switchQualification(key)) openView('rounds');
}

async function selectQualification(key: string): Promise<void> {
  if (!(await switchQualification(key))) return;
  openView(key === SCHOOL_EXAM_CATALOG_KEY ? 'school' : 'rounds');
}

async function updateQualificationFromSetup(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  if (!(await changeContextQualification(select.value)) && !pendingQualification.value) select.value = selectedKey.value;
}
async function changeContextQualification(key: string): Promise<boolean> {
  if (!(await switchQualification(key))) return false;
  if (key === SCHOOL_EXAM_CATALOG_KEY) openView('school');
  else if (view.value === 'school') openView('rounds');
  return true;
}

function updateSchoolExamData(next: SchoolExamData): void {
  const normalized = normalizeSchoolExamData(next);
  schoolExamData.value = normalized;
  saveSchoolExamData(normalized);
  schoolCatalog.rounds.splice(0, schoolCatalog.rounds.length, ...normalized.rounds);
  schoolCatalog.roundCount = normalized.rounds.length;
  schoolCatalog.questionCount = normalized.rounds.reduce((sum, round) => sum + round.questions.length, 0);
  if (selectedKey.value === SCHOOL_EXAM_CATALOG_KEY) setDefaultYears(0);
  indexSearchItems();
}

function startSchoolExamRound(payload: { round: Round; mode: StudyMode }): void {
  configureQualification(SCHOOL_EXAM_CATALOG_KEY);
  startRound(payload.round, payload.mode);
}

async function loadQuestionSources(keys: string[]): Promise<void> {
  await Promise.all(keys.map(async key => {
    const target = catalogs.find(catalog => catalog.key === key);
    if (!target || (!target.isPlaceholder
      && !(key === 'energy-midterm' && !window.CBT_DATA_ENERGY_TEXTBOOK)
      && !(key === 'energy' && !window.CBT_DATA_ENERGY_RESTORED))) return;
    const loaded = await ensureCatalogLoaded(key);
    const needsYears = target.isPlaceholder && key === selectedKey.value;
    Object.assign(target, loaded, { isPlaceholder: false });
    if (needsYears) setDefaultYears(quickPreset.value);
  }));
  indexSearchItems();
}

// The first mobile home shows counts from the catalog index. Hydrate the
// detailed study range when it is visible or a regular study view is opened.
const homeScopeTrigger = ref<HTMLButtonElement>();
const scopeLoading = ref(false);
const scopeError = ref('');
async function loadCurrentScope() {
  if (!selectedCatalog.value.isPlaceholder || scopeLoading.value) return;
  const key = selectedKey.value;
  scopeLoading.value = true;
  scopeError.value = '';
  try { await loadQuestionSources([key]); }
  catch { if (key === selectedKey.value) scopeError.value = '학습 범위를 불러오지 못했습니다.'; }
  finally { scopeLoading.value = false; }
}
watch(homeScopeTrigger, (button, _, onCleanup) => {
  if (!button || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    if (view.value === 'home' && entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      void loadCurrentScope();
    }
  });
  // The asynchronous home cover briefly leaves the range at the top of the
  // page. Observe after actual scrolling so this transient layout cannot load HVAC.
  const observeRange = () => observer.observe(button);
  if (window.scrollY > 0) observeRange();
  else window.addEventListener('scroll', observeRange, {once:true, passive:true});
  onCleanup(() => {
    observer.disconnect();
    window.removeEventListener('scroll', observeRange);
  });
});
watch([view, textbookPagesOpen, visualStyle], ([page, books, style]) => {
  if (page === 'home' ? style !== 'default' : !(page === 'rounds' && books)) void loadCurrentScope();
});

async function loadCoolingMidterm(): Promise<void> {
  coolingLoading.value = true;
  coolingError.value = '';
  try { await Promise.all([loadQuestionSources(['hvac', 'hvac-hansol']), refreshExamHistory()]); }
  catch { coolingError.value = '냉동공학 문제를 불러오지 못했습니다. 연결을 확인해 주세요.'; }
  finally { coolingLoading.value = false; }
}

const bookSourceLoads = new Map<TextbookKey, Promise<void>>();
function ensureBookSources(book: TextbookKey): Promise<void> {
 const pending = bookSourceLoads.get(book);
 if (pending) return pending;
 const energy = book === 'energy'
   ? import('./energyQuestionLayout').then(module => {prepareEnergyBook.value = module.prepareEnergyBookItem;})
   : undefined;
 const load = Promise.all([energy, (async () => {
  let sources: QuestionItem[] | undefined;
  if (!window.CBT_CLOUD_CONFIG?.serviceApiUrl && !isNativeApp && location.protocol !== 'file:') {
   try { sources = await fetchTextbookSources(book); }
   catch { /* Offline installations may only have the original bank scripts cached. */ }
  }
  if (!sources) {
   [sources] = await Promise.all([loadTextbookSupplement(book),loadQuestionSources(textbookSourceKeys(book))]);
  }
  textbookSupplement.value = [...new Map([...textbookSupplement.value,...sources].map(item=>[item.id,item])).values()];
 })()]).then(() => {}).catch(error => { bookSourceLoads.delete(book); throw error; });
 bookSourceLoads.set(book, load);
 return load;
}

async function loadTextbookPages():Promise<void> {
 const book=textbookKey.value;
 const revision=++textbookLoadRevision;
 if(choosingTextbook.value){textbookLoading.value=false;textbookError.value='';return;}
 if(textbooksReady.has(book)){textbookLoading.value=false;textbookError.value='';return;}
 textbookLoading.value=true;textbookError.value='';
 try{
  await Promise.all([loadTextbookModule(), ensureBookSources(book)]);
  textbooksReady.add(book);
 }
 catch{if(revision===textbookLoadRevision)textbookError.value='문제 자료를 읽지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.';}
 finally{if(revision===textbookLoadRevision)textbookLoading.value=false;}
}
function openTextbookPages():void {
 qualificationRequest++;pendingQualification.value='';qualificationLoadError.value='';
 const savedBook = localStorage.getItem('cbt-textbook-selected');
 choosingTextbook.value = view.value === 'home' && savedBook !== 'energy' && savedBook !== 'hansol';
 if (!choosingTextbook.value && !savedBook && (selectedKey.value === 'energy' || selectedKey.value === 'energy-midterm')) textbookKey.value = 'energy';
 textbookPagesOpen.value=true;openView('rounds');
 textbookReaderOpen.value=false;
 history.replaceState(viewHistoryState('rounds'),'',location.href);
 void loadTextbookPages();
 window.scrollTo({top:0});
}
function startTextbookReader(selection:BookSelection):void {
 localStorage.setItem('cbt-textbook-selected',textbookKey.value);
 saveBookSelection(textbookKey.value,selection);
 textbookReaderOpen.value=true;
 if(!ownHistoryState()?.textbookRoom)history.pushState(viewHistoryState('rounds'),'',location.href);
 void loadTextbookPages();
 window.scrollTo({top:0});
}
function closeTextbookReader():void {
 textbookReaderOpen.value=false;
 settingsOpen.value=false;
 // An older history entry may be a CBT session after reload/resume. The
 // explicit list action must always return to the textbook collection.
 openView('rounds',{replace:true});
 history.replaceState(viewHistoryState('rounds'),'',location.href);
}
function selectTextbook(book:TextbookKey):void {
 textbookKey.value=book;
 localStorage.setItem('cbt-textbook-selected',book);
 if(choosingTextbook.value){
  choosingTextbook.value=false;
  history.replaceState(viewHistoryState('rounds'),'',location.href);
 }
 void loadTextbookPages();
}
function chooseTextbookAnswer(item:QuestionItem,choice:number):void {
 const next = textbookAnswers.value[item.id] === choice ? 0 : choice;
 if (next) recordAttempt(item.id, next, item.question.answer);
 saveTextbookAnswer(studyStore.progress ||= {}, item.id, next);
}

function openCoolingSearch(): void {
  searchScope.value = 'hvac';
  searchSubject.value = '냉동냉장설비';
  openView('search');
}

function openSchoolSetSearch(id: string): void {
  const set = schoolExamData.value.questionSets?.find(item => item.id === id);
  if (!set) return;
  searchSetId.value = id;
  searchCatalogKeys.value = [...new Set(set.itemIds.flatMap(itemId => {
    const item = itemMap.value.get(itemId);
    return item?.round.qualificationKey ? [item.round.qualificationKey] : [];
  }))];
  searchScope.value = searchCatalogKeys.value.length ? 'selected' : 'all';
  searchSubject.value = set.subject;
  openView('search');
}

async function startCoolingMidterm(payload: { items: QuestionItem[]; mode: StudyMode; randomCount: number; calculationCount?: number; groupRandom?: boolean; label?: string }): Promise<void> {
  if (experienceTransitionPhase.value || visualTransitionPhase.value) return;
  let items: QuestionItem[];
  try { items = payload.randomCount ? coolingPracticeSelection(payload.items, payload.randomCount, payload.calculationCount) : payload.items; }
  catch (error) { showToast(error instanceof Error ? error.message : '출제 범위를 확인해 주세요.'); return; }
  if (payload.randomCount && payload.groupRandom) items = orderCoolingSimilar(items);
  await beginSession(payload.mode, `${coolingMidtermTitle} · ${payload.randomCount ? '랜덤' : '전체'} ${items.length}문제${payload.label ? ` · ${payload.label}` : ''}`, items);
  if (payload.randomCount && session.value?.items[0]?.id === items[0]?.id) {
    studyStore.progress ||= {};
    studyStore.progress[coolingDrawKey] = { ...coolingDrawState.value, ids: [...new Set([...coolingDrawState.value.ids, ...items.map(item => item.id)])], savedAt: Date.now() };
  }
}

function isMidtermCalculation(item: QuestionItem): boolean {
  return isCoolingRecord(item.id) ? coolingCalculation(item) : !!item.question.midtermCalculation;
}

async function ensureItemSources(ids: string[]): Promise<void> {
  const savedBooks=[...new Set(ids.map(bookForStudyId).filter((book):book is TextbookKey=>!!book))];
  if(savedBooks.length){
    await Promise.all([loadTextbookModule(), ...savedBooks.map(ensureBookSources)]);
  }
  const keys = catalogs.filter(catalog => !catalog.isVirtual && catalog.key !== SCHOOL_EXAM_CATALOG_KEY
    && ids.some(id => coolingOriginalId(id).startsWith(`${catalog.key}-`))).map(catalog => catalog.key);
  // Occurrence groups can cross both banks, even when saved IDs use only one.
  await loadQuestionSources([...new Set([...keys,
    ...(ids.some(id=>id.startsWith('school-energy-')) ? ['energy-midterm'] : []),
    ...(ids.some(isCoolingRecord) ? ['hvac', 'hvac-hansol'] : [])])]);
}

watch(() => view.value === 'wrong' ? recentExamRecords.value : null, records => {
  const ids = records?.flatMap(record => record.wrongAnswers?.map(wrong => wrong.id) || []).filter(id => bookForStudyId(id)) || [];
  if (ids.length) void ensureItemSources(ids).catch(() => showToast('교재 오답을 불러오지 못했습니다. 연결을 확인해 주세요.'));
});

async function startSchoolQuestionSet(payload: { id: string; mode: StudyMode }): Promise<void> {
  const set = schoolExamData.value.questionSets?.find(item => item.id === payload.id);
  if (!set) return;
  try {
    await ensureItemSources(set.itemIds);
    const items = set.itemIds.flatMap(id => itemMap.value.get(id) ? [itemMap.value.get(id)!] : []);
    if (items.length !== set.itemIds.length) { showToast('일부 문제 자료를 찾지 못했습니다. 다시 확인해 주세요.'); return; }
    void beginSession(payload.mode, set.title, items);
  } catch { showToast('문제 자료를 불러오지 못했습니다. 다시 시도해 주세요.'); }
}

function addSearchItemToSchool(item: QuestionItem): void {
  const sets = [...(schoolExamData.value.questionSets || [])];
  let target = sets.find(set => set.id === searchSetId.value);
  if (!target) {
    const title = newSearchSetTitle.value.trim();
    if (!title) { showToast('시험지 이름을 입력해 주세요.'); return; }
    target = { id: `school-set-${Date.now()}`, title, subject: searchSubject.value === 'all' ? item.subject : searchSubject.value, itemIds: [] };
    sets.unshift(target);
    searchSetId.value = target.id;
  }
  if (target.itemIds.includes(item.id)) { showToast('이미 이 시험지에 담은 문제입니다.'); return; }
  const updated = sets.map(set => set.id === target!.id ? { ...set, itemIds: [...set.itemIds, item.id] } : set);
  updateSchoolExamData({ ...schoolExamData.value, questionSets: updated });
  showToast(`${target.title}에 담았습니다.`);
}

function setDisplayPreference(mode: DisplayPreference): void {
  localStorage.setItem('unified-cbt-display-mode', mode);
  displayPreference.value = mode;
  location.reload();
}

function setFontFamilyPreference(mode: FontFamilyPreference): void {
  fontFamilyPreference.value = mode;
  localStorage.setItem('unified-cbt-font-family', mode);
  document.documentElement.dataset.fontFamily = mode;
  const label = mode === 'bold' ? '나눔고딕 Bold'
    : mode === 'd2coding' ? 'D2Coding Regular'
      : mode === 'd2coding-bold' ? 'D2Coding Bold' : '나눔고딕 Regular';
  showToast(`${label} 글꼴을 적용했습니다.`);
}

function applyPreset(value: 5 | 10 | 0): void {
  quickPreset.value = value;
  setDefaultYears(value);
}

function showToast(message: string): void {
  window.clearTimeout(toastHandle);
  toastMessage.value = message;
  toastHandle = window.setTimeout(() => { toastMessage.value = ''; }, 2400);
}

function formatStudyDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
  }
  return minutes ? `${minutes}분` : `${seconds}초`;
}

function betaQuestionMeta(id: string): BetaQuestionMeta {
  const value = studyStore.notes[`beta-question:${id}`];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as BetaQuestionMeta;
  const normalizeMode = (modeValue?: BetaModeMeta): BetaModeMeta | undefined => {
    if (!modeValue || typeof modeValue !== 'object') return undefined;
    const normalized: BetaModeMeta = {
      confidence: modeValue.confidence === 'sure' || modeValue.confidence === 'unsure' || modeValue.confidence === 'guess'
        ? modeValue.confidence : undefined,
      reason: modeValue.reason === 'concept' || modeValue.reason === 'formula' || modeValue.reason === 'unit' || modeValue.reason === 'careless'
        ? modeValue.reason : undefined,
      correct: typeof modeValue.correct === 'boolean' ? modeValue.correct : undefined,
      at: Number(modeValue.at) || 0,
    };
    return normalized.confidence || normalized.reason || normalized.correct !== undefined ? normalized : undefined;
  };
  return {
    confidence: source.confidence === 'sure' || source.confidence === 'unsure' || source.confidence === 'guess'
      ? source.confidence : undefined,
    reason: source.reason === 'concept' || source.reason === 'formula' || source.reason === 'unit' || source.reason === 'careless'
      ? source.reason : undefined,
    note: typeof source.note === 'string' ? source.note : undefined,
    at: Number(source.at) || 0,
    modes: {
      learn: normalizeMode(source.modes?.learn),
      exam: normalizeMode(source.modes?.exam),
    },
  };
}

function betaModeMeta(id: string, mode: StudyMode): BetaModeMeta {
  const source = betaQuestionMeta(id);
  const scoped = source.modes?.[mode];
  if (scoped) return scoped;
  if (mode === 'learn') {
    return {
      confidence: source.confidence,
      reason: source.reason,
      correct: source.confidence && studyStore.attempts[id] ? studyStore.attempts[id].lastCorrect : undefined,
      at: source.at,
    };
  }
  return {};
}

function betaModeHistory(id: string, mode: StudyMode): { attempts: number; wrong: number; wrongRate: number; latestWrong: boolean } {
  const rows = recentExamRecords.value
    .filter((record) => (record.mode || 'exam') === mode && record.itemIds?.includes(id))
    .sort((a, b) => b.finishedAt - a.finishedAt);
  const wrong = rows.filter((record) => record.wrongAnswers?.some((entry) => entry.id === id)).length;
  return {
    attempts: rows.length,
    wrong,
    wrongRate: rows.length ? wrong / rows.length : 0,
    latestWrong: Boolean(rows[0]?.wrongAnswers?.some((entry) => entry.id === id)),
  };
}

function updateBetaQuestionMeta(id: string, patch: Partial<Pick<BetaQuestionMeta, 'note'>>): void {
  const key = `beta-question:${id}`;
  const previous = betaQuestionMeta(id);
  const next: BetaQuestionMeta = { ...previous, ...patch, at: Date.now() };
  if (!next.confidence && !next.reason && !next.note?.trim() && !next.modes?.learn && !next.modes?.exam) delete studyStore.notes[key];
  else studyStore.notes[key] = next;
}

function updateBetaModeMeta(id: string, mode: StudyMode, patch: Partial<BetaModeMeta>): void {
  const key = `beta-question:${id}`;
  const previous = betaQuestionMeta(id);
  const currentMode = betaModeMeta(id, mode);
  const nextMode: BetaModeMeta = { ...currentMode, ...patch, at: Date.now() };
  const hasModeValue = Boolean(nextMode.confidence || nextMode.reason || nextMode.correct !== undefined);
  const modes = { ...(previous.modes || {}), [mode]: hasModeValue ? nextMode : undefined };
  const next: BetaQuestionMeta = { ...previous, modes, at: Date.now() };
  if (!next.confidence && !next.reason && !next.note?.trim() && !modes.learn && !modes.exam) delete studyStore.notes[key];
  else studyStore.notes[key] = next;
}

function setQuestionConfidence(item: QuestionItem, confidence: BetaConfidence): void {
  const mode = session.value?.mode || 'learn';
  const currentMeta = betaModeMeta(item.id, mode);
  const nextConfidence = currentMeta.confidence === confidence ? undefined : confidence;
  const selected = session.value?.answers[item.id];
  updateBetaModeMeta(item.id, mode, {
    confidence: nextConfidence,
    correct: nextConfidence || currentMeta.reason
      ? (selected ? selected === item.question.answer : undefined)
      : undefined,
  });
}

function setQuestionMistakeReason(item: QuestionItem, reason: BetaMistakeReason): void {
  const mode = session.value?.mode || 'learn';
  const currentMeta = betaModeMeta(item.id, mode);
  const nextReason = currentMeta.reason === reason ? undefined : reason;
  const selected = session.value?.answers[item.id];
  updateBetaModeMeta(item.id, mode, {
    reason: nextReason,
    correct: currentMeta.confidence || nextReason
      ? (selected ? selected === item.question.answer : undefined)
      : undefined,
  });
}

function setQuestionStudyNote(item: QuestionItem, note: string): void {
  updateBetaQuestionMeta(item.id, { note: note.slice(0, 500) });
}

function setExperimentalFeatures(enabled: boolean): void {
  experimentalFeaturesEnabled.value = enabled;
  localStorage.setItem('unified-cbt-experimental-features', String(enabled));
  document.documentElement.dataset.experimentalFeatures = enabled ? 'on' : 'off';
  if (!enabled && view.value === 'beta') openView('home', { replace: true });
  showToast(enabled
    ? '실험 기능을 켰습니다. 문제 화면과 베타 학습 도구에 적용합니다.'
    : '실험 기능을 모두 껐습니다. 기존 CBT 화면으로 돌아갑니다.');
}

function setQuestionJudgmentEnabled(enabled: boolean): void {
  questionJudgmentEnabled.value = enabled;
  localStorage.setItem('unified-cbt-question-judgment', String(enabled));
  showToast(enabled
    ? '문제 아래의 내 판단·메모 도구를 표시합니다.'
    : '내 판단·메모를 숨겼습니다. 기존 기록은 보존됩니다.');
}

function startBetaReview(kind: 'confidence' | 'memo' | 'false-confidence' | 'weak' | BetaMistakeReason): void {
  let title = '베타 맞춤 복습';
  let rows: QuestionItem[] = [];
  if (kind === 'confidence') {
    title = '베타 · 애매하거나 찍은 문제';
    rows = betaLowConfidenceRows.value.map((row) => row.item);
  } else if (kind === 'memo') {
    title = '베타 · 내 메모 문제';
    rows = betaMemoRows.value.map((row) => row.item);
  } else if (kind === 'false-confidence') {
    title = '베타 · 확신했지만 틀린 문제';
    rows = betaFalseConfidenceRows.value.map((row) => row.item);
  } else if (kind === 'weak') {
    title = `베타 · ${betaModeFilter.value === 'exam' ? 'CBT' : '학습'} 자동 취약 문제`;
    rows = betaWeakRows.value.map((row) => row.item);
  } else {
    const label = betaReasonRows.value.find((row) => row.key === kind)?.label || '실수 원인';
    title = `베타 · ${label} 집중`;
    rows = betaTaggedRows.value.filter((row) => row.meta.reason === kind).map((row) => row.item);
  }
  const unique = [...new Map(rows.map((item) => [item.id, item])).values()];
  if (!unique.length) {
    showToast('아직 이 조건으로 기록된 문제가 없습니다. 문제를 풀며 표시해 주세요.');
    return;
  }
  beginSession('learn', title, shuffle([...unique]).slice(0, 20));
}

function startBetaTrial(): void {
  const rows = shuffle([...selectedItems.value]).slice(0, Math.min(5, selectedItems.value.length));
  if (!rows.length) {
    showToast('현재 연도 범위에서 체험할 문제를 찾지 못했습니다.');
    return;
  }
  beginSession('learn', '베타 기능 5문제 비교', rows);
}

function ownHistoryState(value: unknown = history.state): CbtHistoryState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CbtHistoryState>;
  if (candidate.cbtSpace !== historyScope || !isStudyView(candidate.view)) return null;
  return candidate as CbtHistoryState;
}

function viewHistoryState(next: ViewName, sessionId?: string): CbtHistoryState {
  return { cbtSpace: historyScope, view: next, ...(sessionId ? { sessionId } : {}), ...(next==='rounds'&&textbookPagesOpen.value?{textbookCollection:true,...(choosingTextbook.value?{choosingTextbook:true}:{})}:{}), ...(next==='rounds'&&textbookReaderOpen.value?{textbookRoom:true}:{}) };
}

function initializeNavigationHistory(): void {
  const current = ownHistoryState();
  let openUpdatesAfterRefresh = false;
  try {
    openUpdatesAfterRefresh = sessionStorage.getItem(openUpdatesAfterRefreshKey) === 'true';
    if (openUpdatesAfterRefresh) sessionStorage.removeItem(openUpdatesAfterRefreshKey);
  } catch {
    openUpdatesAfterRefresh = false;
  }
  const restoredView = openUpdatesAfterRefresh ? 'updates' : viewFromHash(location.hash) ?? current?.view ?? 'home';
  const initialView = restoredView === 'beta' && !experimentalFeaturesEnabled.value
    ? 'home'
    : restoredView;
  view.value = initialView;
  choosingTextbook.value=!!current?.choosingTextbook && !current.textbookRoom;
  if(initialView==='rounds'&&current?.textbookCollection&&!current.textbookRoom&&!openUpdatesAfterRefresh){textbookPagesOpen.value=true;void loadTextbookPages();}
  if(initialView==='rounds'&&current?.textbookRoom&&!openUpdatesAfterRefresh){
    textbookPagesOpen.value=true;textbookReaderOpen.value=true;void loadTextbookPages();
  }
  history.replaceState(viewHistoryState(initialView), '', studyHref(initialView));
}

function openView(next: ViewName, options: { fromHistory?: boolean; replace?: boolean } = {}): void {
  if (next === 'beta' && !experimentalFeaturesEnabled.value) {
    settingsOpen.value = true;
    showToast('설정에서 실험 기능 전체를 켜면 베타 학습 도구를 비교할 수 있습니다.');
    return;
  }
  if(next!=='rounds')textbookReaderOpen.value=false;
  const previousView = view.value;
  if (next === 'settings' && previousView !== 'settings') settingsReturnView.value = previousView;
  settingsOpen.value = false;
  if (next !== view.value) {
    if (dynamicUiEnabled.value) viewScrollPositions.set(view.value, window.scrollY);
    const currentIndex = viewOrder.indexOf(view.value);
    const nextIndex = viewOrder.indexOf(next);
    navigationDirection.value = nextIndex >= currentIndex ? 1 : -1;
  }
  if (!options.fromHistory) {
    const current = ownHistoryState();
    if (!current || current.view !== next || current.sessionId) {
      const method = options.replace ? 'replaceState' : 'pushState';
      history[method](viewHistoryState(next), '', studyHref(next));
    }
  }
  view.value = next;
  mobileMenuOpen.value = false;
  window.CBTAnalytics?.trackNavigation?.(`next-${next}`);
  if (next === 'updates') void checkForUpdate(false);
  void nextTick(() => {
    window.scrollTo({ top: dynamicUiEnabled.value ? (viewScrollPositions.get(next) || 0) : 0, behavior: 'auto' });
    if (!motionAllowed.value || next === previousView) {
      animateViewDetails(next);
      return;
    }
    // Vue owns the page transition. Do not also animate the outgoing tree.
    animate(
      '.sidebar nav button.active,.mobile-tabbar button.active',
      { scale: [.9, 1], x: [navigationDirection.value * 9, 0] },
      { duration: .32, ease: [0.2, 0.9, 0.2, 1] },
    );
    // Detail entrance runs after Vue's out-in transition mounts the new view.
  });
}

function restoreSessionReturnPosition(state: SessionReturnState | null): void {
  if (!state) return;
  void nextTick(() => window.requestAnimationFrame(() => {
    const roundCard = state.view === 'rounds' && state.roundId
      ? document.getElementById(`${roundsCollection.value === 'cooling' ? 'cooling-round' : 'round-card'}-${state.roundId}`)
      : null;
    if (roundCard) roundCard.scrollIntoView({ block: 'center', behavior: motionAllowed.value ? 'smooth' : 'auto' });
    else window.scrollTo({ top: state.scrollY, behavior: 'auto' });
  }));
}

function deactivateSession(preserveForForward = false): void {
  if (learningSessionSaveHandle) saveActiveLearningSession();
  if (preserveForForward) {
    suspendedSession = session.value;
    suspendedExamResult = examResult.value;
  } else {
    suspendedSession = null;
    suspendedExamResult = null;
  }
  stopTimer();
  session.value = null;
  examResult.value = null;
  sessionMenuOpen.value = false;
  document.body.classList.remove('session-active');
}

function handleBrowserHistory(event: PopStateEvent): void {
  const link = viewFromHash(location.hash);
  const target = ownHistoryState(event.state) ?? (link ? { cbtSpace: historyScope, view: link } as CbtHistoryState : null);
  if (!target) return;
  if (!ownHistoryState(event.state)) history.replaceState(target, '', location.href);
  choosingTextbook.value=!!target.choosingTextbook && !target.textbookRoom;
  textbookReaderOpen.value=target.view==='rounds'&&!!target.textbookRoom;
  textbookPagesOpen.value=target.view==='rounds'&&!!(target.textbookCollection||target.textbookRoom);
  if(textbookPagesOpen.value&&!textbookReaderOpen.value)void loadTextbookPages();
  if(textbookReaderOpen.value){textbookPagesOpen.value=true;void loadTextbookPages();}
  if (practicalSolving.value && !target.practicalRoom) {
    if (practicalSessionActive.value) closePracticalMock();
    else openPracticalLibrary(practicalLibraryTab.value, true);
    if (practicalSessionActive.value) {
      history.pushState({ ...viewHistoryState('guide'), practicalRoom: true }, '', studyHref('guide'));
    } else if (target.view !== 'guide') {
      history.pushState(viewHistoryState('guide'), '', location.href);
    }
    return;
  }
  if (target.view === 'guide' && target.practicalRoom && view.value === 'guide') {
    practicalLibraryOpen.value = false;
    scrollPracticalRoomStart();
    return;
  }

  if (target.sessionId) {
    if (suspendedSession?.id === target.sessionId) {
      session.value = suspendedSession;
      examResult.value = suspendedExamResult;
      suspendedSession = null;
      suspendedExamResult = null;
      document.body.classList.add('session-active');
      restartTimer();
      window.scrollTo({ top: 0 });
      return;
    }
    history.replaceState(viewHistoryState(target.view), '', location.href);
  }

  if (session.value) {
    sendCurrentSessionOnExit();
    deactivateSession(true);
    experienceTransitionPhase.value = 'home-entering';
    window.setTimeout(() => { experienceTransitionPhase.value = null; }, motionAllowed.value ? 520 : 0);
  }
  openView(target.view === 'beta' && !experimentalFeaturesEnabled.value ? 'home' : target.view, { fromHistory: true });
  if (sessionReturnState?.view === target.view) {
    restoreSessionReturnPosition(sessionReturnState);
    sessionReturnState = null;
  }
}

function handlePageHide(): void {
  persistPracticalCursor();
  saveActiveLearningSession();
  sendCurrentSessionOnExit();
  // The 120ms store debounce may not run once the page is unloading.
  persistStudyStoreNow();
}

function setupSearchWorker(): void {
  searchWorker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
  searchWorker.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as { type: 'ready' | 'results'; ids?: string[]; total?: number; requestId?: number };
    if (message.type === 'ready') searchReady.value = true;
    if (message.type === 'results' && message.requestId === searchRequestId) {
      searchResultIds.value = message.ids || [];
      searchTotal.value = message.total || 0;
    }
  });
}

function indexSearchItems(): void {
  searchWorker?.postMessage({
    type: 'index',
    entries: allItems.value.map((item) => ({
      id: item.id,
      qualificationKey: item.round.qualificationKey,
      subject: normalizedSchoolSubject(item),
      haystack: [
        item.question.text,
        item.question.html,
        item.subject, normalizedSchoolSubject(item),
        item.round.title,
        ...item.question.choices.map((choice) => choice.text || choice.html || ''),
      ].join(' ').replace(/<[^>]+>/g, ' ').toLocaleLowerCase('ko'),
    })),
  });
}

function requestSearch(): void {
  window.clearTimeout(searchHandle);
  searchRequestId += 1;
  searchResultIds.value = [];
  searchTotal.value = 0;
  const requestId = searchRequestId;
  searchHandle = window.setTimeout(() => {
    searchWorker?.postMessage({
      type: 'search',
      query: searchQuery.value,
      qualificationKeys: [...searchKeys.value],
      subject: searchSubject.value,
      requestId,
    });
  }, 120);
}

async function prepareSearchScope(): Promise<void> {
  const sequence = ++searchLoadSequence;
  const requestKeys = [...searchKeys.value];
  searchLoading.value = true;
  searchError.value = '';
  searchRequestId += 1;
  searchResultIds.value = [];
  try {
    if (!searchWorker) setupSearchWorker();
    await loadQuestionSources(requestKeys);
    if (sequence !== searchLoadSequence) return;
    if (searchSubject.value !== 'all' && !searchSubjects.value.includes(searchSubject.value)) searchSubject.value = 'all';
    bookmarkRoundFilter.value = 'all';
    requestSearch();
  } catch { if (sequence === searchLoadSequence) searchError.value = '선택한 문제 자료를 불러오지 못했습니다. 다시 시도해 주세요.'; }
  finally { if (sequence === searchLoadSequence) searchLoading.value = false; }
}

function roundToItems(round: Round): QuestionItem[] {
  return round.questions.map((question) => ({
    round,
    question,
    subject: subjectFor(round, question),
    id: questionId(round, question),
  }));
}

function startHvacFieldReportPractice(): void {
  selectedKey.value = 'hvac';
  localStorage.setItem(qualificationStorageKey, 'hvac');
  void beginSession(
    'learn',
    '2026년 8월 22일 비공식 실전 복원 훈련',
    roundToItems(hvacFieldReportRound),
  );
}

async function openHvacPracticalGuide(): Promise<void> {
  if (!(await switchQualification('hvac'))) return;
  practicalGuideSection.value = 'practice';
  if (!practicalSessionActive.value) practicalLibraryOpen.value = true;
  openView('guide');
  window.setTimeout(() => document.querySelector('.practical-study-room')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
}

function saveActiveLearningSession(): void {
  window.clearTimeout(learningSessionSaveHandle);
  learningSessionSaveHandle = 0;
  const active = session.value;
  if (!active || active.finished) return;
  const saved: SavedLearningSession = {
    id: active.id,
    version: 1,
    qualificationKey: sessionQualificationKey.value,
    mode: active.mode,
    roundId: active.items.every((item) => item.round.id === active.items[0]?.round.id)
      ? active.items[0]?.round.id
      : undefined,
    title: active.title,
    itemIds: active.items.map((item) => item.id),
    answers: { ...active.answers },
    kept: [...active.kept],
    page: active.page,
    pageSize: active.pageSize,
    startedAt: active.startedAt,
    remainingSeconds: active.remainingSeconds,
    calculationMode: active.calculationMode,
    savedAt: Date.now(),
  };
  localStorage.setItem(learningSessionStorageKey, JSON.stringify(saved));
  studyStore.progress ||= {};
  studyStore.progress[learningSessionProgressKey] = saved;
  savedLearningSession.value = saved;
  saveCoolingArchive(saved);
}

function scheduleLearningSessionSave(): void {
  window.clearTimeout(learningSessionSaveHandle);
  learningSessionSaveHandle = window.setTimeout(saveActiveLearningSession, 180);
}

function clearSavedLearningSession(): void {
  window.clearTimeout(learningSessionSaveHandle);
  learningSessionSaveHandle = 0;
  localStorage.removeItem(learningSessionStorageKey);
  studyStore.progress ||= {};
  studyStore.progress[learningSessionProgressKey] = {
    version: 1,
    itemIds: [],
    savedAt: Date.now(),
    cleared: true,
  } satisfies ClearedLearningSession;
  savedLearningSession.value = null;
}

function refreshSavedLearningSessionFromStore(): void {
  savedLearningSession.value = readSavedLearningSession();
}

async function beginSession(
  mode: StudyMode,
  title: string,
  items: QuestionItem[],
  initialAnswers: Record<string, number> = {},
  options: { sessionId?: string; calculationMode?: boolean; page?: number; pageSize?: number; startedAt?: number; remainingSeconds?: number; kept?: string[]; resume?: boolean } = {},
): Promise<void> {
  if (!items.length) {
    showToast('선택한 범위에 출제 가능한 문제가 없습니다.');
    return;
  }
  if (experienceTransitionPhase.value || visualTransitionPhase.value) return;
  sessionReturnState = {
    view: view.value,
    scrollY: window.scrollY,
    roundId: items.every((item) => item.round.id === items[0]?.round.id) ? items[0]?.round.id : undefined,
  };
  experienceTransitionPhase.value = 'home-leaving';
  await waitForMotion(300);
  const pageSize = Math.max(1, Number(options.pageSize) || preferredPageSize.value);
  const firstUnanswered = mode === 'learn'
    ? items.findIndex((item) => initialAnswers[item.id] == null)
    : -1;
  if (!options.resume) clearSavedLearningSession();
  examResult.value = null;
  sessionMenuOpen.value = false;
  learningJumpNumber.value = '';
  session.value = {
    id: options.sessionId || `${mode}-${Date.now()}`,
    mode,
    title,
    items,
    answers: mode === 'learn' || options.resume ? { ...initialAnswers } : {},
    kept: [...(options.kept || [])],
    page: options.page != null
      ? Math.min(Math.max(0, options.page), Math.max(0, Math.ceil(items.length / pageSize) - 1))
      : firstUnanswered > 0 ? Math.floor(firstUnanswered / pageSize) : 0,
    pageSize,
    startedAt: options.startedAt || Date.now(),
    remainingSeconds: mode === 'exam'
      ? Math.max(1, Number(options.remainingSeconds) || (items.every(item => isCoolingRecord(item.id)) ? Math.max(90 * 60, items.length * 90) : examDurationSeconds(items.length)))
      : 0,
    finished: false,
    resultSent: false,
    calculationMode: options.calculationMode,
  };
  const initialIndex = options.page != null
    ? Math.min(items.length - 1, Math.max(0, session.value.page * pageSize))
    : Math.max(0, firstUnanswered);
  activeSessionItemId.value = items[initialIndex]?.id || items[0]?.id || '';
  omrFilter.value = 'all';
  suspendedSession = null;
  suspendedExamResult = null;
  history.pushState(viewHistoryState(view.value, session.value.id), '', location.href);
  examSheetOpen.value = false;
  document.body.classList.add('session-active');
  experienceTransitionPhase.value = 'session-entering';
  restartTimer();
  window.scrollTo({ top: 0 });
  window.CBTAnalytics?.trackNavigation?.(`next-${mode}`);
  void nextTick(() => {
    if (!motionAllowed.value) return;
    animate('.session-topbar', { opacity: [0, 1], y: [-32, 0] }, { duration: .46, ease: [0.2, 0.8, 0.2, 1] });
    animate(
      '.question-card',
      visualStyle.value === 'simpsons'
        ? { opacity: [0, 1], scale: [.94, 1], y: [30, 0], rotate: [-1, 0] }
        : { opacity: [0, 1], scale: [.975, 1], y: [22, 0] },
      { duration: visualStyle.value === 'simpsons' ? .58 : .44, delay: stagger(.065), ease: [0.2, 0.85, 0.2, 1] },
    );
  });
  scheduleLearningSessionSave();
  await waitForMotion(620);
  experienceTransitionPhase.value = null;
}

async function resumeSavedLearning(): Promise<void> {
  let saved = savedLearningSession.value;
  if (!saved) return;
  // Preserve unfinished v5.3 midterm answers when switching to isolated records.
  if (saved.title.startsWith(`${coolingMidtermTitle} ·`) && !saved.itemIds.some(isCoolingRecord)) {
    const scoped = coolingRecordId;
    saved = { ...saved, itemIds: saved.itemIds.map(scoped), kept: saved.kept.map(scoped), answers: Object.fromEntries(Object.entries(saved.answers).map(([id, answer]) => [scoped(id), answer])) };
  }
  try { await ensureItemSources(saved.itemIds); }
  catch { showToast('이어풀기 문제를 불러오지 못했습니다. 저장 기록은 유지됩니다.'); return; }
  const items = saved.itemIds.flatMap((id) => {
    const item = itemMap.value.get(id) || targetItemMap.get(id);
    return item ? [item] : [];
  });
  if (!items.length || items.length !== saved.itemIds.length) {
    clearSavedLearningSession();
    showToast('저장된 문제 구성이 바뀌어 이어하기 기록을 정리했습니다.');
    return;
  }
  if (saved.itemIds.every(isCoolingRecord)) {
    selectedKey.value = SCHOOL_EXAM_CATALOG_KEY;
    localStorage.setItem(qualificationStorageKey, SCHOOL_EXAM_CATALOG_KEY);
    if (view.value !== 'rounds') openView('rounds');
  } else if (catalogs.some((catalog) => catalog.key === saved.qualificationKey)) {
    selectedKey.value = saved.qualificationKey;
    localStorage.setItem(qualificationStorageKey, saved.qualificationKey);
  }
  void beginSession(saved.mode || 'learn', saved.title, items, saved.answers, {
    calculationMode: saved.calculationMode,
    page: saved.page,
    pageSize: saved.pageSize,
    startedAt: saved.startedAt,
    remainingSeconds: saved.remainingSeconds,
    kept: saved.kept,
    resume: true,
    sessionId: saved.id,
  });
}

function startRound(round: Round, mode: StudyMode): void {
  const items = roundToItems(selectedKey.value === 'energy-midterm' ? { ...round, questions:energyTopicQuestions(round) } : round);
  if (!items.length) { showToast('계산 제외 후 남은 문제가 없습니다. 계산 문제를 켜 주세요.'); return; }
  const saved = savedLearningSession.value;
  const sameSavedRound = saved && ((selectedKey.value !== 'energy-midterm' && saved.roundId === round.id)
    || (saved.itemIds.length === items.length && saved.itemIds.every((id, index) => id === items[index]?.id)));
  if (sameSavedRound && (saved.mode || 'learn') === mode) {
    resumeSavedLearning();
    return;
  }
  if (mode === 'learn') {
    const previousAnswers = Object.fromEntries(items.flatMap((item) => {
      const choice = studyStore.attempts[item.id]?.lastChoice;
      return choice ? [[item.id, choice]] : [];
    }));
    beginSession(
      mode,
      round.kind === 'school-midterm' ? `${round.title}${selectedKey.value === 'energy-midterm' ? ` · ${energySourceLabel(energySourceMode.value)}` : ''} 학습` : `${round.year}년 ${round.session || ''} 학습`,
      items,
      previousAnswers,
      { resume: true },
    );
    return;
  }
  beginSession(
    mode,
    round.kind === 'school-midterm' ? `${round.title}${selectedKey.value === 'energy-midterm' ? ` · ${energySourceLabel(energySourceMode.value)}` : ''} CBT` : `${round.year}년 ${round.session || ''} ${mode === 'exam' ? '실전시험' : '학습'}`,
    items,
    {},
  );
}

function startEnergyMidterm(mode: StudyMode, full = false, bookOnly = false, match?: 'direct' | 'related', priority?: 'repeat' | 'recent' | 'note' | 'related' | 'pdf'): void {
  const rounds = visibleRounds.value;
  if (selectedKey.value !== 'energy-midterm' || !rounds.length) return;
  const pools = rounds.map(round => roundToItems({ ...round, questions:energyTopicQuestions(round) }));
  let items: QuestionItem[];
  try {
    items = priority ? pools.flat().filter(item => priority === 'pdf' ? item.question.midtermPdfSources?.length : item.question.midtermPriority === priority) : match ? pools.flat().filter(item => match === 'direct' ? item.question.midtermPriority !== 'related' : item.question.midtermPriority === 'related') : bookOnly ? pools.flat().filter(item => item.question.bookVerified) : full ? pools.flat() : energyMidtermPractice(pools, Math.random, { isCalculation: item => !!item.question.midtermCalculation, calculationTopics: rounds.flatMap((round,index) => energyDefaultCalculationTopics.some(n => n === index+1) && !energyCalculationExcluded.value.includes(round.id) ? [index+1] : []), includeOtherCalculations:true });
  } catch { showToast('시험 구성에 필요한 문제를 찾지 못했습니다. 자료를 다시 불러와 주세요.'); return; }
  if (!items.length) return;
  const priorityLabel = priority === 'pdf' ? '후기 PDF 원문' : energyMidtermPriorityGroups.value.find(g=>g.key===priority)?.title;
  void beginSession(mode, `에너지설비 중간고사 · ${energySourceLabel(energySourceMode.value)} · ${priorityLabel || (match === 'direct' ? '시험범위 3개 묶음' : match === 'related' ? '추가 예상만' : bookOnly ? '교재 대응 확인 문항' : full ? '전체 주제 연습' : '랜덤 20문제 시험 연습')}`, items);
}

function restartRoundLearning(round: Round): void {
  const items=roundToItems(selectedKey.value === 'energy-midterm' ? {...round,questions:energyTopicQuestions(round)} : round);
  if(!items.length){ showToast('계산 제외 후 남은 문제가 없습니다. 계산 문제를 켜 주세요.'); return; }
  beginSession('learn', round.kind==='school-midterm' ? `${round.title} 처음부터 학습` : `${round.year}년 ${round.session || ''} 처음부터 학습`, items);
}

function openRoundWrongAnswers(round: Round): void {
  if (!roundWrongGroupMap.value.has(round.id)) {
    showToast('이 회차에 저장된 오답이 없습니다.');
    return;
  }
  wrongRoundFilter.value = round.id;
  openView('wrong');
}

function randomQuestionSignature(item: QuestionItem): string {
  return [
    stripMarkup(item.question.text || item.question.html),
    ...item.question.choices.map((choice) => stripMarkup(choice.text || choice.html)),
  ].join('|')
    .replace(/^\d+[.)\s-]*/, '')
    .replace(/[\s'"“”‘’]+/g, '')
    .toLocaleLowerCase('ko');
}

function deduplicateRandomPool(items: QuestionItem[]): QuestionItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const signature = randomQuestionSignature(item);
    if (!signature || signature.length < 8) return true;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function randomSessionPool(): QuestionItem[] {
  if (selectedKey.value !== 'hvac') return selectedItems.value;
  if (!includeHansolInRandom.value) return deduplicateRandomPool(selectedItems.value);
  const hansolCatalog = catalogs.find((catalog) => catalog.key === 'hvac-hansol');
  if (!hansolCatalog?.rounds.length) return selectedItems.value;
  return deduplicateRandomPool([
    ...selectedItems.value,
    ...questionItems(hansolCatalog, yearFrom.value, yearTo.value, curriculum.value),
  ]);
}

function startBalancedExam(): void {
  const items = randomSessionPool();
  const subjects = selectedSubjects.value;
  if (!items.length || !subjects.length) {
    showToast('선택한 연도와 출제 체계를 다시 확인해 주세요.');
    return;
  }
  const totalOnly = officialRule.value?.scoring === 'total-only';
  const targetCount = totalOnly
    ? (officialRule.value?.totalQuestions || 60)
    : subjects.length * (officialRule.value?.questionsPerSubject || 20);
  const selected = totalOnly
    ? shuffle(items).slice(0, Math.min(targetCount, items.length))
    : subjects.flatMap((subject) => {
        const pool = items.filter((item) => item.subject === subject);
        if (!selectedCatalog.value.isVirtual) return shuffle(pool).slice(0, Math.min(20, pool.length));
        return selectGemTargetExamItems(pool);
      });
  if (selected.length < targetCount) {
    showToast('일부 과목은 문제가 부족해 가능한 문항만 출제했습니다.');
  }
  beginSession(
    'exam',
    `${selectedCatalog.value.shortName || selectedCatalog.value.name} · ${yearFrom.value}~${yearTo.value} 랜덤시험`,
    selected,
  );
}

function selectGemTargetExamItems(pool: QuestionItem[]): QuestionItem[] {
  const direct = pool.filter((item) => item.question.targetRelevance === 'core');
  const related = pool.filter((item) => item.question.targetRelevance === 'related');
  const selected = takeDiverseItems(direct, Math.min(15, direct.length));
  selected.push(...takeDiverseItems(related, Math.min(5, related.length), new Set(selected.map((item) => item.id))));
  if (selected.length < 20) {
    selected.push(...takeDiverseItems(
      [...direct, ...related],
      20 - selected.length,
      new Set(selected.map((item) => item.id)),
    ));
  }
  return shuffle(selected);
}

function takeDiverseItems(pool: QuestionItem[], count: number, excluded = new Set<string>()): QuestionItem[] {
  const selected: QuestionItem[] = [];
  const roundCount = new Map<string, number>();
  const ordered = shuffle(pool).filter((item) => !excluded.has(item.id));
  const addEligible = (allowExtraFromRound: boolean): void => {
    for (const item of ordered) {
      if (selected.length >= count || selected.some((entry) => entry.id === item.id)) continue;
      const roundId = item.question._originRoundId || item.round.id;
      if (!allowExtraFromRound && (roundCount.get(roundId) || 0) >= 2) continue;
      selected.push(item);
      roundCount.set(roundId, (roundCount.get(roundId) || 0) + 1);
    }
  };
  addEligible(false);
  if (selected.length < count) addEligible(true);
  return selected;
}

function startRangeLearning(): void {
  beginSession(
    'learn',
    `${selectedCatalog.value.shortName || selectedCatalog.value.name} · ${yearFrom.value}~${yearTo.value} 학습`,
    selectedItems.value,
  );
}

function startRandomLearning60(): void {
  const pool = randomSessionPool();
  const subjects = selectedSubjects.value;
  if (!pool.length || !subjects.length) {
    showToast('선택한 연도와 출제 체계를 다시 확인해 주세요.');
    return;
  }
  const target = Math.min(60, pool.length);
  const selected: QuestionItem[] = [];
  const used = new Set<string>();
  subjects.forEach((subject, index) => {
    const quota = Math.floor(target / subjects.length) + (index < target % subjects.length ? 1 : 0);
    shuffle(pool.filter((item) => item.subject === subject)).slice(0, quota).forEach((item) => {
      selected.push(item);
      used.add(item.id);
    });
  });
  if (selected.length < target) {
    shuffle(pool.filter((item) => !used.has(item.id))).slice(0, target - selected.length).forEach((item) => selected.push(item));
  }
  if (selected.length < 60) showToast(`출제 가능한 ${selected.length}문제로 학습을 시작합니다.`);
  void beginSession(
    'learn',
    `${selectedCatalog.value.shortName || selectedCatalog.value.name} · ${yearFrom.value}~${yearTo.value} 랜덤 ${selected.length}문제 학습`,
    shuffle(selected),
  );
}

function startHvacPrediction60(mode: StudyMode): void {
  const hvacCatalog = catalogs.find((catalog) => catalog.key === 'hvac');
  const hansolCatalog = catalogs.find((catalog) => catalog.key === 'hvac-hansol');
  if (!hvacCatalog || !hansolCatalog) {
    showToast('공조 문제 데이터를 불러오지 못했습니다.');
    return;
  }
  const latestYear = Math.max(...yearsFor(hvacCatalog));
  const fromYear = predictionRange.value === 'selected'
    ? yearFrom.value
    : predictionRange.value === 'recent' ? Math.max(2002, latestYear - 9) : 2002;
  const toYear = predictionRange.value === 'selected' ? yearTo.value : latestYear;
  const rangeLabel = predictionRange.value === 'selected'
    ? `현재 설정 ${fromYear}~${toYear}년`
    : predictionRange.value === 'recent' ? `${fromYear}~${toYear}년` : `전회차 ${fromYear}~${toYear}년`;
  const pool = deduplicateRandomPool([
    ...roundToItems(hvacFieldReportRound),
    ...questionItems(hvacCatalog, fromYear, toYear, 'all-mapped'),
    ...(includeHansolInRandom.value ? questionItems(hansolCatalog, fromYear, toYear, 'all-mapped') : []),
  ]);
  const selected = buildHvacPredictionSet(pool);
  const subjectCounts = new Map<string, number>();
  selected.forEach((item) => subjectCounts.set(item.subject, (subjectCounts.get(item.subject) || 0) + 1));
  if (selected.length !== 60 || [...subjectCounts.values()].some((count) => count !== 20)) {
    showToast('예상 문제 구성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return;
  }
  selectedKey.value = 'hvac';
  localStorage.setItem(qualificationStorageKey, 'hvac');
  void beginSession(
    mode,
    `공조 시험 예상 60문제 · ${rangeLabel} · ${mode === 'exam' ? 'CBT' : '학습'}`,
    selected,
  );
}

function startCoachPlan(key: CoachPlanKey): void {
  if (key === 'exam') {
    startBalancedExam();
    return;
  }
  if (key === 'calculation') {
    openView('calculation');
    return;
  }

  let pool: MasteryRow[] = [];
  let title = '';
  if (key === 'due') {
    pool = dueRows.value.length ? dueRows.value : (weakRows.value.length ? weakRows.value : shuffle(unseenRows.value));
    title = `합격 엔진 · ${coachPlans.value.find(plan => plan.key === key)?.title || '복습'}`;
  } else if (key === 'weak') {
    pool = weakRows.value.length ? weakRows.value : shuffle(unseenRows.value);
    title = `합격 엔진 · ${coachPlans.value.find(plan => plan.key === key)?.title || '진단 학습'}`;
  } else {
    pool = masteryRows.value
      .filter((item) => item.subject === weakestSubject.value?.subject)
      .sort((a, b) => a.mastery - b.mastery || a.recall - b.recall);
    title = `합격 엔진 · ${coachPlans.value.find(plan => plan.key === key)?.title || '과목 학습'}`;
  }

  const items = pool.slice(0, 20).map(({ mastery: _mastery, recall: _recall, dueAt: _dueAt, due: _due, attempted: _attempted, ...item }) => item);
  if (!items.length) {
    showToast('현재 범위에서 이 훈련에 맞는 문제를 찾지 못했습니다.');
    return;
  }
  beginSession('learn', title, items);
}

function startCalculationLearning(limit?: number): void {
  const rows = [...filteredCalculationRows.value]
    .sort((a, b) => a.mastery - b.mastery || a.recall - b.recall);
  const selected = (limit ? rows.slice(0, limit) : rows)
    .map(({ mastery: _mastery, recall: _recall, dueAt: _dueAt, due: _due, attempted: _attempted, ...item }) => item);
  const subjectLabel = calculationSubjectFilter.value === 'all' ? '전체 과목' : calculationSubjectFilter.value;
  const roundLabel = calculationRoundFilter.value === 'all'
    ? '전체 회차'
    : calculationRounds.value.find((round) => round.id === calculationRoundFilter.value)?.label || '선택 회차';
  const resultLabel = calculationResultFilter.value === 'wrong' ? '계산 오답' : '계산문제';
  beginSession('learn', `${resultLabel} · ${subjectLabel} · ${roundLabel}`, selected, {}, { calculationMode: true });
}

async function replayHistoryRecord(record: ExamRecord): Promise<void> {
  const bookIds = [...(record.itemIds || []), ...Object.keys(record.answers || {})].filter(id => bookForStudyId(id));
  if (bookIds.length) {
    try { await ensureItemSources(bookIds); }
    catch { showToast('교재 풀이 기록의 문제를 불러오지 못했습니다. 다시 시도해 주세요.'); return; }
  }
  let items = (record.itemIds || []).map((id) => itemMap.value.get(id)).filter((item): item is QuestionItem => Boolean(item));
  if (!items.length && record.roundId) {
    const round = selectedCatalog.value.rounds.find((item) => item.id === record.roundId);
    if (round) items = roundToItems(round);
  }
  if (!items.length) {
    items = Object.keys(record.answers || {}).map((id) => itemMap.value.get(id)).filter((item): item is QuestionItem => Boolean(item));
  }
  if (!items.length) {
    showToast('이 기록의 문제를 현재 데이터에서 찾지 못했습니다. 해당 종목을 다시 선택해 주세요.');
    return;
  }
  beginSession(record.mode || 'learn', `${record.title} · 다시 풀기`, items);
}

function startCoachSubject(subject: string): void {
  const items = masteryRows.value
    .filter((item) => item.subject === subject)
    .sort((a, b) => a.mastery - b.mastery || a.recall - b.recall)
    .slice(0, 20)
    .map(({ mastery: _mastery, recall: _recall, dueAt: _dueAt, due: _due, attempted: _attempted, ...item }) => item);
  if (!items.length) {
    showToast('선택한 과목에서 출제 가능한 문제를 찾지 못했습니다.');
    return;
  }
  beginSession('learn', `합격 엔진 · ${subject} 집중 훈련`, items);
}

function chooseAnswer(item: QuestionItem, choice: number): void {
  if (!session.value || session.value.finished) return;
  if (session.value.answers[item.id] === choice) {
    delete session.value.answers[item.id];
    scheduleLearningSessionSave();
    return;
  }
  session.value.answers[item.id] = choice;
  if (session.value.mode === 'learn') {
    recordAttempt(item.id, choice, item.question.answer);
  }
  scheduleLearningSessionSave();
}

function toggleKeep(item: QuestionItem): void {
  if (!session.value || session.value.finished) return;
  const index = session.value.kept.indexOf(item.id);
  if (index >= 0) session.value.kept.splice(index, 1);
  else session.value.kept.push(item.id);
  scheduleLearningSessionSave();
}

function goToNextKept(): void {
  if (!session.value || !session.value.kept.length) return;
  const currentIndex = session.value.page * session.value.pageSize;
  const keptIndexes = session.value.kept
    .map((id) => session.value?.items.findIndex((item) => item.id === id) ?? -1)
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const nextIndex = keptIndexes.find((index) => index > currentIndex) ?? keptIndexes[0];
  if (nextIndex != null) goToQuestion(nextIndex);
}

function toggleBookmark(item: QuestionItem): void {
  const index = studyStore.bookmarks.indexOf(item.id);
  if (index >= 0) {
    studyStore.bookmarks.splice(index, 1);
    markBookmarkSyncState(item.id, false);
    showToast('북마크에서 제거했습니다.');
  } else {
    studyStore.bookmarks.push(item.id);
    markBookmarkSyncState(item.id, true);
    showToast('북마크에 저장했습니다.');
  }
}

function isSubjectStart(item: QuestionItem): boolean {
  const index = session.value?.items.findIndex((entry) => entry.id === item.id) ?? -1;
  if (index <= 0) return index === 0;
  return session.value?.items[index - 1]?.subject !== item.subject;
}

function sessionSubjectNumber(item: QuestionItem): number {
  if (!session.value) return 1;
  return [...new Set(session.value.items.map((entry) => entry.subject))].indexOf(item.subject) + 1;
}

function goToPage(page: number): void {
  if (!session.value) return;
  const nextPage = Math.max(0, Math.min(pageCount.value - 1, page));
  if (nextPage === session.value.page) return;
  questionDirection.value = nextPage > session.value.page ? 1 : -1;
  session.value.page = nextPage;
  activeSessionItemId.value = session.value.items[nextPage * session.value.pageSize]?.id || '';
  scheduleLearningSessionSave();
  window.scrollTo({ top: 0, behavior: motionAllowed.value ? 'smooth' : 'auto' });
}

function goToQuestion(index: number): void {
  if (!session.value) return;
  const targetIndex = Math.max(0, Math.min(session.value.items.length - 1, index));
  goToPage(Math.floor(targetIndex / session.value.pageSize));
  activeSessionItemId.value = session.value.items[targetIndex]?.id || '';
  window.setTimeout(() => {
    document.getElementById(`session-question-${targetIndex + 1}`)
      ?.scrollIntoView({ block: 'start', behavior: motionAllowed.value ? 'smooth' : 'auto' });
  }, motionAllowed.value ? 380 : 0);
  if (window.innerWidth < 1100) examSheetOpen.value = false;
}

function goToNextUnanswered(): void {
  if (!session.value) return;
  const activeIndex = session.value.items.findIndex((item) => item.id === activeSessionItem.value?.id);
  const unanswered = session.value.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => session.value?.answers[item.id] == null);
  if (!unanswered.length) {
    showToast('미응답 문제가 없습니다.');
    return;
  }
  const target = unanswered.find(({ index }) => index > activeIndex) || unanswered[0];
  goToQuestion(target.index);
}

function setSessionPageSize(size: number): void {
  if (!session.value) return;
  const activeIndex = Math.max(0, session.value.items.findIndex((item) => item.id === activeSessionItem.value?.id));
  session.value.pageSize = size;
  session.value.page = Math.floor(activeIndex / size);
  activeSessionItemId.value = session.value.items[activeIndex]?.id || '';
}

function activateSessionItem(item: QuestionItem): void {
  activeSessionItemId.value = item.id;
}

function handleSessionKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && androidApkPopupOpen.value) {
    event.preventDefault();
    androidApkPopupOpen.value = false;
    return;
  }
  if (solveLayoutMode.value !== 'comcbt'
    || !session.value
    || session.value.finished
    || settingsOpen.value
    || aiPromptOpen.value
    || examResult.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input,select,textarea,button,[contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
  const item = activeSessionItem.value;
  if (/^[1-4]$/.test(event.key) && item) {
    event.preventDefault();
    chooseAnswer(item, Number(event.key));
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goToPage((session.value?.page || 0) - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    goToPage((session.value?.page || 0) + 1);
  } else if (event.key.toLowerCase() === 'k' && item && session.value.mode === 'exam') {
    event.preventDefault();
    toggleKeep(item);
  } else if (event.key.toLowerCase() === 'b' && item) {
    event.preventDefault();
    toggleBookmark(item);
  } else if (event.key.toLowerCase() === 'e') {
    const explanation = document.querySelector<HTMLElement>('.question-card.keyboard-active .explanation-box');
    const trigger = document.querySelector<HTMLElement>('.question-card.keyboard-active .compact-explanation-trigger');
    if (explanation) {
      event.preventDefault();
      explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (trigger) {
      event.preventDefault();
      trigger.click();
    }
  }
}

function jumpToLearningQuestion(): void {
  if (!session.value || session.value.mode !== 'learn') return;
  const number = Number(learningJumpNumber.value);
  if (!Number.isInteger(number) || number < 1) {
    showToast('이동할 문제 번호를 입력하세요.');
    return;
  }
  const index = number - 1;
  if (index < 0 || index >= session.value.items.length) {
    showToast(`${number}번은 현재 학습 범위에 없습니다.`);
    return;
  }
  goToQuestion(index);
}

function resetLearning(): void {
  if (!session.value || session.value.mode !== 'learn') return;
  if (!confirm('현재 화면에서 선택한 답을 모두 초기화할까요? 저장된 누적 학습 통계는 유지됩니다.')) return;
  session.value.answers = {};
  session.value.page = 0;
  showToast('현재 학습 선택을 초기화했습니다.');
}

function calculateSessionResult(): (ExamResult & { unanswered: number }) | null {
  if (!session.value) return null;
  const grouped = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  session.value.items.forEach((item) => {
    const isCorrect = session.value?.answers[item.id] === item.question.answer;
    if (isCorrect) correct += 1;
    const row = grouped.get(item.subject) || { correct: 0, total: 0 };
    row.total += 1;
    if (isCorrect) row.correct += 1;
    grouped.set(item.subject, row);
  });
  const score = Math.round((correct / session.value.items.length) * 100);
  const rule = officialRule.value;
  const subjectMinimum = rule?.scoring === 'subject-average' ? (rule.subjectMinimum || 40) : 0;
  const subjectRows = [...grouped.entries()].map(([subject, row]) => ({
    subject,
    ...row,
    score: Math.round((row.correct / row.total) * 100),
    passed: subjectMinimum === 0 || (row.correct / row.total) * 100 >= subjectMinimum,
  }));
  const roundIds = [...new Set(session.value.items.map((item) => item.round.id))];
  const fullSingleRound = roundIds.length === 1
    && session.value.items.length === session.value.items[0]?.round.questions.length;
  const balancedFullExam = session.value.mode === 'exam'
    && subjectRows.length === selectedSubjects.value.length
    && subjectRows.every((row) => row.total === rule?.questionsPerSubject);
  const official = Boolean(rule && (rule.scoring === 'subject-average'
    ? (fullSingleRound || balancedFullExam) && subjectRows.every((row) => row.total === rule.questionsPerSubject)
    : fullSingleRound && session.value.items.length === rule.totalQuestions));
  const passed = official && rule ? score >= rule.passScore && subjectRows.every((row) => row.passed) : false;
  return {
    score,
    correct,
    total: session.value.items.length,
    passed,
    official,
    criteria: rule
      ? `${official ? '' : '전체 시험 분량을 푼 경우 적용 · '}${rule.note}`
      : coolingSessionActive.value || selectedKey.value === 'energy-midterm' ? '중간고사 연습 점수입니다. 학교의 실제 채점 기준과는 다를 수 있습니다.' : '공식 합격 기준 확인이 필요합니다.',
    source: rule?.officialSource,
    subjectRows,
    unanswered: session.value.items.length - answeredCount.value,
  };
}

function sendSessionResult(result: ExamResult & { unanswered: number }): void {
  if (!session.value || session.value.resultSent || answeredCount.value === 0) return;
  const roundIds = [...new Set(session.value.items.map((item) => item.round.id))];
  session.value.resultSent = true;
  window.CBTAnalytics?.trackResult?.({
    qualificationKey: sessionQualificationKey.value,
    qualification: coolingSessionActive.value ? coolingMidtermTitle : selectedCatalog.value.name,
    roundId: roundIds.length === 1 ? roundIds[0] : undefined,
    title: session.value.title,
    mode: session.value.mode,
    score: result.score,
    correct: result.correct,
    total: result.total,
    unanswered: result.unanswered,
    durationSeconds: Math.max(0, Math.round((Date.now() - session.value.startedAt) / 1000)),
    subjects: result.subjectRows.map(({ subject, correct, total, score }) => ({
      subject,
      correct,
      total,
      score,
    })),
  });
}

function submitSession(mode: StudyMode, force = false): void {
  if (!session.value || session.value.mode !== mode || session.value.finished) return;
  if (!force && (answeredCount.value < session.value.items.length || keptCount.value > 0)) {
    const remaining = session.value.items.length - answeredCount.value;
    const messages = [
      remaining > 0 ? `미응답 ${remaining}문제` : '',
      keptCount.value > 0 ? `킵 ${keptCount.value}문제` : '',
    ].filter(Boolean).join(', ');
    if (!confirm(`${messages}가 있습니다. 그래도 채점할까요?`)) return;
  }
  session.value.finished = true;
  if (session.value.items.every(item => isCoolingRecord(item.id))) {
    studyStore.progress ||= {};
    studyStore.progress[coolingArchiveKey] = { sessions: coolingArchive.value.filter(saved => saved.id !== session.value?.id), savedAt: Date.now() };
  }
  clearSavedLearningSession();
  stopTimer();
  if (mode === 'exam') {
    session.value.items.forEach((item) => {
      const selected = session.value?.answers[item.id];
      if (selected) recordAttempt(item.id, selected, item.question.answer);
    });
  }
  const result = calculateSessionResult();
  if (!result) return;
  examResult.value = result;
  const roundIds = [...new Set(session.value.items.map((item) => item.round.id))];
  const singleRound = roundIds.length === 1 ? session.value.items[0]?.round : undefined;
  const wrongAnswers = session.value.items.flatMap((item) => {
    const selected = session.value?.answers[item.id];
    if (!selected || selected === item.question.answer) return [];
    return [{
      id: item.id,
      subject: item.subject,
      number: item.question.number,
      selected,
      answer: item.question.answer,
    }];
  });
  void recordExam({
    id: session.value.id,
    qualificationKey: sessionQualificationKey.value,
    roundId: singleRound?.id,
    year: singleRound?.year,
    session: singleRound?.session || singleRound?.date,
    mode,
    title: session.value.title,
    score: result.score,
    passed: result.passed,
    answered: answeredCount.value,
    total: session.value.items.length,
    subjectRows: result.subjectRows,
    answers: { ...session.value.answers },
    itemIds: session.value.items.map((item) => item.id),
    wrongAnswers,
    finishedAt: Date.now(),
  }).then(() => {
    scheduleLearningSync(100);
    return refreshExamHistory();
  });
  sendSessionResult(result);
}

function submitExam(force = false): void {
  submitSession('exam', force);
}

function submitLearning(): void {
  submitSession('learn');
}

function openResultWrongAnswers(resetAnswers: boolean): void {
  if (!session.value || !examResult.value) return;
  const wrong = session.value.items.filter((item) => {
    const selected = session.value?.answers[item.id];
    return Boolean(selected && selected !== item.question.answer);
  });
  if (!wrong.length) {
    showToast('이번 풀이에는 틀린 문제가 없습니다.');
    return;
  }
  const previousAnswers = { ...session.value.answers };
  session.value = {
    ...session.value,
    id: `wrong-review-${Date.now()}`,
    mode: 'learn',
    title: `${session.value.title} · 이번 회차 오답`,
    items: wrong,
    answers: resetAnswers
      ? {}
      : Object.fromEntries(wrong.flatMap((item) => previousAnswers[item.id] ? [[item.id, previousAnswers[item.id]]] : [])),
    kept: [],
    page: 0,
    pageSize: preferredPageSize.value,
    startedAt: Date.now(),
    remainingSeconds: 0,
    finished: false,
    resultSent: false,
  };
  activeSessionItemId.value = wrong[0]?.id || '';
  examResult.value = null;
  examSheetOpen.value = false;
  window.scrollTo({ top: 0, behavior: motionAllowed.value ? 'smooth' : 'auto' });
}

function sendCurrentSessionOnExit(): void {
  if (!session.value || session.value.finished || session.value.resultSent || answeredCount.value === 0) return;
  const result = calculateSessionResult();
  if (result) sendSessionResult(result);
}

async function leaveSession(nextView?: ViewName): Promise<void> {
  if (session.value && !session.value.finished && answeredCount.value > 0) {
    if (!confirm('현재 풀이를 종료하고 이동할까요?')) return;
  }
  if (experienceTransitionPhase.value) return;
  sendCurrentSessionOnExit();
  experienceTransitionPhase.value = 'session-leaving';
  await waitForMotion(300);
  const current = ownHistoryState();
  if (!nextView && current?.sessionId === session.value?.id) {
    history.back();
    return;
  }
  const returnState = sessionReturnState;
  deactivateSession(false);
  experienceTransitionPhase.value = 'home-entering';
  const returnView = nextView || returnState?.view || view.value;
  openView(returnView, { replace: Boolean(current?.sessionId) });
  if (!nextView && returnState?.view === returnView) restoreSessionReturnPosition(returnState);
  sessionReturnState = null;
  await waitForMotion(520);
  experienceTransitionPhase.value = null;
}

function restartTimer(): void {
  stopTimer();
  if (session.value?.mode !== 'exam') return;
  timerHandle = window.setInterval(() => {
    if (!session.value || session.value.finished) return;
    session.value.remainingSeconds -= 1;
    if (session.value.remainingSeconds <= 0) submitExam(true);
  }, 1000);
}

function stopTimer(): void {
  window.clearInterval(timerHandle);
  timerHandle = 0;
}

function openCalculator(): void {
  if (session.value) {
    panelCalculator.value=true;
    sessionMenuOpen.value=false;
    return;
  }
  if (document.documentElement.dataset.nativeApp === 'true') {
    nativeCalculatorOpen.value = true;
    nativeMoreOpen.value = false;
    return;
  }
  const calculatorUrl = new URL('calculator.html', location.href);
  calculatorUrl.searchParams.set('space', isJewelry ? 'jewelry' : 'industrial');
  const calculator = window.open(
    calculatorUrl.href,
    'cbtScientificCalculator',
    'popup=yes,width=470,height=820,resizable=yes,scrollbars=yes',
  );
  if (calculator) calculator.focus();
  else showToast('브라우저에서 이 사이트의 팝업을 허용해 주세요.');
}

function openFeatureAiDemo(): void {
  if (!featureImageItem.value) {
    showToast('체험할 문제를 찾지 못했습니다.');
    return;
  }
  prepareAiQuestion(featureImageItem.value);
}

function startFeatureRound(mode: StudyMode): void {
  const round = visibleRounds.value[0];
  if (!round) {
    showToast('시작할 회차를 찾지 못했습니다.');
    return;
  }
  startRound(round, mode);
}

function resolvedQuestionImageUrls(item: QuestionItem): string[] {
  const imageBase = location.protocol === 'file:'
    ? 'https://tk6871.github.io/cbt/'
    : new URL('./', location.href).href;
  const imagePaths = [
    item.question.sourceImage,
    ...(item.question.images || []),
    ...item.question.choices.flatMap((choice) => choice.images || []),
  ].filter((path): path is string => Boolean(path));
  return [...new Set(imagePaths)].map((path) => {
    try {
      const url = new URL(problemImage(path) || path, imageBase);
      url.searchParams.set('cbt_ai', `${currentVersion.value}-${Date.now().toString(36)}`);
      return url.href;
    } catch {
      return path;
    }
  });
}

function buildBeginnerAiPrompt(item: QuestionItem, imageUrls = resolvedQuestionImageUrls(item)): string {
  const restoredImageQuestion = item.round.qualificationKey === 'hvac'
    && Number(item.round.year) >= 2021
    && Boolean(item.question.sourceImage);
  const hasImage = Boolean(
    item.question.sourceImage
    || item.question.images?.length
    || item.question.choices.some((choice) => choice.images?.length),
  );
  const questionText = stripMarkup(item.question.html || item.question.text)
    || '[문제 내용은 첨부할 원문 이미지에 있습니다.]';
  const choices = item.question.choices.map((choice, index) => {
    const copy = restoredImageQuestion ? '' : stripMarkup(choice.html || choice.text);
    return `${index + 1}번. ${copy || `[${index + 1}번 보기는 첨부 이미지에서 확인]`}`;
  }).join('\n');
  const selectedAnswer = session.value?.answers[item.id];
  const savedExplanation = stripMarkup(item.question.explanationHtml || item.question.explanation)
    || '[등록된 해설 없음]';
  const imageLinks = imageUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
  const imageInstruction = hasImage
    ? '\n- 중요: 이 질문과 함께 대화창에 붙여넣거나 공유한 문제 이미지가 있으면 그 첨부 이미지를 가장 먼저 확인하세요. 아래 주소는 보조 수단이며 외부 캐시 오류로 열리지 않을 수 있습니다. OCR 텍스트와 이미지가 다르면 반드시 첨부 이미지를 기준으로 판단하고, 첨부도 주소도 확인할 수 없으면 추측하지 말고 이미지 첨부를 요청하세요.'
    : '';

  return `아래 국가기술자격 CBT 문제를 초보자 눈높이로 설명해 주세요.
현재 CBT의 설정 정답과 등록 해설은 사전 검수를 거친 기준값입니다. 근거 없이 정답을 바꾸지 말고, 답하기 전에 문제 조건·보기·공식·단위를 내부적으로 두 번 검산해 주세요.
설정 정답과 다른 결론이 나올 때만 구체적인 반증을 제시하고 '정답 충돌 가능성'이라고 표시하세요. 확신할 수 없으면 추측하지 말고 '추가 검증 필요'라고 말해 주세요.${imageInstruction}

[시험 정보]
- 자격증: ${item.round.qualification || selectedCatalog.value.name}
- 연도·회차: ${item.round.title}
- 과목: ${item.subject}
- 문제 번호: ${item.question.number}번
- 현재 CBT 설정 정답: ${item.question.answer}번
- 내가 고른 답: ${selectedAnswer ? `${selectedAnswer}번` : '아직 선택하지 않음'}

[문제 원문]
${questionText}

[보기]
${choices}

${hasImage ? `[문제 이미지 주소]\n${imageLinks}\n` : ''}
[현재 등록된 해설]
${savedExplanation}

[검산 규칙]
- 설정 정답 ${item.question.answer}번을 기준으로 문제를 독립적으로 다시 풀어 교차 확인하세요.
- 계산문제는 공식과 단위, 숫자 대입을 각각 다시 확인하세요.
- 개념문제는 1~4번 보기를 모두 대조하세요.
- 인터넷 검색이 가능하면 공신력 있는 자료를 우선 확인하되, 출처 불명의 답을 그대로 따르지 마세요.

[짧은 답변 형식]
1. 결론: 정답 번호와 핵심 이유 한 문장
   - 설정 정답과 다를 때만 '정답 충돌 가능성'과 구체적인 근거 표시
2. 쉽게 풀기: 초보자가 이해할 수 있게 3~5단계
3. 보기 확인: 1~4번의 맞음·틀림 이유를 한 줄씩
4. 계산·암기: 계산문제는 공식과 단위, 마지막에 시험장 구별법과 한 줄 암기`;
}

function prepareAiQuestion(item: QuestionItem): void {
  aiPromptImageUrls.value = resolvedQuestionImageUrls(item);
  aiPromptText.value = buildBeginnerAiPrompt(item, aiPromptImageUrls.value);
  aiPromptHasImage.value = Boolean(
    item.question.sourceImage
    || item.question.images?.length
    || item.question.choices.some((choice) => choice.images?.length),
  );
  aiPromptImageFilename.value = `CBT-${item.round.year}-${item.round.session || item.round.title}-${item.question.number}번.png`
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-');
  aiPromptOpen.value = true;
}

function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG 변환 실패'));
    }, 'image/png');
  });
}

async function loadAiImage(url: string): Promise<HTMLImageElement> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`이미지 응답 오류 ${response.status}`);
  const objectUrl = URL.createObjectURL(await response.blob());
  const image = new Image();
  try {
    image.src = objectUrl;
    await image.decode();
    return image;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function buildAiQuestionImage(): Promise<Blob> {
  if (!aiPromptImageUrls.value.length) throw new Error('복사할 문제 이미지가 없습니다.');
  const images = await Promise.all(aiPromptImageUrls.value.map(loadAiImage));
  try {
    const padding = 24;
    const contentWidth = Math.min(1600, Math.max(...images.map((image) => image.naturalWidth)));
    const sizes = images.map((image) => {
      const scale = Math.min(1, contentWidth / Math.max(1, image.naturalWidth));
      return {
        width: Math.max(1, Math.round(image.naturalWidth * scale)),
        height: Math.max(1, Math.round(image.naturalHeight * scale)),
      };
    });
    const canvas = document.createElement('canvas');
    canvas.width = contentWidth + padding * 2;
    canvas.height = sizes.reduce((sum, size) => sum + size.height, padding * (images.length + 1));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 합성 기능을 사용할 수 없습니다.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let y = padding;
    images.forEach((image, index) => {
      const size = sizes[index];
      const x = Math.round((canvas.width - size.width) / 2);
      context.drawImage(image, x, y, size.width, size.height);
      y += size.height + padding;
    });
    return canvasPngBlob(canvas);
  } finally {
    images.forEach((image) => URL.revokeObjectURL(image.src));
  }
}

function downloadAiQuestionImage(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = aiPromptImageFilename.value;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyAiQuestionImage(): Promise<void> {
  if (aiImageBusy.value) return;
  aiImageBusy.value = true;
  try {
    const blob = await buildAiQuestionImage();
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      downloadAiQuestionImage(blob);
      showToast('클립보드 제한으로 문제 PNG를 저장했습니다. ChatGPT에 첨부해 주세요.');
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('문제 이미지를 복사했습니다. ChatGPT 입력창에 붙여넣으세요.');
    } catch {
      downloadAiQuestionImage(blob);
      showToast('이미지 복사가 제한되어 문제 PNG를 저장했습니다. ChatGPT에 첨부해 주세요.');
    }
  } catch {
    showToast('문제 이미지를 준비하지 못했습니다. 크게 보기에서 이미지를 저장해 첨부해 주세요.');
  } finally {
    aiImageBusy.value = false;
  }
}

async function shareAiQuestion(): Promise<void> {
  if (aiImageBusy.value || !canShareAiQuestion) return;
  aiImageBusy.value = true;
  let blob: Blob | null = null;
  try {
    blob = await buildAiQuestionImage();
    const file = new File([blob], aiPromptImageFilename.value, { type: 'image/png' });
    const shareData: ShareData = {
      title: 'CBT AI 해설 질문',
      text: aiPromptText.value,
      files: [file],
    };
    if (navigator.canShare && !navigator.canShare(shareData)) {
      downloadAiQuestionImage(blob);
      await copyText(aiPromptText.value);
      showToast('공유가 제한되어 질문은 복사하고 문제 PNG는 저장했습니다.');
      return;
    }
    await navigator.share(shareData);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    await copyText(aiPromptText.value);
    if (blob) downloadAiQuestionImage(blob);
    showToast(blob
      ? '공유가 제한되어 질문은 복사하고 문제 PNG는 저장했습니다.'
      : '문제 이미지를 준비하지 못했습니다. 크게 보기에서 이미지를 저장해 첨부해 주세요.');
  } finally {
    aiImageBusy.value = false;
  }
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

async function copyAiPrompt(): Promise<void> {
  await copyText(aiPromptText.value);
  showToast(aiPromptHasImage.value
    ? '프롬프트를 복사했습니다. 문제 이미지 복사도 눌러 함께 붙여넣으세요.'
    : '초보자용 AI 질문 프롬프트를 복사했습니다.');
}

function openAiAssistant(): void {
  const assistant = window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  void copyAiPrompt();
  if (assistant) assistant.focus();
}

function changeTheme(): void {
  theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system';
  applyTheme(theme.value);
  showToast(theme.value === 'system' ? '기기 설정 테마' : theme.value === 'dark' ? '다크 모드' : '라이트 모드');
}

function toggleLightDark(): void {
  theme.value = darkActive.value ? 'light' : 'dark';
  applyTheme(theme.value);
  showToast(darkActive.value ? '다크 모드로 전환했습니다.' : '라이트 모드로 전환했습니다.');
}

function waitForMotion(duration: number): Promise<void> {
  if (!motionAllowed.value) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function setDynamicUiEnabled(enabled: boolean): void {
  dynamicUiEnabled.value = enabled;
  applyDynamicUiPreference(enabled);
  visualTransitionPhase.value = null;
  experienceTransitionPhase.value = null;
  displayedPassChance.value = passChance.value;
  showToast(enabled
    ? '동적 UI를 켰습니다. 새 배치와 화면 전환을 적용합니다.'
    : '기존 UI 모드로 돌아왔습니다. 화면 전환과 재배치를 끕니다.');
}

async function startUiTour(): Promise<void> {
  const { driver } = await import('driver.js');
  driver({
    showProgress: true,
    allowClose: true,
    overlayOpacity: .62,
    nextBtnText: '다음',
    prevBtnText: '이전',
    doneBtnText: '확인',
    progressText: '{{current}} / {{total}}',
    steps: [
      { element: '.settings-hub', popover: { title: '화면과 학습 데이터', description: '설정 목차에서 바꿀 항목을 고르세요. 검색하면 모든 분류에서 찾을 수 있습니다.' } },
      { element: '.settings-open-full,.settings-hub-search', popover: { title: '전체 설정', description: '같은 설정을 넓게 보고, 목차로 이동하거나 검색할 수 있습니다.' } },
      { element: '.theme-studio', popover: { title: 'UI·테마 실험실', description: '기존 테마의 색상과 밀도만 조절합니다. 저장한 답안에는 영향을 주지 않습니다.' } },
    ],
  }).drive();
}

function sunjaeImageAt(offset: number): string {
  return sunjaeImages[(sunjaeImageIndex.value + offset) % sunjaeImages.length] || sunjaeThemeBanner;
}

function simpsonsFunnyImageAt(offset: number): string {
  return simpsonsFunnyImages[offset % simpsonsFunnyImages.length] || simpsonsKingSizeImage;
}

function sunjaePortraitImageAt(offset: number): string {
  return sunjaePortraitImages[(sunjaeImageIndex.value + offset) % sunjaePortraitImages.length] || sunjaePraiseImage;
}

function restartSunjaeRotation(): void {
  window.clearInterval(sunjaeRotationHandle);
  sunjaeRotationHandle = 0;
  if (visualStyle.value !== 'sunjae' || sunjaeRotationSeconds.value <= 0) return;
  sunjaeRotationHandle = window.setInterval(() => {
    sunjaeImageIndex.value = (sunjaeImageIndex.value + 1) % sunjaeImages.length;
  }, sunjaeRotationSeconds.value * 1000);
}

function setSunjaeRotationSeconds(seconds: number): void {
  sunjaeRotationSeconds.value = seconds;
  localStorage.setItem('unified-cbt-sunjae-rotation-seconds', String(seconds));
  restartSunjaeRotation();
  showToast(seconds ? `선재 사진을 ${sunjaeRotationLabel(seconds)}마다 바꿉니다.` : '선재 사진 자동 교체를 껐습니다.');
}

function setAnswerLayout(layout: AnswerLayout): void {
  answerLayout.value = layout;
  localStorage.setItem('unified-cbt-answer-layout', layout);
  showToast(layout === 'hotspot'
    ? '원문 이미지 속 답안을 직접 누릅니다.'
    : layout === 'inline' ? '번호 옆에 답안 문구를 표시합니다.' : '기존 큰 번호 답안으로 돌아왔습니다.');
}

function setHotspotIndicator(indicator: HotspotIndicator): void {
  hotspotIndicator.value = indicator;
  localStorage.setItem('unified-cbt-hotspot-indicator', indicator);
  showToast(indicator === 'area' ? 'PaddleOCR 좌표로 선택한 답의 글자 줄을 강조합니다.' : '선택한 답을 체크 마커로 표시합니다.');
}

function setRestoredImageTheme(mode: RestoredImageTheme): void {
  restoredImageTheme.value = mode;
  localStorage.setItem('unified-cbt-restored-image-theme', mode);
  showToast(mode === 'auto'
    ? '다크 모드에서 복원문제의 눈부심을 줄입니다.'
    : '복원문제를 항상 원본 색상으로 표시합니다.');
}

function setSolveLayoutMode(mode: SolveLayoutMode): void {
  if (mode === solveLayoutMode.value) return;
  const currentIndex = session.value ? session.value.page * session.value.pageSize : 0;
  solveLayoutMode.value = mode;
  localStorage.setItem('unified-cbt-solve-layout', mode);
  if (session.value) {
    const nextSize = preferredPageSize.value;
    session.value.pageSize = nextSize;
    session.value.page = Math.floor(currentIndex / nextSize);
    activeSessionItemId.value = session.value.items[currentIndex]?.id || session.value.items[0]?.id || '';
    scheduleLearningSessionSave();
    void nextTick(syncOmrToCurrentPage);
  }
  showToast(mode === 'combat'
    ? '컴뱃 CBT 다중 문제 HUD 화면으로 전환했습니다.'
    : mode === 'comcbt'
      ? 'COMCBT형 고밀도 시험 화면으로 전환했습니다.'
      : '기존 v2.7 CBT 화면으로 돌아왔습니다.');
}

function sunjaeRotationLabel(seconds: number): string {
  if (!seconds) return '끔';
  return seconds < 60 ? `${seconds}초` : `${seconds / 60}분`;
}

function sunjaeResultImage(score: number): string {
  if (score >= 80) return sunjaePraiseImage;
  if (score >= 60) return 'assets/theme/sunjae/wooseok-cafe.jpg';
  return sunjaeEncourageImage;
}

function sunjaeResultTitle(score: number): string {
  if (score >= 80) return '진짜 잘했어. 역시 너라면 해낼 줄 알았어!';
  if (score >= 60) return '합격이야. 끝까지 달려온 네가 멋져.';
  return '괜찮아, 내가 옆에 있잖아.';
}

function sunjaeResultDetail(score: number): string {
  if (score >= 80) return '오늘 점수는 내가 자랑하고 싶을 정도야. 다음 회차도 나랑 같이 달리자.';
  if (score >= 60) return '아슬아슬했던 문제만 한 번 더 보면 다음에는 더 여유롭게 웃을 수 있을 거야.';
  return '틀린 문제만 나랑 다시 보자. 다음에는 분명 더 좋은 점수가 나올 거야.';
}

async function setVisualStyle(style: VisualStyle): Promise<void> {
  if (style === 'sunjae' && !isJewelry) return;
  if (style === visualStyle.value || visualTransitionPhase.value) return;
  visualTransitionTarget.value = style;
  settingsOpen.value = false;
  mobileMenuOpen.value = false;
  visualTransitionPhase.value = 'leaving';
  await waitForMotion(330);
  visualStyle.value = style;
  applyVisualStyle(style);
  restartSunjaeRotation();
  await nextTick();
  visualTransitionPhase.value = 'entering';
  await waitForMotion(style === 'simpsons' ? 690 : 600);
  visualTransitionPhase.value = null;
  showToast(style === 'simpsons'
    ? '심슨 테마 UI를 적용했습니다. 🍩'
    : style === 'sunjae' ? '선재 업고 튀어 테마를 적용했습니다. ☂' : '기본 CBT UI로 돌아왔습니다.');
}

function markOmrManualScroll(): void {
  omrManualScrollUntil = Date.now() + 1200;
}

function syncOmrToCurrentPage(): void {
  if (Date.now() < omrManualScrollUntil || !session.value || session.value.mode !== 'exam') return;
  const index = session.value.page * session.value.pageSize;
  const target = omrListRef.value?.querySelector<HTMLElement>(`[data-omr-index="${index}"]`);
  if (!target || !omrListRef.value) return;
  const listRect = omrListRef.value.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.top >= listRect.top && targetRect.bottom <= listRect.bottom) return;
  target.scrollIntoView({ block: 'nearest', behavior: motionAllowed.value ? 'smooth' : 'auto' });
}

function setFontScale(value: number): void {
  const normalized = Math.min(1.6, Math.max(.8, Math.round(value * 10) / 10));
  fontScale.value = normalized;
  studyStore.fontScale = normalized;
  document.documentElement.dataset.questionScale = normalized >= 1.3 ? 'large' : 'normal';
  document.documentElement.style.setProperty('--question-text-size', `${(.96 * normalized).toFixed(3)}rem`);
  document.documentElement.style.setProperty('--choice-text-size', `${(.86 * normalized).toFixed(3)}rem`);
  document.documentElement.style.setProperty('--explanation-text-size', `${(.9 * normalized).toFixed(3)}rem`);
  document.documentElement.style.setProperty('--question-number-size', `${(.95 * normalized).toFixed(3)}rem`);
}

function adjustFontScale(amount: number): void {
  setFontScale(fontScale.value + amount);
  showToast(`문자 크기 ${Math.round(fontScale.value * 100)}%`);
}

function handleUpdateAvailable(): void {
  updateAvailable.value = true;
}

function handlePwaRegistrationError(): void {
  pwaRegistrationError.value = true;
}

function handlePwaReady(): void {
  pwaRegistrationError.value = false;
}

async function fetchPublishedVersion(): Promise<string> {
  const response = await fetch(`./data/changelog-vue.js?update-check=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) throw new Error('version-check-failed');
  const source = await response.text();
  const scopePattern = new RegExp(`changelog\\.versions\\.${spaceScope}\\s*=\\s*['"]([^'"]+)['"]`);
  return source.match(scopePattern)?.[1] || '';
}

async function checkForUpdate(notify = true): Promise<void> {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
    if (notify) showToast('온라인 홈페이지에서 업데이트를 확인할 수 있습니다.');
    return;
  }
  updateChecking.value = true;
  try {
    const [publishedVersion, registration] = await Promise.all([
      fetchPublishedVersion(),
      navigator.serviceWorker.getRegistration(),
    ]);
    if (registration) {
      await registration.update();
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
    const serviceWorkerReady = Boolean(
      registration?.waiting
      || registration?.installing
      || window.CBT_UPDATE_AVAILABLE
    );
    if ((publishedVersion && publishedVersion !== currentVersion.value) || serviceWorkerReady) {
      updateAvailable.value = true;
      if (notify) showToast(`새 버전${publishedVersion ? ` v${publishedVersion}` : ''}을 찾았습니다. 신버전 적용을 눌러주세요.`);
    } else if (notify) {
      showToast(`현재 v${currentVersion.value} 최신 버전입니다.`);
    }
  } catch {
    if (notify) showToast('업데이트 확인에 실패했습니다. 인터넷 연결을 확인해 주세요.');
  } finally {
    updateChecking.value = false;
  }
}

function waitForServiceWorker(worker?: ServiceWorker | null, timeout = 12000): Promise<void> {
  if (!worker || worker.state === 'activated' || worker.state === 'redundant') return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.removeEventListener('statechange', handleState);
      resolve();
    };
    const handleState = (): void => {
      if (worker.state === 'activated' || worker.state === 'redundant') finish();
    };
    const timer = window.setTimeout(finish, timeout);
    worker.addEventListener('statechange', handleState);
  });
}

async function applyUpdate(): Promise<void> {
  saveActiveLearningSession();
  persistStudyStoreNow();
  if (cloudSyncState.email) {
    showToast('학습 기록을 동기화한 뒤 새 버전을 적용합니다.');
    await syncLearningData();
  }
  try {
    sessionStorage.setItem(openUpdatesAfterRefreshKey, 'true');
  } catch {
    // 사생활 보호 모드 등 sessionStorage가 막힌 환경에서는 현재 화면만 새로고침합니다.
  }
  if (location.protocol === 'file:' || !('serviceWorker' in navigator)) {
    location.reload();
    return;
  }
  updateChecking.value = true;
  showToast('업데이트 설치를 마친 뒤 자동으로 다시 엽니다.');
  try {
    if (window.CBT_APPLY_PWA_UPDATE) await window.CBT_APPLY_PWA_UPDATE(false);
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      await waitForServiceWorker(registration.installing || registration.waiting);
      await navigator.serviceWorker.ready;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    const url = new URL(location.href);
    url.searchParams.set('updated', String(Date.now()));
    location.replace(url.toString());
  } catch {
    updateChecking.value = false;
    pwaRegistrationError.value = true;
    showToast('업데이트 적용에 실패했습니다. 설정의 기록·동기화에서 복구 화면을 열어 주세요.');
  }
}

function openPwaRecovery(): void {
  if (isNativeApp) {
    showToast('Android 앱은 PWA 캐시 복구가 필요하지 않습니다. 홈페이지에서만 사용합니다.');
    return;
  }
  if (!confirm('학습 기록은 그대로 두고 CBT 캐시와 서비스워커만 정리할까요?')) return;
  location.href = `./recovery.html?return=${isJewelry ? 'jewelry.html' : 'index.html'}`;
}

function openPwaRecoveryFromError(): void {
  location.href = `./recovery.html?return=${isJewelry ? 'jewelry.html' : 'index.html'}`;
}

async function exportLearningData(): Promise<void> {
  const exams = await db.exams.toArray();
  const blob = new Blob([JSON.stringify({
    exportedAt: new Date().toISOString(),
    space: spaceScope,
    data: studyStore,
    indexedDb: { exams },
  }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${spaceScope}-cbt-learning-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('학습 기록 파일을 저장했습니다.');
}

function chooseLearningDataFile(): void {
  learningImportInput.value?.click();
}

async function importLearningData(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text()) as {
      space?: string;
      data?: Record<string, unknown>;
      store?: Record<string, unknown>;
      indexedDb?: { exams?: ExamRecord[] };
    };
    const source = payload.data || payload.store;
    if (!source || typeof source !== 'object' || !source.attempts || typeof source.attempts !== 'object') {
      throw new Error('invalid-backup');
    }
    if (payload.space && payload.space !== spaceScope) {
      throw new Error('wrong-space');
    }
    if (!confirm('현재 기기의 학습 기록을 이 백업 파일의 내용으로 교체할까요?')) return;

    Object.keys(studyStore.attempts).forEach((key) => delete studyStore.attempts[key]);
    Object.assign(studyStore.attempts, source.attempts);
    Object.keys(studyStore.wrong).forEach((key) => delete studyStore.wrong[key]);
    Object.assign(studyStore.wrong, source.wrong && typeof source.wrong === 'object' ? source.wrong : {});
    studyStore.bookmarks.splice(
      0,
      studyStore.bookmarks.length,
      ...(Array.isArray(source.bookmarks) ? source.bookmarks.filter((id): id is string => typeof id === 'string') : []),
    );
    studyStore.history.splice(
      0,
      studyStore.history.length,
      ...(Array.isArray(source.history) ? source.history as Array<Record<string, unknown>> : []),
    );
    Object.keys(studyStore.notes).forEach((key) => delete studyStore.notes[key]);
    Object.assign(studyStore.notes, source.notes && typeof source.notes === 'object' ? source.notes : {});
    studyStore.progress = source.progress && typeof source.progress === 'object'
      ? source.progress as Record<string, unknown>
      : {};
    if (typeof source.fontScale === 'number') setFontScale(source.fontScale);

    const attemptRows = Object.entries(studyStore.attempts).map(([id, row]) => ({ id, ...row }));
    await db.transaction('rw', db.attempts, db.exams, async () => {
      await db.attempts.clear();
      if (attemptRows.length) await db.attempts.bulkPut(attemptRows);
      if (Array.isArray(payload.indexedDb?.exams)) {
        await db.exams.clear();
        if (payload.indexedDb.exams.length) await db.exams.bulkPut(payload.indexedDb.exams);
      }
    });
    persistStudyStoreNow();
    await refreshExamHistory();
    settingsOpen.value = false;
    showToast(`${attemptRows.length.toLocaleString()}개 문제의 학습 기록을 불러왔습니다.`);
  } catch (error) {
    showToast(error instanceof Error && error.message === 'wrong-space'
      ? '현재 학습관과 종류가 다른 백업 파일입니다.'
      : '올바른 CBT 학습 기록 파일이 아닙니다.');
  } finally {
    input.value = '';
  }
}

async function clearLearningData(): Promise<void> {
  if (!confirm('오답, 진도, 시험 기록을 모두 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
  try {
    await clearCloudLearningState();
  } catch (error) {
    console.error('클라우드 기록 초기화 실패', error);
    showToast('클라우드 기록을 지우지 못해 초기화를 중단했습니다. 인터넷 연결을 확인해 주세요.');
    return;
  }
  Object.keys(studyStore.attempts).forEach((key) => delete studyStore.attempts[key]);
  Object.keys(studyStore.wrong).forEach((key) => delete studyStore.wrong[key]);
  studyStore.bookmarks.splice(0);
  studyStore.history.splice(0);
  Object.keys(studyStore.notes).forEach((key) => delete studyStore.notes[key]);
  studyStore.progress = {};
  studyStore.sync = { bookmarks: {} };
  const legacyExtras = studyStore as typeof studyStore & {
    questionTimes?: Record<string, unknown>;
    studyPlan?: unknown;
    studyPlans?: Record<string, unknown>;
  };
  legacyExtras.questionTimes = {};
  legacyExtras.studyPlan = null;
  legacyExtras.studyPlans = {};
  if (session.value) {
    session.value.answers = {};
    session.value.page = 0;
    session.value.finished = false;
  }
  suspendedSession = null;
  suspendedExamResult = null;
  await db.transaction('rw', db.attempts, db.exams, async () => {
    await db.attempts.clear();
    await db.exams.clear();
  });
  persistStudyStoreNow();
  Object.keys(practicalProgress).forEach((id) => delete practicalProgress[id]);
  Object.keys(practicalDrafts).forEach((id) => delete practicalDrafts[id]);
  localStorage.removeItem(practicalProgressStorageKey);
  recentExamRecords.value = [];
  scheduleLearningSync(100);
  settingsOpen.value = false;
  showToast('학습 기록을 초기화했습니다.');
}

function handleCloudSynced(): void {
  refreshSavedLearningSessionFromStore();
  refreshPracticalProgressFromCloud();
  void refreshExamHistory();
}

function subjectQuestionCount(subject: string): number {
  return selectedItems.value.filter((item) => item.subject === subject).length;
}

function roundProgress(round: Round): number {
  const ids = round.questions.map((question) => questionId(round, question));
  const answered = ids.filter((id) => studyStore.attempts[id]).length;
  return ids.length ? Math.round((answered / ids.length) * 100) : 0;
}

function roundAnswered(round: Round): number {
  return round.questions.filter((question) => studyStore.attempts[questionId(round, question)]).length;
}

function roundExamMinutes(round: Round): number {
  const rule = qualificationRuleFor(round.qualificationKey || selectedKey.value);
  if (rule?.scoring === 'total-only' && rule.totalQuestions) {
    return Math.max(1, Math.round(round.questions.length / rule.totalQuestions * rule.examMinutes));
  }
  return Math.round(round.questions.length * 1.5);
}

function isRestoredRound(round: Round): boolean {
  return round.qualificationKey === 'hvac' && round.year >= 2021;
}

watch([yearFrom, yearTo], () => {
  if (yearFrom.value > yearTo.value) [yearFrom.value, yearTo.value] = [yearTo.value, yearFrom.value];
});

watch(includeHansolInRandom, (enabled) => {
  localStorage.setItem('unified-cbt-random-include-hansol', String(enabled));
});

watch(() => session.value?.page, () => {
  void nextTick(syncOmrToCurrentPage);
});

watch(examResult, (result) => {
  window.clearTimeout(sunjaeResultHandle);
  window.clearTimeout(learningSessionSaveHandle);
  sunjaeResultHandle = 0;
  if (!result) {
    displayedResultScore.value = 0;
    sunjaeResultPhase.value = 'reveal';
    return;
  }
  if (uiLabActive.value && result.passed && uiLabMotion.value !== 'off' && !prefersReducedMotion.value) {
    void import('canvas-confetti').then(({ default: confetti }) => {
      confetti({
        particleCount: 72,
        spread: 68,
        origin: { y: .72 },
        disableForReducedMotion: true,
        colors: ['#1268d3', '#0b8f6a', '#ffd90f', '#e62f83'],
      });
    });
  }
  const revealScore = () => {
    sunjaeResultPhase.value = 'reveal';
    if (!motionAllowed.value) {
      displayedResultScore.value = result.score;
      return;
    }
    displayedResultScore.value = 0;
    void nextTick(() => {
      animate(0, result.score, {
        duration: 1.05,
        ease: [0.2, 0.8, 0.2, 1],
        onUpdate: (value) => { displayedResultScore.value = Math.round(value); },
      });
    });
  };
  if (visualStyle.value === 'sunjae' && motionAllowed.value) {
    sunjaeResultPhase.value = 'grading';
    displayedResultScore.value = 0;
    sunjaeResultHandle = window.setTimeout(revealScore, 1900);
  } else {
    revealScore();
  }
});

function markViewportResizing(): void {
  if (mobileMenuOpen.value && window.innerWidth > 820) mobileMenuOpen.value = false;
  if (!resizeAnimationFrame) {
    resizeAnimationFrame = window.requestAnimationFrame(() => {
      document.documentElement.dataset.resizing = 'true';
      resizeAnimationFrame = 0;
    });
  }
  window.clearTimeout(resizeSettleHandle);
  resizeSettleHandle = window.setTimeout(() => {
    delete document.documentElement.dataset.resizing;
  }, 220);
}

function closeNativeOverlays(): boolean {
  if (nativeCalculatorOpen.value) {
    nativeCalculatorOpen.value = false;
    return true;
  }
  if (settingsOpen.value) {
    settingsOpen.value = false;
    return true;
  }
  if (aiPromptOpen.value) {
    aiPromptOpen.value = false;
    return true;
  }
  if (nativeMoreOpen.value) {
    nativeMoreOpen.value = false;
    return true;
  }
  if (sessionMenuOpen.value) {
    sessionMenuOpen.value = false;
    return true;
  }
  if (mobileMenuOpen.value) {
    mobileMenuOpen.value = false;
    return true;
  }
  if (examSheetOpen.value) {
    examSheetOpen.value = false;
    return true;
  }
  if (examResult.value && session.value) {
    examResult.value = null;
    session.value.finished = false;
    return true;
  }
  return false;
}

async function handleNativeBackButton(): Promise<void> {
  if (closeNativeOverlays()) return;
  if(textbookReaderOpen.value&&!session.value){
    const picker=document.querySelector<HTMLDialogElement>('#textbook-navigator');
    if(picker?.open)picker.close();else closeTextbookReader();
    return;
  }
  if (practicalSolving.value) {
    if (practicalSessionActive.value) closePracticalMock();
    else openPracticalLibrary(practicalLibraryTab.value);
    return;
  }
  if (session.value) {
    await leaveSession();
    return;
  }
  if (view.value !== 'home') {
    openView('home');
    return;
  }
  await CapacitorApp.exitApp();
}

function syncNativeStatusBar(): void {
  if (document.documentElement.dataset.nativeApp !== 'true') return;
  void StatusBar.setStyle({ style: darkActive.value ? Style.Light : Style.Dark });
}

watch(darkActive, syncNativeStatusBar);
watch(view, next => {
  if (next === 'search') void prepareSearchScope();
});
watch([view, roundsCollection], ([next, collection]) => {
  if (next === 'rounds' && collection === 'cooling' && !isJewelry) void loadCoolingMidterm();
});
watch([theme, visualStyle], () => void nextTick(applyUiLabPreferences));

async function requestStudyGuide(): Promise<void> {
  try { await loadStudyGuide(); } catch { /* Inline retry keeps other screens usable. */ }
}
function retryStudyGuide(): void {
  // Browsers cache a rejected module import. A user-initiated reload resets that
  // cache; existing pagehide handling persists work and history restores this view.
  if (guideError.value) location.reload();
  else void requestStudyGuide();
}
watch(view, next => {
  if (next === 'guide') void requestStudyGuide();
});
watch([guideLoaded, practicalSessionActive, practicalSessionFinished], ([loaded, active, finished]) => {
  window.clearInterval(practicalTimerHandle);
  practicalTimerHandle = 0;
  if (!loaded || !active || finished) return;
  const tick = () => {
    practicalClock.value = Date.now();
    if (practicalSessionRemainingSeconds.value <= 0) finishPracticalMock(true);
  };
  tick();
  if (!practicalSessionFinished.value) practicalTimerHandle = window.setInterval(tick, 1000);
});

onMounted(async () => {
  try {
    for (const key of ['view', 'mouse-look', 'school-outfit', 'teacher-style', 'story-v1', 'ink-teacher-v1', 'ink-yuna-v1']) {
      localStorage.removeItem(`cbt-campus-${key}`);
    }
  } catch { /* local storage may be disabled */ }
  window.addEventListener('cbt:update-available', handleUpdateAvailable);
  window.addEventListener('cbt:pwa-error', handlePwaRegistrationError);
  window.addEventListener('cbt:pwa-ready', handlePwaReady);
  window.addEventListener('popstate', handleBrowserHistory);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('resize', markViewportResizing, { passive: true });
  window.addEventListener('keydown', handleSessionKeydown);
  window.addEventListener('cbt:cloud-synced', handleCloudSynced);
  if (document.documentElement.dataset.nativeApp === 'true') {
    nativeBackHandle = await CapacitorApp.addListener('backButton', () => { void handleNativeBackButton(); });
    syncNativeStatusBar();
  }
  initializeNavigationHistory();
  // Resume an existing timed practice even when the home screen opens first.
  if (view.value === 'guide' || practicalSessionActive.value) void requestStudyGuide();
  applyTheme(theme.value);
  applyVisualStyle(visualStyle.value);
  applyDynamicUiPreference(dynamicUiEnabled.value);
  if (showAndroidApkPopup) {
    try {
      if (sessionStorage.getItem(androidApkPopupSeenKey) !== 'true') {
        androidApkPopupOpen.value = true;
        sessionStorage.setItem(androidApkPopupSeenKey, 'true');
      }
    } catch {
      androidApkPopupOpen.value = true;
    }
  }
  restartSunjaeRotation();
  motionMediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
  motionPreferenceHandler = (event: MediaQueryListEvent) => { prefersReducedMotion.value = event.matches; };
  motionMediaQuery.addEventListener?.('change', motionPreferenceHandler);
  motionMediaQuery.addListener?.(motionPreferenceHandler);
  setFontScale(fontScale.value);
  setDefaultYears(selectedCatalog.value.isVirtual ? 0 : 10);
  try {
    await hydrateIndexedDb();
    await refreshExamHistory();
  } catch (error) {
    console.error('학습 기록을 불러오지 못했습니다.', error);
    showToast('저장된 학습 기록을 불러오지 못했지만 문제 풀이는 계속할 수 있습니다.');
  } finally {
    appHydrating.value = false;
  }
  void initializeCloudSync();
  await nextTick();
  animateViewDetails(view.value);
});

const settingsValues = computed<SettingsValues>(() => ({
  mobileModel: allowMobileModel.value, theme: theme.value, fontScale: fontScale.value, fontFamily: fontFamilyPreference.value,
  visualStyle: visualStyle.value, display: displayPreference.value, dynamic: dynamicUiEnabled.value,
  solveLayout: solveLayoutMode.value, answerLayout: answerLayout.value, indicator: hotspotIndicator.value,
  imageTheme: restoredImageTheme.value, explanationDisplay: explanationDisplay.value, experimental: experimentalFeaturesEnabled.value,
  judgment: questionJudgmentEnabled.value, rotation: sunjaeRotationSeconds.value,
}));
const settingsContext = computed(() => ({ pwaRegistrationError: pwaRegistrationError.value, jewelry: isJewelry, native: isNativeApp, session: Boolean(session.value)||textbookReaderOpen.value,
  exam: session.value?.mode === 'exam', omr: examSheetOpen.value, version: currentVersion.value,
  displayLabel: resolvedDisplayMode === 'mobile' ? '모바일·태블릿' : 'PC',
}));
function changeSetting(change: SettingChange): void {
  switch (change.key) {
    case 'mobileModel': setMobileModel(change.value); break;
    case 'theme': theme.value = change.value; applyTheme(change.value); break;
    case 'fontScale': setFontScale(change.value); break;
    case 'fontFamily': setFontFamilyPreference(change.value); break;
    case 'visualStyle': void setVisualStyle(change.value); break;
    case 'display': setDisplayPreference(change.value); break;
    case 'dynamic': setDynamicUiEnabled(change.value); break;
    case 'solveLayout': setSolveLayoutMode(change.value); break;
    case 'answerLayout': setAnswerLayout(change.value); break;
    case 'indicator': setHotspotIndicator(change.value); break;
    case 'imageTheme': setRestoredImageTheme(change.value); break;
    case 'explanationDisplay': setExplanationDisplay(change.value); break;
    case 'experimental': setExperimentalFeatures(change.value); break;
    case 'judgment': setQuestionJudgmentEnabled(change.value); break;
    case 'rotation': setSunjaeRotationSeconds(change.value); break;
  }
}
function settingsAction(action: SettingsAction): void {
  switch (action) {
    case 'close':
      if (settingsOpen.value) settingsOpen.value = false;
      else if (view.value === 'settings') openView(settingsReturnView.value);
      break;
    case 'full':
      if (session.value || textbookReaderOpen.value) settingsExpanded.value = true;
      else { settingsOpen.value = false; openView('settings'); }
      break;
    case 'tour': void startUiTour(); break;
    case 'beta': settingsOpen.value = false; openView('beta'); break;
    case 'recovery': openPwaRecovery(); break;
    case 'export': void exportLearningData(); break;
    case 'import': chooseLearningDataFile(); break;
    case 'reset': void clearLearningData(); break;
    case 'omr': examSheetOpen.value = !examSheetOpen.value; break;
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('cbt:update-available', handleUpdateAvailable);
  window.removeEventListener('cbt:pwa-error', handlePwaRegistrationError);
  window.removeEventListener('cbt:pwa-ready', handlePwaReady);
  window.removeEventListener('popstate', handleBrowserHistory);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('resize', markViewportResizing);
  window.removeEventListener('keydown', handleSessionKeydown);
  window.removeEventListener('cbt:cloud-synced', handleCloudSynced);
  void nativeBackHandle?.remove();
  if (motionMediaQuery && motionPreferenceHandler) {
    motionMediaQuery.removeEventListener?.('change', motionPreferenceHandler);
    motionMediaQuery.removeListener?.(motionPreferenceHandler);
  }
  stopTimer();
  window.clearTimeout(toastHandle);
  window.clearTimeout(searchHandle);
  window.clearTimeout(resizeSettleHandle);
  window.cancelAnimationFrame(resizeAnimationFrame);
  window.clearInterval(sunjaeRotationHandle);
  window.clearInterval(practicalTimerHandle);
  window.clearTimeout(sunjaeResultHandle);
  delete document.documentElement.dataset.resizing;
  searchWorker?.terminate();
});

const historyViewModel=proxyRefs({
openView, recentExamRecords, replayHistoryRecord, resumeSavedLearning, savedLearningSession, selectedCatalog,
});
export type HistoryViewModel=typeof historyViewModel;

const wrongViewModel=proxyRefs({
beginSession, displayedWrongItems, isCalculationItem, openView, restoredImageTheme, selectedCatalog, selectedWrongCalculationCount, studyStore, wrongAnswerDetailMap, wrongItems, wrongRoundFilter, wrongRoundGroups, wrongTypeFilter,
});
export type WrongViewModel=typeof wrongViewModel;

const examSessionViewModel=proxyRefs({
activateSessionItem, activeSessionItem, adjustFontScale, answerLayout, answeredCount, betaModeMeta, betaQuestionMeta, chooseAnswer, coolingSessionActive, currentItemColumns, darkActive, examPace, examSheetOpen, experimentalFeaturesEnabled, fontScale, formattedTime, goToNextKept, goToNextUnanswered, goToPage, goToQuestion, hotspotIndicator, isMidtermCalculation, isSubjectStart, jumpToLearningQuestion, keptCount, learningJumpNumber, leaveSession, markOmrManualScroll, omrFilter, omrRows, openCalculator, pageCount, panelCalculator, panelNotes, prepareAiQuestion, questionJudgmentEnabled, questionTransitionName, resetLearning, restoredImageTheme, selectedKey, session, sessionMenuOpen, sessionProgress, sessionQuestionMax, sessionSubjectNumber, sessionTitle, setFontScale, setQuestionConfidence, setQuestionMistakeReason, setQuestionStudyNote, setSessionPageSize, settingsOpen, solveLayoutMode, studyStore, submitExam, submitLearning, toggleBookmark, toggleKeep, toggleLightDark, unansweredCount,
setOmrListRef:(node:HTMLDivElement|null)=>{omrListRef.value=node;},
});
export type ExamSessionViewModel=typeof examSessionViewModel;

const gradeViewModel=proxyRefs({
displayedResultScore, examResult, leaveSession, officialRule, openResultWrongAnswers, responsiveImageAttrs, restoreOriginalImage, session, simpsonsKingSizeImage, simpsonsThemeImage, sunjaeGradingImage, sunjaeResultDetail, sunjaeResultImage, sunjaeResultPhase, sunjaeResultTitle, visualStyle,
});
export type GradeViewModel=typeof gradeViewModel;

const searchViewModel=proxyRefs({
  QuestionLibraryPreview,
  addSearchItemToSchool,
  beginSession,
  bookmarkRoundFilter,
  bookmarkRounds,
  bookmarkedCatalogItems,
  catalogs,
  displayedSearchResults,
  isJewelry,
  newSearchSetTitle,
  normalizedSchoolSubject,
  openView,
  prepareSearchScope,
  requestSearch,
  restoredImageTheme,
  schoolExamData,
  searchBookmarksOnly,
  searchCatalogKeys,
  searchError,
  searchLoading,
  searchQuery,
  searchReady,
  searchScope,
  searchScopeLabel,
  searchSetId,
  searchSubject,
  searchSubjects,
  searchTotal
});
export type SearchViewModel=typeof searchViewModel;

const calculationViewModel=proxyRefs({
  FormulaWorkbench,
  MathFormula,
  QuestionLibraryPreview,
  beginSession,
  calculationPage,
  calculationPagination,
  calculationResultFilter,
  calculationRoundFilter,
  calculationRounds,
  calculationRows,
  calculationSubjectFilter,
  calculationSubjects,
  calculationWrongRows,
  filteredCalculationRows,
  formulaRenderSamples,
  formulaWorkbenchOpen,
  hvacCalculatorMemory,
  hvacCalculatorMemoryGroups,
  hvacCalculatorSheetNotes,
  hvacFrequentFormulas,
  restoredImageTheme,
  selectedCatalog,
  startCalculationLearning,
  stripMarkup
});
export type CalculationViewModel=typeof calculationViewModel;

const guideViewModel=proxyRefs({
  MathFormula,
  PracticalCalculationLesson,
  PracticalCalculationLibrary,
  PracticalFractionLines,
  PracticalIssueReport,
  PracticalLoadMore,
  PracticalProblemImage,
  PracticalSearchLibrary,
  PracticalTrainingTools,
  activeStudyGuide,
  calculationLesson,
  changePracticalPage,
  closePracticalMock,
  finishPracticalMock,
  formatPracticalSession,
  formatPracticalTime,
  hasPracticalProgress,
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
  resetPracticalPrompt,
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
  visiblePracticalPrompts
});
export type GuideViewModel=typeof guideViewModel;

const coachViewModel=proxyRefs({
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
  yearTo
});
export type CoachViewModel=typeof coachViewModel;

const betaViewModel=proxyRefs({
  betaFalseConfidenceRows,
  betaLowConfidenceRows,
  betaMemoRows,
  betaModeFilter,
  betaModeSummaries,
  betaReasonRows,
  betaWeakRows,
  settingsOpen,
  startBetaReview,
  startBetaTrial
});
export type BetaViewModel=typeof betaViewModel;

const showcaseViewModel=proxyRefs({
  answerLayout,
  applyTheme,
  currentVersion,
  darkActive,
  dynamicUiEnabled,
  isJewelry,
  openCalculator,
  openHvacPracticalGuide,
  openQualificationRounds,
  openTextbookPages,
  openView,
  patchEntries,
  pluginExperiences,
  responsiveImageAttrs,
  restoreOriginalImage,
  restoredDarkPreviewImage,
  restoredImageTheme,
  searchBookmarksOnly,
  setAnswerLayout,
  setDynamicUiEnabled,
  setHotspotIndicator,
  setRestoredImageTheme,
  setSolveLayoutMode,
  settingsOpen,
  simpsonsThemeImage,
  solveLayoutMode,
  startFeatureRound,
  theme,
  toggleLightDark,
  upscaleComparison,
  upscalePreview,
  upscalePreviewKind
});
export type ShowcaseViewModel=typeof showcaseViewModel;

const statsViewModel=proxyRefs({
  selectedCatalog,
  stats,
  subjectStats
});
export type StatsViewModel=typeof statsViewModel;

const patchViewModel=proxyRefs({
  androidApkUrl,
  checkForUpdate,
  currentVersion,
  openView,
  patchEntries,
  resumeSavedLearning,
  savedLearningSession,
  showAndroidApkPatchDownload,
  spaceName,
  updateChecking
});
export type PatchViewModel=typeof patchViewModel;
</script>

<template>
  <div
    v-if="!session && !textbookReaderOpen"
    class="app-frame"
    :style="themeBackdropStyle"
    :class="{
      'practical-solving': practicalSolving,
      'visual-style-leaving': visualTransitionPhase === 'leaving',
      'visual-style-entering': visualTransitionPhase === 'entering',
      'style-to-simpsons': visualTransitionTarget === 'simpsons',
      'style-to-sunjae': visualTransitionTarget === 'sunjae',
      'style-to-default': visualTransitionTarget === 'default',
      'experience-home-leaving': experienceTransitionPhase === 'home-leaving',
      'experience-home-entering': experienceTransitionPhase === 'home-entering',
    }"
  >

    <Teleport to="body" :disabled="!mobileMenuOpen">
    <aside v-if="!practicalSolving" :key="mobileMenuOpen ? 'mobile-open' : 'site-menu'" class="sidebar" :style="sidebarThemeStyle" :class="{ open: mobileMenuOpen }" @keydown.esc.stop="mobileMenuOpen = false">
      <button v-if="mobileMenuOpen" type="button" class="mobile-menu-close" aria-label="메뉴 닫기" @click="mobileMenuOpen = false">메뉴 닫기 ×</button>
      <img  v-if="visualStyle === 'simpsons'" class="sidebar-background-photo simpsons-sidebar-background-photo" v-bind="responsiveImageAttrs(simpsonsKingSizeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsKingSizeImage)" alt="">
      <img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-sidebar-background-${currentSunjaeImage}`" class="sidebar-background-photo sunjae-sidebar-background-photo" v-bind="responsiveImageAttrs(currentSunjaeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(currentSunjaeImage)" alt="">
      <button class="brand" type="button" @click="openView('home')">
        <span><img  v-if="visualStyle === 'sunjae'" :key="`sunjae-brand-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(currentSunjaeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(currentSunjaeImage)" alt=""><img  v-else-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsKingSizeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsKingSizeImage)" alt=""><template v-else>{{ isJewelry ? 'GEM' : 'CBT' }}</template></span>
        <div><strong>{{ spaceName }}</strong><small>{{ visualStyle === 'simpsons' ? 'SPRINGFIELD STUDY' : visualStyle === 'sunjae' ? 'LOVELY RUNNER STUDY' : isJewelry ? 'JEWELRY STUDY' : 'SMART STUDY' }}</small></div>
      </button>
      <figure v-if="visualStyle === 'simpsons'" class="theme-sidebar-feature simpsons-sidebar-feature">
        <img  v-bind="responsiveImageAttrs(simpsonsKingSizeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsKingSizeImage)" alt="꽃무늬 옷을 입은 킹 사이즈 호머 심슨">
        <figcaption><strong>KING-SIZE HOMER</strong><small>공부할 준비부터 하자!</small></figcaption>
      </figure>
      <figure v-else-if="visualStyle === 'sunjae'" class="theme-sidebar-feature sunjae-sidebar-feature">
        <Transition name="sunjae-photo-fade" mode="out-in">
          <img  :key="`sunjae-sidebar-${currentSunjaeImage}`" v-bind="responsiveImageAttrs(currentSunjaeImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(currentSunjaeImage)" alt="선재 테마 메뉴의 류선재·변우석 사진">
        </Transition>
        <figcaption><strong>오늘도 나랑 같이 달릴래?</strong><small>{{ sunjaeRotationSeconds ? `${sunjaeRotationLabel(sunjaeRotationSeconds)}마다 내가 찾아올게` : '오늘은 이 모습으로 기다릴게' }}</small></figcaption>
      </figure>
      <nav>
        <button :class="{ active: view === 'home' }" @click="openView('home')"><span data-theme-symbol="⌂"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-grin" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(0), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(0))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-home-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><i v-else class="study-menu-icon menu-home" aria-hidden="true" /></span>홈</button>
        <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span data-theme-symbol="▤"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-cool" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(1), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(1))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-rounds-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-night" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><i v-else class="study-menu-icon menu-rounds" aria-hidden="true" /></span>회차별 문제</button>
        <button v-if="!isJewelry" :class="{ active: view === 'school' }" @click="openView('school')"><span data-theme-symbol="✎"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(6), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(6))" alt=""><i v-else class="study-menu-icon menu-school" aria-hidden="true" /></span>학교 시험 준비</button>
        <button :class="{ active: view === 'history' }" @click="openView('history')"><span data-theme-symbol="◴"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-exercise" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(8), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(8))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-history-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(3), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(3))" alt=""><i v-else class="study-menu-icon menu-history" aria-hidden="true" /></span>학습 내역</button>
        <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span data-theme-symbol="!"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-phone" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(2), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(2))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-wrong-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-sad" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(2), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(2))" alt=""><i v-else class="study-menu-icon menu-wrong" aria-hidden="true" /></span>오답노트 <b v-if="stats.wrong">{{ stats.wrong }}</b></button>
        <button :class="{ active: view === 'search' }" @click="openView('search')"><span data-theme-symbol="⌕"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-bart" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(3), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(3))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-search-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(3), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(3))" alt=""><i v-else class="study-menu-icon menu-search" aria-hidden="true" /></span>문제 검색</button>
        <button :class="{ active: view === 'calculation' }" @click="openView('calculation')"><span data-theme-symbol="∑"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(4), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(4))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-calculation-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><i v-else class="study-menu-icon menu-calculation" aria-hidden="true" /></span>계산문제만 풀기</button>
        <button v-if="studyGuideAvailable" :class="{ active: view === 'guide' }" @click="openView('guide')"><span data-theme-symbol="▣"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-hardhat" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(5), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(5))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-guide-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><i v-else class="study-menu-icon menu-guide" aria-hidden="true" /></span>시험 자료실</button>
        <button class="coach-nav-button" :class="{ active: view === 'coach' }" @click="openView('coach')"><span data-theme-symbol="✦"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-burns" v-bind="responsiveImageAttrs(simpsonsBurnsImage, '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsBurnsImage)" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-coach-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(2), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(2))" alt=""><i v-else class="study-menu-icon menu-coach" aria-hidden="true" /></span>합격 엔진</button>
        <button v-if="experimentalFeaturesEnabled" class="beta-nav-button" :class="{ active: view === 'beta' }" @click="openView('beta')"><span data-theme-symbol="β"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(6), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(6))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-beta-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><i v-else class="study-menu-icon menu-beta" aria-hidden="true" /></span>베타 학습 도구</button>
        <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span data-theme-symbol="▥"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character crop-bart" v-bind="responsiveImageAttrs(simpsonsThemeImage, '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsThemeImage)" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-stats-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(3), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(3))" alt=""><i v-else class="study-menu-icon menu-stats" aria-hidden="true" /></span>학습 분석</button>
        <button :class="{ active: view === 'updates' }" @click="openView('updates')"><span data-theme-symbol="◷"><img  v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-exhausted" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(7), '64px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(7))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-updates-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-night" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), '64px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><i v-else class="study-menu-icon menu-updates" aria-hidden="true" /></span>패치노트</button>
      </nav>
      <a class="space-portal" :href="$problemImage(isJewelry ? 'index.html' : 'jewelry.html')">
        <span>{{ isJewelry ? 'CBT' : '◇' }}</span>
        <div><strong>{{ isJewelry ? '산업기사 CBT' : '보석관' }}</strong><small>독립 학습 페이지로 이동</small></div>
        <b>›</b>
      </a>
      <div class="sidebar-foot">
        <button type="button" @click="openCalculator"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(4), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(4))" alt=""><template v-else>▦</template></span>공학용 계산기</button>
        <button type="button" :class="{ active: view === 'settings' }" @click="openView('settings')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsBurnsImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsBurnsImage)" alt=""><template v-else>⚙</template></span>전체 설정</button>
      </div>
    </aside>
    <button v-if="mobileMenuOpen" class="mobile-backdrop" aria-label="메뉴 닫기" @click="mobileMenuOpen = false" />
    </Teleport>

    <main class="main-area" :inert="mobileMenuOpen">
      <header v-if="!practicalSolving" class="topbar">
        <button class="menu-button" type="button" aria-label="메뉴 열기" @click="mobileMenuOpen = true">☰ <span>메뉴</span></button>
        <div class="topbar-context">
          <strong>{{ viewTitle }}</strong>
          <NavigationMount :subject="{groups:qualificationGroups,selected:selectedKey,name:selectedCatalog.name,onSelect:changeContextQualification}"/>
        </div>
        <div class="top-actions">
          <button type="button" aria-label="문제 검색 열기" @click="openView('search')">⌕ <span>검색</span></button>
          <button type="button" aria-label="공학용 계산기 열기" @click="openCalculator">▦ <span>계산기</span></button>
          <button type="button" class="theme-quick-button" :aria-label="darkActive ? '라이트 모드로 전환' : '다크 모드로 전환'" @click="toggleLightDark">{{ darkActive ? '☀' : '☾' }} <span>{{ darkActive ? '라이트 모드' : '다크 모드' }}</span></button>
          <button v-if="view !== 'settings'" type="button" aria-label="설정 열기" @click="settingsOpen = true">⚙ <span>설정</span></button>
        </div>
      </header>
      <RoundsLoading v-if="pendingQualification" :percent="qualificationLoadPercent" />
      <p v-if="scopeError && selectedCatalog.isPlaceholder && !(view==='rounds' && textbookPagesOpen)" role="alert">{{scopeError}} <button type="button" @click="loadCurrentScope">다시 불러오기</button></p>
      <p v-if="qualificationLoadError" role="alert">{{ qualificationLoadError }}</p>

      <div class="page-content" :class="{ 'mobile-book-navigation': resolvedDisplayMode === 'mobile' && view === 'rounds' && textbookPagesOpen }">
        <p v-if="selectedKey === 'maintenance-engineer' && !session" class="qualification-scope-notice" role="note">설비보전기사 수록 범위: 2006~2022년 공개 기출 27회차. 2022년 4과목과 이전 5과목을 구분합니다. 2025년부터 개편된 현행 과목과는 다르며, 최신 시험 준비 시 출제기준을 함께 확인하세요.</p>
        <p v-if="selectedKey === 'safety-engineer' && !session" class="qualification-scope-notice" role="note">산업안전기사 2018~2022년 구 6과목 기출. 현행 모의시험이 아니며, 법령 문항의 답은 출제 당시 기준일 수 있습니다. <a href="https://safetygwajang.com/?audience=jobseeker" target="_blank" rel="noopener noreferrer">회차 자료: 안전과장</a></p>
        <div v-if="showHydrationSkeleton" class="dashboard-skeleton" aria-label="학습 화면을 준비하는 중">
          <i class="skeleton-title" /><i /><i /><i /><i class="skeleton-wide" />
        </div>
        <Transition v-else :name="viewTransitionName" mode="out-in" @after-enter="animateViewDetails(view)">
          <div :key="view" class="view-stage" :class="{ 'sunjae-fan-dashboard': visualStyle === 'sunjae' && view === 'home', 'simpsons-fan-dashboard': visualStyle === 'simpsons' && dynamicUiEnabled && view === 'home' }">
        <StudySettings v-if="view === 'settings'" mode="page" :values="settingsValues" :context="settingsContext" @change="changeSetting" @action="settingsAction">
          <template #account><CloudSyncPanel description="로그인 없이도 공부할 수 있습니다. 다른 기기와 기록을 연결할 때만 로그인하세요." /></template>
        </StudySettings>
        <template v-else-if="view === 'home'">
          <StudyHomeMount v-if="visualStyle === 'default'" :model="reactHome" />

          <ThemeStudyCover v-if="visualStyle==='simpsons'||visualStyle==='sunjae'" :style-name="visualStyle"
            :subject="selectedKey" :subject-name="selectedCatalog.name" :jewelry="isJewelry"
            :portrait="visualStyle==='sunjae'?currentSunjaeImage:simpsonsKingSizeImage"
            :answered="stats.answered" :accuracy="stats.accuracy" @rounds="openView('rounds')" @secondary="isJewelry?openView('wrong'):openTextbookPages()" @settings="settingsOpen=true" />
          <section v-if="visualStyle === 'sunjae' && dynamicUiEnabled" class="sunjae-fan-home">
            <div class="sunjae-fan-workspace">
              <section class="sunjae-qualification-album">
                <header><div><span>01 · PICK OUR COURSE</span><h2>오늘 나랑 어떤 종목 달릴래?</h2></div><p>사진을 넘기듯 골라봐. 고르면 내가 공부 범위를 바로 바꿔줄게.</p></header>
                <div class="sunjae-album-track">
                  <button v-for="(catalog, catalogIndex) in catalogs" :key="catalog.key" type="button" :class="{ selected: selectedKey === catalog.key }" @click="selectQualification(catalog.key)">
                    <img  v-bind="responsiveImageAttrs(sunjaeImageAt(catalogIndex + 1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaeImageAt(catalogIndex + 1))" alt="">
                    <span>{{ selectedKey === catalog.key ? '우리 오늘 이거 하자' : '같이 골라볼래?' }}</span>
                    <strong>{{ catalog.name }}</strong>
                    <small>{{ catalog.roundCount ?? catalog.rounds.length }}회차 · {{ catalogDisplayQuestionCount(catalog).toLocaleString() }}문제</small>
                  </button>
                </div>
              </section>

              <section class="sunjae-study-ticket">
                <div class="sunjae-ticket-photo"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt="공부 계획을 함께 고르는 선재"><p><strong>범위는 내가 정리해둘게.</strong><span>너는 시작 버튼만 눌러. 나랑 끝까지 가자.</span></p></div>
                <div class="sunjae-ticket-controls">
                  <header><span>02 · MAKE OUR PLAN</span><h2>우리 오늘 공부 약속</h2></header>
                  <div class="sunjae-ticket-presets"><button :class="{ active: quickPreset === 5 }" @click="applyPreset(5)">최근 5년</button><button :class="{ active: quickPreset === 10 }" @click="applyPreset(10)">최근 10년</button><button :class="{ active: quickPreset === 0 }" @click="applyPreset(0)">전체</button></div>
                  <div class="sunjae-ticket-fields">
                    <label><span>종목</span><select :value="selectedKey" @change="updateQualificationFromSetup"><option v-for="catalog in catalogs" :key="catalog.key" :value="catalog.key">{{ catalog.name }}</option></select></label>
                    <label><span>시작</span><select v-model.number="yearFrom"><option v-for="year in [...availableYears].reverse()" :key="year" :value="year">{{ year }}년</option></select></label>
                    <label><span>끝</span><select v-model.number="yearTo"><option v-for="year in availableYears" :key="year" :value="year">{{ year }}년</option></select></label>
                    <label><span>출제 체계</span><select v-model="curriculum"><option value="all-mapped">{{ selectedCatalog.isVirtual ? '통폐합 목표 과목 · 유사 보강 포함' : ((selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? '통합 3과목 · 구문제 포함' : (selectedKey === 'information-engineer' ? '현행 5과목 · 구문제 연결' : '전체 기출문제 포함')) }}</option><option v-if="!selectedCatalog.isVirtual" value="current">{{ selectedKey === 'maintenance-engineer' ? '수록 최신 4과목 · 2022년' : '현재 과목 체계만' }}</option><option v-if="selectedKey === 'hvac' || selectedKey === 'hvac-hansol'" value="legacy-original">구 4과목 원형</option><option v-if="selectedKey === 'information-engineer' || selectedKey === 'maintenance-engineer'" value="legacy-original">구 5과목 원형</option></select></label>
                  </div>
                  <div class="sunjae-ticket-summary"><span><b>{{ yearFrom }}~{{ yearTo }}</b>년</span><span><b>{{ rangeRounds.length }}</b>회차</span><span><b>{{ selectedItems.length.toLocaleString() }}</b>문제</span></div>
                </div>
              </section>

              <section class="sunjae-choose-together">
                <header><span>03 · WHAT SHALL WE DO?</span><h2>오늘 나랑 뭐 할래?</h2><p>네가 고르면 바로 옆에서 같이 시작할게.</p></header>
                <div>
                  <button type="button" @click="startRangeLearning"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><span>천천히 같이 보자</span><strong>학습모드</strong><small>즉시 채점 · 쉬운 해설</small></button>
                  <button type="button" @click="startRandomLearning60"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><span>오늘은 딱 60문제</span><strong>랜덤 60문제</strong><small>과목 균형 · 자동 이어하기</small></button>
                  <button type="button" @click="startBalancedExam"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><span>내가 채점해줄게</span><strong>랜덤시험</strong><small>과목 균형 · OMR · 타이머</small></button>
                  <button type="button" @click="openView('rounds')"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(2))" alt=""><span>원하는 날을 골라</span><strong>회차별 문제</strong><small>{{ yearFrom }}~{{ yearTo }}년</small></button>
                  <button type="button" @click="openView('wrong')"><img  v-bind="responsiveImageAttrs(sunjaePortraitImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(3))" alt=""><span>이번엔 같이 맞히자</span><strong>오답만 보기</strong><small>{{ stats.wrong.toLocaleString() }}문제 기다리는 중</small></button>
                </div>
              </section>

              <section class="sunjae-memory-wall">
                <div><span>04 · OUR RECORD</span><h2>우리 같이 달린 만큼</h2><p>오늘도 여기까지 온 거, 내가 다 기억하고 있어.</p><div class="progress-track"><i :style="{ width: `${stats.coverage}%` }" /></div><strong>{{ stats.coverage }}%</strong></div>
                <dl><div><dt>전체</dt><dd>{{ stats.total.toLocaleString() }}</dd></div><div><dt>푼 문제</dt><dd>{{ stats.answered.toLocaleString() }}</dd></div><div><dt>맞힌 문제</dt><dd>{{ stats.correct.toLocaleString() }}</dd></div><div><dt>북마크</dt><dd>{{ stats.bookmarks.toLocaleString() }}</dd></div></dl>
                <img  v-bind="responsiveImageAttrs(sunjaeImageAt(8), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaeImageAt(8))" alt="학습 기록 옆의 변우석 사진">
              </section>

              <section class="sunjae-release-note" :class="{ ready: updateAvailable }"><span>{{ updateAvailable ? '새 소식이 왔어' : `지금은 v${currentVersion} 최신이야` }}</span><strong>{{ updateAvailable ? '내가 새 화면을 준비했어. 같이 보러 갈래?' : '업데이트도 내가 확인해둘게.' }}</strong><div><button v-if="updateAvailable" @click="applyUpdate">새 버전 적용</button><button v-else :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '업데이트 확인' }}</button><button @click="openView('updates')">우리 기록 보기</button></div></section>
            </div>
          </section>

          <section v-if="visualStyle !== 'default' && (visualStyle !== 'sunjae' || !dynamicUiEnabled)" class="qualification-section">
            <div class="section-title">
              <div>

                <h1>종목 선택</h1>
                <p>종목을 누르면 회차와 문제를 볼 수 있습니다.</p>
              </div>
              <div class="compact-stats">
                <span>학습<strong>{{ stats.answered.toLocaleString() }}</strong></span>
                <span>정답률<strong>{{ stats.accuracy }}%</strong></span>
                <span>오답<strong>{{ stats.wrong.toLocaleString() }}</strong></span>
              </div>
            </div>
            <div class="subject-groups">
              <section v-for="group in qualificationGroups" :key="group.label" class="subject-group">
                <h3>{{ group.label }}</h3>
                <div class="qualification-grid">
              <button
                v-for="(catalog, catalogIndex) in group.items"
                :key="catalog.key"
                type="button"
                class="qualification-card"
                :class="[qualificationMeta[catalog.key]?.className, { selected: selectedKey === catalog.key }]"
                :aria-pressed="selectedKey === catalog.key"
                @click="selectQualification(catalog.key)"
              >
                <img  v-if="visualStyle === 'sunjae'" class="sunjae-card-photo" v-bind="responsiveImageAttrs(sunjaeImageAt(catalogIndex + 1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaeImageAt(catalogIndex + 1))" alt="">
                <img  v-else-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-card-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(catalogIndex), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(catalogIndex))" alt="">
                <span class="qualification-icon">{{ qualificationMeta[catalog.key]?.icon }}</span>
                <span class="qualification-copy">
                  <strong>{{ catalog.name }}</strong>
                  <small>{{ catalog.roundCount ?? catalog.rounds.length }}{{ catalog.key === 'energy-midterm' ? '주제' : '회차' }} · {{ catalogDisplayQuestionCount(catalog).toLocaleString() }}문제</small>
                  <em>{{ qualificationMeta[catalog.key]?.description }}</em>
                </span>
                <b aria-hidden="true">{{ selectedKey === catalog.key ? '✓' : '›' }}</b>
              </button>
            </div>
              </section>
            </div>
          </section>

          <section v-if="savedLearningSession" class="resume-learning-card">
            <div><span>자동 저장된 {{ savedLearningSession.mode === 'exam' ? 'CBT 시험' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ Object.keys(savedLearningSession.answers).length }} / {{ savedLearningSession.itemIds.length }}문제 풀이 · 다른 기기에서도 이어집니다</small></div>
            <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
            <button type="button" class="secondary" @click="clearSavedLearningSession">기록 지우기</button>
          </section>

          <section v-if="selectedCatalog.isPlaceholder" class="study-builder">
            <button ref="homeScopeTrigger" type="button" :disabled="scopeLoading" @click="loadCurrentScope">{{scopeLoading?'학습 범위를 불러오는 중…':'연도와 출제 체계 설정'}}</button>
          </section>
          <section v-else-if="(visualStyle !== 'sunjae' || !dynamicUiEnabled) && selectedKey !== SCHOOL_EXAM_CATALOG_KEY" class="study-builder">
            <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-builder-mascot" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(4), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(4))" alt="공부 계획을 확인하는 닥터 닉">
            <div class="builder-heading">
              <div><span>STUDY SETUP</span><h2>연도와 출제 체계를 정하세요</h2></div>
              <div class="preset-buttons">
                <button :class="{ active: quickPreset === 5 }" @click="applyPreset(5)">최근 5년</button>
                <button :class="{ active: quickPreset === 10 }" @click="applyPreset(10)">최근 10년</button>
                <button :class="{ active: quickPreset === 0 }" @click="applyPreset(0)">전체</button>
              </div>
            </div>

            <div class="builder-controls">
              <label class="qualification-control">
                <span>자격증 종목</span>
                <select :value="selectedKey" @change="updateQualificationFromSetup">
                  <option v-for="catalog in catalogs" :key="catalog.key" :value="catalog.key">{{ catalog.name }}</option>
                </select>
              </label>
              <label>
                <span>시작 연도</span>
                <select v-model.number="yearFrom">
                  <option v-for="year in [...availableYears].reverse()" :key="year" :value="year">{{ year }}년</option>
                </select>
              </label>
              <span class="range-arrow">→</span>
              <label>
                <span>끝 연도</span>
                <select v-model.number="yearTo">
                  <option v-for="year in availableYears" :key="year" :value="year">{{ year }}년</option>
                </select>
              </label>
              <label class="curriculum-control">
                <span>출제 체계</span>
                <select v-model="curriculum">
                  <option value="all-mapped">{{ selectedCatalog.isVirtual ? '통폐합 목표 과목 · 유사 보강 포함' : ((selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? '통합 3과목 · 구문제 포함' : '전체 기출문제 포함') }}</option>
                  <option v-if="!selectedCatalog.isVirtual" value="current">{{ selectedKey === 'maintenance-engineer' ? '수록 최신 4과목 · 2022년' : '현재 과목 체계만' }}</option>
                  <option v-if="selectedKey === 'hvac' || selectedKey === 'hvac-hansol'" value="legacy-original">구 4과목 원형</option>
                  <option v-if="selectedKey === 'information-engineer' || selectedKey === 'maintenance-engineer'" value="legacy-original">구 5과목 원형</option>
                </select>
              </label>
            </div>

            <div class="scope-summary">
              <div><span>선택 범위</span><strong>{{ yearFrom }}~{{ yearTo }}년</strong><small>{{ rangeRounds.length }}회차 사용</small></div>
              <div><span>출제 가능</span><strong>{{ selectedItems.length.toLocaleString() }}문제</strong><small>{{ officialRule?.scoring === 'total-only' ? `공식 ${officialExamQuestionCount}문제 구성` : '과목별 균형 출제' }}</small></div>
              <div><span>실전 구성</span><strong>{{ officialRule?.scoring === 'total-only' ? `${officialExamQuestionCount}문제` : `${selectedSubjects.length}과목 × 20문제` }}</strong><small>{{ officialRule?.note || '공식 기준 확인 필요' }}</small></div>
            </div>

            <p v-if="selectedCatalog.isVirtual" class="target-exam-note">
              보석감정사 옛 4과목은 현재 큐넷 4과목으로 직접 통폐합하고, 귀금속가공 3종목의 보석 관련 문항만 유사 보강으로 사용합니다. 실전 랜덤시험은 과목마다 직접 연계 15문제와 유사 보강 최대 5문제를 섞습니다.
            </p>

            <div class="subject-strip">
              <article v-for="(subject, index) in selectedSubjects" :key="subject">
                <span>{{ index + 1 }}과목</span>
                <strong>{{ subject }}</strong>
                <small>{{ subjectQuestionCount(subject).toLocaleString() }}문제</small>
              </article>
            </div>

            <label v-if="selectedKey === 'hvac'" class="hansol-random-toggle">
              <input v-model="includeHansolInRandom" type="checkbox">
              <span><strong>랜덤 문제에 한솔 섞기</strong><small>ON이면 현재 선택한 {{ yearFrom }}~{{ yearTo }}년에 해당하는 한솔 문제도 후보에 합치며, 같은 문제는 한 번만 남깁니다.</small></span>
              <i aria-hidden="true" />
            </label>

            <div class="start-actions">
              <button class="learning-start" type="button" @click="startRangeLearning">
                <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(1))" alt="">
                <span>차근차근 익히기</span><strong>선택 범위 학습모드</strong><small>한 화면 {{ preferredPageSize }}문제 · 즉시 채점 · 쉬운 해설</small>
              </button>
              <button class="random-learning-start" type="button" @click="startRandomLearning60">
                <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(8), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(8))" alt="">
                <span>연도 범위에서 골고루</span><strong>랜덤 60문제 학습</strong><small>{{ selectedKey === 'hvac' && includeHansolInRandom ? '일반 공조 + 한솔 후보' : (officialRule?.scoring === 'total-only' ? `공식 ${officialExamQuestionCount}문제 구성` : '과목 균형') }} · 즉시 채점 · 자동 이어하기</small>
              </button>
              <section v-if="selectedKey === 'hvac'" class="prediction-start-card">
                <header><div><span>0822 제보 + {{ includeHansolInRandom ? '일반·한솔' : '일반 공조' }} 반복 기출</span><strong>시험 예상 60문제</strong><small>제보 13문제 고정 · 유사 기출 47문제 랜덤 · 3과목 × 20문제</small></div><b>예상</b></header>
                <div class="prediction-range-options" aria-label="시험 예상 문제 연도 범위">
                  <button type="button" :class="{ active: predictionRange === 'selected' }" @click="predictionRange = 'selected'">현재 설정 {{ yearFrom }}~{{ yearTo }}</button>
                  <button type="button" :class="{ active: predictionRange === 'recent' }" @click="predictionRange = 'recent'">최근 10년</button>
                  <button type="button" :class="{ active: predictionRange === 'all' }" @click="predictionRange = 'all'">전회차 2002~2026</button>
                </div>
                <div class="prediction-mode-actions">
                  <button type="button" @click="startHvacPrediction60('learn')"><span>해설을 바로 보며</span><strong>예상 60 학습모드</strong></button>
                  <button type="button" @click="startHvacPrediction60('exam')"><span>OMR·타이머로</span><strong>예상 60 CBT</strong></button>
                </div>
                <p>출제를 보장하는 공식 예상문제가 아니라, 8월 22일 제보와 저장소의 반복 출제 개념을 우선한 시험 직전 훈련입니다.</p>
              </section>
              <button class="exam-start" type="button" @click="startBalancedExam">
                <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(5), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(5))" alt="">
                <span>실제 시험처럼</span><strong>{{ officialRule?.scoring === 'total-only' ? '공식 구성 랜덤시험' : '과목 균형 랜덤시험' }}</strong><small>{{ officialRule?.scoring === 'total-only' ? `${officialExamQuestionCount}문제` : '과목별 20문제' }}{{ selectedKey === 'hvac' && includeHansolInRandom ? ' · 한솔 후보 포함' : '' }} · OMR · 타이머</small>
              </button>
              <button class="round-start" type="button" @click="openView('rounds')">
                <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(7), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(7))" alt="">
                <span>연도 순서대로</span><strong>회차별 기출문제</strong><small>{{ yearFrom }}~{{ yearTo }}년 목록 보기</small>
              </button>
            </div>
          </section>

          <section v-if="(visualStyle !== 'sunjae' || !dynamicUiEnabled)" class="progress-panel">
            <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-progress-photo" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(6), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(6))" alt="심슨 가족의 운동 장면">
            <div>
              <span>현재 종목 학습률</span>
              <strong>{{ stats.coverage }}%</strong>
              <div class="progress-track"><i :style="{ width: `${stats.coverage}%` }" /></div>
            </div>
            <dl>
              <div><dt>전체 문제</dt><dd>{{ stats.total.toLocaleString() }}</dd></div>
              <div><dt>푼 문제</dt><dd>{{ stats.answered.toLocaleString() }}</dd></div>
              <div><dt>맞힌 문제</dt><dd>{{ stats.correct.toLocaleString() }}</dd></div>
              <div><dt>북마크</dt><dd>{{ stats.bookmarks.toLocaleString() }}</dd></div>
            </dl>
          </section>

          <section v-if="visualStyle !== 'sunjae' || !dynamicUiEnabled || pwaRegistrationError" class="home-release-card" :class="{ ready: updateAvailable }" :aria-label="pwaRegistrationError ? '오프라인 저장 상태' : undefined">
            <img  v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-release-photo" v-bind="responsiveImageAttrs(simpsonsBurnsImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsBurnsImage)" alt="손가락을 맞댄 번즈">
            <div class="home-release-icon">{{ updateAvailable ? '↻' : '✓' }}</div>
            <div>
              <span>{{ updateAvailable ? 'NEW VERSION READY' : pwaRegistrationError ? 'OFFLINE' : 'LATEST VERSION' }}</span>
              <strong>{{ updateAvailable ? '새 버전을 바로 적용할 수 있습니다' : pwaRegistrationError ? '오프라인 준비를 마치지 못했습니다' : `현재 v${currentVersion} 최신 버전을 사용 중입니다` }}</strong>
              <small v-if="pwaRegistrationError" role="status">온라인으로 계속 풀 수 있습니다. 설정의 ‘기록·동기화’에서도 복구 화면을 열 수 있습니다.</small>
              <small v-else>{{ updateAvailable ? '학습 기록은 유지되고 화면과 기능만 최신 상태로 바뀝니다.' : '새 업데이트가 있는지 언제든 다시 확인할 수 있습니다.' }}</small>
            </div>
            <div class="home-release-actions">
              <button v-if="pwaRegistrationError" type="button" @click="openPwaRecoveryFromError">자동 복구 열기</button>
              <button v-if="updateAvailable" type="button" class="apply" @click="applyUpdate">신버전 적용</button>
              <button v-else type="button" :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '업데이트 확인' }}</button>
              <button type="button" @click="openView('updates')">패치노트 보기</button>
            </div>
          </section>
        </template>
        <template v-else-if="view === 'school'">
          <button type="button" class="primary-button" @click="openTextbookPages">▤ 교재 페이지별로 풀기 · 한솔 공조 / 에너지</button>
          <section v-if="savedLearningSession?.qualificationKey === SCHOOL_EXAM_CATALOG_KEY && !coolingSavedSession" class="resume-learning-card">
            <div><span>자동 저장된 학교 시험 {{ savedLearningSession.mode === 'exam' ? 'CBT' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ Object.keys(savedLearningSession.answers).length }} / {{ savedLearningSession.itemIds.length }}문제 풀이</small></div>
            <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
          </section>
          <SchoolExamManager :data="schoolExamData" @update="updateSchoolExamData" @start="startSchoolExamRound" @start-set="startSchoolQuestionSet" @search="openSchoolSetSearch" />
        </template>

        <template v-else-if="view === 'rounds'">
          <NavigationMount v-if="!isJewelry" :material="{active:roundsCollection==='textbook'?1:roundsCollection==='cooling'?2:selectedKey==='energy-midterm'?3:0,
            actions:[openRegularRounds,openTextbookPages,()=>openQualificationRounds(SCHOOL_EXAM_CATALOG_KEY),()=>openQualificationRounds('energy-midterm')]}"/>
          <template v-if="roundsCollection === 'textbook' && !isJewelry">
            <section v-if="savedLearningSession?.itemIds.every(id=>!!bookForStudyId(id))" class="resume-learning-card"><div><strong>{{savedLearningSession.title}}</strong><small>저장된 교재 풀이</small></div><button @click="resumeSavedLearning">이어서 풀기</button></section>
            <TextbookLibrary :choosing="choosingTextbook" :pages="textbookModule" :book="textbookKey" :items="textbookItems" :loading="textbookLoading" :error="textbookError" @book="selectTextbook" @open="startTextbookReader" @retry="loadTextbookPages" />
          </template>
          <template v-else-if="roundsCollection === 'cooling' && !isJewelry">
            <section v-if="coolingSavedSession && savedLearningSession" class="resume-learning-card">
              <div><span>자동 저장된 중간고사 {{ savedLearningSession.mode === 'exam' ? 'CBT' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ Object.keys(savedLearningSession.answers).length }} / {{ savedLearningSession.itemIds.length }}문제 풀이</small></div>
              <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
            </section>
            <CoolingMidterm :items="coolingItems" :safety-items="coolingSafetyPool" :wrong-ids="coolingWrongIds" :attempted-ids="coolingItems.filter(item => studyStore.attempts[item.id]).map(item => item.id)" :unused-ids="coolingUnusedIds" :sessions="coolingArchive" :history="coolingCompleted" :loading="coolingLoading" :error="coolingError" @retry="loadCoolingMidterm" @search="openCoolingSearch" @start="startCoolingMidterm" @reset-draws="resetCoolingDraws" @resume="resumeCoolingArchived" @replay="id => { const record = coolingCompleted.find(item => item.id === id); if (record) replayHistoryRecord(record); }" />
          </template>
          <template v-else>
          <section v-if="selectedKey === 'energy-midterm' && savedLearningSession?.qualificationKey === 'energy-midterm'" class="resume-learning-card">
            <div><span>자동 저장된 에너지 중간고사 {{ savedLearningSession.mode === 'exam' ? 'CBT' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ Object.keys(savedLearningSession.answers).length }} / {{ savedLearningSession.itemIds.length }}문제 풀이</small></div>
            <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
          </section>
          <section class="rounds-heading">
            <div><span>{{ selectedKey === 'energy-midterm' ? 'MIDTERM PRACTICE' : 'PAST EXAMS' }}</span><h1>{{ selectedCatalog.name }}{{ selectedKey === 'energy-midterm' ? '' : ' 기출문제' }}</h1><p>{{ selectedKey === 'energy-midterm' ? `출제 메모의 ${visibleRounds.length}개 주제 · 관련 기출 ${energyMidtermQuestionCount}문제` : `수록된 전체 ${visibleRounds.length}회차` }}</p></div>
            <button type="button" @click="openView('home')">← 종목 선택으로</button>
          </section>
          <section v-if="selectedKey === 'energy-midterm'" class="energy-midterm-intro">
            <fieldset class="energy-source-picker">
              <legend>풀기 전에 문제 출처 선택</legend>
              <label><input v-model="energySourceMode" type="radio" value="textbook" name="energy-midterm-source">에너지 교재 문제</label>
              <label><input v-model="energySourceMode" type="radio" value="combined" name="energy-midterm-source">CBT + 에너지 교재</label>
              <p>{{ energySourceMode === 'textbook' ? '교재에 실린 원문 문제·보기·정답·해설로 풉니다.' : '이전에 사용하던 CBT 문제 목록과 문제·해설 방식 그대로 풉니다.' }} 선택은 새 풀이에만 적용하며, 풀던 문제와 기존 기록은 유지됩니다.</p>
            </fieldset>
            <p>출처를 고른 다음 아래 모음 또는 1~20번 주제로 풀면 됩니다. 현재 출처 {{ energyMidtermQuestionCount }}문제 중 계산 설정을 반영한 {{ energyMidtermEligibleQuestions.length }}문제가 선택됩니다. 오답·점수는 일반 기출과 분리됩니다.</p>
            <p class="energy-topic-note">같은 질문·같은 정답은 최신 회차만 출제하고 ‘나왔던 회차’를 표시합니다. 계산 수치·정답 내용이 다른 문제는 유지합니다.</p>
            <div class="energy-midterm-priority-grid energy-midterm-main-groups">
              <article>
                <h2>시험범위에 맞는 문제 <span>{{ energyMidtermDirectCount }}문제</span></h2>
                <p>교수님 출제 메모와 직접 대응하는 주제</p>
                <div class="energy-midterm-actions"><button type="button" aria-label="시험범위만 학습" @click="startEnergyMidterm('learn', true, false, 'direct')">학습모드</button><button type="button" aria-label="시험범위만 CBT" @click="startEnergyMidterm('exam', true, false, 'direct')">CBT 시험</button></div>
              </article>
              <article>
                <h2>추가 예상만 <span>{{ energyMidtermRelatedCount }}문제</span></h2><p>관련 주제·질문 취지가 불명확한 보강 문제</p>
                <div class="energy-midterm-actions"><button type="button" aria-label="추가 예상만 학습" @click="startEnergyMidterm('learn', true, false, 'related')">학습모드</button><button type="button" aria-label="추가 예상만 CBT" @click="startEnergyMidterm('exam', true, false, 'related')">CBT 시험</button></div>
              </article>
            </div>
            <div class="energy-midterm-actions energy-midterm-random-actions"><button type="button" @click="startEnergyMidterm('learn')">랜덤20문제 학습</button><button type="button" @click="startEnergyMidterm('exam')">랜덤20문제 CBT</button></div>
            <p class="energy-midterm-evidence-note">랜덤20은 시험범위+추가 예상에서 주제별1개씩 뽑습니다. 추가 예상을 빼려면 위의 ‘시험범위만’을 선택하세요.</p>
            <div class="energy-calculation-controls">
              <strong>계산 문제: {{ energyMidtermEligibleQuestions.filter(q => q.midtermCalculation).length }}개 포함</strong>
              <div><button type="button" @click="energyCalculationExcluded = [...energyDefaultCalculationExcluded]">기본 6번·11번</button><button type="button" @click="setAllEnergyCalculations(true)">계산 전체 On</button><button type="button" @click="setAllEnergyCalculations(false)">계산 전체 Off</button></div>
              <p>기본은6번 상당증발량·11번 스케줄번호만 On입니다. 랜덤20은 두 주제에서 계산을1개씩 뽑고, 전체·주제별 풀기도 체크 설정을 따릅니다. 2번 내부에너지 등 다른 주제의 계산은 개별 체크나 전체On으로 포함하세요. 새 풀이에만 적용하며 이어풀기 답안은 유지합니다.</p>
            </div>
            <details class="energy-calculation-review" @toggle="energyCalculationReviewOpen = ($event.target as HTMLDetailsElement).open">
              <summary>계산 문제만 보기 · 전체{{ energyCalculationReviewItems.length }}개</summary>
              <template v-if="energyCalculationReviewOpen">
                <p>분류 확인용입니다. 위의On/Off와 관계없이 모든 주제의 계산 문제를 표시합니다. 각 문항을 펼쳐 원문을 확인하세요. 답안·풀이 기록은 바뀌지 않습니다.</p>
                <details v-for="item in energyCalculationReviewItems" :key="item.id" class="energy-calculation-review-item">
                  <summary>{{ item.round.title }} · {{ item.question.sourcePage?.split(' · ')[0] }}</summary>
                  <QuestionCard :item="item" mode="exam" :display-number="item.question.number" :restored-image-theme="restoredImageTheme" />
                </details>
              </template>
            </details>
            <details class="energy-midterm-subgroups"><summary>기존4개 묶음을 각각 풀기</summary>
            <div class="energy-midterm-priority-grid">
              <article v-for="group in energyMidtermPriorityGroups" :key="group.key">
                <h2>{{ group.title }} <span>{{ group.count }}문제</span></h2><p>{{ group.note }}</p>
                <div class="energy-midterm-actions"><button type="button" @click="startEnergyMidterm('learn', true, false, undefined, group.key)">{{ group.title }} 학습</button><button type="button" @click="startEnergyMidterm('exam', true, false, undefined, group.key)">{{ group.title }} CBT</button></div>
              </article>
            </div>
            </details>
            <details class="energy-midterm-other-actions"><summary>전체 함께 풀기·교재·PDF 선택</summary>
            <p>20문제는 실제 시험 문항 수이며 예상문제 수 제한이 아닙니다. 랜덤20은 전체20주제에서 각각1개씩 뽑습니다. 실제 출제를 보장하지 않습니다.</p>
            <div class="energy-midterm-actions">
              <button type="button" @click="startEnergyMidterm('learn', true, false, undefined, 'pdf')">후기 PDF{{ energyMidtermPdfCount }}문제 학습</button>
              <button type="button" @click="startEnergyMidterm('exam', true, false, undefined, 'pdf')">후기 PDF{{ energyMidtermPdfCount }}문제 CBT</button>
              <button type="button" @click="startEnergyMidterm('learn', true, true)">교재 대응{{ energyMidtermBookCount }}문제 학습</button>
              <button type="button" @click="startEnergyMidterm('learn', true)">전체{{ energyMidtermEligibleQuestions.length }}문제 학습</button>
              <button type="button" @click="startEnergyMidterm('exam', true)">전체{{ energyMidtermEligibleQuestions.length }}문제 CBT</button>
            </div>
            </details>
            <details><summary>자료가 애매하거나 기출과 다른 부분</summary><p>수업PPT는 급수pH6~9(적정8.5)·관수11~11.8, 교재260쪽은 급수6.5~9·관수10.5~11.5로 다릅니다. 후기 PDF의 특정 원통보일러 급수7~9도 해당 조건으로만 읽으세요. 보염장치/윈드박스와 CO₂/수트블로워는 구분합니다. 메모의 약품명·배관33 경계는 미확정입니다. 후기 PDF13회차 전체1,040개를 넣은 것은 아니며 중간고사20주제의 검토 문항만 연결했습니다. 보류했던14개도 원문 경계를 직접 확인해 반영했습니다.</p></details>
          </section>
          <RoundListMount :model="{rows:roundCards}"/>
          </template>
        </template>

        <ReactSurface v-else-if="view === 'history'" data-react-view="history" :draw="() => renderHistoryView(historyViewModel)"/>

        <ReactSurface v-else-if="view === 'wrong'" data-react-view="wrong" :draw="() => renderWrongView(wrongViewModel)"/>

<ReactSurface v-else-if="view === 'search'" data-react-view="search-view" :draw="() => renderSearchView(searchViewModel)"/>


<ReactSurface v-else-if="view === 'calculation'" data-react-view="calculation-view" :draw="() => renderCalculationView(calculationViewModel)"/>


        <section v-else-if="view === 'guide' && !guideLoaded" class="guide-notice" aria-live="polite">
          <strong>{{ guideLoading ? '시험 자료를 불러오는 중입니다…' : '시험 자료실' }}</strong>
          <p v-if="guideError" role="alert">{{ guideError }}</p>
          <button v-if="!guideLoading" type="button" @click="retryStudyGuide">다시 불러오기</button>
        </section>
<ReactSurface v-else-if="view === 'guide' && activeStudyGuide" data-react-view="guide-view" :draw="() => renderGuideView(guideViewModel)"/>


<ReactSurface v-else-if="view === 'coach'" data-react-view="coach-view" :draw="() => renderCoachView(coachViewModel)"/>


<ReactSurface v-else-if="view === 'beta'" data-react-view="beta-view" :draw="() => renderBetaView(betaViewModel)"/>


<ReactSurface v-else-if="view === 'showcase'" data-react-view="showcase-view" :draw="() => renderShowcaseView(showcaseViewModel)"/>


<ReactSurface v-else-if="view === 'stats'" data-react-view="stats-view" :draw="() => renderStatsView(statsViewModel)"/>


<ReactSurface v-else data-react-view="patch-view" :draw="() => renderPatchView(patchViewModel)"/>

          </div>
        </Transition>
      </div>
    </main>
    <button v-if="showAndroidApkPopup" type="button" class="android-apk-floating-trigger" aria-label="Android 앱 다운로드 안내 열기" @click="androidApkPopupOpen = true">
      <span>ANDROID</span><strong>앱 받기</strong>
    </button>

    <Transition name="modal-fade">
      <div v-if="showAndroidApkPopup && androidApkPopupOpen" class="android-apk-popup-backdrop" @click.self="androidApkPopupOpen = false">
        <section class="android-apk-popup" role="dialog" aria-modal="true" aria-labelledby="android-apk-popup-title">
          <button type="button" class="android-apk-popup-close" aria-label="Android 앱 안내 닫기" @click="androidApkPopupOpen = false">×</button>
          <div class="android-app-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <path d="M15 18h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" />
              <path d="m16 18-3-5m19 5 3-5M18 12h12a4 4 0 0 1 4 4v2H14v-2a4 4 0 0 1 4-4Z" />
              <circle cx="19" cy="15" r="1.3" /><circle cx="29" cy="15" r="1.3" />
            </svg>
          </div>
          <span>ANDROID 전용</span>
          <h2 id="android-apk-popup-title">CBT 앱으로 더 편하게 풀어보세요</h2>
          <p>휴대폰·태블릿 전용 화면과 터치 메뉴를 사용할 수 있습니다.</p>
          <small>Android 7.0 이상 · 약 8MB</small>
          <div class="android-apk-popup-actions">
            <button type="button" @click="androidApkPopupOpen = false">나중에</button>
            <a :href="$problemImage(androidApkUrl)" target="_blank" rel="noopener" @click="androidApkPopupOpen = false">정식 APK 다운로드 <b aria-hidden="true">↓</b></a>
          </div>
        </section>
      </div>
    </Transition>

    <nav v-if="!practicalSolving" class="mobile-tabbar" :inert="mobileMenuOpen">
      <button :class="{ active: view === 'home' }" @click="openView('home')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(0))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-home-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><i v-else class="study-menu-icon menu-home" aria-hidden="true" /></span>홈</button>
      <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(1))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-rounds-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><i v-else class="study-menu-icon menu-rounds" aria-hidden="true" /></span>회차</button>
      <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(2))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-wrong-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(2), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(2))" alt=""><i v-else class="study-menu-icon menu-wrong" aria-hidden="true" /></span>오답</button>
      <button :class="{ active: view === 'search' }" @click="openView('search')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(3))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-search-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(3), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(3))" alt=""><i v-else class="study-menu-icon menu-search" aria-hidden="true" /></span>검색</button>
      <button :class="{ active: view === 'coach' }" @click="openView('coach')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsBurnsImage, 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsBurnsImage)" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-coach-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(0), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(0))" alt=""><i v-else class="study-menu-icon menu-coach" aria-hidden="true" /></span>합격</button>
      <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span><img  v-if="visualStyle === 'simpsons'" v-bind="responsiveImageAttrs(simpsonsFunnyImageAt(5), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(simpsonsFunnyImageAt(5))" alt=""><img  v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-stats-${sunjaeImageIndex}`" v-bind="responsiveImageAttrs(sunjaePortraitImageAt(1), 'auto, (max-width: 820px) 80vw, 640px')" @error="restoreOriginalImage" :src="$problemImage(sunjaePortraitImageAt(1))" alt=""><i v-else class="study-menu-icon menu-stats" aria-hidden="true" /></span>통계</button>
    </nav>
    <nav v-if="!practicalSolving" class="native-app-tabbar" aria-label="Android 앱 메뉴" :inert="mobileMenuOpen">
      <button :class="{ active: view === 'home' }" @click="nativeMoreOpen = false; openView('home')"><span>⌂</span><strong>홈</strong></button>
      <button :class="{ active: view === 'rounds' }" @click="nativeMoreOpen = false; openView('rounds')"><span>▤</span><strong>회차</strong></button>
      <button :class="{ active: view === 'wrong' }" @click="nativeMoreOpen = false; openView('wrong')"><span>!</span><strong>오답</strong><b v-if="stats.wrong">{{ Math.min(99, stats.wrong) }}</b></button>
      <button :class="{ active: view === 'search' }" @click="nativeMoreOpen = false; openView('search')"><span>⌕</span><strong>검색</strong></button>
      <button :class="{ active: nativeMoreOpen }" @click="nativeMoreOpen = !nativeMoreOpen"><span>•••</span><strong>더보기</strong></button>
    </nav>
    <Transition name="modal-fade">
      <div v-if="nativeMoreOpen" class="native-more-backdrop" @click.self="nativeMoreOpen = false">
        <section class="native-more-sheet">
          <header><div><span>QUICK MENU</span><strong>더보기</strong></div><button type="button" aria-label="더보기 닫기" @click="nativeMoreOpen = false">×</button></header>
          <nav>
            <button type="button" @click="nativeMoreOpen = false; openView('history')"><span>◴</span><div><strong>학습 내역</strong><small>이어하기·점수·재도전</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('calculation')"><span>∑</span><div><strong>계산문제</strong><small>공식부터 차근차근</small></div></button>
            <button v-if="studyGuideAvailable" type="button" @click="nativeMoreOpen = false; openView('guide')"><span>▣</span><div><strong>시험 자료실</strong><small>공식·핵심 개념{{ hvacPracticalAvailable ? '·필답형' : '' }}</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('coach')"><span>✦</span><div><strong>합격 엔진</strong><small>취약 과목과 복습</small></div></button>
            <button v-if="experimentalFeaturesEnabled" type="button" @click="nativeMoreOpen = false; openView('beta')"><span><i class="study-menu-icon menu-beta" aria-hidden="true" /></span><div><strong>베타 학습 도구</strong><small>확신도·메모·맞춤 복습</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('stats')"><span>▥</span><div><strong>학습 통계</strong><small>점수와 학습 기록</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openCalculator()"><span>▦</span><div><strong>계산기</strong><small>공학용 계산 도구</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; settingsOpen = true"><span>⚙</span><div><strong>설정</strong><small>테마·글씨·문제 화면</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('updates')"><span>◷</span><div><strong>업데이트</strong><small>패치노트 확인</small></div></button>
          </nav>
        </section>
      </div>
    </Transition>

  </div>

  <p v-else-if="!session && textbookReaderOpen && appHydrating" class="library-note" role="status">저장한 풀이 기록을 불러오는 중…</p>
  <TextbookPages v-else-if="!session && textbookReaderOpen" :book="textbookKey" :items="textbookItems" :answers="textbookAnswers" :bookmarked-ids="studyStore.bookmarks" :loading="textbookLoading" :error="textbookError" :answer-layout="answerLayout" :hotspot-indicator="hotspotIndicator" :restored-image-theme="restoredImageTheme" @close="closeTextbookReader" @settings="settingsOpen=true" @calculator="openCalculator()" @book="selectTextbook" @retry="loadTextbookPages" @choose="chooseTextbookAnswer" @bookmark="toggleBookmark" @ai="prepareAiQuestion" @start="payload=>beginSession(payload.mode,payload.label,payload.items)" />

  <div
    v-else-if="session"
    class="session-shell"
    :class="{
      'exam-mode': session.mode === 'exam',
      'sheet-closed': !examSheetOpen,
      'layout-standard': solveLayoutMode === 'standard',
      'layout-comcbt': solveLayoutMode === 'comcbt',
      'layout-combat': solveLayoutMode === 'combat',
      'standard-image-fit': true,
      'experience-session-entering': experienceTransitionPhase === 'session-entering',
      'experience-session-leaving': experienceTransitionPhase === 'session-leaving',
    }"
  >
    <ToolPanelsMount v-if="panelCalculator || panelNotes || pinnedSolution" :model="{calculator:panelCalculator, notes:panelNotes, solution:pinnedSolution, scope:spaceScope, close:closeTool}" />
    <ReactSurface data-react-view="exam-session" :draw="() => renderExamSessionView(examSessionViewModel)"/>
    <ReactSurface v-if="examResult" data-react-view="grade" :draw="() => renderGradeView(gradeViewModel)"/>
  </div>

  <StudySettings v-if="settingsOpen && (view !== 'settings' || session)" :mode="settingsExpanded ? 'full' : 'quick'" :values="settingsValues" :context="settingsContext" @change="changeSetting" @action="settingsAction">
    <template #account><CloudSyncPanel description="로그인 없이도 공부할 수 있습니다. 다른 기기와 기록을 연결할 때만 로그인하세요." /></template>
  </StudySettings>
  <input ref="learningImportInput" type="file" accept="application/json,.json" hidden @change="importLearningData">


  <Transition name="modal-fade">
    <section v-if="nativeCalculatorOpen" class="native-calculator-shell">
      <header>
        <div><span>ANDROID TOOL</span><strong>공학용 계산기</strong></div>
        <button type="button" @click="nativeCalculatorOpen = false">풀이로 돌아가기</button>
      </header>
      <iframe src="calculator.html?native=1" title="공학용 계산기" />
    </section>
  </Transition>

  <div v-if="aiPromptOpen" class="ai-prompt-backdrop" @click.self="aiPromptOpen = false">
    <section class="ai-prompt-modal">
      <header>
        <div><span>BEGINNER AI TUTOR</span><h2>정답 검증 + 초보자용 해설 프롬프트</h2></div>
        <button type="button" aria-label="AI 질문 창 닫기" @click="aiPromptOpen = false">×</button>
      </header>
      <div v-if="aiPromptHasImage" class="ai-image-notice">
        <span>▧</span>
        <div><strong>문제 이미지를 실제 첨부할 수 있습니다</strong><small>URL 캐시 오류를 피하려면 프롬프트를 붙여넣은 뒤 `문제 이미지 복사`도 눌러 ChatGPT에 붙여넣으세요. 모바일은 `질문+이미지 공유`를 사용할 수 있습니다.</small></div>
      </div>
      <p>문제 전체를 다시 보여주고 설정 정답·실제 정답·기존 해설을 검증한 뒤 쉬운 설명을 하도록 구성했습니다.</p>
      <textarea v-model="aiPromptText" aria-label="AI 질문 프롬프트" spellcheck="false" />
      <footer>
        <button type="button" class="ai-copy-button" @click="copyAiPrompt">프롬프트 복사</button>
        <button v-if="aiPromptHasImage" type="button" class="ai-image-copy-button" :disabled="aiImageBusy" @click="copyAiQuestionImage">{{ aiImageBusy ? '이미지 준비 중…' : '문제 이미지 복사' }}</button>
        <button v-if="aiPromptHasImage && canShareAiQuestion" type="button" class="ai-share-button" :disabled="aiImageBusy" @click="shareAiQuestion">질문+이미지 공유</button>
        <button type="button" class="ai-open-button" @click="openAiAssistant">프롬프트 복사 후 ChatGPT 열기 →</button>
      </footer>
    </section>
  </div>

  <Transition name="toast">
    <aside v-if="updateAvailable && !session && !practicalSolving && !textbookReaderOpen" class="update-notice">
      <div><span>NEW VERSION</span><strong>새로운 CBT 업데이트가 준비됐습니다</strong><small>버튼을 누르면 최신 화면과 패치노트가 적용됩니다.</small></div>
      <button type="button" @click="applyUpdate">업데이트 적용</button>
    </aside>
  </Transition>



  <Transition name="toast">
    <div v-if="toastMessage" class="toast-message">{{ toastMessage }}</div>
  </Transition>

  <Teleport to="body">
    <div
      v-if="visualTransitionPhase"
      class="visual-style-motion"
      :class="[`motion-${visualTransitionPhase}`, `motion-to-${visualTransitionTarget}`]"
      aria-hidden="true"
    >
      <i /><i /><i />
      <strong>{{ visualTransitionTarget === 'simpsons' ? 'SPRINGFIELD UI' : visualTransitionTarget === 'sunjae' ? 'LOVELY RUNNER UI' : 'CBT UI' }}</strong>
      <span>화면을 옮기는 중</span>
    </div>
  </Teleport>
</template>
