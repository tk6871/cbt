// Compare non-reversible fingerprints of previously visible reader text.
// This is evidence for review, never an automatic published-pool approval.
import fs from 'node:fs';
const dir = 'work/cooling-book-scope/';
const fingerprints = JSON.parse(fs.readFileSync(`${dir}ui-fingerprints.json`, 'utf8'));
const candidates = JSON.parse(fs.readFileSync(`${dir}match-candidates.json`, 'utf8'));
const fourths = JSON.parse(fs.readFileSync(`${dir}ui-fourth-prefix-fingerprints.json`, 'utf8'));
for (const input of [fingerprints.rows,fourths.rows]) {
  const locations = new Set();
  for (const [page,number] of input) {
    const key = `${page}:${number}`;
    if (locations.has(key)) throw new Error(`Duplicate comparison location: ${key}`);
    locations.add(key);
  }
}
const canon = value => String(value || '').normalize('NFKC').replace(/\s+/g,'')
  .replace(/[?？。]/g,'').replace(/[.,](?!\d)/g,'').toLowerCase();
const hash = value => {
  let h = 14695981039346656037n;
  for (const ch of value) { h ^= BigInt(ch.codePointAt(0)); h = BigInt.asUintN(64,h * 1099511628211n); }
  return h.toString(16);
};
const rows = fingerprints.rows.map(([page,number,stemHash,firstThreeHash]) => ({page,number,
  candidates:(candidates.rows.find(r=>r.page===page && r.number===number)?.candidates || []).map(c => ({
    id:c.id,
    stemEqual:hash(canon(c.stem))===stemHash,
    firstThreeEqual:hash((c.options || []).slice(0,3).map(o=>canon(o.text || o.html)).join('|'))===firstThreeHash,
    fourthLength:canon(c.options?.[3]?.text || c.options?.[3]?.html).length,
    fourthHash:hash(canon(c.options?.[3]?.text || c.options?.[3]?.html)),
    fourthPrefixEqual:fourths.rows.some(([p,n,len,h])=>`2-${p}`===page && n===number
      && len===canon(c.options?.[3]?.text || c.options?.[3]?.html).length
      && h===hash(canon(c.options?.[3]?.text || c.options?.[3]?.html))),
    hasGraphics:!!c.images?.length || (c.options || []).some(o=>o.images?.length || /<img|<svg|<math/i.test(o.html || '')),
  })),
}));
const result = {status:'fingerprints-only-not-approved',total:rows.length,
  matchingFirstThree:rows.filter(r=>r.candidates.some(c=>c.firstThreeEqual)).length,
  matchingStemAndFirstThree:rows.filter(r=>r.candidates.some(c=>c.firstThreeEqual && c.stemEqual)).length,rows};
result.matchingStemThreeAndFourthPrefix = rows.filter(r=>r.candidates.some(c=>
  c.firstThreeEqual && c.stemEqual && c.fourthPrefixEqual && !c.hasGraphics)).length;
result.limits = 'Text comparison evidence only. Fourth-option boundary, figures and answer validity still require review. Never changes the app pool.';
fs.writeFileSync(`${dir}fingerprint-comparison.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,rows:undefined},null,2));
