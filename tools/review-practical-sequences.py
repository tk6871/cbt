#!/usr/bin/env python3
"""Create labeled contact sheets from current assets for visual review only."""
from pathlib import Path
import json
import re
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/private/tmp/cbt-practical-sequence-review')
OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype(str(ROOT/'assets/fonts/NanumGothic-Regular.ttf'), 17)
rows = json.loads((ROOT/'data/hvac-practical-restored.json').read_text())
letters = '--letters' in sys.argv
items = [(r, role, path) for r in rows if (bool(re.fullmatch(r'\s*\(?[가나다라ABCD1-4]\)?(?:번)?\s*', r['answer'])) if letters else r['year'] >= 2021 and any(w in r['question'] for w in ['회로', '접점', '시퀀스']))
         for role, paths in [('question',r.get('images',[])),('answer',r.get('answerImages',[]))] for path in paths]
for start in range(0, len(items), 6):
    sheet = Image.new('RGB',(1800,1200),'#e5e9ed')
    draw = ImageDraw.Draw(sheet)
    for i,(row,role,path) in enumerate(items[start:start+6]):
        x,y = (i%3)*600,(i//3)*600
        with Image.open(ROOT/path) as source:
            im = source.convert('RGB'); im.thumbnail((590,550))
            sheet.paste(im,(x+(600-im.width)//2,y+44+(550-im.height)//2))
        draw.text((x+8,y+8),row['id'].replace('hvac-practical-restored-','')+' '+role,fill='#121a22',font=font)
    sheet.save(OUT/f'{"letters" if letters else "sequence"}-{start//6+1:02}.jpg',quality=94)
print(f'{len(items)} references; {(len(items)+5)//6} sheets; not an automated correctness judgment')
