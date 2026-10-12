"""Inspection sheets only: never changes source assets."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'work/cooling-duplicate-review/inventory.json').read_text())
deferred = [2,9,16,41,46,47,49,53,56,58,69,76,98,99,107,124,147,153,176,178,179,180,181,189,191,193,197,213,237,244,245,256,258,265,296,300,304,306,316,353,362,363,364,376,384,452,453,548,632,658]
indices = sorted({p[k] for i in deferred for p in [data['pairs'][i]] for k in ['a','b']})
entries=[]
for i in indices:
    row=data['rows'][i]
    for path in dict.fromkeys(filter(None,[row['sourceImage'],*row['images']])):
        entries.append((i,path))
# Also inspect every remaining in-scope diagram/formula/diagram-reference row,
# including independent questions with no high-scoring duplicate candidate.
seen=set(entries)
for row in data['rows']:
    import re
    if not (row['images'] or re.search(r'그림|선도|도면|표에서',row['text'])):
        continue
    for path in dict.fromkeys(filter(None,[row['sourceImage'],*row['images']])):
        entry=(row['index'],path)
        if entry not in seen:
            entries.append(entry)
            seen.add(entry)
out=root/'work/cooling-duplicate-review/sheets'
out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
for start in range(0,len(entries),4):
    sheet=Image.new('RGB',(2000,1800),'#e0e0e0')
    draw=ImageDraw.Draw(sheet)
    for k,(i,path) in enumerate(entries[start:start+4]):
        im=Image.open(root/path).convert('RGB')
        im.thumbnail((970,835))
        x,y=(k%2)*1000+15,(k//2)*900+48
        sheet.paste(im,(x,y))
        draw.text((x,y-35),f"row {i}  {data['rows'][i]['id']}",fill='black',font=font)
    sheet.save(out/f'{start//4+1:02}.jpg',quality=96)
(out/'index.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
print(f'{len(entries)} source views / {(len(entries)+3)//4} sheets')
