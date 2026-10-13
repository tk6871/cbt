"""Build optional display derivatives; source files are never modified.

Question/answer derivatives use lossless WebP after proportional LANCZOS resizing.
Original URLs remain the largest srcset candidate and the zoom source.
"""
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/responsive'
OUT.mkdir(exist_ok=True)
STAGING = ROOT / 'work/responsive-images-unused'
STAGING.mkdir(parents=True, exist_ok=True)
ledger = json.loads((ROOT / 'data/energy-textbook-images.json').read_text())['images']
paths = {row['asset'] for row in ledger.values()}
paths.update(str(p.relative_to(ROOT)) for p in (ROOT / 'assets/theme').rglob('*')
             if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'})
manifest = {}
original_bytes = variant_bytes = 0
for asset in sorted(paths):
    source = ROOT / asset
    digest = hashlib.sha256(b'responsive-v2' + source.read_bytes()).hexdigest()[:16]
    with Image.open(source) as raw:
        if getattr(raw, 'is_animated', False):
            continue
        oriented = ImageOps.exif_transpose(raw)
        image = oriented.convert('RGBA' if 'A' in oriented.getbands() or 'transparency' in oriented.info else 'RGB')
        width, height = image.size
        candidates = []
        for size in ([192, 640] if asset.startswith('assets/theme/') else [768]):
            if size >= width:
                continue
            target = OUT / f'{digest}-{size}.webp'
            if not target.exists():
                image.resize((size, round(height * size / width)), Image.Resampling.LANCZOS).save(
                    target, format='WEBP', lossless=True, method=4)
            if target.stat().st_size >= source.stat().st_size * .7:
                continue
            candidates.append({'src': str(target.relative_to(ROOT)), 'width': size})
            variant_bytes += target.stat().st_size
        if candidates:
            manifest[asset] = {'width': width, 'height': height, 'variants': candidates}
            original_bytes += source.stat().st_size
(ROOT / 'data/responsive-images.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n')
used = {v['src'] for entry in manifest.values() for v in entry['variants']}
# Keep rejected derivatives out of the deployment, in ignored work/ for review.
for file in OUT.glob('*.webp'):
    if str(file.relative_to(ROOT)) not in used:
        shutil.move(str(file), str(STAGING / file.name))
print(json.dumps({'sources': len(manifest), 'originalBytes': original_bytes, 'derivativeBytes': variant_bytes}))
