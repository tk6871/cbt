#!/usr/bin/env python3
"""Enhance a preserved scan crop with the established Apple Silicon pipeline."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--manifest', type=Path, required=True)
args = parser.parse_args()
if args.source.resolve() in {args.output.resolve(), args.manifest.resolve()}:
    raise ValueError('Source must be preserved separately from output and manifest')
engine = root / 'tools/realesrgan/realesrgan-ncnn-vulkan-20220424-macos/realesrgan-ncnn-vulkan'
with Image.open(args.source) as original:
    size = original.size
with tempfile.TemporaryDirectory(prefix='cbt-practical-enhance-') as directory:
    intermediate = Path(directory) / '4x.png'
    subprocess.run(['arch', '-arm64', str(engine), '-i', str(args.source.resolve()),
                    '-o', str(intermediate), '-n', 'realesrgan-x4plus-anime',
                    '-s', '4', '-t', '256', '-f', 'png'], cwd=engine.parent, check=True)
    with Image.open(intermediate) as result:
        if result.size != (size[0] * 4, size[1] * 4):
            raise ValueError('Unexpected model dimensions')
        reduced = result.convert('RGB').resize((size[0] * 2, size[1] * 2), Image.Resampling.BICUBIC)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        reduced.save(args.output, 'PNG', optimize=True)
record = dict(source=args.source.as_posix(), output=args.output.as_posix(),
              sourceSize=list(size), outputSize=list(reduced.size),
              sourceSha256=hashlib.sha256(args.source.read_bytes()).hexdigest(),
              outputSha256=hashlib.sha256(args.output.read_bytes()).hexdigest(),
              model='realesrgan-x4plus-anime', tile=256,
              pipeline='4x-model-to-2x-bicubic', architecture='arm64',
              note='Original preserved. Enhancement does not establish unreadable label text.')
args.manifest.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(record))
