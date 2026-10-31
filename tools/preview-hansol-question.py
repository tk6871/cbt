"""Private crop for visual proof of a candidate. Never a published book asset."""
import argparse,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
p=argparse.ArgumentParser();p.add_argument('page');p.add_argument('number',type=int);p.add_argument('--bottom-padding',type=int,default=5);args=p.parse_args()
rows=json.loads((WORK/'comparison.json').read_text())['questions']+json.loads((WORK/'comparison-columns.json').read_text())['questions']
row=next(r for r in rows if r['page']==args.page and r['number']==args.number)
with Image.open(WORK/'screens'/f"spread-{row['spread']:04}.png") as im:
 x0,y0,x1,y1=row['bounds'];box=(round(x0*im.width),max(0,round(y0*im.height)-15),round(x1*im.width),min(im.height,round(y1*im.height)+args.bottom_padding))
 result=im.crop(box);out=WORK/'proofs'/f'{args.page}-{args.number}.png';out.parent.mkdir(exist_ok=True);result.save(out)
 print(str(out))
