"""Private visible-screen crops solely for OCR quality, never book assets."""
import argparse,json
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
p=argparse.ArgumentParser();p.add_argument('--limit',type=int);p.add_argument('--keys-only',action='store_true');p.add_argument('--refresh-keys',action='store_true');p.add_argument('--columns',action='store_true');p.add_argument('--ocr-clean',action='store_true',help='Private OCR mask: suppress red handwritten ticks; darken blue printed labels. Never publish this image.');p.add_argument('--start',type=int,default=0);args=p.parse_args()
rows=json.loads((WORK/'capture-progress.json').read_text())['rows']
rows=rows[args.start:args.start+args.limit] if args.limit else rows[args.start:]
folder=WORK/'regions';folder.mkdir(exist_ok=True)
paths=[]
mapfile=WORK/'page-map.json';page_map={(p['spread'],p['half']):p for p in json.loads(mapfile.read_text())['pages']} if mapfile.exists() else {}
for row in rows:
 stem=Path(row['image']).stem
 with Image.open(ROOT/row['image']) as source:
  w,h=source.size
  if args.columns:
   for col in range(4):
    path=folder/f'{stem}-{"clean-" if args.ocr_clean else ""}column-{col}.png'
    if not path.exists():
     crop=source.crop((int(w*col/4),int(h*.07),int(w*(col+1)/4),int(h*.90)))
     if args.ocr_clean:
      a=np.asarray(crop.convert('RGB')).copy();v=a.astype(int)
      red=(v[:,:,0]>v[:,:,1]+50)&(v[:,:,0]>v[:,:,2]+50)
      blue=(v[:,:,2]>v[:,:,0]+45)&(v[:,:,1]>v[:,:,0]+30)&(v[:,:,0]<180)
      a[red]=255;a[blue]=20;crop=Image.fromarray(a)
     crop.resize((crop.width*2,crop.height*2),Image.Resampling.BICUBIC).save(path)
    paths.append(str(path))
   continue
  for half,label in [(0,'left'),(1,'right')]:
   page=folder/f'{stem}-{label}.png';key=folder/f'{stem}-{label}-key.png'
   if not args.keys_only and not page.exists():source.crop((half*w//2,0,(half+1)*w//2,h)).save(page)
   if not key.exists() or args.refresh_keys:
    footer=page_map.get((row['index'],half),{}).get('footerY') or .945
    crop=source.crop((half*w//2,int(h*(footer-.055)),(half+1)*w//2,int(h*(footer-.003))))
    crop.resize((crop.width*2,crop.height*2),Image.Resampling.BICUBIC).save(key)
   paths.extend(([str(page)] if not args.keys_only else [])+[str(key)])
(WORK/('clean-column-ocr-inputs.json' if args.columns and args.ocr_clean else 'column-ocr-inputs.json' if args.columns else 'region-ocr-inputs.json')).write_text(json.dumps(paths)+'\n')
print(json.dumps({'spreads':len(rows),'privateOcrRegions':len(paths)}))
