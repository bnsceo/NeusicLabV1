#!/usr/bin/env python3
"""Writes sitemap.xml (with the English/Spanish pairing) from each page's last commit date. Run: python3 launch/sitemap.py
Add a page here when you add one to the site. Then tell search engines: python3 launch/indexnow.py"""
import os, subprocess
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://neusicwave.com'
PAGES = [('/', 'index.html', True), ('/es/', 'es/index.html', True), ('/books/', 'books/index.html', False),
         ('/release-pack/', 'release-pack/index.html', False), ('/release-pack/privacy/', 'release-pack/privacy/index.html', False)]
def lastmod(path):
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or subprocess.run(['date', '-u', '+%F'], capture_output=True, text=True).stdout.strip()
rows = []
for url, src, pair in PAGES:
    alts = (f'\n    <xhtml:link rel="alternate" hreflang="en" href="{SITE}/"/>\n    <xhtml:link rel="alternate" hreflang="es" href="{SITE}/es/"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/"/>') if pair else ''
    rows.append(f'  <url>\n    <loc>{SITE}{url}</loc>\n    <lastmod>{lastmod(src)}</lastmod>{alts}\n  </url>')
open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + '\n'.join(rows) + '\n</urlset>\n')
print('sitemap.xml written,', len(rows), 'urls')
