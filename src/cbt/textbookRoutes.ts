export type TextbookKey = 'hansol' | 'energy';

export const textbookNames = { hansol:'한솔 공조 교재', energy:'에너지설비 교재' };

export const textbookSourceKeys = (book: TextbookKey) => book === 'hansol' ? ['hvac', 'hvac-hansol'] : ['energy', 'energy-midterm'];

// Route and saved-record recognition must not import the book page indexes.
export function bookForStudyId(id: string): TextbookKey | undefined {
  if (id.startsWith('hansol-direct-')) return 'hansol';
  return /^book-study::(hansol|energy)::/.exec(id)?.[1] as TextbookKey | undefined;
}
