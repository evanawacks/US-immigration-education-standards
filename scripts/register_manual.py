#!/usr/bin/env python3
"""Add manually downloaded files in data/raw/<ABBR>/ to data/manifest.csv.

Optional sidecar: data/raw/<ABBR>/sources.txt with lines "<filename> <source url>".
Run after dropping files in; safe to re-run (skips files already listed by path).
"""
import csv, hashlib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW, MAN = ROOT / "data" / "raw", ROOT / "data" / "manifest.csv"
EXT = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".html", ".htm"}
rows = list(csv.DictReader(open(MAN))) if MAN.exists() else []
known = {r["local_path"] for r in rows}
added = 0
for d in sorted(p for p in RAW.iterdir() if p.is_dir()):
    urls = {}
    if (d / "sources.txt").exists():
        for line in (d / "sources.txt").read_text().splitlines():
            if line.strip():
                n, _, u = line.strip().partition(" "); urls[n] = u.strip()
    for f in sorted(d.iterdir()):
        if f.suffix.lower() not in EXT: continue
        b = f.read_bytes(); h = hashlib.sha256(b).hexdigest()
        if str(f.relative_to(ROOT)) in known: continue
        known.add(str(f.relative_to(ROOT))); added += 1
        rows.append({"abbr": d.name.upper(), "source_url": urls.get(f.name, ""), "final_url": "",
                     "local_path": str(f.relative_to(ROOT)), "file_type": f.suffix.lower().lstrip("."),
                     "bytes": len(b), "sha256": h, "found_via": "manual",
                     "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds")})
if rows:
    with open(MAN, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(f"registered {added} new file(s); manifest now has {len(rows)}")
