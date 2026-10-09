# Validation guide — is the dataset accurate?

The clean dataset (`data/clean/standards.sqlite` / `.csv`) went through many steps, and each one is a place where an error could creep in. This guide works through them in three levels, matching the questions to ask:

1. **Data source** — did we get the right document (official, current, complete, unaltered)?
2. **Original document contents** — did we read everything in that document correctly (no lost, garbled, or invented text)?
3. **Standardized dataset vs. original** — does each row contain exactly the right text, under the right state / grade / course / category?

Each level has **automated checks** (scripts, run in minutes, already run once — results below) and **human checks** (a person comparing against the original). The automated checks narrow the human work down to a list of flagged items plus a random sample.

---

## Where errors could have entered

| Stage | What could go wrong | Caught by |
|---|---|---|
| Link list (spreadsheet) | Link points to a non-official copy, an old version, or a draft | 1-A, 1-B |
| Download / crawl | Wrong file picked from a page, an HTML error page saved as PDF, partial download | 1-A (hash, file type), 1-B |
| Manual uploads | Wrong file, mislabeled state, same file uploaded under several names (Ohio), no source URL recorded | 1-A, 1-B |
| Version selection | Superseded version used, or a newer version dropped content an older one had | 1-B, 3-D |
| Text extraction | Text inside images missed, table columns mixed up, words garbled/duplicated, scanned pages | 2-A, 2-B |
| Splitting into units | One unit mixing two grades or two categories (units are never split later) | 2-B, 3-C, 3-D |
| Labeling (Claude agents) | Wrong grade, wrong course, wrong category (standards / examples / backup), text skipped | 3-B, 3-C, 3-D |
| Assembly | Shared text copied into the wrong grades, duplicates removed that should stay, text dropped | 3-A, 3-B, 3-E |
| Standardization | Course mapped to the wrong standard name/category | 3-F |

---

## Running the automated checks

```
python3 scripts/validate_sources.py       # Level 1  -> data/validation/sources.csv
python3 scripts/validate_extraction.py    # Level 2  -> data/validation/extraction_docs.csv, extraction_pages.csv  (~10 min)
python3 scripts/validate_dataset.py       # Level 3  -> data/validation/dataset_checks.csv, dataset_findings.csv, audit_sample.csv
python3 scripts/audit_pages.py [ST ...]   # builds side-by-side review pages in data/validation/audit_html/ (local only)
```

Re-run all of them after any fix (relabel, new file, re-extraction). Results below are from the run on 2026-10-09.

---

## Level 1 — Validate the data source

### 1-A Automated (`validate_sources.py`)

For every file the dataset uses: file still present, SHA-256 identical to the hash recorded at download (detects accidental edits/replacement), file content matches its type (a "PDF" that is really an HTML error page fails), where it came from (URL and domain), and whether the dataset covers every grade K-12 for the state.

**Current result:** 156 files checked. All present, hashes unchanged, all genuine PDF/Word/Excel/CSV.

| Finding | States | What to do |
|---|---|---|
| No source file | MD | Obtain Maryland's standards |
| Grades missing from the dataset | UT (7, 8) | Known: no Utah 7-8 files will be added |
| Manual uploads with no source URL recorded (84 files) | 24 states, e.g. AR, CA, GA, HI, NC, OH, TX, UT, VT | Record the URL each file came from (1-B step 5) |
| Not hosted by the state education agency | NH (file hosted by the NH Historical Society), NV (Azure file host), VT (national C3 Framework from NCSS) | Confirm against the state's own site (1-B) |

### 1-B Human checklist (one line per file in `data/validation/sources.csv`)

For each state, open the state education agency's social studies standards page (the `spreadsheet_page` column) and fill in the `REVIEW_` columns:

