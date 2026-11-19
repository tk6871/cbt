import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createServer} from 'vite';

const manifest = JSON.parse(await readFile('modern/pwa-build-manifest.json','utf8'));
const version = manifest['src/cbt/pwa.ts'].file.match(/-v(\d+)\.js$/)[1];
const server = await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
try {
  const {loadCatalogs,sortedRounds,questionId,subjectFor} = await server.ssrLoadModule('/src/cbt/catalog.ts');
  const {textbookSourceKeys,textbookEntries,textbookStudyItems} = await server.ssrLoadModule('/src/cbt/textbookPages.ts');
  const {energyTextbookComcbtSource} = await server.ssrLoadModule('/src/cbt/energyTextbookExplanation.ts');
  const {unpackTextbookSources} = await server.ssrLoadModule('/src/cbt/staticTextbookSources.ts');
  for (const book of ['hansol','energy']) {
    const keys = textbookSourceKeys(book);
    const supplement = book === 'energy' ? 'energy-book-earlier' : 'hvac-hansol-book';
    globalThis.window = {};
    const context = vm.createContext({window});
    for (const key of [...keys,...(book==='energy'?['energy-restored','energy-textbook']:[]),supplement]) {
      vm.runInContext(await readFile('data/'+key+'.js','utf8'),context);
    }
    const rounds = loadCatalogs().filter(c=>keys.includes(c.key)).flatMap(sortedRounds);
    rounds.push(...window['CBT_DATA_'+supplement.toUpperCase().replaceAll('-','_')].rounds);
    if (book === 'hansol') rounds.push(...JSON.parse(await readFile('data/hansol-appendix-rounds.json','utf8')));
    const all = rounds.flatMap(round=>round.questions.map(question=>({
      round,question,id:questionId(round,question),subject:subjectFor(round,question),
    })));
    const entries = textbookEntries.filter(e=>e.book===book);
    const wanted = new Set(entries.filter(e=>e.sourceId && !e.reviewHold).map(e=>e.sourceId));
    if (book==='energy') for (const id of [...wanted]) {
      const source = energyTextbookComcbtSource(id);
      if (source) wanted.add(source);
    }
    const packed = {book, rounds:[], items:[]};
    const roundIndex = new Map();
    for (const {round,id,subject,question} of all) {
      if (!wanted.has(id)) continue;
      if (!roundIndex.has(round)) {
        const {questions,...metadata} = round;
        roundIndex.set(round,packed.rounds.length);
        packed.rounds.push(metadata);
      }
      packed.items.push([roundIndex.get(round),id,subject,question]);
    }
    const json = JSON.stringify(packed);
    const expected = textbookStudyItems(all,entries);
    assert.ok(expected.length > 0);
    const restored = textbookStudyItems(unpackTextbookSources(JSON.parse(json)), entries);
    assert.equal(restored.length,expected.length,book+' 교재 문항 수');
    for (const [i,item] of expected.entries()) {
      assert.deepEqual(JSON.parse(JSON.stringify(restored[i])), JSON.parse(JSON.stringify(item)), item.id);
    }
    await writeFile(`modern/textbook-${book}-sources-v${version}.json`,json);
    console.log(book,expected.length,'verified textbook items');
  }
} finally {
  delete globalThis.window;
  await server.close();
}
