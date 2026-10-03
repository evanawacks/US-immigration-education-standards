#!/usr/bin/env python3
"""Assemble the clean corpus from unit files + label files + state config.

Inputs:  data/clean/units/<ST>/*.units.jsonl, data/clean/labels/<ST>/*.labels.json,
         data/clean/state_config.json, data/clean/course_names.json (optional)
Outputs: data/clean/<ST>/<row_id>.md         one readable file per row
         data/clean/standards.sqlite          table `standards`
         data/clean/standards.csv
Usage:   python scripts/assemble_clean.py [ST ...]
"""
import csv, json, re, sqlite3, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
CLEAN = ROOT / "data" / "clean"
sys.path.insert(0, str(ROOT / "scripts"))
from check_labels import parse_units

ORDER = ["PK", "K"] + [str(i) for i in range(1, 13)]
NUM = {g: i - 1 for i, g in enumerate(ORDER)}  # PK=-1, K=0, 1..12

def gset(spec):
    s = set()
    for part in str(spec).replace(" ", "").split(","):
        if "-" in part:
            a, b = part.split("-")
            s |= set(range(NUM[a], NUM[b] + 1))
        else:
            s.add(NUM[part])
    return frozenset(s)

def gtoken(gs):
    g = sorted(gs)
    lab = lambda n: "PK" if n == -1 else ("K" if n == 0 else f"{n:02d}")
    if len(g) == 1: return lab(g[0])
    if g == list(range(g[0], g[-1] + 1)): return f"{lab(g[0])}-{lab(g[-1])}"
    return "+".join(lab(x) for x in g)

def glist(gs):
    return "[" + ",".join("PK" if n == -1 else str(n) for n in sorted(gs)) + "]"

def slug(s):
    s = re.sub(r"[^A-Za-z0-9]+", " ", s).title().replace(" ", "")
    return s[:40]

def load_cfg():
    cfg = json.loads((CLEAN / "state_config.json").read_text())
    names = {}
    p = CLEAN / "course_names.json"
    if p.exists(): names = json.loads(p.read_text())
    return cfg, names

def assemble_state(st, cfg, names):
    c = cfg[st]
    clusters = [gset(x) for x in c.get("clusters", [])]
    rows = collections.OrderedDict()   # key -> row dict
    def row(key, grades, course=None, course_title=None):
        if key not in rows:
            rows[key] = {"grades": grades, "course": course, "course_title": course_title,
                         "standards": [], "examples": [], "backup": [], "files": [], "issues": []}
        return rows[key]
    allrow = row(("ALL", None), frozenset(), None)
    state_issues = list(c.get("issues", []))
    use_files = [f for f, v in c["files"].items() if v == "use"]
    for f, v in c["files"].items():
        if v != "use": state_issues.append(f"not used: {f} ({v})")
    for fname in use_files:
        uf = CLEAN / "units" / st / f"{fname}.units.jsonl"
        lf = CLEAN / "labels" / st / f"{fname}.labels.json"
        if not uf.exists(): state_issues.append(f"missing units file for {fname}"); continue
        units = {int(json.loads(l)["id"][1:]): json.loads(l) for l in open(uf)}
        if not lf.exists(): state_issues.append(f"missing labels for {fname}"); continue
        d = json.loads(lf.read_text())
        doc_issues = [f"{fname}: {x}" for x in d.get("issues", [])]
        labels = d.get("labels", [])
        doc_grades = frozenset().union(*[gset(l["grades"]) for l in labels if str(l["grades"]) != "all"]) if labels else frozenset()
        # course rows of this document
        course_rows = {}
        for l in labels:
            if l.get("course"):
                t = l["course"].strip()
                course_rows.setdefault(t, set()).update(gset(l["grades"]) if str(l["grades"]) != "all" else doc_grades)
        assigned = {}
        for l in labels:
            for x in parse_units(l["units"]):
                assigned.setdefault(x, l)
        touched = set()
        for uid in sorted(units):
            u = units[uid]
            if u.get("furniture"):
                continue
            l = assigned.get(uid)
            if l is None:
                allrow["backup"].append((fname, uid, u["text"])); state_issues.append(f"{fname}: u{uid} unlabeled -> backup"); continue
            cat = l["cat"]
            G = doc_grades if str(l["grades"]) == "all" else gset(l["grades"])
            targets = []
            if l.get("course"):
                t = l["course"].strip()
                std = names.get(st, {}).get(t, names.get("*", {}).get(t, t))
                targets.append(row(("C", t), frozenset(course_rows[t]), std, t))
            else:
                if cat == "backup" and (str(l["grades"]) == "all" or G >= doc_grades):
                    targets.append(allrow)
                else:
                    for C in clusters:
                        if G & C:
                            targets.append(row(("G", C), C))
                            if not (G >= C or C >= G):
                                state_issues.append(f"{fname}: u{uid} grades {l['grades']} only partly overlap row cluster {gtoken(C)}")
                    for t, S in course_rows.items():
                        if G >= frozenset(S):
                            std = names.get(st, {}).get(t, names.get("*", {}).get(t, t))
                            targets.append(row(("C", t), frozenset(S), std, t))
                    if not targets:
                        targets.append(allrow); state_issues.append(f"{fname}: u{uid} grades {l['grades']} match no row cluster -> ALL")
            for r in targets:
                r[cat].append((fname, uid, u["text"]))
                if fname not in r["files"]: r["files"].append(fname)
                touched.add(id(r))
        for r in rows.values():
            if id(r) in touched: r["issues"].extend(doc_issues)
        furn = []
        for uid in sorted(units):
            t = units[uid]["text"]
            if units[uid].get("furniture") and t not in furn: furn.append(t)
        if furn: allrow["backup"].append((fname, 0, "[running headers/footers] " + " | ".join(furn)))
        if fname not in allrow["files"]: allrow["files"].append(fname)
    allrow["issues"] = state_issues + allrow["issues"]
    out = []
    for key, r in rows.items():
        if key[0] == "ALL":
            rid, grades, gl = f"{st}_ALL", "ALL", "[ALL]"
        else:
            gl = glist(r["grades"]); rid = f"{st}_{gtoken(r['grades'])}"
            if r["course"]: rid += "_" + slug(r["course"])
        join = lambda items: "\n".join(t for _, _, t in items)
        out.append({"id": rid, "state": st, "grade": gl, "course": r["course"] or "", "course_title": r["course_title"] or "",
                    "body_standards": join(r["standards"]), "body_examples": join(r["examples"]), "backup": join(r["backup"]),
                    "source_files": "; ".join(r["files"]), "issues": "\n".join(dict.fromkeys(r["issues"]))})
    # disambiguate duplicate ids (same course slug in two docs)
    seen = collections.Counter()
    for o in out:
        seen[o["id"]] += 1
        if seen[o["id"]] > 1: o["id"] += f"_{seen[o['id']]}"
    key = lambda o: (o["id"].endswith("_ALL"), -2 if o["grade"] == "[PK]" else (int(re.findall(r"-?\d+", o["grade"])[0]) if re.findall(r"\d+", o["grade"]) else 99), o["course"])
    return sorted(out, key=key)

