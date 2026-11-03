"""Stage reader-ink-hidden replacements without modifying old originals.

Only crops from user-authorized normal screen captures are used. Pixel masks
below DETECT changed handwriting for audit/reuse; they never erase, inpaint or
reconstruct text. Displayed replacements are unmodified new reader crops.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'work/hansol-ink-hidden'
read = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
capture = read(WORK/'capture-progress.json')
assert capture['status'] == 'captured-needs-crop-audit', capture['status']
assert set(capture['targetScreens']) == {int(n) for n in capture['rows']}
for row in capture['rows'].values():
    assert sha(ROOT/row['image']) == row['sha256']
    assert sha(ROOT/'work/hansol-whole-book/screens'/f'spread-{row["spread"]:04}.png') == row['oldSha256']
direct = read(ROOT/'data/hansol-book-direct.json')
native = read(ROOT/'tools/hansol-book-native-review.json')
audit = read(ROOT/'data/hansol-book-native-audit.json')['images']
jobs, retained, retained_pages = [], [], []
base = ROOT/'assets/hvac-hansol-book/ink-hidden'

def save_crop(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        with Image.open(path) as old:
            assert old.size == image.size and np.array_equal(np.asarray(old),np.asarray(image)), path
    else:
        image.save(path)

def screen(spread):
    return Image.open(ROOT/capture['rows'][str(spread)]['image'])

def removed_ink(old, new):
    a, b = [np.asarray(x.convert('RGB')).astype(np.int16) for x in (old,new)]
    assert a.shape == b.shape
    old_red = (a[:,:,0]>170)&(a[:,:,0]>a[:,:,1]+65)&(a[:,:,0]>a[:,:,2]+65)
    new_red = (b[:,:,0]>170)&(b[:,:,0]>b[:,:,1]+65)&(b[:,:,0]>b[:,:,2]+65)
    # The neighborhood suppresses subpixel text rendering differences.
    near_ink = np.asarray(new.convert('L').filter(ImageFilter.MinFilter(5))) < 210
    black_or_highlight = (a.min(2)<175)&(b.min(2)>235)&~near_ink
    return int(((old_red&~new_red)|black_or_highlight).sum())

for row in direct['pages']:
    assert sha(ROOT/row['asset']) == row['sha256']
    with screen(row['spread']) as full:
        image = full.crop(row['sourceCrop'])
        assert list(image.size) == row['size']
        with Image.open(ROOT/row['asset']) as old:
            removed = removed_ink(old,image)
        original = (base/'pages' if removed>=8 else WORK/'unaffected-pages')/f'{row["page"]}.png'
        save_crop(image, original)
    record={'key': f'page-{row["page"]}', 'kind':'page', 'page':row['page'],
                 'oldAsset':row['asset'], 'oldSha256':row['sha256'],
                 'sourceAsset':str(original.relative_to(ROOT)), 'sourceSha256':sha(original),
                 'sourceSize':row['size'], 'outputSize':[n*2 for n in row['size']],
                 'asset':str((base/'upscaled-pages'/f'{row["page"]}.webp').relative_to(ROOT)),
                 'removedInkPixels':removed, 'spreads':[row['spread']]}
    if removed>=8:jobs.append(record)
    else:retained_pages.append({k:v for k,v in record.items() if k!='asset'})

for row in native['rows']:
    key = f'{row["page"]}-{row["number"]}'
    for kind, field in [('question','crop'),('explanation','solutionCrop')]:
        parts = row.get(kind+'Parts') or [{'spread':row['spread'],'half':row['half'],'crop':row[field]}]
        pieces=[]
        for part in parts:
            with screen(part.get('spread',row['spread'])) as full:
                half=part.get('half',row['half'])
                image=full.crop((half*full.width//2,0,(half+1)*full.width//2,full.height))
                pieces.append(image.crop(part['crop']))
        if len(pieces)==1:
            image=pieces[0]
        else:
            image=Image.new('RGB',(max(p.width for p in pieces),sum(p.height for p in pieces)+12*(len(pieces)-1)),'white')
            offset=0
            for part in pieces:
                image.paste(part,(0,offset));offset+=part.height+12
        previous=audit[f'{key}-{kind}']
        old_path=ROOT/'work/hansol-book-native/original'/f'{key}-{kind}.png'
        assert sha(old_path)==previous['sourceSha256'] and sha(ROOT/previous['asset'])==previous['outputSha256']
        assert list(image.size)==previous['sourceSize']
        with Image.open(old_path) as old:
            removed=removed_ink(old,image)
        record={'key':f'{key}-{kind}','kind':kind,'page':row['page'],
                'oldAsset':previous['asset'],'oldSha256':previous['outputSha256'],
                'sourceSize':previous['sourceSize'],'outputSize':previous['outputSize'],
                'removedInkPixels':removed,
                'spreads':sorted({p.get('spread',row['spread']) for p in parts})}
        # Retain completed improved images when the reader's ink toggle did
        # not remove any meaningful ink in that crop. Do not reprocess all
        # existing improved assets merely for color-profile/AA differences.
        original=WORK/'original'/f'{key}-{kind}.png'
        save_crop(image,original)
        record.update(sourceAsset=str(original.relative_to(ROOT)),sourceSha256=sha(original))
        if removed < 8:
            retained.append(record)
        else:
            assert record['outputSize']==[n*2 for n in record['sourceSize']]
            record['asset']=str((base/f'{kind}s'/f'{key}.webp').relative_to(ROOT))
            jobs.append(record)

assert len([j for j in jobs if j['kind']=='page'])==14 and len(retained_pages)==383
assert len([j for j in jobs if j['kind']!='page'])+len(retained)==500
report={'date':'2026-11-04','scope':'affected-ink-only','basis':'Kyobo eye-button ink hidden; replace affected regions only; no pixel erasure',
        'sourceIndexSha256':sha(ROOT/'data/hansol-book-direct.json'),
        'captureSha256':sha(WORK/'capture-progress.json'),'jobs':jobs,'retained':retained,'retainedPages':retained_pages,
        'limits':'Ink detection is only a reuse heuristic. Normal printed red/blue and diagrams are never deleted. No academic answer validation.'}
(WORK/'jobs.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'jobs':len(jobs),'pages':14,'nativeReplacements':len(jobs)-14,
                  'previousImprovedRetained':len(retained),'screens':len(capture['rows'])}))
