#!/usr/bin/env python3
"""Stage source-image answer geometry with pixel-bounded multiline rectangles."""
import importlib.util, json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/energy-answer-geometry'
spec=importlib.util.spec_from_file_location('scan_boxes',ROOT/'tools/build-hansol-scan-hotspots.py')
boxes_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(boxes_module)

# Visually checked against the original printed numbers, not inferred answers.
# The OCR confuses faint circles with punctuation and sometimes ② with ③.
REVIEWED_MARKERS={
 '2021-1-10':[(.122,.688),(.485,.689),(.122,.838),(.485,.841)],
 '2021-2-62':[(.088,.628),(.471,.639),(.088,.771),(.471,.777)],
 '2021-2-72':[(.109,.462),(.109,.591),(.111,.725),(.112,.858)],
 '2022-1-12':[(.143,.537),(.584,.537),(.143,.818),(.584,.818)],
 '2022-2-6':[(.126,.552),(.593,.550),(.126,.765),(.593,.765)],
 '2024-1-59':[(.128,.539),(.537,.539),(.128,.820),(.537,.820)],
 '2025-3-53':[(.104,.308),(.104,.457),(.105,.636),(.105,.792)],
}

def candidates(ocr,width,height):
    out={choice:[] for choice in range(1,5)}
    for row in ocr['rows']:
        text=row['text'].strip(); x0,y0,x1,y1=row['box']
        # Only leading choice numbers: circled symbols inside the question or
        # an answer's formula must not become a second selectable answer.
        m=re.match(r'^([①②③④])',text)
        if m:
            choice='①②③④'.index(m[1])+1
            exact=[v for v in ocr['markers'] if v['choice']==choice and abs(v['box'][0]-x0)<.025 and abs(v['box'][1]-y0)<.025]
            b=min(exact,key=lambda v:v['box'][0])['box'] if exact else [x0,y0,min(x1,x0+.035),y1]
        else:
            m=re.match(r'^([1-4l!@?])(?:[\s)]|$)',text)
            if not m: continue
            choice={'l':1,'!':1,'@':4,'?':2}.get(m[1],int(m[1]) if m[1].isdigit() else 1)
            b=[x0,y0,min(x1,x0+.035),y1]
        out[choice].append(dict(x0=b[0]*width,y0=b[1]*height,x1=b[2]*width,y1=b[3]*height,rowTop=y0*height,score=row['score'],explicit=bool(m)))
    return out

