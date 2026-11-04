import reviewed from '../../data/textbook-explanation-text.json' with {type:'json'};
import boundaries from '../../data/hansol-book-direct-boundaries.json' with {type:'json'};
import {textbookDirectPageMap, type TextbookDirectPart, type TextbookDirectSource} from './textbookPages';

const entries = new Map(reviewed.entries.map(entry => [entry.id, entry]));
const extraAssets = new Map(boundaries.assets.map(asset => [asset.asset, asset.sha256]));
function geometry(parts: TextbookDirectPart[]): string {
  return JSON.stringify(parts.map(p => [p.page, p.rect, p.asset || '', p.size || []]));
}
/** A changed source falls back to its image, never to a stale transcription. */
export function textbookExplanationText(source: TextbookDirectSource) {
  const entry = entries.get(source.id);
  if (!entry || entry.page !== source.page || entry.number !== source.number
    || geometry(entry.questionParts) !== geometry(source.questionParts)
    || geometry(entry.solutionParts) !== geometry(source.solutionParts)) return;
  for (const [i, part] of source.solutionParts.entries()) {
    const page = textbookDirectPageMap.get(part.page);
    const asset = part.asset || page?.asset;
    const sha256 = part.asset ? extraAssets.get(part.asset) : page?.sha256;
    if (!asset || !sha256 || entry.assets[i]?.asset !== asset || entry.assets[i]?.sha256 !== sha256) return;
  }
  return {...entry,blocks:entry.blocks as Array<{text?:string;tex?:string;label?:string}>};
}
