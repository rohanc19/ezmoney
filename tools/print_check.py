"""Print every saved bill at A4, Letter and A5 and check the page breaks.

Prints each bill with headless Chrome against the running dev server's
stylesheet, then reports its page count and flags any bill whose foot
(amount in words, bank, total, signature) starts a page with fewer than
two item rows above it — the "foot alone on page two" that made a 7-line
bill look broken in Oct 2026.

    python3 tools/print_check.py serve <dir>          # 1. receive bills
    python3 tools/print_check.py <dir> <scratch dir>  # 2. print and check

The bills are behind the login, so step 1 listens on 127.0.0.1:8765 for
a logged-in browser tab to POST each bill's HTML to; the snippet that
does that is under "Checking print" in CLAUDE.md.
Needs Google Chrome and PyMuPDF (pip install pymupdf). Exit status 1 if
anything is flagged.
"""
import os, re, sys, subprocess, concurrent.futures as cf

if sys.argv[1] == 'serve':
    import http.server
    OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
    class Recv(http.server.BaseHTTPRequestHandler):
        def _cors(self):
            self.send_header('Access-Control-Allow-Origin', 'http://localhost:3000')
            self.send_header('Access-Control-Allow-Methods', 'POST')
            self.send_header('Access-Control-Allow-Headers', 'content-type')
        def do_OPTIONS(self):
            self.send_response(204); self._cors(); self.end_headers()
        def do_POST(self):
            name = re.sub(r'[^A-Za-z0-9_-]', '', self.path.strip('/')) or 'bill'
            body = self.rfile.read(int(self.headers['content-length']))
            open(os.path.join(OUT, name + '.html'), 'wb').write(body)
            self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'ok')
        def log_message(self, *a): pass
    print('listening on 127.0.0.1:8765, saving to', OUT)
    http.server.HTTPServer(('127.0.0.1', 8765), Recv).serve_forever()

import fitz
H = sys.argv[1]; S = sys.argv[2]; O = os.path.join(S, 'out'); os.makedirs(O, exist_ok=True)
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SIZES = {'A4': '', 'Letter': '@page{size:letter}', 'A5': '@page{size:A5;margin:6mm}'}

def prep(name, size):
    h = open(os.path.join(H, name + '.html'), encoding='utf-8').read()
    h = re.sub(r'<script\b.*?</script>', '', h, flags=re.S)
    h = h.replace('class="rise ', 'class="')            # the fade-in would print at frame 0
    h = h.replace('<head>', '<head><base href="http://localhost:3000/">', 1)
    if SIZES[size]: h = h.replace('</head>', f'<style>{SIZES[size]}</style></head>', 1)
    if size == 'A5': h = re.sub(r'<html([^>]*)>', r'<html\1 class="print-a5">', h, count=1)
    p = os.path.join(O, f'{name}.{size}.html'); open(p, 'w', encoding='utf-8').write(h); return p

def run(job):
    name, size = job; src = prep(name, size); pdf = src[:-5] + '.pdf'
    for attempt in range(3):   # headless Chrome occasionally hangs; a fresh profile clears it
        try:
            subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                            f'--user-data-dir={S}/prof/{name}-{size}-{attempt}', '--virtual-time-budget=4000',
                            f'--print-to-pdf={pdf}', 'file://' + src], capture_output=True, timeout=60)
            if os.path.exists(pdf): break
        except subprocess.TimeoutExpired:
            pass
    d = fitz.open(pdf); texts = [p.get_text() for p in d]
    foot = next((i for i, t in enumerate(texts) if 'TOTAL IN WORDS' in t.upper()), None)
    # Item rows on the foot's page: text lines strictly between the column
    # headings and the TOTAL row. A continued bill must carry at least two.
    alone = False
    if foot is not None and foot > 0:
        pg = d[foot]; hdr = pg.search_for('Name of Product'); tot = [r for r in pg.search_for('TOTAL') if r.y0 < (pg.search_for('IN WORDS') or [pg.rect])[0].y0]
        if not hdr or not tot: alone = True
        else:
            ys = sorted({round(b[1]) for b in pg.get_text('blocks') if b[1] > hdr[0].y1 + 2 and b[3] < tot[-1].y0 - 1})
            alone = len(ys) < 2
    blank = [i + 1 for i, t in enumerate(texts) if not t.strip()]
    return name, size, len(d), alone, blank

names = sorted(f[:-5] for f in os.listdir(H) if f.endswith('.html'))
jobs = [(n, s) for n in names for s in SIZES]
rows = list(cf.ThreadPoolExecutor(6).map(run, jobs))
res = {}
for n, s, pages, alone, blank in rows: res.setdefault(n, {})[s] = (pages, alone, blank)
bad = 0
print(f"{'bill':14} {'A4':>8} {'Letter':>8} {'A5':>8}")
for n in names:
    cells = []
    for s in SIZES:
        pages, alone, blank = res[n][s]
        flag = ' FOOT-ALONE' if alone else (' BLANK' + str(blank) if blank else '')
        bad += bool(alone or blank)
        cells.append(f'{pages}p{flag}')
    print(f'{n:14} ' + ' '.join(f'{c:>8}' for c in cells))
print('problems:', bad)
sys.exit(1 if bad else 0)
