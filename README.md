# US Immigration Education Standards

**What this project asks:** what do U.S. public-school students learn about immigration? We collect the official K-12 social studies, civics, and history standards from all 50 states and DC, turn them into a clean database organized by state, grade, and course, and analyze how they cover immigration (word use, semantics, and specific topics such as Chinese Exclusion, the Great Migration, and immigration from Mexico). The findings will be presented as a static report and an interactive page.

## Where things stand

| Phase | Status |
|---|---|
| 1. Collect the standards documents | Done for 50 of 51 jurisdictions; **Maryland is still missing**. 253 files collected, 155 used (current versions only). |
| 2. Build the clean database | Done: **785 rows** (one per state × grade or grade band × course; 288 course rows) with standards text, examples text, a backup column, and an issues column. All text is verbatim from the sources. |
| — Validation | Automated checks run and passing; the human review (source checklist and a 952-item audit sample) is ready to be filled in. |
| 3. Analysis | Started: R notebook `Text_Analysis.Rmd`, and a list of 106 immigration topics with search terms. |
| 4. Report and interactive page | Not started. |

## Resource center: the main documents

| Document | What it is | Why it exists |
|---|---|---|
| [docs/roadmap.md](docs/roadmap.md) | The project plan: goals, decisions, the four phases, open questions, and status updates. | Keeps everyone aligned on scope and on decisions already made (storage, database, stack). |
| [docs/MASTER_REPORT.md](docs/MASTER_REPORT.md) | A survey of every state's documents: how grades are grouped, which topics and courses are covered, and word counts. | First look at the corpus; it shaped the grade clusters and flagged missing or odd files. Built by `scripts/build_master_report.py`. |
| [docs/FILES_TO_COLLECT.md](docs/FILES_TO_COLLECT.md) | Files still to be fetched by hand, with the original links. | Tracks gaps in the corpus (currently Maryland, plus optional cleaner copies). |
| [docs/VALIDATION_GUIDE.md](docs/VALIDATION_GUIDE.md) | How to check that the data is accurate: (1) the sources, (2) the text read from each document, (3) the database against the originals. It includes automated checks, results, and a human review procedure. A rendered copy is in [docs/VALIDATION_GUIDE.html](docs/VALIDATION_GUIDE.html). | Errors can enter at many steps; this lists each one and how it is caught. |
| [docs/Evans_Notes.md](docs/Evans_Notes.md) | Evan's own observations, recorded word for word. | A place for the researcher's notes; it is only added to on Evan's instruction. |
| [data/clean/README.md](data/clean/README.md) | Guide to the clean database: how it was built, how to rebuild it, reviewer decisions, and a per-state summary. | The starting point for anyone using `standards.sqlite` / `standards.csv`. |
| [data/clean/NAMING.md](data/clean/NAMING.md) | The naming convention: row IDs (e.g. `NY_11_USHistory`), the grade rule, column definitions, and the standardized course vocabulary. | Lets rows be compared across states even though every state names grades and courses differently. |
| [data/clean/LABELING_GUIDE.md](data/clean/LABELING_GUIDE.md) | Rules used to label every piece of text with grade, course, and category (standards / examples / backup). | Makes the labeling consistent and repeatable, and is the reference when correcting a label. |
| [data/reference/immigration_topics.md](data/reference/immigration_topics.md) | 106 immigration topics and events by era, with descriptions and search terms (also as `.csv`). | The dictionary for the Phase 3 topic analysis. |
| [inbox/README.md](inbox/README.md) | How to drop manually downloaded files for processing. | The hand-off point for files that cannot be downloaded automatically. |

Supporting material, not listed individually: per-state notes on each document's structure (`data/clean/guides/`), the instructions given to the labeling agents (`data/clean/prompts/`), and one readable file per database row (`data/clean/<ST>/`).

## Key data files

| File | Contents |
|---|---|
| `data/clean/standards.sqlite` / `standards.csv` | **The database.** Columns: `id, state, grade, course, course_category, course_title, body_standards, body_examples, backup, source_files, issues`. |
| `data/raw/<ST>/` | The original documents as downloaded or uploaded. |
| `data/manifest.csv` | Every source file with its URL, download date, and SHA-256 fingerprint. |
| `data/clean/state_config.json` | Per state: which files are used or skipped (and why), and the grade clusters for its rows. |
| `data/clean/units/`, `data/clean/labels/` | The clean text of each document split into numbered pieces, and the grade/course/category label for each piece. These are the building blocks of the database. |
| `data/validation/` | Results of the validation checks and the review worksheets (`sources.csv`, `audit_sample.csv`). |
| `sources/US_State_Social_Studies_Standards.xlsx - State Standards.csv` | The original list of states, documents, and links the project started from. |
| `data/text/` (not in git), `data/text_stats.csv`, `data/word_counts.csv` | Plain-text extraction used for the master report and word counts. |

## Repository layout

```
README.md                 this page
docs/                     project documents (roadmap, reports, guides, notes)
sources/                  original link spreadsheet and manual URL overrides
inbox/                    drop folder for manually downloaded files
data/
  raw/<ST>/               original documents
  clean/                  clean database and everything used to build it
  validation/             validation results and review worksheets
  reference/              reference lists (immigration topics)
scripts/                  Python pipeline (see below)
Text_Analysis.Rmd         R analysis notebook (open with US-immigration-education-standards.Rproj)
requirements.txt          Python packages
```

## Scripts by step

| Step | Scripts |
|---|---|
| Collect | `download.py` (download/crawl from the link list), `register_manual.py` (add files from `data/raw/`) |
| Survey | `extract_text.py`, `build_master_report.py` (+ `report_notes.py`) |
| Clean database | `extract_units.py` → labels (agents, checked by `check_labels.py`; large documents split with `split_ranges.py` and joined with `merge_label_parts.py`) → `assemble_clean.py` (uses `course_vocab.py`) → `qa_clean.py`; `state_status.py` shows progress |
| Validate | `validate_sources.py`, `validate_extraction.py`, `validate_dataset.py`, `audit_pages.py` |

## Quick start

```
pip install -r requirements.txt
python3 scripts/assemble_clean.py          # rebuild the database from the labels
python3 scripts/validate_dataset.py        # check the database against the sources
```

To analyze in R, open `US-immigration-education-standards.Rproj` and run `Text_Analysis.Rmd`, which reads `data/clean/standards.csv`.
