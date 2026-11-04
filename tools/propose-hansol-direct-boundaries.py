"""Private boundary proposals from existing pixels, for individual review.

Never publish inferred coordinates without the separate review decisions.
No OCR text is used as displayed copy and no image is erased or resized.
"""
import json
import re
import argparse
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont

ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-direct-boundaries'
read=lambda p:json.loads(p.read_text())
data=read(ROOT/'data/hansol-book-direct.json');registered={p['page']:p for p in data['pages']}
inventory=read(ROOT/'work/hansol-whole-book/page-map.json')['pages']
page_map={p['page']:p for p in inventory if p['page']}
cases=[r for r in data['locations'] if not r['split']]
cache={};font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),20)
small=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),16)

def get_page(page):
    if page in cache:return cache[page]
    p=page_map[page];spread=p['spread'];source=ROOT/'work/hansol-ink-hidden/screens'/f'spread-{spread:04}.png'
    if not source.exists():source=ROOT/'work/hansol-whole-book/screens'/source.name
    with Image.open(source) as im:
        w,h=im.size;half=p['half'];footer=p.get('footerY') or .945
        crop=registered[page]['sourceCrop'] if page in registered else [half*w//2+round(w*.017),round(h*.035),(half+1)*w//2-round(w*.017),min(h,round((footer+.03)*h))]
        image=im.crop(crop).convert('RGB')
    cache[page]={'image':image,'source':str(source.relative_to(ROOT)),'sourceCrop':crop,'spread':spread}
    return cache[page]

def panels(page,column):
    im=get_page(page)['image'];w=im.width//2;a=np.asarray(im.crop((column*w,0,(column+1)*w,im.height))).astype(np.int16)
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    blue=(r>=185)&(r<=249)&(g-r>=2)&(b-r>=4)&(b>=229)
    gray=(r>=205)&(r<=244)&(np.abs(r-g)<=3)&(np.abs(r-b)<=3)
    rows=np.flatnonzero((blue|gray).sum(1)>w*.28);runs=[]
    for y in rows:
        if not runs or y-runs[-1][1]>22:runs.append([int(y),int(y)])
        else:runs[-1][1]=int(y)
    return [(max(0,a-4),min(im.height,b+5)) for a,b in runs if b-a>=14 and a>130 and b<1740]

def next_column(page,column):
    if column==0:return page,1
    chapter,n=map(int,page.split('-'));p=f'{chapter}-{n+1}'
    return (p,0) if p in page_map else (None,None)

def part(page,rect):return {'page':page,'rect':rect}
parser=argparse.ArgumentParser();parser.add_argument('--pages',nargs='*');args=parser.parse_args()
if args.pages:
    for page in args.pages:
        im=get_page(page)['image'].copy();draw=ImageDraw.Draw(im)
        for y in range(100,1740,100):draw.text((2,y),str(y),font=small,fill='#c00000')
        im.save(WORK/f'context-{page}.png')
    raise SystemExit()
proposals=[];tiles=[]
for index,row in enumerate(cases):
    page=row['page'];x,y,w,h=row['questionRect'];column=row['column'];end=y+h
    candidates=[(a,b) for a,b in panels(page,column) if y+55<a<end-8]
    entry={'index':index,'id':row['id'],'page':page,'number':row['number'],
           'originalQuestionRect':row['questionRect'],'questionParts':[part(page,row['questionRect'])],
           'solutionParts':[],'proposal':'needs-review'}
    following,nextcol=next_column(page,column)
    if candidates:
        a,b=candidates[0];entry['questionParts']=[part(page,[x,y,w,a-y-3])];entry['solutionParts']=[part(page,[x,a,w,b-a])];entry['proposal']='same-column'
    elif end>=1680 and following:
        following_panels=panels(following,nextcol)
        top=[(a,b) for a,b in following_panels if a<550]
        if top:
            a,b=top[0];nx=nextcol*w
            # Retain a candidate continuation only for review. It may be a
            # different question, so no automatic publishing is permitted.
            entry['solutionParts']=[part(following,[nx,a,w,b-a])]
            entry['proposal']='next-column-or-page'
            if a>235:entry['possibleQuestionContinuation']=part(following,[nx,180,w,a-183])
    entry['nextColumn']={'page':following,'column':nextcol}
    proposals.append(entry)
    rendered=[]
    for label,parts in [('QUESTION',entry['questionParts']),('SOLUTION?',entry['solutionParts'])]:
        for p in parts:
            a,b,c,d=p['rect'];piece=get_page(p['page'])['image'].crop((a,b,a+c,b+d));block=Image.new('RGB',(711,piece.height+30),'white')
            ImageDraw.Draw(block).text((8,1),f'{label} {p["page"]} {p["rect"]}',font=small,fill='#405467');block.paste(piece,(20,30));rendered.append(block)
    if entry['proposal']!='same-column' and following:
        im=get_page(following)['image'];piece=im.crop((nextcol*w,150,(nextcol+1)*w,650))
        block=Image.new('RGB',(711,piece.height+32),'#e5ebef');ImageDraw.Draw(block).text((8,1),f'NEXT CONTEXT {following} col {nextcol}',font=small,fill='black');block.paste(piece,(20,30));rendered.append(block)
    height=sum(p.height for p in rendered)+40;tile=Image.new('RGB',(711,height),'white');ImageDraw.Draw(tile).text((8,4),f'#{index}  {page}:{row["number"]}  {entry["proposal"]}',font=font,fill='black');offset=40
    for p in rendered:tile.paste(p,(0,offset));offset+=p.height
    tiles.append(tile)
for i in range(0,len(tiles),4):
    strips=[]
    for k in range(i,min(i+4,len(tiles)),2):
        pair=tiles[k:k+2];s=Image.new('RGB',(1422,max(t.height for t in pair)+12),'#9eaab5')
        for j,t in enumerate(pair):s.paste(t,(j*711,0))
        strips.append(s)
    out=Image.new('RGB',(1422,sum(s.height for s in strips)),'#9eaab5');top=0
    for s in strips:out.paste(s,(0,top));top+=s.height
    out.save(WORK/f'proposal-{i:03}.png')
(WORK/'proposals.json').write_text(json.dumps(proposals,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cases':len(proposals),'counts':{s:sum(p['proposal']==s for p in proposals) for s in sorted({p['proposal'] for p in proposals})}}))
