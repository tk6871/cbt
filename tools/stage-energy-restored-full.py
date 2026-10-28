"""Resume-safe full industrial-energy scan import. OCR locates pixels only.

Original PDF and earlier midterm files are never modified. Work artifacts are
private; only cropped images, printed answers and geometry are published.
"""
import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'work/energy-book-scope'
WORK = ROOT / 'work/energy-restored-full'
RANGES = [(2021,1,431,446),(2021,2,447,462),(2022,1,463,478),
          (2022,2,479,493),(2022,4,494,509),(2023,1,510,525),
          (2023,2,526,541),(2023,4,542,558),(2024,1,559,573),
          (2024,2,574,588),(2025,1,589,603),(2025,2,604,618),
          (2025,3,619,633)]
SHA = '840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d'
# Independently read from all thirteen printed answer grids. Groups contain
# five consecutive answers; OCR is cross-checked, never trusted as the key.
PRINTED_ANSWERS = {
 '2021-1':'13323 34244 43222 34214 14441 32131 24332 13322 31312 13432 33223 11424 21422 24132 33242 33333',
 '2021-2':'43114 44433 42323 24144 31441 42433 21224 14333 24344 21232 24214 42323 32321 23311 33243 13333',
 '2022-1':'24211 34431 41443 33314 24122 44134 43411 31121 24331 13411 24234 34213 13244 12443 24211 11222',
 '2022-2':'31422 43124 22324 31221 21324 11444 42321 34221 43131 31212 13223 21423 32412 44131 12233 33322',
 '2022-4':'23424 21441 14424 32332 14244 41411 33224 43141 14233 33132 13332 44144 33214 14313 41133 34221',
 '2023-1':'31141 21442 32343 23123 11211 32442 32132 31114 11212 24434 23124 44223 43243 11313 32244 13122',
 '2023-2':'42221 31323 33113 34121 33421 41422 14432 23243 12143 42234 32322 42244 32414 42422 24324 41313',
 '2023-4':'33414 41114 24312 11114 22224 11142 23221 23341 32133 22344 24442 43313 23233 14344 12412 34222',
 '2024-1':'33132 14144 42221 14233 13232 24123 14214 34114 32431 23133 11132 12223 32211 12314 44413 11434',
 '2024-2':'34222 32111 34442 12244 31111 22424 12243 12222 21432 23124 12142 41143 14322 24134 22341 44232',
 '2025-1':'41412 22322 22413 33434 12412 13211 21344 44212 21213 24443 13121 42111 31141 14411 42114 21221',
 '2025-2':'24233 41241 21334 42213 24412 22321 23321 34223 12132 34134 22342 44421 23132 31342 12141 23122',
 '2025-3':'31324 14413 32122 34332 33413 34244 43412 23122 21213 41113 13141 12242 21111 24321 13421 42414',
}
# Page, column, top coordinate observed on the scan. OCR misses a minus sign,
# splits the number, combines both columns, or reads 66 as 60 at these places.
ANCHOR_REPAIRS = {
 '2022-1-66':(474,1,.765), '2022-2-26':(483,1,.075),
 '2022-2-28':(483,1,.801), '2022-4-2':(494,0,.532),
 '2022-4-35':(500,1,.071), '2022-4-78':(508,1,.068),
 '2023-2-38':(533,1,.081), '2025-1-15':(591,1,.649),
 '2025-3-3':(619,1,.183), '2025-3-66':(630,1,.677),
}
HEADER = re.compile(r'PART\s*0?5|에너지관리산업기사.*기출문제|^정답.*회|^기출문제$|CHECK|POINT|QUESTION|년.*(?:기출|복원)문제|^\d\s*과목|^열설비(?:구조|취급)|^계측 및 에너지 진단$')
NO_PRINTED_EXPLANATION = {
 '2022-2-80':'교재 정답표는 ②입니다. 연소 후 높은 온도로 빠져나가는 배기가스가 가져가는 열이 이 보기들 중 가장 큰 열손실입니다.',
 '2022-4-65':'T.O.E는 석유환산톤입니다. 서로 다른 에너지의 양을 석유 1톤에 해당하는 열량 기준으로 나타낸 것이므로 ④입니다.',
 '2022-4-66':'교재 정답표는 ①입니다. 도시가스는 공기보다 가벼워 위쪽에 모이므로, 누출 가스를 빼는 환기구를 가능한 한 낮게 설치한다는 설명이 틀립니다.',
}

