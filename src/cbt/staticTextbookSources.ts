import type { Question, QuestionItem, Round } from './types';
import type { TextbookKey } from './textbookRoutes';

declare const __CBT_BUILD_VERSION__: string;

export interface TextbookSourceFile {
  book: TextbookKey;
  rounds: Omit<Round, 'questions'>[];
  items: [roundIndex: number, id: string, subject: string, question: Question][];
}

export function unpackTextbookSources(file: TextbookSourceFile): QuestionItem[] {
  const rounds: Round[] = file.rounds.map(round => ({...round, questions: []}));
  return file.items.map(([index,id,subject,question]) => {
    const round = rounds[index];
    if (!round || !question || !id) throw new Error('교재 문항 자료를 확인하세요.');
    return {round, id, subject, question};
  });
}

export async function fetchTextbookSources(book: TextbookKey): Promise<QuestionItem[]> {
  const url = new URL(`modern/textbook-${book}-sources-v${__CBT_BUILD_VERSION__}.json`, document.baseURI);
  const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('교재 문항을 받지 못했습니다.');
  const file: TextbookSourceFile = await response.json();
  if (file.book !== book || !file.items.length) throw new Error('교재 종류를 확인하세요.');
  return unpackTextbookSources(file);
}
