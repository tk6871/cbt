"""Rebuild with fonttools[woff]. The full original face supplies rare syllables."""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / "assets" / "fonts"
font = TTFont(fonts / "NanumGothic-Regular.ttf", recalcTimestamp=False)
# KS X 1001 common Hangul syllables, plus all original punctuation and symbols.
common = {ord(bytes([lead, trail]).decode("euc_kr"))
          for lead in range(0xB0, 0xC9) for trail in range(0xA1, 0xFF)}
common.update(code for code in font.getBestCmap() if not 0xAC00 <= code <= 0xD7A3)

options = subset.Options()
options.name_IDs = ["*"]
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=common)
subsetter.subset(font)

# Use a distinct derivative name under the bundled SIL Open Font License.
names = {1: "CBT Study Sans", 3: "CBTStudySans-Regular-v1", 4: "CBT Study Sans Regular",
         6: "CBTStudySans-Regular", 16: "CBT Study Sans", 20: "CBTStudySans-Regular"}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.flavor = "woff2"
font.save(fonts / "CBTStudySans-Regular.woff2")
