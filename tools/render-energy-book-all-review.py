"""Private contact sheets for direct question-to-book review. Not published."""
import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("pdf")
args = parser.parse_args()
root = Path("work/energy-book-scope")
report = json.loads(Path("docs/energy-midterm-book-scope-2026-10-12.json").read_text())
with open(args.pdf, "rb") as stream:
    assert hashlib.file_digest(stream, "sha256").hexdigest() == report["source"]["sha256"]
comparisons = json.loads((root / "all-comparisons.json").read_text())["rows"]
units = json.loads((root / "question-units.json").read_text())["rows"]
plan = []
for index, q in enumerate(report["rows"]):
    evidence = q["evidence"][0]
    page = evidence["pdfPage"]
    number = evidence.get("bookQuestionNumber") or evidence.get("number")
    p = json.loads((root / "ocr" / f"page-{page}.json").read_text())
    selected = None
    if number:
        for side in (0, 1):
            rows = sorted([r for r in p["rows"] if (r["box"][0] >= .48) == bool(side)],
                          key=lambda r: -r["box"][1]-r["box"][3])
            starts = [i for i, r in enumerate(rows) if re.match(rf"^0?{number}(?!\d)[ .]*[가-힣A-Za-z(Δ△0-9]", r["text"]) and len(r["text"]) >= 12]
            if starts:
                start = starts[0]
                end = next((i for i in range(start+1, len(rows)) if re.match(rf"^0?{number+1}(?!\d)[ .]*[가-힣A-Za-z(Δ△0-9]", rows[i]["text"]) and len(rows[i]["text"]) >= 12), len(rows))
                selected = {"page": page, "side": side, "boxes": [r["box"] for r in rows[start:end]], "text": "\n".join(r["text"] for r in rows[start:end])}
                break
    if selected is None:
        selected = next(c for c in comparisons[index]["evidence"] if c["page"] == page)
    plan.append({"index": index, "id": q["id"], "status": q["status"], "confirmed": q["confirmed"], "number": number, **selected})
    if not q["confirmed"]:
        # A separately segmented question candidate supplements the recorded
        # comparison. It is not automatically accepted as inclusion evidence.
        candidate = next((c for c in units[index]["candidates"] if c["page"] != page), None)
        if candidate:
            plan.append({"index": index, "id": q["id"], "status": "alternative", "confirmed": False, **candidate})

pages = root / "pages"
sheets = root / "all-sheets"
pages.mkdir(exist_ok=True)
sheets.mkdir(exist_ok=True)
def render(page):
    destination = pages / f"{page}.png"
    if not destination.exists():
        subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-scale-to", "2200", "-singlefile", "-png", args.pdf, str(destination.with_suffix(""))], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return page
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for page in pool.map(render, sorted({c["page"] for c in plan})):
        print(f"page {page}", flush=True)
for group, entries in (("confirmed", [c for c in plan if c["confirmed"]]), ("pending", [c for c in plan if not c["confirmed"]])):
    for offset in range(0, len(entries), 4):
        sheet = Image.new("RGB", (1800, 2200), "#e7edf3")
        draw = ImageDraw.Draw(sheet)
        for local, c in enumerate(entries[offset:offset+4]):
            img = Image.open(pages / f'{c["page"]}.png').convert("RGB")
            w, h = img.size
            x0, x1 = (.025, .53) if c["side"] == 0 else (.47, .985)
            y0 = max(0, min(1-b[1]-b[3] for b in c["boxes"])-.015)
            y1 = min(1, max(1-b[1] for b in c["boxes"])+.035)
            crop = img.crop((round(w*x0), round(h*y0), round(w*x1), round(h*y1)))
            crop.thumbnail((880, 1035))
            x, y = (local % 2)*900, (local // 2)*1100
            draw.text((x+10,y+8), f'INDEX {c["index"]} | PDF {c["page"]} Q{c.get("number")} | {c["status"]}', fill="black")
            sheet.paste(crop, (x+10,y+35))
        destination = sheets / f"{group}-{offset//4+1:02}.jpg"
        sheet.save(destination, quality=94)
        print(destination, flush=True)
(root / "all-visual-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2)+"\n")
