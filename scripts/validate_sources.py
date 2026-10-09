#!/usr/bin/env python3
"""Step 1 — validate data sources.

For every file the clean dataset uses, check: file present, SHA-256 still matches the manifest,
file type matches its contents, where it came from (URL / domain / manual upload), and whether the
dataset's grade coverage for the state is complete (K-12). Writes data/validation/sources.csv with
empty reviewer columns for the manual checks (is this the official, current, complete document?).
Usage: python scripts/validate_sources.py
"""
import csv, glob, hashlib, json, re, sqlite3
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "validation"; OUT.mkdir(parents=True, exist_ok=True)
MAGIC = {"pdf": b"%PDF", "docx": b"PK", "xlsx": b"PK", "csv": None, "json": None}

cfg = json.loads((ROOT / "data/clean/state_config.json").read_text())
man = {(r["abbr"], Path(r["local_path"]).name): r for r in csv.DictReader(open(ROOT / "data/manifest.csv"))}
src = {r["Abbr."]: r for r in csv.DictReader(open(glob.glob(str(ROOT / "US_State*.csv"))[0]))}
con = sqlite3.connect(ROOT / "data/clean/standards.sqlite")

KNOWN_OFFICIAL = {"alabamaachieves.org": "AL State Dept. of Education", "hawaiipublicschools.org": "HI Dept. of Education",
                  "www.isbe.net": "Illinois State Board of Education"}
KNOWN_FLAGS = {"moose.nhhistory.org": "CHECK: hosted by NH Historical Society, not the NH DOE",
               "webapp-strapi-paas-prod-nde-001.azurewebsites.net": "CHECK: Azure file host (appears to be NV DOE's CMS storage)"}

def official(host):
    if host in KNOWN_OFFICIAL: return "government/education agency (" + KNOWN_OFFICIAL[host] + ")"
    if host in KNOWN_FLAGS: return KNOWN_FLAGS[host]
    if not host: return "manual upload (no URL recorded)"
    if host.endswith(".gov") or ".k12." in host or host.endswith(".us") or host.endswith(".edu"): return "government/education domain"
    if host in ("www.socialstudies.org", "socialstudies.org"): return "NCSS (national, not state)"
    return "CHECK: non-government domain"

rows, summary = [], []
for st in sorted(cfg):
    grades = set()
    for (g,) in con.execute("select grade from standards where state=? and grade not in ('[ALL]','[]')", (st,)):
        grades |= set(g.strip("[]").split(","))
    missing = [x for x in ["0"] + [str(i) for i in range(1, 13)] if x not in grades]
    used = [f for f, v in cfg[st]["files"].items() if v == "use"]
    if not used:
        rows.append({"state": st, "file": "(none)", "check_status": "FAIL: no source file", "missing_grades_in_dataset": "all"})
    for f in used:
        m = man.get((st, f), {})
        p = ROOT / m.get("local_path", f"data/raw/{st}/{f}")
        status = []
        if not p.exists(): status.append("FAIL: file missing")
        else:
            data = p.read_bytes()
            if m.get("sha256") and hashlib.sha256(data).hexdigest() != m["sha256"]: status.append("FAIL: hash changed since download")
            mg = MAGIC.get(p.suffix.lower().lstrip("."))
            if mg and not data.startswith(mg): status.append("FAIL: content is not a real " + p.suffix)
        url = m.get("source_url", "")
        host = urlparse(url).netloc.lower()
        rows.append({
            "state": st, "file": f, "found_via": m.get("found_via", ""), "source_url": url,
            "domain_check": official(host),
            "spreadsheet_page": src.get(st, {}).get("Link", ""), "spreadsheet_adopted": src.get(st, {}).get("Adopted / revised", ""),
            "downloaded_at": m.get("downloaded_at", ""), "sha256": m.get("sha256", "")[:16],
            "check_status": "; ".join(status) or "OK",
            "missing_grades_in_dataset": ",".join(missing),
            # reviewer fills these in
            "REVIEW_official_publisher_yes_no": "", "REVIEW_current_version_yes_no": "", "REVIEW_complete_document_yes_no": "",
            "REVIEW_reviewer": "", "REVIEW_date": "", "REVIEW_notes": "",
        })
fields = list(max(rows, key=len).keys())
with open(OUT / "sources.csv", "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=fields); w.writeheader(); w.writerows(rows)
fails = [r for r in rows if r.get("check_status") != "OK"]
manual = [r for r in rows if "manual" in r.get("domain_check", "")]
nongov = [r for r in rows if r.get("domain_check", "").startswith(("CHECK", "NCSS"))]
gaps = sorted({(r["state"], r["missing_grades_in_dataset"]) for r in rows if r.get("missing_grades_in_dataset")})
print(f"{len(rows)} source files checked -> data/validation/sources.csv")
print(f"automatic failures: {len(fails)}"); [print("  ", r["state"], r["file"][:50], r["check_status"]) for r in fails]
print(f"manual uploads with no URL recorded: {len(manual)} files in {len({r['state'] for r in manual})} states")
print(f"non-government domains: {[ (r['state'], r['domain_check']) for r in nongov]}")
print("states whose dataset lacks some K-12 grades:", gaps)
