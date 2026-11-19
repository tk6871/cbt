import type { QuestionItem } from './types';
import review from '../../data/cooling-midterm-book-verified.json' with { type: 'json' };
import {coolingBookFingerprint} from './questionFingerprint';
export {coolingBookFingerprint} from './questionFingerprint';

const approved = new Map(review.entries.map(([id, fingerprint]) => [id, fingerprint]));
export const coolingBookReview = {
  locations: review.totalLocations, confirmed: review.confirmedLocations, pending: review.pendingLocations,
};

export function coolingBookConfirmed(item: QuestionItem): boolean {
  const id = item.id.replace(/^school-cooling::/, '');
  const expected = approved.get(id);
  return !!expected && expected === coolingBookFingerprint(item.question);
}
