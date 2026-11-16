#!/usr/bin/env python3
"""Tells Bing, Yandex, Naver, Seznam and other IndexNow engines about the URLs in sitemap.xml. Run after a push is live: python3 launch/indexnow.py
(Google does not use IndexNow: it needs the sitemap in Google Search Console.) The key file <key>.txt sits in the site root."""
import glob, json, os, re, urllib.request
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://neusicwave.com'
key_files = [f for f in glob.glob(os.path.join(ROOT, '*.txt')) if re.fullmatch(r'[0-9a-f]{32}\.txt', os.path.basename(f))]
assert len(key_files) == 1, 'expected exactly one <32-hex>.txt key file in the site root'
key = os.path.basename(key_files[0])[:-4]
urls = re.findall(r'<loc>([^<]+)</loc>', open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8').read())
body = json.dumps({'host': 'neusicwave.com', 'key': key, 'keyLocation': f'{SITE}/{key}.txt', 'urlList': urls}).encode()
req = urllib.request.Request('https://api.indexnow.org/IndexNow', data=body, headers={'content-type': 'application/json; charset=utf-8', 'user-agent': 'neusicwave-indexnow/1.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as r: print('IndexNow answered', r.status, 'for', len(urls), 'urls')
except urllib.error.HTTPError as e: print('IndexNow answered', e.code, e.read().decode('utf-8', 'replace')[:200])