def write(all_rows, states):
    for st in states:
        d = CLEAN / st; d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.md"): old.unlink()
    for o in all_rows:
        txt = [f"# {o['id']}", "", f"- State: {o['state']}", f"- Grade: {o['grade']}", f"- Course: {o['course']} ({o['course_title']})" if o["course"] else "- Course: (none)",
               f"- Source files: {o['source_files']}", "", "## Standards", "", o["body_standards"] or "(none)", "", "## Examples / clarifications", "", o["body_examples"] or "(none)",
               "", "## Backup (non-standards text)", "", o["backup"] or "(none)", "", "## Issues", "", o["issues"] or "(none)", ""]
        (CLEAN / o["state"] / f"{o['id']}.md").write_text("\n".join(txt))

def main():
    cfg, names = load_cfg()
    states = sys.argv[1:] or sorted(cfg)
    rows = []
    for st in states:
        if not cfg[st].get("files"):
            rows.append({"id": f"{st}_NONE", "state": st, "grade": "[]", "course": "", "course_title": "", "body_standards": "", "body_examples": "", "backup": "",
                         "source_files": "", "issues": "; ".join(cfg[st].get("issues", ["no source file"]))})
            continue
        rows.extend(assemble_state(st, cfg, names))
    write(rows, states)
    # merge into db (replace rows of the states processed)
    db = CLEAN / "standards.sqlite"
    con = sqlite3.connect(db)
    con.execute("""CREATE TABLE IF NOT EXISTS standards (id TEXT PRIMARY KEY, state TEXT, grade TEXT, course TEXT, course_title TEXT,
                   body_standards TEXT, body_examples TEXT, backup TEXT, source_files TEXT, issues TEXT)""")
    con.executemany("DELETE FROM standards WHERE state=?", [(s,) for s in states])
    con.executemany("INSERT INTO standards VALUES (:id,:state,:grade,:course,:course_title,:body_standards,:body_examples,:backup,:source_files,:issues)", rows)
    con.commit()
    allrows = [dict(zip([c[0] for c in con.execute("select * from standards").description], r)) for r in con.execute("select * from standards order by state, id")]
    with open(CLEAN / "standards.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(allrows[0].keys())); w.writeheader(); w.writerows(allrows)
    for o in rows:
        print(f"{o['id']:<40} {o['grade']:<14} std={len(o['body_standards'].split()):>6}w ex={len(o['body_examples'].split()):>6}w backup={len(o['backup'].split()):>6}w issues={o['issues'].count(chr(10)) + bool(o['issues'])}")

if __name__ == "__main__":
    main()
