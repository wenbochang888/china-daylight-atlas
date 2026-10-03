"""Snapshot the data served by Tianditu's public administrative map page.

No account, token, or tile API key is used. The response decoding follows the
public page's documented-in-source client format; this is not a download login.
"""
import concurrent.futures
import argparse
import datetime
import gzip
import hashlib
import json
import pathlib
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'data' / 'source' / 'official'
BASE = 'https://cloudcenter.tianditu.gov.cn/api/portal/region'


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=35) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def decode(payload):
    raw = gzip.decompress(payload)
    decoded = bytes((int.from_bytes(raw[i:i+4], 'big', signed=True) >> 2) & 255
                    for i in range(0, len(raw), 4))
    result = json.loads(decoded)
    if result.get('type') != 'FeatureCollection':
        raise ValueError('Expected an official GeoJSON FeatureCollection')
    return result


def save(name, result):
    path = DEST / name
    path.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    global DEST
    parser = argparse.ArgumentParser(description='Create an immutable official public map snapshot')
    parser.add_argument('--output', default=str(DEST), help='Use a new, empty directory for an updated snapshot')
    parser.add_argument('--source-update', default='未声明（请核验官方源页面）')
    args = parser.parse_args()
    DEST = pathlib.Path(args.output).resolve()
    if DEST.exists() and any(DEST.iterdir()):
        raise SystemExit('Snapshot directory already contains files. Use --output with a new empty directory; never mix old and new responses.')
    DEST.mkdir(parents=True, exist_ok=True)
    menu = json.loads(get(BASE + '/menu'))
    if menu.get('status') != 200:
        raise ValueError('Public administrative menu unavailable')
    save('menu.json', menu)
    save('provinces.json', decode(get(BASE + '/map?gb=156000000&level=2')))
    requests = {}
    provinces = menu['data'][0]['children']
    for province in provinces:
        if province['children']:
            requests[province['gb']] = 1
        for city in province['children']:
            if city['children'] and city['gb'] != province['gb']:
                requests[city['gb']] = 0

    def fetch(item):
        gb, level = item
        path = DEST / (gb + '.json')
        if path.exists():
            json.loads(path.read_text())
            return gb
        data = decode(get(f'{BASE}/map?gb={gb}&level={level}'))
        save(gb + '.json', data)
        return gb

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for count, gb in enumerate(pool.map(fetch, requests.items()), 1):
            if count % 25 == 0 or count == len(requests):
                print(f'Official snapshots: {count}/{len(requests)}', flush=True)
    save('snapshot.json', {
        'fetchedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
        'sourceUpdate': args.source_update,
    })
    print('Public official snapshot complete.', flush=True)


if __name__ == '__main__':
    main()
