import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readGitFileList, readNulSeparated } from './git-file-list.mjs';

test('streams a UTF-8 file list much larger than the default 1 MiB buffer', async () => {
  const count = 35_000;
  const prefix = 'assets/문제 경로/' + 'x'.repeat(70);
  const result = await readNulSeparated(process.execPath, ['-e',
    `for(let i=0;i<${count};i++)process.stdout.write(${JSON.stringify(prefix)}+i+'.webp\\0')`]);
  assert.equal(result.size, count);
  assert.ok(result.has(`${prefix}0.webp`));
  assert.ok(result.has(`${prefix}${count - 1}.webp`));
});
test('matches Git exactly for the real checkout, including spaces and Korean', async () => {
  const expected = new Set(execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean));
  assert.deepEqual(await readGitFileList(), expected);
});
test('rejects a failed command without accepting partial output', async () => {
  await assert.rejects(readNulSeparated(process.execPath, ['-e',
    "process.stdout.write('partial\\0');process.stderr.write('fixture failure');process.exitCode=7"]), /Path listing failed \(7\): fixture failure/);
});
test('rejects unterminated paths and reports a missing executable', async () => {
  await assert.rejects(readNulSeparated(process.execPath, ['-e', "process.stdout.write('incomplete')"]), /NUL terminator/);
  await assert.rejects(readNulSeparated('cbt-nonexistent-command-for-test', []), /ENOENT/);
});
