"""Revisit authorized normal reader pages with the reader's ink hidden.

No ebook files, capture/security settings, pixel erasing, OCR transcription or
model calls. Old screens/assets are preserved. Every page turn must match the
previously captured printed layout before the next key is sent.
"""
import argparse
import hashlib
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageStat, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'work/hansol-whole-book/screens'
WORK = ROOT / 'work/hansol-ink-hidden'
parser = argparse.ArgumentParser()
parser.add_argument('--window', type=int, required=True)
parser.add_argument('--start', type=int, required=True)
parser.add_argument('--stop', type=int, required=True)
args = parser.parse_args()
assert 0 <= args.start <= args.stop < 620
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
targets = {r['spread'] for r in read(ROOT/'data/hansol-book-direct.json')['pages']}
for row in read(ROOT/'tools/hansol-book-native-review.json')['rows']:
    targets.add(row['spread'])
    for part in row.get('questionParts', []) + row.get('explanationParts', []):
        targets.add(part.get('spread', row['spread']))
WORK.mkdir(parents=True, exist_ok=True)
(WORK/'screens').mkdir(exist_ok=True)
state_path = WORK/'capture-progress.json'
state = read(state_path) if state_path.exists() else {
    'basis': 'user-observed Kyobo eye-button hides ink; normal visible UI only',
    'originalsPreserved': True, 'targetScreens': sorted(targets), 'rows': {},
    'restoreRequired': {'progressPercent': 84, 'twoPageLandscape': False,
                        'windowSize': [1024, 800]},
}

