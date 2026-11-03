"""Resume-safe enhancement of clean normal-reader crops; originals preserved.

Publish only after every scheduled replacement passes its hash/size/fidelity
checks. Existing annotation-free enhanced native crops are retained unchanged.
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

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-ink-hidden'
ENGINE=ROOT/'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
PUBLIC=ROOT/'data/hansol-book-ink-hidden.json'
parser=argparse.ArgumentParser()
parser.add_argument('--limit',type=int)
parser.add_argument('--publish',action='store_true')
parser.add_argument('--finish',action='store_true')
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())

def atomic(path,data):
    staged=path.with_suffix('.pending')
    staged.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    os.replace(staged,path)

lock=(WORK/'upscale.lock').open('a')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
plan=read(WORK/'jobs.json')
assert plan.get('scope')=='affected-ink-only', 'Only ink-affected replacements are authorized'
assert len(plan['jobs'])==40 and len(plan['retainedPages'])==383
assert plan['sourceIndexSha256']==sha(ROOT/'data/hansol-book-direct.json')
assert plan['captureSha256']==sha(WORK/'capture-progress.json')
model_sha=sha(ENGINE.parent/'models/realesrgan-x4plus-anime.bin')
ledger_path=WORK/'upscale-ledger.json'
ledger=read(ledger_path) if ledger_path.exists() else {}
jobs=sorted(plan['jobs'],key=lambda r:(r['kind']=='page',r['page']!='1-25',r['key']))
for row in jobs+plan['retained']+plan['retainedPages']:
    assert sha(ROOT/row['oldAsset'])==row['oldSha256']
    assert sha(ROOT/row['sourceAsset'])==row['sourceSha256']

def fidelity(row):
    def small(path):
        with Image.open(path) as image:
            return np.asarray(image.convert('RGB').resize((256,256),Image.Resampling.LANCZOS),dtype=float)/255
    a,b=small(ROOT/row['sourceAsset']),small(ROOT/row['asset'])
    l,r=a.mean(2),b.mean(2)
    def corr(a,b):
        return float(np.corrcoef(a.ravel(),b.ravel())[0,1]) if a.std()>1e-6 and b.std()>1e-6 else float(np.allclose(a,b,atol=.02))
    metrics={'colorMAE':round(float(np.abs(a-b).mean()),6),
             'luminanceCorrelation':round(corr(l,r),6),
             'edgeCorrelation':round(corr(np.hypot(*np.gradient(l)),np.hypot(*np.gradient(r))),6)}
    assert metrics['colorMAE']<.1 and metrics['luminanceCorrelation']>.92 and metrics['edgeCorrelation']>.8, (row['key'],metrics)
    return metrics

def valid(row):
    saved=ledger.get(row['key'])
    if not saved:return False
    for key in ['oldAsset','oldSha256','sourceAsset','sourceSha256','sourceSize','outputSize','asset']:
        assert row[key]==saved[key],(row['key'],key)
    assert saved['modelSha256']==model_sha and saved['pipeline']=='4x -> 2x bicubic'
    assert sha(ROOT/saved['asset'])==saved['outputSha256']
    with Image.open(ROOT/saved['asset']) as image:
        assert list(image.size)==row['outputSize'] and image.format=='WEBP'
        image.verify()
    return True

completed=[r for r in jobs if valid(r)]
pending=[r for r in jobs if r not in completed]
if args.limit:
    assert args.limit>0
    pending=pending[:args.limit]
began=time.monotonic()
durations=[]

def progress(status,current=None,error=None):
    average=sum(durations)/len(durations) if durations else None
    report={'status':status,'completed':len(ledger),'total':len(jobs),'remaining':len(jobs)-len(ledger),
            'current':current,'retainedPreviousImages':len(plan['retained']),
            'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'error':error,
            'elapsedSeconds':round(time.monotonic()-began,1),
            'averageSeconds':round(average,2) if average else None,
            'estimatedRemainingSeconds':round(average*(len(jobs)-len(ledger))) if average else None}
    atomic(WORK/'upscale-progress.json',report)
    return report

print(json.dumps({'planned':len(jobs),'alreadyComplete':len(completed),'thisRun':len(pending),
                  'oldImprovedRetained':len(plan['retained'])}),flush=True)
if not args.check:
    try:
        for row in pending:
            before=time.monotonic();progress('upscaling',row['key'])
            destination=ROOT/row['asset'];destination.parent.mkdir(parents=True,exist_ok=True)
            if destination.exists():
                recovery=WORK/'recovery';recovery.mkdir(exist_ok=True)
                destination.rename(recovery/f'{row["key"]}-{time.time_ns()}.webp')
            with tempfile.TemporaryDirectory(prefix='cbt-hidden-upscale-') as temp:
                four=Path(temp)/'four.png'
                with (WORK/f'{row["key"]}.log').open('w') as log:
                    subprocess.run(['arch','-arm64',str(ENGINE),'-i',str(ROOT/row['sourceAsset']),
                                    '-o',str(four),'-n','realesrgan-x4plus-anime','-s','4','-t','256',
                                    '-j','1:1:1','-f','png'],cwd=ENGINE.parent,check=True,stdout=log,stderr=log)
                with Image.open(four) as image:
                    assert list(image.size)==[n*4 for n in row['sourceSize']]
                    result=image.convert('RGB').resize(tuple(row['outputSize']),Image.Resampling.BICUBIC)
                    staged=Path(temp)/'two.webp';result.save(staged,'WEBP',lossless=True,method=6)
                    with Image.open(staged) as check:
                        assert list(check.size)==row['outputSize'];check.verify()
                    destination.write_bytes(staged.read_bytes())
            record={**row,'outputSha256':sha(destination),'model':'realesrgan-x4plus-anime',
                    'modelSha256':model_sha,'native':'arm64','tile':256,'threads':'1:1:1',
                    'pipeline':'4x -> 2x bicubic','encoding':'lossless-webp-method6',
                    'totalSeconds':round(time.monotonic()-before,3)}
            record['fidelity']=fidelity(row)
            ledger[row['key']]=record;atomic(ledger_path,ledger);assert valid(row)
            durations.append(time.monotonic()-before)
            print(json.dumps(progress('upscaling',row['key']),ensure_ascii=False),flush=True)
        progress('complete' if len(ledger)==len(jobs) else 'partial')
    except BaseException as error:
        progress('interrupted',error=str(error));raise

if args.publish or args.finish or args.check:
    assert len(ledger)==len(jobs) and all(valid(row) for row in jobs), 'Not all clean replacements are complete'
    manifest={'date':'2026-11-03','basis':plan['basis'],'sourceIndexSha256':plan['sourceIndexSha256'],
              'captureSha256':plan['captureSha256'],'screens':len(read(WORK/'capture-progress.json')['rows']),
              'assets':[ledger[r['key']] for r in jobs],
              'retained':plan['retained'],
              'retainedPages':[{k:v for k,v in row.items() if k!='asset'} for row in plan['retainedPages']],
              'limits':'正常 reader ink hidden captures, not color erasure. Printed diagrams, IDs, answers, crop coordinates and old images preserved. No complete academic verification.'}
    if args.check:assert read(PUBLIC)==manifest
    else:atomic(PUBLIC,manifest)
    print(json.dumps({'published':len(jobs),'retained':len(plan['retained'])}),flush=True)
if args.finish and not args.check:
    progress('verifying-release')
    try:
        subprocess.run(['node','tools/finalize-hansol-ink-hidden.mjs'],cwd=ROOT,check=True)
        progress('finished-local-release')
    except BaseException as error:
        progress('release-verification-failed',error=str(error));raise