def generate(path,ocr,reviewed_markers=None):
    with Image.open(path) as im:
        width,height=im.size; gray=im.convert('L')
        options=candidates(ocr,width,height)
        overrides=REVIEWED_MARKERS if reviewed_markers is None else reviewed_markers
        if path.stem in overrides:
            options={i:[dict(x0=x*width,y0=y*height,x1=(x+.03)*width,y1=(y+.05)*height,score=1,explicit=True)] for i,(x,y) in enumerate(overrides[path.stem],1)}
        markers,layout=boxes_module.choose_markers(options,width,height)
        if len(markers)!=4:return None,dict(reason='missing-markers',counts={k:len(v) for k,v in candidates(ocr,width,height).items()})
        # Use the actual right-hand number column, not the midpoint between
        # numbers (which cuts long left-column answers prematurely).
        def row_top(group):
            top=min(m['y0'] for m in group);bottom=max(m['y1'] for m in group)
            # Fractions start above their printed choice number. Include the
            # numerator when its OCR line intersects that number's baseline.
            rows=[r['box'][1]*height for r in ocr['rows'] if r['box'][3]*height>=top-2 and r['box'][1]*height<bottom and r['box'][0]*width>=min(m['x0'] for m in group)-8]
            return max(0,int(min([top,*rows])-5))
        if layout=='column':
            # Column text can have overlapping OCR line rectangles. Looking
            # backwards from the next marker would swallow the previous line.
            bounds=[max(0,int(min(m['y0'],m.get('rowTop',m['y0']))-5)) for m in markers]+[height-4]
            pixels=gray.load(); left=max(0,int(min(m['x0'] for m in markers)-8))
            for i in range(1,4):
                guess=bounds[i];radius=max(12,int(height*.025));blank=[]
                for y in range(max(bounds[i-1]+1,guess-radius),min(height-4,guess+radius)):
                    if sum(pixels[x,y]<190 for x in range(left,width-5))<=1:blank.append(y)
                if blank:
                    nearest=min(blank,key=lambda y:abs(y-guess));lo=hi=nearest
                    while lo-1 in blank:lo-=1
                    while hi+1 in blank:hi+=1
                    bounds[i]=(lo+hi)//2
            cells=[(max(0,int(m['x0']-5)),bounds[i],width-5,bounds[i+1]) for i,m in enumerate(markers)]
        elif layout=='grid':
            split_x=int(min(markers[1]['x0'],markers[3]['x0'])-max(15,width*.015))
            first_top=row_top(markers[:2]);split_y=row_top(markers[2:])
            cells=[(int(markers[0]['x0']-5),first_top,split_x,split_y),(split_x,first_top,width-5,split_y),(int(markers[2]['x0']-5),split_y,split_x,height-4),(split_x,split_y,width-5,height-4)]
        elif layout=='row':
            bounds=[int(markers[0]['x0']-5)]+[int(m['x0']-5) for m in markers[1:]]+[width]
            cells=[(bounds[i],int(m['y0']-5),bounds[i+1],height) for i,m in enumerate(markers)]
        else:return None,dict(reason='unknown-layout')
        result=[]
        for i,cell in enumerate(cells,1):
            if path.stem=='2023-4-40' and i in (2,4):
                # The source page's vertical separator survives at the far
                # right. It is not answer text (checked against the image).
                cell=(*cell[:2],int(width*.90),cell[3])
            left,top,right,bottom=boxes_module.dark_bbox(gray,cell)
            rect=dict(x=round(left/width*100,3),y=round(top/height*100,3),width=round((right-left)/width*100,3),height=round((bottom-top)/height*100,3))
            result.append(dict(choice=i,**rect,segments=[rect.copy()]))
        return result,dict(layout=layout,size=[width,height],markers=markers)

def main():
    result={};review=[];missing=[]
    for file in sorted((WORK/'ocr').glob('*.json')):
        ocr=json.loads(file.read_text()); path=Path(ocr['path']); boxes,meta=generate(path,ocr)
        review.append(dict(asset=path.relative_to(ROOT).as_posix(),**meta))
        if boxes:result[path.relative_to(ROOT).as_posix()]=boxes
        else:missing.append(dict(key=file.stem,**meta))
    (WORK/'hotspots-staged.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (WORK/'review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
    if '--publish' in sys.argv:
        if missing:raise ValueError('Unreviewed choices remain; refusing to publish')
        (ROOT/'data/energy-midterm-hotspots.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
    for start in range(0,len(review),6):
        sheet=Image.new('RGB',(1800,1800),'#ddd');d=ImageDraw.Draw(sheet)
        for k,row in enumerate(review[start:start+6]):
            asset=row['asset'];im=Image.open(ROOT/asset).convert('RGB');paint=ImageDraw.Draw(im)
            for b in result.get(asset,[]):
                x,y=im.width*b['x']/100,im.height*b['y']/100
                paint.rectangle([x,y,x+im.width*b['width']/100,y+im.height*b['height']/100],outline=['red','blue','green','purple'][b['choice']-1],width=3)
            im.thumbnail((580,830));x=k%3*600;y=k//3*900;sheet.paste(im,(x+10,y+50));d.text((x+10,y+10),Path(asset).stem+(' MISSING' if asset not in result else ''),fill='black',font=font)
        sheet.save(WORK/f'contact-{start//6+1:02d}.jpg',quality=95)
    print(json.dumps(dict(generated=len(result),missing=missing),ensure_ascii=False))

if __name__=='__main__':main()
