"""Private same-scale visual comparison, using existing original/output only."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('page');a=p.parse_args()
index=json.loads((ROOT/'data/hansol-book-direct.json').read_text())
row=next(r for r in index['locations'] if r['page']==a.page)
page=next(r for r in index['pages'] if r['page']==a.page)
ledger=json.loads((ROOT/'work/hansol-direct-upscale/ledger.json').read_text())[a.page]
x,y,w,h=row['questionRect'];box=(x,y,x+min(w,480),y+min(h,400))
with Image.open(ROOT/page['asset']) as original,Image.open(ROOT/ledger['asset']) as improved:
 left=original.crop(box).resize((2*(box[2]-box[0]),2*(box[3]-box[1])),Image.Resampling.NEAREST)
 right=improved.crop(tuple(n*2 for n in box))
 canvas=Image.new('RGB',(left.width+right.width+30,left.height+48),'white')
 font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),22)
 draw=ImageDraw.Draw(canvas);draw.text((8,6),'원본 픽셀 2배 표시',fill='black',font=font);draw.text((left.width+22,6),'Real-ESRGAN → 2배 적용',fill='black',font=font)
 canvas.paste(left,(0,44));canvas.paste(right,(left.width+30,44))
 target=ROOT/'work/hansol-direct-upscale'/f'proof-{a.page}.png';canvas.save(target)
 print(target)
