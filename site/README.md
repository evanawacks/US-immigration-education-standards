# Website (Immigration Standards Explorer)

A static site, served straight from this branch, that gives access to the clean database and lets you check
every line of it against the source document.

- **Database**: filter the 785 rows by state, grade and course category, search IDs or the full text, and open a row. Every
  line of a row links to the unit (paragraph, table cell, or spreadsheet row) it was copied from.
- **Documents**: one row per state that opens to its files, with the reason a file was not used, which file is a main
  document or a part of one, and "Read all together".
- **Reader** (`#/doc/<ST>`: all of a state's used documents one after the other; `#/doc/<ST>/<n>`: document n only;
  `#/doc/<ST>/<n>/u12`: unit 12 of document n). The **Focus** menus narrow every pane, including the Topics pane's
  tags, to one document and/or one grade (the units in that grade's database rows). Panes, each can be turned on or off:
  1. **Original**: the PDF pages (Word files rendered to PDF with LibreOffice; spreadsheets shown as their sheets), with a
     box over each unit colored by its label (blue standards, amber examples, grey backup).
  2. **Clean text**: the document as numbered units, with each label (category, grades, course, section).
  3. **Database text**: a database row this document feeds, line by line, with the source of each line.
  Clicking a unit in any pane highlights the same text in the other two. The URL (`…/u123`) links to that unit.

- **Topics** and **Charts** count the **standards text only**; examples and backup are tagged too but appear only in
  the viewer's Topics pane.
- **Topics** (`#/topics`): the 106 immigration topics, numbered and grouped by era, with how many sentences each is
  tagged in. Open a topic to see every sentence, by state and document, linked to the viewer.
- **Charts** (`#/charts`): filters for states, regions, grade (a single grade leaves bands out), topics, the
  minimum similarity score, and an option to skip a topic repeated within N words (default 25) in the same document;
  tag counts, tags per 10,000 words, or distinct topics; a map (tags per 10,000 words or count; linear, log, or quintile categories),
  a state × era (or topic) heat map of how each state's tags are distributed, and a line graph over grades (bands as
  their own points) for all selected states, by region, or for up to 8 states, as state averages or raw totals.
- **Charts** also has **Grades and bands by state**: one chart with a row per selected state (or states grouped by
  region, or regions added up) and grades Pre-K to 12 across; a dot per single grade and, for a band (K–2, 9–12…), a
  line with a dot at each grade it covers, on its own lane; dots are shaded relative to the row's own highest value.
  **State summary** gives one state's totals, rank, keyword matches, share of text written for bands, top topics, eras
  against the selected states, and a grade-by-grade table. The grade line graph marks under each grade how many states
  wrote it only inside a band ("band only +N").
- **Database** shows each row's topic tags and keyword matches (standards text) and can be narrowed to
  rows with a topic or a keyword; `topics/rowtags.json` maps rows to tags.
- After changing the site, bump `VER` in `site/app.js` and the `?v=` on the scripts in `index.html`, so browsers do not
  keep the old files.
- **Keywords** (separate from the 106 topics), found by plain text search (`scripts/keyword_tags.py`): "immigra"
  (words starting with it: immigration, immigrant…; `#/topics/kw`, `kw` tags in the viewer) and "migra" (words
  containing it: migration, migrant, emigration, immigration…; `#/topics/kw-migra`, `mg` tags). Listed on their own at
  the top of **Topics**, chosen with **Count** on **Charts**, and kept in step with `KWS` in `site/analysis.js`.
- **Main documents and subfiles**: where one document holds the text of others of the same state (Maine), the
  subfiles count on their own and the main document's copy is not counted again (`scripts/doc_parts.py`, see
  `data/analysis/README.md`). After the analysis changes, `python3 scripts/build_site.py --topics` refreshes the topic
  data, each document's tags and the main/subfile marks without re-reading the PDFs.
- **Topic filter** (`#/filters`): a global topic filter. Unchecked topics (and the keywords) are left out of every tab and the
  viewer; the choice is saved in the browser.
- In the viewer, the **Clean text** and **Database text** panes each have a find box (Enter / Shift+Enter step through
  matches). Turning off a category (standards, examples, backup) hides it from both panes, and clicking that category's
  text elsewhere (page boxes, the Topics pane) no longer opens it; links from other pages still do.
- In the viewer, the **Topics** pane lists every topic tagged in the document, with each sentence and its score;
  tags also show under each unit of the clean text and as dashed outlines on the original pages.

The tags come from `data/analysis/` on `main` (see `data/analysis/README.md`, written by `scripts/topic_tags.py`).

## Files

| Path | What |
|---|---|
| `index.html` (repo root) | the page |
| `site/app.js`, `site/style.css` | the front end (no build step) |
| `site/analysis.js` | the Topics and Charts tabs |
| `site/vendor/` | pdf.js 3.11.174 (renders PDF pages), topojson-client 3.1.0 and us-atlas 3.0.1 `states-albers-10m.json` (the map) |
| `site/data/` | generated by `scripts/build_site.py`: `index.json`, `rows/<ST>.json`, `docs/<ST>/<n>.json`, `pdf/<ST>/<n>.pdf` (rendered Word files), `topics/` (topic list, tags, sentences, word counts) |
| `.nojekyll` | tells GitHub Pages to serve the files as they are |

Original documents are served from `data/raw/`, and the downloads from `data/clean/`, so the site must be published
from the repository root of this branch.

## Rebuild after the data changes

```
git merge main                       # bring in new labels / database
python3 scripts/keyword_tags.py      # the "immigra" and "migra" keyword counts (seconds)
python3 scripts/build_site.py        # all states (or: python3 scripts/build_site.py AR DE)
```

The script needs `pymupdf` and LibreOffice (`soffice`, for the Word files). It re-runs the PDF extraction to place each
unit on its page and uses those positions only when the re-run reproduces the stored units exactly. It checks that every
row's text equals the database text line for line before writing.

## Publish on GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then branch `site`, folder `/ (root)`.
The site appears at `https://<owner>.github.io/<repo>/`. GitHub Pages on a private repository needs a paid GitHub plan.

To preview locally: `python3 -m http.server 8000` in the repo root, then open http://localhost:8000/.
