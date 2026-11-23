import { questionId, subjectFor } from './catalog';
import type { TextbookKey } from './textbookRoutes';
import type { QuestionItem } from './types';

// Book-only scans share neither ordinary exam rounds nor midterm selections.
const loads = new Map<TextbookKey, Promise<QuestionItem[]>>();

export function loadTextbookSupplement(book: TextbookKey): Promise<QuestionItem[]> {
  const existing = loads.get(book);
  if (existing) return existing;
  const source = () => book === 'energy' ? window.CBT_DATA_ENERGY_BOOK_EARLIER : window.CBT_DATA_HVAC_HANSOL_BOOK;
  const loaded = new Promise<void>((resolve, reject) => {
    if (source()) { resolve(); return; }
    const script = document.createElement('script');
    const path = book === 'energy' ? 'data/energy-book-earlier.js?v=621' : 'data/hvac-hansol-book.js?v=827';
    script.src = new URL(path, document.baseURI).href;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error('교재 자료에 연결하지 못했습니다.')); };
    document.head.appendChild(script);
  }).then(async () => {
    const bank = source();
    if (!bank) throw new Error('교재 자료를 읽지 못했습니다.');
    const rounds = book === 'hansol' ? [...bank.rounds,...(await import('../../data/hansol-appendix-rounds.json')).default] : bank.rounds;
    return rounds.flatMap(round => round.questions.map(question => ({
      round, question, subject: subjectFor(round, question), id: questionId(round, question),
    })));
  }).catch(error => { loads.delete(book); throw error; });
  loads.set(book, loaded);
  return loaded;
}
