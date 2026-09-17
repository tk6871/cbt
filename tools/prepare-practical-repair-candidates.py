"""Read-only source-video inspection. Outputs only into the requested work folder."""
import argparse
import importlib.util
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('frames', ROOT / 'tools/apply-hvac-practical-video-frame-repairs.py')
frames = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frames)

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--samples', type=Path, help='Optional round to timestamp-list JSON for nearby source review')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
audit = json.loads((ROOT / 'docs/hvac-practical-full-image-audit-2026-09-15.json').read_text())['entries']
timings = json.loads((ROOT / 'data/hvac-practical-video-frame-repairs.json').read_text())
by_source = {r['image']: r for r in timings}
targets = [r for r in audit if r['status'] == 'repair' and r['source'] in by_source]
if args.samples:
    targets = [dict(index=f'{key}-{time}', id=key, role='sample', round=key, timestamp=time)
               for key, times in json.loads(args.samples.read_text()).items() for time in times]
videos = {}
for target in targets:
    source = target if args.samples else by_source[target['source']]
    key = source['round']
    if key not in videos:
        videos[key] = frames.find_video(frames.DEFAULT_VIDEO_ROOT, key)
    output = args.output / f"{str(target['index']).zfill(3)}-{source['timestamp']}s.png"
    if not output.exists():
        frames.extract_frame(videos[key], source['timestamp'], output)
    target['candidate'] = str(output)
    target['timestamp'] = source['timestamp']
    print(target['index'], target['id'], source['timestamp'], flush=True)
for start in range(0, len(targets), 4):
    sheet = Image.new('RGB', (1920, 1180), '#e3e8ef')
    draw = ImageDraw.Draw(sheet)
    for i, target in enumerate(targets[start:start+4]):
        x, y = i % 2 * 960, i // 2 * 590
        image = Image.open(target['candidate']).convert('RGB')
        image.thumbnail((950, 535))
        label = f"#{target['index']} {target['id'].replace('hvac-practical-restored-', '')} {target['role']} {target['timestamp']}s"
        draw.text((x+8, y+8), label, font=frames.qa_font(23), fill='black')
        sheet.paste(image, (x, y+45))
    sheet.save(args.output / f'full-frame-sheet-{start//4+1:02}.jpg', quality=96)
(args.output / 'candidates.json').write_text(json.dumps(targets, ensure_ascii=False, indent=2)+'\n')
print(f'{len(targets)} source frames inspected; production assets unchanged')
