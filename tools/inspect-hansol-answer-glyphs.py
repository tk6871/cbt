"""Private printed-answer glyph inspection; no text/content is published."""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
def components(mask):
 h,w=mask.shape;seen=np.zeros_like(mask,dtype=bool);result=[]
 for y,x in zip(*np.nonzero(mask)):
  if seen[y,x]:continue
  stack=[(int(x),int(y))];seen[y,x]=True;xs=[];ys=[]
  while stack:
   a,b=stack.pop();xs.append(a);ys.append(b)
   for nx,ny in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
    if 0<=nx<w and 0<=ny<h and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;stack.append((nx,ny))
  if len(xs)>=4:result.append((min(xs),min(ys),max(xs)+1,max(ys)+1,len(xs)))
 return result
def circles(image):
 a=np.asarray(image.convert('RGB'));mask=a.min(axis=2)<180
 found=[]
 for x,y,r,b,size in components(mask):
  w,h=r-x,b-y
  if 10<=w<=80 and 10<=h<=80 and .80<=w/h<=1.15 and .08<size/(w*h)<.45:
   found.append((x,y,r,b,size))
 # Answer keys form one horizontal line. A printed question's round diagram
 # label above the key must not join it.
 if not found:return []
 groups=[]
 for item in found:
  group=next((g for g in groups if abs((g[0][1]+g[0][3])/2-(item[1]+item[3])/2)<6),None)
  if group is None:groups.append([item])
  else:group.append(item)
 return sorted(max(groups,key=len),key=lambda b:b[0])
if __name__=='__main__':
 file=Path(sys.argv[1]);im=Image.open(file).convert('RGB');boxes=circles(im);print(json.dumps(boxes))
 out=Image.new('RGB',(len(boxes)*100,140),'white');d=ImageDraw.Draw(out)
 for i,b in enumerate(boxes):
  tile=im.crop(b[:4]);tile.thumbnail((70,70));out.paste(tile,(i*100+10,30));d.text((i*100+10,8),str(i),fill='black');d.text((i*100+5,110),str(b[0]),fill='black')
 out.save(WORK/'glyph-proof.png')
