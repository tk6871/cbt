import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = 'https://tk6871-cbt-api.onrender.com/api';
const [ref, ...banks] = process.argv.slice(2);
if (!ref || !banks.length || banks.some(bank => !/^[a-z][a-z0-9-]*$/.test(bank))) {
  throw new Error('Usage: node server/verify-catalog-deployment.mjs <git-ref> <bank> [bank ...]');
}
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:128 * 1024 * 1024});
const commit = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim();

function questions(bank) {
  const items = new Map();
  for (const catalog of [bank].flat()) {
    for (const round of catalog.rounds) {
      for (const question of round.questions) {
        items.set([catalog.key, round.id, question.number].join('/'), question);
      }
    }
  }
  return items;
}

for (const bank of banks) {
  const source = git('show', commit + ':data/' + bank + '.js');
  const assignment = /window\.CBT_DATA_[A-Z_]+\s*=\s*/.exec(source);
  if (!assignment) throw new Error('Unknown catalog format: ' + bank);
  const expected = JSON.parse(source.slice(assignment.index + assignment[0].length).trim().replace(/;$/, ''));
  const response = await fetch(api + '/catalogs/' + bank, {redirect:'error', cache:'no-store', signal:AbortSignal.timeout(90000)});
  if (!response.ok) throw new Error(bank + ': HTTP ' + response.status);
  const served = await response.json();
  const match = isDeepStrictEqual(expected, served);
  const items = questions(expected);
  console.log(commit.slice(0, 9), bank, items.size, 'question IDs, complete catalog', match ? 'MATCH' : 'MISMATCH');
  if (!match) {
    const actual = questions(served);
    const ids = new Set([...items.keys(), ...actual.keys()]);
    const changed = [...ids].filter(id => !isDeepStrictEqual(items.get(id), actual.get(id)));
    console.error(changed.length, 'differing question IDs', changed.slice(0, 3).join(', '));
    process.exitCode = 1;
  }
}
