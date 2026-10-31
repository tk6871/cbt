"""Extract the supplied PDF's worked example without inventing MCQ choices."""
import argparse,hashlib,json,subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT/'work/energy-theory-examples'
p=argparse.ArgumentParser();p.add_argument('pdf');args=p.parse_args()
pdf=Path(args.pdf)
assert hashlib.sha256(pdf.read_bytes()).hexdigest()=='840565d198cbbfe871b25a08e2bcb9b2d3dbdcbbadead2b2ca031308caed767d'
WORK.mkdir(parents=True,exist_ok=True);(WORK/'original').mkdir(exist_ok=True)
parts=[];row={'key':'theory-88-toe'}
for page,kind,box in [(77,'question',[.19,.836,.95,.927]),(78,'explanation',[.135,.055,.72,.212])]:
 image=WORK/f'{page}.png'
 if not image.exists():subprocess.run(['pdftoppm','-f',str(page),'-l',str(page),'-singlefile','-scale-to','2200','-png',str(pdf),str(image.with_suffix(''))],check=True)
 with Image.open(image) as source:
  bounds=[round(n*(source.width if i%2==0 else source.height)) for i,n in enumerate(box)]
  cropped=source.convert('RGB').crop(bounds);cropped.save(WORK/'original'/f"{row['key']}-{kind}.png")
  row[kind+'Size']=list(cropped.size);parts.append({'pdfPage':page,'printedPage':page+11,'kind':kind,'bounds':bounds,'sourceSize':list(source.size)})
row['parts']=parts
(WORK/'manifest.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'rows':[row],'errors':[]},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(row))