def read(path):
    return json.loads(path.read_text())

def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def page_rows(page):
    return read(CACHE / 'ocr' / f'page-{page}.json')['rows']

def page_path(page):
    for folder in [WORK/'pages', CACHE/'pages', ROOT/'work/energy-textbook/pages']:
        path = folder / f'{page}.png'
        if path.exists():
            return path
    return WORK/'pages'/f'{page}.png'

def render(page, pdf):
    path = page_path(page)
    if not path.exists():
        subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile',
                        '-scale-to','2200','-png',str(pdf),str(path.with_suffix(''))],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return str(path)

def prepare(pdf):
    for folder in ['pages','original','proofs']:
        (WORK/folder).mkdir(parents=True, exist_ok=True)
    with pdf.open('rb') as stream:
        assert hashlib.file_digest(stream,'sha256').hexdigest() == SHA
    pages = sorted({p for _,_,first,last in RANGES for p in range(first,last+1)})
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for index,_ in enumerate(pool.map(lambda p: render(p,pdf), pages),1):
            if index%20==0: print('Pages',index,'/',len(pages),flush=True)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',23)
    answers=[]
    for year,session,first,last in RANGES:
        rows=page_rows(last)
        cells=[]; values={}
        for r in rows:
            m=re.fullmatch(r'\s*0?(\d{1,2})\s*([①②③④1])\s*[)\]]?\s*',r['text'])
            if m and 1<=int(m[1])<=80:
                cells.append(r)
                values[str(int(m[1]))]=1 if m[2]=='1' else '①②③④'.index(m[2])+1
        im=Image.open(page_path(last)).convert('RGB');w,h=im.size
        y0=int(min(1-r['box'][1]-r['box'][3] for r in cells)*h)-20
        y1=int(max(1-r['box'][1] for r in cells)*h)+20
        crop=im.crop((int(.07*w),y0,int(.97*w),y1));crop.thumbnail((1500,850))
        sheet=Image.new('RGB',(1540,crop.height+55),'white')
        ImageDraw.Draw(sheet).text((10,5),f'{year}-{session} PDF {last}',font=font,fill='black')
        sheet.paste(crop,(20,45));sheet.save(WORK/'proofs'/f'answers-{year}-{session}.png')
        answers.append(dict(year=year,session=session,page=last,answers=values,
                            missing=[n for n in range(1,81) if str(n) not in values]))
    save(WORK/'answers-staged.json',answers)
    print('Prepared',len(pages),'source pages and13 answer tables',flush=True)

