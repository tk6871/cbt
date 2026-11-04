"""Move verified replaced sources out of Git, never erase original pixels.

Run --check before --apply. Exact source and replacement SHA/size checks come
from the completed conversion ledger. No Git history operations are performed.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/problem-webp90'
ARCHIVE=WORK/'originals'
parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
progress=read(WORK/'progress.json');assert progress['phase']=='all' and progress['status']=='complete' and not progress['errors']
ledger=read(WORK/'audit.json')['entries']
mapping=read(ROOT/'data/problem-images-webp90.json')['mappings']
assert len(mapping)==sum(r['status']=='converted' for r in ledger.values())
rows=[]
for source,target in mapping.items():
    r=ledger[source];assert r['asset']==target and r['profile']['quality']==90
    assert source.startswith('assets/') and '..' not in Path(source).parts
    assert target.startswith('assets/problem-webp90/')
    source_path=ROOT/source;backup=ARCHIVE/source;current=source_path if source_path.exists() else backup
    assert current.is_file() and sha(current)==r['sourceSha256'],source
    assert sha(ROOT/target)==r['sha256'],target
    with Image.open(ROOT/target) as im:
        im.load();assert im.format=='WEBP' and list(im.size)==r['size']
    if backup.exists():assert sha(backup)==r['sourceSha256']
    rows.append((source_path,backup,r))
moved=0
if args.apply:
    for source,backup,r in rows:
        if source.exists():
            backup.parent.mkdir(parents=True,exist_ok=True)
            if not backup.exists():shutil.move(source,backup)
            else:
                # Keep a pre-existing identical duplicate recoverably as well.
                duplicate=WORK/'duplicate-originals'/r['source']
                duplicate.parent.mkdir(parents=True,exist_ok=True)
                assert not duplicate.exists();shutil.move(source,duplicate)
            moved+=1
    (WORK/'archive-result.json').write_text(json.dumps({'moved':moved,'total':len(rows),'bytes':sum(r['sourceBytes'] for _,_,r in rows),'archive':str(ARCHIVE)},ensure_ascii=False,indent=2)+'\n')
    public={source:{'asset':r['asset'],'sourceSha256':r['sourceSha256'],'sha256':r['sha256'],'size':r['size'],'sourceBytes':r['sourceBytes'],'bytes':r['bytes']} for source,r in ledger.items() if r['status']=='converted'}
    (ROOT/'data/problem-images-webp90-audit.json').write_text(json.dumps({'quality':90,'entries':public,'retained':[r['source'] for r in ledger.values() if r['status']=='retained']},ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'checked':len(rows),'moved':moved,'sourceBytes':sum(r['sourceBytes'] for _,_,r in rows),'uniqueOutputs':len(set(mapping.values())),'archive':str(ARCHIVE)},ensure_ascii=False))
