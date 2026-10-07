#!/usr/bin/env python3
"""Prepare bounded public-source clips/frames for HUMAN review. No data edits."""
import argparse
import json
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--year', type=int, required=True)
    p.add_argument('--session', required=True)
    p.add_argument('--numbers', required=True)
    p.add_argument('--node', required=True)
    p.add_argument('--work-dir', type=Path, required=True)
    p.add_argument('--offset', type=int, default=2)
    p.add_argument('--length', type=int, default=18)
    p.add_argument('--format', default='137')
    args = p.parse_args()
    if not 3 <= args.length <= 30 or not 0 <= args.offset <= 120:
        raise ValueError('Only bounded short question clips are supported')
    catalog = json.loads(Path('data/hvac-practical-public-video-sources.json').read_text())
    source = next(s for s in catalog['sources'] if s['year']==args.year and s['session']==args.session)
    if source['availability'] != 'public':
        raise ValueError('Only public videos are supported')
    args.work_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for n in map(int, args.numbers.split(',')):
        chapter = next(c for c in source['chapters'] if c['number']==n)
        next_start = min([c['startSeconds'] for c in source['chapters'] if c['startSeconds']>chapter['startSeconds']] or [source['duration']])
        start = chapter['startSeconds'] + args.offset
        end = min(start+args.length, next_start-1)
        if end-start < 3:
            raise ValueError(f'Question {n}: clip crosses next chapter')
        stem = f'{args.year}-{args.session}-q{n:02d}-{start}'
        clip = args.work_dir / f'{stem}.mp4'
        log = args.work_dir / f'{stem}.log'
        record = dict(number=n, start=start, end=end, clip=str(clip), frames=[])
        if not clip.exists():
            with log.open('w') as handle:
                formats = [args.format, '136'] if args.format == '137' else [args.format]
                for fmt in formats:
                    try:
                        proc = subprocess.run([sys.executable, '-m', 'yt_dlp', '--quiet', '--no-warnings',
                            '--js-runtimes', f'node:{args.node}', '-f', fmt,
                            '--download-sections', f'*{start}-{end}', '-o', str(clip), source['url']],
                            stdout=handle, stderr=handle, timeout=180)
                    except subprocess.TimeoutExpired:
                        record['status'] = 'extract-timeout'
                        proc = subprocess.CompletedProcess([], 1)
                    if proc.returncode == 0 and clip.exists():
                        record['format'] = fmt
                        break
            if proc.returncode or not clip.exists():
                record.setdefault('status', 'extract-failed'); results.append(record)
                (args.work_dir/'status.json').write_text(json.dumps(dict(source=source['url'],results=results),ensure_ascii=False,indent=2)+'\n')
                print(f'{stem}: extract-failed (not applied)', flush=True)
                continue
        try:
            images = []
            for offset in [min(3, end-start-1), min(8, end-start-1), min(13, end-start-1)]:
                frame = args.work_dir / f'{stem}-{offset}s.png'
                subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(offset),'-i',str(clip),'-frames:v','1',str(frame)], check=True, capture_output=True)
                if not frame.exists():
                    continue
                image = Image.open(frame).convert('RGB'); image.thumbnail((640,360))
                with Image.open(frame) as original:
                    record['frames'].append(dict(path=str(frame), timestamp=start+offset, size=list(original.size)))
                images.append((image,start+offset))
            sheet = Image.new('RGB',(640,390*len(images)),'#ffffff')
            draw = ImageDraw.Draw(sheet)
            for i,(image,time) in enumerate(images):
                sheet.paste(image,(0,390*i+30)); draw.text((8,390*i+5),f'{args.year}-{args.session} Q{n} {time}s',fill='black')
            output = args.work_dir / f'{stem}-review.jpg';sheet.save(output,quality=90)
            record.update(status='human-review-pending',sheet=str(output))
            print(f'{stem}: {len(images)} candidate frames ready, NOT applied', flush=True)
        except (subprocess.CalledProcessError, OSError):
            record['status']='decode-failed';print(f'{stem}: decode-failed (not applied)',flush=True)
        results.append(record)
        (args.work_dir/'status.json').write_text(json.dumps(dict(source=source['url'],results=results),ensure_ascii=False,indent=2)+'\n')
    (args.work_dir/'status.json').write_text(json.dumps(dict(source=source['url'],results=results),ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
