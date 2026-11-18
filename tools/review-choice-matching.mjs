// The keys are for finding candidates. The reader still checks the original wording and sources.
const metadata = new Set(['number', '_originalNumber', '_originRoundId', '_subject', 'problemUrl',
  'source', 'sourcePage', 'answerRate', 'images', 'sourceImage', 'imageOnly', 'answerHotspots',
  'text', 'html', 'choices', 'answer', 'hint']);

function normalize(value) {
  // Fold visual spacing between Korean syllables and collapse other whitespace.
  // Keep signs, decimal points, Latin case, subscripts, superscripts and numeric boundaries.
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').replace(/(?<=[가-힣]) (?=[가-힣])/gu, '');
}

function content(text, html) {
  const plain = normalize(text);
  const formatted = normalize(html);
  return [plain, formatted && formatted !== plain ? formatted : ''];
}

export function choiceMatch(q) {
  if (!q.text?.trim() || q.choices?.length !== 4 || !Number.isInteger(q.answer) ||
      q.answer < 1 || q.answer > 4 || q.imageOnly || q.sourceImage || q.answerHotspots?.length ||
      q.images?.length || q.explanationImages?.length || /<img\b|<svg\b|data:image\//i.test(JSON.stringify(q))) return null;
  const choices = q.choices.map(c => {
    if (!c.text?.trim() || c.images?.length || Object.keys(c).some(k => !['text','html','images'].includes(k))) return null;
    return JSON.stringify(content(c.text, c.html));
  });
  if (choices.includes(null) || new Set(choices).size !== choices.length) return null;
  const ordered = /[①-⑳]|[1-4]\s*번\s*(?:보기|선택지)|위의\s*보기|all of the above/i.test([q.text, q.html, ...choices].join(' '));
  const canonical = ordered ? choices : [...choices].sort();
  const positions = choices.map(c => canonical.indexOf(c) + 1);
  const extra = Object.entries(q).filter(([key]) => !metadata.has(key) && !key.toLowerCase().includes('explanation')).sort();
  return {
    signature: [content(q.text, q.html), normalize(q.hint), extra, canonical],
    positions,
    correct: positions[q.answer - 1],
  };
}
