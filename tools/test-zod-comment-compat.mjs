import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeZodComment } from './zod-comment-compat.mjs';
test('fixes prose without removing real optimization annotations or logic', () => {
  const source = '// Wrapped in a `@__PURE__` IIFE:\nconst result=/*@__PURE__*/ work();';
  const result = normalizeZodComment(source, '/project/node_modules/.pnpm/zod@4.5.4/node_modules/zod/v4/core/util.js');
  assert.equal(result.code, '// Wrapped in a PURE IIFE:\nconst result=/*@__PURE__*/ work();');
  assert.equal(normalizeZodComment(result.code, '/project/node_modules/zod/v4/core/util.js'), null);
  assert.equal(normalizeZodComment(source, '/project/src/util.js'), null);
});
test('handles block-comment prose and Windows paths', () => {
  const source = '/** esbuild will not drop a `@__PURE__` call */\nconst date=/*@__PURE__*/ anchor(source);';
  assert.equal(normalizeZodComment(source, 'C:\\project\\node_modules\\zod\\v4\\core\\regexes.js').code,
    '/** esbuild will not drop a PURE call */\nconst date=/*@__PURE__*/ anchor(source);');
});
