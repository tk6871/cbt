"""Private OCR inputs and visual proof sheets for the full scan import."""
import argparse,json,importlib.util,hashlib,re
import numpy as np
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/energy-restored-full'
parser=argparse.ArgumentParser();parser.add_argument('--geometry',action='store_true');parser.add_argument('--prepare-upscaled',action='store_true');args=parser.parse_args()
manifest=json.loads((WORK/'manifest.json').read_text());assert not manifest['errors']
geometry=WORK/'answer-geometry';geometry.mkdir(exist_ok=True)
paths=[str(WORK/'original'/f"{q['key']}-question.png") for q in manifest['rows']]
(geometry/'inputs.json').write_text(json.dumps(paths,ensure_ascii=False,indent=2)+'\n')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
def grid_pixels(path,markers,engine):
 with Image.open(path) as image:
  gray=image.convert('L');width,height=gray.size;pixels=np.asarray(gray)
 split=int(min(markers[1]['x0'],markers[3]['x0'])-max(15,width*.015))
 def gap(left,right,start,end,target,last=False):
  start=max(0,int(start));end=min(height,int(end))
  if end<=start:return start
  blank=np.sum(pixels[start:end,max(0,left):min(width,right)]<190,axis=1)<=1
  runs=[];lo=None
  for index,value in enumerate([*blank,False]):
   if value and lo is None:lo=index
   if not value and lo is not None:
    if index-lo>=3:runs.append((start+lo,start+index))
    lo=None
  if not runs:return max(start,min(end,int(target)))
  selected=max(runs,key=lambda r:r[1]) if last else min(runs,key=lambda r:abs((r[0]+r[1])/2-target))
  return (selected[0]+selected[1])//2
 output=[]
 for column,indices in enumerate([(0,2),(1,3)]):
  first,second=[markers[i] for i in indices]
  left=max(0,int(min(first['x0'],second['x0'])-7)) if column==0 else split
  right=split if column==0 else width-5
  top=gap(left,right,first['y0']-max(65,height*.13),first['y0'],first['y0']-8,last=True)
  center1=(first['y0']+first['y1'])/2;center2=(second['y0']+second['y1'])/2
  middle=gap(left,right,center1,center2,(center1+center2)/2)
  for choice,upper,lower in [(indices[0]+1,top,middle),(indices[1]+1,middle,height-4)]:
   x0,y0,x1,y1=engine.boxes_module.dark_bbox(gray,(left,upper,right,lower))
   rect=dict(x=x0/width*100,y=y0/height*100,width=(x1-x0)/width*100,height=(y1-y0)/height*100)
   output.append(dict(choice=choice,**rect,segments=[rect.copy()]))
 return sorted(output,key=lambda b:b['choice'])
if args.prepare_upscaled:
 staged=json.loads((geometry/'staged.json').read_text())
 ledger=json.loads((WORK/'upscale-ledger.json').read_text())
 upscaled=[str(ROOT/ledger[f"{q['key']}-question"]['asset']) for q in manifest['rows']
  if not staged.get(q['key']) and f"{q['key']}-question" in ledger]
 (geometry/'upscaled-inputs.json').write_text(json.dumps(upscaled,ensure_ascii=False,indent=2)+'\n')
 print('Pending upscaled OCR inputs',len(upscaled),flush=True)
 raise SystemExit(0)
