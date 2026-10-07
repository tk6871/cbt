#!/usr/bin/env python3
"""Stage pixel crops from the supplied PDF. Never publishes OCR text as a problem."""
import concurrent.futures, json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/practical-verification/energy-midterm-pdf'
PDF=Path('/Users/sh/Library/Mobile Documents/com~apple~CloudDocs/폴리텍/에너지/에너지설비.pdf')
OCR=Path('/private/tmp/cbt-energy-book-exams-review')
ANSWER_PAGES={(2021,1):446,(2021,2):462,(2022,1):478,(2022,2):493,(2022,4):509,(2023,1):525,(2023,2):541,(2023,4):558,(2024,1):573,(2024,2):588,(2025,1):603,(2025,2):618,(2025,3):633}

# Visually reviewed normalized pixel bounds, in reading order. Two questions
# continue from the foot of the left column to the head of the right column.
# The other twelve have a full set of choices at the page foot; their solution
# banner is on the next page, so the automatic banner finder cannot delimit them.
MANUAL_PARTS={
    '2021-1-77':[(445,.074,.820,.493,.901),(445,.516,.059,.960,.213)],
    '2021-2-60':[(458,.073,.729,.493,.913)],
    '2021-2-62':[(458,.502,.768,.958,.913)],
    '2022-1-6':[(463,.502,.769,.963,.913)],
    '2022-1-24':[(467,.077,.742,.493,.913)],
    '2022-4-17':[(496,.501,.778,.963,.913)],
    '2022-4-49':[(503,.090,.798,.493,.906),(503,.526,.058,.959,.132)],
    '2022-4-74':[(507,.501,.669,.959,.913)],
    '2023-2-52':[(535,.501,.775,.959,.913)],
    '2023-2-63':[(537,.496,.696,.962,.913)],
    '2024-1-25':[(563,.077,.780,.493,.913)],
    '2025-1-23':[(593,.077,.727,.493,.895)],
    '2025-3-13':[(621,.087,.811,.493,.893)],
    '2025-3-53':[(628,.097,.792,.493,.916)],
}

def render(n):
    dest=WORK/'pages'/f'{n}.png'
    if not dest.exists():
        subprocess.run(['pdftoppm','-f',str(n),'-l',str(n),'-singlefile','-scale-to','2200','-png',str(PDF),str(dest.with_suffix(''))],check=True)
    return n

def rows(n):return json.loads((OCR/f'page-{n}.json').read_text())['rows']

def extract_manual(item):
    parts=[];review=[];bounds=[]
    for page,x0,y0,x1,y1 in MANUAL_PARTS[item['key']]:
        with Image.open(WORK/'pages'/f'{page}.png') as im:
            w,h=im.size; rect=[int(x0*w),int(y0*h),int(x1*w),int(y1*h)]
            parts.append(im.convert('RGB').crop(rect))
            bounds.append({'page':page,'rect':rect,'pageSize':[w,h]})
        selected=[r for r in rows(page) if x0<=r['box'][0]<x1 and y0<=1-r['box'][1]-r['box'][3]<y1]
        selected.sort(key=lambda r:1-r['box'][1]-r['box'][3])
        review.extend(r['text'] for r in selected)
    gap=20 if len(parts)>1 else 0
    result=Image.new('RGB',(max(p.width for p in parts),sum(p.height for p in parts)+gap*(len(parts)-1)),'white')
    y=0
    for part in parts:result.paste(part,(0,y));y+=part.height+gap
    result.save(WORK/'original'/f"{item['key']}.png")
    answers=[]
    for r in rows(ANSWER_PAGES[(item['year'],item['session'])]):
        m=re.fullmatch(r'\s*0?'+str(item['number'])+r'\s*([①②③④1])\s*[)\]]?\s*',r['text'])
        if m:answers.append('①②③④'.find(m[1])+1 if m[1]!='1' else 1)
    return {**item,'manualReview':True,'parts':bounds,'size':list(result.size),'answerCandidates':sorted(set(answers)),'ocrReviewOnly':review}

