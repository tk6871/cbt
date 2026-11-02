"""Private visual proof crops from the existing normal-reader captures only."""
import json, math, argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-whole-book'
parser=argparse.ArgumentParser();parser.add_argument('--risk',default='answer');parser.add_argument('--start',type=int,default=0);parser.add_argument('--count',type=int,default=12)
args=parser.parse_args()
rows=[r for r in json.loads((WORK/'batch-review/triage.json').read_text())['rows'] if r['risk']==args.risk][args.start:args.start+args.count]
dest=WORK/'unreviewed-proofs';dest.mkdir(exist_ok=True)
font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),24)
for r in rows:
    screen=Image.open(ROOT/r['snapshot']['screen']);w,h=screen.size
    a,b,c,d=r['bounds'];rect=(math.floor(a*w),max(0,math.floor(b*h)-15),math.ceil(c*w),min(h,math.ceil(d*h)+30))
    crop=screen.crop(rect);half=0 if a<.5 else 1
    key=Image.open(WORK/'regions'/f"spread-{r['spread']:04}-{'left' if half==0 else 'right'}-key.png")
    crop=crop.resize((crop.width*2,crop.height*2))
    key.thumbnail((crop.width,1000))
    canvas=Image.new('RGB',(crop.width,crop.height+key.height+45),'white')
    ImageDraw.Draw(canvas).text((4,4),r['key']+' | '+r['risk'],font=font,fill='black')
    canvas.paste(crop,(0,45));canvas.paste(key,(0,45+crop.height));canvas.save(dest/(r['key'].replace(':','-')+'.png'))
print(json.dumps([{'key':r['key'],'sourceId':r.get('source',{}).get('id'),'printedAnswer':r.get('printedAnswer'),'proof':str(dest/(r['key'].replace(':','-')+'.png'))} for r in rows],ensure_ascii=False))
