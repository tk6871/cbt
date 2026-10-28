"""Resume-safe native Real-ESRGAN 4x -> 2x bicubic publication."""
import argparse,hashlib,json,subprocess,tempfile,shutil
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--work',default='work/energy-textbook')
parser.add_argument('--assets',default='assets/energy-textbook')
parser.add_argument('--reuse-work')
args=parser.parse_args()
WORK=ROOT/args.work
ASSETS=ROOT/args.assets
assert WORK.is_relative_to(ROOT/'work') and ASSETS.is_relative_to(ROOT/'assets')
ENGINE=ROOT/'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((WORK/'manifest.json').read_text());assert not manifest['errors']
ledgerfile=WORK/'upscale-ledger.json'
ledger=json.loads(ledgerfile.read_text()) if ledgerfile.exists() else {}
reusefile=ROOT/args.reuse_work/'upscale-ledger.json' if args.reuse_work else None
reuse=json.loads(reusefile.read_text()) if reusefile and reusefile.exists() else {}
four=WORK/'upscaled-4x';four.mkdir(exist_ok=True)
targets=[]
for row in manifest['rows']:
 for kind in ['question','explanation']:
  if kind+'Size' not in row:continue
  key=f"{row['key']}-{kind}";source=WORK/'original'/f'{key}.png'
  asset=ROOT/ledger[key]['asset'] if key in ledger else ASSETS/f'{kind}s'/f"{row['key']}.webp"
  asset.parent.mkdir(parents=True,exist_ok=True)
  digest=sha(source);old=ledger.get(key,{})
  if old.get('sourceSha256')==digest and asset.exists() and old.get('outputSha256')==sha(asset):continue
  # A corrected crop must never overwrite a reused midterm image.
  if old.get('reusedFrom') and old.get('sourceSha256')!=digest:
   asset=ASSETS/f'{kind}s'/f"{row['key']}.webp"
   asset.parent.mkdir(parents=True,exist_ok=True)
  prior=reuse.get(key,{})
  if prior.get('sourceSha256')==digest and prior.get('tile')==256 and (ROOT/prior['asset']).exists() and prior.get('outputSha256')==sha(ROOT/prior['asset']):
   ledger[key]={**prior,'reusedFrom':args.reuse_work};continue
  targets.append((key,source,asset,digest,row[kind+'Size']))
print(f'{len(targets)} pending / {len(manifest["rows"])*2} images',flush=True)
ledgerfile.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
# Small batches persist verified output even if interrupted later.
for start in range(0,len(targets),12):
 batch=targets[start:start+12]
 with tempfile.TemporaryDirectory(prefix='cbt-energy-textbook-') as subset:
  for key,source,*_ in batch:shutil.copy2(source,Path(subset)/f'{key}.png')
  subprocess.run(['arch','-arm64',str(ENGINE),'-i',subset,'-o',str(four),'-n','realesrgan-x4plus-anime','-s','4','-t','256','-f','png'],cwd=ENGINE.parent,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for key,source,asset,digest,size in batch:
  with Image.open(four/f'{key}.png') as im:
   assert im.size==tuple(n*4 for n in size),key
   im.convert('RGB').resize(tuple(n*2 for n in size),Image.Resampling.BICUBIC).save(asset,'WEBP',lossless=True,method=6)
  ledger[key]={'sourceSha256':digest,'outputSha256':sha(asset),'sourceSize':size,'outputSize':[n*2 for n in size],'asset':str(asset.relative_to(ROOT)),'model':'realesrgan-x4plus-anime','tile':256,'native':'arm64','pipeline':'4x -> 2x bicubic'}
 ledgerfile.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
 print(f'COMPLETE {min(start+12,len(targets))}/{len(targets)} pending images',flush=True)
print('ALL COMPLETE',len(ledger),flush=True)
