"""Check a cloud review against the live bank and prepare a private follow-up queue."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOLD = {"근거 부족으로 보류", "정답 자체 확인 필요"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, mode="w", encoding="utf-8", delete=False) as tmp:
        json.dump(value, tmp, ensure_ascii=False, indent=2)
        tmp.write("\n")
    os.replace(tmp.name, path)


def run_json(*args):
    return json.loads(subprocess.check_output(args, cwd=ROOT))


def review_image(source, mappings, audit, archive, require_originals):
    relative = Path(source)
    if relative.parts[:1] != ("assets",) or ".." in relative.parts:
        raise ValueError(f"Invalid review image: {source}")
    mapped = mappings.get(source)
    original = ROOT / relative
    if not original.is_file():
        original = archive / relative
    if original.is_file():
        path, origin = original, "original"
        expected = audit[source]["sourceSha256"] if mapped else None
    elif mapped and not require_originals:
        path, origin = ROOT / mapped, "display"
        expected = audit[source]["sha256"]
    else:
        raise FileNotFoundError(f"Original unavailable: {source}")
    path = path.resolve(strict=True)
    if not any(path.is_relative_to((root / "assets").resolve()) for root in (ROOT, archive)):
        raise ValueError(f"Image is outside its assets directory: {source}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if expected and digest != expected:
        raise ValueError(f"Image hash mismatch ({origin}): {source}")
    return path, digest, origin


def prepare_ocr(queue, output, require_originals):
    mappings = load(ROOT / "data/problem-images-webp90.json")["mappings"]
    audit = load(ROOT / "data/problem-images-webp90-audit.json")["entries"]
    archive = Path(os.environ.get("CBT_ORIGINAL_ASSET_DIR", ROOT / "work/problem-webp90/originals"))
    images, sources = {}, {}
    for source in sorted({path for record in queue for path in record["images"]}):
        path, digest, origin = review_image(source, mappings, audit, archive, require_originals)
        sources[source] = {"sha256": digest, "input": origin}
        images[digest] = {"id": digest, "path": str(path)}
    dest = output / "ocr"
    manifest = output / "ocr-inputs.json"
    write_json(manifest, list(images.values()))
    subprocess.run(["swift", "tools/ocr-hansol-source-images.swift", manifest, dest], cwd=ROOT, check=True)
    line_counts = {}
    for digest in images:
        result = load(dest / (digest + ".json"))
        if result["sha256"] != digest or result["id"] != digest or not isinstance(result["rows"], list):
            raise ValueError(f"Incomplete OCR for {digest}")
        line_counts[digest] = len(result["rows"])
    for item in sources.values():
        item["lines"] = line_counts[item["sha256"]]
    return sources


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("review_dir", type=Path, nargs="?", default=ROOT / "docs/explanation-review/2026-11-18")
    args.add_argument("--ocr", action="store_true", help="Recognize held images locally using macOS Vision")
    args.add_argument("--require-originals", action="store_true", help="Require original image bytes for OCR")
    options = args.parse_args()
    if options.require_originals and not options.ocr:
        args.error("--require-originals requires --ocr")
    directory = options.review_dir.resolve()
    review = load(directory / "review.json")
    audit = run_json("node", "tools/validate-explanation-review.mjs", directory)
    with tempfile.TemporaryDirectory() as tmp:
        current = Path(tmp) / "inventory.json"
        run_json("node", "tools/explanation-review-inventory.mjs", current, directory / "review.json")
        inventory = load(current)
        if inventory != load(directory / "inventory.json"):
            raise ValueError("The submitted inventory differs from the current bank")
    queue = []
    for record in review["records"]:
        if record["status"] not in HOLD:
            continue
        images = [record.get("questionImage"), *record.get("explanationImages", [])]
        images.extend(asset["original"] for asset in record.get("sourceAssets", []))
        queue.append({
            "id": record["id"],
            "status": record["status"],
            "location": record["location"],
            "finding": record.get("finding"),
            "evidence": record.get("evidence"),
            "storedAnswer": record.get("answerBefore"),
            "images": list(dict.fromkeys(path for path in images if path)),
        })
    confirmation = directory / "answer-confirmation.md"
    if inventory.get("scope", {}).get("answerNeedsConfirmation") and not confirmation.is_file():
        raise FileNotFoundError(f"Missing current-scope answer confirmation list: {confirmation}")
    if confirmation.exists():
        content = confirmation.read_text(encoding="utf-8")
        id_pattern = r"^- `([^`]+)`"
        listed = re.findall(id_pattern, content, re.MULTILINE)
        expected = sorted(row["id"] for row in queue if row["status"] == "정답 자체 확인 필요")
        if sorted(listed) != expected:
            raise ValueError("Answer confirmation list differs from the review records")
        if "scope" in inventory:
            section = re.search(r"^## 현재 검토 범위[^\n]*\n(.*?)(?=^## |\Z)", content, re.MULTILINE | re.DOTALL)
            if not section or sorted(re.findall(id_pattern, section[1], re.MULTILINE)) != sorted(inventory["scope"]["answerNeedsConfirmation"]):
                raise ValueError("Current-scope answer confirmation list differs from the inventory")
    output = ROOT / "work/explanation-intake" / directory.name
    output.mkdir(parents=True, exist_ok=True)
    ocr = prepare_ocr(queue, output, options.require_originals) if options.ocr else None
    image_count = len(ocr) if ocr is not None else None
    report = {
        "counts": review["counts"],
        "scope": inventory.get("scope"),
        "bankQuestions": audit["bankQuestions"],
        "dynamicLinksValidated": audit["dynamicLinksValidated"],
        "ocrImages": image_count,
        "ocrBySource": ocr,
        "noRecognizedText": [path for path, row in ocr.items() if row["lines"] == 0] if ocr is not None else None,
        "followUp": queue,
    }
    write_json(output / "report.json", report)
    print(f"{audit['bankQuestions']} questions validated; {len(queue)} held; OCR images: {image_count}.")
    print(output / "report.json")


if __name__ == "__main__":
    main()
