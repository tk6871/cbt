"""Private printed-page inventory from the authorized normal reader audit.

Only bracketed, arithmetically consecutive gaps are filled. Front matter and
section boundaries are not invented. OCR/screen contents remain in work/.
"""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/hansol-whole-book'
capture=json.loads((WORK/'capture-progress.json').read_text())
pages=[]
for spread in capture['rows']:
 path=WORK/'ocr'/f"spread-{spread['index']:04}.json"
 if not path.exists():raise RuntimeError(f'Missing OCR: {path.name}')
 rows=json.loads(path.read_text())['rows']
 for half in range(2):
  area=[r for r in rows if half*.5<=(r['box'][0]+r['box'][2])/2<(half+1)*.5]
  footer=[r for r in area if r['box'][1]>.84 and (r['box'][1]>.935 or re.search(r'과목|제\d+장|모의고사|필기문제|부록',r['text']))]
  labels=[f'{int(a)}-{int(b)}' for r in footer for a,b in re.findall(r'(?<!\d)([1-5])\s*[-–—]\s*(\d{1,3})(?!\w)',r['text'])]
  label=labels[-1] if len(set(labels))==1 else None
  matched=[r for r in footer if label and re.search(r'(?<!\d)'+re.escape(label)+r'(?!\w)',r['text'])]
  pages.append({'spread':spread['index'],'half':half,'page':label,'basis':'printed-footer' if label else 'unlabeled','footer':matched,'footerY':min((r['box'][1] for r in matched),default=None)})
known=[i for i,p in enumerate(pages) if p['page']]
for left,right in zip(known,known[1:]):
 if right-left<=1:continue
 a,n=map(int,pages[left]['page'].split('-'));b,m=map(int,pages[right]['page'].split('-'))
 if a==b and m-n==right-left and right-left<=5:
  for i in range(left+1,right):pages[i]['page']=f'{a}-{n+i-left}';pages[i]['basis']='consecutive-bracketed-footers';pages[i]['brackets']=[pages[left]['page'],pages[right]['page']]
labels=[p['page'] for p in pages if p['page']]
if len(labels)!=len(set(labels)):
 duplicates={label:[(p['spread'],p['half'],p['basis']) for p in pages if p['page']==label] for label in labels if labels.count(label)>1}
 raise RuntimeError(f'Duplicate printed page labels require visual review: {duplicates}')
report={'scope':'normal visible UI; OCR page map is not full question verification','readerEndVisuallyObserved':capture['status']=='end-observed-captured-not-compared','screens':len(capture['rows']),'pages':pages,'counts':{'printed':sum(p['basis']=='printed-footer' for p in pages),'bracketed':sum(p['basis']=='consecutive-bracketed-footers' for p in pages),'unlabeled':sum(not p['page'] for p in pages)}}
(WORK/'page-map.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report['counts']))
