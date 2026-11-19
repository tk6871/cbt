"""Wait for the current, resumable GPU job, then verify and build locally.

Never commits or pushes. A stopped/partial worker is not a completed build.
"""
import argparse, fcntl, json, subprocess, sys, time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--wait', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
work = root / 'work/textbook-completeness/upscale'
def state(stage, **details):
    tmp = work / 'finish.pending'
    tmp.write_text(json.dumps(dict(stage=stage, **details), ensure_ascii=False, indent=2)+'\n')
    tmp.replace(work / 'finish.json')

keeper = (work / 'finish.lock').open('a')
fcntl.flock(keeper, fcntl.LOCK_EX | fcntl.LOCK_NB)
try:
    head = subprocess.check_output(['git','rev-parse','HEAD'], cwd=root).strip()
    state('waiting-for-conversion')
    with (work / 'runner.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_SH | (0 if args.wait else fcntl.LOCK_NB))
        status = json.loads((work/'progress.json').read_text())
        assert status['status']=='complete' and status['remaining']==0, status
        assert head==subprocess.check_output(['git','rev-parse','HEAD'], cwd=root).strip(), 'Checkout changed; review before building.'
        tasks = [
            ('images',[sys.executable,'tools/audit-textbook-image-quality.py']),
            ('bindings',['node','tools/audit-textbook-completeness.mjs','--check']),
            ('keys',['node','tools/publish-textbook-key-review.mjs','--check']),
            ('types',['npm','run','typecheck']), ('build',['npm','run','build']),
            ('pwa',['npm','run','test:pwa']),
            ('browser',['node_modules/.bin/playwright','test','tools/printed-book-targets.spec.ts','tools/textbook-direct-answers.spec.ts','tools/hansol-direct-upscale.spec.ts','--project=desktop']),
            ('diff',['git','diff','--check'])
        ]
        completed = []
        for name,command in tasks:
            state(name, passed=completed)
            with (work / ('finish-'+name+'.log')).open('w') as out:
                subprocess.run(command, cwd=root, stdout=out, stderr=subprocess.STDOUT, check=True)
            completed.append(name)
        state('complete', passed=completed, finishedAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'))
except BaseException as exc:
    state('failed', error=str(exc)); raise
