"""Check existing textbook upscales against the WebP90 replacement index."""
import json
import hashlib
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
read = lambda path: json.loads((root / path).read_text())
index = read('data/problem-images-webp90.json')
proof = read('data/problem-images-webp90-audit.json')
assert proof['quality'] == 90
assert index['quality'] == 90
results = {}
for group, manifests in {
    'energy': ['data/energy-textbook-images.json', 'data/energy-restored-import-audit.json', 'data/energy-book-earlier-import-audit.json'],
    'hansol-native': ['data/hansol-book-native-audit.json'],
}.items():
    images = {}
    for manifest in manifests:
        for row in read(manifest)['images'].values():
            if row['asset'] in images:
                assert images[row['asset']]['outputSha256'] == row['outputSha256']
            images[row['asset']] = row
    total_bytes = 0
    for path, row in images.items():
        assert row['pipeline'] == '4x -> 2x bicubic', path
        assert row['outputSize'] == [v * 2 for v in row['sourceSize']], path
        assert path in index['mappings'], path
        target = root / index['mappings'][path]
        migrated = proof['entries'][path]
        assert migrated['sourceSha256'] == row['outputSha256'] and migrated['asset'] == index['mappings'][path], path
        assert hashlib.sha256(target.read_bytes()).hexdigest() == migrated['sha256'], path
        with Image.open(target) as image:
            assert image.format == 'WEBP' and list(image.size) == row['outputSize'], str(target)
            image.verify()
        total_bytes += target.stat().st_size
    results[group] = {'uniqueImages': len(images), 'verified2xWebP90': len(images), 'bytes': total_bytes}
out = root / 'work/textbook-completeness'
out.mkdir(parents=True, exist_ok=True)
(out / 'existing-image-quality.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2))
