// Two upstream explanatory comments accidentally look like Rollup directives.
// Normalize only that prose, keeping every real PURE annotation and statement.
export function normalizeZodComment(code, id) {
  if (!/\/node_modules\/(?:.*\/)?zod\/v4\/core\/(?:util|regexes)\.js(?:\?.*)?$/.test(id.replaceAll('\\', '/'))) return null;
  const fixed = code
    .replace('Wrapped in a `@__PURE__` IIFE:', 'Wrapped in a PURE IIFE:')
    .replace('esbuild will not drop a `@__PURE__` call', 'esbuild will not drop a PURE call');
  return fixed === code ? null : { code: fixed, map: null };
}
export const zodCommentCompat = () => ({ name: 'zod-comment-compat', enforce: 'pre', transform: normalizeZodComment });
