#!/usr/bin/env python3
"""Prepare missing-media/sequence candidates; never apply automatic judgments."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/private/tmp/cbt-practical-remaining-review')

def main():
    WORK.mkdir(parents=True, exist_ok=True)
    rows = json.loads((ROOT/'data/hvac-practical-restored.json').read_text())
    audit = json.loads((ROOT/'docs/hvac-practical-missing-visuals-2026-10-06.json').read_text())
    wanted = {r['id'] for r in audit['imageDependentWithoutMedia']}
    wanted.update(r['id'] for r in audit['choiceOnlyAnswers'] if r['id'].split('-')[3] <= '2020')
    wanted.update(r['id'] for r in rows if r['year'] <= 2020 and r['number'] <= 2)
    extra = '--extra' in sys.argv
    jobs = [r for r in rows if r['year'] <= 2020 and r['id'] not in wanted] if extra else [r for r in rows if r['id'] in wanted]
    if extra:
        expected = {'2018-3-10','2019-1-11','2019-2-06','2019-3-07','2020-1-10','2020-2B-06'}
        if {r['id'].replace('hvac-practical-restored-','') for r in jobs} != expected:
            raise ValueError('The six-question extra batch changed; review scope before running')
    if '--dry-run' in sys.argv:
        print(json.dumps({'questions':[r['id'] for r in jobs], 'maximumSecondsPerClip':18,'maximumConcurrentClips':3},indent=2))
        return
    status_file = WORK/('batch-status-extra.json' if extra else 'batch-status.json')
    state = {'total': len(jobs), 'completed': 0, 'results': [], 'note': 'Frames only. No content has been applied or visually verified.'}
    def save():
        state['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S%z')
        status_file.write_text(json.dumps(state, ensure_ascii=False, indent=2)+'\n')
    def prepare(row):
        directory = WORK/f"{row['year']}-{row['session']}-q{row['number']:02d}"
        command = [sys.executable, str(ROOT/'tools/prepare-practical-public-frames.py'),
                   '--year', str(row['year']), '--session', row['session'], '--numbers', str(row['number']),
                   '--node', '/usr/local/bin/node', '--work-dir', str(directory)]
        proc = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=420)
        status = directory/'status.json'
        result = {'id':row['id'], 'exitCode':proc.returncode}
        if status.exists():
            result.update(json.loads(status.read_text())['results'][0])
        else:
            result['status'] = 'extract-failed'
        return result
    save()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(prepare,r):r for r in jobs}
        for future in concurrent.futures.as_completed(futures):
            row = futures[future]
            try:
                result = future.result()
            except Exception as error:
                result = {'id':row['id'], 'status':'extract-failed', 'errorType':type(error).__name__}
            state['results'].append(result)
            state['completed'] += 1
            save()
            print(f"{state['completed']}/{state['total']} {result['id']} {result['status']}", flush=True)
    print(f'Human review manifest: {status_file}', flush=True)

if __name__ == '__main__':
    main()
