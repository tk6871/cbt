import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Conversion archives retain the input bytes. Hash checks must read those bytes.
/** @param {string} path */
export function readOriginalAsset(path) {
  const archive = process.env.CBT_ORIGINAL_ASSET_DIR || 'work/problem-webp90/originals';
  return readFileSync(existsSync(path) ? path : join(archive, path));
}