if args.geometry:
 spec=importlib.util.spec_from_file_location('engine',ROOT/'tools/build-energy-answer-hotspots.py')
 engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
 old_images=json.loads((ROOT/'work/energy-textbook/upscale-ledger.json').read_text())
 old_boxes=json.loads((ROOT/'data/energy-textbook-hotspots.json').read_text())
 manual=json.loads((ROOT/'tools/energy-restored-geometry-review.json').read_text())
 result={};review=[]
 for q,p in zip(manifest['rows'],paths):
  path=Path(p);file=geometry/'ocr'/f'{path.stem}.json'
  improved=geometry/'ocr-upscaled'/f"{q['key']}.json"
  ocr=json.loads((improved if improved.exists() else file).read_text())
  circled={r['text'].strip()[0] for r in ocr['rows'] if r['text'].strip() and r['text'].strip()[0] in '①②③④'}
  if len(circled)==4:
   # A diagram's plain 1/2/3/4 labels are not selectable answer numbers.
   ocr={**ocr,'rows':[r for r in ocr['rows'] if not re.match(r'^[1-4l!@?](?:\s|\)|$)',r['text'].strip())]}
  try:boxes,meta=engine.generate(path,ocr,{})
  except ValueError as e:boxes,meta=None,dict(reason='invalid-geometry',detail=str(e))
  if not boxes:
   # Four visible leading markers can be OCR'd as duplicate circle numbers.
   # Repair their reading order only when a complete aligned set is present;
   # never fabricate a missing fifth/third marker or a generic 25% click band.
   rows=[r for r in ocr['rows'] if re.match(r'^[①②③④⑦⑧]|^[1-4l!@?](?:\s|\)|$)',r['text'].strip()) and r['box'][1]>.15]
   if len(rows)==4:
    ordered=sorted(rows,key=lambda r:r['box'][1])
    xs=[r['box'][0] for r in ordered]
    if max(xs)-min(xs)>.20:
     ordered=sorted(ordered[:2],key=lambda r:r['box'][0])+sorted(ordered[2:],key=lambda r:r['box'][0])
    if ordered[3]['box'][1]>.50:
     repaired={'rows':[dict(r,text='①②③④'[i]+' '+r['text']) for i,r in enumerate(ordered)],'markers':[]}
     try:
      recovered,newmeta=engine.generate(path,repaired,{})
      if recovered:boxes,meta=recovered,dict(**newmeta,positionRepair=True)
     except ValueError:pass
  prior=old_images.get(f"{q['key']}-question",{})
  if not boxes and prior.get('sourceSha256')==hashlib.sha256(path.read_bytes()).hexdigest() and prior.get('asset') in old_boxes:
   boxes=old_boxes[prior['asset']];meta=dict(reusedReviewedAsset=prior['asset'])
  key=q['key'];points=manual['points'].get(key)
  if key in manual['grid']:
   left,right,upper,lower=manual['grid'][key];points=[(left,upper),(right,upper),(left,lower),(right,lower)]
  if key in manual['column']:
   x,*ys=manual['column'][key];points=[(x,y) for y in ys]
  if points:
   with Image.open(path) as source: marker_half=16/source.height
   adjusted=[(max(0,x-.01),max(0,y-marker_half)) for x,y in points]
   boxes,meta=engine.generate(path,ocr,{path.stem:adjusted});meta['manualPrintedMarkers']=True
  if boxes and meta.get('layout')=='grid' and key not in manual['regions'] and not meta.get('reusedReviewedAsset'):
   boxes=grid_pixels(path,meta['markers'],engine);meta['pixelGapGrid']=True
  if key in manual['regions']:
   with Image.open(path) as source:gray=source.convert('L');width,height=source.size
   boxes=[]
   for choice,(x,y,w,h) in enumerate(manual['regions'][key],1):
    left,top,right,bottom=engine.boxes_module.dark_bbox(gray,(int(x*width),int(y*height),int((x+w)*width),int((y+h)*height)))
    # Pale printed circle glyphs may fall below the ink threshold. Retain
    # the visually reviewed leading margin rather than dropping the number.
    left=min(left,int(x*width));top=min(top,int(y*height))
    rect=dict(x=left/width*100,y=top/height*100,width=(right-left)/width*100,height=(bottom-top)/height*100)
    boxes.append(dict(choice=choice,**rect,segments=[rect.copy()]))
   meta=dict(manualPrintedRegions=True)
  if boxes:
   for b in boxes:
    # Round independent endpoints inward, preventing a 0.001% shared edge.
    b['width']=max(.001,min(b['width'],100-b['x'])-.002)
    b['height']=max(.001,min(b['height'],100-b['y'])-.002)
    b['segments']=[{k:b[k] for k in ['x','y','width','height']}]
  if boxes and any(b['width']<=0 or b['height']<=0 or b['x']<0 or b['y']<0 or b['x']+b['width']>100.01 or b['y']+b['height']>100.01 for b in boxes):
   boxes=None;meta['reason']='outside-image'
  result[q['key']]=boxes
  review.append(dict(key=q['key'],**meta))
  if len(review)%100==0:print('Geometry checked',len(review),flush=True)
 (geometry/'staged.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 (geometry/'review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
 print('Geometry',sum(bool(v) for v in result.values()),'/',len(result),flush=True)
 pending=[q for q in manifest['rows'] if not result.get(q['key'])]
 for start in range(0,len(pending),6):
  sheet=Image.new('RGB',(2400,2400),'#dce3ec');draw=ImageDraw.Draw(sheet)
  for i,q in enumerate(pending[start:start+6]):
   x=i%3*800;y=i//3*1200
   im=Image.open(WORK/'original'/f"{q['key']}-question.png").convert('RGB');im.thumbnail((780,1120))
   sheet.paste(im,(x+10,y+55));draw.text((x+10,y+10),q['key'],font=font,fill='black')
  sheet.save(WORK/'proofs'/f'pending-{start//6+1:03}.jpg',quality=97)
else:
 result={}
for start in range(0,len(manifest['rows']),8):
 sheet=Image.new('RGB',(2400,2400),'#dce3ec');draw=ImageDraw.Draw(sheet)
 for i,q in enumerate(manifest['rows'][start:start+8]):
  x=i%4*600;y=i//4*1200
  im=Image.open(WORK/'original'/f"{q['key']}-question.png").convert('RGB')
  paint=ImageDraw.Draw(im)
  for b in result.get(q['key']) or []:
   left=im.width*b['x']/100;top=im.height*b['y']/100
   paint.rectangle((left,top,left+im.width*b['width']/100,top+im.height*b['height']/100),outline=['red','blue','green','purple'][b['choice']-1],width=2)
  im.thumbnail((580,1130));sheet.paste(im,(x+10,y+55))
  draw.text((x+10,y+10),q['key']+(' REVIEW' if args.geometry and not result.get(q['key']) else ''),font=font,fill='black')
 sheet.save(WORK/'proofs'/f"{'geometry' if args.geometry else 'questions'}-{start//8+1:03}.jpg",quality=94)
print('Private proofs / OCR inputs ready',len(paths),flush=True)
if args.geometry:
 items=[dict(round=dict(id=f"energy-industrial-restored-{q['year']}-{q['session']}",year=q['year'],qualificationKey='energy',subjects=['에너지관리']),
  question=dict(number=q['number'],text=q['key'],imageOnly=True,sourceImage=f"work/energy-restored-full/original/{q['key']}-question.png",choices=[dict(text='') for _ in range(4)],answer=q['answer'],answerHotspots=result.get(q['key']) or []),subject='에너지관리',id=q['key']) for q in manifest['rows']]
 (geometry/'items.json').write_text(json.dumps(items,ensure_ascii=False)+'\n')
 (geometry/'harness.html').write_text('''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"></head><body><main id="review"></main><script type="module">
import {createApp,h,ref,nextTick} from 'vue';
import Card from '/src/cbt/QuestionCard.vue';import '/src/cbt/cbt.css';
const items=await fetch('/work/energy-restored-full/answer-geometry/items.json').then(r=>r.json());
const index=ref(0),selected=ref(),indicator=ref('area'),mode=ref('exam');
createApp({setup:()=>()=>h(Card,{item:items[index.value],selected:selected.value,mode:mode.value,imageAnswerMode:'hotspot',hotspotIndicator:indicator.value,onChoose:c=>selected.value=selected.value===c?undefined:c})}).mount('#review');
window.review={items,async show(i,style='area'){index.value=i;selected.value=undefined;indicator.value=style;await nextTick();},async tick(){await nextTick();},get selected(){return selected.value;}};
</script><style>body{margin:16px;background:#f2f4f8}#review{max-width:720px;margin:auto}.question-card{width:100%;box-sizing:border-box}</style></body></html>''')
