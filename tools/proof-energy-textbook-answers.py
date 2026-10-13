"""Private contact sheets of printed answer tables, not app assets."""
import json,re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
WORK=Path('work/energy-textbook');CACHE=Path('work/energy-book-scope')
inventory=json.loads(Path('docs/energy-textbook-inventory-2026-10-13.json').read_text())
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
crops=[]
for r in inventory['rounds']:
 page=r['answerPdfPage'];p=WORK/'pages'/f'{page}.png'
 if not p.exists():p=CACHE/'pages'/f'{page}.png'
 im=Image.open(p).convert('RGB');w,h=im.size
 rows=json.loads((CACHE/'ocr'/f'page-{page}.json').read_text())['rows']
 cells=[r for r in rows if re.fullmatch(r'\s*\d{1,2}\s*[①②③④1]\s*[)\]]?\s*',r['text'])]
 y0=int(min(1-r['box'][1]-r['box'][3] for r in cells)*h)-20
 y1=int(max(1-r['box'][1] for r in cells)*h)+20
 crop=im.crop((int(.07*w),y0,int(.97*w),y1));crop.thumbnail((1080,580))
 crops.append((f"{r['year']}-{r['session']} PDF{page}",crop))
for start in range(0,len(crops),4):
 sheet=Image.new('RGB',(2200,1300),'#ddd');d=ImageDraw.Draw(sheet)
 for k,(label,im) in enumerate(crops[start:start+4]):
  x=k%2*1100;y=k//2*650;d.text((x+10,y+5),label,font=font,fill='black');sheet.paste(im,(x+10,y+45))
 sheet.save(WORK/'proofs'/f'answers-{start//4+1}.jpg',quality=97)
