"""Conservative visible-screen OCR comparison, never automatic text publishing.

Only exact normalized stem + all four ordered choices + printed answer can be
confirmed. Approximate candidates remain private for visual/manual review.
"""
import re,json,html,unicodedata,argparse,collections,difflib
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
parser=argparse.ArgumentParser();parser.add_argument('--through',type=int);parser.add_argument('--variant',choices=['full','columns'],default='full');parser.add_argument('--probe-ranking',action='store_true');args=parser.parse_args()
def norm(s):
 s=html.unescape(re.sub(r'</?(?:p|br|div|span|sup|sub|img|table|tbody|tr|td|strong|b|i|em|a|font)(?:\s[^>]*)?/?>',' ',str(s or ''),flags=re.I))
 s=unicodedata.normalize('NFKC',re.sub('[•ㆍ․・]','·',s))
 s=re.sub('[–—−]','-',s).replace('⁄','/').replace('∕','/').replace('∆','Δ')
 return re.sub(r'[^\w+\-*/=<>.%°℃~×÷±√∞≈≤≥≠→↔()\[\]{}:·]','',s).replace('_','').removesuffix('.')
assert norm('1 mW')!=norm('1 MW')
assert norm('2~3')!=norm('23') and norm('(1+2)*3')!=norm('1+2*3')
assert norm('∞')=='∞' and norm('A<B')=='A<B'
assert norm('−9')==norm('-9') and norm('−9')!=norm('9')
assert norm('1:4')!=norm('14') and norm('½')==norm('1/2') and norm('½')!=norm('12')
assert norm('냉ㆍ난방')==norm('냉·난방') and norm('kg•K')==norm('kg·K')
assert norm('1.2 m.')==norm('1.2 m') and norm('1.2 m')!=norm('12 m')
def grams(s):return set(s[i:i+3] for i in range(max(0,len(s)-2)))
def marker(text):
 text=text.strip()
 if text and text[0] in '①②③④':return '①②③④'.index(text[0])+1
 m=re.match(r'^([l!1-4])(?:\s+|\))',text)
 return (1 if m[1] in 'l!' else int(m[1])) if m else None
sources=json.loads((WORK/'source-index.json').read_text())
index=collections.defaultdict(set)
for i,q in enumerate(sources):
 q['stem']=norm(re.sub(r'^\s*\d+[.．)](?!\d)\s*','',q['text']));q['options']=[norm(c) for c in q['choices']]
 for g in grams(q['stem']):index[g].add(i)
def rank(stem,choices):
 score=collections.Counter()
 for g in grams(stem):
  for i in index[g]:score[i]+=1
 candidates=[]
 # String-set/hash iteration must never decide which equal-scoring source ID
 # gets a persistent book-study link.
 for i,_ in sorted(score.items(),key=lambda row:(-row[1],sources[row[0]]['id']))[:45]:
  q=sources[i];similar=difflib.SequenceMatcher(None,stem,q['stem'],autojunk=False).ratio()
  option=sum(difflib.SequenceMatcher(None,a,b,autojunk=False).ratio() for a,b in zip(choices,q['options']))/4
  candidates.append({'id':q['id'],'stemScore':round(similar,4),'choiceScore':round(option,4),'answer':q['answer'],
   'exact':stem==q['stem'] and all(len(a)>0 and a==b for a,b in zip(choices,q['options']))})
 return sorted(candidates,key=lambda r:(-(r['stemScore']*.65+r['choiceScore']*.35),0 if r['id'].startswith('hvac-hansol-') else 1,r['id']))[:6]
if args.probe_ranking:
 probe_ids=['hvac-20190303:53','hvac-20140302:4','hvac-hansol-2022-3:18']
 print(json.dumps({q['id']:rank(q['stem'],q['options']) for q in sources if q['id'] in probe_ids},ensure_ascii=False,sort_keys=True))
 raise SystemExit
def paper_background(image,row):
 w,h=image.size;x0,y0,x1,y1=row['box'];ys=[max(0,min(h-1,int((y0+y1)*h/2))),max(0,min(h-1,int(y0*h-2)))]
 xs=[max(0,min(w-1,int((x0-.003)*w))),max(0,min(w-1,int((x1+.002)*w)))]
 values=[min(image.getpixel((x,y))[:3]) for x in xs for y in ys]
 return max(values)>=246
