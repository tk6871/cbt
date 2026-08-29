<script setup lang="ts">
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { animate, stagger } from 'motion';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  GEM_APPRAISER_TARGET_KEY,
  latestSubjects,
  loadCatalogs,
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
import SchoolExamManager from './SchoolExamManager.vue';
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
  requestSyncPasswordReset,
  scheduleLearningSync,
  signInForSync,
  signOutFromSync,
  signUpForSync,
  syncLearningData,
  updateSyncPassword,
} from './cloudSync';
import { hvacFieldReportRelatedGroups, hvacFieldReportRound } from './hvacFieldReportPractice';
import {
  hvacCalculatorMemory,
  hvacCalculatorMemoryGroups,
  hvacCalculatorSheetNotes,
  hvacFrequentFormulas,
} from './hvacCalculatorSheet';
import { buildHvacPredictionSet } from './hvacPrediction';
import { practicalPrompts, practicalSources, studyGuidePages } from './qualificationStudyGuides';
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
  studyStore,
  type ExamRecord,
  type VisualStyle,
} from './storage';
import type { AttemptRecord, Catalog, CurriculumScope, QuestionItem, Round, SessionState, StudyMode } from './types';

const MathFormula = defineAsyncComponent(() => import('./MathFormula.vue'));

type ViewName = 'home' | 'rounds' | 'school' | 'history' | 'wrong' | 'search' | 'calculation' | 'guide' | 'coach' | 'beta' | 'showcase' | 'stats' | 'updates';
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
type PracticalPromptFilter = 'all' | 'public' | 'foundation';
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
};
type MasteryRow = QuestionItem & {
  mastery: number;
  recall: number;
  dueAt: number;
  due: boolean;
  attempted: boolean;
};
type SavedLearningSession = {
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
const sunjaeGradingImage = 'assets/theme/sunjae/wooseok-coffee.png';
const sunjaeCherryImage = 'assets/theme/sunjae/sunjae-cherry-capture.jpg';
const sunjaeImages = [
  sunjaeCherryImage,
  sunjaePraiseImage,
  sunjaeEncourageImage,
  'assets/theme/sunjae/sunjae-track.png',
  'assets/theme/sunjae/sunjae-campus.png',
  'assets/theme/sunjae/sunjae-school.jpg',
  'assets/theme/sunjae/wooseok-casual.jpg',
  'assets/theme/sunjae/wooseok-coffee.png',
  'assets/theme/sunjae/wooseok-cafe.jpg',
  'assets/theme/sunjae/wooseok-sunlight.jpg',
];
const sunjaePortraitImages = [
  sunjaePraiseImage,
  'assets/theme/sunjae/sunjae-school.jpg',
  'assets/theme/sunjae/wooseok-cafe.jpg',
  'assets/theme/sunjae/wooseok-sunlight.jpg',
];
const savedSunjaeRotationValue = localStorage.getItem('unified-cbt-sunjae-rotation-seconds');
const savedSunjaeRotationSeconds = savedSunjaeRotationValue === null ? Number.NaN : Number(savedSunjaeRotationValue);
const sunjaeRotationChoices = [0, 5, 10, 30, 60, 180, 300];
const schoolExamData = ref(loadSchoolExamData());
const schoolCatalog = reactive(schoolExamCatalog(schoolExamData.value));
const catalogs = [...loadCatalogs(), ...(!isJewelry ? [schoolCatalog] : [])];
const referenceRounds = loadReferenceRounds();
const qualificationMeta: Record<string, { icon: string; className: string; description: string }> = {
  hvac: { icon: '❄', className: 'blue', description: '공조·냉동·설치운영' },
  'hvac-hansol': { icon: 'H', className: 'hansol-blue', description: '한솔 원문 · 별도 회차 학습' },
  safety: { icon: '⛑', className: 'orange', description: '안전관리·위험방지' },
  energy: { icon: '♨', className: 'green', description: '열·연소·설비관리' },
  maintenance: { icon: '⚙', className: 'violet', description: '자동화·진단·기계정비' },
  'electric-craftsman': { icon: '⚡', className: 'blue', description: '전기이론·기기·설비' },
  'gas-craftsman': { icon: '◉', className: 'green', description: '가스안전·장치·일반' },
  'hazardous-craftsman': { icon: '◆', className: 'orange', description: '화재예방·위험물 취급' },
  'information-engineer': { icon: 'IT', className: 'violet', description: '설계·개발·DB·프로그래밍·시스템' },
  'gem-appraiser': { icon: '◇', className: 'jewel-red', description: '보석학·감별·다이아몬드' },
  'gem-appraiser-target': { icon: '✦', className: 'jewel-target', description: '큐넷 4과목 통합 모의시험' },
  'precious-industrial': { icon: '◆', className: 'jewel-gold', description: '장신구·귀금속 가공' },
  'precious-craftsman': { icon: '◈', className: 'jewel-teal', description: '재료·가공·작업안전' },
  'precious-master': { icon: '✦', className: 'jewel-purple', description: '귀금속가공 종합' },
  [SCHOOL_EXAM_CATALOG_KEY]: { icon: '✎', className: 'school-navy', description: '중간·기말 · 주관식 암기 · 교재 범위' },
};

const qualificationStorageKey = `modern-cbt-qualification-${spaceScope}`;
const learningSessionStorageKey = `unified-cbt-learning-session-${spaceScope}`;
const learningSessionProgressKey = 'activeLearningSessionV1';
const savedQualification = localStorage.getItem(qualificationStorageKey);
const selectedKey = ref(catalogs.some((item) => item.key === savedQualification) ? savedQualification! : catalogs[0]?.key || '');
const displayPreference = ref<DisplayPreference>(window.CBT_DISPLAY_PREFERENCE === 'mobile' || window.CBT_DISPLAY_PREFERENCE === 'desktop'
  ? window.CBT_DISPLAY_PREFERENCE : 'auto');
const resolvedDisplayMode = window.CBT_DISPLAY_MODE || 'desktop';
const savedFontFamily = localStorage.getItem('unified-cbt-font-family');
const fontFamilyPreference = ref<FontFamilyPreference>(savedFontFamily === 'bold' || savedFontFamily === 'd2coding' || savedFontFamily === 'd2coding-bold'
  ? savedFontFamily : 'regular');
document.documentElement.dataset.fontFamily = fontFamilyPreference.value;
const view = ref<ViewName>('home');
const curriculum = ref<CurriculumScope>('all-mapped');
const yearFrom = ref(0);
const yearTo = ref(0);
const session = ref<SessionState | null>(null);
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
const syncLoginOpen = ref(false);
const syncEmailStorageKey = `cbt-sync-email-${spaceScope}`;
const syncRememberStorageKey = `cbt-sync-remember-${spaceScope}`;
const rememberedSyncEmail = localStorage.getItem(syncEmailStorageKey) || '';
const syncEmail = ref(rememberedSyncEmail);
const syncPassword = ref('');
const syncNewPassword = ref('');
const syncRememberEmail = ref(localStorage.getItem(syncRememberStorageKey) !== 'false');
const syncBusy = ref(false);
const syncFormMessage = ref('');
const nativeMoreOpen = ref(false);
const nativeCalculatorOpen = ref(false);
const learningImportInput = ref<HTMLInputElement | null>(null);
const updateAvailable = ref(Boolean(window.CBT_UPDATE_AVAILABLE));
const pwaRegistrationError = ref(Boolean(window.CBT_PWA_REGISTRATION_ERROR));
const updateChecking = ref(false);
const openUpdatesAfterRefreshKey = `cbt-open-updates-after-refresh-${spaceScope}`;
const searchQuery = ref('');
const searchResultIds = ref<string[]>([]);
const searchReady = ref(false);
const searchBookmarksOnly = ref(false);
const wrongRoundFilter = ref('');
const wrongTypeFilter = ref<'all' | 'calculation'>('all');
const calculationSubjectFilter = ref('all');
const calculationRoundFilter = ref('all');
const calculationResultFilter = ref<'all' | 'wrong'>('all');
const bookmarkRoundFilter = ref('all');
const questionJudgmentEnabled = ref(localStorage.getItem('unified-cbt-question-judgment') === 'true');
const betaModeFilter = ref<StudyMode>('learn');
const learningJumpNumber = ref('');
const fontScale = ref(Math.min(1.6, Math.max(.8, Number(studyStore.fontScale) || 1)));
const recentExamRecords = ref<ExamRecord[]>([]);
const officialRule = computed(() => qualificationRuleFor(selectedKey.value));
const officialExamRecords = computed(() => recentExamRecords.value.filter((record) => !record.mode || record.mode === 'exam'));
const displayedPassChance = ref(0);
const displayedResultScore = ref(0);
const sunjaeResultPhase = ref<SunjaeResultPhase>('reveal');
const appHydrating = ref(true);
const isNativeApp = document.documentElement.dataset.nativeApp === 'true';
const androidApkUrl = 'https://github.com/tk6871/cbt/releases/download/android-latest/industrial-cbt-latest.apk';
const platformUserAgent = navigator.userAgent || '';
const isIosDevice = /iPad|iPhone|iPod/i.test(platformUserAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroidDevice = /Android/i.test(platformUserAgent);
const isIosInstallPreview = /^(?:127\.0\.0\.1|localhost)$/.test(location.hostname)
  && new URLSearchParams(location.search).has('preview-ios-install');
const isIosSafari = (isIosDevice && /Safari/i.test(platformUserAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(platformUserAgent))
  || isIosInstallPreview;
const isStandaloneWebApp = matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const showAndroidApkPopup = isAndroidDevice && !isNativeApp;
const showAndroidApkPatchDownload = !isIosDevice;
const androidApkPopupOpen = ref(false);
const androidApkPopupSeenKey = 'unified-cbt-android-apk-popup-seen-v351';
const showIosPwaPrompt = (isIosDevice && !isNativeApp && !isStandaloneWebApp) || isIosInstallPreview;
const iosPwaInstallOpen = ref(false);
const iosPwaPopupSeenKey = 'unified-cbt-ios-pwa-popup-seen-v351';
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
const viewOrder: ViewName[] = ['home', 'rounds', 'school', 'history', 'wrong', 'search', 'calculation', 'guide', 'coach', 'beta', 'stats', 'updates', 'showcase'];
const viewScrollPositions = new Map<ViewName, number>();

const selectedCatalog = computed<Catalog>(() => catalogs.find((item) => item.key === selectedKey.value) || catalogs[0]);
const sourceCatalogs = catalogs.filter((catalog) => !catalog.isVirtual);
const currentSunjaeImage = computed(() => sunjaeImages[sunjaeImageIndex.value % sunjaeImages.length] || sunjaeThemeBanner);
const themeBackdropStyle = computed<Record<string, string>>(() => {
  if (visualStyle.value === 'sunjae') return { '--theme-main-photo': `url("${currentSunjaeImage.value}")` };
  if (visualStyle.value === 'simpsons') return {
    '--theme-main-photo': `url("${simpsonsThemeImage}")`,
    '--simpsons-sidebar-photo': `url("${simpsonsKingSizeImage}")`,
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
const visibleRounds = computed(() => {
  const rounds = sortedRounds(selectedCatalog.value);
  if (selectedKey.value !== 'energy') return rounds;
  return [...referenceRounds, ...rounds].sort((a, b) =>
    b.year - a.year || String(b.date || b.session || '').localeCompare(String(a.date || a.session || ''), 'ko', { numeric: true }));
});
const selectedSubjects = computed(() => subjectsForScope(selectedCatalog.value, curriculum.value));
const selectedItems = computed(() => questionItems(selectedCatalog.value, yearFrom.value, yearTo.value, curriculum.value));
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
const itemMap = computed(() => new Map(allItems.value.map((item) => [item.id, item])));
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
if (savedLearningSession.value && !learningProgressValue()) {
  studyStore.progress ||= {};
  studyStore.progress[learningSessionProgressKey] = savedLearningSession.value;
}
const legacyWrongItems = computed(() => allItems.value.filter((item) => {
  const targetItem = selectedCatalog.value.isVirtual
    ? item.question.targetRelevance !== 'peripheral'
    : item.round.qualificationKey === selectedKey.value;
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
  const lookup = selectedCatalog.value.isVirtual ? targetItemMap : itemMap.value;
  return searchResultIds.value.map((id) => lookup.get(id)).filter((item): item is QuestionItem => Boolean(item));
});
const searchableCatalogItems = computed(() => {
  if (selectedCatalog.value.isVirtual) return [...targetItemMap.values()];
  return allItems.value.filter((item) => item.round.qualificationKey === selectedKey.value);
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
const motionAllowed = computed(() => dynamicUiEnabled.value && !prefersReducedMotion.value);
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
  guide: studyGuidePages[selectedKey.value]?.title || '시험 자료실',
  coach: '합격 엔진',
  beta: '베타 학습 도구',
  showcase: '신기술 학습관',
  stats: '학습 분석',
  updates: '패치노트',
})[view.value]);
const activeStudyGuide = computed(() => studyGuidePages[selectedKey.value] || null);
const studyGuideAvailable = computed(() => Boolean(activeStudyGuide.value));
const hvacPracticalAvailable = computed(() =>
  (selectedKey.value === 'hvac' || selectedKey.value === 'hvac-hansol')
  && Boolean(cloudSyncState.email));
const practicalPromptFilter = ref<PracticalPromptFilter>('all');
const visiblePracticalPrompts = computed(() => practicalPromptFilter.value === 'all'
  ? practicalPrompts
  : practicalPrompts.filter((prompt) => prompt.group === practicalPromptFilter.value));
const stats = computed(() => {
  const all = selectedCatalog.value.rounds.flatMap((round) => round.questions.map((question) => questionId(round, question)));
  const answered = all.filter((id) => studyStore.attempts[id]);
  const correct = answered.filter((id) => studyStore.attempts[id]?.lastCorrect);
  const wrong = all.filter((id) => studyStore.wrong[id]);
  const bookmarks = all.filter((id) => studyStore.bookmarks.includes(id));
  return {
    total: all.length,
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
const preferredPageSize = computed(() => solveLayoutMode.value === 'comcbt' ? 6 : 4);
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
    risk: predicted < 40,
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
  if (!coachAnswered.value) return 4;
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
const coachPlans = computed<Array<{ key: CoachPlanKey; eyebrow: string; title: string; description: string; count: number; tone: string }>>(() => [
  {
    key: 'due',
    eyebrow: 'FORGOTTEN CURVE',
    title: '오늘의 망각 복습',
    description: '기억 확률이 낮아진 문제부터 다시 잡습니다.',
    count: Math.min(20, dueRows.value.length || weakRows.value.length || unseenRows.value.length),
    tone: 'mint',
  },
  {
    key: 'weak',
    eyebrow: 'WEAK POINT',
    title: '취약 문제 집중',
    description: '숙련도가 가장 낮은 문제 20개를 선별합니다.',
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
    title: `${weakestSubject.value?.subject || '취약 과목'} 과락 방어`,
    description: '예상 점수가 가장 낮은 과목을 우선 보강합니다.',
    count: Math.min(20, masteryRows.value.filter((item) => item.subject === weakestSubject.value?.subject).length),
    tone: 'amber',
  },
  {
    key: 'exam',
    eyebrow: 'PREDICTIVE MOCK',
    title: '합격 예측 모의고사',
    description: '현재 범위에서 과목별 20문제를 균형 출제합니다.',
    count: Math.min(selectedSubjects.value.length * 20, masteryRows.value.length),
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
  recentExamRecords.value = await loadExamRecords(selectedKey.value);
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
    animate(
      selector,
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
  if (next === 'rounds') {
    animate(
      '.round-progress i',
      { scaleX: [0, 1] },
      { duration: .72, delay: stagger(.035), ease: [0.2, 0.8, 0.2, 1] },
    );
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

function configureQualification(key: string): void {
  const target = catalogs.find((catalog) => catalog.key === key);
  if (target?.isPlaceholder) {
    localStorage.setItem(qualificationStorageKey, key);
    location.reload();
    return;
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

function selectQualification(key: string): void {
  configureQualification(key);
  openView(key === SCHOOL_EXAM_CATALOG_KEY ? 'school' : 'rounds');
}

function updateQualificationFromSetup(event: Event): void {
  const key = (event.target as HTMLSelectElement).value;
  configureQualification(key);
  if (key === SCHOOL_EXAM_CATALOG_KEY) openView('school');
  else if (view.value === 'school') openView('rounds');
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
  const validViews: ViewName[] = ['home', 'rounds', 'school', 'history', 'wrong', 'search', 'calculation', 'guide', 'coach', 'beta', 'showcase', 'stats', 'updates'];
  if (candidate.cbtSpace !== historyScope || !validViews.includes(candidate.view as ViewName)) return null;
  return candidate as CbtHistoryState;
}

function viewHistoryState(next: ViewName, sessionId?: string): CbtHistoryState {
  return { cbtSpace: historyScope, view: next, ...(sessionId ? { sessionId } : {}) };
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
  const restoredView = openUpdatesAfterRefresh ? 'updates' : current?.view || 'home';
  const initialView = restoredView === 'beta' && !experimentalFeaturesEnabled.value
    ? 'home'
    : restoredView;
  view.value = initialView;
  history.replaceState(viewHistoryState(initialView), '', location.href);
}

function openView(next: ViewName, options: { fromHistory?: boolean; replace?: boolean } = {}): void {
  if (next === 'beta' && !experimentalFeaturesEnabled.value) {
    settingsOpen.value = true;
    showToast('설정에서 실험 기능 전체를 켜면 베타 학습 도구를 비교할 수 있습니다.');
    return;
  }
  const previousView = view.value;
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
      history[method](viewHistoryState(next), '', location.href);
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
    animate('.view-stage > *', visualStyle.value === 'simpsons' ? {
      opacity: [0, 1],
      y: [24, 0],
      rotate: [navigationDirection.value * 0.7, 0],
      scale: [.975, 1],
    } : {
      opacity: [0, 1],
      y: [16, 0],
      filter: ['blur(5px)', 'blur(0px)'],
    }, { duration: visualStyle.value === 'simpsons' ? .48 : .38, delay: stagger(.038), ease: [0.2, 0.8, 0.2, 1] });
    animate(
      '.sidebar nav button.active,.mobile-tabbar button.active',
      { scale: [.9, 1], x: [navigationDirection.value * 9, 0] },
      { duration: .32, ease: [0.2, 0.9, 0.2, 1] },
    );
    animateViewDetails(next);
  });
}

function restoreSessionReturnPosition(state: SessionReturnState | null): void {
  if (!state) return;
  void nextTick(() => window.requestAnimationFrame(() => {
    const roundCard = state.view === 'rounds' && state.roundId
      ? document.getElementById(`round-card-${state.roundId}`)
      : null;
    if (roundCard) roundCard.scrollIntoView({ block: 'center', behavior: motionAllowed.value ? 'smooth' : 'auto' });
    else window.scrollTo({ top: state.scrollY, behavior: 'auto' });
  }));
}

function deactivateSession(preserveForForward = false): void {
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
  const target = ownHistoryState(event.state);
  if (!target) return;

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
  saveActiveLearningSession();
  sendCurrentSessionOnExit();
}

function setupSearchWorker(): void {
  searchWorker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
  searchWorker.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as { type: 'ready' | 'results'; ids?: string[] };
    if (message.type === 'ready') searchReady.value = true;
    if (message.type === 'results') searchResultIds.value = message.ids || [];
  });
  indexSearchItems();
}

function indexSearchItems(): void {
  searchWorker?.postMessage({
    type: 'index',
    entries: allItems.value.map((item) => ({
      id: item.id,
      qualificationKey: item.round.qualificationKey,
      haystack: [
        item.question.text,
        item.question.html,
        item.subject,
        item.round.title,
        ...item.question.choices.map((choice) => choice.text || choice.html || ''),
      ].join(' ').replace(/<[^>]+>/g, ' ').toLocaleLowerCase('ko'),
    })),
  });
}

function requestSearch(): void {
  window.clearTimeout(searchHandle);
  searchHandle = window.setTimeout(() => {
    searchWorker?.postMessage({
      type: 'search',
      query: searchQuery.value,
      qualificationKey: selectedCatalog.value.isVirtual ? undefined : selectedKey.value,
    });
  }, 120);
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

function saveActiveLearningSession(): void {
  window.clearTimeout(learningSessionSaveHandle);
  learningSessionSaveHandle = 0;
  const active = session.value;
  if (!active || active.finished) return;
  const saved: SavedLearningSession = {
    version: 1,
    qualificationKey: selectedKey.value,
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
  options: { calculationMode?: boolean; page?: number; pageSize?: number; startedAt?: number; remainingSeconds?: number; kept?: string[]; resume?: boolean } = {},
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
    id: `${mode}-${Date.now()}`,
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
      ? Math.max(1, Number(options.remainingSeconds) || examDurationSeconds(items.length))
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

function resumeSavedLearning(): void {
  const saved = savedLearningSession.value;
  if (!saved) return;
  const items = saved.itemIds.flatMap((id) => {
    const item = itemMap.value.get(id) || targetItemMap.get(id);
    return item ? [item] : [];
  });
  if (!items.length || items.length !== saved.itemIds.length) {
    clearSavedLearningSession();
    showToast('저장된 문제 구성이 바뀌어 이어하기 기록을 정리했습니다.');
    return;
  }
  if (catalogs.some((catalog) => catalog.key === saved.qualificationKey)) {
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
  });
}

function startRound(round: Round, mode: StudyMode): void {
  const items = roundToItems(round);
  const saved = savedLearningSession.value;
  const sameSavedRound = saved && (saved.roundId === round.id
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
      `${round.year}년 ${round.session || ''} 학습`,
      items,
      previousAnswers,
      { resume: true },
    );
    return;
  }
  beginSession(
    mode,
    `${round.year}년 ${round.session || ''} ${mode === 'exam' ? '실전시험' : '학습'}`,
    items,
    {},
  );
}

function restartRoundLearning(round: Round): void {
  beginSession('learn', `${round.year}년 ${round.session || ''} 처음부터 학습`, roundToItems(round));
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
    title = '합격 엔진 · 망각 복습';
  } else if (key === 'weak') {
    pool = weakRows.value.length ? weakRows.value : shuffle(unseenRows.value);
    title = '합격 엔진 · 취약 문제 집중';
  } else {
    pool = masteryRows.value
      .filter((item) => item.subject === weakestSubject.value?.subject)
      .sort((a, b) => a.mastery - b.mastery || a.recall - b.recall);
    title = `합격 엔진 · ${weakestSubject.value?.subject || '취약 과목'} 과락 방어`;
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

function replayHistoryRecord(record: ExamRecord): void {
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
  if (event.key === 'Escape' && iosPwaInstallOpen.value) {
    event.preventDefault();
    iosPwaInstallOpen.value = false;
    return;
  }
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
      : '공식 합격 기준 확인이 필요합니다.',
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
    qualificationKey: selectedKey.value,
    qualification: selectedCatalog.value.name,
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
    qualificationKey: selectedKey.value,
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
      const url = new URL(path, imageBase);
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
    showToast('업데이트 적용에 실패했습니다. 화면의 PWA 자동 복구를 이용해 주세요.');
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
  recentExamRecords.value = [];
  scheduleLearningSync(100);
  settingsOpen.value = false;
  showToast('학습 기록을 초기화했습니다.');
}

async function submitSyncLogin(): Promise<void> {
  if (!syncEmail.value.trim() || !syncPassword.value) {
    syncFormMessage.value = '이메일과 비밀번호를 입력해 주세요.';
    return;
  }
  syncBusy.value = true;
  syncFormMessage.value = '';
  const error = await signInForSync(syncEmail.value, syncPassword.value);
  syncBusy.value = false;
  syncFormMessage.value = error || '로그인했습니다. 이 기기의 기록과 클라우드 기록을 합칩니다.';
  if (!error) {
    localStorage.setItem(syncRememberStorageKey, String(syncRememberEmail.value));
    if (syncRememberEmail.value) localStorage.setItem(syncEmailStorageKey, syncEmail.value.trim());
    else localStorage.removeItem(syncEmailStorageKey);
    syncPassword.value = '';
  }
}

async function submitSyncSignup(): Promise<void> {
  if (!syncEmail.value.trim() || syncPassword.value.length < 8) {
    syncFormMessage.value = '이메일과 8자 이상의 비밀번호를 입력해 주세요.';
    return;
  }
  syncBusy.value = true;
  syncFormMessage.value = '';
  const result = await signUpForSync(syncEmail.value, syncPassword.value);
  syncBusy.value = false;
  syncFormMessage.value = result || '계정을 만들고 로그인했습니다. 기록 동기화를 시작합니다.';
  if (!result || result.startsWith('확인 메일을 보냈습니다.')) {
    localStorage.setItem(syncRememberStorageKey, String(syncRememberEmail.value));
    if (syncRememberEmail.value) localStorage.setItem(syncEmailStorageKey, syncEmail.value.trim());
    else localStorage.removeItem(syncEmailStorageKey);
    syncPassword.value = '';
  }
}

async function logoutSyncAccount(): Promise<void> {
  await signOutFromSync();
  syncLoginOpen.value = false;
  syncPassword.value = '';
  syncFormMessage.value = '';
  showToast('동기화 계정에서 로그아웃했습니다. 기기에 저장된 기록은 그대로 유지됩니다.');
}

async function sendSyncPasswordReset(): Promise<void> {
  syncBusy.value = true;
  const error = await requestSyncPasswordReset(syncEmail.value);
  syncBusy.value = false;
  syncFormMessage.value = error || '비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 주세요.';
}

function showSyncIdHelp(): void {
  syncFormMessage.value = syncEmail.value.trim()
    ? `현재 입력된 이메일이 동기화 아이디입니다: ${syncEmail.value.trim()}`
    : '동기화 아이디는 회원가입할 때 사용한 이메일 주소입니다.';
}

async function saveNewSyncPassword(): Promise<void> {
  syncBusy.value = true;
  const error = await updateSyncPassword(syncNewPassword.value);
  syncBusy.value = false;
  syncFormMessage.value = error || '새 비밀번호로 변경했습니다. 자동 로그인이 유지됩니다.';
  if (!error) syncNewPassword.value = '';
}

function cloudSyncTimeLabel(): string {
  if (!cloudSyncState.lastSyncedAt) return '아직 동기화하지 않음';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
    .format(new Date(cloudSyncState.lastSyncedAt));
}

function handleCloudSynced(): void {
  refreshSavedLearningSessionFromStore();
  void refreshExamHistory();
}

function handlePasswordRecovery(): void {
  settingsOpen.value = true;
  syncLoginOpen.value = true;
  syncFormMessage.value = '새 비밀번호를 입력해 주세요.';
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

onMounted(async () => {
  window.addEventListener('cbt:update-available', handleUpdateAvailable);
  window.addEventListener('cbt:pwa-error', handlePwaRegistrationError);
  window.addEventListener('cbt:pwa-ready', handlePwaReady);
  window.addEventListener('popstate', handleBrowserHistory);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('resize', markViewportResizing, { passive: true });
  window.addEventListener('keydown', handleSessionKeydown);
  window.addEventListener('cbt:cloud-synced', handleCloudSynced);
  window.addEventListener('cbt:password-recovery', handlePasswordRecovery);
  if (document.documentElement.dataset.nativeApp === 'true') {
    nativeBackHandle = await CapacitorApp.addListener('backButton', () => { void handleNativeBackButton(); });
    syncNativeStatusBar();
  }
  initializeNavigationHistory();
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
  if (showIosPwaPrompt) {
    try {
      if (sessionStorage.getItem(iosPwaPopupSeenKey) !== 'true') {
        iosPwaInstallOpen.value = true;
        sessionStorage.setItem(iosPwaPopupSeenKey, 'true');
      }
    } catch {
      iosPwaInstallOpen.value = true;
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
  try {
    setupSearchWorker();
  } catch (error) {
    console.error('문제 검색 색인을 시작하지 못했습니다.', error);
  }
  await nextTick();
  animateViewDetails(view.value);
});

onBeforeUnmount(() => {
  window.removeEventListener('cbt:update-available', handleUpdateAvailable);
  window.removeEventListener('cbt:pwa-error', handlePwaRegistrationError);
  window.removeEventListener('cbt:pwa-ready', handlePwaReady);
  window.removeEventListener('popstate', handleBrowserHistory);
  window.removeEventListener('pagehide', handlePageHide);
  window.removeEventListener('resize', markViewportResizing);
  window.removeEventListener('keydown', handleSessionKeydown);
  window.removeEventListener('cbt:cloud-synced', handleCloudSynced);
  window.removeEventListener('cbt:password-recovery', handlePasswordRecovery);
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
  window.clearTimeout(sunjaeResultHandle);
  delete document.documentElement.dataset.resizing;
  searchWorker?.terminate();
});
</script>

<template>
  <div
    v-if="!session"
    class="app-frame"
    :style="themeBackdropStyle"
    :class="{
      'visual-style-leaving': visualTransitionPhase === 'leaving',
      'visual-style-entering': visualTransitionPhase === 'entering',
      'style-to-simpsons': visualTransitionTarget === 'simpsons',
      'style-to-sunjae': visualTransitionTarget === 'sunjae',
      'style-to-default': visualTransitionTarget === 'default',
      'experience-home-leaving': experienceTransitionPhase === 'home-leaving',
      'experience-home-entering': experienceTransitionPhase === 'home-entering',
    }"
  >
    <aside class="sidebar" :style="sidebarThemeStyle" :class="{ open: mobileMenuOpen }">
      <img v-if="visualStyle === 'simpsons'" class="sidebar-background-photo simpsons-sidebar-background-photo" :src="simpsonsKingSizeImage" alt="">
      <img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-sidebar-background-${currentSunjaeImage}`" class="sidebar-background-photo sunjae-sidebar-background-photo" :src="currentSunjaeImage" alt="">
      <button class="brand" type="button" @click="openView('home')">
        <span><img v-if="visualStyle === 'sunjae'" :key="`sunjae-brand-${sunjaeImageIndex}`" :src="currentSunjaeImage" alt=""><img v-else-if="visualStyle === 'simpsons'" :src="simpsonsKingSizeImage" alt=""><template v-else>{{ isJewelry ? 'GEM' : 'CBT' }}</template></span>
        <div><strong>{{ spaceName }}</strong><small>{{ visualStyle === 'simpsons' ? 'SPRINGFIELD STUDY' : visualStyle === 'sunjae' ? 'LOVELY RUNNER STUDY' : isJewelry ? 'JEWELRY STUDY' : 'SMART STUDY' }}</small></div>
      </button>
      <figure v-if="visualStyle === 'simpsons'" class="theme-sidebar-feature simpsons-sidebar-feature">
        <img :src="simpsonsKingSizeImage" alt="꽃무늬 옷을 입은 킹 사이즈 호머 심슨">
        <figcaption><strong>KING-SIZE HOMER</strong><small>공부할 준비부터 하자!</small></figcaption>
      </figure>
      <figure v-else-if="visualStyle === 'sunjae'" class="theme-sidebar-feature sunjae-sidebar-feature">
        <Transition name="sunjae-photo-fade" mode="out-in">
          <img :key="`sunjae-sidebar-${currentSunjaeImage}`" :src="currentSunjaeImage" alt="선재 테마 메뉴의 류선재·변우석 사진">
        </Transition>
        <figcaption><strong>오늘도 나랑 같이 달릴래?</strong><small>{{ sunjaeRotationSeconds ? `${sunjaeRotationLabel(sunjaeRotationSeconds)}마다 내가 찾아올게` : '오늘은 이 모습으로 기다릴게' }}</small></figcaption>
      </figure>
      <nav>
        <button :class="{ active: view === 'home' }" @click="openView('home')"><span data-theme-symbol="⌂"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-grin" :src="simpsonsFunnyImageAt(0)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-home-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" :src="sunjaePortraitImageAt(0)" alt=""><template v-else>⌂</template></span>홈</button>
        <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span data-theme-symbol="▤"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-cool" :src="simpsonsFunnyImageAt(1)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-rounds-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-night" :src="sunjaePortraitImageAt(1)" alt=""><template v-else>▤</template></span>회차별 문제</button>
        <button v-if="!isJewelry" :class="{ active: view === 'school' }" @click="selectQualification(SCHOOL_EXAM_CATALOG_KEY)"><span data-theme-symbol="✎"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" :src="simpsonsFunnyImageAt(6)" alt=""><template v-else>✎</template></span>학교 시험 준비</button>
        <button :class="{ active: view === 'history' }" @click="openView('history')"><span data-theme-symbol="◴"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-exercise" :src="simpsonsFunnyImageAt(8)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-history-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" :src="sunjaePortraitImageAt(3)" alt=""><template v-else>◴</template></span>학습 내역</button>
        <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span data-theme-symbol="!"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-phone" :src="simpsonsFunnyImageAt(2)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-wrong-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-sad" :src="sunjaePortraitImageAt(2)" alt=""><template v-else>!</template></span>오답노트 <b v-if="stats.wrong">{{ stats.wrong }}</b></button>
        <button :class="{ active: view === 'search' }" @click="openView('search')"><span data-theme-symbol="⌕"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-bart" :src="simpsonsFunnyImageAt(3)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-search-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" :src="sunjaePortraitImageAt(3)" alt=""><template v-else>⌕</template></span>문제 검색</button>
        <button :class="{ active: view === 'calculation' }" @click="openView('calculation')"><span data-theme-symbol="∑"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" :src="simpsonsFunnyImageAt(4)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-calculation-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" :src="sunjaePortraitImageAt(0)" alt=""><template v-else>∑</template></span>계산문제만 풀기</button>
        <button v-if="studyGuideAvailable" :class="{ active: view === 'guide' }" @click="openView('guide')"><span data-theme-symbol="▣"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-hardhat" :src="simpsonsFunnyImageAt(5)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-guide-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" :src="sunjaePortraitImageAt(1)" alt=""><template v-else>▣</template></span>시험 자료실</button>
        <button class="coach-nav-button" :class="{ active: view === 'coach' }" @click="openView('coach')"><span data-theme-symbol="✦"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-burns" :src="simpsonsBurnsImage" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-coach-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" :src="sunjaePortraitImageAt(2)" alt=""><template v-else>✦</template></span>합격 엔진</button>
        <button v-if="experimentalFeaturesEnabled" class="beta-nav-button" :class="{ active: view === 'beta' }" @click="openView('beta')"><span data-theme-symbol="β"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-doctor" :src="simpsonsFunnyImageAt(6)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-beta-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-face" :src="sunjaePortraitImageAt(1)" alt=""><template v-else>β</template></span>베타 학습 도구</button>
        <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span data-theme-symbol="▥"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character crop-bart" :src="simpsonsThemeImage" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-stats-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-cherry" :src="sunjaePortraitImageAt(3)" alt=""><template v-else>▥</template></span>학습 분석</button>
        <button :class="{ active: view === 'updates' }" @click="openView('updates')"><span data-theme-symbol="◷"><img v-if="visualStyle === 'simpsons'" class="theme-nav-character simpsons-scene-exhausted" :src="simpsonsFunnyImageAt(7)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-updates-${sunjaeImageIndex}`" class="theme-nav-character crop-sunjae-night" :src="sunjaePortraitImageAt(0)" alt=""><template v-else>◷</template></span>패치노트</button>
      </nav>
      <a class="space-portal" :href="isJewelry ? 'index.html' : 'jewelry.html'">
        <span>{{ isJewelry ? 'CBT' : '◇' }}</span>
        <div><strong>{{ isJewelry ? '산업기사 CBT' : '보석관' }}</strong><small>독립 학습 페이지로 이동</small></div>
        <b>›</b>
      </a>
      <div class="sidebar-foot">
        <button type="button" @click="openCalculator"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(4)" alt=""><template v-else>▦</template></span>공학용 계산기</button>
        <button type="button" @click="settingsOpen = true"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsBurnsImage" alt=""><template v-else>⚙</template></span>화면·데이터 설정</button>
      </div>
    </aside>
    <button v-if="mobileMenuOpen" class="mobile-backdrop" aria-label="메뉴 닫기" @click="mobileMenuOpen = false" />

    <main class="main-area">
      <header class="topbar">
        <button class="menu-button" type="button" @click="mobileMenuOpen = true">☰ <span>메뉴</span></button>
        <div class="topbar-context">
          <strong>{{ viewTitle }}</strong>
          <label class="topbar-qualification">
            <span>종목</span>
            <select :value="selectedKey" aria-label="현재 화면의 자격증 종목" @change="updateQualificationFromSetup">
              <option v-for="catalog in catalogs" :key="catalog.key" :value="catalog.key">{{ catalog.name }}</option>
            </select>
          </label>
        </div>
        <div class="top-actions">
          <button type="button" @click="openView('search')">⌕ <span>검색</span></button>
          <button type="button" @click="openCalculator">▦ <span>계산기</span></button>
          <button type="button" class="theme-quick-button" @click="toggleLightDark">{{ darkActive ? '☀' : '☾' }} <span>{{ darkActive ? '라이트 모드' : '다크 모드' }}</span></button>
          <button type="button" @click="settingsOpen = true">⚙ <span>설정</span></button>
        </div>
      </header>

      <div class="page-content">
        <div v-if="appHydrating && dynamicUiEnabled" class="dashboard-skeleton" aria-label="학습 화면을 준비하는 중">
          <i class="skeleton-title" /><i /><i /><i /><i class="skeleton-wide" />
        </div>
        <Transition v-else :name="viewTransitionName" mode="out-in">
          <div :key="view" class="view-stage" :class="{ 'sunjae-fan-dashboard': visualStyle === 'sunjae' && view === 'home', 'simpsons-fan-dashboard': visualStyle === 'simpsons' && dynamicUiEnabled && view === 'home' }">
        <template v-if="view === 'home'">
          <section v-if="visualStyle === 'sunjae' && dynamicUiEnabled" class="sunjae-fan-home">
            <div class="sunjae-fan-stage">
              <Transition name="sunjae-photo-fade" mode="out-in">
                <img :key="`sunjae-stage-${currentSunjaeImage}`" class="sunjae-stage-photo" :src="currentSunjaeImage" alt="류선재·변우석 테마 메인 사진">
              </Transition>
              <div class="sunjae-stage-shade" />
              <div class="sunjae-stage-copy">
                <span>LOVELY RUNNER · FAN STUDY ROOM</span>
                <h1>나 보러 왔지?<br><em>오늘도 같이 달리자</em></h1>
                <p>네가 문제를 푸는 동안 나는 여기 있을게. 어려워도 한 문제씩 끝까지 가보자.</p>
                <div><button type="button" @click="startRangeLearning">나랑 바로 공부하기</button><button type="button" @click="openView('wrong')">틀린 문제 같이 보기</button></div>
              </div>
              <div class="sunjae-stage-polaroids" aria-hidden="true">
                <figure><img :src="sunjaeImageAt(2)" alt=""><span>오늘도 네 편</span></figure>
                <figure><img :src="sunjaeImageAt(6)" alt=""><span>끝까지 같이</span></figure>
              </div>
              <div class="sunjae-stage-status"><span>오늘의 우리 기록</span><strong>{{ stats.answered.toLocaleString() }}문제</strong><small>정답률 {{ stats.accuracy }}% · 오답 {{ stats.wrong.toLocaleString() }}</small></div>
            </div>

            <div class="sunjae-fan-workspace">
              <section class="sunjae-qualification-album">
                <header><div><span>01 · PICK OUR COURSE</span><h2>오늘 나랑 어떤 종목 달릴래?</h2></div><p>사진을 넘기듯 골라봐. 고르면 내가 공부 범위를 바로 바꿔줄게.</p></header>
                <div class="sunjae-album-track">
                  <button v-for="(catalog, catalogIndex) in catalogs" :key="catalog.key" type="button" :class="{ selected: selectedKey === catalog.key }" @click="selectQualification(catalog.key)">
                    <img :src="sunjaeImageAt(catalogIndex + 1)" alt="">
                    <span>{{ selectedKey === catalog.key ? '우리 오늘 이거 하자' : '같이 골라볼래?' }}</span>
                    <strong>{{ catalog.name }}</strong>
                    <small>{{ catalog.roundCount ?? catalog.rounds.length }}회차 · {{ (catalog.questionCount ?? catalog.rounds.reduce((sum, round) => sum + round.questions.length, 0)).toLocaleString() }}문제</small>
                  </button>
                </div>
              </section>

              <section class="sunjae-study-ticket">
                <div class="sunjae-ticket-photo"><img :src="sunjaePortraitImageAt(1)" alt="공부 계획을 함께 고르는 선재"><p><strong>범위는 내가 정리해둘게.</strong><span>너는 시작 버튼만 눌러. 나랑 끝까지 가자.</span></p></div>
                <div class="sunjae-ticket-controls">
                  <header><span>02 · MAKE OUR PLAN</span><h2>우리 오늘 공부 약속</h2></header>
                  <div class="sunjae-ticket-presets"><button :class="{ active: quickPreset === 5 }" @click="applyPreset(5)">최근 5년</button><button :class="{ active: quickPreset === 10 }" @click="applyPreset(10)">최근 10년</button><button :class="{ active: quickPreset === 0 }" @click="applyPreset(0)">전체</button></div>
                  <div class="sunjae-ticket-fields">
                    <label><span>종목</span><select :value="selectedKey" @change="updateQualificationFromSetup"><option v-for="catalog in catalogs" :key="catalog.key" :value="catalog.key">{{ catalog.name }}</option></select></label>
                    <label><span>시작</span><select v-model.number="yearFrom"><option v-for="year in [...availableYears].reverse()" :key="year" :value="year">{{ year }}년</option></select></label>
                    <label><span>끝</span><select v-model.number="yearTo"><option v-for="year in availableYears" :key="year" :value="year">{{ year }}년</option></select></label>
                    <label><span>출제 체계</span><select v-model="curriculum"><option value="all-mapped">{{ selectedCatalog.isVirtual ? '통폐합 목표 과목 · 유사 보강 포함' : ((selectedKey === 'hvac' || selectedKey === 'hvac-hansol') ? '통합 3과목 · 구문제 포함' : (selectedKey === 'information-engineer' ? '현행 5과목 · 구문제 연결' : '전체 기출문제 포함')) }}</option><option v-if="!selectedCatalog.isVirtual" value="current">현재 과목 체계만</option><option v-if="selectedKey === 'hvac' || selectedKey === 'hvac-hansol'" value="legacy-original">구 4과목 원형</option><option v-if="selectedKey === 'information-engineer'" value="legacy-original">구 5과목 원형</option></select></label>
                  </div>
                  <div class="sunjae-ticket-summary"><span><b>{{ yearFrom }}~{{ yearTo }}</b>년</span><span><b>{{ rangeRounds.length }}</b>회차</span><span><b>{{ selectedItems.length.toLocaleString() }}</b>문제</span></div>
                </div>
              </section>

              <section class="sunjae-choose-together">
                <header><span>03 · WHAT SHALL WE DO?</span><h2>오늘 나랑 뭐 할래?</h2><p>네가 고르면 바로 옆에서 같이 시작할게.</p></header>
                <div>
                  <button type="button" @click="startRangeLearning"><img :src="sunjaePortraitImageAt(0)" alt=""><span>천천히 같이 보자</span><strong>학습모드</strong><small>즉시 채점 · 쉬운 해설</small></button>
                  <button type="button" @click="startRandomLearning60"><img :src="sunjaePortraitImageAt(0)" alt=""><span>오늘은 딱 60문제</span><strong>랜덤 60문제</strong><small>과목 균형 · 자동 이어하기</small></button>
                  <button type="button" @click="startBalancedExam"><img :src="sunjaePortraitImageAt(1)" alt=""><span>내가 채점해줄게</span><strong>랜덤시험</strong><small>과목 균형 · OMR · 타이머</small></button>
                  <button type="button" @click="openView('rounds')"><img :src="sunjaePortraitImageAt(2)" alt=""><span>원하는 날을 골라</span><strong>회차별 문제</strong><small>{{ yearFrom }}~{{ yearTo }}년</small></button>
                  <button type="button" @click="openView('wrong')"><img :src="sunjaePortraitImageAt(3)" alt=""><span>이번엔 같이 맞히자</span><strong>오답만 보기</strong><small>{{ stats.wrong.toLocaleString() }}문제 기다리는 중</small></button>
                </div>
              </section>

              <section class="sunjae-memory-wall">
                <div><span>04 · OUR RECORD</span><h2>우리 같이 달린 만큼</h2><p>오늘도 여기까지 온 거, 내가 다 기억하고 있어.</p><div class="progress-track"><i :style="{ width: `${stats.coverage}%` }" /></div><strong>{{ stats.coverage }}%</strong></div>
                <dl><div><dt>전체</dt><dd>{{ stats.total.toLocaleString() }}</dd></div><div><dt>푼 문제</dt><dd>{{ stats.answered.toLocaleString() }}</dd></div><div><dt>맞힌 문제</dt><dd>{{ stats.correct.toLocaleString() }}</dd></div><div><dt>북마크</dt><dd>{{ stats.bookmarks.toLocaleString() }}</dd></div></dl>
                <img :src="sunjaeImageAt(8)" alt="학습 기록 옆의 변우석 사진">
              </section>

              <section class="sunjae-release-note" :class="{ ready: updateAvailable }"><span>{{ updateAvailable ? '새 소식이 왔어' : `지금은 v${currentVersion} 최신이야` }}</span><strong>{{ updateAvailable ? '내가 새 화면을 준비했어. 같이 보러 갈래?' : '업데이트도 내가 확인해둘게.' }}</strong><div><button v-if="updateAvailable" @click="applyUpdate">새 버전 적용</button><button v-else :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '업데이트 확인' }}</button><button @click="openView('updates')">우리 기록 보기</button></div></section>
            </div>
          </section>

          <section v-else-if="visualStyle === 'simpsons'" class="simpsons-home-hero">
            <div class="simpsons-home-copy">
              <span>SPRINGFIELD STUDY MODE · 🍩</span>
              <h1>공부 안 하면<br><em>호머가 찾아옵니다!</em></h1>
              <p>기능과 학습 기록은 그대로 두고, 화면만 심슨풍 코믹 UI로 바꿨습니다. 설정에서 언제든 기본 화면으로 돌아갈 수 있습니다.</p>
              <div>
                <button type="button" @click="openView('rounds')">회차 풀기 →</button>
                <button type="button" @click="settingsOpen = true">테마 설정</button>
              </div>
            </div>
            <div class="simpsons-hero-gallery">
              <figure class="simpsons-hero-primary">
                <img :src="simpsonsThemeImage" alt="호머 심슨이 바트 심슨의 목을 조르는 장면" fetchpriority="high">
              </figure>
              <figure class="simpsons-hero-secondary">
                <img :src="simpsonsKingSizeImage" alt="꽃무늬 옷을 입은 뚱뚱한 호머 심슨 본편 장면" loading="lazy" decoding="async">
                <figcaption>일단 공부부터 시작!</figcaption>
              </figure>
              <div class="simpsons-scene-stack" aria-label="웃긴 심슨 본편 장면 모음">
                <figure v-for="(image, index) in simpsonsHeroScenes" :key="image"><img :src="image" :alt="`심슨 본편의 웃긴 장면 ${index + 1}`" loading="lazy" decoding="async"></figure>
              </div>
            </div>
          </section>
          <section v-else-if="visualStyle === 'sunjae'" class="sunjae-home-hero">
            <img :src="currentSunjaeImage" alt="선재 업고 튀어 류선재 단독 장면">
            <div class="sunjae-hero-copy"><span>LOVELY RUNNER STUDY MODE · ☂</span><h1>오늘도 나랑<br><em>같이 달릴래?</em></h1><p>동적 UI를 켜면 선재 전용 팬페이지 배치와 채점 연출을 볼 수 있어.</p><div class="sunjae-hero-actions"><button type="button" @click="openView('rounds')">나랑 회차 풀기 →</button><button type="button" @click="settingsOpen = true">동적 UI 설정</button></div></div>
          </section>
          <section v-if="visualStyle !== 'sunjae' || !dynamicUiEnabled" class="qualification-section">
            <div class="section-title">
              <div>
                <span>QUALIFICATIONS</span>
                <h1>준비할 종목을 선택하세요</h1>
                <p>선택 즉시 아래 과목, 연도 범위와 출제 문항이 바뀝니다.</p>
              </div>
              <div class="compact-stats">
                <span>학습<strong>{{ stats.answered.toLocaleString() }}</strong></span>
                <span>정답률<strong>{{ stats.accuracy }}%</strong></span>
                <span>오답<strong>{{ stats.wrong.toLocaleString() }}</strong></span>
              </div>
            </div>
            <div class="qualification-grid">
              <button
                v-for="(catalog, catalogIndex) in catalogs"
                :key="catalog.key"
                type="button"
                class="qualification-card"
                :class="[qualificationMeta[catalog.key]?.className, { selected: selectedKey === catalog.key }]"
                @click="selectQualification(catalog.key)"
              >
                <img v-if="visualStyle === 'sunjae'" class="sunjae-card-photo" :src="sunjaeImageAt(catalogIndex + 1)" alt="">
                <img v-else-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-card-photo" :src="simpsonsFunnyImageAt(catalogIndex)" alt="">
                <span class="qualification-icon">{{ qualificationMeta[catalog.key]?.icon }}</span>
                <span class="qualification-copy">
                  <strong>{{ catalog.name }}</strong>
                  <small>{{ catalog.roundCount ?? catalog.rounds.length }}회차 · {{ (catalog.questionCount ?? catalog.rounds.reduce((sum, round) => sum + round.questions.length, 0)).toLocaleString() }}문제</small>
                  <em>{{ qualificationMeta[catalog.key]?.description }}</em>
                </span>
                <b>›</b>
              </button>
            </div>
          </section>

          <section v-if="savedLearningSession" class="resume-learning-card">
            <div><span>자동 저장된 {{ savedLearningSession.mode === 'exam' ? 'CBT 시험' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ Object.keys(savedLearningSession.answers).length }} / {{ savedLearningSession.itemIds.length }}문제 풀이 · 다른 기기에서도 이어집니다</small></div>
            <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
            <button type="button" class="secondary" @click="clearSavedLearningSession">기록 지우기</button>
          </section>

          <section v-if="(visualStyle !== 'sunjae' || !dynamicUiEnabled) && selectedKey !== SCHOOL_EXAM_CATALOG_KEY" class="study-builder">
            <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-builder-mascot" :src="simpsonsFunnyImageAt(4)" alt="공부 계획을 확인하는 닥터 닉">
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
                  <option v-if="!selectedCatalog.isVirtual" value="current">현재 과목 체계만</option>
                  <option v-if="selectedKey === 'hvac' || selectedKey === 'hvac-hansol'" value="legacy-original">구 4과목 원형</option>
                  <option v-if="selectedKey === 'information-engineer'" value="legacy-original">구 5과목 원형</option>
                </select>
              </label>
            </div>

            <div class="scope-summary">
              <div><span>선택 범위</span><strong>{{ yearFrom }}~{{ yearTo }}년</strong><small>{{ rangeRounds.length }}회차 사용</small></div>
              <div><span>출제 가능</span><strong>{{ selectedItems.length.toLocaleString() }}문제</strong><small>과목별 균형 출제</small></div>
              <div><span>실전 구성</span><strong>{{ selectedSubjects.length }}과목 × 20문제</strong><small>{{ officialRule?.note || '공식 기준 확인 필요' }}</small></div>
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
                <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" :src="simpsonsFunnyImageAt(1)" alt="">
                <span>차근차근 익히기</span><strong>선택 범위 학습모드</strong><small>한 화면 {{ preferredPageSize }}문제 · 즉시 채점 · 쉬운 해설</small>
              </button>
              <button class="random-learning-start" type="button" @click="startRandomLearning60">
                <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" :src="simpsonsFunnyImageAt(8)" alt="">
                <span>연도 범위에서 골고루</span><strong>랜덤 60문제 학습</strong><small>{{ selectedKey === 'hvac' && includeHansolInRandom ? '일반 공조 + 한솔 후보' : '과목 균형' }} · 즉시 채점 · 자동 이어하기</small>
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
                <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" :src="simpsonsFunnyImageAt(5)" alt="">
                <span>실제 시험처럼</span><strong>과목 균형 랜덤시험</strong><small>과목별 20문제{{ selectedKey === 'hvac' && includeHansolInRandom ? ' · 한솔 후보 포함' : '' }} · OMR · 타이머</small>
              </button>
              <button class="round-start" type="button" @click="openView('rounds')">
                <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-action-photo" :src="simpsonsFunnyImageAt(7)" alt="">
                <span>연도 순서대로</span><strong>회차별 기출문제</strong><small>{{ yearFrom }}~{{ yearTo }}년 목록 보기</small>
              </button>
            </div>
          </section>

          <section v-if="visualStyle !== 'sunjae' || !dynamicUiEnabled" class="progress-panel">
            <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-progress-photo" :src="simpsonsFunnyImageAt(6)" alt="심슨 가족의 운동 장면">
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

          <section v-if="visualStyle !== 'sunjae' || !dynamicUiEnabled" class="home-release-card" :class="{ ready: updateAvailable }">
            <img v-if="visualStyle === 'simpsons' && dynamicUiEnabled" class="simpsons-release-photo" :src="simpsonsBurnsImage" alt="손가락을 맞댄 번즈">
            <div class="home-release-icon">{{ updateAvailable ? '↻' : '✓' }}</div>
            <div>
              <span>{{ updateAvailable ? 'NEW VERSION READY' : 'LATEST VERSION' }}</span>
              <strong>{{ updateAvailable ? '새 버전을 바로 적용할 수 있습니다' : `현재 v${currentVersion} 최신 버전을 사용 중입니다` }}</strong>
              <small>{{ updateAvailable ? '학습 기록은 유지되고 화면과 기능만 최신 상태로 바뀝니다.' : '새 업데이트가 있는지 언제든 다시 확인할 수 있습니다.' }}</small>
            </div>
            <div class="home-release-actions">
              <button v-if="updateAvailable" type="button" class="apply" @click="applyUpdate">신버전 적용</button>
              <button v-else type="button" :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '업데이트 확인' }}</button>
              <button type="button" @click="openView('updates')">패치노트 보기</button>
            </div>
          </section>
        </template>

        <template v-else-if="view === 'school'">
          <SchoolExamManager :data="schoolExamData" @update="updateSchoolExamData" @start="startSchoolExamRound" />
        </template>

        <template v-else-if="view === 'rounds'">
          <section class="rounds-heading">
            <div><span>PAST EXAMS</span><h1>{{ selectedCatalog.name }} 기출문제</h1><p>수록된 전체 {{ visibleRounds.length }}회차</p></div>
            <button type="button" @click="openView('home')">← 종목 선택으로</button>
          </section>
          <TransitionGroup name="list-shift" tag="div" class="round-grid">
            <article v-for="round in visibleRounds" :id="`round-card-${round.id}`" :key="round.id" class="round-card">
              <header><span>{{ round.shortQualification || round.qualification }}</span><b>{{ round.year }}년</b></header>
              <div v-if="roundRecordMap.get(round.id)" class="round-record-badge" :class="{ latest: lastRoundRecord?.roundId === round.id }">
                <span>{{ lastRoundRecord?.roundId === round.id ? '마지막으로 푼 회차' : '최근 CBT 기록' }}</span>
                <strong>{{ roundRecordMap.get(round.id)?.score }}점</strong>
                <small>{{ new Date(roundRecordMap.get(round.id)!.finishedAt).toLocaleDateString('ko-KR') }}</small>
              </div>
              <em v-if="isRestoredRound(round)" class="round-restored">CBT 복원문제 · 원문 이미지</em>
              <h2>{{ round.title }}</h2>
              <p>{{ round.questions.length }}문제 · {{ round.subjects.length }}과목 · 시험 {{ roundExamMinutes(round) }}분</p>
              <div class="round-subjects"><span v-for="subject in round.subjects" :key="subject">{{ subject }}</span></div>
              <div v-if="roundAnswered(round)" class="round-progress"><span><i :style="{ width: `${roundProgress(round)}%` }" /></span></div>
              <small v-if="roundAnswered(round)" class="round-progress-copy">{{ roundAnswered(round) }}/{{ round.questions.length }} 학습 중</small>
              <footer>
                <button type="button" @click="startRound(round, 'learn')">{{ roundAnswered(round) ? '이어 학습' : '학습모드' }}</button>
                <button v-if="roundAnswered(round)" type="button" class="round-restart-button" @click="restartRoundLearning(round)">처음부터</button>
                <button v-if="roundWrongGroupMap.get(round.id)" type="button" class="round-wrong-button" @click="openRoundWrongAnswers(round)">오답 {{ roundWrongGroupMap.get(round.id)?.items.length }}개</button>
                <button type="button" @click="startRound(round, 'exam')">CBT 시험모드</button>
              </footer>
            </article>
          </TransitionGroup>
        </template>

        <template v-else-if="view === 'history'">
          <section class="tool-hero history-hero">
            <div><span>LEARNING HISTORY</span><h1>풀었던 문제와 이어할 학습</h1><p>{{ selectedCatalog.name }} · 최근 완료 기록 {{ recentExamRecords.length }}개</p></div>
            <button v-if="savedLearningSession" type="button" @click="resumeSavedLearning">마지막 학습 이어하기</button>
          </section>
          <section v-if="savedLearningSession" class="history-resume-card">
            <div><span>진행 중 · {{ savedLearningSession.mode === 'exam' ? 'CBT 시험' : '학습' }}</span><strong>{{ savedLearningSession.title }}</strong><small>{{ new Date(savedLearningSession.savedAt).toLocaleString('ko-KR') }} · {{ Object.keys(savedLearningSession.answers).length }}/{{ savedLearningSession.itemIds.length }}문제</small></div>
            <button type="button" @click="resumeSavedLearning">이어서 풀기</button>
          </section>
          <div v-if="recentExamRecords.length" class="history-grid">
            <article v-for="record in recentExamRecords" :key="record.id">
              <header><span>{{ record.mode === 'exam' ? 'CBT 시험' : '학습모드' }}</span><time>{{ new Date(record.finishedAt).toLocaleString('ko-KR') }}</time></header>
              <h2>{{ record.title }}</h2>
              <div><strong>{{ record.score }}점</strong><span>{{ record.answered }}/{{ record.total }}문제 풀이</span><span>오답 {{ record.wrongAnswers?.length || 0 }}개</span></div>
              <footer><button type="button" @click="replayHistoryRecord(record)">같은 문제 다시 풀기</button></footer>
            </article>
          </div>
          <section v-else-if="!savedLearningSession" class="empty-state"><span>◴</span><h2>아직 학습 내역이 없습니다</h2><p>회차별 문제나 연도별 학습을 시작하면 여기에 날짜·점수·문제 수가 기록됩니다.</p><button @click="openView('rounds')">회차 선택하기</button></section>
        </template>

        <template v-else-if="view === 'wrong'">
          <section class="tool-hero wrong-hero">
            <div><span>WRONG ANSWERS BY ROUND</span><h1>회차별 오답만 골라 복습하세요</h1><p>{{ selectedCatalog.name }} · 선택한 회차 {{ displayedWrongItems.length }}문제</p></div>
            <button v-if="displayedWrongItems.length" type="button" @click="beginSession('learn', `${selectedCatalog.shortName || selectedCatalog.name} ${wrongTypeFilter === 'calculation' ? '계산 오답' : '회차별 오답'} 복습`, displayedWrongItems, {}, { calculationMode: wrongTypeFilter === 'calculation' })">{{ wrongTypeFilter === 'calculation' ? '계산 오답 다시 풀기' : '이 회차 오답 다시 풀기' }}</button>
          </section>
          <div v-if="wrongRoundGroups.length" class="wrong-round-filter" role="group" aria-label="오답 회차 선택">
            <button
              v-for="group in wrongRoundGroups"
              :key="group.roundId"
              type="button"
              :class="{ active: wrongRoundFilter === group.roundId }"
              @click="wrongRoundFilter = group.roundId"
            >
              <strong>{{ group.year }}년 {{ group.session || group.title.replace(/^.*?:\s*/, '') }}</strong>
              <span>{{ group.items.length }}문제 · 계산 오답 {{ group.items.filter(isCalculationItem).length }} · 기록 {{ group.attempts }}회</span>
            </button>
          </div>
          <div v-if="wrongItems.length" class="problem-kind-filter" role="group" aria-label="오답 종류 선택">
            <button type="button" :class="{ active: wrongTypeFilter === 'all' }" @click="wrongTypeFilter = 'all'">전체 오답 <strong>{{ wrongItems.length }}</strong></button>
            <button type="button" :class="{ active: wrongTypeFilter === 'calculation' }" @click="wrongTypeFilter = 'calculation'">계산 오답 <strong>{{ selectedWrongCalculationCount }}</strong></button>
          </div>
          <TransitionGroup v-if="displayedWrongItems.length" name="list-shift" tag="div" class="question-library">
            <article v-for="item in displayedWrongItems" :key="item.id">
              <header><span>{{ item.round.year }}년 · {{ item.subject }}</span><b>{{ item.question.number }}번</b></header>
              <p>{{ item.question.text || '원문 이미지 문제' }}</p>
              <footer>
                <span v-if="wrongAnswerDetailMap.get(item.id)">내 답 {{ wrongAnswerDetailMap.get(item.id)?.selected }}번 · 정답 {{ wrongAnswerDetailMap.get(item.id)?.answer }}번</span>
                <span v-else>{{ studyStore.attempts[item.id]?.wrongCount || 1 }}회 오답</span>
                <button type="button" @click="beginSession('learn', `${item.round.year}년 ${item.question.number}번 복습`, [item], {}, { calculationMode: isCalculationItem(item) })">다시 풀기 →</button>
              </footer>
            </article>
          </TransitionGroup>
          <section v-else class="empty-state"><span>✓</span><h2>{{ wrongTypeFilter === 'calculation' ? '이 회차에는 계산 오답이 없습니다' : '현재 오답이 없습니다' }}</h2><p>{{ wrongTypeFilter === 'calculation' ? '다른 회차를 선택하거나 전체 오답으로 바꿔 보세요.' : '학습모드에서 틀린 문제가 생기면 이곳에 자동으로 모입니다.' }}</p><button v-if="wrongTypeFilter === 'calculation'" @click="wrongTypeFilter = 'all'">전체 오답 보기</button><button v-else @click="openView('home')">학습 시작하기</button></section>
        </template>

        <template v-else-if="view === 'search'">
          <section class="search-command">
            <span>QUESTION FINDER</span>
            <h1>문제·보기·과목을 한 번에 검색</h1>
            <div>
              <b>⌕</b>
              <input v-model="searchQuery" type="search" placeholder="예: 냉동사이클, 레이놀즈수, 안전밸브" autofocus @input="requestSearch">
              <small>{{ searchReady ? `${selectedCatalog.name} 검색 준비 완료` : '문제 색인을 준비하는 중' }}</small>
            </div>
            <button
              type="button"
              class="bookmark-search-toggle"
              :class="{ active: searchBookmarksOnly }"
              :aria-pressed="searchBookmarksOnly"
              @click="searchBookmarksOnly = !searchBookmarksOnly"
            >★ {{ searchBookmarksOnly ? '즐겨찾기만 보는 중' : '즐겨찾기 문제만 보기' }}</button>
            <label v-if="searchBookmarksOnly" class="bookmark-round-filter">
              <span>즐겨찾기 회차</span>
              <select v-model="bookmarkRoundFilter">
                <option value="all">전체 회차 · {{ bookmarkedCatalogItems.length }}문제</option>
                <option v-for="round in bookmarkRounds" :key="round.id" :value="round.id">{{ round.label }} · {{ round.count }}문제</option>
              </select>
            </label>
          </section>
          <div class="search-summary">
            <span v-if="searchQuery.length < 2 && !searchBookmarksOnly">두 글자 이상 입력하면 바로 검색됩니다.</span>
            <span v-else><strong>{{ displayedSearchResults.length }}</strong>개의 {{ searchBookmarksOnly ? '즐겨찾기' : '검색' }} 결과</span>
          </div>
          <TransitionGroup v-if="displayedSearchResults.length" name="list-shift" tag="div" class="question-library search-library">
            <article v-for="item in displayedSearchResults" :key="item.id">
              <header><span>{{ item.round.year }}년 · {{ item.subject }}</span><b>{{ item.question.number }}번</b></header>
              <p>{{ item.question.text || '원문 이미지 문제' }}</p>
              <footer>
                <span>{{ item.round.session || item.round.title }}</span>
                <button type="button" @click="beginSession('learn', `${item.round.year}년 ${item.question.number}번`, [item])">문제 열기 →</button>
              </footer>
            </article>
          </TransitionGroup>
          <section v-else-if="searchBookmarksOnly" class="empty-state"><span>★</span><h2>조건에 맞는 즐겨찾기 문제가 없습니다</h2><p>문제의 별표를 눌러 저장하거나 검색어를 지워 보세요.</p></section>
          <section v-else-if="searchQuery.length >= 2" class="empty-state"><span>⌕</span><h2>일치하는 문제를 찾지 못했습니다</h2><p>검색어를 짧게 줄이거나 다른 용어로 입력해 보세요.</p></section>
        </template>

        <template v-else-if="view === 'calculation'">
          <section class="tool-hero calculation-hero">
            <div><span>FORMULA PRACTICE</span><h1>계산이 필요한 문제만 골라 푸세요</h1><p>{{ selectedCatalog.name }} · 현재 범위에서 {{ calculationRows.length.toLocaleString() }}문제 감지</p></div>
            <button type="button" :disabled="!filteredCalculationRows.length" @click="startCalculationLearning(20)">취약순 20문제 시작</button>
          </section>
          <section v-if="selectedCatalog.key === 'hvac' || selectedCatalog.key === 'hvac-hansol'" class="calculator-memory-sheet">
            <header>
              <div><span>FX-991EX MEMORY MAP</span><h2>전체 단위·공식 전에 보는 계산기 저장표</h2><p>AB 공기 · CD 물 · EF 온도와 습도 · XY 냉동톤 · M 힘과 수두</p></div>
              <strong>9개 저장</strong>
            </header>
            <div class="calculator-memory-groups">
              <article v-for="group in hvacCalculatorMemoryGroups" :key="group.key" :class="`memory-group-${group.key}`">
                <h3>{{ group.title }}</h3>
                <div>
                  <section v-for="item in hvacCalculatorMemory.filter((entry) => entry.group === group.key)" :key="item.variable">
                    <b>{{ item.variable }}</b>
                    <strong>{{ item.value }}</strong>
                    <span>{{ item.name }}</span>
                    <small>{{ item.unit }} · {{ item.use }}</small>
                  </section>
                </div>
              </article>
            </div>
            <details class="calculator-formula-sheet">
              <summary><span><b>∑</b><strong>저장한 A~M으로 자주 나온 공식 보기</strong><small>실제 공조 계산문제에서 반복된 유형 {{ hvacFrequentFormulas.length }}개</small></span><em>열기</em></summary>
              <div class="calculator-formula-grid">
                <article v-for="formula in hvacFrequentFormulas" :key="formula.title">
                  <header><span>{{ formula.frequency }}</span><h3>{{ formula.title }}</h3></header>
                  <p><b>구하는 것</b>{{ formula.target }}</p>
                  <strong class="formula-line">{{ formula.formula }}</strong>
                  <strong v-if="formula.calculatorFormula" class="stored-formula-line">저장값 사용: {{ formula.calculatorFormula }}</strong>
                  <ol><li v-for="step in formula.steps" :key="step">{{ step }}</li></ol>
                  <small v-if="formula.caution">주의 · {{ formula.caution }}</small>
                </article>
              </div>
            </details>
            <details class="formula-render-compare">
              <summary><span><b>ƒ</b><strong>계산식 텍스트 표시 비교</strong><small>기존 글자와 KaTeX 수식을 직접 비교</small></span><em>열기</em></summary>
              <div class="formula-render-grid">
                <article v-for="sample in formulaRenderSamples" :key="sample.title">
                  <h3>{{ sample.title }}</h3>
                  <img v-if="sample.sourceImage" class="formula-source-image restored-image-original" :src="sample.sourceImage" alt="PP-FormulaNet으로 인식한 공조 원문 수식">
                  <section><span>{{ sample.sourceImage ? 'PP-FormulaNet-plus-M 인식 LaTeX' : '기존 텍스트' }}</span><p>{{ sample.plain }}</p></section>
                  <section class="is-katex"><span>KaTeX</span><MathFormula :tex="sample.tex" :label="`${sample.title} 수식`" /></section>
                </article>
              </div>
              <p>PP-FormulaNet-plus-M을 Mac M4 Pro의 arm64 CPU로 실행한 실제 원문 샘플입니다. 자동 전수 적용은 오인식 검수 방식까지 비교한 뒤 결정합니다.</p>
            </details>
            <ul class="calculator-memory-notes"><li v-for="note in hvacCalculatorSheetNotes" :key="note">{{ note }}</li></ul>
          </section>
          <section class="calculation-filter-panel">
            <header><div><span>FILTER</span><h2>과목과 회차 선택</h2></div><strong>{{ filteredCalculationRows.length.toLocaleString() }}문제</strong></header>
            <div class="problem-kind-filter" role="group" aria-label="계산문제 학습 종류 선택">
              <button type="button" :class="{ active: calculationResultFilter === 'all' }" @click="calculationResultFilter = 'all'">전체 계산문제 <strong>{{ calculationRows.length.toLocaleString() }}</strong></button>
              <button type="button" :class="{ active: calculationResultFilter === 'wrong' }" @click="calculationResultFilter = 'wrong'">계산 오답 <strong>{{ calculationWrongRows.length.toLocaleString() }}</strong></button>
            </div>
            <div class="calculation-filter-grid">
              <label><span>과목</span><select v-model="calculationSubjectFilter"><option value="all">전체 과목</option><option v-for="subject in calculationSubjects" :key="subject" :value="subject">{{ subject }}</option></select></label>
              <label><span>회차</span><select v-model="calculationRoundFilter"><option value="all">전체 회차 · {{ calculationResultFilter === 'wrong' ? calculationWrongRows.length : calculationRows.length }}문제</option><option v-for="round in calculationRounds" :key="round.id" :value="round.id">{{ round.label }} · {{ calculationResultFilter === 'wrong' ? round.wrongCount : round.count }}문제</option></select></label>
              <button type="button" :disabled="!filteredCalculationRows.length" @click="startCalculationLearning()">{{ calculationResultFilter === 'wrong' ? '선택한 계산 오답 풀기 →' : '선택한 계산문제 전체 풀기 →' }}</button>
            </div>
            <p>문제 문장과 보기의 계산 키워드를 기준으로 자동 분류합니다. 계산 전용 학습에서는 정답 뒤에 공식과 숫자 출처, 계산 순서를 간단히 확인할 수 있습니다.</p>
          </section>
          <TransitionGroup v-if="filteredCalculationRows.length" name="list-shift" tag="div" class="question-library calculation-library">
            <article v-for="item in filteredCalculationRows.slice(0, 40)" :key="item.id">
              <header><span>{{ item.round.year }}년 · {{ item.subject }}</span><b>{{ item.question.number }}번</b></header>
              <p>{{ stripMarkup(item.question.text || item.question.html) || '원문 이미지 계산 문제' }}</p>
              <footer><span>{{ item.round.session || item.round.title }}</span><button type="button" @click="beginSession('learn', `${item.round.year}년 ${item.question.number}번 계산 풀이`, [item], {}, { calculationMode: true })">풀어보기 →</button></footer>
            </article>
          </TransitionGroup>
          <p v-if="filteredCalculationRows.length > 40" class="calculation-preview-note">목록은 처음 40문제만 미리 보여주며, ‘전체 풀기’에는 선택된 {{ filteredCalculationRows.length.toLocaleString() }}문제가 모두 포함됩니다.</p>
          <section v-else class="empty-state"><span>∑</span><h2>조건에 맞는 계산문제가 없습니다</h2><p>과목 또는 회차를 전체로 바꿔 보세요.</p></section>
        </template>

        <template v-else-if="view === 'guide' && activeStudyGuide">
          <section class="tool-hero guide-hero">
            <div><span>{{ activeStudyGuide.kicker }}</span><h1>{{ activeStudyGuide.title }}</h1><p>{{ activeStudyGuide.description }}</p></div>
            <button type="button" @click="openView('calculation')">계산문제로 연습 →</button>
          </section>
          <section class="guide-notice"><strong>사용법</strong><p>{{ activeStudyGuide.notice }}</p></section>
          <section v-if="activeStudyGuide.formulas.length" class="study-formula-grid">
            <article v-for="formula in activeStudyGuide.formulas" :key="formula.label">
              <span>{{ formula.label }}</span>
              <MathFormula :tex="formula.tex" :label="formula.label" />
              <p>{{ formula.note }}</p>
            </article>
          </section>
          <section v-if="selectedKey === 'hvac' || selectedKey === 'hvac-hansol'" class="field-report-practice">
            <div class="field-report-copy">
              <span>2026.08.22 · 비공식 실전 제보</span>
              <h2>제보 키워드로 만든 13문제</h2>
              <p>정확한 원문이 아닌 수험생 기억을 바탕으로 재구성했습니다. 저장소의 반복 기출과 대조한 개념만 문제로 만들었고, 문장이 불분명한 내용은 확정 정답처럼 단정하지 않았습니다.</p>
              <div class="field-report-stats"><strong>13문제</strong><span>공기조화 · 냉동 · 설치운영</span><span>정답 뒤 쉬운 해설</span></div>
              <button type="button" @click="startHvacFieldReportPractice">0822 실전 제보 문제 풀기 →</button>
            </div>
            <div class="field-report-related">
              <strong>저장소에서 찾은 유사 기출</strong>
              <ul>
                <li v-for="group in hvacFieldReportRelatedGroups" :key="group.topic"><b>{{ group.topic }}</b><span>{{ group.matches }}</span></li>
              </ul>
            </div>
          </section>
          <section v-if="hvacPracticalAvailable" class="practical-study-room">
            <header><div><span>LOGIN ONLY · WRITTEN PRACTICE</span><h2>공조냉동 실기 필답형 연습</h2><p>공개 필답형 대비 이미지 47문항을 원문과 대조해 답안을 교정하고, 기존 기초 연습 12문항도 함께 보존했습니다.</p></div><strong>{{ visiblePracticalPrompts.length }} / {{ practicalPrompts.length }}문제</strong></header>
            <div class="practical-source-links"><a v-for="source in practicalSources" :key="source.href" :href="source.href" target="_blank" rel="noreferrer">{{ source.label }} ↗</a></div>
            <div class="practical-filter-tabs" aria-label="필답형 문제 묶음 선택">
              <button type="button" :class="{ active: practicalPromptFilter === 'all' }" @click="practicalPromptFilter = 'all'">전체 59</button>
              <button type="button" :class="{ active: practicalPromptFilter === 'public' }" @click="practicalPromptFilter = 'public'">공개 자료 47</button>
              <button type="button" :class="{ active: practicalPromptFilter === 'foundation' }" @click="practicalPromptFilter = 'foundation'">기초 연습 12</button>
            </div>
            <div class="practical-question-grid">
              <details v-for="(prompt, index) in visiblePracticalPrompts" :key="prompt.id">
                <summary><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ prompt.question }}</strong><b>답 보기</b></summary>
                <div>
                  <img v-if="prompt.image" class="practical-prompt-image" :src="prompt.image" :alt="`공조냉동 필답형 ${index + 1}번 문제 그림`" loading="lazy">
                  <p><b>정답</b>{{ prompt.answer }}</p><p><b>쉬운 풀이</b>{{ prompt.explanation }}</p>
                  <small>{{ prompt.sourceNote }} <a v-if="prompt.sourceUrl" :href="prompt.sourceUrl" target="_blank" rel="noreferrer">원문 보기 ↗</a></small>
                </div>
              </details>
            </div>
          </section>
          <div class="hvac-guide-grid">
            <article v-for="(section, index) in activeStudyGuide.sections" :key="section.title">
              <header><span>{{ String(index + 1).padStart(2, '0') }}</span><h2>{{ section.title }}</h2></header>
              <p>{{ section.summary }}</p>
              <ul><li v-for="point in section.points" :key="point">{{ point }}</li></ul>
            </article>
          </div>
        </template>

        <template v-else-if="view === 'coach'">
          <section class="coach-hero">
            <div class="coach-aurora coach-aurora-one" />
            <div class="coach-aurora coach-aurora-two" />
            <div class="coach-orbit" aria-hidden="true"><i /><i /><i /></div>
            <div class="coach-hero-copy">
              <span class="coach-kicker"><b>✦</b> PASS INTELLIGENCE 2.0</span>
              <h1>기록이 쌓일수록<br><em>합격 전략이 선명해집니다</em></h1>
              <p>{{ selectedCatalog.name }} · {{ yearFrom }}~{{ yearTo }}년 기록을 분석해 지금 가장 점수가 오를 문제를 고릅니다.</p>
              <div class="coach-hero-badges">
                <span>학습 {{ coachAnswered.toLocaleString() }}문제</span>
                <span>분석 신뢰도 {{ coachConfidence }}</span>
                <span :class="{ danger: weakestSubject?.risk }">{{ weakestSubject?.risk ? '과락 위험 감지' : '과락 위험 안정' }}</span>
              </div>
            </div>
            <div class="coach-gauge-wrap">
              <div class="coach-gauge" :style="{ '--coach-angle': `${displayedPassChance * 3.6}deg` }">
                <div>
                  <span>예상 합격 가능성</span>
                  <strong>{{ displayedPassChance }}<small>%</small></strong>
                  <b>{{ passChance >= 70 ? '합격권' : passChance >= 40 ? '상승 구간' : '진단·보강 필요' }}</b>
                </div>
              </div>
              <small>학습 기록 기반 추정치 · 실제 결과를 보장하지 않음</small>
            </div>
          </section>

          <section class="coach-overview">
            <article class="coach-panel coach-score-panel">
              <header><div><span>READINESS SIGNAL</span><h2>현재 시험 준비도</h2></div><b>{{ coachConfidence }}</b></header>
              <div class="coach-metric-grid">
                <div><span>예상 점수</span><strong>{{ predictedScore }}<small>점</small></strong><i :style="{ width: `${predictedScore}%` }" /></div>
                <div><span>선택 범위 학습률</span><strong>{{ coachCoverage }}<small>%</small></strong><i :style="{ width: `${coachCoverage}%` }" /></div>
                <div><span>지금 복습</span><strong>{{ dueRows.length }}<small>문제</small></strong><i :style="{ width: `${Math.min(100, dueRows.length * 5)}%` }" /></div>
                <div><span>최근 모의평균</span><strong>{{ recentExamAverage ?? '—' }}<small>{{ recentExamAverage === null ? '' : '점' }}</small></strong><i :style="{ width: `${recentExamAverage || 0}%` }" /></div>
              </div>
              <p>정답률, 반복 횟수, 마지막 정오답, 경과 시간, 과목별 과락 위험과 최근 시험 점수를 함께 계산합니다.</p>
            </article>

            <article class="coach-panel coach-trend-panel">
              <header><div><span>EXAM TRAJECTORY</span><h2>최근 시험 흐름</h2></div><b>{{ officialExamRecords.length }}회</b></header>
              <div v-if="officialExamRecords.length" class="coach-trend-chart">
                <div v-for="record in [...officialExamRecords.slice(0, 7)].reverse()" :key="record.id">
                  <span :class="{ pass: record.passed }" :style="{ height: `${Math.max(8, record.score)}%` }"><b>{{ record.score }}</b></span>
                  <time>{{ new Date(record.finishedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) }}</time>
                </div>
                <i class="coach-pass-line"><span>60점</span></i>
              </div>
              <div v-else class="coach-empty-trend">
                <span>◎</span>
                <strong>아직 모의시험 기록이 없습니다</strong>
                <small>한 번만 풀어도 예측 정확도가 크게 올라갑니다.</small>
                <button type="button" @click="startCoachPlan('exam')">첫 진단시험 시작</button>
              </div>
            </article>
          </section>

          <section class="coach-action-section">
            <header>
              <div><span>ADAPTIVE TRAINING</span><h2>지금 점수가 가장 빨리 오르는 훈련</h2></div>
              <p>현재 기록을 기준으로 문제 순서가 자동으로 다시 계산됩니다.</p>
            </header>
            <div class="coach-plan-grid">
              <button
                v-for="plan in coachPlans"
                :key="plan.key"
                type="button"
                class="coach-plan"
                :class="`coach-plan-${plan.tone}`"
                :disabled="!plan.count"
                @click="startCoachPlan(plan.key)"
              >
                <span>{{ plan.eyebrow }}</span>
                <strong>{{ plan.title }}</strong>
                <p>{{ plan.description }}</p>
                <footer><b>{{ plan.count }}문제</b><em>시작하기 →</em></footer>
              </button>
            </div>
          </section>

          <section class="coach-detail-grid">
            <article class="coach-panel coach-subject-panel">
              <header><div><span>SUBJECT SHIELD</span><h2>과목별 과락 방어선</h2></div><small>40점 미만 위험 표시</small></header>
              <div class="coach-subject-list">
                <button
                  v-for="row in coachSubjectRows"
                  :key="row.subject"
                  type="button"
                  class="coach-subject-card"
                  :class="{ risk: row.risk }"
                  @click="startCoachSubject(row.subject)"
                >
                  <div><span>{{ row.risk ? '위험' : '안정' }}</span><strong>{{ row.subject }}</strong><small>{{ row.answered }}/{{ row.total }}문제 학습 · 숙련도 {{ row.mastery }}%</small></div>
                  <div class="coach-readiness-ring" :style="{ '--readiness-angle': `${row.predicted * 3.6}deg` }"><strong>{{ row.predicted }}</strong><small>예상점수</small></div>
                </button>
              </div>
            </article>

            <article class="coach-panel coach-memory-panel">
              <header><div><span>MEMORY QUEUE</span><h2>망각곡선 복습 대기열</h2></div><small>문제를 풀 때마다 자동 변경</small></header>
              <div class="coach-review-schedule">
                <div v-for="bucket in reviewSchedule" :key="bucket.label" :class="`review-${bucket.tone}`">
                  <span><i />{{ bucket.label }}</span>
                  <strong>{{ bucket.count }}<small>문제</small></strong>
                </div>
              </div>
              <div class="coach-memory-note">
                <b>작동 방식</b>
                <p>맞히고 반복할수록 복습 간격을 늘리고, 틀리면 오늘 대기열 맨 앞으로 되돌립니다. 인터넷 없이도 이 기기의 기록으로 계속 계산합니다.</p>
              </div>
            </article>
          </section>
        </template>

        <template v-else-if="view === 'beta'">
          <section class="beta-lab-hero">
            <div>
              <span><b>β</b> OPTIONAL LEARNING TOOLS</span>
              <h1>기존 CBT와 바로 비교하는<br><em>베타 학습 도구</em></h1>
              <p>문제와 정답 데이터는 건드리지 않고 확신도·실수 원인·내 메모만 별도로 저장합니다. 설정에서 전체 OFF하면 기존 화면으로 즉시 돌아갑니다.</p>
              <div><button type="button" @click="startBetaTrial">5문제로 비교하기</button><button type="button" class="secondary" @click="settingsOpen = true">전체 ON/OFF 설정</button></div>
            </div>
            <aside>
              <strong>실험 기능 전체 ON</strong>
              <span>기존 학습 기록 유지</span>
              <small>OFF해도 베타 기록은 삭제하지 않습니다.</small>
            </aside>
          </section>

          <section class="beta-mode-compare" aria-label="학습모드와 CBT모드 기록 선택">
            <button v-for="summary in betaModeSummaries" :key="summary.mode" type="button" :class="{ active: betaModeFilter === summary.mode }" @click="betaModeFilter = summary.mode">
              <span>{{ summary.mode === 'learn' ? 'LEARNING MODE' : 'CBT MODE' }}</span>
              <strong>{{ summary.mode === 'learn' ? '학습모드 기록' : 'CBT모드 기록' }}</strong>
              <div><small>확신 <b>{{ summary.sure }}</b></small><small>애매 <b>{{ summary.unsure }}</b></small><small>찍음 <b>{{ summary.guess }}</b></small><small>자동 취약 <b>{{ summary.weak }}</b></small></div>
            </button>
          </section>

          <section class="beta-summary-grid">
            <article><span>{{ betaModeFilter === 'learn' ? '학습' : 'CBT' }} 애매·찍음</span><strong>{{ betaLowConfidenceRows.length }}</strong><small>확신 낮은 문제</small></article>
            <article><span>내 메모</span><strong>{{ betaMemoRows.length }}</strong><small>동기화되는 문제 메모</small></article>
            <article><span>확신 오답</span><strong>{{ betaFalseConfidenceRows.length }}</strong><small>알았다고 생각했지만 틀림</small></article>
            <article><span>자동 취약</span><strong>{{ betaWeakRows.length }}</strong><small>오답·확신도를 함께 분석</small></article>
          </section>

          <section class="beta-review-grid">
            <button type="button" :disabled="!betaLowConfidenceRows.length" @click="startBetaReview('confidence')">
              <span>01 · CONFIDENCE</span><strong>애매·찍음 다시 풀기</strong><p>정답 여부와 별개로 확신이 없었던 문제를 최대 20개 다시 냅니다.</p><b>{{ betaLowConfidenceRows.length }}문제 →</b>
            </button>
            <button type="button" :disabled="!betaFalseConfidenceRows.length" @click="startBetaReview('false-confidence')">
              <span>02 · BLIND SPOT</span><strong>확신했지만 틀린 문제</strong><p>잘못 알고 있던 개념을 일반 오답보다 먼저 찾아냅니다.</p><b>{{ betaFalseConfidenceRows.length }}문제 →</b>
            </button>
            <button type="button" :disabled="!betaMemoRows.length" @click="startBetaReview('memo')">
              <span>03 · MY NOTE</span><strong>메모한 문제 모아 풀기</strong><p>문제마다 적은 공식·주의점을 유지한 채 다시 학습합니다.</p><b>{{ betaMemoRows.length }}문제 →</b>
            </button>
            <button type="button" :disabled="!betaWeakRows.length" @click="startBetaReview('weak')">
              <span>04 · WEAKNESS ENGINE</span><strong>{{ betaModeFilter === 'learn' ? '학습' : 'CBT' }} 취약 문제 자동 검출</strong><p>오답률, 최근 오답, 애매·찍음, 확신 오답을 합쳐 약한 문제부터 냅니다.</p><b>{{ betaWeakRows.length }}문제 →</b>
            </button>
          </section>

          <section class="beta-reason-panel">
            <header><div><span>MISTAKE MAP</span><h2>실수 원인별 복습</h2></div><p>풀이 화면에서 이유를 눌러야 이곳에 모입니다.</p></header>
            <div>
              <button v-for="row in betaReasonRows" :key="row.key" type="button" :disabled="!row.count" @click="startBetaReview(row.key)"><span>{{ row.label }}</span><strong>{{ row.count }}</strong><small>문제 다시 풀기 →</small></button>
            </div>
          </section>

          <section class="beta-compare-panel">
            <div><b>ON</b><strong>문제 아래에 확신도·실수 원인·내 메모가 표시됩니다.</strong><span>시험모드에서는 답안 속도를 계산해 완료 예상과 시간 여유를 보여 줍니다.</span></div>
            <div><b>OFF</b><strong>v3.5.4와 같은 기존 문제풀이 화면으로 돌아갑니다.</strong><span>추가 버튼과 베타 메뉴만 숨고 답안·오답·메모 기록은 보존됩니다.</span></div>
          </section>
        </template>

        <template v-else-if="view === 'showcase'">
          <section class="feature-hero">
            <div class="feature-orb feature-orb-one" />
            <div class="feature-orb feature-orb-two" />
            <div class="feature-hero-copy">
              <span><b>NEW</b> INTERACTIVE LEARNING LAB · v{{ currentVersion }}</span>
              <h1>새 기능을 바로 배우고 눌러보는<br><em>신기술 학습관</em></h1>
              <p>정식으로 적용된 문제풀이와 화면 기능을 한곳에서 익힐 수 있습니다.</p>
              <div>
                <button type="button" @click="openView('rounds')">3분 체험 시작 →</button>
                <button type="button" @click="openView('updates')">← 패치노트로</button>
              </div>
            </div>
            <div class="feature-pulse">
              <i /><i /><i />
              <strong>LIVE</strong>
              <span>Vue Motion</span>
            </div>
          </section>

          <section class="feature-layout-lab">
            <header>
              <div><span>LATEST EXPERIENCE · v{{ currentVersion }}</span><h2>시험 직전 공조 도구</h2></div>
              <p>이번 버전의 쉬운 계산 암기장, 즐겨찾기 문제 모아보기와 COMCBT 제출 동선을 바로 체험할 수 있습니다.</p>
            </header>
            <div>
              <button type="button" @click="openView('guide')"><b>SI</b><strong>초등 계산 암기장</strong><span>열량 · COP · 냉각수 · 송풍기 공식</span></button>
              <button type="button" @click="searchBookmarksOnly = true; openView('search')"><b>★</b><strong>즐겨찾기만 보기</strong><span>검색어 없이 저장한 문제만 모아보기</span></button>
              <button type="button" :class="{ active: solveLayoutMode === 'comcbt' }" @click="setSolveLayoutMode('comcbt')"><b>COM</b><strong>제출 버튼 체험</strong><span>학습 결과 · 시험 제출을 하단에서 바로</span></button>
            </div>
            <footer><strong>한솔·공조 해설 보강</strong><span>쉬운 핵심 해설을 먼저 읽고, 확인된 COMCBT 동일 문제 해설은 아래에서 함께 볼 수 있습니다.</span></footer>
          </section>

          <section class="feature-theme-preview">
            <div>
              <span>LATEST EXPERIENCE · v{{ currentVersion }}</span>
              <h2>테마와 동적 UI를 직접 바꿔보세요</h2>
              <p>동적 UI는 기본으로 켜지며 화면이 움직이고 카드 배치가 달라집니다. 끄면 v2.4.2 방식의 기존 배치로 돌아가고, 심슨 테마는 학습 기록을 건드리지 않은 채 유지됩니다.</p>
              <div>
                <button type="button" @click="settingsOpen = true">⚙ 테마 설정 열기</button>
                <button type="button" :class="{ active: dynamicUiEnabled }" @click="setDynamicUiEnabled(true)">동적 UI ON</button>
                <button type="button" :class="{ active: !dynamicUiEnabled }" @click="setDynamicUiEnabled(false)">기존 UI로</button>
              </div>
            </div>
            <figure>
              <img :src="simpsonsThemeImage" alt="호머 심슨이 바트 심슨의 목을 조르는 장면" loading="lazy" decoding="async">
            </figure>
          </section>

          <section class="feature-layout-lab">
            <header>
              <div><span>LATEST EXPERIENCE · v{{ currentVersion }}</span><h2>세 가지 문제풀이 화면</h2></div>
              <p>선택한 화면은 다음 학습과 CBT부터 적용되며 풀이 중 설정에서도 바로 바꿀 수 있습니다.</p>
            </header>
            <div>
              <button type="button" :class="{ active: solveLayoutMode === 'standard' }" @click="setSolveLayoutMode('standard')"><b>CBT</b><strong>기본 CBT</strong><span>기존 v2.7 카드형 · 기본값</span></button>
              <button type="button" :class="{ active: solveLayoutMode === 'comcbt' }" @click="setSolveLayoutMode('comcbt')"><b>COM</b><strong>COMCBT 모드</strong><span>고밀도 2열 · 고정 OMR · 빠른 이동</span></button>
              <button type="button" class="combat" :class="{ active: solveLayoutMode === 'combat' }" @click="setSolveLayoutMode('combat')"><b>⚡</b><strong>컴뱃 CBT</strong><span>진행 HUD · 4문제 연속 · 미션형 화면</span></button>
            </div>
            <footer><strong>COMCBT 전용 키보드</strong><span>1~4 답 선택 · ←/→ 이동 · K 킵 · B 북마크 · E 해설</span></footer>
          </section>

          <section class="feature-upscale-compare">
            <header>
              <div><span>LATEST EXPERIENCE · v{{ currentVersion }}</span><h2>원본과 업스케일링 후를 직접 비교하세요</h2></div>
              <p>Real-ESRGAN 4배 처리 후 2배 bicubic 축소 · Mac M4 Pro · 256px 타일</p>
            </header>
            <div class="upscale-compare-grid">
              <button
                type="button"
                class="upscale-compare-card original"
                :aria-label="`${upscaleComparison.subject} 원본 크게 보기`"
                @click="upscalePreviewKind = 'original'"
              >
                <div><span>BEFORE</span><strong>원본</strong><small>{{ upscaleComparison.originalSize }}</small></div>
                <figure><img :src="upscaleComparison.original" :alt="`${upscaleComparison.subject} 업스케일링 전 원본`"></figure>
                <b>눌러서 크게 보기 ⌕</b>
              </button>
              <button
                type="button"
                class="upscale-compare-card improved"
                :aria-label="`${upscaleComparison.subject} 업스케일링 후 크게 보기`"
                @click="upscalePreviewKind = 'improved'"
              >
                <div><span>AFTER</span><strong>업스케일링 후</strong><small>{{ upscaleComparison.improvedSize }}</small></div>
                <figure><img :src="upscaleComparison.improved" :alt="`${upscaleComparison.subject} 업스케일링 후`"></figure>
                <b>눌러서 크게 보기 ⌕</b>
              </button>
            </div>
            <footer>
              <strong>{{ upscaleComparison.subject }}</strong>
              <span>{{ upscaleComparison.count }}에 같은 처리 기준을 적용했으며, 기존 원본 파일은 그대로 보존했습니다.</span>
            </footer>
          </section>

          <section v-if="!isJewelry" class="feature-restored-dark">
            <header>
              <div><span>LATEST EXPERIENCE · v{{ currentVersion }}</span><h2>복원문제 다크 이미지를 눈으로 비교하세요</h2></div>
              <p>원본 파일과 답안 좌표는 바꾸지 않고 화면 색상만 전환합니다.</p>
            </header>
            <div class="restored-dark-preview-grid">
              <button type="button" class="restored-dark-preview original" :class="{ active: restoredImageTheme === 'original' }" @click="setRestoredImageTheme('original')">
                <figure><img :src="restoredDarkPreviewImage" alt="원본 흰색 복원문제 수식 예시" loading="lazy" decoding="async"></figure>
                <strong>항상 원본</strong><small>흰 문제지 그대로</small>
              </button>
              <button type="button" class="restored-dark-preview comfort" :class="{ active: restoredImageTheme === 'auto' }" @click="setRestoredImageTheme('auto')">
                <figure><img :src="restoredDarkPreviewImage" alt="눈부심을 줄인 남색 복원문제 수식 예시" loading="lazy" decoding="async"></figure>
                <strong>눈부심 완화</strong><small>추천 · 짙은 남색</small>
              </button>
            </div>
            <footer><strong>설정 위치</strong><span>화면·데이터 설정과 풀이 중 설정에서 언제든 바꿀 수 있습니다. 선택한 방식은 다크 모드에서 적용됩니다.</span></footer>
          </section>

          <Teleport to="body">
            <div
              v-if="upscalePreview"
              class="question-image-lightbox"
              role="dialog"
              aria-modal="true"
              :aria-label="`${upscalePreview.title} 확대`"
              @click="upscalePreviewKind = null"
            >
              <header @click.stop>
                <strong>{{ upscalePreview.title }}</strong>
                <span>{{ upscalePreview.size }} · 문제 풀이 화면과 같은 크게 보기</span>
                <button type="button" aria-label="확대 이미지 닫기" @click="upscalePreviewKind = null">×</button>
              </header>
              <div @click.self="upscalePreviewKind = null">
                <img :src="upscalePreview.src" :alt="`${upscalePreview.title} 확대`">
              </div>
            </div>
          </Teleport>

          <section class="feature-tour">
            <header><div><span>3-MINUTE TOUR</span><h2>이번에 정식 적용된 기능 네 가지</h2></div><p>베타 전환 없이 실제 문제풀이에서 바로 사용할 수 있습니다.</p></header>
            <div class="feature-tour-grid">
              <article class="feature-tour-card blue">
                <b>01</b><span>PADDLE OCR</span><h3>여러 줄 보기도 한 박스로 선택</h3>
                <p>두 줄·세 줄 답안의 전체 글자를 하나의 정확한 박스로 묶어 누릅니다.</p>
                <button type="button" @click="setAnswerLayout('hotspot'); setHotspotIndicator('area')">이미지 답안 강조 켜기 →</button>
              </article>
              <article class="feature-tour-card violet">
                <b>02</b><span>IN-SESSION SETTINGS</span><h3>풀이 중에도 설정</h3>
                <p>답안과 타이머를 유지하면서 테마·글씨·답안 배치·OMR을 바로 바꿉니다.</p>
                <button type="button" @click="startFeatureRound('learn')">학습 화면에서 체험 →</button>
              </article>
              <article class="feature-tour-card mint">
                <b>03</b><span>SMART OMR</span><h3>현재 문제 자동 따라가기</h3>
                <p>CBT에서 다음 문제로 이동하면 OMR도 필요한 때만 부드럽게 따라옵니다.</p>
                <button type="button" @click="startFeatureRound('exam')">실전 CBT에서 체험 →</button>
              </article>
              <article v-if="!isJewelry" class="feature-tour-card midnight">
                <b>04</b><span>RESTORED IMAGE DARK</span><h3>복원문제까지 편안한 다크</h3>
                <p>원본 이미지와 답안 좌표는 보존하고 눈부심 완화·원본 중 원하는 표시를 고릅니다.</p>
                <button type="button" @click="theme = 'dark'; applyTheme(theme); setRestoredImageTheme('auto')">눈부심 완화 체험 →</button>
              </article>
            </div>
          </section>

          <section class="feature-action-section">
            <header><div><span>QUICK EXPERIENCE</span><h2>한 번 눌러 바로 체감하기</h2></div></header>
            <div class="feature-action-grid">
              <button type="button" class="feature-action-card simpsons" @click="settingsOpen = true">
                <span>⚙</span><div><strong>테마 설정 열기</strong><small>{{ isJewelry ? '기본·심슨·선재 UI 선택' : '기본·심슨 UI 선택' }}</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card motion" @click="setDynamicUiEnabled(!dynamicUiEnabled)">
                <span>{{ dynamicUiEnabled ? 'ON' : 'OFF' }}</span><div><strong>{{ dynamicUiEnabled ? '기존 UI로 돌아가기' : '동적 UI 켜기' }}</strong><small>새 배치와 모션 한 번에 전환</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card exam" @click="setAnswerLayout('hotspot')">
                <span>☝</span><div><strong>{{ answerLayout === 'hotspot' ? '이미지 직접 선택 사용 중' : '이미지에서 답 고르기' }}</strong><small>원문 속 ①·②·③·④를 바로 선택</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card coach" @click="setAnswerLayout('hotspot'); setHotspotIndicator('area')">
                <span>▰</span><div><strong>PaddleOCR 답안 박스</strong><small>여러 줄 답안도 한 박스로 선택</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card sun" @click="toggleLightDark">
                <span>{{ darkActive ? '☀' : '☾' }}</span><div><strong>{{ darkActive ? '라이트 모드로' : '다크 모드로' }}</strong><small>전체 테마 즉시 전환</small></div><b>›</b>
              </button>
              <button v-if="!isJewelry" type="button" class="feature-action-card midnight" @click="settingsOpen = true">
                <span>◐</span><div><strong>복원 이미지 다크 설정</strong><small>눈부심 완화·원본 중 선택</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card calc" @click="openCalculator">
                <span>▦</span><div><strong>공학용 계산기</strong><small>별도 팝업으로 실행</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card coach" @click="openView('coach')">
                <span>✦</span><div><strong>합격 엔진</strong><small>예상 점수와 취약 과목</small></div><b>›</b>
              </button>
              <button type="button" class="feature-action-card exam" @click="startFeatureRound('exam')">
                <span>OMR</span><div><strong>실전 CBT</strong><small>최신 회차 시험 화면</small></div><b>›</b>
              </button>
            </div>
          </section>

          <section class="feature-latest">
            <header><div><span>LATEST CHANGES</span><h2>v{{ patchEntries[0]?.version }} 핵심 변경점</h2></div><button type="button" @click="openView('updates')">전체 패치노트 →</button></header>
            <ul><li v-for="change in patchEntries[0]?.changes || []" :key="change">{{ change }}</li></ul>
          </section>
        </template>

        <template v-else-if="view === 'stats'">
          <section class="stats-hero">
            <div><span>LEARNING REPORT</span><h1>{{ selectedCatalog.name }} 학습 통계</h1><p>기존 CBT에서 푼 기록과 새 화면의 기록을 함께 표시합니다.</p></div>
            <strong>{{ stats.accuracy }}<small>%</small></strong>
          </section>
          <section class="stats-grid">
            <article><span>전체 문제</span><strong>{{ stats.total.toLocaleString() }}</strong><small>수록 문항</small></article>
            <article><span>학습 문제</span><strong>{{ stats.answered.toLocaleString() }}</strong><small>학습률 {{ stats.coverage }}%</small></article>
            <article><span>맞힌 문제</span><strong>{{ stats.correct.toLocaleString() }}</strong><small>최근 선택 기준</small></article>
            <article><span>복습 필요</span><strong>{{ stats.wrong.toLocaleString() }}</strong><small>현재 오답</small></article>
          </section>
          <section class="subject-report">
            <header><div><span>SUBJECT ANALYSIS</span><h2>과목별 학습 현황</h2></div><small>최근 선택한 답 기준</small></header>
            <div v-for="row in subjectStats" :key="row.subject" class="subject-row">
              <div><strong>{{ row.subject }}</strong><span>{{ row.answered.toLocaleString() }}/{{ row.total.toLocaleString() }}문제 학습</span></div>
              <div class="subject-bar"><i :style="{ width: `${row.accuracy}%` }" /></div>
              <b>{{ row.accuracy }}%</b>
            </div>
          </section>
        </template>

        <template v-else>
          <section class="patch-heading">
            <div><span>RELEASE NOTES</span><h1>{{ spaceName }} 패치노트</h1><p>새 기능과 수정 내용을 버전별로 확인할 수 있습니다.</p></div>
            <div class="patch-version-actions">
              <strong>v{{ currentVersion }}</strong>
              <button v-if="savedLearningSession" type="button" class="resume-after-update" @click="resumeSavedLearning">▶ 저장한 문제 이어서 풀기</button>
              <button type="button" class="feature-lab-entry" @click="openView('showcase')">◉ 신기술 학습관 NEW</button>
              <button type="button" :disabled="updateChecking" @click="checkForUpdate(true)">{{ updateChecking ? '확인 중…' : '최신 버전 확인' }}</button>
            </div>
          </section>
          <section v-if="showAndroidApkPatchDownload" class="patch-apk-download" aria-labelledby="patch-apk-download-title">
            <div class="android-app-mark" aria-hidden="true">
              <svg viewBox="0 0 48 48" role="img">
                <path d="M15 18h18a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5H15a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5Z" />
                <path d="m16 18-3-5m19 5 3-5M18 12h12a4 4 0 0 1 4 4v2H14v-2a4 4 0 0 1 4-4Z" />
                <circle cx="19" cy="15" r="1.3" /><circle cx="29" cy="15" r="1.3" />
              </svg>
            </div>
            <div>
              <span>ANDROID APP</span>
              <strong id="patch-apk-download-title">휴대폰·태블릿용 정식 APK</strong>
              <small>Android 7.0 이상 · 약 8MB · 최신 버전으로 교체 설치할 수 있습니다.</small>
            </div>
            <a :href="androidApkUrl" target="_blank" rel="noopener" aria-label="Android 전용 CBT 정식 APK 받기">정식 APK 받기 <b aria-hidden="true">↓</b></a>
          </section>
          <section v-if="showIosPwaPrompt" class="patch-apk-download ios-pwa-patch" aria-labelledby="ios-pwa-patch-title">
            <div class="ios-pwa-app-mark" aria-hidden="true">CBT</div>
            <div>
              <span>IPHONE · IPAD 무료</span>
              <strong id="ios-pwa-patch-title">7일 만료 없는 홈 화면 앱</strong>
              <small>Safari에서 한 번 설치하면 주소창 없이 실행되고 웹 업데이트가 자동 적용됩니다.</small>
            </div>
            <button type="button" @click="iosPwaInstallOpen = true">설치 방법 보기</button>
          </section>
          <div class="patch-timeline">
            <article v-for="(entry, index) in patchEntries" :key="`${entry.version}-${entry.title}`" :class="{ latest: index === 0 }">
              <div class="patch-version"><span>v{{ entry.version }}</span><small>{{ entry.date }}</small></div>
              <div>
                <header><h2>{{ entry.title }}</h2><b v-if="index === 0">최신</b></header>
                <p>{{ entry.summary }}</p>
                <div class="patch-tags"><span v-for="tag in entry.tags || []" :key="tag">{{ tag }}</span></div>
                <ul><li v-for="change in entry.changes || []" :key="change">{{ change }}</li></ul>
              </div>
            </article>
          </div>
        </template>
          </div>
        </Transition>
      </div>
    </main>
    <button v-if="showAndroidApkPopup" type="button" class="android-apk-floating-trigger" aria-label="Android 앱 다운로드 안내 열기" @click="androidApkPopupOpen = true">
      <span>ANDROID</span><strong>앱 받기</strong>
    </button>
    <button v-if="showIosPwaPrompt" type="button" class="ios-pwa-floating-trigger" aria-label="iPhone 앱 설치 안내 열기" @click="iosPwaInstallOpen = true">
      <span>IPHONE · IPAD</span><strong>무료 앱 설치</strong>
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
            <a :href="androidApkUrl" target="_blank" rel="noopener" @click="androidApkPopupOpen = false">정식 APK 다운로드 <b aria-hidden="true">↓</b></a>
          </div>
        </section>
      </div>
    </Transition>
    <Transition name="modal-fade">
      <div v-if="showIosPwaPrompt && iosPwaInstallOpen" class="android-apk-popup-backdrop" @click.self="iosPwaInstallOpen = false">
        <section class="android-apk-popup ios-pwa-popup" role="dialog" aria-modal="true" aria-labelledby="ios-pwa-popup-title">
          <button type="button" class="android-apk-popup-close" aria-label="iPhone 앱 설치 안내 닫기" @click="iosPwaInstallOpen = false">×</button>
          <div class="ios-pwa-app-mark" aria-hidden="true">CBT</div>
          <span>완전 무료 · 7일 만료 없음</span>
          <h2 id="ios-pwa-popup-title">홈 화면에 CBT 앱 설치</h2>
          <p v-if="isIosSafari">Safari에서 아래 순서대로 한 번만 설정하면 주소창 없이 앱처럼 실행됩니다.</p>
          <p v-else class="ios-pwa-browser-warning"><strong>먼저 Safari로 이 홈페이지를 열어주세요.</strong><br>현재 브라우저에서는 설치 메뉴의 위치가 다르거나 보이지 않을 수 있습니다.</p>
          <ol class="ios-pwa-steps">
            <li><b>1</b><span>Safari 아래쪽의 <strong>공유</strong> <i aria-hidden="true">□↑</i> 버튼 누르기</span></li>
            <li><b>2</b><span>메뉴를 내려 <strong>홈 화면에 추가</strong> 선택하기</span></li>
            <li><b>3</b><span><strong>웹 앱으로 열기</strong>를 켠 뒤 <strong>추가</strong> 누르기</span></li>
          </ol>
          <small>설치 후에는 이 안내가 표시되지 않으며 홈페이지 업데이트도 자동으로 적용됩니다.</small>
          <div class="android-apk-popup-actions ios-pwa-popup-actions">
            <button type="button" @click="iosPwaInstallOpen = false">나중에</button>
            <button type="button" class="ios-pwa-ready" @click="iosPwaInstallOpen = false">설치 방법 확인</button>
          </div>
        </section>
      </div>
    </Transition>
    <nav class="mobile-tabbar">
      <button :class="{ active: view === 'home' }" @click="openView('home')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(0)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-home-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(0)" alt=""><template v-else>⌂</template></span>홈</button>
      <button :class="{ active: view === 'rounds' }" @click="openView('rounds')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(1)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-rounds-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(1)" alt=""><template v-else>▤</template></span>회차</button>
      <button :class="{ active: view === 'wrong' }" @click="openView('wrong')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(2)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-wrong-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(2)" alt=""><template v-else>!</template></span>오답</button>
      <button :class="{ active: view === 'search' }" @click="openView('search')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(3)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-search-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(3)" alt=""><template v-else>⌕</template></span>검색</button>
      <button :class="{ active: view === 'coach' }" @click="openView('coach')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsBurnsImage" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-coach-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(0)" alt=""><template v-else>✦</template></span>합격</button>
      <button :class="{ active: view === 'stats' }" @click="openView('stats')"><span><img v-if="visualStyle === 'simpsons'" :src="simpsonsFunnyImageAt(5)" alt=""><img v-else-if="visualStyle === 'sunjae'" :key="`sunjae-mobile-stats-${sunjaeImageIndex}`" :src="sunjaePortraitImageAt(1)" alt=""><template v-else>▥</template></span>통계</button>
    </nav>
    <nav class="native-app-tabbar" aria-label="Android 앱 메뉴">
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
            <button v-if="experimentalFeaturesEnabled" type="button" @click="nativeMoreOpen = false; openView('beta')"><span>β</span><div><strong>베타 학습 도구</strong><small>확신도·메모·맞춤 복습</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('stats')"><span>▥</span><div><strong>학습 통계</strong><small>점수와 학습 기록</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openCalculator()"><span>▦</span><div><strong>계산기</strong><small>공학용 계산 도구</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; settingsOpen = true"><span>⚙</span><div><strong>설정</strong><small>테마·글씨·문제 화면</small></div></button>
            <button type="button" @click="nativeMoreOpen = false; openView('updates')"><span>◷</span><div><strong>업데이트</strong><small>패치노트 확인</small></div></button>
          </nav>
        </section>
      </div>
    </Transition>
    <Transition name="modal-fade">
      <div v-if="settingsOpen" class="settings-backdrop" @click.self="settingsOpen = false">
        <section class="settings-panel">
        <header><div><span>PERSONAL SETTINGS</span><h2>화면과 학습 데이터</h2></div><button aria-label="설정 닫기" @click="settingsOpen = false">×</button></header>
        <div class="setting-group display-mode-setting">
          <span>기기 화면 모드</span>
          <p class="setting-description">자동은 휴대폰·태블릿에서 경량 화면을 사용합니다. 모드를 바꾸면 현재 기록을 저장한 뒤 화면만 다시 엽니다.</p>
          <div class="display-mode-options">
            <button :class="{ active: displayPreference === 'auto' }" @click="setDisplayPreference('auto')"><strong>자동</strong><span>{{ resolvedDisplayMode === 'mobile' ? '현재 모바일·태블릿' : '현재 PC' }}</span><small>기기 자동 인식</small></button>
            <button :class="{ active: displayPreference === 'mobile' }" @click="setDisplayPreference('mobile')"><strong>모바일</strong><span>모바일·태블릿</span><small>경량 화면 고정</small></button>
            <button :class="{ active: displayPreference === 'desktop' }" @click="setDisplayPreference('desktop')"><strong>PC</strong><span>데스크톱 화면</span><small>PC 배치 고정</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>동적 UI</span>
          <p class="setting-description">켜면 새 배치와 자연스러운 화면 전환을 사용합니다. 끄면 v2.4.2 방식의 기존 배치와 즉시 전환으로 돌아갑니다.</p>
          <div class="dynamic-ui-options">
            <button :class="{ active: dynamicUiEnabled }" @click="setDynamicUiEnabled(true)"><strong>ON</strong><span>새 동적 UI</span><small>기본 설정</small></button>
            <button :class="{ active: !dynamicUiEnabled }" @click="setDynamicUiEnabled(false)"><strong>OFF</strong><span>기존 UI</span><small>v2.4.2 호환</small></button>
          </div>
        </div>
        <div class="setting-group experimental-setting">
          <span>실험 기능 전체</span>
          <p class="setting-description">확신도·실수 원인·문제 메모·시험 속도 예측을 한 번에 켜고 끕니다. OFF하면 기존 v3.5.4 문제 화면과 바로 비교할 수 있고 저장한 기록은 지우지 않습니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: experimentalFeaturesEnabled }" @click="setExperimentalFeatures(true)"><strong>β ON</strong><span>베타 기능 사용</span><small>현재 적용</small></button>
            <button :class="{ active: !experimentalFeaturesEnabled }" @click="setExperimentalFeatures(false)"><strong>OFF</strong><span>기존 화면</span><small>v3.5.4 비교</small></button>
          </div>
          <button v-if="experimentalFeaturesEnabled" type="button" class="experimental-open-button" @click="settingsOpen = false; openView('beta')">베타 학습 도구 열기 →</button>
        </div>
        <div class="setting-group experimental-setting">
          <span>내 판단·메모</span>
          <p class="setting-description">문제 아래의 확신도·실수 원인·내 메모만 따로 표시합니다. OFF해도 기존 기록은 삭제하지 않습니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: questionJudgmentEnabled }" @click="setQuestionJudgmentEnabled(true)"><strong>ON</strong><span>판단·메모 표시</span><small>문제 아래 열기</small></button>
            <button :class="{ active: !questionJudgmentEnabled }" @click="setQuestionJudgmentEnabled(false)"><strong>OFF</strong><span>숨기기</span><small>기본값</small></button>
          </div>
        </div>
        <div class="setting-group solve-layout-setting">
          <span>문제풀이 화면</span>
          <p class="setting-description">세 화면을 언제든 바꿀 수 있습니다. 답안·진도·타이머는 그대로 유지됩니다.</p>
          <div class="solve-layout-options">
            <button :class="{ active: solveLayoutMode === 'standard' }" @click="setSolveLayoutMode('standard')"><strong>CBT</strong><span>기본 CBT</span><small>기존 v2.7 화면 · 기본값</small></button>
            <button :class="{ active: solveLayoutMode === 'comcbt' }" @click="setSolveLayoutMode('comcbt')"><strong>COM</strong><span>COMCBT 모드</span><small>선택형 · 고밀도 시험지형</small></button>
            <button :class="{ active: solveLayoutMode === 'combat' }" @click="setSolveLayoutMode('combat')"><strong>⚡</strong><span>컴뱃 CBT</span><small>4문제 · 진행 HUD</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>UI 스타일</span>
          <p class="setting-description">{{ isJewelry ? '기본 CBT, 심슨, 선재 테마' : '기본 CBT와 심슨 테마' }}는 이 설정 화면에서만 바꿀 수 있습니다. 동적 UI를 꺼도 선택한 테마는 유지됩니다.</p>
          <div class="style-options">
            <button :class="{ active: visualStyle === 'default' }" @click="setVisualStyle('default')"><strong>CBT</strong><span>기본 UI</span><small>지금까지 사용한 화면</small></button>
            <button :class="{ active: visualStyle === 'simpsons' }" @click="setVisualStyle('simpsons')"><strong>🍩</strong><span>심슨 테마</span><small>스프링필드 코믹 UI</small></button>
            <button v-if="isJewelry" :class="{ active: visualStyle === 'sunjae' }" @click="setVisualStyle('sunjae')"><strong>☂</strong><span>선재 테마</span><small>보석관 전용 팬페이지 UI</small></button>
          </div>
        </div>
        <div v-if="isJewelry" class="setting-group">
          <span>선재 사진 자동 교체</span>
          <p class="setting-description">선재 테마의 홈·로고·메뉴 사진이 바뀌는 시간을 고릅니다. 끔을 선택하면 현재 사진을 그대로 유지합니다.</p>
          <div class="sunjae-rotation-options">
            <button v-for="seconds in sunjaeRotationChoices" :key="seconds" :class="{ active: sunjaeRotationSeconds === seconds }" @click="setSunjaeRotationSeconds(seconds)">{{ sunjaeRotationLabel(seconds) }}</button>
          </div>
        </div>
        <div class="setting-group">
          <span>화면 테마</span>
          <div class="theme-options">
            <button :class="{ active: theme === 'system' }" @click="theme = 'system'; applyTheme(theme)"><strong>◐ 자동</strong><small>기기 설정</small></button>
            <button :class="{ active: theme === 'light' }" @click="theme = 'light'; applyTheme(theme)"><strong>☀ 라이트</strong><small>밝은 화면</small></button>
            <button :class="{ active: theme === 'dark' }" @click="theme = 'dark'; applyTheme(theme)"><strong>☾ 다크</strong><small>어두운 화면</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>문자 크기</span>
          <p class="setting-description">문제·보기·해설 글씨만 80%부터 160%까지 조절합니다.</p>
          <div class="font-options">
            <button :class="{ active: fontScale === .8 }" @click="setFontScale(.8)">아주 작게</button>
            <button :class="{ active: fontScale === 1 }" @click="setFontScale(1)">기본</button>
            <button :class="{ active: fontScale === 1.3 }" @click="setFontScale(1.3)">크게</button>
            <button :class="{ active: fontScale === 1.6 }" @click="setFontScale(1.6)">아주 크게</button>
          </div>
        </div>
        <div class="setting-group">
          <span>글씨체</span>
          <p class="setting-description">문제·보기·해설과 메뉴 글꼴을 함께 바꿉니다.</p>
          <div class="font-family-options">
            <button :class="{ active: fontFamilyPreference === 'regular' }" @click="setFontFamilyPreference('regular')"><strong>나눔고딕</strong><small>Regular · 기본</small></button>
            <button :class="{ active: fontFamilyPreference === 'bold' }" @click="setFontFamilyPreference('bold')"><strong>나눔고딕 Bold</strong><small>굵고 또렷하게</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding' }" @click="setFontFamilyPreference('d2coding')"><strong>D2Coding</strong><small>Regular · 고정폭</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding-bold' }" @click="setFontFamilyPreference('d2coding-bold')"><strong>D2Coding Bold</strong><small>굵은 고정폭</small></button>
          </div>
        </div>
        <div v-if="!isJewelry" class="setting-group">
          <span>문제 이미지 다크 표시</span>
          <p class="setting-description">복원·한솔·일반 문제 그림의 원본 픽셀은 그대로 두고, 다크 모드 표시만 바꿉니다.</p>
          <div class="restored-image-options">
            <button :class="{ active: restoredImageTheme === 'auto' }" @click="setRestoredImageTheme('auto')"><strong>◐ 눈부심 완화</strong><small>추천 · 짙은 남색</small></button>
            <button :class="{ active: restoredImageTheme === 'original' }" @click="setRestoredImageTheme('original')"><strong>□ 항상 원본</strong><small>흰 문제지 유지</small></button>
          </div>
        </div>
        <div class="setting-group standard-solving-setting">
          <span>답안 선택 방식</span>
          <p class="setting-description">베타가 아닌 정식 설정입니다. 복원 이미지 문제의 답안 표시만 바뀌며 학습 기록에는 영향을 주지 않습니다.</p>
          <div class="answer-layout-options">
            <button :class="{ active: answerLayout === 'hotspot' }" @click="setAnswerLayout('hotspot')"><strong>☝ 이미지 직접 선택</strong><small>원문 속 보기를 바로 누르기</small></button>
            <button :class="{ active: answerLayout === 'inline' }" @click="setAnswerLayout('inline')"><strong>① 답안 문구</strong><small>번호 옆에서 내용을 바로 선택</small></button>
            <button :class="{ active: answerLayout === 'classic' }" @click="setAnswerLayout('classic')"><strong>① ② ③ ④</strong><small>기존 큰 번호 버튼</small></button>
          </div>
          <div class="hotspot-indicator-setting">
            <span>이미지 답안 선택 표시</span>
            <div>
              <button :class="{ active: hotspotIndicator === 'marker' }" @click="setHotspotIndicator('marker')"><strong>✓ 체크 마커</strong><small>기본 · 글자를 가리지 않음</small></button>
              <button :class="{ active: hotspotIndicator === 'area' }" @click="setHotspotIndicator('area')"><strong>▰ 영역 색상 박스</strong><small>PaddleOCR · 보기 전체 한 박스</small></button>
            </div>
          </div>
          <div class="standard-solving-list">
            <span><b>✓</b><strong>이미지 잘림 방지</strong></span>
            <span><b>✓</b><strong>OMR 자동 따라가기</strong></span>
          </div>
        </div>
        <div class="setting-group cloud-sync-setting">
          <span>기기 간 학습 기록 동기화</span>
          <p class="setting-description">로그인하지 않아도 모든 문제를 풀 수 있습니다. PC·태블릿·휴대폰에서 같은 기록을 쓰고 싶을 때만 로그인하세요.</p>
          <small class="cloud-sync-last-time">최근 동기화 {{ cloudSyncTimeLabel() }}</small>
          <template v-if="cloudSyncState.passwordRecovery">
            <form class="cloud-sync-form" @submit.prevent="saveNewSyncPassword">
              <label><span>새 비밀번호</span><input v-model="syncNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label>
              <p v-if="syncFormMessage">{{ syncFormMessage }}</p>
              <div><button type="submit" :disabled="syncBusy">{{ syncBusy ? '변경 중…' : '새 비밀번호 저장' }}</button></div>
            </form>
          </template>
          <template v-else-if="cloudSyncState.email">
            <div class="cloud-sync-account">
              <div><strong>{{ cloudSyncState.email }}</strong><small>{{ cloudSyncState.message || '기기 간 기록 동기화가 연결되었습니다.' }}</small></div>
              <i :class="`is-${cloudSyncState.status}`">{{ cloudSyncState.status === 'syncing' ? '동기화 중' : cloudSyncState.status === 'error' ? '확인 필요' : '연결됨' }}</i>
            </div>
            <div class="cloud-sync-actions">
              <button type="button" :disabled="cloudSyncState.status === 'syncing'" @click="syncLearningData">지금 동기화</button>
              <button type="button" class="secondary" @click="logoutSyncAccount">로그아웃</button>
            </div>
          </template>
          <template v-else>
            <button v-if="!syncLoginOpen" type="button" class="cloud-sync-open" @click="syncLoginOpen = true">동기화 로그인</button>
            <form v-else class="cloud-sync-form" @submit.prevent="submitSyncLogin">
              <label><span>이메일</span><input v-model.trim="syncEmail" type="email" autocomplete="username" required placeholder="name@example.com"></label>
              <label><span>비밀번호</span><input v-model="syncPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상"></label>
              <label class="cloud-sync-remember"><input v-model="syncRememberEmail" type="checkbox"><span>아이디 기억</span><small>자동 로그인은 이 기기의 안전한 로그인 세션으로 유지됩니다.</small></label>
              <p v-if="syncFormMessage">{{ syncFormMessage }}</p>
              <div>
                <button type="submit" :disabled="syncBusy">{{ syncBusy ? '확인 중…' : '로그인' }}</button>
                <button type="button" :disabled="syncBusy" class="secondary" @click="submitSyncSignup">처음이면 계정 만들기</button>
                <button type="button" class="secondary" @click="showSyncIdHelp">아이디 찾기</button>
                <button type="button" :disabled="syncBusy" class="secondary" @click="sendSyncPasswordReset">비밀번호 찾기</button>
                <button type="button" class="text-button" @click="syncLoginOpen = false; syncFormMessage = ''">닫기</button>
              </div>
            </form>
          </template>
        </div>
        <div v-if="!isNativeApp" class="setting-group data-setting pwa-recovery-setting">
          <span>PWA 업데이트 복구</span>
          <p>업데이트 뒤 화면이 꼬였을 때 학습 기록은 보존하고 이 사이트의 캐시와 서비스워커만 다시 설정합니다.</p>
          <div><button type="button" @click="openPwaRecovery">복구 화면 열기</button></div>
        </div>
        <div class="setting-group data-setting">
          <span>학습 기록</span>
          <p>이 기기의 오답·진도·시험 기록을 파일로 옮기거나 다시 불러올 수 있습니다.</p>
          <div>
            <button @click="exportLearningData">기록 내보내기</button>
            <button @click="chooseLearningDataFile">기록 불러오기</button>
            <button class="danger" @click="clearLearningData">전체 초기화</button>
          </div>
          <input ref="learningImportInput" type="file" accept="application/json,.json" hidden @change="importLearningData">
        </div>
        <footer><span>현재 버전</span><strong>v{{ currentVersion }}</strong></footer>
        </section>
      </div>
    </Transition>
  </div>

  <div
    v-else
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
    <header class="session-topbar">
      <div class="session-leading">
        <button class="back-button" type="button" @click="leaveSession()">← <span>뒤로가기</span></button>
        <button class="session-menu-button" type="button" @click="sessionMenuOpen = true">☰ <span>메뉴</span></button>
      </div>
      <div>
        <span>{{ solveLayoutMode === 'combat' ? 'COMBAT CBT · MISSION' : session.mode === 'exam' ? 'CBT EXAM' : 'LEARNING MODE' }}</span>
        <strong>{{ sessionTitle }}</strong>
        <div v-if="solveLayoutMode === 'combat'" class="combat-progress-track"><i :style="{ width: `${sessionProgress}%` }" /></div>
      </div>
      <div class="session-tools">
        <button type="button" @click="openCalculator">▦ 계산기</button>
        <button type="button" @click="settingsOpen = true">⚙ 설정</button>
        <div class="session-font-control" aria-label="문자 크기 조절">
          <button type="button" aria-label="문자 작게" :disabled="fontScale <= .8" @click="adjustFontScale(-.1)">가−</button>
          <button type="button" title="기본 크기로" @click="setFontScale(1)">{{ Math.round(fontScale * 100) }}%</button>
          <button type="button" aria-label="문자 크게" :disabled="fontScale >= 1.6" @click="adjustFontScale(.1)">가+</button>
        </div>
        <form v-if="session.mode === 'learn'" class="session-jump-form" @submit.prevent="jumpToLearningQuestion">
          <label for="learning-jump-number">문제 번호</label>
          <input
            id="learning-jump-number"
            v-model="learningJumpNumber"
            type="number"
            inputmode="numeric"
            min="1"
            :max="sessionQuestionMax"
            :placeholder="`1~${sessionQuestionMax}`"
            aria-label="이동할 문제 번호"
          >
          <button type="submit">이동</button>
        </form>
        <label v-if="session.mode === 'learn'">
          문제 표시
          <select :value="session.pageSize" @change="setSessionPageSize(Number(($event.target as HTMLSelectElement).value))">
            <option :value="1">1문제</option>
            <option :value="2">2문제</option>
            <option :value="4">4문제</option>
            <option :value="6">6문제</option>
          </select>
        </label>
        <button v-if="session.mode === 'learn'" type="button" class="reset-button" @click="resetLearning">선택 초기화</button>
        <button v-else type="button" class="timer-button">남은 시간 <strong>{{ formattedTime }}</strong></button>
        <button v-if="session.mode === 'exam'" type="button" @click="examSheetOpen = !examSheetOpen">{{ examSheetOpen ? 'OMR 닫기' : 'OMR 열기' }}</button>
      </div>
      <div
        class="session-status-strip"
        :class="{
          'combat-hud-stats': solveLayoutMode === 'combat',
          'comcbt-status-strip': solveLayoutMode === 'comcbt',
        }"
        aria-label="현재 풀이 진행 상태"
      >
        <span><small>진행</small><strong>{{ sessionProgress }}%</strong></span>
        <span><small>완료</small><strong>{{ answeredCount }}</strong></span>
        <button
          type="button"
          class="session-unanswered-status"
          :disabled="!unansweredCount"
          :title="unansweredCount ? '다음 미응답 문제로 이동' : '모든 문제에 답했습니다'"
          @click="goToNextUnanswered"
        ><small>미응답</small><strong>{{ unansweredCount }}</strong></button>
        <button type="button" class="session-kept-status" :disabled="!keptCount" @click="goToNextKept"><small>킵</small><strong>{{ keptCount }}</strong></button>
      </div>
      <div v-if="examPace" class="beta-exam-pace" :class="`is-${examPace.tone}`" aria-live="polite">
        <b>β 속도 예측</b><strong>{{ examPace.label }}</strong><span>{{ examPace.detail }}</span>
      </div>
    </header>

    <button v-if="sessionMenuOpen" class="session-menu-backdrop" type="button" aria-label="풀이 메뉴 닫기" @click="sessionMenuOpen = false" />
    <aside class="session-drawer" :class="{ open: sessionMenuOpen }">
      <header><div><span>CBT</span><strong>풀이 메뉴</strong></div><button type="button" aria-label="닫기" @click="sessionMenuOpen = false">×</button></header>
      <nav>
        <button type="button" @click="leaveSession('home')"><span>⌂</span><div><strong>첫 화면</strong><small>종목 선택과 학습 설정</small></div></button>
        <button type="button" @click="leaveSession('rounds')"><span>▤</span><div><strong>회차별 문제</strong><small>전체 기출 회차 선택</small></div></button>
        <button type="button" @click="leaveSession('history')"><span>◴</span><div><strong>학습 내역</strong><small>이어하기와 지난 점수</small></div></button>
        <button type="button" @click="leaveSession('wrong')"><span>!</span><div><strong>오답노트</strong><small>틀린 문제 다시 풀기</small></div></button>
        <button type="button" @click="leaveSession('coach')"><span>✦</span><div><strong>합격 엔진</strong><small>맞춤 복습과 합격 예측</small></div></button>
        <button type="button" @click="leaveSession('updates')"><span>◷</span><div><strong>패치노트</strong><small>최근 업데이트 확인</small></div></button>
      </nav>
      <footer>
        <button type="button" @click="settingsOpen = true; sessionMenuOpen = false">⚙ 화면·문제풀이 설정</button>
        <button type="button" @click="openCalculator">▦ 공학용 계산기</button>
        <button type="button" @click="toggleLightDark">{{ darkActive ? '☀ 라이트 모드' : '☾ 다크 모드' }}</button>
      </footer>
    </aside>

    <main class="session-main">
      <section class="question-area">
        <Transition :name="questionTransitionName" mode="out-in">
          <div :key="`${session.page}-${session.pageSize}`" class="question-columns">
            <div v-for="(column, columnIndex) in currentItemColumns" :key="columnIndex" class="question-column">
              <QuestionCard
                v-for="item in column"
                :key="item.id"
                :id="`session-question-${session.items.indexOf(item) + 1}`"
                :item="item"
                :mode="session.mode"
                :selected="session.answers[item.id]"
                :subject-start="isSubjectStart(item)"
                :subject-number="sessionSubjectNumber(item)"
                :display-number="session.items.indexOf(item) + 1"
                :bookmarked="studyStore.bookmarks.includes(item.id)"
                :kept="session.kept.includes(item.id)"
                :calculation-mode="session.calculationMode"
                :image-answer-mode="answerLayout === 'hotspot' ? 'hotspot' : 'buttons'"
                :answer-layout="answerLayout"
                :hotspot-indicator="hotspotIndicator"
                :restored-image-theme="restoredImageTheme"
                :solve-layout="solveLayoutMode"
                :active="solveLayoutMode === 'comcbt' && activeSessionItem?.id === item.id"
                :experimental-features="experimentalFeaturesEnabled && questionJudgmentEnabled"
                :confidence="betaModeMeta(item.id, session.mode).confidence"
                :mistake-reason="betaModeMeta(item.id, session.mode).reason"
                :study-note="betaQuestionMeta(item.id).note"
                @choose="chooseAnswer(item, $event)"
                @toggle-bookmark="toggleBookmark(item)"
                @toggle-keep="toggleKeep(item)"
                @ask-ai="prepareAiQuestion(item)"
                @activate="activateSessionItem(item)"
                @set-confidence="setQuestionConfidence(item, $event)"
                @set-mistake-reason="setQuestionMistakeReason(item, $event)"
                @update-study-note="setQuestionStudyNote(item, $event)"
              />
            </div>
          </div>
        </Transition>
        <footer class="pager" :class="{ 'has-unanswered': unansweredCount }">
          <button type="button" class="pager-prev" :disabled="session.page === 0" @click="goToPage(session.page - 1)">← 이전</button>
          <span class="pager-position"><strong>{{ session.page + 1 }}</strong> / {{ pageCount }}</span>
          <button v-if="unansweredCount" type="button" class="pager-unanswered-button" @click="goToNextUnanswered">다음 미응답</button>
          <button type="button" class="pager-next" :disabled="session.page >= pageCount - 1" @click="goToPage(session.page + 1)">다음 →</button>
          <button v-if="session.mode === 'learn'" type="button" class="learning-result-button" @click="submitLearning">학습 결과 보기</button>
          <button v-else type="button" class="exam-submit-button" @click="submitExam(false)">시험 제출·채점</button>
        </footer>
      </section>

      <aside v-if="session.mode === 'exam'" class="omr-sheet">
        <header>
          <div><span>ANSWER SHEET</span><strong>답안지</strong></div>
          <div class="omr-summary">
            <button v-if="keptCount" type="button" @click="goToNextKept">킵 {{ keptCount }}</button>
            <Transition name="count-pop" mode="out-in"><b :key="answeredCount">{{ answeredCount }}/{{ session.items.length }}</b></Transition>
          </div>
        </header>
        <div v-if="solveLayoutMode === 'comcbt'" class="omr-filter-bar" aria-label="OMR 빠른 필터">
          <button :class="{ active: omrFilter === 'all' }" @click="omrFilter = 'all'">전체</button>
          <button :class="{ active: omrFilter === 'unanswered' }" @click="omrFilter = 'unanswered'">미응답 {{ unansweredCount }}</button>
          <button :class="{ active: omrFilter === 'kept' }" @click="omrFilter = 'kept'">킵 {{ keptCount }}</button>
          <button :class="{ active: omrFilter === 'subject' }" @click="omrFilter = 'subject'">현재 과목</button>
        </div>
        <div ref="omrListRef" class="omr-list" @pointerdown="markOmrManualScroll" @wheel.passive="markOmrManualScroll">
          <button
            v-for="({ item, index }) in omrRows"
            :key="item.id"
            :data-omr-index="index"
            type="button"
            :class="{ current: Math.floor(index / session.pageSize) === session.page, kept: session.kept.includes(item.id) }"
            @click="goToQuestion(index)"
          >
            <strong>{{ index + 1 }}.<i v-if="session.kept.includes(item.id)">K</i></strong>
            <span
              v-for="choice in 4"
              :key="choice"
              :class="{ marked: session.answers[item.id] === choice }"
              @click.stop="chooseAnswer(item, choice)"
            >{{ choice }}</span>
          </button>
          <p v-if="!omrRows.length" class="omr-empty">해당 문제가 없습니다.</p>
        </div>
        <footer>
          <button v-if="unansweredCount" type="button" class="omr-next-unanswered" @click="goToNextUnanswered">다음 미응답</button>
          <button type="button" @click="submitExam(false)">채점하기</button>
        </footer>
      </aside>
    </main>

    <nav class="native-session-bar" :class="{ 'has-unanswered': unansweredCount }" aria-label="Android 풀이 도구">
      <button type="button" :disabled="session.page === 0" @click="goToPage(session.page - 1)"><span>‹</span><strong>이전</strong></button>
      <button v-if="unansweredCount" type="button" class="native-unanswered-button" @click="goToNextUnanswered"><span>?</span><strong>미응답</strong><b>{{ unansweredCount }}</b></button>
      <button v-if="session.mode === 'exam'" type="button" :class="{ active: examSheetOpen }" @click="examSheetOpen = !examSheetOpen"><span>OMR</span><strong>답안지</strong><b v-if="unansweredCount">{{ unansweredCount }}</b></button>
      <button v-else type="button" @click="settingsOpen = true"><span>가</span><strong>글씨·설정</strong></button>
      <button type="button" @click="openCalculator"><span>▦</span><strong>계산기</strong></button>
      <button v-if="session.mode === 'exam' && activeSessionItem" type="button" :class="{ active: session.kept.includes(activeSessionItem.id) }" @click="toggleKeep(activeSessionItem)"><span>K</span><strong>킵</strong></button>
      <button v-else type="button" @click="sessionMenuOpen = true"><span>☰</span><strong>메뉴</strong></button>
      <button type="button" :disabled="session.page >= pageCount - 1" @click="goToPage(session.page + 1)"><span>›</span><strong>다음</strong></button>
    </nav>

    <nav v-if="solveLayoutMode === 'comcbt'" class="compact-session-pager" aria-label="문제 페이지 이동">
      <button type="button" class="compact-prev" :disabled="session.page === 0" @click="goToPage(session.page - 1)">← <span>이전</span></button>
      <div>
        <span>COMCBT PAGE</span>
        <strong>{{ session.page + 1 }} / {{ pageCount }}</strong>
        <small>{{ answeredCount }}개 완료 · {{ unansweredCount }}개 미응답</small>
      </div>
      <button v-if="unansweredCount" type="button" class="unanswered-jump" @click="goToNextUnanswered">미응답</button>
      <button type="button" class="compact-next" :disabled="session.page >= pageCount - 1" @click="goToPage(session.page + 1)"><span>다음</span> →</button>
      <button v-if="session.mode === 'learn'" type="button" class="compact-submit learning" @click="submitLearning">학습 결과 보기</button>
      <button v-else type="button" class="compact-submit exam" @click="submitExam(false)">시험 제출·채점</button>
    </nav>

    <Transition name="result-pop" appear>
      <div v-if="examResult" class="result-backdrop">
        <section class="result-card" :class="{ 'sunjae-result-card': visualStyle === 'sunjae', 'sunjae-result-revealed': visualStyle === 'sunjae' && sunjaeResultPhase === 'reveal' }">
        <div v-if="visualStyle === 'sunjae' && sunjaeResultPhase === 'grading'" class="sunjae-grading-stage">
          <div class="sunjae-grading-photo"><img :src="sunjaeGradingImage" alt="답안을 채점하는 변우석"><i /><i /><i /></div>
          <div class="sunjae-grading-copy"><span>선재가 채점 중 ···</span><strong>잠깐만, 내가 하나씩 볼게.</strong><p>네가 끝까지 푼 답안이니까 더 꼼꼼하게 확인하고 있어.</p><div><i /><i /><i /><i /><i /></div></div>
        </div>
        <template v-else>
        <div v-if="visualStyle === 'simpsons'" class="simpsons-result-message">
          <img :src="examResult.score >= 60 ? simpsonsKingSizeImage : simpsonsThemeImage" :alt="examResult.score >= 60 ? '꽃무늬 옷을 입은 뚱뚱한 호머' : '호머와 바트'">
          <p><strong>{{ examResult.score >= 60 ? '오늘은 목 조르기 면제!' : '호머가 오기 전에 오답 복습!' }}</strong><span>{{ examResult.score >= 60 ? '바트도 놀랄 만큼 잘 풀었습니다.' : '이번 회차 오답만 다시 풀면 점수가 금방 올라갑니다.' }}</span></p>
        </div>
        <div v-if="visualStyle === 'sunjae'" class="sunjae-result-message" :class="{ praise: examResult.score >= 60 }">
          <img :src="sunjaeResultImage(examResult.score)" :alt="examResult.score >= 60 ? '점수를 칭찬하는 선재·변우석' : '다음 학습을 응원하는 선재·변우석'">
          <p><strong>{{ sunjaeResultTitle(examResult.score) }}</strong><span>{{ sunjaeResultDetail(examResult.score) }}</span></p>
        </div>
        <span>{{ session.mode === 'exam' ? (examResult.passed ? 'PASS' : 'REVIEW') : 'LEARNING RESULT' }}</span>
        <h2>{{ session.mode === 'learn' ? '현재 학습 결과입니다' : (examResult.passed ? '합격 기준을 통과했습니다' : '조금 더 복습이 필요합니다') }}</h2>
        <div class="result-score">{{ displayedResultScore }}<small>점</small></div>
        <p>{{ examResult.total }}문제 중 {{ examResult.correct }}문제를 맞혔습니다.</p>
        <p class="result-criteria">
          <span>{{ examResult.official ? 'Q-Net 필기 기준' : '기준 확인 필요' }}</span>
          <strong>{{ examResult.criteria }}</strong>
          <a v-if="examResult.source" :href="examResult.source" target="_blank" rel="noopener">공식 기준 보기</a>
        </p>
        <div class="subject-results">
          <div v-for="row in examResult.subjectRows" :key="row.subject">
            <span>{{ row.subject }}</span><strong>{{ row.score }}점</strong><small :class="{ fail: officialRule?.scoring === 'subject-average' && !row.passed }">{{ officialRule?.scoring === 'total-only' ? '참고' : (row.passed ? '통과' : '과락') }}</small>
          </div>
        </div>
        <div class="result-actions">
          <button type="button" @click="examResult = null; session.finished = false">문제 다시 보기</button>
          <button type="button" @click="openResultWrongAnswers(false)">이번 회차 오답 보기</button>
          <button type="button" @click="openResultWrongAnswers(true)">오답만 다시 풀기</button>
          <button type="button" @click="leaveSession()">시작 화면으로</button>
        </div>
        </template>
        </section>
      </div>
    </Transition>
  </div>

  <Transition name="modal-fade">
    <div v-if="settingsOpen && session" class="settings-backdrop" @click.self="settingsOpen = false">
      <section class="settings-panel session-settings-panel">
        <header><div><span>SESSION SETTINGS</span><h2>풀이 중 화면 설정</h2></div><button aria-label="설정 닫기" @click="settingsOpen = false">×</button></header>
        <div class="setting-group display-mode-setting">
          <span>기기 화면 모드</span>
          <p class="setting-description">자동은 휴대폰·태블릿에서 경량 화면을 사용합니다. 전환 전에 현재 풀이 위치를 저장합니다.</p>
          <div class="display-mode-options">
            <button :class="{ active: displayPreference === 'auto' }" @click="setDisplayPreference('auto')"><strong>자동</strong><span>{{ resolvedDisplayMode === 'mobile' ? '현재 모바일·태블릿' : '현재 PC' }}</span><small>기기 자동 인식</small></button>
            <button :class="{ active: displayPreference === 'mobile' }" @click="setDisplayPreference('mobile')"><strong>모바일</strong><span>모바일·태블릿</span><small>경량 화면 고정</small></button>
            <button :class="{ active: displayPreference === 'desktop' }" @click="setDisplayPreference('desktop')"><strong>PC</strong><span>데스크톱 화면</span><small>PC 배치 고정</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>동적 UI</span>
          <p class="setting-description">현재 답안은 유지하고 화면 전환 모션과 동적 배치만 바꿉니다.</p>
          <div class="dynamic-ui-options">
            <button :class="{ active: dynamicUiEnabled }" @click="setDynamicUiEnabled(true)"><strong>ON</strong><span>새 동적 UI</span><small>기본 설정</small></button>
            <button :class="{ active: !dynamicUiEnabled }" @click="setDynamicUiEnabled(false)"><strong>OFF</strong><span>기존 UI</span><small>v2.4.2 호환</small></button>
          </div>
        </div>
        <div class="setting-group experimental-setting">
          <span>실험 기능 전체</span>
          <p class="setting-description">현재 답안과 타이머는 유지하고 베타 도구만 숨기거나 다시 표시합니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: experimentalFeaturesEnabled }" @click="setExperimentalFeatures(true)"><strong>β ON</strong><span>베타 기능</span><small>확신도·메모·속도</small></button>
            <button :class="{ active: !experimentalFeaturesEnabled }" @click="setExperimentalFeatures(false)"><strong>OFF</strong><span>기존 화면</span><small>즉시 비교</small></button>
          </div>
        </div>
        <div class="setting-group experimental-setting">
          <span>내 판단·메모</span>
          <p class="setting-description">현재 답안은 유지하고 문제 아래의 판단·메모 도구만 따로 켜거나 끕니다.</p>
          <div class="dynamic-ui-options experimental-options">
            <button :class="{ active: questionJudgmentEnabled }" @click="setQuestionJudgmentEnabled(true)"><strong>ON</strong><span>판단·메모 표시</span><small>기존 기록 유지</small></button>
            <button :class="{ active: !questionJudgmentEnabled }" @click="setQuestionJudgmentEnabled(false)"><strong>OFF</strong><span>숨기기</span><small>기본값</small></button>
          </div>
        </div>
        <div class="setting-group solve-layout-setting">
          <span>문제풀이 화면</span>
          <p class="setting-description">현재 답안과 타이머를 유지한 채 즉시 전환합니다.</p>
          <div class="solve-layout-options">
            <button :class="{ active: solveLayoutMode === 'standard' }" @click="setSolveLayoutMode('standard')"><strong>CBT</strong><span>기본 CBT</span><small>기존 v2.7 화면 · 기본값</small></button>
            <button :class="{ active: solveLayoutMode === 'comcbt' }" @click="setSolveLayoutMode('comcbt')"><strong>COM</strong><span>COMCBT</span><small>고밀도 2열</small></button>
            <button :class="{ active: solveLayoutMode === 'combat' }" @click="setSolveLayoutMode('combat')"><strong>⚡</strong><span>컴뱃 CBT</span><small>4문제 HUD</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>UI 스타일</span>
          <p class="setting-description">답안과 진행 상태는 그대로 둔 채 풀이 화면의 테마를 바로 바꿉니다.</p>
          <div class="style-options">
            <button :class="{ active: visualStyle === 'default' }" @click="setVisualStyle('default')"><strong>CBT</strong><span>기본 UI</span><small>깔끔한 시험 화면</small></button>
            <button :class="{ active: visualStyle === 'simpsons' }" @click="setVisualStyle('simpsons')"><strong>🍩</strong><span>심슨 테마</span><small>다크 모드 지원</small></button>
            <button v-if="isJewelry" :class="{ active: visualStyle === 'sunjae' }" @click="setVisualStyle('sunjae')"><strong>☂</strong><span>선재 테마</span><small>보석관 전용 UI</small></button>
          </div>
        </div>
        <div v-if="isJewelry" class="setting-group">
          <span>선재 사진 자동 교체</span>
          <p class="setting-description">선재 테마의 홈·로고·메뉴 사진이 바뀌는 시간을 고릅니다.</p>
          <div class="sunjae-rotation-options">
            <button v-for="seconds in sunjaeRotationChoices" :key="seconds" :class="{ active: sunjaeRotationSeconds === seconds }" @click="setSunjaeRotationSeconds(seconds)">{{ sunjaeRotationLabel(seconds) }}</button>
          </div>
        </div>
        <div class="setting-group">
          <span>화면 테마</span>
          <div class="theme-options">
            <button :class="{ active: theme === 'system' }" @click="theme = 'system'; applyTheme(theme)"><strong>◐ 자동</strong><small>기기 설정</small></button>
            <button :class="{ active: theme === 'light' }" @click="theme = 'light'; applyTheme(theme)"><strong>☀ 라이트</strong><small>밝은 화면</small></button>
            <button :class="{ active: theme === 'dark' }" @click="theme = 'dark'; applyTheme(theme)"><strong>☾ 다크</strong><small>어두운 화면</small></button>
          </div>
        </div>
        <div class="setting-group">
          <span>문자 크기</span>
          <p class="setting-description">현재 문제를 유지한 채 80%부터 160%까지 바꿉니다.</p>
          <div class="font-options">
            <button :class="{ active: fontScale === .8 }" @click="setFontScale(.8)">아주 작게</button>
            <button :class="{ active: fontScale === 1 }" @click="setFontScale(1)">기본</button>
            <button :class="{ active: fontScale === 1.3 }" @click="setFontScale(1.3)">크게</button>
            <button :class="{ active: fontScale === 1.6 }" @click="setFontScale(1.6)">아주 크게</button>
          </div>
        </div>
        <div class="setting-group">
          <span>글씨체</span>
          <p class="setting-description">현재 문제와 답안을 유지한 채 바로 바꿉니다.</p>
          <div class="font-family-options">
            <button :class="{ active: fontFamilyPreference === 'regular' }" @click="setFontFamilyPreference('regular')"><strong>나눔고딕</strong><small>Regular · 기본</small></button>
            <button :class="{ active: fontFamilyPreference === 'bold' }" @click="setFontFamilyPreference('bold')"><strong>나눔고딕 Bold</strong><small>굵고 또렷하게</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding' }" @click="setFontFamilyPreference('d2coding')"><strong>D2Coding</strong><small>Regular · 고정폭</small></button>
            <button :class="{ active: fontFamilyPreference === 'd2coding-bold' }" @click="setFontFamilyPreference('d2coding-bold')"><strong>D2Coding Bold</strong><small>굵은 고정폭</small></button>
          </div>
        </div>
        <div v-if="!isJewelry" class="setting-group">
          <span>문제 이미지 다크 표시</span>
          <p class="setting-description">현재 문제와 답안은 유지하고 복원·한솔·일반 문제 그림의 표시만 바꿉니다.</p>
          <div class="restored-image-options">
            <button :class="{ active: restoredImageTheme === 'auto' }" @click="setRestoredImageTheme('auto')"><strong>◐ 눈부심 완화</strong><small>추천 · 짙은 남색</small></button>
            <button :class="{ active: restoredImageTheme === 'original' }" @click="setRestoredImageTheme('original')"><strong>□ 항상 원본</strong><small>흰 문제지 유지</small></button>
          </div>
        </div>
        <div class="setting-group standard-solving-setting">
          <span>답안 선택 방식</span>
          <div class="answer-layout-options">
            <button :class="{ active: answerLayout === 'hotspot' }" @click="setAnswerLayout('hotspot')"><strong>☝ 이미지 직접 선택</strong><small>원문 속 보기를 바로 누르기</small></button>
            <button :class="{ active: answerLayout === 'inline' }" @click="setAnswerLayout('inline')"><strong>① 답안 문구</strong><small>번호 옆에서 내용을 바로 선택</small></button>
            <button :class="{ active: answerLayout === 'classic' }" @click="setAnswerLayout('classic')"><strong>① ② ③ ④</strong><small>기존 큰 번호 버튼</small></button>
          </div>
          <div class="hotspot-indicator-setting">
            <span>이미지 답안 선택 표시</span>
            <div>
              <button :class="{ active: hotspotIndicator === 'marker' }" @click="setHotspotIndicator('marker')"><strong>✓ 체크 마커</strong><small>기본 · 글자를 가리지 않음</small></button>
              <button :class="{ active: hotspotIndicator === 'area' }" @click="setHotspotIndicator('area')"><strong>▰ 영역 색상 박스</strong><small>PaddleOCR · 보기 전체 한 박스</small></button>
            </div>
          </div>
          <div class="standard-solving-list">
            <span><b>✓</b><strong>이미지 비율·잘림 자동 보호</strong></span>
            <span><b>✓</b><strong>현재 문제 OMR 자동 이동</strong></span>
          </div>
          <button v-if="session.mode === 'exam'" type="button" class="session-setting-action" @click="examSheetOpen = !examSheetOpen">{{ examSheetOpen ? 'OMR 닫기' : 'OMR 열기' }}</button>
        </div>
        <div class="setting-group cloud-sync-setting">
          <span>기기 간 학습 기록 동기화</span>
          <p class="setting-description">현재 풀이 위치도 함께 저장합니다. 다른 기기에서는 동기화가 끝난 뒤 이어 학습을 누르세요.</p>
          <small class="cloud-sync-last-time">최근 동기화 {{ cloudSyncTimeLabel() }}</small>
          <template v-if="cloudSyncState.passwordRecovery">
            <form class="cloud-sync-form" @submit.prevent="saveNewSyncPassword"><label><span>새 비밀번호</span><input v-model="syncNewPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="8자 이상"></label><p v-if="syncFormMessage">{{ syncFormMessage }}</p><div><button type="submit" :disabled="syncBusy">{{ syncBusy ? '변경 중…' : '새 비밀번호 저장' }}</button></div></form>
          </template>
          <template v-else-if="cloudSyncState.email">
            <div class="cloud-sync-account"><div><strong>{{ cloudSyncState.email }}</strong><small>{{ cloudSyncState.message || '기기 간 기록 동기화가 연결되었습니다.' }}</small></div><i :class="`is-${cloudSyncState.status}`">{{ cloudSyncState.status === 'syncing' ? '동기화 중' : cloudSyncState.status === 'error' ? '확인 필요' : '연결됨' }}</i></div>
            <div class="cloud-sync-actions"><button type="button" :disabled="cloudSyncState.status === 'syncing'" @click="syncLearningData">지금 동기화</button><button type="button" class="secondary" @click="logoutSyncAccount">로그아웃</button></div>
          </template>
          <template v-else>
            <button v-if="!syncLoginOpen" type="button" class="cloud-sync-open" @click="syncLoginOpen = true">동기화 로그인</button>
            <form v-else class="cloud-sync-form" @submit.prevent="submitSyncLogin">
              <label><span>이메일</span><input v-model.trim="syncEmail" type="email" autocomplete="username" required placeholder="name@example.com"></label><label><span>비밀번호</span><input v-model="syncPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상"></label><label class="cloud-sync-remember"><input v-model="syncRememberEmail" type="checkbox"><span>아이디 기억</span><small>안전한 로그인 세션으로 자동 로그인을 유지합니다.</small></label><p v-if="syncFormMessage">{{ syncFormMessage }}</p>
              <div><button type="submit" :disabled="syncBusy">{{ syncBusy ? '확인 중…' : '로그인' }}</button><button type="button" :disabled="syncBusy" class="secondary" @click="submitSyncSignup">처음이면 계정 만들기</button><button type="button" class="secondary" @click="showSyncIdHelp">아이디 찾기</button><button type="button" :disabled="syncBusy" class="secondary" @click="sendSyncPasswordReset">비밀번호 찾기</button><button type="button" class="text-button" @click="syncLoginOpen = false; syncFormMessage = ''">닫기</button></div>
            </form>
          </template>
        </div>
        <div v-if="!isNativeApp" class="setting-group data-setting pwa-recovery-setting"><span>PWA 업데이트 복구</span><p>학습 기록은 유지하고 홈페이지 캐시와 서비스워커만 다시 설정합니다.</p><div><button type="button" @click="openPwaRecovery">복구 화면 열기</button></div></div>
        <div class="setting-group data-setting"><span>학습 기록</span><p>오답·진도·시험 기록을 파일로 옮기거나 다시 불러올 수 있습니다.</p><div><button @click="exportLearningData">기록 내보내기</button><button @click="chooseLearningDataFile">기록 불러오기</button><button class="danger" @click="clearLearningData">전체 초기화</button></div><input ref="learningImportInput" type="file" accept="application/json,.json" hidden @change="importLearningData"></div>
        <footer><span>현재 v{{ currentVersion }} · 답안과 타이머는 유지됩니다</span><button type="button" @click="settingsOpen = false">풀이로 돌아가기</button></footer>
      </section>
    </div>
  </Transition>

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
    <aside v-if="updateAvailable && !session" class="update-notice">
      <div><span>NEW VERSION</span><strong>새로운 CBT 업데이트가 준비됐습니다</strong><small>버튼을 누르면 최신 화면과 패치노트가 적용됩니다.</small></div>
      <button type="button" @click="applyUpdate">업데이트 적용</button>
    </aside>
  </Transition>

  <Transition name="toast">
    <aside v-if="pwaRegistrationError && !updateAvailable && !session" class="update-notice pwa-error-notice">
      <div><span>PWA RECOVERY</span><strong>업데이트 연결을 자동으로 복구할 수 있습니다</strong><small>학습 기록·오답·로그인은 보존하고 서비스워커와 CBT 캐시만 다시 설정합니다.</small></div>
      <div class="pwa-error-actions">
        <button type="button" @click="openPwaRecoveryFromError">자동 복구 열기</button>
        <button type="button" class="secondary" @click="pwaRegistrationError = false">나중에</button>
      </div>
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
