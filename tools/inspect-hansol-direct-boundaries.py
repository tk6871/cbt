"""Private proof sheets for the127 unsplit reader positions. No public edits.

Reuse normal-reader captures; include the rest of the printed column so a
question continued beyond the previous heuristic crop cannot be missed.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-direct-boundaries'
parser=argparse.ArgumentParser();parser.add_argument('--start',type=int,default=0);parser.add_argument('--count',type=int,default=4)
args=parser.parse_args()
read=lambda p:json.loads(p.read_text())
data=read(ROOT/'data/hansol-book-direct.json');pages={r['page']:r for r in data['pages']}
cases=[r for r in data['locations'] if not r['split']]
WORK.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),22)
small=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),17)

def page_image(page):
    row=pages[page]
    clean=ROOT/'work/hansol-ink-hidden/screens'/f'spread-{row["spread"]:04}.png'
    if clean.exists():
        with Image.open(clean) as full:return full.crop(row['sourceCrop']).convert('RGB')
    return Image.open(ROOT/row['asset']).convert('RGB')

tiles=[]
for i in range(args.start,min(len(cases),args.start+args.count)):
    row=cases[i];im=page_image(row['page']);x,y,w,h=row['questionRect']
    bottom=min(im.height,1740)
    crop=im.crop((x,max(0,y-20),x+w,bottom))
    tile=Image.new('RGB',(711,crop.height+74),'white');draw=ImageDraw.Draw(tile)
    draw.text((10,5),f'#{i}  {row["page"]} : {row["number"]} / col {row["column"]}',font=font,fill='black')
    draw.text((10,35),f'original rect {row["questionRect"]}',font=small,fill='#555')
    tile.paste(crop,(20,70));draw.line((20,70+h+20,691,70+h+20),fill='#d40000',width=2)
    tile.save(WORK/f'case-{i:03}.png');tiles.append(tile)
for j in range(0,len(tiles),4):
    group=tiles[j:j+4];rows=[]
    for k in range(0,len(group),2):
        pair=group[k:k+2];strip=Image.new('RGB',(1422,max(t.height for t in pair)+15),'#aab3bc')
        for n,t in enumerate(pair):strip.paste(t,(n*711,0))
        rows.append(strip)
    sheet=Image.new('RGB',(1422,sum(t.height for t in rows)),'#aab3bc');top=0
    for r in rows:sheet.paste(r,(0,top));top+=r.height
    path=WORK/f'sheet-{args.start+j:03}.png';sheet.save(path);print(str(path))
(WORK/'cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
