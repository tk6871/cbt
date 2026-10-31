"""Compare every remaining candidate against fresh OCR of existing images.

Private OCR only. Proposals record one/two-view agreement, all ordered
options, printed key and source-ink coverage. Nothing is automatically
published: each proposal still needs direct review. Diagrams and formula
glyphs are never accepted by text similarity.
"""
import re,json,html,unicodedata,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
def norm(s):
 s=html.unescape(re.sub(r'</?(?:p|br|div|span|sup|sub|img|table|tbody|tr|td|strong|b|i|em|a|font)(?:\s[^>]*)?/?>',' ',str(s or ''),flags=re.I))
 s=unicodedata.normalize('NFKC',re.sub('[•ㆍ․・]','·',s))
 s=re.sub('[–—−]','-',s).replace('⁄','/').replace('∕','/').replace('∆','Δ')
 return re.sub(r'[^\w+\-*/=<>.%°℃~×÷±√∞≈≤≥≠→↔()\[\]{}:·]','',s).replace('_','').removesuffix('.')
def parse(rows):
 rows=sorted(rows,key=lambda r:(r['box'][1],r['box'][0]))
 marked={n:[r for r in rows if r['text'].strip().startswith(c)] for n,c in enumerate('①②③④',1)}
 if not all(len(v)==1 for v in marked.values()):return None
 selected={n:v[0] for n,v in marked.items()};top=min(r['box'][1] for r in selected.values())
 stem=' '.join(r['text'] for r in rows if r['box'][1]<top-.005)
 stem=re.sub(r'^\s*\d+[.．)](?!\d)\s*','',stem)
 grid=max(r['box'][0] for r in selected.values())-min(r['box'][0] for r in selected.values())>.05
 options=[]
 for n in range(1,5):
  r=selected[n];x,y=r['box'][:2]
  bottom=min([v['box'][1] for i,v in selected.items() if i!=n and v['box'][1]>y+.005 and (not grid or abs(v['box'][0]-x)<.04)]+[1.01])
  right=min([v['box'][0]-.005 for v in selected.values() if grid and v['box'][0]>x+.05]+[1.01])
  lines=[v['text'].strip() for v in rows if y-.004<=v['box'][1]<bottom-.004 and x-.015<=v['box'][0]<right]
  options.append(norm(re.sub(r'^[①②③④]\s*','',' '.join(lines))))
 return norm(stem),options
sources={r['id']:r for r in json.loads((WORK/'source-index.json').read_text())}
parsed={};cache_count=0
for file in (WORK/'source-ocr').glob('*.json'):
 r=json.loads(file.read_text());source=sources[r['id']];path=ROOT/source['sourceImage']
 assert hashlib.sha256(path.read_bytes()).hexdigest()==r['sha256'],r['id']
 cache_count+=1;p=parse(r['rows'])
 if not p:continue
 # Unrecognized circuit lines, plots or formula bars must not disappear.
 with Image.open(path).convert('L') as im:
  ink=im.point(lambda v:255 if v<120 else 0);mask=Image.new('L',im.size);draw=ImageDraw.Draw(mask)
  for row in r['rows']:
   x0,y0,x1,y1=row['box'];draw.rectangle((max(0,int(x0*im.width)-3),max(0,int(y0*im.height)-3),min(im.width,int(x1*im.width)+3),min(im.height,int(y1*im.height)+3)),fill=255)
  from PIL import ImageChops
  total=sum(ink.histogram()[1:]);uncovered=sum(ImageChops.subtract(ink,mask).histogram()[1:])
  coverage=1-uncovered/max(total,1)
 parsed[r['id']]={'stem':p[0],'choices':p[1],'coverage':coverage,'sha256':r['sha256']}
ready={f"{e['page']}:{e['number']}" for e in json.loads((ROOT/'data/textbook-pages.json').read_text())['entries'] if e['book']=='hansol' and (e['sourceId'] or e.get('reviewHold'))}
queue=json.loads((WORK/'review-queue.json').read_text())['rows'];by_key={}
for variant,file in enumerate(['comparison.json','comparison-columns.json']):
 for row in json.loads((WORK/file).read_text())['questions']:
  key=f"{row['page']}:{row['number']}"
  if key in ready or row['requiresImageComparison'] or row['printedAnswerConflict'] or row['printedAnswer'] is None:continue
  for c in row['candidates']:
   p=parsed.get(c['id']);q=sources[c['id']]
   if not p or p['coverage']<.98 or q['answer']!=row['printedAnswer']:continue
   raw=' '.join([q['text'],*q['choices']])
   if re.search(r'[\ue000-\uf8ff=×÷√∞±]',raw) or re.search(r'그림|도면|회로|배관도|그래프|기호',raw):continue
   if p['stem']!=norm(row['stem']) or p['choices']!=row['choices']:continue
   by_key.setdefault((key,c['id']),[]).append({'variant':variant,'page':row['page'],'number':row['number'],'column':row['column'],'answer':row['printedAnswer']})
proposals=[]
for (key,id),rows in by_key.items():
 p=parsed[id];proposals.append({**rows[0],'sourceId':id,'views':sorted(set(r['variant'] for r in rows)),'coverage':p['coverage'],'sourceImageSha256':p['sha256']})
proposals.sort(key=lambda r:(list(map(int,r['page'].split('-'))),r['number'],r['sourceId']))
result={'sourceImagesRead':cache_count,'sourceImagesWithFourOptions':len(parsed),'remainingCandidatesCompared':len(queue),'proposals':proposals,'limits':'기존 이미지와의 OCR 비교이며 그림·수식·불확실한 후보는 연결하지 않습니다.'}
(WORK/'source-image-comparison.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['proposals','limits']}));print(json.dumps(proposals,ensure_ascii=False,indent=2))