def units():
    bank=read(CACHE/'book-first-questions.json')['rows']; result=[]
    for year,session,first,last in RANGES:
        stream=[]
        for page in range(first,last+1):
            for side in [0,1]:
                if page==last and side==1: continue # Printed answer grid, not a question.
                rs=[dict(r,page=page,side=side) for r in page_rows(page)
                    if (r['box'][0]>=.44)==bool(side)]
                # Two observed cross-column OCR rows require a locator on the
                # right too. Pixels are cropped independently of this text.
                for number in [26,35]:
                    key=f'{year}-{session}-{number}'
                    repair=ANCHOR_REPAIRS.get(key)
                    if repair and repair[:2]==(page,side):
                        rs.append(dict(text=f'{number:02} repaired scan locator',score=1,
                            box=[.501,1-repair[2]-.018,.40,.018],page=page,side=side))
                stream.extend(sorted(rs,key=lambda r:-r['box'][1]-r['box'][3]))
        anchors=[]
        for number in range(1,81):
            key=f'{year}-{session}-{number}'
            old=next(q for q in bank if (q['year'],q['session'],q['number'])==(year,session,number))
            if key in ANCHOR_REPAIRS:
                page,side,top=ANCHOR_REPAIRS[key]
                candidates=[(i,r) for i,r in enumerate(stream) if r['page']==page and r['side']==side]
                index,row=min(candidates,key=lambda ir:abs(1-ir[1]['box'][1]-ir[1]['box'][3]-top)+(.1 if ir[1]['box'][0]>(.14 if side==0 else .55) else 0))
            else:
                r0=old['rows'][0]
                index,row=next((i,r) for i,r in enumerate(stream) if r['page']==r0['page'] and r['side']==r0['side'] and r['text']==r0['text'] and r['box']==r0['box'])
            assert not anchors or index>anchors[-1][0],(key,index,anchors[-1][:2])
            anchors.append((index,number,row))
        for n,(index,number,anchor) in enumerate(anchors):
            rows=stream[index:anchors[n+1][0] if n<79 else len(stream)]
            result.append(dict(key=f'{year}-{session}-{number}',year=year,session=session,
                number=number,page=anchor['page'],answerPage=last,anchor=anchor,rows=rows,
                nextAnchor=anchors[n+1][2] if n<79 else None))
    assert len(result)==1040
    save(WORK/'units.json',result)
    return result

def stitch(parts):
    out=Image.new('RGB',(max(p.width for p in parts),sum(p.height for p in parts)+16*(len(parts)-1)),'white')
    y=0
    for p in parts:out.paste(p,(0,y));y+=p.height+16
    return out

def find_banner(im,box,x0,y0,first):
    w,h=im.size;pw=round(.023*w);ph=max(6,round(.004*h))
    left=box[0];top=round((y0+(.023 if first else 0))*h)
    right=min(box[2],round((x0+.075)*w)+pw)
    bottom=box[3]
    if right-left<pw or bottom-top<ph:return None
    a=(np.asarray(im.convert('L').crop((left,top,right,bottom)))<160).astype(np.int32)
    integral=np.pad(a,((1,0),(1,0))).cumsum(0).cumsum(1)
    sums=integral[ph:,pw:]-integral[:-ph,pw:]-integral[ph:,:-pw]+integral[:-ph,:-pw]
    hits=np.argwhere(sums[:,::3]>.79*pw*ph)
    return top+int(hits[0,0]) if len(hits) else None