def save(status, **extra):
    state.update(status=status, updatedAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'), **extra)
    pending = state_path.with_suffix('.pending')
    pending.write_text(json.dumps(state, ensure_ascii=False, indent=2)+'\n')
    os.replace(pending, state_path)

def apple(lines):
    proc = subprocess.run(['osascript', *sum((['-e', v] for v in lines), [])],
                          text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.strip())
    return proc.stdout.strip()

def check_window():
    value = apple(['tell application "System Events" to tell process "iPadB2C"',
                   'get size of window "교보eBook"', 'end tell'])
    assert value == '1440, 991', f'Window changed: {value}'

def advance():
    apple(['tell application "System Events" to tell process "iPadB2C"',
           'set frontmost to true', 'perform action "AXRaise" of window "교보eBook"', 'delay 0.2',
           'if frontmost is false then error "Cannot activate reader; stop"',
           'end tell', 'tell application "System Events" to key code 124'])
    time.sleep(.65)

def reduced(path):
    with Image.open(path) as image:
        assert image.size == (2880, 1982), image.size
        body = image.convert('RGB').crop((80, 100, 2800, 1940))
        assert max(ImageStat.Stat(body).stddev) > 8, 'Blank/restricted screen: do not bypass'
        return np.asarray(body.resize((680,460), Image.Resampling.BOX), dtype=np.float32)

def compare(old, new):
    a, b = reduced(old), reduced(new)
    # This compares print identity, not an academic/semantic verification.
    # No red/black content is removed or reconstructed in either image.
    error = np.abs(a-b)
    corr = float(np.corrcoef(a.mean(2).ravel(), b.mean(2).ravel())[0,1])
    luma = [x[:,:,0]*.299+x[:,:,1]*.587+x[:,:,2]*.114 for x in (a,b)]
    edge = [np.hypot(*np.gradient(x)) for x in luma]
    half_edges = [float(np.corrcoef(edge[0][:,i:i+340].ravel(),
                                   edge[1][:,i:i+340].ravel())[0,1])
                  for i in (0,340)]
    metrics = {'mae': round(float(error.mean()),6), 'correlation': round(corr,6),
               'changedFraction': round(float((error.max(2)>32).mean()),6),
               'halfEdgeCorrelations': [round(v,6) for v in half_edges],
               'luminanceMAE': round(float(np.abs(luma[0]-luma[1]).mean()),6)}
    # A large cyan chapter cover can differ in RGB under display color
    # profiles. Permit that only if BOTH printed halves have near-identical
    # edge layouts. This does not alter or erase any captured pixels.
    color_only = min(half_edges) > .995 and metrics['luminanceMAE'] < 12
    sparse_ink = (metrics['mae'] < 1.25 and metrics['changedFraction'] < .012
                  and corr > .94 and min(half_edges) > .85)
    good = (corr > .97 and ((metrics['mae'] < 4 and metrics['changedFraction'] < .045)
                           or (metrics['mae'] < 12 and color_only))) or sparse_ink
    if not good and metrics['mae'] < 12:
        # Dense handwritten notes can dominate correlation while all printed
        # glyphs still agree exactly. Require new black print to be present in
        # the old capture in EVERY occupied small block, not merely one global
        # page score. The old capture may have extra ink; it cannot lack print.
        with Image.open(old) as previous, Image.open(new) as current:
            old_rgb=np.asarray(previous.convert('RGB'))
            old_min=Image.fromarray(old_rgb.min(2)).filter(ImageFilter.MinFilter(5))
            old_ink=np.asarray(old_min)<200
            new_ink=np.asarray(current.convert('L'))<130
            recalls=[]
            for y in range(100,1940,230):
                for x in range(80,2800,340):
                    need=new_ink[y:y+230,x:x+340]
                    if need.sum()>100:
                        recalls.append(float((old_ink[y:y+230,x:x+340]&need).sum()/need.sum()))
            metrics['printedBlockRecallMinimum']=round(min(recalls,default=0),6)
            good=len(recalls)>=8 and min(recalls)>.985
    return good, metrics

try:
    with tempfile.TemporaryDirectory(prefix='cbt-hidden-reader-') as scratch:
        probe = Path(scratch)/'screen.png'
        start = args.start
        # Restart only on an exact observed screen. Never guess whether the
        # previous interruption occurred before or after its final Right key.
        if state.get('currentSpread') is not None:
            subprocess.run(['/usr/sbin/screencapture', '-x', '-o', '-l',
                            str(args.window), str(probe)], check=True)
            last = state['currentSpread']
            matches = [n for n in sorted({last, min(last+1, args.stop)})
                       if compare(OLD/f'spread-{n:04}.png', probe)[0]]
            assert len(matches) == 1, f'Cannot safely resume from spread {last}: {matches}'
            start = matches[0]
        for index in range(start, args.stop+1):
            check_window()
            old = OLD/f'spread-{index:04}.png'
            for attempt in range(3):
                subprocess.run(['/usr/sbin/screencapture', '-x', '-o', '-l',
                                str(args.window), str(probe)], check=True)
                good, metrics = compare(old, probe)
                if good:
                    break
                if index>args.start and compare(OLD/f'spread-{index-1:04}.png',probe)[0]:
                    # A normal key can be consumed by the reader while focus
                    # changes. Retry ONLY when the previous exact printed
                    # page is still visibly present; never skip an unknown page.
                    advance()
                time.sleep(.5)
            if not good:
                (WORK/f'mismatch-{index:04}.png').write_bytes(probe.read_bytes())
                raise RuntimeError(f'Print layout mismatch at spread {index}: {metrics}; stopped without skipping')
            if index in targets:
                destination = WORK/'screens'/old.name
                if destination.exists():
                    assert compare(destination, probe)[0], 'Different resumed capture'
                else:
                    destination.write_bytes(probe.read_bytes())
                state['rows'][str(index)] = {
                    'spread': index, 'image': str(destination.relative_to(ROOT)),
                    'sha256': sha(destination), 'oldSha256': sha(old),
                    'layoutComparison': metrics,
                    'basis': 'reader-ink-hidden-not-pixel-erased',
                }
            save('capturing', currentSpread=index, completed=len(state['rows']),
                 total=len(targets), lastError=None)
            if index in targets:
                print(f'Clean screen {index}: {len(state["rows"])}/{len(targets)} {metrics}', flush=True)
            if index < args.stop:
                advance()
    complete = targets <= {int(n) for n in state['rows']}
    save('captured-needs-crop-audit' if complete else 'partial', lastError=None)
except BaseException as error:
    save('stopped-needs-review', lastError=str(error))
    raise
