#!/usr/bin/env python3
"""Fetch public Korean captions only, for bounded original-source review."""
from concurrent.futures import ThreadPoolExecutor
import json, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=Path('/private/tmp/cbt-practical-review-captions'); out.mkdir(exist_ok=True)
sources=json.loads((root/'data/hvac-practical-public-video-sources.json').read_text())['sources']
def run(source):
    name=f"{source['year']}-{source['session']}"
    result=subprocess.run([sys.executable,'-m','yt_dlp','--quiet','--no-warnings','--js-runtimes',
        'node:/usr/local/bin/node','--skip-download','--write-auto-subs','--sub-langs','ko',
        '--sub-format','vtt','-o',str(out/name),source['url']],capture_output=True,timeout=120)
    return name, result.returncode, (out/f'{name}.ko.vtt').exists()
with ThreadPoolExecutor(max_workers=3) as pool:
    for name,code,exists in pool.map(run,sources): print(name,code,'ready' if exists else 'unavailable',flush=True)
