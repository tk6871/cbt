// Filter the editorial queue by the origin of the question. A related explanation
// may cite COMCBT even when the question itself came from a printed book.
const energyBooks = new Set(['energy-textbook', 'energy-restored', 'energy-book-earlier']);

export function isComcbtSource(value) {
  return /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*comcbt\.com(?:[/:?#]|$)/i.test(String(value || '').trim());
}

export function questionOriginExclusion(bank, round, question) {
  if ([question.source, question.problemUrl].some(isComcbtSource)) return 'comcbt';
  if (!question.source && !question.problemUrl && [round.source, bank.source].some(isComcbtSource)) return 'comcbt';
  if (energyBooks.has(bank.key) || (bank.key === 'energy-midterm' && /교재/.test(question.sourcePage || ''))) return 'energyBook';
  return null;
}

const authoredWhenMissing = new Set([
  'concise-answer-guide', 'hansol-beginner-authored', 'local-beginner-authored',
  'printed-question-and-answer-supplement',
]);

export function hasAuthoredMissingExplanation(question, review) {
  return authoredWhenMissing.has(question.explanationProvenance)
    || authoredWhenMissing.has(review?.previousExplanationProvenance)
    || Boolean(review?.reviewedAnswerNotice)
    || (review?.changed === true && review.changeReason === '해설 미등록');
}

export function questionExclusion(bank, round, question, review) {
  return hasAuthoredMissingExplanation(question, review) ? null : questionOriginExclusion(bank, round, question);
}