1. **Official publisher** — the document is published by the state education agency or board (not a district, vendor, or third-party mirror). *Watch:* NH, NV, VT.
2. **Current version** — it is the version in force today. Compare the adoption/revision date printed on the document with the agency page; look for newer revisions or drafts. *Known to check:* NE (revision expected fall 2026), TN (new standards effective 2027-28), ND (2026 draft), ID (2026 revision), WI (review started 2025), MD (revisions requested 2025), GA (spreadsheet says 2026; the CASE export appears to be the 2021 GSE).
3. **Complete** — every document the state lists for social studies K-12 is in the corpus: each grade, each high-school course, Pre-K if applicable. Compare the agency page's list with the `file` column. *Known gaps:* UT 7-8. *Known oddities:* OH (all 14 uploads were the same complete document), MS (one PDF with three editions), IN (2023 + 2026 files mixed by design).
4. **Same file** — the file on disk is the one currently posted: download it again and compare (page count, date on cover; ideally `sha256sum` — the first 16 characters are in the `sha256` column). A changed hash means the state has replaced the document.
5. **Source recorded** — for manual uploads, write the URL the file was downloaded from into `REVIEW_notes` (and, if you like, into `data/raw/<ST>/sources.txt` as `<filename> <url>` so `register_manual.py` records it).

**Pass:** every row has yes / yes / yes, or a written explanation.

---

## Level 2 — Validate the original document contents

### 2-A Automated (`validate_extraction.py`)

