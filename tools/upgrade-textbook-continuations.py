"""Enhance the two separate continuation crops without changing their coordinates."""
from pathlib import Path
import hashlib, json, subprocess, tempfile
from PIL import Image

root = Path(__file__).resolve().parents[1]
engine = root / 'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
dest = root / 'assets/hvac-hansol-book/direct-continuations/upscaled-2x'
dest.mkdir(parents=True, exist_ok=True)
rows = json.loads((root / 'data/hansol-book-direct-boundaries.json').read_text())['assets']
output = {}
for row in rows:
    source = root / row['asset']
    if not source.exists():
        source = root / 'work/problem-webp90/originals' / row['asset']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == row['sha256']
    with tempfile.TemporaryDirectory() as tmp:
        four = Path(tmp) / 'four.png'
        subprocess.run([str(engine), '-i', str(source), '-o', str(four), '-n', 'realesrgan-x4plus-anime', '-t', '256', '-s', '4'], cwd=engine.parent, check=True, stdout=subprocess.DEVNULL)
        target = dest / (source.stem + '.webp')
        with Image.open(four) as image:
            assert list(image.size) == [v * 4 for v in row['size']]
            image.convert('RGB').resize(tuple(v * 2 for v in row['size']), Image.Resampling.BICUBIC).save(target, 'WEBP', quality=90, method=6)
        output[row['asset']] = str(target.relative_to(root))
(root / 'data/textbook-continuation-images.json').write_text(json.dumps(output, indent=2) + '\n')
