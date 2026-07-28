/// <reference types="vite/client" />

type CloudConfig = {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  analyticsFunction?: string;
};

type AnalyticsAttempt = {
  qualificationKey?: string;
  qualification?: string;
  roundId?: string;
  roundTitle?: string;
  questionNumber: number;
  selectedAnswer: number;
  correctAnswer: number;
  correct: boolean;
  mode?: string;
};

type AnalyticsResult = {
  qualificationKey?: string;
  qualification?: string;
  roundId?: string;
  title?: string;
  mode?: string;
  score: number;
  correct: number;
  total: number;
  unanswered: number;
  durationSeconds?: number;
};

interface Window {
  CBT_CLOUD_CONFIG?: CloudConfig;
  CBTAnalytics?: {
    trackAttempt: (payload: AnalyticsAttempt) => void;
    trackResult: (payload: AnalyticsResult) => void;
    trackNavigation: (view: string) => void;
    consent: () => string;
    revokeConsent: () => void;
  };
}
