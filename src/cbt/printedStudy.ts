import { coolingOriginalId } from './coolingRecordId';
import { problemImage } from './problemImages';
import type { Question, QuestionItem } from './types';

export type PrintedStudyQuestion = NonNullable<Question['reviewedPrint']>;
type Reading = { html?: string; question?: PrintedStudyQuestion; diagram?: boolean };
export type PrintedStudyData = {
  books: Record<string, PrintedStudyQuestion>;
  assets: Record<string, Reading>;
  placements?: Record<string, {path:string; question:PrintedStudyQuestion}>;
};
declare global { interface Window { CBT_PRINTED_STUDY?: PrintedStudyData } }

function pathKey(source?: string | null) {
  return problemImage(source)?.replace(/^https:\/\/tk6871\.github\.io\/cbt\/|^\.\//, '').split(/[?#]/)[0];
}
export function assetReading(source?: string | null) {
  const normalized = pathKey(source);
  return normalized && window.CBT_PRINTED_STUDY ? window.CBT_PRINTED_STUDY.assets[normalized] : undefined;
}

export function printedQuestion(item: QuestionItem) {
  const data = window.CBT_PRINTED_STUDY;
  const question = item.question;
  // A textbook variant can use a different order or answer from its source question.
  const id = coolingOriginalId(item.id);
  const book = data?.books[id];
  const singlePhoto = !question.sourceImage && question.images?.length === 1
    && question.choices.every(c=>!c.images?.length && /^(?:[①②③④]|[1-4]번)?$/.test((c.text || c.html || '').trim()))
    ? question.images[0] : undefined;
  const placement = data?.placements?.[id];
  const confirmed = placement && placement.path === pathKey(question.sourceImage) ? placement.question : undefined;
  let inline: PrintedStudyQuestion | undefined;
  if (data && question.html?.includes('data:image')) {
    for (const match of question.html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) {
      const p=assetReading(match[1])?.question;
      if (p?.deferredOriginal) {inline=p;break;}
    }
  }
  const reading = book || confirmed || inline || (!question.bookCorrection ? question.reviewedPrint : undefined) || assetReading(question.sourceImage || singlePhoto)?.question;
  if (!reading || reading.choices.length !== question.choices.length ||
      (reading.sourceNumber != null && reading.sourceNumber !== question.number && reading.sourceNumber !== question.bookSourceNumber) ||
      (reading.answerKey != null && reading.answerKey !== question.answer)) return;
  return reading;
}

// Older published archives used these status messages in the solution field.
const missingSolutions = new Set(['복원 PDF에 별도 인쇄 해설 없음', '별도 인쇄 해설 없음', '인쇄 해설 원본 미확보']);
export function printedSolutionHtml(print?: PrintedStudyQuestion) {
  const html = print?.solutionHtml;
  return html?.trim() && !missingSolutions.has(html.trim()) ? html : undefined;
}

export function replacePrintedInline(html: string) {
  if (!window.CBT_PRINTED_STUDY || !/<img\b/i.test(html)) return html;
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const source = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
    return assetReading(source)?.html || tag;
  });
}

export function hasPrintedInline(html?: string) {
  if (!html || !window.CBT_PRINTED_STUDY || !html.includes('<img')) return false;
  for (const match of html.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) {
    if (assetReading(match[1])?.html) return true;
  }
  return false;
}
