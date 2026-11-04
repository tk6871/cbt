"""Resumable, two-stage full-resolution WebP90 display derivatives.

Production source images/banks are never rewritten. SVG and animation remain
original. Progress/audit live in ignored work; only approved mappings publish.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
import time
from pathlib import Path
from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/problem-webp90'
ARCHIVE = WORK / 'originals'
OUT = ROOT / 'assets/problem-webp90'
MANIFEST = ROOT / 'data/problem-images-webp90.json'
BOOK = {'hvac-hansol-book', 'hvac-hansol', 'textbook-corrections', 'energy-book-earlier',
        'energy-textbook', 'energy-theory-examples', 'energy-restored', 'energy-midterm'}
EXCLUDE = {'theme', 'icons', 'fonts', 'responsive', 'problem-webp90'}
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'}
PROFILE = {'quality': 90, 'method': 6, 'lossless': False, 'exact': True, 'pillow': pillow_version}
parser = argparse.ArgumentParser()
parser.add_argument('--phase', choices=['book', 'all'], default='book')
parser.add_argument('--plan', action='store_true')
parser.add_argument('--check', action='store_true')
parser.add_argument('--workers', type=int, default=2)
args = parser.parse_args()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
relative = lambda p: p.relative_to(ARCHIVE if p.is_relative_to(ARCHIVE) else ROOT).as_posix()
def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.pending')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    temp.replace(path)

paths_by_name = {}
for asset_root in [ROOT/'assets', ARCHIVE/'assets']:
    if not asset_root.exists(): continue
    for folder in asset_root.iterdir():
        if not folder.is_dir() or folder.name in EXCLUDE or args.phase=='book' and folder.name not in BOOK: continue
        for p in folder.rglob('*'):
            if p.is_file() and p.suffix.lower() in EXTENSIONS: paths_by_name.setdefault(relative(p),p)
paths = [p for _,p in sorted(paths_by_name.items())]
groups = {}
for p in paths:
    group = groups.setdefault(Path(relative(p)).parts[1], {'count': 0, 'bytes': 0})
    group['count'] += 1
    group['bytes'] += p.stat().st_size
if args.plan:
    print(json.dumps({'phase': args.phase, 'files': len(paths), 'sourceBytes': sum(p.stat().st_size for p in paths), 'groups': groups}, ensure_ascii=False))
    raise SystemExit()

WORK.mkdir(parents=True, exist_ok=True)
audit_path = WORK / 'audit.json'
old = json.loads(audit_path.read_text()) if audit_path.exists() else {'entries': {}}
entries = old['entries']
protected_paths = sorted(p for p in (ROOT / 'data').iterdir() if p.suffix in {'.js', '.json'} and p != MANIFEST)
before = {relative(p): sha(p) for p in protected_paths}
errors = []
started = time.monotonic()
processed = encoded = reused = 0
def convert(source):
    source_path, source_sha = relative(source), sha(source)
    previous = entries.get(source_path)
    source_bytes = source.stat().st_size
    if previous and previous.get('sourceSha256') == source_sha and previous.get('profile') == PROFILE:
        if previous.get('status') == 'retained':
            return previous, 'reused'
        target = ROOT / previous['asset']
        if target.exists() and sha(target) == previous['sha256']:
            with Image.open(target) as im:
                im.load()
                assert im.format == 'WEBP' and list(im.size) == previous['size']
            return previous, 'reused'
    assert not args.check, f'{source_path}: missing/stale output'
    base = {'source': source_path, 'sourceSha256': source_sha, 'sourceBytes': source_bytes, 'profile': PROFILE}
    if source.suffix.lower() == '.svg':
        return {**base, 'status': 'retained', 'reason': 'vector'}, 'retained'
    with Image.open(source) as raw:
        if getattr(raw, 'is_animated', False) or getattr(raw, 'n_frames', 1) > 1:
            return {**base, 'status': 'retained', 'reason': 'animation'}, 'retained'
        size = list(raw.size)
        alpha = 'A' in raw.getbands() or 'transparency' in raw.info
        image = raw.convert('RGBA' if alpha else 'RGB')
        metadata = {}
        if raw.info.get('icc_profile'): metadata['icc_profile'] = raw.info['icc_profile']
        if raw.getexif().get(274, 1) != 1: metadata['exif'] = raw.getexif().tobytes()
    name = hashlib.sha256((source_sha + json.dumps(PROFILE, sort_keys=True)).encode()).hexdigest()[:32]
    target = OUT / f'{name}.webp'
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        temp = WORK / f'{name}-{os.getpid()}-{time.time_ns()}.webp'
        image.save(temp, format='WEBP', quality=90, method=6, lossless=False, exact=True, **metadata)
        with Image.open(temp) as decoded:
            decoded.load()
            assert list(decoded.size) == size and decoded.format == 'WEBP'
            if alpha:
                assert decoded.convert('RGBA').getchannel('A').tobytes() == image.getchannel('A').tobytes()
        temp.replace(target)
    with Image.open(target) as decoded:
        decoded.load()
        assert list(decoded.size) == size and decoded.format == 'WEBP'
    assert sha(source) == source_sha, f'{source_path}: source changed during conversion'
    return {**base, 'status': 'converted', 'asset': relative(target), 'sha256': sha(target),
            'size': size, 'bytes': target.stat().st_size}, 'encoded'

def checkpoint(status):
    selected = [entries[relative(p)] for p in paths if relative(p) in entries]
    converted = [r for r in selected if r['status'] == 'converted']
    state = {'status': status, 'phase': args.phase, 'processed': processed, 'total': len(paths),
             'encoded': encoded, 'reused': reused, 'converted': len(converted),
             'retained': len(selected)-len(converted), 'sourceBytes': sum(r['sourceBytes'] for r in converted),
             'displayBytes': sum(r['bytes'] for r in converted), 'seconds': round(time.monotonic()-started, 1), 'errors': errors}
    if not args.check:
        write_json(audit_path, {'profile': PROFILE, 'entries': entries})
        write_json(WORK / 'progress.json', state)
    print(json.dumps(state, ensure_ascii=False), flush=True)
    return state

checkpoint('running')
with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
    futures = {pool.submit(convert, p): p for p in paths}
    for future in concurrent.futures.as_completed(futures):
        source = futures[future]
        try:
            entry, action = future.result()
            entries[relative(source)] = entry
            encoded += action == 'encoded'
            reused += action == 'reused'
        except Exception as error:
            errors.append({'source': relative(source), 'error': str(error)})
        processed += 1
        if processed % 100 == 0 or processed == len(paths): checkpoint('running')
assert not errors, errors[:10]
for name, expected in before.items():
    assert sha(ROOT / name) == expected, f'{name}: question/metadata changed'
mapping = {source: r['asset'] for source, r in sorted(entries.items()) if r['status'] == 'converted'}
published = {'schemaVersion': 1, 'quality': 90, 'mappings': mapping}
if args.check:
    current = json.loads(MANIFEST.read_text())
    assert current == published, 'Public display mappings differ from checked audit'
else:
    write_json(MANIFEST, published)
    write_json(WORK / 'protected-inputs.json', before)
checkpoint('complete')
