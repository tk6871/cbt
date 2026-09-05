/// <reference types="vite/client" />

type CloudConfig = {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  analyticsFunction?: string;
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
  subjects?: Array<{
    subject: string;
    correct: number;
    total: number;
    score: number;
  }>;
};

interface Window {
  CBT_CLOUD_CONFIG?: CloudConfig;
  CBTAnalytics?: {
    trackAttempt: () => void;
    trackResult: (payload: AnalyticsResult) => void;
    trackNavigation: (view: string) => void;
    consent: () => string;
    revokeConsent: () => void;
  };
}
