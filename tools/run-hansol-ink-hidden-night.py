"""One explicitly approved, bounded unattended local image-release job.

No installs/downloads/Git/security preference edits. Keep this job awake only
while it runs. Preserve original assets, log failures and stop on failed checks.
"""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/hansol-ink-hidden'
parser=argparse.ArgumentParser()
parser.add_argument('--launch',action='store_true')
parser.add_argument('--worker',action='store_true')
args=parser.parse_args()
assert args.launch != args.worker
os.chdir(ROOT)
read=lambda p:json.loads(p.read_text())
plan=read(WORK/'jobs.json')
assert plan.get('scope')=='affected-ink-only'
assert len(plan['jobs'])==40 and len(plan['retained'])==474 and len(plan['retainedPages'])==383
assert read(WORK/'capture-progress.json')['status']=='captured-needs-crop-audit'

def status(state,**extra):
    value={'status':state,'pid':os.getpid(),'updatedAt':time.strftime('%Y-%m-%dT%H:%M:%S%z'),**extra}
    path=WORK/'night-status.json';temporary=path.with_suffix('.pending')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');os.replace(temporary,path)
    return value

if args.launch:
    previous=read(WORK/'night-status.json') if (WORK/'night-status.json').exists() else {}
    if previous.get('status') in ('starting','running'):
        try:os.kill(previous['pid'],0)
        except ProcessLookupError:pass
        else:raise RuntimeError('This bounded night job is already running')
    with (WORK/'night.log').open('a') as log:
        child=subprocess.Popen(['/usr/bin/caffeinate','-i','-s',sys.executable,str(Path(__file__).resolve()),'--worker'],
                               cwd=ROOT,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
    print(json.dumps({'launched':True,'supervisorPid':child.pid,'log':str(WORK/'night.log'),
                      'scope':'40 ink-affected replacements only, local build/checks/summary; no Git',
                      'progress':'http://127.0.0.1:4234/work/hansol-ink-hidden/progress.html'}),flush=True)
    raise SystemExit(0)

status('starting',total=40)
try:
    # Restore the known original window size. The reader's temporary two-page
    # preference was already switched back off through its normal UI. Exact
    # old reading position is not claimed unless separately observed.
    if (WORK/'reader-restoration.json').exists():
        restoration=read(WORK/'reader-restoration.json')
    else:
        result=subprocess.run(['osascript','-e','tell application "System Events" to tell process "iPadB2C"',
                               '-e','set size of window "교보eBook" to {1024, 800}',
                               '-e','get size of window "교보eBook"','-e','end tell'],capture_output=True,text=True)
        restoration={'windowSizeResult':result.stdout.strip(),'error':result.stderr.strip() if result.returncode else None,
                     'landscapeTwoPage':False,'inkHidden':True,'readingPosition84Percent':'not-verified'}
    (WORK/'reader-restoration.json').write_text(json.dumps(restoration,ensure_ascii=False,indent=2)+'\n')
    # Local-only progress view; no externally reachable listening socket.
    with (WORK/'preview-server.log').open('a') as server_log:
        subprocess.Popen([sys.executable,'-m','http.server','4234','--bind','127.0.0.1'],
                         stdin=subprocess.DEVNULL,stdout=server_log,stderr=server_log,start_new_session=True)
    subprocess.run(['node','tools/finalize-hansol-ink-hidden.mjs','--prepare'],check=True)
    subprocess.run(['node','tools/finalize-hansol-ink-hidden.mjs','--preflight'],check=True)
    status('running',total=40,readerRestoration=restoration)
    subprocess.run([sys.executable,'tools/finish-hansol-ink-hidden.py','--publish','--finish'],check=True)
    status('complete',total=40,result='work/hansol-ink-hidden/result.json',git='not-run')
except BaseException as error:
    status('failed-needs-review',total=40,error=str(error),log='work/hansol-ink-hidden/night.log')
    # Record the failure without claiming a release/test completed or undoing
    # existing user changes. Successful images remain resume-safe in the ledger.
    state_path=ROOT/'WORK_STATE.md';text=state_path.read_text()
    start='<!-- hansol-direct-upscale-status:start -->';end='<!-- hansol-direct-upscale-status:end -->'
    if text.count(start)==1 and text.count(end)==1:
        block=f'{start}\n### 필기 숨김 야간 작업 — 실패 지점 확인 필요\n\n- 정상 재캡처332화면·397쪽/26개 문제·풀이의 입력 준비는 끝났다. 무인 처리 중 실패해 완료로 기록하지 않는다. 기존 원본/이전 확대본·은행·정답·좌표는 보존하며 성공한 새 이미지는 ledger에서 재개한다.\n- 실제 오류: {error}\n- work/hansol-ink-hidden/night-status.json·night.log·upscale-progress.json·reader-restoration.json 참조. 전체 빌드/검사/배포 완료로 보고하지 않는다. Git 작업 없음.\n{end}'
        state_path.write_text(text[:text.index(start)]+block+text[text.index(end)+len(end):])
    raise
