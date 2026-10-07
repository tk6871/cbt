#!/usr/bin/env python3
"""Native Mac 4x anime model -> 2x bicubic; retain source crops locally."""
import json, subprocess, tempfile, shutil, sys
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/practical-verification/energy-midterm-pdf'
ENGINE=ROOT/'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
DEST=ROOT/'assets/energy-midterm/questions'

def main():
    manifest=json.loads((WORK/'manifest.json').read_text())
    manual_only='--manual-only' in sys.argv
    targets=[r for r in manifest if r.get('manualReview')] if manual_only else manifest
    output=WORK/'upscaled-4x';output.mkdir(exist_ok=True)
    DEST.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cbt-energy-crops-') as subset:
        for row in targets:shutil.copy2(WORK/'original'/f"{row['key']}.png",Path(subset)/f"{row['key']}.png")
        subprocess.run(['arch','-arm64',str(ENGINE),'-i',subset,'-o',str(output),
                        '-n','realesrgan-x4plus-anime','-s','4','-t','256','-f','png'],cwd=ENGINE.parent,check=True)
    previous=json.loads((WORK/'upscale-ledger.json').read_text()) if manual_only else []
    ledger={r['key']:r for r in previous}
    for row in targets:
        key=row['key']; expected=tuple(n*2 for n in row['size'])
        with Image.open(output/f'{key}.png') as im:
            if im.size!=tuple(n*4 for n in row['size']): raise ValueError(f'{key}: wrong model size')
            result=im.convert('RGB').resize(expected,Image.Resampling.BICUBIC)
            result.save(DEST/f'{key}.webp','WEBP',lossless=True,method=6)
        ledger[key]={'key':key,'sourceSize':row['size'],'outputSize':expected,
                     'asset':f'assets/energy-midterm/questions/{key}.webp'}
        print(f'{key}: {expected}',flush=True)
    (WORK/'upscale-ledger.json').write_text(json.dumps([ledger[r['key']] for r in manifest],ensure_ascii=False,indent=2))
    print(f'COMPLETE {len(targets)} images this run / {len(ledger)} total; source crops and 4x outputs retained.',flush=True)

if __name__=='__main__':main()
