"""Private pixel extraction and proof sheets; no OCR text is published."""
import argparse, concurrent.futures, hashlib, json, re, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
parser=argparse.ArgumentParser();parser.add_argument('pdf');args=parser.parse_args()
root=Path('work/energy-book-scope');dest=Path('work/energy-textbook');dest.mkdir(exist_ok=True)
plan=json.loads((root/'book-selection-plan.json').read_text())
with open(args.pdf,'rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==plan['source']['sha256']
bank=json.loads((root/'book-first-questions.json').read_text())['rows']
for name in ['pages','original','proofs']:(dest/name).mkdir(exist_ok=True)
def ocr(page):return json.loads((root/'ocr'/f'page-{page}.json').read_text())['rows']
def render(page):
    p=dest/'pages'/f'{page}.png'
    if not p.exists():
        cached=root/'pages'/f'{page}.png'
        if cached.exists():
            # Read source page directly; retain one path without duplicating pixels.
            return str(cached)
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2200','-png',args.pdf,str(p.with_suffix(''))],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    return str(p)
required={q['answerPage'] for q in plan['rows']}
for q in plan['rows']:
    unit=next(u for u in bank if (u['year'],u['session'],u['number'])==(q['year'],q['session'],q['number']))
    assert not unit.get('missing'),q['key']
    required.update(r['page'] for r in unit['rows'])
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    pagefiles=dict(zip(sorted(required),pool.map(render,sorted(required))))
print('Rendered/cached',len(pagefiles),'pages',flush=True)
def stitch(parts):
    if not parts:raise ValueError('empty crop')
    gap=16;im=Image.new('RGB',(max(p.width for p in parts),sum(p.height for p in parts)+gap*(len(parts)-1)),'white');y=0
    for p in parts:im.paste(p,(0,y));y+=p.height+gap
    return im
def extract(q):
    unit=next(u for u in bank if (u['year'],u['session'],u['number'])==(q['year'],q['session'],q['number']))
    if q['key']=='2025-3-2':
        # The next anchor was split as a standalone '03' by OCR. The printed
        # next question begins with this line in the right column on PDF619.
        end=next(i for i,r in enumerate(unit['rows']) if r['text'].startswith('정상유동과정'))
        unit={**unit,'rows':unit['rows'][:end]}
    groups=[]
    for r in unit['rows']:
        if re.search(r'PART\s*0?5|에너지관리산업기사.*기출문제|^정답.*회|^기출문제$|CHECK|POINT|QUESTION|년.*(?:기출|복원)문제|^\d\s*과목|^열설비(?:구조|취급)|^계측 및 에너지 진단$',r['text']):continue
        top=1-r['box'][1]-r['box'][3]
        if top<.02 or top>.925:continue
        g=(r['page'],r['side'])
        if not groups or groups[-1][0]!=g:groups.append((g,[]))
        groups[-1][1].append(r)
    question=[];explanation=[];rects=[];found=False
    for group_index,((page,side),rs) in enumerate(groups):
        im=Image.open(pagefiles[page]).convert('RGB');w,h=im.size
        # Vision sometimes assigns small cells from the left table to the right
        # column. Never extend a right-column crop over the printed gutter.
        if group_index==0:x0=unit['rows'][0]['box'][0]-.014
        else:x0=min(r['box'][0] for r in rs if side==0 or r['box'][0]>.50)-.020
        x0=max(.03 if side==0 else .475,x0)
        x1=.501 if side==0 else .97
        if q['key'] in {'2023-4-50','2024-1-62','2024-2-34'} and side==0:x1=.475
        y0=max(.02,min(1-r['box'][1]-r['box'][3] for r in rs)-(.008 if group_index==0 else .025))
        # A final formula/text line can be absent from OCR. Keep additional
        # scanned pixels, bounded by the next question in this printed column.
        y1=min(.923,max(1-r['box'][1] for r in rs)+.025)
        following=[1-r['box'][1]-r['box'][3] for u in bank
          if (u['year'],u['session'])==(q['year'],q['session']) and u['number']>q['number']
          for r in u.get('rows',[])[:1] if r['page']==page and r['side']==side
          and 1-r['box'][1]-r['box'][3]>y0]
        if following:y1=min(y1,min(following)-.015)
        headings=[1-r['box'][1]-r['box'][3] for r in unit['rows']
          if r['page']==page and r['side']==side and re.search(r'열설비(?:취급|운전|설치)|^\d\s*과목',r['text'])
          and 1-r['box'][1]-r['box'][3]>max(1-r['box'][1] for r in rs)]
        if headings:y1=min(y1,min(headings)-.015)
        box=[round(x0*w),round(y0*h),round(x1*w),round(y1*h)]
        marker=None
        if not found:
            gray=im.convert('L')
            for y in range(round((y0+(.023 if group_index==0 else 0))*h),box[3]-8):
                for x in range(box[0],round((x0+.075)*w),3):
                    if x+round(.023*w)>=box[2]:continue
                    values=list(gray.crop((x,y,x+round(.023*w),y+max(6,round(.004*h)))).getdata())
                    if sum(v<160 for v in values)/len(values)>.79:marker=y;break
                if marker is not None:break
            # These two faint scanned banners were checked on the full page.
            if q['key']=='2022-1-13' and page==465:marker=round(.205*h)
            if q['key']=='2025-3-13' and page==621 and side==1:marker=round(.095*h)
        if marker is not None:
            if marker-box[1]>35:question.append(im.crop((box[0],box[1],box[2],marker-round(.006*h))))
            explanation.append(im.crop((box[0],marker,box[2],box[3])));found=True
            rects.append({'page':page,'side':side,'question':[box[0],box[1],box[2],marker-round(.006*h)],'explanation':[box[0],marker,box[2],box[3]],'pageSize':[w,h]})
        elif found:
            explanation.append(im.crop(box));rects.append({'page':page,'side':side,'explanation':box,'pageSize':[w,h]})
        else:
            question.append(im.crop(box));rects.append({'page':page,'side':side,'question':box,'pageSize':[w,h]})
    if not found:raise ValueError('explanation banner not found: '+q['key'])
    output={**q,'parts':rects}
    for kind,parts in [('question',question),('explanation',explanation)]:
        img=stitch(parts);img.save(dest/'original'/f"{q['key']}-{kind}.png");output[kind+'Size']=list(img.size)
    answers=[]
    for r in ocr(q['answerPage']):
        m=re.fullmatch(r'\s*0?'+str(q['number'])+r'\s*([①②③④1])\s*[)\]]?\s*',r['text'])
        if m:answers.append(1 if m[1]=='1' else '①②③④'.index(m[1])+1)
    output['answerCandidates']=sorted(set(answers))
    output['privateStem']=unit['stem'];output['privateRows']=[r['text'] for r in unit['rows']]
    return output
manifest=[];errors=[]
for i,q in enumerate(plan['rows']):
    try:manifest.append(extract(q))
    except Exception as e:errors.append({'key':q['key'],'error':str(e)})
    if i%10==0:print('Cropped',i+1,'/',len(plan['rows']),flush=True)
(dest/'manifest.json').write_text(json.dumps({'source':plan['source'],'rows':manifest,'errors':errors},ensure_ascii=False,indent=2)+'\n')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
for start in range(0,len(manifest),4):
    sheet=Image.new('RGB',(2200,2200),'#dce3ec');d=ImageDraw.Draw(sheet)
    for i,q in enumerate(manifest[start:start+4]):
        x=(i%2)*1100;y=(i//2)*1100
        d.text((x+10,y+5),f"{q['key']} T{q['topic']} A{q['answerCandidates']} PDF{q['page']}",font=font,fill='black')
        for j,kind in enumerate(['question','explanation']):
            im=Image.open(dest/'original'/f"{q['key']}-{kind}.png");im.thumbnail((535,1040));sheet.paste(im,(x+j*550+5,y+40))
    sheet.save(dest/'proofs'/f'{start//4+1:02}.jpg',quality=95)
print('COMPLETE',len(manifest),'errors',errors,'answer review',[(q['key'],q['answerCandidates']) for q in manifest if len(q['answerCandidates'])!=1],flush=True)
