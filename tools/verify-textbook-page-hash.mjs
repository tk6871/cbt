import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {sourceAssetPath} from './source-asset-path.mjs';

const migration = JSON.parse(fs.readFileSync('data/problem-images-webp90-audit.json')).entries;
const mappings = JSON.parse(fs.readFileSync('data/problem-images-webp90.json')).mappings;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function verifyTextbookPageHash(asset, expected) {
  const original = sourceAssetPath(asset);
  if (fs.existsSync(original)) assert.equal(hash(original), expected, asset);
  if (mappings[asset]) {
    const row = migration[asset];
    assert.equal(row.sourceSha256, expected, asset);
    assert.equal(row.asset, mappings[asset], asset);
    assert.equal(hash(row.asset), row.sha256, row.asset);
  } else {
    assert.ok(fs.existsSync(original), asset);
  }
}
