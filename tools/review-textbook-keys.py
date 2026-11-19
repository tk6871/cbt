"""Render private printed-key sheets; no OCR guess is published by this tool."""
import json, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/textbook-completeness'
read=lambda p:json.loads(p.read_text())
book=read(ROOT/'data/hansol-book-direct.json')
sources=read(OUT/'direct-sources.json')
mapping=read(ROOT/'data/problem-images-webp90.json')['mappings']
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',20)
rows=[]
for page in book['pages']:
 targets=sorted(s['number'] for s in sources if s['page']==page['page'])
 if not targets:continue
 path=ROOT/mapping.get(page['asset'],page['asset'])
 with Image.open(path) as im:
  x,y,w,h=page['answerKeyRect']
  key=im.crop((x,y,x+w,y+h)).convert('RGB')
  tile=Image.new('RGB',(1400,110),'white')
  ImageDraw.Draw(tile).text((10,2),f"{page['page']} | targets: {','.join(map(str,targets))}",font=font,fill='black')
  tile.paste(key,(10,40))
  rows.append((page['page'],tile))
dest=OUT/'keys';dest.mkdir(exist_ok=True)
index=[]
for start in range(0,len(rows),12):
 group=rows[start:start+12];sheet=Image.new('RGB',(1400,len(group)*116),'#ccc')
 for i,(_,tile) in enumerate(group):sheet.paste(tile,(0,i*116))
 name=f'keys-{start//12:02}.png';sheet.save(dest/name)
 index.append({'file':name,'pages':[p for p,_ in group]})
(dest/'index.json').write_text(json.dumps(index,indent=2)+'\n')
print({'pages':len(rows),'sheets':len(index)})
fixes=read(ROOT/'data/textbook-direct-number-review.json')['corrections']
sheet=Image.new('RGB',(1342,((len(fixes)+1)//2)*180),'white')
for i,(id,fix) in enumerate(fixes.items()):
 source=next(s for s in sources if s['id']==id)
 page=next(p for p in book['pages'] if p['page']==source['page'])
 x,y,w,h=fix['questionRect'];left=(i%2)*671;top=(i//2)*180
 with Image.open(ROOT/mapping[page['asset']]) as im:
  ImageDraw.Draw(sheet).text((left+4,top),f"{source['page']} / {source['number']}",font=font,fill='blue')
  sheet.paste(im.crop((x,y,x+w,y+142)),(left,top+30))
sheet.save(dest/'corrected-stems.png')
review=read(ROOT/'tools/textbook-key-review-20261119.json')
for source in sources:
 if f"{source['page']}:{source['number']}" not in review['unresolved']:continue
 page=next(p for p in book['pages'] if p['page']==source['page'])
 with Image.open(ROOT/mapping.get(page['asset'],page['asset'])) as im:
  # Include adjacent text above/below the crop to spot a false OCR anchor.
  part=source['questionParts'][0];x,y,w,h=part['rect']
  end=max(y+h,max(p['rect'][1]+p['rect'][3] for p in source['solutionParts'] if p['page']==page['page']))
  crop=im.crop((x,max(0,y-180),x+w,min(im.height,end+80)))
  tile=Image.new('RGB',(max(crop.width,800),crop.height+50),'white')
  ImageDraw.Draw(tile).text((10,5),source['id'],font=font,fill='black');tile.paste(crop,(0,50))
  tile.save(dest/f"issue-{source['page']}-{source['number']}.png")
