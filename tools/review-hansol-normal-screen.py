"""Private, user-authorized normal reader UI audit. No ebook-file access.

Uses only the visible Kyobo window, ordinary Right keys and OS screenshots.
Stops on lost focus, changed bounds, blocked capture or duplicate page. Never
changes capture/security settings. Screens/OCR stay in ignored work/.
"""
import argparse,hashlib,json,subprocess,time
from pathlib import Path
from PIL import Image,ImageStat

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-whole-book';WORK.mkdir(exist_ok=True,parents=True)
parser=argparse.ArgumentParser();parser.add_argument('--count',type=int,default=20);parser.add_argument('--window',type=int,default=1054);parser.add_argument('--advance-first',action='store_true');parser.add_argument('--resume',action='store_true');parser.add_argument('--ocr-batch',type=int,default=0);parser.add_argument('--finish-observed-end',action='store_true',help='Offline OCR only, after the operator has visually verified the reader end and restored its settings');args=parser.parse_args()
assert 1<=args.count<=1000
def apple(lines):
 result=subprocess.run(['osascript',*sum((['-e',line] for line in lines),[])],text=True,capture_output=True)
 if result.returncode:raise RuntimeError(result.stderr.strip())
 return result.stdout.strip()
def check():
 value=apple(['tell application "System Events" to tell process "iPadB2C"',
 'if frontmost is false then error "Kyobo lost foreground; audit stopped"',
 'get {position, size} of window "교보eBook"','end tell'])
 if value!='83, 87, 1440, 991':raise RuntimeError('Reader bounds changed; stopped: '+value)
def advance():
 check();apple(['tell application "System Events" to tell process "iPadB2C"','key code 124','end tell']);time.sleep(.65)
def snapshot(index):
 path=WORK/'screens'/f'spread-{index:04}.png';path.parent.mkdir(exist_ok=True)
 subprocess.run(['/usr/sbin/screencapture','-x','-o','-l',str(args.window),str(path)],check=True)
 with Image.open(path) as image:
  if image.size!=(2880,1982):raise RuntimeError('Unexpected capture dimensions: '+str(image.size))
  body=image.convert('RGB').crop((60,170,2820,1850))
  if max(ImageStat.Stat(body).stddev)<8:raise RuntimeError('Blank or restricted capture; do not bypass')
  digest=hashlib.sha256(body.tobytes()).hexdigest()
 return path,digest
statefile=WORK/'capture-progress.json'
state=json.loads(statefile.read_text()) if statefile.exists() else {'status':'in-progress','scope':'normal visible UI only; private comparison aid','originalWindow':[24,222,1024,800],'originalTwoPage':False,'originalProgress':80,'rows':[]}
def save():statefile.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
def ocr():
 binary=WORK/'recognize-screen';assert binary.exists(),'Compile the existing Vision helper first'
 inputs=WORK/'ocr-inputs.json';inputs.write_text(json.dumps([str(ROOT/r['image']) for r in state['rows']])+'\n')
 subprocess.run([str(binary),str(inputs),str(WORK/'ocr')],check=True,stdout=subprocess.DEVNULL)
 state['ocrCount']=len(list((WORK/'ocr').glob('spread-*.json')));save()
try:
 if args.finish_observed_end:
  ocr();state['status']='end-observed-captured-not-compared';state['lastError']=None;state['readerRestored']={'twoPage':False,'window':[24,222,1024,800],'progress':80};save();print(f"End observed; {state['ocrCount']} screens OCR complete; comparison remains pending");raise SystemExit(0)
 check()
 if args.resume and state['rows']:
  _,current=snapshot(len(state['rows']))
  if current==state['rows'][-1]['bodySha256']:advance()
 elif args.advance_first:advance()
 for _ in range(args.count):
  index=len(state['rows']);check();path,digest=snapshot(index)
  if state['rows'] and digest==state['rows'][-1]['bodySha256']:
   time.sleep(.8);path,digest=snapshot(index)
   if digest==state['rows'][-1]['bodySha256']:raise RuntimeError('Page did not advance; stopped without skipping')
  state['rows'].append({'index':index,'image':str(path.relative_to(ROOT)),'bodySha256':digest,'capturedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z')})
  state['status']='in-progress';state['lastError']=None;save();print(f'Normal reader spread {index+1}',flush=True)
  if args.ocr_batch and (_+1)%args.ocr_batch==0:ocr();print(f"OCR complete {state['ocrCount']}",flush=True)
  if _+1<args.count:advance()
 if args.ocr_batch:ocr()
 state['status']='batch-captured-not-reviewed';save()
except Exception as error:
 state['status']='stopped-needs-review';state['lastError']=str(error);save();raise