Each document is read a second time by an **independent** program (Poppler's `pdftotext` for PDFs — a different engine from the PyMuPDF used to build the dataset; the raw Word XML for .docx; the csv module for .csv) and compared page by page:

- **recall** — share of the second program's words that are also in our extraction (low → text lost)
- **precision** — share of our words the second program also found (low → garbled or duplicated text)
- pages with almost no text (possible scans or graphics) and pages mostly covered by images (text inside images is invisible to both programs)

**Current result:** 155 documents, 6,874 PDF pages, overall recall **99.7%**; no document below 97% recall.

| Flag | Count | Notes from the first review |
|---|---:|---|
| Pages with possibly lost text (recall < 90%) | 22 | Mostly false alarms: decorative covers (WI p1), spaced-out lettering (KS, SD), URL lists in backmatter (CA p854). MS p348 is in the superseded edition (backup). Each should still be glanced at. |
| Pages with almost no text | 112 | Blank/divider pages or graphics — check that none is a scanned page of standards. |
| Pages ≥ 15% covered by images | 248 | Text that exists only inside an image is not in the dataset. **Known:** AL practice names in the skills tables. |
| Low precision (duplication/garbling) | MO .docx (56%), NH (81%), WI (83%), PA (85-90%), HI financial literacy (89%) | MO repeats merged table cells; NH/WI/PA have duplicate loose fragments of table text (labeled backup). Level 3-A confirms none of this duplication reached the dataset rows twice. |
| Fixed during this validation | WA | A text box (state law, RCW 28A.150.210) was skipped; it is now recovered and in backup. |

### 2-B Human checks

1. **Every flagged page** in `data/validation/extraction_pages.csv` (`flag` not empty): open the PDF at that page and compare with the extracted text (`data/clean/units/<ST>/<file>.view.txt`, search `=== page N ===`). Record whether anything that matters (standards, examples) is missing or wrong.
2. **Image-heavy pages:** look for text that is only inside images (logos and decorations don't matter; standards, codes, practice names, tables do). Note them; OCR can recover them if needed.
3. **Random pages:** for each document, check 2 random pages the same way (a page is "correct" if every sentence on the page appears, in readable order, in the view file).
4. **Tables with grade columns** (AR, AK, ME, ND, NH, PA, WY, WI, IL, MO, NE, IA): on 3 table pages, check that each cell's column tag (`[T1 R3 C4]`) matches the grade column it sits under on the page.

**Pass:** no unexplained missing standards text; every image-only text is listed as a known issue.

---

## Level 3 — Validate the standardized dataset against the original

### 3-A Traceability: nothing invented or altered (automated)

Every line stored in `body_standards`, `body_examples`, and `backup` must be identical (apart from whitespace and case) to a piece of extracted text from that state's source files. Text is never retyped, so any mismatch means corruption.
**Current result: 0 untraceable lines.**

### 3-B Completeness: nothing dropped (automated)

Every piece of extracted text from every used file must appear in at least one row.
**Current result: 0 missing units.**

### 3-C Grade placement: standard codes (automated)

Most states print a grade inside each standard's code (AR `H.3.4.2`, KY `4.H.CH.1`, GA `SS4H1`, NJ `6.1.5…` …). For 30 states the script checks that each coded standard sits in a grade row that includes that grade.
**Current result: 7,933 coded standards checked; 0 misplaced.** 9 mismatches are typos in the source documents themselves (AR grade 7 prints its geography codes as `G.1.5.x`; AK grade 4 has two `SS.3.4.*` codes) and are noted in those rows' `issues`.
States without grade-coded standards (TX, OH, OK, MN, PA, FL, WI, WY, VA, CA …) depend on 3-D and 3-E.

### 3-D Human audit sample

`data/validation/audit_sample.csv` holds a fixed random sample (seed 7) of **952 units: about 19 per state** (60% standards, 20% examples, 20% backup). For each unit it shows the text, the file and page, and the grade, course, and category it was given.

How to review:
1. Run `python3 scripts/audit_pages.py <ST>` and open `data/validation/audit_html/<ST>.html`: each item shows the original page image with the text highlighted in yellow, next to what the dataset says about it.
2. Fill the `REVIEW_` columns: text matches the original (y/n), grade correct (y/n), course correct (y/n), category correct (y/n), and the correct value if wrong. Judge category by the rules in `data/clean/LABELING_GUIDE.md` (standards = what students must learn; examples = clarifications, examples, teacher notes, narrative; backup = everything else).
3. Compute error rates per state and overall (count of "n" / items reviewed).

**Pass (suggested):** overall grade error ≤ 2% and category error ≤ 5%; no single state above 10% on either. With ~950 items, an observed 2% error rate has a 95% margin of about ±1 point overall; per state (~19 items) the sample only catches large problems, so a state with 2+ errors gets a second, larger sample (`python3 scripts/validate_dataset.py --per-state 60 --seed 8 --out audit_sample_round2.csv`) before deciding to relabel it.

### 3-E Row-level read-through (human)

Pick **one grade row and one course row per state** (start with the grades/courses you care most about for the immigration analysis — e.g. the US history grades). Open `data/clean/<ST>/<id>.md` beside the original document's section for that grade/course and check:
- every standard in the original section is in `body_standards` (count them — standard numbers help);
- nothing from another grade/course is in the row (shared skills/practices copied on purpose are fine — see `data/clean/NAMING.md`);
- examples/clarifications landed in `body_examples`, not in `body_standards`;
- the order is readable (table text can be fragmented; that's an extraction limitation, not an error, as long as nothing is missing).

### 3-F Structure and naming checks (human, quick)

- `data/clean/README.md` per-state table: does each state have the rows you expect (grades, bands, courses)? Compare with the original document's table of contents.
- `data/clean/NAMING.md` course vocabulary: does each course title map to a sensible standardized course and category?
- Reviewer decisions that changed the default handling (listed in `data/clean/README.md` and each row's `issues`): WA/DE/NJ/ND/NH/WI/WY band rows; PA single grades with band text copied; MS older editions to backup; OK/MT duplicated appendices to backup; AZ/NE/ND high school as one 9-12 row; CA framework narrative as examples; RI "Learning Assessment Objectives" as standards; VT and NE judgment calls. Confirm you agree with each.

---

## Recording results and fixing problems

- Write findings in the `REVIEW_` columns of `sources.csv` and `audit_sample.csv`, and add a dated line per state to a `VALIDATION_LOG.md` (what was checked, by whom, result).
- **Wrong grade/course/category:** edit that unit's entry in `data/clean/labels/<ST>/<file>.labels.json` (the unit ID is in the audit sheet), then run `scripts/check_labels.py <ST>`, `scripts/assemble_clean.py <ST>`, and the three validation scripts.
- **Missing or garbled text:** fix the extraction (or add an OCR'd/text version of the file), re-run `scripts/extract_units.py <ST>`; if unit IDs shift, that state's labels must be redone.
- **Wrong/old source document:** replace the file in `data/raw/<ST>/` (via `inbox/`), update `data/clean/state_config.json`, extract, label, assemble, validate.
