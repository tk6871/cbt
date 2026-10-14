// Compare non-reversible fingerprints of previously visible reader text.
// This is evidence for review, never an automatic published-pool approval.
import fs from 'node:fs';
import vm from 'node:vm';
const dir = 'work/cooling-book-scope/';
const fingerprints = JSON.parse(fs.readFileSync(`${dir}ui-fingerprints.json`, 'utf8'));
const candidates = JSON.parse(fs.readFileSync(`${dir}match-candidates.json`, 'utf8'));
const fourths = JSON.parse(fs.readFileSync(`${dir}ui-fourth-prefix-fingerprints.json`, 'utf8'));
for (const [kind,input] of [['stem',fingerprints.rows],['fourth',fourths.rows]]) {
  const locations = new Set();
  for (const [page,number,length] of input) {
    const key = `${page}:${number}${kind==='fourth'?`:${length}`:''}`;
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
// A book citation can omit another occurrence of the very same text. Look for
// exact stem + first-three equality across the allowed banks as well. Unlike
// fuzzy matching, this must not broaden the pool on a short keyword match.
const context = {window:{}};
for (const key of ['hvac','hvac-hansol']) vm.runInNewContext(fs.readFileSync(`data/${key}.js`,'utf8'),context);
const exactIndex = new Map();
for (const bank of Object.values(context.window)) for (const round of bank.rounds) {
  if (round.year<2006 || round.year>2023 || bank.key!==(round.year>=2017?'hvac-hansol':'hvac')
    || (round.year===2006 && round.id<'hvac-20060816')
    || (round.year===2023 && /^\d회$/.test(round.session) && parseInt(round.session,10)>3)) continue;
  for (const q of round.questions) {
    if (q.choices?.length!==4) continue;
    const key = `${hash(canon(q.text || q.html || q.ocrText))}:${hash(q.choices.slice(0,3).map(o=>canon(o.text || o.html)).join('|'))}`;
    const value = {id:`${q._originRoundId || round.id}:${q._originalNumber || q.number}`,
      stem:q.text || q.html || q.ocrText,options:q.choices,images:q.images || []};
    exactIndex.set(key,[...(exactIndex.get(key) || []),value]);
  }
}
const rows = fingerprints.rows.map(([page,number,stemHash,firstThreeHash]) => ({page,number,
  candidates:[...new Map([
    ...(candidates.rows.find(r=>r.page===page && r.number===number)?.candidates || []),
    ...(exactIndex.get(`${stemHash}:${firstThreeHash}`) || []),
  ].map(c=>[c.id,c])).values()].map(c => ({
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
