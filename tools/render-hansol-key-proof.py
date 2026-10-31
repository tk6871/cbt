"""Private key-only contact sheets for exact-text candidates lacking a key."""
import json,importlib.util
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book';DEST=WORK/'key-proofs';DEST.mkdir(exist_ok=True)
variants=[json.loads((WORK/n).read_text()) for n in ['comparison.json','comparison-columns.json']]
existing={f"{r['page']}:{r['number']}" for r in json.loads((ROOT/'data/textbook-pages.json').read_text())['entries'] if r['book']=='hansol' and r['sourceId']}
pages={}
for v in variants:
 for row in v['questions']:
  key=f"{row['page']}:{row['number']}"
  if key in existing or row['sourceId'] or row['requiresImageComparison'] or row['printedAnswer'] is not None:continue
  candidate=next((c for c in row['candidates'] if c['exact']),None)
  if not candidate:continue
  pages.setdefault(row['page'],{'page':row['page'],'spread':row['spread'],'targets':{}})['targets'][row['number']]=candidate
page_map={(r['spread'],r['page']):r['half'] for r in json.loads((WORK/'page-map.json').read_text())['pages'] if r['page']}
spec=importlib.util.spec_from_file_location('glyphs',ROOT/'tools/inspect-hansol-answer-glyphs.py');glyphs=importlib.util.module_from_spec(spec);spec.loader.exec_module(glyphs)
font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),26)
rows=[]
for row in sorted(pages.values(),key=lambda r:tuple(map(int,r['page'].split('-')))):
 half=page_map[(row['spread'],row['page'])];path=WORK/'regions'/f"spread-{row['spread']:04}-{'left' if half==0 else 'right'}-key.png"
 with Image.open(path) as image:
  circles=glyphs.circles(image)
  if circles:
   x0=max(0,min(c[0] for c in circles)-95);x1=min(image.width,max(c[2] for c in circles)+30);y0=max(0,min(c[1] for c in circles)-10);y1=min(image.height,max(c[3] for c in circles)+15)
   image=image.crop((x0,y0,x1,y1))
  if image.width>1760:image=image.resize((1760,round(image.height*1760/image.width)))
  tile=Image.new('RGB',(1800,image.height+65),'white');draw=ImageDraw.Draw(tile);draw.text((15,8),f"{row['page']}  target: {','.join(map(str,sorted(row['targets'])))}",font=font,fill='black');tile.paste(image,(15,55));rows.append((row,tile))
for start in range(0,len(rows),5):
 group=rows[start:start+5];out=Image.new('RGB',(1800,sum(tile.height+12 for _,tile in group)),'#cccccc');y=0
 for row,tile in group:out.paste(tile,(0,y));y+=tile.height+12
 out.save(DEST/f'keys-{start//5:02}.png')
(DEST/'index.json').write_text(json.dumps([r for r,_ in rows],ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pages':len(rows),'targets':sum(len(r['targets']) for r,_ in rows),'sheets':(len(rows)+4)//5}))
