#!/usr/bin/env python3
"""Build docs/MASTER_REPORT.md from data/text_stats.csv + scripts/report_notes.py.

Word-count rules (see EXCLUDE below): exact-duplicate text, alternate formats / re-sorts of the same
standards, superseded versions and non-standards documents are listed but not counted."""
import csv, re, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from report_notes import N

STATES = {l.split(",")[1]: l.split(",")[0] for l in """Alabama,AL
Alaska,AK
Arizona,AZ
Arkansas,AR
California,CA
Colorado,CO
Connecticut,CT
Delaware,DE
District of Columbia,DC
Florida,FL
Georgia,GA
Hawaii,HI
Idaho,ID
Illinois,IL
Indiana,IN
Iowa,IA
Kansas,KS
Kentucky,KY
Louisiana,LA
Maine,ME
Maryland,MD
Massachusetts,MA
Michigan,MI
Minnesota,MN
Mississippi,MS
Missouri,MO
Montana,MT
Nebraska,NE
Nevada,NV
New Hampshire,NH
New Jersey,NJ
New Mexico,NM
New York,NY
North Carolina,NC
North Dakota,ND
Ohio,OH
Oklahoma,OK
Oregon,OR
Pennsylvania,PA
Rhode Island,RI
South Carolina,SC
South Dakota,SD
Tennessee,TN
Texas,TX
Utah,UT
Vermont,VT
Virginia,VA
Washington,WA
West Virginia,WV
Wisconsin,WI
Wyoming,WY""".splitlines()}

# (abbr, substring of filename) -> reason the file is not counted
EXCLUDE = []
def ex(ab, subs, why):
    for s in subs: EXCLUDE.append((ab, s, why))
ex("NJ", ["WIDA-ELD"], "not social studies (English-language-development standards)")
ex("NJ", ["DiversityInclusionLaw"], "not standards (law summary)")
ex("NJ", ["by_Standard", "by_GradeBand"], "re-sorted compilation of the same standards (counted via the 4 grade-band files)")
ex("PA", ["arts_", "career_education", "pa_common_core", "technology_and_engineering"], "not social studies standards")
ex("WI", ["voluntary-national-content-standards-2010"], "older national standards (superseded)")
ex("WI", ["Standards_Revision_and_Review"], "not standards (process chart)")
ex("WA", ["ss-standards-2019_grades", "SocialStudiesScopeandSequence", "OSPI_SocStudies_Standards_MASTER"], "same standards as master PDF in other formats/subsets")
ex("NE", ["Horizontal", "Excel-Version"], "same standards as the PDF in Excel format")
ex("MT", ["SIPL_CSI", "IEFA_Connections"], "PDF subset / excerpt of the Excel standards")
ex("MO", ["curr-MO-standards-ss", "ss-k-12"], "PDF/Excel versions of the same standards (counted via the two Word documents)")
ex("ME", ["Maine_Learning_Results_for_Social_Studies_-_2007", "MLR_-_Social_Studies_Geography", "MLR_-_Social_Studies_History"], "superseded 2007 version / extracts of the 2019 standards")
ex("SD", ["SS-Standards-2015"], "superseded (2015) version")
ex("UT", ["ImplementationTimeline"], "not standards (implementation timeline)")
ex("DC", ["TAL_SSStandards"], "Spanish version of the standards (counted via the English version)")
ex("DC", ["Rubric", "WalkthroughTool", "Supplemental_Lesson", "To_Approve"], "not standards (tools/memo)")
ex("WV", ["readfile_0b6b00"], "scanned PDF (counted via the text-based Word version)")
ex("GA", ["GA Social Studies K-12", "CASE-Social Studies", "GOAL"], "same standards as the CASE items CSV (subset print / JSON / CSV with notes)")
ex("VT", ["rev0617.2_c633fc"], "near-duplicate copy of the same C3 Framework file")
IN_2023 = ["Grade-3-Social-Studies_186ed8", "Grade-6-Social-Studies__", "U.S.-Government_", "U.S.-History_", "indiana-academic-standards-economics", "indiana-academic-standards-grade-7", "indiana-academic-standards-grade-8", "indiana-academic-standards-world-history", "Grade-6-Civics-Course-FAQ"]

rows = list(csv.DictReader(open(ROOT / "data" / "text_stats.csv")))
by = collections.defaultdict(list)
for r in rows: by[r["abbr"]].append(r)

def reason(r, seen):
    f = r["file"]
    if r["abbr"] == "IN":
        if f.startswith("2026-"): pass
        elif any(k in f for k in IN_2023): return "superseded by 2026 version / not standards (FAQ)"
    for ab, sub, why in EXCLUDE:
        if ab == r["abbr"] and sub in f and why: return why
    key = r["text_sha256"]
    if key in seen and int(r["words"]) > 0: return "exact duplicate text of " + seen[key]
    seen[key] = f[:40]
    return ""

def ocr_words(ab, f):
    t = (ROOT / "data" / "text" / ab / (f + ".txt")).read_text()
    return round(len(t) / 5.9)

def fmt_groups(g):
    items = re.findall(r"\[([^\]]+)\]", g)
    cleaned = []
    for it in items:
        it = re.sub(r"\s*\(.*", "", it).strip()
        cleaned.append(it)
    return "[" + ", ".join(cleaned) + "]"

