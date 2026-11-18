import disputes from '../../data/disputed-question-explanations.json' with {type:'json'};
import {coolingBookFingerprint} from './coolingBookScope';
import type {Question, Round} from './types';

type ReviewedDispute = {
  fingerprint: string;
  source: string;
  text: string;
  basis: string;
  formula?: Question['explanationFormula'];
};
const reviewed: Record<string, ReviewedDispute> = disputes;
const rounds = new Set(Object.keys(reviewed).map(id => id.split(':')[0]));

export function withDisputedExplanations(round: Round): Question[] {
  if (!rounds.has(round.id)) return round.questions;
  return round.questions.map(question => {
    const entry = reviewed[round.id + ':' + question.number];
    if (!entry || !question.explanation || question.source !== entry.source ||
        coolingBookFingerprint(question) !== entry.fingerprint) return question;
    return {
      ...question,
      explanation: entry.text,
      explanationHtml: '',
      explanationBasis: entry.basis,
      explanationFormula: entry.formula,
      explanationProvenance: 'manual-reviewed',
      additionalExplanations: [...question.additionalExplanations || [], {
        label: '등록된 이용자 해설과 이의제기',
        source: entry.source,
        text: question.explanation,
      }],
    };
  });
}
