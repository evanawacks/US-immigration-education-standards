#!/usr/bin/env python3
"""Step 3 — validate that the standardized dataset matches the original documents.

A. Traceability (nothing invented or altered): every line stored in body_standards / body_examples /
   backup must equal a text unit extracted from that state's source files.
B. Completeness (nothing dropped): every text unit of every used file appears in at least one row.
C. Grade placement (automatic, where states use grade-coded standards): each standard code whose
   code contains a grade (e.g. AR "H.3.4.2", KY "4.H.CH.1", GA "SS4H1") must sit in a row for that grade.
D. Human audit sample: a fixed random sample of units per state with their assigned grade/course/
   category and page number, written as a worksheet for reviewers (data/validation/audit_sample.csv).
Usage: python scripts/validate_dataset.py [--per-state 20] [--seed 7]
"""
import argparse, collections, csv, json, random, re, sqlite3, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from check_labels import parse_units
OUT = ROOT / "data" / "validation"; OUT.mkdir(parents=True, exist_ok=True)
C = ROOT / "data" / "clean"
norm = lambda t: " ".join(t.split()).lower()

# grade-coded standard patterns: group(1) is the grade; band=True means the code names the END grade of a band
CODE_PATTERNS = {
    "AK": (r"\bSS\.(K|\d{1,2})\.\d+\.\d+\.\d+\b", False), "AR": (r"\b[CEGH]\.\d+\.(K|\d)\.\d+\b", False),
    "AZ": (r"(?<![\w.])(K|\d)\.(?:SP|C|E|G|H)\d", False), "CO": (r"\bSS\.(P|K|\d)\.\d", False),
    "CT": (r"(?<![\w.])(K|\d)\.(?:Civ|Eco|Geo|His|Inq)\.\d", False), "DC": (r"(?<![\w.])(K|\d)\.\d+\b", False),
    "GA": (r"\bSS(K|\d)(?:H|G|CG|E)\d", False), "HI": (r"\bSS\.(K|\d)\.\d", False), "IA": (r"\bSS\.(K|\d)\.\d+", False),
    "ID": (r"(?<![\w.])(K|\d)\.(?:SS|H|G|E|C|CG|GP)\.\d", False), "IN": (r"(?<![\w.])(K|\d)\.(?:H|C|G|E)\.\d+", False),
    "KY": (r"(?<![\w.])(K|\d)\.(?:I|C|E|G|H)\.[A-Z]{2,3}\.\d+", False), "LA": (r"(?<![\w.])(K|\d)\.\d+\b", False),
    "MA": (r"(?<![\w.])(K|\d)\.T\d", False), "MI": (r"(?<![\w.])(K|\d)\s?[–-]\s?[A-Z]\d\.\d", False),
    "MO": (r"(?<![\w.])(K|[1-5])\.[A-Z]{1,2}\.\d\.[A-Z]\.[a-z]", False), "MS": (r"(?<![\w.])(K|\d)\.\d+\b", False),
    "NC": (r"(?<![\w.])(K|\d)\.(?:H|G|C|E|B|I)\.\d", False), "NE": (r"\bSS (K|\d)\.\d", False),
    "NH": (r"\bSS:[A-Z]{2}:(2|4|6|8|12):\d", True), "NJ": (r"\b6\.[13]\.(2|5|8|12)\.", True),
    "NM": (r"(?<![\w.])(K|\d)\.\d+\b", False), "NV": (r"\bSS\.(K|\d)\.\d", False), "NY": (r"(?<![\w.])(K|\d)\.\d+[a-z]\b", False),
    "OR": (r"(?<![\w.])(K|\d)\.[A-Z]{1,2}\.", False), "RI": (r"\bSS(K|\d)\.\d", False),
    "SC": (r"(?<![\w.])(K|\d)\.\d+\.\d+\.[A-Z]{1,3}\b", False), "SD": (r"(?<![\w.])(K|\d)\.SS\.\d", False),
    "TN": (r"(?<![\w.])(K|\d)\.\d{2}\b", False), "UT": (r"\bStandard (K|\d)\.\d", False), "WV": (r"\bSS\.(K|\d)\.\d+", False),
}

