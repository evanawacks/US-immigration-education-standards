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
from course_vocab import standardize

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
    words = re.split(r"[^A-Za-z0-9]+", s.replace("'", ""))
    return "".join(w if w.isupper() else w[:1].upper() + w[1:] for w in words if w)[:40]

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
        if fname.lower().endswith(".csv"):   # CASE export rows: keep "code statement", drop item type / sequence / grade code / timestamp
            for u in units.values():
                parts = u["text"].split(" | ")
                if len(parts) >= 4 and re.fullmatch(r"\d{4}-\d\d-\d\dT[\d:.+-]+", parts[-1]):
                    parts = parts[:-1]
                    if re.fullmatch(r"(KG|\d\d)(-(\d\d))?", parts[-1]): parts = parts[:-1]
                    if re.fullmatch(r"[\d.]+", parts[1]): parts = parts[2:]
                    else: parts = parts[1:]
                    u["text"] = " ".join(parts)
        if not lf.exists(): state_issues.append(f"missing labels for {fname}"); continue
        d = json.loads(lf.read_text())
        doc_issues = [f"{fname}: {x}" for x in d.get("issues", [])]
        labels = d.get("labels", [])
        doc_grades = frozenset().union(*[gset(l["grades"]) for l in labels if str(l["grades"]) != "all"]) if labels else frozenset()
        # single-grade document (e.g. a "Grade 1" file): band-labeled shared items apply to that grade only
        singles = {next(iter(gset(l["grades"]))) for l in labels if str(l["grades"]) != "all" and not l.get("course")
                   and l["cat"] != "backup" and len(gset(l["grades"])) == 1}
        clamp = frozenset(singles) if len(singles) == 1 and not any(l.get("course") for l in labels) else None
        if clamp: doc_grades = clamp
        # course rows of this document
        course_rows = {}   # (title, grades) -> grades
        for l in labels:
            if l.get("course"):
                t = " ".join(l["course"].split())
                G = gset(l["grades"]) if str(l["grades"]) != "all" else doc_grades
                if not any(k[0].lower() == t.lower() and k[1] == G for k in course_rows):
                    course_rows[(t, G)] = G
        assigned = {}
        for l in labels:
            for x in parse_units(l["units"]):
                assigned.setdefault(x, l)
        # clusters that hold grade-specific (non-shared) course-less content in this document
        def shared_with_course(G):
            return any(G >= frozenset(S) for S in course_rows.values())
        specific = set()
        for l in labels:
            if l.get("course") or l["cat"] == "backup" or str(l["grades"]) == "all": continue
            G = gset(l["grades"])
            if shared_with_course(G): continue
            for i, C in enumerate(clusters):
                if G & C: specific.add(i)
        single_course = len(course_rows) == 1 and not specific
        def course_row(key):
            t, G = key
            return row(("C", t.lower(), G), G, standardize(t), t)
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
            if clamp and G & clamp: G = clamp
            targets = []
            if l.get("course"):
                t = " ".join(l["course"].split())
                key = next(k for k in course_rows if k[0].lower() == t.lower() and k[1] == G)
                targets.append(course_row(key))
            elif cat == "backup" and (str(l["grades"]) == "all" or G >= doc_grades):
                targets.append(course_row(next(iter(course_rows))) if single_course else allrow)
            else:
                for k, S in course_rows.items():
                    if G >= S: targets.append(course_row(k))
                for i, C in enumerate(clusters):
                    if not (G & C): continue
                    if len({t for t, _ in course_rows}) == 1 and i not in specific: continue
                    targets.append(row(("G", C), C))
                    if not (G >= C or C >= G):
                        state_issues.append(f"{fname}: u{uid} grades {l['grades']} only partly overlap row cluster {gtoken(C)}")
                if not targets:
                    targets.append(allrow); state_issues.append(f"{fname}: u{uid} grades {l['grades']} match no row -> ALL")
            for r in targets:
                r[cat].append((fname, uid, u["text"]))
                if fname not in r["files"]: r["files"].append(fname)
                touched.add(id(r))
        for iss in doc_issues:
            ids = set()
            for a, b in re.findall(r"u(\d+)(?:\s*[-–]\s*u?(\d+))?", iss):
                a = int(a); b = int(b or a)
                if b - a < 5000: ids.update(range(a, b + 1))
            for r in rows.values():
                if id(r) not in touched: continue
                mine = {uid for f, uid, _ in r["standards"] + r["examples"] + r["backup"] if f == fname}
                if not ids or ids & mine: r["issues"].append(iss)
        furn = []
        for uid in sorted(units):
            t = units[uid]["text"]
            if units[uid].get("furniture") and t not in furn: furn.append(t)
        if furn: allrow["backup"].append((fname, 0, "[running headers/footers] " + " | ".join(furn)))
        if fname not in allrow["files"]: allrow["files"].append(fname)
    for key in [k for k, r in rows.items() if k[0] != "ALL" and not r["standards"] and not r["examples"]]:
        r = rows.pop(key)
        label = r["course_title"] or gtoken(r["grades"])
        allrow["backup"].extend((f, u, f"[{label}] {t}") for f, u, t in r["backup"])
        for f in r["files"]:
            if f not in allrow["files"]: allrow["files"].append(f)
    allrow["issues"] = state_issues + allrow["issues"]
    out = []
    for key, r in rows.items():
        if key[0] == "ALL":
            rid, grades, gl = f"{st}_ALL", "ALL", "[ALL]"
        else:
            gl = glist(r["grades"]); rid = f"{st}_{gtoken(r['grades'])}"
            if r["course"]: rid += "_" + slug(r["course"][0])
        def join(items):
            seen, out = set(), []
            for _, _, t in items:
                k = " ".join(t.split()).lower()
                if len(k) > 25 and k in seen: continue   # drop exact repeats (sidebars, repeated headers)
                seen.add(k); out.append(t)
            return "\n".join(out)
        out.append({"id": rid, "state": st, "grade": gl, "course": r["course"][0] if r["course"] else "", "course_category": r["course"][1] if r["course"] else "",
                    "course_title": r["course_title"] or "",
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
        txt = [f"# {o['id']}", "", f"- State: {o['state']}", f"- Grade: {o['grade']}", f"- Course: {o['course']} [{o['course_category']}] (as written: {o['course_title']})" if o["course"] else "- Course: (none)",
               f"- Source files: {o['source_files']}", "", "## Standards", "", o["body_standards"] or "(none)", "", "## Examples / clarifications", "", o["body_examples"] or "(none)",
               "", "## Backup (non-standards text)", "", o["backup"] or "(none)", "", "## Issues", "", o["issues"] or "(none)", ""]
        (CLEAN / o["state"] / f"{o['id']}.md").write_text("\n".join(txt))

def main():
    cfg, names = load_cfg()
    states = sys.argv[1:] or sorted(cfg)
    rows = []
    for st in states:
        if not cfg[st].get("files"):
            rows.append({"id": f"{st}_NONE", "state": st, "grade": "[]", "course": "", "course_category": "", "course_title": "", "body_standards": "", "body_examples": "", "backup": "",
                         "source_files": "", "issues": "; ".join(cfg[st].get("issues", ["no source file"]))})
            continue
        rows.extend(assemble_state(st, cfg, names))
    write(rows, states)
    # merge into db (replace rows of the states processed)
    db = CLEAN / "standards.sqlite"
    con = sqlite3.connect(db)
    con.execute("""CREATE TABLE IF NOT EXISTS standards (id TEXT PRIMARY KEY, state TEXT, grade TEXT, course TEXT, course_category TEXT, course_title TEXT,
                   body_standards TEXT, body_examples TEXT, backup TEXT, source_files TEXT, issues TEXT)""")
    con.executemany("DELETE FROM standards WHERE state=?", [(s,) for s in states])
    con.executemany("INSERT INTO standards VALUES (:id,:state,:grade,:course,:course_category,:course_title,:body_standards,:body_examples,:backup,:source_files,:issues)", rows)
    con.commit()
    allrows = [dict(zip([c[0] for c in con.execute("select * from standards").description], r)) for r in con.execute("select * from standards order by state, id")]
    with open(CLEAN / "standards.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(allrows[0].keys())); w.writeheader(); w.writerows(allrows)
    for o in rows:
        print(f"{o['id']:<40} {o['grade']:<14} std={len(o['body_standards'].split()):>6}w ex={len(o['body_examples'].split()):>6}w backup={len(o['backup'].split()):>6}w issues={o['issues'].count(chr(10)) + bool(o['issues'])}")

if __name__ == "__main__":
    main()
