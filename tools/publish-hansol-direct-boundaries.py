"""Publish individually reviewed reader boundaries, without rewriting originals.

Only a necessary continuation from a previously captured adjacent page is
cropped at native resolution. No OCR, resampling, erasure or model is run.
The committed review ledger is authoritative; pixel proposals are not.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--proof',action='store_true');args=parser.parse_args()
source_path=ROOT/'data/hansol-book-direct.json';source=read(source_path)
review=read(ROOT/'tools/hansol-direct-boundary-review.json')
assert sha(source_path)==review['originalIndexSha256'],'Original index changed; review again'
original={r['id']:r for r in source['locations'] if not r['split']}
assert set(original)=={r['id'] for r in review['entries']}
assert len(original)==len(review['entries'])==127
registered={p['page']:p for p in source['pages']}
links={(r['page'],r['number']) for r in read(ROOT/'data/textbook-pages.json')['entries'] if r['book']=='hansol'}
inventory={p['page']:p for p in read(ROOT/'work/hansol-whole-book/page-map.json')['pages'] if p['page']}
cache={};assets={};proofs=[]
font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),17)

def page_image(page):
    if page in cache:return cache[page]
    meta=inventory[page];screen=ROOT/'work/hansol-ink-hidden/screens'/f'spread-{meta["spread"]:04}.png'
    if not screen.exists():screen=ROOT/'work/hansol-whole-book/screens'/screen.name
    with Image.open(screen) as im:
        w,h=im.size;half=meta['half'];footer=meta.get('footerY') or .945
        crop=registered[page]['sourceCrop'] if page in registered else [half*w//2+round(w*.017),round(h*.035),(half+1)*w//2-round(w*.017),min(h,round((footer+.03)*h))]
        image=im.crop(crop).convert('RGB')
    cache[page]=(image,screen,crop)
    return cache[page]

def publish_part(part):
    page=part['page'];rect=part['rect'];x,y,w,h=rect
    im,screen,crop=page_image(page)
    assert all(isinstance(n,int) for n in rect) and x>=0 and y>=0 and w>0 and h>0
    assert x+w<=im.width and y+h<=im.height
    assert y+h<=1733,'Do not expose the printed answer key'
    if page in registered:return part
    # One tightly bounded solution fragment, not a new whole book page.
    asset=f'assets/hvac-hansol-book/direct-continuations/{page}-{x}-{y}-{w}-{h}.png'
    path=ROOT/asset;piece=im.crop((x,y,x+w,y+h))
    if args.check:
        with Image.open(path) as current:assert current.size==piece.size and current.convert('RGB').tobytes()==piece.tobytes()
    else:
        path.parent.mkdir(parents=True,exist_ok=True);piece.save(path)
    assets[asset]={'asset':asset,'size':[w,h],'sha256':sha(path),'page':page,'sourceScreenSha256':sha(screen),'sourceCrop':crop,'sourceRect':rect,'processing':'native-resolution crop only'}
    return {**part,'rect':[0,0,w,h],'asset':asset,'size':[w,h]}

entries=[]
for r in review['entries']:
    old=original[r['id']];assert r['originalQuestionRect']==old['questionRect']
    assert r['status'] in ('split','not-question','covered-question') and r['reason']
    if r['status']=='covered-question':assert (old['page'],r['printedNumber']) in links
    if r['status']!='split':entries.append(r);continue
    assert (old['page'],r['printedNumber']) not in links,'Already connected question'
    assert r['questionParts'] and r['solutionParts']
    for q in r['questionParts']:
        for s in r['solutionParts']:
            if q['page']!=s['page']:continue
            a,b=q['rect'],s['rect']
            assert min(a[0]+a[2],b[0]+b[2])<=max(a[0],b[0]) or min(a[1]+a[3],b[1]+b[3])<=max(a[1],b[1]),'Question/solution overlap'
    entries.append({**r,'questionParts':[publish_part(p) for p in r['questionParts']],'solutionParts':[publish_part(p) for p in r['solutionParts']]})
    if args.proof:
        pieces=[]
        for label,parts in [('QUESTION',r['questionParts']),('SOLUTION',r['solutionParts'])]:
            for p in parts:
                x,y,w,h=p['rect'];piece=page_image(p['page'])[0].crop((x,y,x+w,y+h));block=Image.new('RGB',(691,h+27),'white')
                ImageDraw.Draw(block).text((5,2),f'{label} {p["page"]} {p["rect"]}',font=font,fill='#334b60');block.paste(piece,(10,27));pieces.append(block)
        tile=Image.new('RGB',(691,sum(p.height for p in pieces)+30),'white');draw=ImageDraw.Draw(tile);draw.text((5,2),f'{r["id"]} / printed {r["printedNumber"]}',font=font,fill='black');y=30
        for p in pieces:tile.paste(p,(0,y));y+=p.height
        proofs.append((r['id'],tile))

output={'schemaVersion':1,'originalIndexSha256':review['originalIndexSha256'],'reviewed':127,'split':117,'excluded':10,'entries':entries,'assets':list(assets.values())}
path=ROOT/'data/hansol-book-direct-boundaries.json';encoded=json.dumps(output,ensure_ascii=False,indent=2)+'\n'
if args.check:assert path.read_text()==encoded,'Published boundary manifest is stale'
else:path.write_text(encoded)
if args.proof:
    folder=ROOT/'work/hansol-direct-boundaries/final';folder.mkdir(parents=True,exist_ok=True)
    for name,tile in proofs:tile.save(folder/f'{name}.png')
print(json.dumps({'reviewed':127,'split':117,'excluded':10,'continuationCrops':len(assets),'bytes':sum((ROOT/a).stat().st_size for a in assets),'check':args.check}))
