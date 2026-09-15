# -*- coding: utf-8 -*-
import zipfile, re, sys, io
from xml.etree import ElementTree as ET
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

def col_to_i(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref)
    if not m: return 0, 0
    c, r = m.group(1), int(m.group(2))
    n = 0
    for ch in c: n = n * 26 + (ord(ch) - 64)
    return n - 1, r

def strings(z):
    try: x = z.read("xl/sharedStrings.xml")
    except KeyError: return []
    out = []
    for si in ET.fromstring(x).findall(NS + "si"):
        out.append("".join(t.text or "" for t in si.iter(NS + "t")))
    return out

def sheet(path):
    z = zipfile.ZipFile(path)
    sst = strings(z)
    names = [n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)]
    grids = []
    for n in sorted(names):
        root = ET.fromstring(z.read(n))
        grid = {}
        for c in root.iter(NS + "c"):
            ref = c.get("r") or ""
            ci, ri = col_to_i(ref)
            t = c.get("t")
            v = c.find(NS + "v")
            isn = c.find(NS + "is")
            if t == "s" and v is not None and v.text is not None:
                val = sst[int(v.text)] if int(v.text) < len(sst) else ""
            elif t == "inlineStr" and isn is not None:
                val = "".join(x.text or "" for x in isn.iter(NS + "t"))
            elif v is not None:
                val = v.text or ""
            else:
                continue
            val = (val or "").strip()
            if val: grid[(ri, ci)] = val
        grids.append((n, grid))
    return grids

for path in sys.argv[1:]:
    print("=" * 70)
    print(path.split("/")[-1])
    print("=" * 70)
    for name, grid in sheet(path):
        if not grid: continue
        rows = sorted(set(r for r, _ in grid))
        maxc = max(c for _, c in grid)
        for r in rows:
            cells = [grid.get((r, c), "") for c in range(maxc + 1)]
            line = " | ".join(cells).rstrip(" |")
            if line.strip(): print(f"{r:>3}  {line}")
    print()
