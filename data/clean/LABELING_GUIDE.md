# Labeling guide (shared by every state)

Goal: assign every unit of every in-scope source document to a **grade (or grade cluster)**, an optional **course**, and one **category**. Text is never retyped; the database is assembled from the unit IDs you label, so the output stays verbatim.

## Inputs

- `data/clean/units/<ST>/<file>.view.txt` — the document as numbered units:
  - `u12 text` — a paragraph / text block
  - `u13 [T1 R2 C3] text` — a table cell (table 1 on that page, row 2, column 3). Use the header row of the same table to know which grade/strand a column is.
  - `u14 (x=320) text` — a text block that sits side by side with others on the page; `x` is its horizontal position (use it like a column).
  - `u15 [R7] a | b | c` — a spreadsheet / CSV row.
  - `=== page 12 === [running header: Grade 5 | Civics ...]` — page marker. Running headers/footers are removed from the units but shown here as context (they often tell you which grade the page belongs to). They go to backup automatically; do not label them.
- `data/clean/guides/<ST>.md` — the state guide (which files to use, the grade clusters the state's rows should use, structure notes).

## Output: one JSON file per document

`data/clean/labels/<ST>/<file>.labels.json`

```json
{
  "state": "AR",
  "file": "AR_Grades_K-4_Social_Studies_Standards_2022_LS.pdf",
  "structure": "Short description of the document's internal schema: how grades/courses/strands/standards are organized, tables, codes (e.g. C.1.K.1 = strand.standard.grade.number), where examples/teacher notes sit.",
  "labels": [
    {"units": "u1-u48",   "grades": "all", "course": null, "cat": "backup",    "section": "Cover, intro, how to read"},
    {"units": "u49-u57",  "grades": "K-12","course": null, "cat": "standards", "section": "K-12 disciplinary standards overview (C.1, E.1, G.1, H.1)"},
    {"units": "u71",      "grades": "K",   "course": null, "cat": "standards", "section": "Civics column header: Kindergarten"},
    {"units": "u162-u163","grades": "5",   "course": null, "cat": "examples",  "section": "Teacher note under G.3.5.5"}
  ],
  "issues": ["u300-u310: table columns merged in extraction; grade assignment inferred from standard codes"]
}
```

Rules for `labels`:

1. **Every unit ID in the view must be covered exactly once.** List ranges in document order; `"u5"` or `"u5-u9"` (inclusive). Units that are not in the view (furniture) are handled automatically. Do not leave gaps — if unsure, label it and add an `issues` entry.
2. **grades** — the grade(s) the unit's content is taught in. Use `PK`, `K`, `1`…`12`; ranges `K-2`, `6-8`, `9-12`; lists `7,8`; or `all` (= every grade this document covers; use for intros and document-wide backup).
   - A unit that applies to several grades (K-12 inquiry skills, a K-2 band standard, a table row header shared by all grade columns) gets the full range; the assembler copies it into each grade row it applies to.
   - Grade-specific text inside a band (e.g. "By the end of grade 1: …", a code like `SS.1.1.21.1`, a "Grade 3" table column) gets that single grade.
   - High-school courses: `9-12` unless the document ties the course to a grade (e.g. NY "Grade 11: US History and Government" → `11`).
3. **course** — `null` for grade-level (non-course) content. For course-based content (mostly high school and some middle school), the course title **as written in the document** (e.g. `"U.S. History Since 1929"`, `"Psychology"`, `"Grades 7/8 Arkansas History"` → `"Arkansas History"`). Use exactly the same string for every unit of that course. Shared high-school skills that apply to all HS courses: `course: null, grades: "9-12"`.
4. **cat** — one of:
   - `standards` — the formal content standards students learn: standard/benchmark/indicator/expectation statements (with their codes), the grade/course title and theme, and the strand/standard/topic headings that organize them, inquiry / social-studies-practice / skills standards (e.g. C3 Dimension 1/3/4 indicators, "Social Studies Practices") that students are expected to do — label them with the grade range they apply to so they are copied into each grade, plus content lists that are part of the standard itself (e.g. "● Civic documents, symbols, holidays, and songs" in a grade column; "including: a) …, b) …").
   - `examples` — content-related support that is not the standard itself: examples/e.g. lists set apart from the standard, clarifications, "teacher notes", "disciplinary clarifications", "instructional support", suggested/possible topics, guiding or compelling questions, content narrative describing what students study (framework chapters), key vocabulary/concepts, suggested primary sources, content-specific progressions.
   - `backup` — everything else: cover, table of contents, acknowledgments, committee lists, letters, legal/statutory text, introductions, philosophy, how-to-read/coding explanations, general pedagogy and instructional strategies not tied to specific content, literacy-in-history standards (CCSS RH/WHST), assessment/implementation information, resource/reference lists, glossaries, appendices that are not standards, document-wide headers.
   - When one unit mixes a standard with its e.g. list, label it `standards` (units are not split).
5. **section** — a short human-readable location (strand > standard > topic). It is metadata only; it is never inserted into the text.
6. **issues** — anything uncertain or broken: garbled/merged extraction, columns that could not be told apart, text in the wrong order, missing pages, content that might belong to a different grade, pages that are images, etc. Always include unit IDs.

## Working method

1. Read the state guide and the whole view of the document (or your assigned unit range) before labeling. Work out the document's internal schema first (how grades, courses, strands, standard codes, and example blocks are marked), write it in `structure`, then label.
2. Use the evidence in this order: explicit grade/course headings and table column headers → standard codes → running headers → position in the document.
3. Do not guess silently. If a block could belong to more than one grade, pick the best-supported one and add an issue.
4. Write valid JSON (no comments, no trailing commas). Run `python3 scripts/check_labels.py <ST>` and fix every reported gap/overlap before finishing.
