export type Choice = {
  text?: string;
  html?: string;
  images?: string[];
};

export type AnswerHotspotSegment = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnswerHotspot = AnswerHotspotSegment & {
  choice: number;
  segments?: AnswerHotspotSegment[];
};

export type Question = {
  number: number;
  text?: string;
  html?: string;
  images?: string[];
  sourceImage?: string | null;
  choices: Choice[];
  answer: number;
  answerRate?: number | null;
  hint?: string;
  explanation?: string;
  explanationHtml?: string;
  imageOnly?: boolean;
  _subject?: string;
  sourceSubject?: string;
  targetSubject?: string;
  targetRelevance?: 'core' | 'related' | 'peripheral';
  targetMapping?: 'legacy-subject' | 'related-concept';
  sourceQualification?: string;
  _originRoundId?: string;
  _originalNumber?: number;
  answerHotspots?: AnswerHotspot[];
  source?: string;
  explanationProvenance?: string;
  explanationMatchScore?: number;
  additionalExplanations?: Array<{
    label: string;
    source: string;
    text: string;
  }>;
  sourcePage?: string;
  teacherHint?: string;
};

export type Round = {
  id: string;
  qualificationKey?: string;
  qualification?: string;
  shortQualification?: string;
  year: number;
  session?: string;
  date?: string;
  sortKey?: string;
  title: string;
  subjects: string[];
  questions: Question[];
  kind?: string;
  sourceQualification?: string;
  semester?: 1 | 2;
  examKind?: 'midterm' | 'final' | 'quiz' | 'other';
  textbook?: string;
};

export type Catalog = {
  key: string;
  name: string;
  shortName?: string;
  rounds: Round[];
  isVirtual?: boolean;
  isPlaceholder?: boolean;
  roundCount?: number;
  questionCount?: number;
};

export type QuestionItem = {
  round: Round;
  question: Question;
  subject: string;
  id: string;
};

export type StudyMode = 'learn' | 'exam';
export type CurriculumScope = 'all-mapped' | 'current' | 'legacy-original';

export type SessionState = {
  id: string;
  mode: StudyMode;
  title: string;
  items: QuestionItem[];
  answers: Record<string, number>;
  kept: string[];
  page: number;
  pageSize: number;
  startedAt: number;
  remainingSeconds: number;
  finished: boolean;
  resultSent: boolean;
  calculationMode?: boolean;
};

export type AttemptRecord = {
  count: number;
  correctCount: number;
  wrongCount: number;
  lastChoice: number;
  lastCorrect: boolean;
  at: number;
};

export type LegacyStore = {
  theme?: 'system' | 'light' | 'dark';
  fontScale?: number;
  bookmarks?: string[];
  wrong?: Record<string, { count?: number; at?: number } | number | boolean>;
  attempts?: Record<string, AttemptRecord>;
  progress?: Record<string, unknown>;
  history?: Array<Record<string, unknown>>;
  notes?: Record<string, unknown>;
  sync?: {
    bookmarks?: Record<string, { value: boolean; at: number }>;
  };
};

declare global {
  interface Window {
    CBT_DATA_HVAC?: Catalog;
    CBT_DATA_HANSOL_HVAC?: Catalog;
    CBT_DATA_SAFETY?: Catalog;
    CBT_DATA_ENERGY?: Catalog;
    CBT_DATA_ENERGY_ENGINEER?: Catalog;
    CBT_DATA_MAINTENANCE?: Catalog;
    CBT_DATA_JEWELRY?: Catalog[];
    CBT_APP_SPACE?: 'industrial' | 'jewelry';
    CBT_DISPLAY_MODE?: 'mobile' | 'desktop';
    CBT_DISPLAY_PREFERENCE?: 'auto' | 'mobile' | 'desktop';
    CBT_LOADED_QUALIFICATION?: string;
    CBT_CATALOG_INDEX?: Array<{
      key: string;
      name: string;
      shortName?: string;
      rounds: number;
      questions: number;
    }>;
    CBT_UPDATE_AVAILABLE?: boolean;
    CBT_PWA_REGISTRATION_ERROR?: boolean;
    CBT_APPLY_PWA_UPDATE?: (reloadPage?: boolean) => Promise<void>;
    CBT_CHANGELOG?: {
      currentVersion?: string;
      versions?: Record<string, string>;
      entries?: Array<{
        version: string;
        scope?: string;
        date?: string;
        title: string;
        summary?: string;
        tags?: string[];
        changes?: string[];
      }>;
    };
  }
}

export {};
