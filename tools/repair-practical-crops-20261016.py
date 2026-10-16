"""Re-crop reviewed user PDF/scan figures; retain every original asset.

Sources are supplied explicitly and SHA-checked against existing ledgers.
No resampling, invented pixels, full pages or source archives enter the repo.
"""
import argparse, hashlib, json, zipfile
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageOps
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
J=lambda p:json.loads((ROOT/p).read_text())
SHA=lambda raw:hashlib.sha256(raw).hexdigest()
CROPS=[
 ('2026-1',2,'2026-1-02',[375,125,655,370],'선도 T축 표기 복구'),
 ('2026-1',2,'2026-1-03',[80,975,460,1270],'볼밸브 아래쪽 복구'),
 ('2026-1',7,'2026-1-09',[85,520,385,815],'밸브 몸체 아래쪽 복구'),
 ('2026-2',8,'2026-2-12',[65,125,550,350],'AIR·흡입 화살표 위쪽 복구'),
 ('book','Scan0027.jpg','2023-3-07',[500,455,1510,815],'팽창밸브 도식 오른쪽 표기 복구'),
 ('book','Scan0038.jpg','2024-1-05',[740,1310,1180,1750],'클램프미터 아래쪽 눈금·몸체 복구'),
 ('book','Scan0041.jpg','2024-2-06',[450,1555,1080,2100],'응축기 상단 송풍기 복구'),
 ('book','Scan0042.jpg','2024-2-09',[500,880,1400,1300],'증발기 오른쪽 연결 표기 복구'),
 ('october','Scan0002.jpg','2023-2-10',[580,1070,1530,1575],'냉수 입출구 오른쪽 표기 여백 확보'),
 ('october','Scan0056.jpg','2025-3-10',[490,1000,1450,1490],'냉수 입출구 오른쪽 표기 여백 확보'),
]
parser=argparse.ArgumentParser(description=__doc__)
for key in ['2026-1','2026-2','book','october']:parser.add_argument('--'+key,required=True,type=Path)
parser.add_argument('--output',required=True,type=Path)
parser.add_argument('--apply-assets',action='store_true')
args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
pdfLedger=J('data/hvac-practical-2026-reference-pdf.json')
bookLedger=J('data/hvac-practical-2023-2024-book-scans.json');octLedger=J('data/hvac-practical-october-scans.json')
ledgers={'book':bookLedger,'october':octLedger}
raws={key:getattr(args,key.replace('-','_')).read_bytes() for key in ['2026-1','2026-2','book','october']}
for key,raw in raws.items():
    expected=pdfLedger['sources'][key]['sha256'] if key.startswith('2026') else ledgers[key]['source']['archiveSha256']
    if SHA(raw)!=expected:raise ValueError('Source SHA mismatch: '+key)
pdfs={key:PdfReader(BytesIO(raw)) for key,raw in raws.items() if key.startswith('2026')}
archives={key:zipfile.ZipFile(BytesIO(raws[key])) for key in ['book','october']}
rows={r['id']:r for r in J('data/hvac-practical-restored.json')}; repairs=[]
for key,location,suffix,bounds,reason in CROPS:
    id='hvac-practical-restored-'+suffix;row=rows[id]
    old=next(image for image in row['images'] if '-question-' in image)
    if key in pdfs:
        embedded=list(pdfs[key].pages[location-1].images);assert len(embedded)==1
        source=embedded[0].image.convert('RGB')
    else:
        z=archives[key];names=[n for n in z.namelist() if n==location or n.endswith('/'+location)];assert len(names)==1
        raw=z.read(names[0]);assert SHA(raw)==ledgers[key]['source']['scanSha256'][location]
        source=ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
        if key=='october':source=source.rotate(180)
    assert 0<=bounds[0]<bounds[2]<=source.width and 0<=bounds[1]<bounds[3]<=source.height
    cropped=source.crop(bounds);relative=f'assets/hvac-practical/restored/{suffix[:6]}/{id}-question-recrop-v596.png'
    candidate=args.output/Path(relative).name;cropped.save(candidate,optimize=True)
    if args.apply_assets:
        target=ROOT/relative
        if target.exists():assert target.read_bytes()==candidate.read_bytes(),'Refusing to overwrite different asset'
        else:target.write_bytes(candidate.read_bytes())
    repairs.append(dict(id=id,oldImage=old,oldSha256=SHA((ROOT/old).read_bytes()),output=relative,sha256=SHA(candidate.read_bytes()),
        source=key,sourceSha256=SHA(raws[key]),location=location,sourceSize=list(source.size),crop=bounds,reason=reason))
manifest=dict(version=1,date='2026-10-16',repairs=repairs)
print('*** Begin Patch\n*** Add File: data/hvac-practical-crop-repairs-20261016.json')
print('\n'.join('+'+s for s in json.dumps(manifest,ensure_ascii=False,indent=2).splitlines()))
print('*** End Patch')
