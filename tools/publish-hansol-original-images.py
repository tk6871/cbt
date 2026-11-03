"""Publish explicitly named, reviewed crops at ORIGINAL resolution only.

No image model, resize, OCR, conversion, download or bulk sweep. The PNG bytes
are copied unchanged; prior upscaled entries not named by --keys stay intact.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/hansol-book-native'
parser = argparse.ArgumentParser()
parser.add_argument('--keys', nargs='+', required=True)
args = parser.parse_args()
manifest = json.loads((WORK / 'manifest.json').read_text())
assert not manifest['errors']
rows = {row['key']: row for row in manifest['rows']}
assert len(set(args.keys)) == len(args.keys)
assert all(key in rows for key in args.keys)
ledger_path = WORK / 'upscale-ledger.json'
ledger = json.loads(ledger_path.read_text())
for key in args.keys:
    row = rows[key]
    for kind in ['question', 'explanation']:
        source = WORK / 'original' / f'{key}-{kind}.png'
        asset = ROOT / 'assets/hvac-hansol-book' / f'{kind}s' / f'{key}-original.png'
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        # Existing originals may only be reused with exactly the same bytes.
        assert not asset.exists() or hashlib.sha256(asset.read_bytes()).hexdigest() == digest
        asset.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, asset)
        assert hashlib.sha256(asset.read_bytes()).hexdigest() == digest
        ledger[f'{key}-{kind}'] = {
            'sourceSha256': digest, 'outputSha256': digest,
            'sourceSize': row[kind+'Size'], 'outputSize': row[kind+'Size'],
            'asset': str(asset.relative_to(ROOT)), 'model': 'none', 'tile': None,
            'native': 'none', 'pipeline': 'original-resolution'
        }
ledger_path.write_text(json.dumps(ledger, ensure_ascii=False, indent=2)+'\n')
print(f'{len(args.keys)*2} original PNGs published unchanged; NO upscaling')
