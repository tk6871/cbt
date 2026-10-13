"""Private OCR geometry + pixel bounds. Never publish recognized question text."""
import hashlib, importlib.util, json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/energy-textbook/answer-geometry'
spec=importlib.util.spec_from_file_location('energy_boxes',ROOT/'tools/build-energy-answer-hotspots.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
overrides_path=ROOT/'tools/energy-textbook-hotspot-overrides.json'
overrides=json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
outputs={};rows=[];missing=[]
for path in map(Path,json.loads((WORK/'inputs.json').read_text())):
    ocr_file=WORK/'ocr'/f'{path.stem}.json'
    if not ocr_file.exists():raise ValueError('OCR missing: '+path.stem)
    ocr=json.loads(ocr_file.read_text());assert Path(ocr['path'])==path
    boxes,meta=engine.generate(path,ocr,overrides)
    # The scanned page rule at the extreme right is not part of choice 4.
    # Its short text and printed marker were checked on the full image.
    reviewed_right_edges={
        '2024-1-50':{4:36.5}, '2023-2-47':{2:67.0,4:67.0},
        '2024-2-36':{4:45.0}, '2024-1-63':{2:86.0,4:83.0},
    }
    if boxes:
        for box in boxes:
            right=reviewed_right_edges.get(path.stem,{}).get(box['choice'])
            if right:box['width']=round(right-box['x'],3)
            if path.stem=='2021-2-60' and box['choice']==1:
                box.update(x=11.6,y=41.4,width=39.3,height=7.5)
            box['segments']=[{k:box[k] for k in ('x','y','width','height')}]
    asset=path.relative_to(ROOT).as_posix()
    if boxes:outputs[asset]=boxes
    else:missing.append(path.stem)
    rows.append(dict(asset=asset,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),**meta))
(WORK/'hotspots-staged.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n')
(WORK/'review.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',21)
proofs=WORK/'proofs';proofs.mkdir(exist_ok=True)
for start in range(0,len(rows),6):
    sheet=Image.new('RGB',(2400,1800),'#e5e9ee');d=ImageDraw.Draw(sheet)
    for i,row in enumerate(rows[start:start+6]):
        im=Image.open(ROOT/row['asset']).convert('RGB');paint=ImageDraw.Draw(im)
        for box in outputs.get(row['asset'],[]):
            x,y=im.width*box['x']/100,im.height*box['y']/100
            paint.rectangle([x,y,x+im.width*box['width']/100,y+im.height*box['height']/100],outline=['#e00000','#004bdd','#008000','#a000c0'][box['choice']-1],width=4)
        im.thumbnail((780,840));x=i%3*800;y=i//3*900
        sheet.paste(im,(x+10,y+45));d.text((x+10,y+10),Path(row['asset']).stem+' '+str(row.get('layout',row.get('reason'))),fill='black',font=font)
    sheet.save(proofs/f'{start//6+1:02}.jpg',quality=95)
if '--publish' in sys.argv:
    if missing:raise ValueError('Unreviewed markers: '+str(missing))
    (ROOT/'data/energy-textbook-hotspots.json').write_text(json.dumps(outputs,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'data/energy-textbook-hotspot-review.json').write_text(json.dumps({'images':rows,'method':'Apple Vision markers + pixel-bounded single rectangles','count':len(outputs)},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'generated':len(outputs),'missing':missing},ensure_ascii=False))
