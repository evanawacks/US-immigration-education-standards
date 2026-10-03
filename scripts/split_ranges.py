#!/usr/bin/env python3
"""Suggest page-aligned unit ranges of ~N words for a view file. Usage: split_ranges.py ST file [words]"""
import re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
st, f = sys.argv[1], sys.argv[2]; target = int(sys.argv[3]) if len(sys.argv) > 3 else 50000
lines = (ROOT / "data/clean/units" / st / f"{f}.view.txt").read_text().splitlines()
parts, cur_start, words, last_u = [], None, 0, None
for ln in lines:
    if ln.startswith("=== page") and words >= target and cur_start:
        parts.append((cur_start, last_u)); cur_start, words = None, 0
    m = re.match(r"u(\d+) ", ln)
    if m:
        if cur_start is None: cur_start = int(m.group(1))
        last_u = int(m.group(1))
    words += len(ln.split())
if cur_start: parts.append((cur_start, last_u))
print(" ".join(f"u{a}-u{b}" for a, b in parts))