def extract(item):
    if item['key'] in MANUAL_PARTS:return extract_manual(item)
    rs=rows(item['page']); n=item['number']
    anchors=[r for r in rs if re.match(rf'{n:02d}\s+[^①②③④]',r['text']) and len(r['text'])>8 and (r['box'][0]<.15 or .48<=r['box'][0]<.59)]
    if len(anchors)!=1:raise ValueError(f"{item['key']}: {len(anchors)} question anchors")
    anchor=anchors[0]; side=int(anchor['box'][0]>=.35)
    top=1-anchor['box'][1]-anchor['box'][3]
    # Original print has two columns and a grey 'explanation' banner.
    im=Image.open(WORK/'pages'/f"{item['page']}.png").convert('RGB');w,h=im.size
    left=min(.065 if not side else .49,anchor['box'][0]-.012)*w; right=(.492 if not side else .97)*w
    # These tilted scans put the next column's number across the usual gutter.
    if item['key'] in {'2023-4-50','2024-1-62','2024-2-34'}: right=.475*w
    y0=int((top-.007)*h)
    subsequent=[1-r['box'][1]-r['box'][3] for r in rs if int(r['box'][0]>=.48)==side and re.match(r'^\d{2}\s+[^①②③④]',r['text']) and len(r['text'])>8 and 1-r['box'][1]-r['box'][3]>top+.025 and (r['box'][0]<.15 or .48<=r['box'][0]<.59)]
    limit=int(min(subsequent+[.94])*h)
    gray=im.convert('L'); marker=[]
    for y in range(int((top+.025)*h),limit):
        # The banner is a dense filled rectangle near the column's left edge.
        for x in range(int(left),int(left+.075*w),3):
            a=gray.crop((x,y,x+int(.023*w),y+max(6,int(.004*h))))
            vals=list(a.getdata())
            if sum(v<160 for v in vals)/len(vals)>.79:
                marker.append(y);break
        if marker:break
    if not marker:raise ValueError(f"{item['key']}: explanation banner not found")
    y1=marker[0]-int(.006*h)
    if y1-y0<90:raise ValueError(f"{item['key']}: short crop")
    crop=im.crop((int(left),y0,int(right),y1));crop.save(WORK/'original'/f"{item['key']}.png")
    selected=[r for r in rs if int(r['box'][0]>=.48)==side and top-.005<=1-r['box'][1]-r['box'][3]<y1/h]
    selected.sort(key=lambda r:1-r['box'][1]-r['box'][3])
    answers=[]
    for r in rows(ANSWER_PAGES[(item['year'],item['session'])]):
        m=re.fullmatch(r'\s*0?'+str(n)+r'\s*([①②③④1])\s*[)\]]?\s*',r['text'])
        if m:answers.append('①②③④'.find(m[1])+1 if m[1]!='1' else 1)
    return {**item,'side':side,'rect':[int(left),y0,int(right),y1],'pageSize':[w,h],'size':list(crop.size),'answerCandidates':sorted(set(answers)),'ocrReviewOnly':[r['text'] for r in selected]}

def sheets(manifest,prefix='contact',upscaled=False):
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
    for start in range(0,len(manifest),6):
        group=manifest[start:start+6]; sheet=Image.new('RGB',(1800,1800),'#ddd');d=ImageDraw.Draw(sheet)
        for k,row in enumerate(group):
            x=(k%3)*600;y=(k//3)*900
            path=ROOT/'assets/energy-midterm/questions'/f"{row['key']}.webp" if upscaled else WORK/'original'/f"{row['key']}.png"
            im=Image.open(path);im.thumbnail((580,830))
            sheet.paste(im,(x+10,y+50));d.text((x+12,y+8),f"{row['key']} p{row['page']} T{row['topic']} A{row['answerCandidates']}",fill='black',font=font)
        sheet.save(WORK/f'{prefix}-{start//6+1:02d}.jpg',quality=95)

if __name__=='__main__':
    if '--review-upscaled' in sys.argv:
        manifest=json.loads((WORK/'manifest.json').read_text())
        sheets([r for r in manifest if r.get('manualReview')],'manual-upscaled',upscaled=True)
        sys.exit(0)
    for name in ['pages','original']: (WORK/name).mkdir(parents=True,exist_ok=True)
    selections=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {selections} from './tools/energy-midterm-pdf-selection.mjs'; console.log(JSON.stringify(selections));"],cwd=ROOT))
    manual_only='--manual-only' in sys.argv
    targets=[r for r in selections if r['key'] in MANUAL_PARTS] if manual_only else selections
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for n in pool.map(render,sorted({r['page'] for r in targets})):print('rendered',n,flush=True)
    previous=json.loads((WORK/'manifest.json').read_text()) if manual_only else []
    by_key={r['key']:r for r in previous};errors=[]
    for item in targets:
        try:by_key[item['key']]=extract(item)
        except Exception as e:errors.append(str(e))
    manifest=[by_key[r['key']] for r in selections if r['key'] in by_key]
    (WORK/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    (WORK/'errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
    sheets(manifest)
    if manual_only:sheets([r for r in manifest if r.get('manualReview')],'manual-contact')
    print('STAGED',len(manifest),'ERRORS',errors,flush=True)