def crop_all(keys=None):
    all_units=units(); manifest=[]; errors=[]
    previous=read(WORK/'manifest.json') if keys and (WORK/'manifest.json').exists() else None
    for index,q in enumerate(all_units):
        if keys and q['key'] not in keys:
            old=next((r for r in previous['rows'] if r['key']==q['key']),None)
            if old:manifest.append(old)
            else:errors.extend(r for r in previous['errors'] if r['key']==q['key'])
            continue
        try:
            groups=[]
            for r in q['rows']:
                if HEADER.search(r['text']):continue
                top=1-r['box'][1]-r['box'][3]
                if top<.02 or top>.925:continue
                g=(r['page'],r['side'])
                if not groups or groups[-1][0]!=g:groups.append((g,[]))
                groups[-1][1].append(r)
            parts=[]; crops={'question':[],'explanation':[]};found=False
            for gi,((page,side),rs) in enumerate(groups):
                im=Image.open(page_path(page)).convert('RGB');w,h=im.size
                valid=[r for r in rs if side==0 or r['box'][0]>.475]
                x0=(q['anchor']['box'][0]-.014) if gi==0 else min(r['box'][0] for r in valid)-.02
                x0=max(.03 if side==0 else .475,x0);x1=.501 if side==0 else .97
                if q['key'] in {'2023-4-50','2024-1-62','2024-2-34',
                    '2024-2-1','2024-2-2','2025-1-27','2025-1-29','2025-1-76','2025-2-34'} and side==0:x1=.475
                y0=max(.02,min(1-r['box'][1]-r['box'][3] for r in rs)-(.008 if gi==0 else .025))
                y1=min(.923,max(1-r['box'][1] for r in rs)+.025)
                nxt=q['nextAnchor']
                if nxt and (nxt['page'],nxt['side'])==(page,side):
                    y1=min(y1,1-nxt['box'][1]-nxt['box'][3]-.015)
                box=[round(x0*w),round(y0*h),round(x1*w),round(y1*h)]
                marker=None
                if not found and q['key'] not in NO_PRINTED_EXPLANATION:
                    marker=find_banner(im,box,x0,y0,gi==0)
                    if q['key']=='2022-1-13' and page==465:marker=round(.205*h)
                    if q['key']=='2025-3-13' and page==621 and side==1:marker=round(.095*h)
                    if q['key']=='2025-2-69' and page==616:marker=round(.854*h)
                    if q['key']=='2025-2-78' and page==618:marker=round(.068*h)
                    if q['key']=='2025-3-61' and page==630:marker=round(.068*h)
                rect=dict(page=page,side=side,pageSize=[w,h])
                if marker is not None:
                    if marker-box[1]>35:
                        rect['question']=[box[0],box[1],box[2],marker-round(.006*h)]
                        crops['question'].append(im.crop(rect['question']))
                    rect['explanation']=[box[0],marker,box[2],box[3]]
                    crops['explanation'].append(im.crop(rect['explanation']));found=True
                else:
                    kind='explanation' if found else 'question';rect[kind]=box
                    crops[kind].append(im.crop(box))
                parts.append(rect)
            if not found and q['key'] not in NO_PRINTED_EXPLANATION:raise ValueError('explanation-banner-not-found')
            output={k:q[k] for k in ['key','year','session','number','page','answerPage']}
            output['parts']=parts
            for kind,images in crops.items():
                if not images:continue
                image=stitch(images);image.save(WORK/'original'/f"{q['key']}-{kind}.png")
                output[kind+'Size']=list(image.size)
            output['answer']=int(PRINTED_ANSWERS[f"{q['year']}-{q['session']}"] .replace(' ','')[q['number']-1])
            output['privateStem']=' '.join(r['text'] for r in q['rows'][:4])
            if q['key'] in NO_PRINTED_EXPLANATION:output['supplementalExplanation']=NO_PRINTED_EXPLANATION[q['key']]
            manifest.append(output)
        except Exception as e:errors.append(dict(key=q['key'],error=str(e)))
        if index%40==0:print('Crops',index+1,'/1040',flush=True)
    save(WORK/'manifest.json',dict(source=dict(name='에너지설비.pdf',sha256=SHA),rows=manifest,errors=errors))
    print('Crops complete',len(manifest),'errors',errors,flush=True)

def check_answers():
    disagreements=[]
    for row in read(WORK/'answers-staged.json'):
        key=f"{row['year']}-{row['session']}";digits=PRINTED_ANSWERS[key].replace(' ','')
        assert len(digits)==80 and set(digits)<=set('1234'),key
        for number,value in row['answers'].items():
            if int(digits[int(number)-1])!=value:disagreements.append((key,number,value,digits[int(number)-1]))
    save(WORK/'answer-audit.json',dict(printedGridsVisuallyRead=13,printedAnswers=1040,ocrDisagreements=disagreements))
    print('Answer OCR discrepancies',disagreements,flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('pdf',type=Path)
    parser.add_argument('--crop',action='store_true')
    parser.add_argument('--keys',nargs='+')
    args=parser.parse_args()
    if args.crop:check_answers();crop_all(args.keys)
    else:prepare(args.pdf)
