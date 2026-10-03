#!/usr/bin/env python3
"""Per-state readiness: use-files extracted?, view words, labels present/valid."""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
C = ROOT / "data" / "clean"
cfg = json.loads((C / "state_config.json").read_text())
for st, c in sorted(cfg.items()):
    use = [f for f, v in c["files"].items() if v == "use"]
    ext = [f for f in use if (C / "units" / st / f"{f}.view.txt").exists()]
    words = sum(len((C / "units" / st / f"{f}.view.txt").read_text().split()) for f in ext)
    lab = [f for f in use if (C / "labels" / st / f"{f}.labels.json").exists()]
    print(f"{st} files={len(use)} extracted={len(ext)} labeled={len(lab)} view_words={words}")
