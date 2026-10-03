#!/usr/bin/env python3
"""Merge partial label files <file>.partN.labels.json (written by agents that each labeled a unit range)
into <file>.labels.json. Usage: python scripts/merge_label_parts.py ST"""
import json, re, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
st = sys.argv[1]
d = ROOT / "data" / "clean" / "labels" / st
groups = collections.defaultdict(list)
for p in d.glob("*.part*.labels.json"):
    m = re.match(r"(.+)\.part(\d+)\.labels\.json$", p.name)
    groups[m.group(1)].append((int(m.group(2)), p))
for fname, parts in groups.items():
    parts.sort()
    merged = {"state": st, "file": fname, "structure": "", "labels": [], "issues": []}
    for n, p in parts:
        x = json.loads(p.read_text())
        merged["structure"] += (f"[part {n}] " + x.get("structure", "") + "\n")
        merged["labels"] += x.get("labels", [])
        merged["issues"] += x.get("issues", [])
    first = lambda l: int(re.match(r"u(\d+)", str(l["units"]).replace(" ", "")).group(1))
    merged["labels"].sort(key=first)
    (d / f"{fname}.labels.json").write_text(json.dumps(merged, indent=1, ensure_ascii=False))
    print("merged", fname, len(parts), "parts")
