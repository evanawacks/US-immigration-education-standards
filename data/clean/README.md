# Clean standards corpus

One row per **state × grade (or grade cluster) × course**, built from the in-scope source documents in `data/raw/`. All text is verbatim from the sources (never retyped); every piece of every in-scope document is accounted for in some row's `body_standards`, `body_examples` or `backup` column.

- Database: `standards.sqlite` (table `standards`) and the same data as `standards.csv`
- One readable file per row: `<ST>/<id>.md`
- Columns, ID convention, grade rule and course vocabulary: [`NAMING.md`](NAMING.md)
- How to check accuracy: [`VALIDATION_GUIDE.md`](../../docs/VALIDATION_GUIDE.md) (scripts write to `data/validation/`)
- 785 rows for 50 states + DC (Maryland has a placeholder row, `MD_NONE`: no source file yet)
- Totals: about 1.24M words of standards text, 0.89M words of examples/clarifications, 0.66M words of backup text (shared text is copied into every row it applies to, so these totals count copies)

## How it was built

1. **Version selection** (`state_config.json`): for each state, the current version of each grade/course document is used; an older version is used only for grades/courses the newer one does not cover (e.g. IN 2023 files for K, 1, 2, 4, 5; MS 2021 Humanities). Exact duplicates, alternate formats of the same standards, superseded editions and non-standards files are skipped, with the reason recorded.
2. **Clean extraction** (`scripts/extract_units.py` → `units/<ST>/`): each document is split into ordered *units*: paragraphs, table cells (tagged with table/row/column so grade columns stay separate), spreadsheet/CSV rows. Repeated running headers/footers are detected and set aside (they are kept in the state's `_ALL` backup).
3. **Structure review and labeling** (`LABELING_GUIDE.md`, `guides/<ST>.md`, `prompts/`, `labels/<ST>/`): every document was read in full and its internal schema written down (`structure` field of each labels file); then every unit was labeled with grade(s), course, and category (standards / examples / backup). Labeling was done by Claude agents (a smaller model reading the full text), one state or one large-document section at a time, against the shared guide plus a state guide; `scripts/check_labels.py` enforces that every unit is labeled exactly once. Reviewer corrections are recorded in each file's `issues`.
4. **Assembly** (`scripts/assemble_clean.py`): labels → rows. Shared content (K-12 practices, band standards) is copied into each grade row it covers; single-grade documents keep band-labeled shared items in their own grade only; exact repeats within a row column are dropped; course titles are standardized (`scripts/course_vocab.py`).
5. **QA** (`scripts/qa_clean.py`): every expected grade cluster has a row; every unit of every used document is found in some row; small/empty rows are flagged.

Rebuild everything after a change:

```
python3 scripts/extract_units.py [ST]      # only needed if source files change
python3 scripts/check_labels.py ST
python3 scripts/merge_label_parts.py ST    # for documents labeled in parts (CA, KY, MA, MS, RI)
python3 scripts/assemble_clean.py [ST ...]
python3 scripts/qa_clean.py
```

## Reviewer decisions worth knowing

- **Band-only states** keep band rows: DE (K-3, 4-5, 6-8, 9-12), NJ, ND (K-2, 3-5, 6-12), NH (K-2, 3-4, 5-6, 7-8, 9-12), WI, WY, WA (WA prints several grades inside one table cell in both its PDF and Word versions, so cells cannot be split by grade).
- **PA** writes civics/history/geography for K-3/4-6/7-9/10-12 but economics/personal finance for K-2/3-5/6-8/9-12, so PA rows are single grades with each band's text copied into every grade it covers.
- **MS**: the PDF contains three editions (2022 current, 2021, 2018 with redlines); only the 2022 text plus the 2021 Humanities course (absent in 2022) are in the body; the rest is in backup.
- **CA**: Appendix C (the 1998 content standards) is `body_standards`; the framework chapters are `body_examples` (narrative), so CA examples columns are large.
- **NE, ND, AZ** high-school strands are not courses → one 9-12 row. **OK, MT** appendices/sheets that duplicate standards printed elsewhere were moved to backup.
- **GA** is built from the CASE export; metadata columns (item type, sequence, grade code, timestamp) are dropped, keeping "code + statement".
- **AL** practice names in the skills tables are images in the PDF and are missing from the text (the skills themselves are present).

## Per-state summary

| State | Rows | Grade rows (clusters) | Course rows | Standards words | Examples words | Backup words |
|---|---:|---|---:|---:|---:|---:|
| AK | 17 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 6 | 29,739 | 0 | 9,611 |
| AL | 23 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 9 | 33,047 | 8,402 | 13,827 |
| AR | 21 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 11 | 44,540 | 4,458 | 14,277 |
| AZ | 11 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 0 | 18,416 | 3,788 | 2,995 |
| CA | 28 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 14 | 26,170 | 344,494 | 167,556 |
| CO | 12 | PK, K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 0 | 15,527 | 29,054 | 2,813 |
| CT | 13 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 3 | 14,007 | 1,408 | 8,546 |
| DC | 16 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 5 | 62,235 | 9,622 | 2,310 |
| DE | 5 | K-3, 4-5, 6-8, 9-12 | 0 | 3,509 | 4,584 | 12 |
| FL | 22 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 12 | 26,410 | 29,593 | 5,591 |
| GA | 34 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 23 | 34,485 | 0 | 41,416 |
| HI | 28 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 18 | 17,407 | 13,946 | 10,603 |
| IA | 19 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 8 | 10,712 | 41,493 | 28,483 |
| ID | 16 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 7 | 15,364 | 0 | 2,057 |
| IL | 13 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 4 | 15,827 | 0 | 4,839 |
| IN | 17 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 7 | 16,613 | 176 | 6,747 |
| KS | 21 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 10 | 19,481 | 19,799 | 11,750 |
| KY | 15 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 5 | 9,545 | 51,314 | 12,866 |
| LA | 15 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 4 | 21,475 | 935 | 2,102 |
| MA | 20 | PK, K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 8 | 64,108 | 41,736 | 39,825 |
| MD | 1 | — | 0 | 0 | 0 | 0 |
| ME | 9 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 0 | 10,194 | 0 | 2,622 |
| MI | 15 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 4 | 34,073 | 14,196 | 11,157 |
| MN | 11 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 0 | 25,286 | 0 | 1,248 |
| MO | 15 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 6 | 17,719 | 0 | 124 |
| MS | 27 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 17 | 25,378 | 0 | 67,553 |
| MT | 9 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 0 | 3,474 | 0 | 2,996 |
| NC | 14 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 4 | 9,409 | 4,121 | 3,044 |
| ND | 4 | K-2, 3-5, 6-12 | 0 | 4,705 | 6,409 | 8,866 |
| NE | 11 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 0 | 11,775 | 4,897 | 1,119 |
| NH | 6 | K-2, 3-4, 5-6, 7-8, 9-12 | 0 | 18,719 | 13,745 | 10,328 |
| NJ | 5 | K-2, 3-5, 6-8, 9-12 | 0 | 22,278 | 6,753 | 4,837 |
| NM | 18 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 7 | 21,768 | 695 | 2,671 |
| NV | 15 | K, 1, 2, 3, 4, 5, 6-8, 9-12 | 8 | 9,408 | 1,772 | 1,522 |
| NY | 19 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 5 | 36,308 | 18,074 | 20,967 |
| OH | 16 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 6 | 8,213 | 13,551 | 3,862 |
| OK | 21 | PK, K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 10 | 51,661 | 1,194 | 13,999 |
| OR | 12 | K, 1, 2, 3, 4, 5, 6-7, 8, 9-12 | 2 | 16,304 | 17,698 | 1,519 |
| PA | 14 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 0 | 62,203 | 0 | 9,788 |
| RI | 16 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 5 | 73,941 | 16,889 | 6,890 |
| SC | 18 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 7 | 25,370 | 16,476 | 10,264 |
| SD | 15 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 5 | 40,307 | 0 | 3,572 |
| TN | 22 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 11 | 42,482 | 2,681 | 7,071 |
| TX | 27 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 17 | 40,730 | 14,273 | 3,697 |
| UT | 14 | K, 1, 2, 3, 4, 5, 6, 9-12 | 6 | 11,942 | 9,422 | 6,982 |
| VA | 14 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 0 | 18,617 | 1,370 | 2,816 |
| VT | 15 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 4 | 37,360 | 99,867 | 39,764 |
| WA | 5 | K-2, 3-5, 6-8, 9-12 | 0 | 12,206 | 13,389 | 5,399 |
| WI | 5 | K-2, 3-5, 6-8, 9-12 | 0 | 16,194 | 0 | 4,382 |
| WV | 21 | K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12 | 10 | 29,309 | 1,887 | 3,374 |
| WY | 5 | K-2, 3-5, 6-8, 9-12 | 0 | 6,946 | 1,360 | 10,592 |
