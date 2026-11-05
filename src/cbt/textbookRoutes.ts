export type TextbookKey = 'hansol' | 'energy';

export const textbookSourceKeys = (book: TextbookKey) => book === 'hansol' ? ['hvac', 'hvac-hansol'] : ['energy', 'energy-midterm'];

// Route and saved-record recognition must not import the book page indexes.
export function bookForStudyId(id: string): TextbookKey | undefined {
  return /^book-study::(hansol|energy)::/.exec(id)?.[1] as TextbookKey | undefined;
}
