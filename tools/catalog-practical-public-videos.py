#!/usr/bin/env python3
"""Read public video metadata only; never downloads media or applies images."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# IDs found in public YouTube search; metadata/channel/chapters checked below.
SOURCES = [
    (2022, '1', 'csnNvJWbknc'), (2022, '2', 'waC9TWlB0VY'),
    (2022, '3', 'JYVao7NtpFc'), (2023, '1', 'PH-CKt6m7oA'),
    (2021, '1', 'YyckJAoNH-4'), (2021, '2', 'EsdPHmU1Ie8'),
    (2021, '3', 'nQtCK_Dud0s'), (2020, '1', 'zJTaTLRRKeI'),
    (2020, '2A', '64dzmNYunTk'), (2020, '2B', 'M7ygoAJTR-Y'),
    (2020, '3', 'qNnWtpYjh2k'), (2020, '4', 'nA--L9-AVSQ'),
    (2019, '1', 'l8sRN9ZsWDY'), (2019, '2', 'ZLnDXwfvczg'),
    (2019, '3', 'ZPYIRU7Dapw'), (2018, '3', 'm81-0e74La0'),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--node', required=True)
    parser.add_argument('--output', type=Path, default=Path('data/hvac-practical-public-video-sources.json'))
    parser.add_argument('--cache-dir', type=Path, required=True)
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for year, session, video_id in SOURCES:
        cache = args.cache_dir / f'{video_id}.json'
        if cache.exists():
            meta = json.loads(cache.read_text())
        else:
            proc = subprocess.run([
                sys.executable, '-m', 'yt_dlp', '--quiet', '--no-warnings',
                '--skip-download', '--dump-single-json', '--js-runtimes', f'node:{args.node}',
                f'https://www.youtube.com/watch?v={video_id}',
            ], capture_output=True, text=True, timeout=120)
            if proc.returncode:
                # Signed media URLs and environment details must not enter reports.
                results.append(dict(year=year, session=session, videoId=video_id, status='metadata-unavailable'))
                print(f'{year}-{session}: metadata-unavailable', flush=True)
                continue
            meta = json.loads(proc.stdout)
            cache.write_text(json.dumps(meta))
        if meta.get('channel_id') != 'UC6BBDeiEj61ZXptb7qSJQyA':
            raise ValueError(f'Unexpected source channel for {video_id}')
        description = meta.get('description', '')
        chapters = []
        for time, number in re.findall(r'\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*(\d{1,2})번', description):
            parts = [int(p) for p in time.split(':')]
            seconds = sum(p * 60 ** i for i, p in enumerate(reversed(parts)))
            chapters.append(dict(number=int(number), startSeconds=seconds))
        if not chapters:
            for chapter in meta.get('chapters') or []:
                match = re.search(r'(\d{1,2})번', chapter.get('title', ''))
                if match:
                    chapters.append(dict(number=int(match[1]), startSeconds=chapter['start_time']))
        record = dict(year=year, session=session, videoId=video_id,
                      url=f'https://www.youtube.com/watch?v={video_id}', title=meta.get('title'),
                      channelId=meta['channel_id'], duration=meta.get('duration'),
                      availability=meta.get('availability'),
                      sourcePages=re.findall(r'https?://edukang\.tistory\.com/\d+', description),
                      chapters=chapters, status='source-located-content-review-pending')
        results.append(record)
        print(f'{year}-{session}: {len(chapters)} question chapters, {record["title"]}', flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(dict(
            checkedDate='2026-10-06', method='Public metadata and official channel check only. Not a question/image/answer audit.',
            sources=results), ensure_ascii=False, indent=2) + '\n')
    print(f'Public sources catalogued: {len(results)}', flush=True)

if __name__ == '__main__':
    main()
