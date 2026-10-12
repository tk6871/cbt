"""Local question crops for pattern examples; no scanned pages are published."""
import argparse, concurrent.futures, hashlib, json, subprocess
from pathlib import Path
from PIL import Image, ImageDraw
parser=argparse.ArgumentParser();parser.add_argument('pdf');args=parser.parse_args()
root=Path('work/energy-book-scope')
data=json.loads((root/'restored-pattern-candidates.json').read_text())
with open(args.pdf,'rb') as stream:
    assert hashlib.file_digest(stream,'sha256').hexdigest()==data['source']['sha256']
rows=data['rows'];selected=[]
for year,session in dict.fromkeys((q['year'],q['session']) for q in rows):
    q=next(q for q in rows if q['year']==year and q['session']==session and not q.get('missing') and q['candidates'][0]['stemScore']>=.95)
    selected.append(q)
for key in [(2021,2,1),(2022,1,2),(2023,1,59),(2024,1,19),(2025,1,72)]:
    selected.append(next(q for q in rows if (q['year'],q['session'],q['number'])==key))
pages=root/'pages';out=root/'pattern-sheets';out.mkdir(exist_ok=True)
def render(page):
    dest=pages/f'{page}.png'
    if not dest.exists():
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-scale-to','2200','-singlefile','-png',args.pdf,str(dest.with_suffix(''))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(render,sorted({q['pdfPage'] for q in selected})))
for offset in range(0,len(selected),4):
    sheet=Image.new('RGB',(1800,2200),'#e7edf3');draw=ImageDraw.Draw(sheet)
    for i,q in enumerate(selected[offset:offset+4]):
        img=Image.open(pages/f"{q['pdfPage']}.png");w,h=img.size
        boxes=[r['box'] for r in q['ocrRows'] if r['page']==q['pdfPage'] and (r['box'][0]>=.44)==bool(q['side'])]
        y0=max(0,min(1-b[1]-b[3] for b in boxes)-.01);y1=min(1,max(1-b[1] for b in boxes)+.025)
        x0,x1=(.02,.535) if q['side']==0 else (.44,.99)
        crop=img.crop((w*x0,h*y0,w*x1,h*y1));crop.thumbnail((880,1035))
        x,y=(i%2)*900,(i//2)*1100;c=q['candidates'][0]
        draw.text((x+10,y+8),f"{q['year']}-{q['session']} Q{q['number']} PDF{q['pdfPage']} vs {c['date']} Q{c['number']}",fill='black')
        sheet.paste(crop,(x+10,y+35))
    sheet.save(out/f'{offset//4+1:02}.jpg',quality=94)
    print(out/f'{offset//4+1:02}.jpg',flush=True)
(root/'pattern-sample-plan.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2)+'\n')
