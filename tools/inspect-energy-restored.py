#!/usr/bin/env python3
"""Read-only inventory of cached source-page OCR; never imports guessed answers."""
import json, re
from pathlib import Path

CACHE = Path('/private/tmp/cbt-energy-book-exams-review')
ROUNDS = [(2021,1,431,446),(2021,2,447,462),(2022,1,463,478),(2022,2,479,493),(2022,4,494,509),(2023,1,510,525),(2023,2,526,541),(2023,4,542,558),(2024,1,559,573),(2024,2,574,588),(2025,1,589,603),(2025,2,604,618),(2025,3,619,633)]

def anchors(first, last):
    result=[]
    for page in range(first,last+1):
        rows=json.loads((CACHE/f'page-{page}.json').read_text())['rows']
        for side in [0,1]:
            candidates=[]
            for row in rows:
                x,y,w,h=row['box']; text=row['text']
                match=re.match(r'^(\d{1,2})\s+[^①②③④]',text)
                if not match or len(text)<9 or not (0<x<.15 if side==0 else .48<=x<.59): continue
                number=int(match[1])
                if 1<=number<=80:
                    candidates.append(dict(page=page,side=side,number=number,top=1-y-h,text=text,box=row['box']))
            result.extend(sorted(candidates,key=lambda r:r['top']))
    return result

if __name__=='__main__':
    for year,session,first,last in ROUNDS:
        found=anchors(first,last)
        counts={n:sum(r['number']==n for r in found) for n in range(1,81)}
        print(year,session,'anchors',len(found),'missing',[n for n,c in counts.items() if not c], 'multiple',[(n,c) for n,c in counts.items() if c>1])