KNOWN_SOURCE_TYPOS = {"AR_07": "AR Grade 7 document prints its geography codes as G.1.5.x (source typo, noted in issues)",
                      "AK_04": "AK leveled cells 'By the end of 4' carry SS.3.4.* codes (source typo, noted in issues)"}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--per-state", type=int, default=20); ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="audit_sample.csv", help="file name for the audit worksheet in data/validation/")
    a = ap.parse_args()
    cfg = json.loads((C / "state_config.json").read_text())
    con = sqlite3.connect(C / "standards.sqlite")
    report, trace_rows, grade_rows = [], [], []
    audit = []
    rng = random.Random(a.seed)
    for st in sorted(cfg):
        used = [f for f, v in cfg[st]["files"].items() if v == "use"]
        if not used: report.append(f"{st}: no source files (skipped)"); continue
        units, unit_texts = {}, set()
        for f in used:
            for l in open(C / "units" / st / f"{f}.units.jsonl"):
                u = json.loads(l); units[(f, u["id"])] = u
                t = u["text"]
                if f.lower().endswith(".csv"):   # assembler keeps "code statement" for CASE rows
                    parts = t.split(" | ")
                    for i in range(len(parts)):
                        for j in range(i + 1, len(parts) + 1): unit_texts.add(norm(" ".join(parts[i:j])))
                unit_texts.add(norm(t))
        rows = con.execute("select id, grade, course, body_standards, body_examples, backup from standards where state=?", (st,)).fetchall()
        # A. traceability
        untraceable = []
        for rid, g, course, *cols in rows:
            for colname, txt in zip(("body_standards", "body_examples", "backup"), cols):
                for line in (txt or "").split("\n"):
                    if not line.strip(): continue
                    if line.startswith("[running headers/footers]"): continue   # set-aside page furniture (checked in step 2)
                    ln = re.sub(r"^\[[^\]]{1,80}\] ", "", line)          # "[Course] text" prefix on folded rows
                    if norm(ln) not in unit_texts and norm(line) not in unit_texts:
                        untraceable.append((rid, colname, line[:120]))
        # B. completeness
        alltext = norm("\n".join("\n".join(c or "" for c in r[3:]) for r in rows))
        missing = []
        for (f, uid), u in units.items():
            if u.get("furniture"): continue
            probe = u["text"]
            if f.lower().endswith(".csv"):
                fields = [x for x in probe.split(" | ")[1:-1] if not re.fullmatch(r"[\d.]+|KG|\d\d(-\d\d)?|KG-\d\d", x)]
                probe = max(fields or [probe], key=len)
            if norm(probe) not in alltext: missing.append((f, uid))
        # C. grade placement
        bad = tot = 0; examples = []
        if st in CODE_PATTERNS:
            pat, band = CODE_PATTERNS[st]
            for rid, g, course, std, *_ in rows:
                if course or g in ("[ALL]", "[]"): continue
                gs = set(g.strip("[]").split(","))
                for m in re.finditer(pat, std or ""):
                    x = {"K": "0", "P": "PK"}.get(m.group(1), m.group(1)); tot += 1
                    ok = (x in gs) if not band else (str(max(int(v) for v in gs if v.lstrip('-').isdigit())) == x)
                    if not ok and rid in KNOWN_SOURCE_TYPOS:
                        if not any(KNOWN_SOURCE_TYPOS[rid] in e for e in examples): examples.append(f"{rid}: EXPLAINED — {KNOWN_SOURCE_TYPOS[rid]}")
                        continue
                    if not ok:
                        bad += 1
                        if len(examples) < 5: examples.append(f"{rid}: '{std[max(0,m.start()-30):m.end()+40]}'".replace("\n", " | "))
        trace_rows.append({"state": st, "rows": len(rows), "untraceable_lines": len(untraceable), "units_missing_from_rows": len(missing),
                           "coded_standards_checked": tot, "coded_standards_in_wrong_grade_row": bad})
        for x in untraceable[:20]: grade_rows.append({"state": st, "check": "untraceable line", "detail": f"{x[0]} [{x[1]}] {x[2]}"})
        for x in missing[:20]: grade_rows.append({"state": st, "check": "unit missing from rows", "detail": f"{x[0]} {x[1]}"})
        for x in examples: grade_rows.append({"state": st, "check": "code in wrong grade row", "detail": x})
        # D. audit sample (stratified by category), from the label files
        labs = []
        for f in used:
            lf = C / "labels" / st / f"{f}.labels.json"
            for l in json.loads(lf.read_text())["labels"]:
                for n in parse_units(l["units"]):
                    u = units.get((f, f"u{n}"))
                    if u and not u.get("furniture") and len(u["text"]) > 20: labs.append((f, u, l))
        by = collections.defaultdict(list)
        for x in labs: by[x[2]["cat"]].append(x)
        quota = {"standards": a.per_state * 3 // 5, "examples": a.per_state // 5, "backup": a.per_state - a.per_state * 3 // 5 - a.per_state // 5}
        for cat, q in quota.items():
            for f, u, l in rng.sample(by[cat], min(q, len(by[cat]))):
                audit.append({"state": st, "file": f, "page_or_sheet": u.get("page") or "", "unit": u["id"],
                              "where_in_table": f"T{u['table']} R{u['row']} C{u['col']}" if u.get("table") else "",
                              "text": u["text"][:400], "assigned_grades": l["grades"], "assigned_course": l.get("course") or "",
                              "assigned_category": cat, "section": l.get("section", "")[:100],
                              "REVIEW_text_matches_original_y_n": "", "REVIEW_grade_correct_y_n": "", "REVIEW_course_correct_y_n": "",
                              "REVIEW_category_correct_y_n": "", "REVIEW_correct_value_if_wrong": "", "REVIEW_reviewer": "", "REVIEW_notes": ""})
    for name, rs in (("dataset_checks.csv", trace_rows), ("dataset_findings.csv", grade_rows), (a.out, audit)):
        with open(OUT / name, "w", newline="") as fh:
            if rs:
                w = csv.DictWriter(fh, fieldnames=list(rs[0].keys())); w.writeheader(); w.writerows(rs)
    tot = collections.Counter()
    for r in trace_rows:
        for k in ("untraceable_lines", "units_missing_from_rows", "coded_standards_checked", "coded_standards_in_wrong_grade_row"): tot[k] += r[k]
    print(dict(tot)); print(f"audit sample: {len(audit)} units -> data/validation/{a.out}")
    for r in trace_rows:
        if r["untraceable_lines"] or r["units_missing_from_rows"] or r["coded_standards_in_wrong_grade_row"]: print("  ", r)
    for r in report: print(r)

if __name__ == "__main__":
    main()
