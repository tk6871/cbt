#!/usr/bin/env python3
"""Local visual contact sheets for answer tables; never published as questions."""
import json,re,subprocess
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/practical-verification/energy-midterm-pdf'
PDF=Path('/Users/sh/Library/Mobile Documents/com~apple~CloudDocs/폴리텍/에너지/에너지설비.pdf')
pages=[446,462,478,493,509,525,541,558,573,588,603,618,633]
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',24)
crops=[]
for page in pages:
    path=WORK/'pages'/f'{page}.png'
    if not path.exists():subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2200','-png',str(PDF),str(path.with_suffix(''))],check=True)
    im=Image.open(path).convert('RGB');w,h=im.size
    rows=json.loads((Path('/private/tmp/cbt-energy-book-exams-review')/f'page-{page}.json').read_text())['rows']
    cells=[r for r in rows if re.fullmatch(r'\s*\d{1,2}\s*[①②③④1]\s*[)\]]?\s*',r['text'])]
    y0=int(min(1-r['box'][1]-r['box'][3] for r in cells)*h)-25
    y1=int(max(1-r['box'][1] for r in cells)*h)+25
    crop=im.crop((int(.07*w),y0,int(.96*w),y1));crop.thumbnail((970,540));crops.append((page,crop))
for start in range(0,len(crops),4):
    sheet=Image.new('RGB',(2000,1200),'#ddd');d=ImageDraw.Draw(sheet)
    for k,(page,im) in enumerate(crops[start:start+4]):
        x=k%2*1000;y=k//2*600;d.text((x+12,y+8),f'PDF p{page} / book p{page+11}',fill='black',font=font);sheet.paste(im,(x+12,y+50))
    sheet.save(WORK/f'answers-{start//4+1}.jpg',quality=96)
