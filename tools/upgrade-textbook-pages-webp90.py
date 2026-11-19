"""Resume-safe exact-source 2x enhancement + WebP90. Never upscale a lossy input.

Original pages removed from the public bundle are reconstructed from their
local captures and MUST match their recorded SHA before inference.
"""
import argparse, hashlib, json, subprocess, tempfile, time, fcntl
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/textbook-completeness/upscale'
WORK.mkdir(parents=True,exist_ok=True)
lock=(WORK/'runner.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int);parser.add_argument('--publish',action='store_true');args=parser.parse_args()
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):
 tmp=p.with_suffix('.pending');tmp.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');tmp.replace(p)
book=read(ROOT/'data/hansol-book-direct.json')
clean={r['oldAsset']:r for r in read(ROOT/'data/hansol-book-ink-hidden.json')['assets']}
webp=read(ROOT/'data/problem-images-webp90.json')['mappings']
engine=ROOT/'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
model=engine.parent/'models/realesrgan-x4plus-anime.bin'
ledger_path=WORK/'ledger.json';ledger=read(ledger_path) if ledger_path.exists() else {}
dest=ROOT/'assets/hvac-hansol-book/direct-pages/upscaled-2x';dest.mkdir(parents=True,exist_ok=True)
pending=[];skipped=[]
for row in book['pages']:
 if row['asset'] in clean:
  c=clean[row['asset']];assert (ROOT/webp.get(c['asset'],c['asset'])).exists()
  skipped.append(row['page']);continue
 old=ledger.get(row['page'])
 if old:
  assert old['sourceSha256']==row['sha256'] and old['encoding']=='webp-quality90-method6'
  assert sha(ROOT/old['asset'])==old['outputSha256'];continue
 pending.append(row)
initial=len(ledger);start=time.monotonic()
def status(state,page=None,error=None):
 report={'status':state,'total':len(book['pages']),'alreadyImproved':len(skipped),'completed':len(ledger),'remaining':len(book['pages'])-len(skipped)-len(ledger),'currentPage':page,'elapsedSeconds':round(time.monotonic()-start),'error':error}
 save(WORK/'progress.json',report);print(json.dumps(report),flush=True)
status('running')
try:
 for row in pending[:args.limit] if args.limit else pending:
  page=row['page'];status('processing',page)
  with tempfile.TemporaryDirectory(prefix='cbt-textbook-upscale-') as tmp:
   tmp=Path(tmp);source=tmp/'source.png';four=tmp/'four.png'
   original=ROOT/row['asset']
   if original.exists():source=original
   else:
    capture=ROOT/f"work/hansol-whole-book/screens/spread-{row['spread']:04}.png"
    with Image.open(capture) as im:im.crop(tuple(row['sourceCrop'])).save(source)
   assert sha(source)==row['sha256'], f'{page}: original SHA mismatch'
   with (WORK/f'{page}.log').open('w') as log:
    subprocess.run(['arch','-arm64',str(engine),'-i',str(source),'-o',str(four),'-n','realesrgan-x4plus-anime','-s','4','-t','256','-j','1:1:1','-f','png'],cwd=engine.parent,stdout=log,stderr=log,check=True)
   target=dest/f'{page}.webp'
   with Image.open(four) as im:
    assert list(im.size)==[n*4 for n in row['size']]
    result=im.convert('RGB').resize(tuple(n*2 for n in row['size']),Image.Resampling.BICUBIC)
    staged=tmp/'result.webp';result.save(staged,'WEBP',quality=90,method=6)
   with Image.open(source) as a,Image.open(staged) as b:
    assert list(b.size)==[n*2 for n in row['size']]
    aa=np.asarray(a.convert('RGB').resize((256,256)),dtype=float)/255
    bb=np.asarray(b.convert('RGB').resize((256,256)),dtype=float)/255
    mae=float(np.abs(aa-bb).mean());corr=float(np.corrcoef(aa.ravel(),bb.ravel())[0,1])
    assert mae<.1 and corr>.92,(page,mae,corr)
   if target.exists():
    backup=WORK/'previous';backup.mkdir(exist_ok=True)
    target.replace(backup/f'{page}-{time.time_ns()}.webp')
   target.write_bytes(staged.read_bytes())
   ledger[page]={'page':page,'sourceAsset':row['asset'],'sourceSha256':row['sha256'],'coordinateSize':row['size'],'outputSize':[n*2 for n in row['size']],'asset':str(target.relative_to(ROOT)),'outputSha256':sha(target),'model':'realesrgan-x4plus-anime','modelSha256':sha(model),'tile':256,'native':'arm64','pipeline':'4x -> 2x bicubic','encoding':'webp-quality90-method6','quality':90,'bytes':target.stat().st_size,'fidelity':{'colorMAE':mae,'correlation':corr}}
   save(ledger_path,ledger)
 if args.publish:
  # Only completed pages are connected; all others keep their original image.
  save(ROOT/'data/hansol-book-direct-upscale.json',{'date':'2026-11-19','basis':'SHA가 같은 원본을 2배 확대 후 WebP 품질90으로 압축. 이미 개선된 무필기 자료는 유지.','sourceIndexSha256':sha(ROOT/'data/hansol-book-direct.json'),'pages':list(ledger.values()),'limits':'원본 좌표 유지. 자동 픽셀 검사는 정답·수식의 학술 검증을 뜻하지 않습니다.'})
 status('complete' if len(ledger)+len(skipped)==len(book['pages']) else 'partial')
except BaseException as error:
 status('interrupted',error=str(error));raise
