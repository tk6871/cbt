"""Local-only source review sheets. No PDF/OCR content is published."""
import argparse
import concurrent.futures
import json
import hashlib
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("pdf")
args = parser.parse_args()
root = Path("work/energy-book-scope")
with open(args.pdf, "rb") as source:
    source_hash = hashlib.file_digest(source, "sha256").hexdigest()
manifest = json.loads((root / "ocr" / "_source.json").read_text())
if source_hash != manifest["sha256"]:
    raise ValueError("Source PDF differs from the OCR cache. Use separate work folders.")
rows = json.loads((root / "candidates.json").read_text())["rows"]
pages = root / "pages"
sheets = root / "sheets"
pages.mkdir(exist_ok=True)
sheets.mkdir(exist_ok=True)

def render(number):
    destination = pages / f"{number}.png"
    if not destination.exists():
        subprocess.run(["pdftoppm", "-f", str(number), "-l", str(number),
                        "-scale-to", "2200", "-singlefile", "-png", args.pdf,
                        str(destination.with_suffix(""))], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return number

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for number in pool.map(render, sorted({r["candidates"][0]["page"] for r in rows})):
        print(f"Rendered {number}", flush=True)

for offset in range(0, len(rows), 4):
    sheet = Image.new("RGB", (1800, 2200), "#e7edf3")
    draw = ImageDraw.Draw(sheet)
    for local, item in enumerate(rows[offset:offset+4]):
        c = item["candidates"][0]
        image = Image.open(pages / f'{c["page"]}.png').convert("RGB")
        width, height = image.size
        boxes = c["boxes"]
        # Include the entire selected column and context around the search window.
        x0 = .025 if c["side"] == 0 else .47
        x1 = .53 if c["side"] == 0 else .985
        y0 = max(0, min(1-b[1]-b[3] for b in boxes)-.025)
        y1 = min(1, max(1-b[1] for b in boxes)+.07)
        crop = image.crop((int(width*x0), int(height*y0), int(width*x1), int(height*y1)))
        crop.thumbnail((880, 1020))
        x, y = (local % 2)*900, (local // 2)*1100
        draw.text((x+10, y+8), f'ROW {offset+local} | PDF {c["page"]} | {item["id"].split("industrial-")[-1]}', fill="black")
        sheet.paste(crop, (x+10, y+35))
    destination = sheets / f"sheet-{offset//4+1:02}.jpg"
    sheet.save(destination, quality=93)
    print(destination, flush=True)
