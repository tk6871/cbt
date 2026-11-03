"""Resume-safe direct-page upscale; keep original images and crop coordinates.

The existing Mac Real-ESRGAN x4plus-anime -> 2x bicubic pipeline, one page per
process. Only an audited companion manifest is published; book text, answers,
IDs, original page metadata and all existing improved images stay untouched.
"""
import argparse
import fcntl
import hashlib
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work/hansol-direct-upscale'
ASSETS = ROOT / 'assets/hvac-hansol-book/direct-pages/upscaled-2x'
ENGINE = ROOT / 'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
MODEL = ENGINE.parent / 'models/realesrgan-x4plus-anime.bin'
INDEX = ROOT / 'data/hansol-book-direct.json'
PUBLIC = ROOT / 'data/hansol-book-direct-upscale.json'
parser = argparse.ArgumentParser()
parser.add_argument('--limit', type=int)
parser.add_argument('--pages', nargs='+')
parser.add_argument('--check', action='store_true')
parser.add_argument('--publish', action='store_true')
parser.add_argument('--finish', action='store_true', help='Publish, verify, build and record the release after all pages finish')
args = parser.parse_args()
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
WORK.mkdir(parents=True, exist_ok=True)

def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix+'.pending')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    os.replace(temporary, path)

lock = (WORK / 'runner.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
index = read(INDEX)
pages = index['pages']
model_hash = sha(MODEL)
ledger_path = WORK / 'ledger.json'
ledger = read(ledger_path) if ledger_path.exists() else {}
assert ENGINE.exists()
for row in pages:
    assert sha(ROOT/row['asset']) == row['sha256'], row['page']

def fidelity(row, asset):
    def small(path):
        with Image.open(path) as image:
            return np.asarray(image.convert('RGB').resize((256,256),Image.Resampling.LANCZOS),dtype=np.float64)/255
    original, enhanced = small(ROOT/row['asset']), small(asset)
    left, right = original.mean(axis=2), enhanced.mean(axis=2)
    def correlation(a,b):
        return float(np.corrcoef(a.ravel(),b.ravel())[0,1]) if a.std()>1e-6 and b.std()>1e-6 else float(np.allclose(a,b,atol=.02))
    def edges(a):
        x,y=np.gradient(a)
        return np.hypot(x,y)
    metrics={'colorMAE':float(np.abs(original-enhanced).mean()),
             'luminanceCorrelation':correlation(left,right),
             'edgeCorrelation':correlation(edges(left),edges(right))}
    assert metrics['colorMAE']<.1 and metrics['luminanceCorrelation']>.92 and metrics['edgeCorrelation']>.8, (row['page'],metrics)
    return {key:round(value,6) for key,value in metrics.items()}

def valid(row):
    old = ledger.get(row['page'])
    if not old:
        return False
    assert old['sourceAsset'] == row['asset'] and old['sourceSha256'] == row['sha256'], row['page']
    assert old['coordinateSize'] == row['size'], row['page']
    assert old['model'] == 'realesrgan-x4plus-anime' and old['modelSha256'] == model_hash
    assert old['pipeline'] == '4x -> 2x bicubic' and old['tile'] == 256 and old['native'] == 'arm64'
    assert old['outputSize'] == [n*2 for n in row['size']], row['page']
    path = ROOT / old['asset']
    assert path.exists() and sha(path) == old['outputSha256'], row['page']
    with Image.open(path) as image:
        assert list(image.size) == old['outputSize'] and image.format == 'WEBP', row['page']
        image.verify()
    if 'fidelity' not in old:
        old['fidelity']=fidelity(row,path)
    return True

completed = [row for row in pages if valid(row)]
if ledger:
    atomic_json(ledger_path,ledger)
pending = [row for row in pages if row not in completed]
if args.pages:
    assert set(args.pages) <= {r['page'] for r in pages}
    pending = [r for r in pending if r['page'] in args.pages]
if args.limit:
    assert args.limit > 0
    pending = pending[:args.limit]
print(json.dumps({'total':len(pages),'alreadyComplete':len(completed),'pendingThisRun':len(pending),
                  'originalsPreserved':True,'checkOnly':args.check}), flush=True)
start = time.monotonic()
timings = []

def progress(current=None, status='running'):
    done = len(ledger)
    average = sum(timings)/len(timings) if timings else None
    report = {'status':status,'total':len(pages),'completed':done,'remaining':len(pages)-done,
              'currentPage':current,'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),
              'elapsedSeconds':round(time.monotonic()-start,1),
              'averageSecondsPerPage':round(average,2) if average else None,
              'estimatedRemainingSeconds':round(average*(len(pages)-done)) if average else None}
    atomic_json(WORK/'progress.json',report)
    return report

if not args.check:
    ASSETS.mkdir(parents=True,exist_ok=True)
    try:
        for row in pending:
            page = row['page']
            progress(page)
            before = time.monotonic()
            destination = ASSETS/f'{page}.webp'
            # If a stop happened after output write but before ledger commit,
            # preserve the orphan and retry; never overwrite it silently.
            if destination.exists():
                recovery=WORK/'recovery';recovery.mkdir(exist_ok=True)
                destination.rename(recovery/f'{page}-{time.time_ns()}.webp')
            with tempfile.TemporaryDirectory(prefix='cbt-direct-upscale-') as temporary:
                four = Path(temporary)/'four.png'
                log = WORK/f'{page}.log'
                with log.open('w') as output:
                    subprocess.run(['arch','-arm64',str(ENGINE),'-i',str(ROOT/row['asset']),
                                    '-o',str(four),'-n','realesrgan-x4plus-anime','-s','4',
                                    '-t','256','-j','1:1:1','-f','png'],
                                   cwd=ENGINE.parent,check=True,stdout=output,stderr=output)
                inference = time.monotonic()-before
                with Image.open(four) as image:
                    assert list(image.size) == [n*4 for n in row['size']], page
                    result = image.convert('RGB').resize(tuple(n*2 for n in row['size']),Image.Resampling.BICUBIC)
                    staged = Path(temporary)/'two.webp'
                    result.save(staged,'WEBP',lossless=True,method=6)
                    with Image.open(staged) as check:
                        assert check.size == result.size
                        check.verify()
                    # Copy verified bytes; never overwrite the original PNG.
                    destination.write_bytes(staged.read_bytes())
            duration = time.monotonic()-before
            record = {'page':page,'sourceAsset':row['asset'],'sourceSha256':row['sha256'],
                      'coordinateSize':row['size'],'outputSize':[n*2 for n in row['size']],
                      'asset':str(destination.relative_to(ROOT)),'outputSha256':sha(destination),
                      'model':'realesrgan-x4plus-anime','modelSha256':model_hash,'tile':256,
                      'native':'arm64','threads':'1:1:1','pipeline':'4x -> 2x bicubic',
                      'encoding':'lossless-webp-method6','inferenceSeconds':round(inference,3),
                      'totalSeconds':round(duration,3)}
            record['fidelity']=fidelity(row,destination)
            ledger[page] = record
            atomic_json(ledger_path,ledger)
            assert valid(row)
            timings.append(duration)
            print(json.dumps(progress(page),ensure_ascii=False),flush=True)
        progress(status='complete' if len(ledger)==len(pages) else 'partial')
    except BaseException as error:
        report=progress(status='interrupted')
        report['error']=str(error)
        atomic_json(WORK/'progress.json',report)
        raise

if args.publish or args.check or args.finish:
    assert len(ledger)==len(pages) and all(valid(row) for row in pages), 'all397 pages must be verified before publishing'
    public={'date':'2026-11-03','basis':'기존 정상 열람 원해상도397쪽의화질 개선. 문제·정답·좌표를 새로 추정하지 않습니다.',
            'sourceIndexSha256':sha(INDEX),'pages':[ledger[row['page']] for row in pages],
            'limits':'원본 PNG·기존 업스케일 보존. 위치 좌표는 원래 해상도 기준으로 유지하고 이미지만2배로 표시합니다. 정답 검증이나 미분리 풀이 경계 보완을 뜻하지 않습니다.'}
    if args.check:
        assert read(PUBLIC)==public, 'published upscale manifest is stale'
    else:
        atomic_json(PUBLIC,public)
    print(json.dumps({'published':len(pages),'checkedOnly':args.check,
                      'bytes':sum((ROOT/r['asset']).stat().st_size for r in public['pages'])}),flush=True)
if args.finish and not args.check:
    progress(status='verifying-release')
    try:
        subprocess.run(['node','tools/finalize-hansol-direct-upscale.mjs'],cwd=ROOT,check=True)
        progress(status='finished-local-release')
    except BaseException as error:
        report=progress(status='release-verification-failed')
        report['error']=str(error)
        atomic_json(WORK/'progress.json',report)
        raise
