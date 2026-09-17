"""Create indexed visual review sheets from the complete generated inventory."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1])
entries = json.loads((output / 'inventory.json').read_text())
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
for start in range(0, len(entries), 6):
    subset = entries[start:start+6]
    sheet = Image.new('RGB', (2400, 1260), '#dce3ea')
    draw = ImageDraw.Draw(sheet)
    for i, entry in enumerate(subset):
        image = Image.open(entry.get('render') or root / entry['source']).convert('RGB')
        entry['size'] = list(image.size)
        image.thumbnail((780, 530))
        x, y = (i % 3) * 800, (i // 3) * 630
        name = entry['id'].replace('hvac-practical-restored-', '').replace('moducbt-hvac-practical-', 'public-')
        draw.text((x+12,y+12), f"{entry['index']:03} {name} {entry['role']} {entry['size']}", fill='black', font=font)
        sheet.paste(image, (x+10+(780-image.width)//2,y+60))
    sheet.save(output / f"sheet-{start//6+1:02}.jpg", quality=97)
(output / 'inventory.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
print(f'{len(entries)} references in {(len(entries)+5)//6} sheets')
