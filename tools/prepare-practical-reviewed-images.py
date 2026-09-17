"""Reproduce reviewed crops from original video pixels; never overwrite originals.

Prepare into --output, inspect every candidate, then use --apply-assets.
Data references are deliberately not edited by this tool.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('frames', ROOT / 'tools/apply-hvac-practical-video-frame-repairs.py')
frames = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frames)
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--frame-cache', type=Path)
parser.add_argument('--apply-assets', action='store_true')
parser.add_argument('--indices', type=int, nargs='+', help='Prepare only these audit indices')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT / 'data/hvac-practical-image-repairs-v514.json').read_text())
if args.indices:
    missing = set(args.indices) - {item['index'] for item in manifest}
    if missing:
        raise ValueError(f'Unknown indices: {sorted(missing)}')
    manifest = [item for item in manifest if item['index'] in args.indices]
results = []
for item in manifest:
    source = ROOT / item['source']
    if item['timestamp'] is not None:
        cached = [] if not args.frame_cache else [
            args.frame_cache / f"{item['index']:03}-{item['timestamp']}s.png",
            args.frame_cache / 'nearby' / f"{item['round']}-{item['timestamp']}-{item['timestamp']}s.png",
        ]
        source = next((p for p in cached if p.is_file()), args.output / f"frame-{item['round']}-{item['timestamp']}.png")
        if not source.exists():
            video = frames.find_video(frames.DEFAULT_VIDEO_ROOT, item['round'])
            frames.extract_frame(video, item['timestamp'], source)
    with Image.open(source) as image:
        x1, y1, x2, y2 = item['crop']
        if not (0 <= x1 < x2 <= image.width and 0 <= y1 < y2 <= image.height):
            raise ValueError(f"Out-of-bounds crop: {item['index']}")
        crop = image.convert('RGB').crop((x1, y1, x2, y2))
        candidate = args.output / Path(item['target']).name
        crop.save(candidate, optimize=True)
        result = {**item, 'candidate': str(candidate), 'size': list(crop.size),
                  'sha256': hashlib.sha256(candidate.read_bytes()).hexdigest()}
    if args.apply_assets:
        target = (ROOT / item['target']).resolve()
        if not target.is_relative_to(ROOT / 'assets/hvac-practical/restored') or target == (ROOT / item['source']).resolve():
            raise ValueError('Unsafe asset target')
        content = candidate.read_bytes()
        if target.exists() and target.read_bytes() != content:
            raise ValueError(f'Refusing to overwrite existing asset: {target}')
        if not target.exists():
            with target.open('xb') as output:
                output.write(content)
    results.append(result)
    print(item['index'], result['size'], flush=True)
(args.output / 'reviewed-candidates.json').write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n')
print(f'{len(results)} crops prepared. Original assets and question data unchanged.')
