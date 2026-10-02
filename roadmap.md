# Roadmap

**Goal:** Understand how U.S. public-school standards (social studies, civics, history) address immigration, state by state and grade by grade.

## Decisions so far

| Topic | Decision |
|---|---|
| Scope | 50 states + DC; social studies / civics / history standards, multi-grade documents |
| Source list | `US_State_Social_Studies_Standards.xlsx - State Standards.csv` (51 rows; 20 direct PDF links, 31 landing web pages) |
| Downloading | Semi-automated: script fetches direct files and crawls landing pages for PDF/DOCX/XLSX links; stragglers are fixed by hand via an override CSV |
| Storage | `data/` is git-ignored (raw files + database). A manifest with URLs, hashes and dates is committed so downloads are reproducible |
| Database | SQLite (single local file, FTS5 full-text search). Expected size: well under a few GB |
| Stack | Python for pipeline + analysis; static report (HTML) + interactive static page (deployable to GitHub Pages) |

## Open questions (to resolve as we reach each phase)

- Phase 2: Should high-school courses (e.g. U.S. History, Government) be mapped to grades 9–12, or kept as named courses?
- Phase 2: How do we treat grade bands (K-2, 6-8)? Proposed: store the band as-is and also expand to individual grades.
- Phase 2: Scanned PDFs / DOCX / Excel: is OCR acceptable if needed?
- Phase 3: Do we want a hand-labeled sample to validate the immigration classifier?
- Phase 3: Which topic list is canonical (Chinese Exclusion, Great Migration, Mexican immigration, Ellis Island, Irish/German, Japanese internment, refugees, border/citizenship, ...)?
- Phase 4: Is the audience researchers, educators, or the general public?

## Phase 1 — Acquire documents  ← *current*

**Output:** `data/raw/<ABBR>/...` files and `data/manifest.csv`.

1. Read the source CSV; normalize into a `sources` table.
2. Direct links (PDF): download with retries, polite delay, browser-like User-Agent; verify the file is a real PDF (magic bytes, not an HTML error page).
3. Landing pages: fetch the HTML, extract candidate links to `.pdf/.docx/.doc/.xlsx`, score them (social studies keywords, grade tokens), download the matches.
4. Pages that fail (JS-rendered, bot-blocked, "under construction"): log them to `data/needs_manual.csv`; supply URLs in `manual_overrides.csv`, which the script merges in on the next run.
5. Record per file: state, source URL, local path, content type, size, SHA-256, download timestamp, HTTP status, how it was found (direct / crawled / manual).
6. Respect the notes in the CSV (e.g. MD under construction, ND/NE/TN/WI revisions pending; prefer the current in-force standards and flag drafts).
7. Verification: every state has ≥1 file, manifest has no duplicate hashes by accident, spot-check page counts.

**Done when:** all 51 jurisdictions have at least one valid document, or an explicit documented reason why not.

## Phase 2 — Build the corpus database

**Output:** `data/corpus.sqlite`, plus a documented schema.

1. Text extraction per file type (PDF via PyMuPDF/pdfplumber; DOCX via python-docx; HTML where needed; OCR fallback for scanned pages), keeping page numbers.
2. Tables: `jurisdictions`, `documents`, `pages`, `chunks`, `chunk_grades`.
3. Chunking along the document's own structure where possible (standard / benchmark / indicator codes), falling back to headings, then fixed-size windows with overlap.
4. Grade & subject assignment: from filename/title, heading context, and standard codes (e.g. `6.H.2`, `HS.C.3`). Handle three layouts: one file per grade, one file per grade band, one file for all grades. Each state gets a per-state parsing profile (config, not ad hoc code).
5. QA: per-state coverage report (grades found vs. K-12 expected, chunk counts, extraction-quality flags), manual review queue for low-confidence assignments.
6. FTS5 index for keyword search.

**Done when:** every state has chunks tagged with grade(s) and the coverage report shows no unexplained gaps.

## Phase 3 — Analysis

**Output:** reproducible notebooks/scripts and result tables in `data/results/`.

1. Baseline: word frequencies, TF-IDF, word clouds per state / grade band / region (with standards boilerplate stop-words).
2. Immigration relevance: keyword/lexicon pass, then embedding-based semantic scoring; validate against a hand-labeled sample.
3. Topic tagging: Chinese Exclusion, Great Migration, immigration from Mexico, Ellis Island/Angel Island, Irish/German migration, Japanese American incarceration, refugees/asylum, naturalization/citizenship, border policy, nativism, etc. (lexicon + semantic similarity to topic descriptions).
4. Comparative metrics: share of standards touching immigration by state and grade, depth vs. mention, framing/sentiment, which groups are named, which time periods.
5. Sanity checks on false positives ("migration" of animals, "immigrant" in a vocabulary list).

## Phase 4 — Report and interactive site

**Output:** static report + interactive page in `site/`.

1. Static report: methods, data caveats, headline findings, per-state appendix.
2. Interactive page: US map, state/grade/topic filters, word clouds, quote browser that links back to the source document and page.
3. Static build deployable to GitHub Pages; data shipped as JSON/Parquet generated from the SQLite DB.

## Cross-cutting

- Reproducibility: pinned `requirements.txt`, one `make`/CLI entry point per phase.
- Provenance: every chunk traces back to document, page, and source URL.
- Versioning: standards change (several states are mid-revision), so record the retrieval date and the adoption year of each document.
- Legal/ethical: public documents; be polite to servers (rate limits, robots awareness).

## Manual download format (Phase 1)

For any state listed in `data/needs_manual.csv` (blocked or JS-only sites):

1. Save files into `data/raw/<ABBR>/` using the two-letter postal code in uppercase (e.g. `data/raw/FL/`, DC = `DC`).
2. Keep the original filename (don't rename; grade info in names like `Grade_5.pdf` is used later). Accepted: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, or a saved `.html` page when the standards only exist as web pages.
3. Optional: add `data/raw/<ABBR>/sources.txt` with one line per file: `<filename> <source url>`.
4. Run `python scripts/register_manual.py` to add them to `data/manifest.csv` (deduped by SHA-256).
