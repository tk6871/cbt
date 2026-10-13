"""Verify display derivatives against the retained originals, without OCR."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parent.parent
manifest = json.loads((ROOT / 'data/responsive-images.json').read_text())
groups = {}
for asset, entry in manifest.items():
    with Image.open(ROOT / asset) as raw:
        source = ImageOps.exif_transpose(raw)
        source = source.convert('RGBA' if 'A' in source.getbands() or 'transparency' in source.info else 'RGB')
        assert list(source.size) == [entry['width'], entry['height']], asset
        for variant in entry['variants']:
            size = (variant['width'], round(source.height * variant['width'] / source.width))
            expected = source.resize(size, Image.Resampling.LANCZOS)
            with Image.open(ROOT / variant['src']) as output:
                assert output.size == size, variant['src']
                # Compare displayed pixels including alpha, ignoring invisible RGB.
                a, b = expected.convert('RGBA'), output.convert('RGBA')
                assert ImageChops.difference(a.getchannel('A'), b.getchannel('A')).getbbox() is None
                for background in ['white', 'black']:
                    canvas_a = Image.new('RGBA', size, background)
                    canvas_b = canvas_a.copy()
                    canvas_a.alpha_composite(a)
                    canvas_b.alpha_composite(b)
                    assert ImageChops.difference(canvas_a.convert('RGB'), canvas_b.convert('RGB')).getbbox() is None, variant['src']
            original_bytes = (ROOT / asset).stat().st_size
            output_bytes = (ROOT / variant['src']).stat().st_size
            assert output_bytes < original_bytes * .7
            key = ('theme' if '/theme/' in asset else 'textbook') + '-' + str(variant['width'])
            row = groups.setdefault(key, {'count': 0, 'originalBytes': 0, 'displayBytes': 0})
            row['count'] += 1
            row['originalBytes'] += original_bytes
            row['displayBytes'] += output_bytes
for row in groups.values():
    row['reductionPercent'] = round((1 - row['displayBytes'] / row['originalBytes']) * 100, 1)
print(json.dumps(groups, indent=2))
