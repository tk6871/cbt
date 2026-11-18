"""Build local review sheets and a linked-source index without changing the bank."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def read_rounds(name):
    source = (ROOT / "data" / (name + ".js")).read_text(encoding="utf-8")
    return json.loads(source.split("=", 1)[1].strip().removesuffix(";"))["rounds"]


def make_tile(row, mapping):
    parts = []
    for original in [row["sourceImage"], *row["explanationImages"]]:
        with Image.open(ROOT / mapping.get(original, original)) as image:
            part = image.convert("RGB")
            part.thumbnail((510, part.height))
            parts.append(part)
    tile = Image.new("RGB", (520, 22 + sum(part.height for part in parts)), "white")
    source_id = f'{row["_originRoundId"]}:{row["_originalNumber"]}'
    label = f'{row["number"]}   {source_id}   key {row["answer"]}'
    ImageDraw.Draw(tile).text((4, 2), label, fill="black")
    y = 22
    for part in parts:
        tile.paste(part, (4, y))
        y += part.height
    return tile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("topics", nargs="+", type=int, help="Printed topic numbers")
    args = parser.parse_args()
    books = {int(r["id"].rsplit("-", 1)[1]): r for r in read_rounds("energy-textbook")}
    for topic in args.topics:
        if topic not in books:
            parser.error(f"Unknown topic {topic}")
    args.output.mkdir(parents=True, exist_ok=True)
    mapping = read_json("data/problem-images-webp90.json")["mappings"]
    links = read_json("data/energy-textbook-comcbt-links.json")["links"]
    reviewed = read_json("docs/explanation-review/2026-11-18/review.json")
    status = {r["id"]: r["status"] for r in reviewed["records"]}
    regular = {f'{r["id"]}:{q["number"]}': q for r in read_rounds("energy") for q in r["questions"]}
    rows, linked_sources = [], {}
    for topic in dict.fromkeys(args.topics):
        questions = books[topic]["questions"]
        for start in range(0, len(questions), 3):
            batch = questions[start:start + 3]
            tiles = [make_tile(q, mapping) for q in batch]
            sheet = Image.new("RGB", (520 * len(tiles), max(t.height for t in tiles)), "white")
            filename = f"topic-{topic}-{start + 1}.png"
            for index, (q, tile) in enumerate(zip(batch, tiles)):
                sheet.paste(tile, (520 * index, 0))
                qid = f'{q["_originRoundId"]}:{q["_originalNumber"]}'
                sid = links.get(qid, {}).get("sourceId")
                rows.append(dict(id=qid, topic=topic, position=q["number"], page=q["sourcePage"],
                                 sheet=filename, answer=q["answer"], status=status.get(qid),
                                 original=q["sourceImage"], explanations=q["explanationImages"], sourceId=sid))
                if sid and sid not in linked_sources:
                    linked_sources[sid] = regular[sid]
            sheet.save(args.output / filename)
    (args.output / "index.json").write_text(json.dumps(dict(rows=rows, linkedSources=linked_sources),
                                                       ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
