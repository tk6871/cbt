"""Separate the unlabelled halves of user PDF images; preserve embedded originals."""
from pathlib import Path
from PIL import Image

base = Path(__file__).resolve().parents[1] / 'assets/hvac-practical/photo-20260917'
# Coordinates reviewed against full-resolution source photographs.
for number, bounds in [(82, (0, 0, 1860, 1360)), (88, (0, 0, 1730, 1074))]:
    source = base / f'{number:03}-1.jpg'
    target = base / f'{number:03}-question.png'
    image = Image.open(source).crop(bounds)
    if target.exists():
        with Image.open(target) as existing:
            assert existing.size == image.size and existing.tobytes() == image.tobytes()
    else:
        image.save(target, optimize=True)
    print(number, image.size)
