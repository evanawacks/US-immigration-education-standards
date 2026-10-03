#!/usr/bin/env python3
"""QA over data/clean/standards.sqlite: expected clusters present, empty/small rows,
unit coverage (every labeled non-furniture unit lands in >=1 row of its state)."""
import json, re, sqlite3, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from assemble_clean import gset, glist
C = ROOT / "data" / "clean"
cfg = json.loads((C / "state_config.json").read_text())
con = sqlite3.connect(C / "standards.sqlite")
rows = {}
for r in con.execute("select id,state,grade,course,body_standards,body_examples,backup,source_files,issues from standards"):
    rows.setdefault(r[1], []).append(r)
wc = lambda s: len((s or "").split())
problems = []
for st, c in sorted(cfg.items()):
    rs = rows.get(st, [])
    if not c["files"]:
        continue
    grade_rows = {r[2] for r in rs if not r[3]}
    for cl in c["clusters"]:
        gl = glist(gset(cl))
        has_course = any(r[2] == gl or set(json.loads(r[2].replace("PK", '"PK"')) if r[2] != "[ALL]" else []) >= set() and False for r in rs)
        covered = any(set(gset(cl)) <= set(json.loads(r[2].replace("PK", "-1"))) for r in rs if r[2] not in ("[ALL]",))
        if not covered:
            problems.append(f"{st}: no row covers cluster {cl}")
    for r in rs:
        if r[0].endswith("_ALL"): continue
        if wc(r[4]) < 120:
            problems.append(f"{st}: {r[0]} has only {wc(r[4])} standards words (examples {wc(r[5])})")
    # coverage of units
    norm = lambda t: " ".join(t.split()).lower()
    texts = norm("\n".join((r[4] or "") + "\n" + (r[5] or "") + "\n" + (r[6] or "") for r in rs))
    for f, v in c["files"].items():
        if v != "use": continue
        uf = C / "units" / st / f"{f}.units.jsonl"
        miss = 0; tot = 0; missing_ids = []
        for l in open(uf):
            u = json.loads(l)
            if u.get("furniture"): continue
            tot += 1
            probe = max(u["text"].split(" | ")[:-1] or [u["text"]], key=len) if f.lower().endswith(".csv") else u["text"]
            if norm(probe) not in texts: miss += 1; missing_ids.append(u["id"])
        if miss: problems.append(f"{st}: {f[:50]} {miss}/{tot} units not found in any row: {missing_ids[:8]}")
print("\n".join(problems) or "no problems")