glyph_file=WORK/'answer-glyphs.json';glyph_keys=json.loads(glyph_file.read_text()) if glyph_file.exists() else {}
mapfile=WORK/'page-map.json';page_map={(p['spread'],p['half']):p for p in json.loads(mapfile.read_text())['pages']} if mapfile.exists() else {}
manualfile=ROOT/'tools/hansol-printed-key-review.json';manual_keys=json.loads(manualfile.read_text())['answers'] if manualfile.exists() else {}
numberfile=ROOT/'tools/hansol-screen-number-review.json';number_fixes=json.loads(numberfile.read_text())['rows'] if numberfile.exists() else []
output=[];spreads=[];missing=[];inventory=[];printed_slots=[]
for file in sorted((WORK/'ocr').glob('spread-*.json')):
 number=int(file.stem.split('-')[-1])
 if args.through is not None and number>args.through:continue
 data=json.loads(file.read_text());rows=data['rows'];image=Image.open(data['path']).convert('RGB')
 original_rows=rows
 if args.variant=='columns':
  columns=[]
  for col in range(4):
   cf=WORK/'ocr-clean-columns'/f'{file.stem}-clean-column-{col}.json'
   if not cf.exists():continue
   for row in json.loads(cf.read_text())['rows']:
    x0,y0,x1,y1=row['box'];columns.append({**row,'box':[col*.25+x0*.25,.07+y0*.83,col*.25+x1*.25,.07+y1*.83]})
  if columns:rows=columns+[r for r in original_rows if r['box'][1]>.90]
 pages=[]
 for half in range(2):
  footer_y=page_map.get((number,half),{}).get('footerY') or .945
  foot=[r for r in original_rows if (r['box'][0]+r['box'][2])/2>=half*.5 and (r['box'][0]+r['box'][2])/2<(half+1)*.5 and r['box'][1]>footer_y-.060]
  labels=[]
  for r in foot:
   labels += re.findall(r'(?<!\d)([1-5])\s*[-–—]\s*(\d{1,3})(?!\d)',r['text'])
  page=page_map.get((number,half),{}).get('page') or ('-'.join(labels[-1]) if labels else None);pages.append(page)
  if not page:continue
  keyrows=[r for r in foot if r['box'][1]<footer_y-.006 and re.search('[①②③④]',r['text'])]
  keyfile=WORK/'ocr-regions'/f"{file.stem}-{'left' if half==0 else 'right'}-key.json"
  if keyfile.exists():
   better=json.loads(keyfile.read_text())['rows']
   if any(re.search(r'\d{1,2}\s*[①②③④]',r['text']) for r in better):keyrows=better
  answers={}
  for r in keyrows:
   for n,a in re.findall(r'(\d{1,2})\s*([①②③④])',r['text']):
    if 1<=int(n)<=99:answers[int(n)]='①②③④'.index(a)+1
  conflicts=[]
  for cell in glyph_keys.get(f"{file.stem}-{'left' if half==0 else 'right'}-key",{}).get('cells',[]):
   if not cell['accepted']:continue
   n,a=cell['number'],cell['answer']
   if n in answers and answers[n]!=a:conflicts.append(n);answers.pop(n)
   else:answers[n]=a
  for n,a in manual_keys.get(page,{}).items():
   n=int(n);answers[n]=a;conflicts=[c for c in conflicts if c!=n]
  printed_slots.extend({'spread':number,'page':page,'number':n,'answer':a,'basis':'visually-read-printed-key' if str(n) in manual_keys.get(page,{}) else 'printed-key-OCR','conflict':n in conflicts} for n,a in sorted(answers.items()))
  for col in range(2):
   left=half*.5+col*.25;right=left+.25
   area=[r for r in rows if left<=(r['box'][0]+r['box'][2])/2<right and .07<r['box'][1]<.90]
   area.sort(key=lambda r:(r['box'][1],r['box'][0]))
   anchors=[]
   for r in area:
    m=re.match(r'^\s*(\d{1,2})(?:\s+|[.．)]\s*|(?=[가-힣]))(.*)',r['text'])
    if m and 1<=int(m[1])<=99 and not re.match(r'^[①②③④]',m[2]) and paper_background(image,r):
     n=int(m[1]);fix=next((f for f in number_fixes if f['page']==page and f['column']==col and f['rawNumber']==n and norm(f['contains']) in norm(m[2])),None)
     anchors.append((fix['number'] if fix else n,r,m[2]))
   for ai,(n,anchor,first) in enumerate(anchors):
    top=anchor['box'][1];bottom=anchors[ai+1][1]['box'][1] if ai+1<len(anchors) else .90
    body=[r for r in area if top-.002<=r['box'][1]<bottom-.002]
    markers=[r for r in body if r['box'][1]>top+.01 and marker(r['text']) and paper_background(image,r)]
    by={i:[] for i in range(1,5)}
    for r in markers:by[marker(r['text'])].append(r)
    if not all(by.values()):
     # Retain incomplete OCR as an explicit review item. In particular a
     # formula/diagram choice must never silently disappear from the audit.
     first_choice=min([r['box'][1] for r in markers]+[bottom])
     lead=' '.join([first,*[r['text'] for r in body if r is not anchor and r['box'][1]<first_choice-.003]])
     if any(s in lead for s in ['?','？','것은','얼마','하시오','구하','옳은','틀린','적합','잘못','가장']):
      inventory.append({'spread':number,'page':page,'number':n,'column':col,'stem':lead,'bounds':[left,top,right,bottom],'reason':'incomplete-option-OCR','detectedChoices':sorted(i for i,rs in by.items() if rs),'printedAnswer':answers.get(n)})
     continue
    selected={i:min(rs,key=lambda r:r['box'][1]) for i,rs in by.items()}
    # Choice/explanation lists in an explanation panel are excluded by their
    # colored background. Four markers still do not by themselves confirm.
    first_choice=min(r['box'][1] for r in selected.values())
    stem_rows=[r for r in body if r['box'][1]<first_choice-.003]
    text=' '.join([first,*[r['text'] for r in stem_rows if r is not anchor]])
    if not any(s in text for s in ['?','？','것은','얼마','하시오','구하','옳은','틀린','적합','잘못','가장']):continue
    options=[]
    grid=max(r['box'][0] for r in selected.values())-min(r['box'][0] for r in selected.values())>.04
    for choice in range(1,5):
     start=selected[choice];x=start['box'][0];y=start['box'][1]
     same=[r for i,r in selected.items() if i!=choice and (not grid or abs(r['box'][0]-x)<.025) and r['box'][1]>y+.005]
     end=min([r['box'][1] for r in same]+[bottom])
     column_right=min([r['box'][0]-.005 for r in selected.values() if r['box'][0]>x+.04]+[right]) if grid else right
     lines=[r for r in body if y-.003<=r['box'][1]<end-.003 and x-.01<=r['box'][0]<column_right and paper_background(image,r) and not re.match(r'^\s*\[?\d{2}년',r['text'])]
     # Never swallow a following explanation into the last answer: only lines
     # aligned with answer copy (not panel indents) are used; exact comparisons
     # otherwise remain unconfirmed and are reviewed manually.
     options.append(norm(' '.join(re.sub(r'^(?:[①②③④]\s*|[l!1-4](?:\s+|\)))','',r['text'].strip()) for r in lines)))
    candidates=rank(norm(text),options)
    # Identical wording is insufficient for questions whose actual circuit,
    # graph or diagram can change while the stem/choice names remain equal.
    requires_image=bool(re.search(r'그림|도면|선도|회로|배관도|배선도|특성곡선|시퀀스|표와\s*같|표에서|그래프|기호',text))
    exact=[c for c in candidates if c['exact'] and answers.get(n)==c['answer'] and not requires_image and n not in conflicts]
    output.append({'spread':number,'page':page,'number':n,'column':col,'stem':text,'choices':options,'printedAnswer':answers.get(n),'printedAnswerConflict':n in conflicts,
     'bounds':[left,top,right,bottom],'requiresImageComparison':requires_image,'status':'exact-screen-and-printed-answer' if exact else 'visual-review-required','sourceId':exact[0]['id'] if exact else None,'candidates':candidates})
  if not answers:missing.append({'spread':number,'page':page,'reason':'no-printed-answer-key-detected'})
 spreads.append({'spread':number,'pages':pages,'rows':len(rows)})
 image.close()
result={'scope':'visible normal UI; private OCR comparison only','spreads':spreads,'questions':output,'incompleteQuestions':inventory,'printedAnswerSlots':printed_slots,'pageWarnings':missing}
(WORK/('comparison-columns.json' if args.variant=='columns' else 'comparison.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'spreads':len(spreads),'printedPages':sum(bool(p) for s in spreads for p in s['pages']),'questionCandidates':len(output),'exactWithPrintedAnswer':sum(q['sourceId'] is not None for q in output)},ensure_ascii=False))
