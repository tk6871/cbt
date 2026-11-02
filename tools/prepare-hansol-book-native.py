"""Crop only individually reviewed question/solution rectangles from normal UI.
No ebook file extraction, OCR transcription, security changes or full-screen export.
"""
import json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-book-native';(WORK/'original').mkdir(parents=True,exist_ok=True)
review=json.loads((ROOT/'tools/hansol-book-native-review.json').read_text())
rows=[];tiles=[];font=ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'),20)
for row in review['rows']:
 path=ROOT/'work/hansol-whole-book/screens'/f"spread-{row['spread']:04}.png"
 with Image.open(path) as full:
  half=row['half'];source=full.crop((half*full.width//2,0,(half+1)*full.width//2,full.height))
  key=f"{row['page']}-{row['number']}";entry={'key':key,'sourceScreenSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  for kind,field in [('question','crop'),('explanation','solutionCrop')]:
   x0,y0,x1,y1=row[field]
   parts=row.get(kind+'Parts')
   if parts:
    pieces=[]
    for part in parts:
     screen=ROOT/'work/hansol-whole-book/screens'/f"spread-{part.get('spread',row['spread']):04}.png"
     fullpart=Image.open(screen);halfpart=part.get('half',row['half']);halfim=fullpart.crop((halfpart*fullpart.width//2,0,(halfpart+1)*fullpart.width//2,fullpart.height))
     a,b,c,d=part['crop'];assert 0<=a<c<=halfim.width and 0<=b<d<=halfim.height
     pieces.append(halfim.crop((a,b,c,d)))
     entry.setdefault('sourceScreens',{})[str(screen.relative_to(ROOT))]=hashlib.sha256(screen.read_bytes()).hexdigest()
    im=Image.new('RGB',(max(p.width for p in pieces),sum(p.height for p in pieces)+12*(len(pieces)-1)),'white');offset=0
    for piece in pieces:im.paste(piece,(0,offset));offset+=piece.height+12
    assert [0,0,*im.size]==row[field],(key,kind,list(im.size),row[field])
   else:
    assert 0<=x0<x1<=source.width and 0<=y0<y1<=source.height
    im=source.crop((x0,y0,x1,y1))
   im.save(WORK/'original'/f'{key}-{kind}.png');entry[kind+'Size']=list(im.size)
   if kind=='question':
    proof=im.copy();draw=ImageDraw.Draw(proof)
    for i,rect in enumerate(row.get('choiceRects',[])):
     a,b,c,d=rect;assert x0<=a<c<=x1 and y0<=b<d<=y1,(key,rect)
     draw.rectangle((a-x0,b-y0,c-x0,d-y0),outline='red',width=2)
    proof.thumbnail((900,650));tile=Image.new('RGB',(940,proof.height+40),'white');ImageDraw.Draw(tile).text((8,4),f"{row['page']} : {row['number']}  {row['kind']}",font=font,fill='black');tile.paste(proof,(8,35));tiles.append(tile)
  rows.append(entry)
(WORK/'manifest.json').write_text(json.dumps({'date':review['date'],'errors':[],'rows':rows},ensure_ascii=False,indent=2)+'\n')
for start in range(0,len(tiles),4):
 group=tiles[start:start+4];out=Image.new('RGB',(940,sum(t.height+10 for t in group)),'#ccc');y=0
 for t in group:out.paste(t,(0,y));y+=t.height+10
 out.save(WORK/f'proof-{start//4}.png')
print(f'{len(rows)} reviewed positions; {len(rows)*2} separated images staged')
