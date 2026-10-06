#!/usr/bin/env python3
"""Reproducible, content-matched crops; source pages and old assets are preserved."""
import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageOps, ImageDraw

ORDER = {
    '2023-2': [4,6,10,2,None,8,9,3,5,7,11,1],
    '2024-1': [4,6,8,11,12,7,2,9,10,3,5,1],
    '2024-2': [4,6,12,9,5,8,10,11,3,7,1,2],
    '2024-3': [6,9,4,12,5,3,7,11,8,10,1,2],
    '2025-1': [12,11,9,10,5,8,4,6,3,7,1,2],
    '2025-2': [6,11,7,8,3,5,4,12,9,1,10,2],
    '2025-3': [6,10,5,7,12,9,4,11,8,3,2,1],
}
PAGES = {
    '2023-2': [1,1,2,3,3,4,4,5,5,6,6,7],
    '2024-1': [26,27,27,27,28,28,29,29,30,30,30,31],
    '2024-2': [33,33,34,34,34,35,35,36,36,36,37,38],
    '2024-3': [8,8,9,9,9,10,10,11,11,11,12,13],
    '2025-1': [14,14,14,15,15,15,16,16,16,17,17,18],
    '2025-2': [19,19,19,20,20,21,22,22,22,23,23,24],
    '2025-3': [56,56,58,58,59,59,59,60,60,61,61,62],
}
ROTATE = {2,4,6,9,11,13,17,19,21,23,25,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,59,61}
# Rectangles in the individually reviewed 1344x1848 preview, converted below
# to original EXIF-normalized 1700x2338 pixels. Answer regions are separate.
CROPS = [
 ('2023-2',4,1,[390,690,770,995]), ('2023-2',6,1,[635,1334,952,1690]),
 ('2023-2',10,2,[465,846,1165,1235]), ('2023-2',8,4,[540,212,1025,464]),
 ('2023-2',9,4,[295,810,1210,1370]), ('2023-2',3,5,[350,475,810,690]),
 ('2023-2',5,5,[475,978,720,1180]), ('2023-2',7,6,[385,180,1210,499]),
 ('2023-2',1,7,[245,500,1030,1155]),
 ('2024-1',7,28,[428,1190,680,1405]), ('2024-1',2,29,[335,897,630,1135],'answer'),
 ('2024-1',1,31,[300,1050,965,1685]),
 ('2024-2',2,38,[485,540,1155,912],'answer'), ('2024-2',8,35,[250,450,1040,815]),
 ('2024-3',9,8,[225,1062,976,1362]), ('2024-3',12,9,[958,383,1050,597]),
 ('2024-3',5,9,[403,882,1100,1049]), ('2024-3',3,10,[263,475,1000,680]),
 ('2024-3',11,11,[340,220,1170,482]), ('2024-3',8,11,[545,647,1090,807]),
 ('2024-3',10,11,[520,1100,1095,1379]), ('2024-3',1,12,[330,467,910,825]),
 ('2024-3',2,13,[445,241,1125,735]),
 ('2025-1',12,14,[245,690,1025,875]), ('2025-1',9,14,[480,1362,700,1610]),
 ('2025-1',10,15,[530,194,1045,452]), ('2025-1',5,15,[415,606,1135,790]),
 ('2025-1',8,15,[410,1045,1205,1292]), ('2025-1',6,16,[380,779,820,970]),
 ('2025-1',3,16,[165,1120,1030,1372]), ('2025-1',3,16,[338,1408,617,1510],'answer'),
 ('2025-1',7,17,[390,233,1095,475]), ('2025-1',1,17,[350,807,1195,1135]),
 ('2025-1',2,18,[300,455,950,815]),
 ('2025-2',11,19,[570,630,956,922]), ('2025-2',3,20,[395,960,750,1215]),
 ('2025-2',5,21,[410,205,1105,600]), ('2025-2',4,22,[260,466,984,726]),
 ('2025-2',9,22,[228,1275,1040,1510]), ('2025-2',1,23,[455,218,1120,745]),
 ('2025-2',10,23,[641,1243,872,1447]), ('2025-2',2,24,[325,727,940,1320]),
 ('2025-3',10,56,[395,791,1103,1170]), ('2025-3',7,58,[165,1205,1050,1450]),
 ('2025-3',5,58,[180,525,628,718]), ('2025-3',5,58,[330,796,710,1070],'answer'),
 ('2025-3',12,59,[409,214,1135,729]), ('2025-3',11,60,[325,471,855,658]),
 ('2025-3',8,60,[328,1040,840,1335]), ('2025-3',3,61,[420,210,660,465]),
 ('2025-3',2,61,[427,895,1145,1165]), ('2025-3',1,62,[411,468,780,812]),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--archive', type=Path, required=True)
    p.add_argument('--output-root', type=Path, default=Path('assets/hvac-practical/restored'))
    p.add_argument('--manifest', type=Path, default=Path('data/hvac-practical-october-scans.json'))
    p.add_argument('--contact-dir', type=Path)
    args = p.parse_args()
    scans, hashes = {}, {}
    with ZipFile(args.archive) as z:
        for info in z.infolist():
            if not info.filename.lower().endswith('.jpg'): continue
            name = Path(info.filename).name
            if name != info.filename or name in scans: raise ValueError('Unexpected archive name')
            raw = z.read(info)
            img = ImageOps.exif_transpose(Image.open(BytesIO(raw))).convert('RGB')
            index = int(name[4:8])
            if index in ROTATE: img = img.rotate(180)
            if img.size != (1700,2338): raise ValueError(f'Unexpected dimensions: {name}')
            scans[name], hashes[name] = img, sha(raw)
    records, thumbnails = [], []
    for row in CROPS:
        round_id, number, page, preview = row[:4]
        role = row[4] if len(row)>4 else 'question'
        name = f'Scan{page:04d}.jpg'
        rect = [round(value*(1700/1344 if n%2==0 else 2338/1848)) for n,value in enumerate(preview)]
        img = scans[name].crop(tuple(rect))
        output = args.output_root/round_id/f'hvac-practical-restored-{round_id}-{number:02d}-{role}-scan-v550.png'
        output.parent.mkdir(parents=True,exist_ok=True)
        img.save(output,format='PNG',optimize=True)
        source_number = ORDER[round_id].index(number)+1
        records.append(dict(round=round_id,number=number,sourceQuestion=source_number,scan=name,
            crop=rect,role=role,sourceSize=[1700,2338],output=output.as_posix(),outputSize=list(img.size),sha256=sha(output.read_bytes())))
        if args.contact_dir:
            thumb = img.copy(); thumb.thumbnail((420,280))
            thumbnails.append((f'{round_id} Q{number} {role}',thumb))
    mapping = [dict(round=r,sourceQuestion=i,targetId=f'hvac-practical-restored-{r}-{n:02d}' if n else None,
                    scan=f'Scan{page:04d}.jpg',status='matched' if n else 'different-variant')
               for r,order in ORDER.items() for i,(n,page) in enumerate(zip(order,PAGES[r]),1)]
    manifest = dict(version=1,source=dict(label='2026-10-06 사용자 제공 필답형 해설 스캔',archiveSha256=sha(args.archive.read_bytes()),scanCount=len(scans),scanSha256=hashes),
        mappingRule='회차와 문장·수치·회로/그림 내용으로 대응; 인쇄 번호로 덮어쓰지 않음',
        sourceMapping=mapping,variantDifferences=[dict(round='2023-2',sourceQuestion=5,
            note='스캔의 보일러 열량 문제는 기존 12번 보일러 효율 문제와 조건·구할 값이 다름. 기존 문항을 유지하며 미대응 처리함.')],crops=records)
    args.manifest.parent.mkdir(parents=True,exist_ok=True)
    args.manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    if args.contact_dir:
        args.contact_dir.mkdir(parents=True,exist_ok=True)
        for start in range(0,len(thumbnails),9):
            sheet=Image.new('RGB',(1320,960),'#dddddd'); d=ImageDraw.Draw(sheet)
            for j,(label,thumb) in enumerate(thumbnails[start:start+9]):
                x,y=(j%3)*440,(j//3)*320
                d.text((x+8,y+5),label,fill='black');sheet.paste(thumb,(x+8,y+28))
            sheet.save(args.contact_dir/f'crops-{start//9+1}.jpg')
    print(json.dumps(dict(sourcePages=len(scans),matched=sum(x['status']=='matched' for x in mapping),unmatched=1,crops=len(records))))

if __name__=='__main__': main()
