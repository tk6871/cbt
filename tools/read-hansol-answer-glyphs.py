"""Read tiny printed keys using calibrated glyphs from visually read samples.

This is a private OCR aid. Low-confidence/irregular rows are not approved.
No ebook file or capture-security setting is accessed.
"""
import importlib.util,json,re
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
spec=importlib.util.spec_from_file_location('glyphs',ROOT/'tools/inspect-hansol-answer-glyphs.py')
glyphs=importlib.util.module_from_spec(spec);spec.loader.exec_module(glyphs)
def normalized(image,box,circled=False):
 im=image.crop(box).convert('RGB');a=np.asarray(im).min(axis=2)<180
 gray=Image.fromarray((a*255).astype('uint8')).resize((32,40),Image.Resampling.BILINEAR)
 a=np.asarray(gray,dtype=float)/255
 return a[8:33,8:25] if circled else a
def digits_before(image,circle):
 x,y,r,b,_=circle;h=b-y
 left=max(0,int(x-h*2));right=max(0,x-5)
 im=image.crop((left,max(0,y-3),right,min(image.height,b+3)))
 mask=np.asarray(im).min(axis=2)<180
 found=[]
 for a,t,c,d,size in glyphs.components(mask):
  if (d-t)>=h*.50 and 2<=c-a<=h*2 and size>12:found.append((a+left,t+max(0,y-3),c+left,d+max(0,y-3)))
 found=sorted(found,key=lambda b:b[0])[-2:]
 if len(found)==1:
  a,t,c,d=found[0];pixels=np.asarray(image.crop((a,t,c,d))).min(axis=2)<180;width=c-a
  lo=max(1,int(width*.32));hi=min(width-1,int(width*.68))
  if hi<=lo:return []
  cut=min(range(lo,hi),key=lambda x:int(pixels[:,x].sum()))
  found=[]
  for l,r in [(0,cut),(cut,width)]:
   ys,xs=np.nonzero(pixels[:,l:r])
   if len(xs):found.append((a+l+int(xs.min()),t+int(ys.min()),a+l+int(xs.max())+1,t+int(ys.max())+1))
 return found
templates={n:[] for n in range(1,5)};numbers={str(n):[] for n in range(10)}
references=[('spread-0016-right-key.png',[1,4,4,3,2,1],list(range(1,7))),('spread-0017-left-key.png',[1,2,3,3],list(range(7,11)))]
for name,answers,labels in references:
 im=Image.open(WORK/'regions'/name).convert('RGB');boxes=glyphs.circles(im)
 assert len(boxes)==len(answers),(name,boxes)
 for box,answer,label in zip(boxes,answers,labels):
  templates[answer].append(normalized(im,box[:4],True));ds=digits_before(im,box)
  assert len(ds)==2,(name,label,ds)
  for digit,dbox in zip(f'{label:02}',ds):numbers[digit].append(normalized(im,dbox))
assert all(numbers.values())
def distance(a,b):
 # Small antialias/one-pixel alignment changes must not switch a digit.
 return float(np.mean(np.abs(a-b)))
def classify(a,table):
 ranked=sorted((min(distance(a,t) for t in ts),key) for key,ts in table.items())
 best,key=ranked[0];margin=ranked[1][0]-best
 return key,round(1-best,4),round(margin,4)
out={};totals={'keys':0,'acceptedKeys':0,'acceptedCells':0,'uncertainCells':0}
for file in sorted((WORK/'regions').glob('spread-*-key.png')):
 im=Image.open(file).convert('RGB');boxes=glyphs.circles(im);cells=[]
 if not boxes:continue
 for box in boxes:
  answer,score,margin=classify(normalized(im,box[:4],True),templates)
  db=digits_before(im,box);label='';dscores=[];dmargins=[]
  if len(db)==2:
   for b in db:
    d,s,m=classify(normalized(im,b),numbers);label+=d;dscores.append(s);dmargins.append(m)
  number=int(label) if label else None
  label_ok=bool(number and 1<=number<=99 and min(dscores,default=0)>.84 and min(dmargins,default=0)>.025)
  answer_ok=score>.87 and margin>.035
  cells.append({'number':number,'answer':answer,'score':score,'margin':margin,'digitScores':dscores,'digitMargins':dmargins,'numberAccepted':label_ok,'answerAccepted':answer_ok,'accepted':label_ok and answer_ok,'box':box[:4]})
 ns=[c['number'] for c in cells if c['number'] is not None]
 consecutive=len(ns)==len(cells) and all(b==a+1 for a,b in zip(ns,ns[1:]))
 # A real printed key has consecutive numbered cells. Do not reinterpret a
 # random circled list from theory as an answer row.
 if not consecutive:
  # Small question labels may touch. Infer a row only when at least two
  # independently high-confidence labels agree on the SAME consecutive
  # starting number, and no high-confidence label disagrees. Never infer a
  # key from the existing CBT answer, question wording or answer frequency.
  starts=[c['number']-i for i,c in enumerate(cells) if c['numberAccepted']]
  anchored=len(starts)>=2 and len(set(starts))==1 and 1<=starts[0]<=100-len(cells)
  for i,c in enumerate(cells):
   c['accepted']=bool(anchored and c['answerAccepted'])
   if anchored:c['ocrNumber']=c['number'];c['number']=starts[0]+i;c['numberBasis']='two-or-more-consecutive-label-anchors'
  consecutive=anchored
 accepted=all(c['accepted'] for c in cells)
 out[file.stem]={'method':'visually-calibrated-glyph-comparison','consecutive':consecutive,'accepted':accepted,'cells':cells}
 totals['keys']+=1;totals['acceptedKeys']+=int(accepted);totals['acceptedCells']+=sum(c['accepted'] for c in cells);totals['uncertainCells']+=sum(not c['accepted'] for c in cells)
(WORK/'answer-glyphs.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(totals))
