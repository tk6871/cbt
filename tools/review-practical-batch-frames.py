#!/usr/bin/env python3
"""Assemble candidate frames without judging or changing data."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('/private/tmp/cbt-practical-remaining-review')
rows = json.loads((ROOT/'batch-status.json').read_text())['results']
if (ROOT/'batch-status-extra.json').exists():
    rows += json.loads((ROOT/'batch-status-extra.json').read_text())['results']
rows = sorted([r for r in rows if r['id'].startswith('hvac-practical-restored-'+sys.argv[1]+'-') and r.get('frames')],key=lambda r:r['number'])
for start in range(0,len(rows),4):
    sheet=Image.new('RGB',(1440,1200),'white'); draw=ImageDraw.Draw(sheet)
    for j,row in enumerate(rows[start:start+4]):
        for i,frame in enumerate(row['frames']):
            with Image.open(frame['path']) as original:
                im=original.convert('RGB'); im.thumbnail((480,270))
                sheet.paste(im,(i*480,j*300+30))
            draw.text((i*480+4,j*300+8),f"{row['id'].replace('hvac-practical-restored-','')} {frame['timestamp']}s {frame['size']}",fill='black')
    sheet.save(ROOT/f"{sys.argv[1]}-sheet-{start//4+1}.jpg",quality=94)
print(len(rows))
