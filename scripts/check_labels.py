#!/usr/bin/env python3
"""Validate label files against unit files: every non-furniture unit labeled exactly once,
valid grades/categories, valid JSON. Usage: python scripts/check_labels.py ST [file-substring]"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
GRADE_TOKEN = r"(PK|K|[1-9]|1[0-2])"
GRADES_RE = re.compile(rf"^(all|{GRADE_TOKEN}(-{GRADE_TOKEN})?(,{GRADE_TOKEN}(-{GRADE_TOKEN})?)*)$")
CATS = {"standards", "examples", "backup"}

def parse_units(spec):
    out = []
    for part in str(spec).replace(" ", "").split(","):
        m = re.fullmatch(r"u(\d+)(?:-u?(\d+))?", part)
        if not m: raise ValueError(f"bad unit spec {spec!r}")
        a = int(m.group(1)); b = int(m.group(2) or a)
        if b < a: raise ValueError(f"reversed range {spec!r}")
        out.extend(range(a, b + 1))
    return out

def check(st, sub=""):
    ok = True
    ldir = ROOT / "data" / "clean" / "labels" / st
    udir = ROOT / "data" / "clean" / "units" / st
    files = sorted(ldir.glob("*.labels.json")) if ldir.exists() else []
    if not files:
        print(f"{st}: no label files"); return False
    for lf in files:
        if sub and sub not in lf.name: continue
        try:
            d = json.loads(lf.read_text())
        except Exception as e:
            print(f"{lf.name}: INVALID JSON {e}"); ok = False; continue
        uf = udir / (d.get("file", lf.name.replace(".labels.json", "")) + ".units.jsonl")
        if not uf.exists():
            print(f"{lf.name}: unit file not found {uf.name}"); ok = False; continue
        units = [json.loads(l) for l in open(uf)]
        need = {int(u["id"][1:]) for u in units if not u.get("furniture")}
        allids = {int(u["id"][1:]) for u in units}
        seen, problems = {}, []
        for i, lab in enumerate(d.get("labels", [])):
            try:
                ids = parse_units(lab["units"])
            except Exception as e:
                problems.append(f"label {i}: {e}"); continue
            g = str(lab.get("grades", "")).replace(" ", "")
            if not GRADES_RE.match(g): problems.append(f"label {i} ({lab['units']}): bad grades {lab.get('grades')!r}")
            if lab.get("cat") not in CATS: problems.append(f"label {i} ({lab['units']}): bad cat {lab.get('cat')!r}")
            for x in ids:
                if x not in allids: problems.append(f"label {i}: u{x} does not exist"); break
                if x in seen and x in need: problems.append(f"u{x} labeled twice (labels {seen[x]} and {i})")
                seen[x] = i
        missing = sorted(need - set(seen))
        if missing:
            rngs, s = [], missing[0]; p = s
            for x in missing[1:] + [None]:
                if x is None or x != p + 1:
                    rngs.append(f"u{s}" + (f"-u{p}" if p != s else "")); s = x
                p = x if x is not None else p
            problems.append(f"{len(missing)} unlabeled units: {', '.join(rngs[:30])}{' ...' if len(rngs) > 30 else ''}")
        status = "OK" if not problems else "PROBLEMS"
        print(f"{lf.name}: {status} ({len(need)} units, {len(d.get('labels', []))} labels)")
        for p in problems[:40]: print("   -", p)
        ok &= not problems
    return ok

if __name__ == "__main__":
    st = sys.argv[1]; sub = sys.argv[2] if len(sys.argv) > 2 else ""
    sys.exit(0 if check(st, sub) else 1)