out_rows, counted_total, excl_lines, wc_csv = [], 0, [], []
for ab in sorted(STATES, key=lambda a: STATES[a]):
    seen, counted, nfiles, nall = {}, 0, 0, len(by.get(ab, []))
    for r in sorted(by.get(ab, []), key=lambda x: x["file"]):
        why = reason(r, seen)
        w = int(r["words"])
        wc_csv.append({"abbr": ab, "file": r["file"], "words": w, "counted": "no" if why else "yes", "reason_not_counted": why})
        if why:
            excl_lines.append(f"| {ab} | {r['file'][:70]} | {w:,} | {why} |")
        else:
            counted += w; nfiles += 1
    counted_total += counted
    g, topics, notes = (tuple(N[ab]) + ("",))[:3]
    fully = g.startswith("[0],[1],[2],[3],[4],[5],[6],[7],[8],[9],[10],[11],[12")
    out_rows.append((STATES[ab], ab, fmt_groups(g) if not g.startswith("[no") and not g.startswith("[not") else g, topics, counted, nfiles, nall, notes, fully))

with open(ROOT / "data" / "word_counts.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=wc_csv[0].keys()); w.writeheader(); w.writerows(wc_csv)

individual_all = [r[1] for r in out_rows if r[8]]
k8_ind = [r[1] for r in out_rows if re.search(r"\[0, 1, 2, 3, 4, 5, 6, 7, 8", r[2])]
md = ["# Master Report: State Standards Overview", "",
      "Generated by `scripts/build_master_report.py` from the downloaded documents (`data/raw/`), extracted text, and a read-through of every state's documents. Grades: **0 = kindergarten**; PK = pre-kindergarten.", "",
      "## How to read this", "",
      "**Q1 — Grade groupings.** A grade counts as *individual* if the document gives that grade its own standards/plan (even when the file is printed in K-2 / 3-5 / 6-8 / 9-12 sections, or when grade-band standards carry separate 'by the end of grade X' content for each grade). It counts as *grouped* only when the document writes one plan for several grades (e.g. `6-8`, `K-2`). High-school courses and electives are listed as `9-12` unless the document ties them to a specific grade (e.g. NY, VA, AL, CA). Example: `[0, 1, 2, 3, 4, 5, 6-8, 9-12]`.", "",
      "**Q2 — Topics.** Major subject areas and named courses found in the state's document, taken from its table of contents/strands/course lists (not from keyword frequency).", "",
      "**Q3 — Words.** Whitespace-delimited words in text extracted from the files. Exact duplicates, alternate formats of the same standards (Excel/Word copies, re-sorted compilations), superseded versions and non-standards documents are listed in the exclusions appendix and not counted. Word counts therefore measure the standards themselves, not everything in the folder. See the notes column for states where the count needs care.", "",
      "## Headline numbers", "",
      f"- Jurisdictions covered: {sum(1 for r in out_rows if r[4])} of 51 (Maryland has no files yet).",
      f"- Total counted words: {counted_total:,}.",
      f"- States with a separate plan for every grade K-12 (0-12): {', '.join(individual_all)}.",
      f"- States with a separate plan for every grade K-8: {len(k8_ind)}; the rest group at least some grades below 9.",
      "- Almost every state treats grades 9-12 as one band or as courses; only NY, VA, CA and AL give each high-school grade its own plan.",
      "- Core social science (history, geography, civics/government, economics) appears in every state's standards. Beyond that, broader offerings appear mainly as high-school electives: psychology, sociology (e.g. AL, AR, FL, HI, IA, ND, OK, TN, WV, MS), ethnic/African-American studies (AR, FL, MN, MS, TN), financial literacy (many), Holocaust education (AL, FL, AR). No state's standards document covers arts, physical education or natural sciences as part of social studies; the occasional mention is a cross-curricular connection (e.g. WY, PA's separate arts file was excluded).", "",
      "## Master table", "",
      "| State | Grade groupings (0 = K) | Major topics covered | Words (counted) | Files counted / in folder |",
      "|---|---|---|---:|---:|"]
for name, ab, g, topics, words, nf, nall, notes, fully in out_rows:
    md.append(f"| {name} ({ab}) | {g} | {topics} | {words:,} | {nf} / {nall} |")
md += ["", "## Notes and data-quality flags by state", "",
       "| State | Notes |", "|---|---|"]
for name, ab, g, topics, words, nf, nall, notes, fully in out_rows:
    if notes: md.append(f"| {ab} | {notes} |")
md += ["", "### Corpus gaps still open", "",
       "- **Missing:** MD (no files).",
       "- **Incomplete or unusual:** UT has no grade 7 or 8 files (confirmed no more Utah files will be added); VT has no Vermont-specific 9-12 document (C3 Framework only); OH's per-grade uploads were all the same file; WI's WMAS PDF is a scan and was not read.",
       "- **Not social studies (downloaded by the crawler, not counted):** NJ WIDA ELD files, PA arts/career/tech/common-core files, DC tools, UT timeline.",
       "- **Duplicates / alternate formats / superseded versions kept on disk:** see appendix.", "",
       "## Appendix: files on disk that are not counted in word totals", "",
       "| State | File | Words | Reason |", "|---|---|---:|---|"] + excl_lines
(ROOT / "docs" / "MASTER_REPORT.md").write_text("\n".join(md) + "\n")
print("wrote MASTER_REPORT.md;", counted_total, "counted words;", "fully individual:", individual_all, ";", len(k8_ind), "states K-8 individual")
