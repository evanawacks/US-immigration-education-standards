# Immigration-topic tags

`scripts/topic_tags.py` tags every sentence of the labeled text (standards, examples and backup) with the immigration topics in
[`data/reference/immigration_topics.csv`](../reference/immigration_topics.csv), using a language model that runs
locally (no LLM, no API).

## Method

1. **Text.** All labeled text of the documents used in the database is tagged (never the running headers), so the
   tags can be checked in the website's document viewer. **The analysis counts the `standards` text only**: the state
   summary and the website's Topics and Charts pages leave the examples and backup tags out (filter
   `category == "standards"` in `topic_tags.csv`). Each piece of text is split into sentences; bullet items count as
   sentences.
2. **One count per sentence per state.** If the same sentence appears twice in a state's documents with the same
   grades and category, it is counted once (at its first occurrence). Text that the database copies into several grade
   rows is counted once.
   **Main documents and subfiles.** When one document holds the text of other documents of the same state (Maine's
   full 2019 standards and its separate History and Geography files), the subfiles count on their own and a sentence of
   the main document that is also in a subfile is left out; text found only in the main document still counts. Main
   documents are found automatically (`scripts/doc_parts.py`: at least 60% of a file's distinctive standards text is in
   a larger file of the state); a state's `"parts"` in `state_config.json` overrides that. `python scripts/doc_parts.py`
   lists what it finds.
   **Text for every grade at once** (grades `K-12` or `PK-12`: anchor standards, strand overviews) is tagged and shown
   in the website's reader, but left out of `state_summary.csv` and the website's Topics, Charts and Database counts
   (`analysis_exclude_grades` in `topic_tags_meta.json`); its rows stay in `topic_tags.csv` and `text_words.csv`.
3. **Grades.** Each sentence keeps the grades its document assigns to it (the labels used to build the database). A
   band such as `04-06` stays a band; it is never split into single grades or counted once per grade.
4. **Windows.** Each sentence is read in overlapping windows of 12 words (one every 6 words); a sentence of 12 words or
   fewer is one window. This lets a sentence that moves from one topic to another (for example from immigration waves
   to the Irish potato famine) get both.
5. **Scoring.** The model (`BAAI/bge-base-en-v1.5`, via `fastembed`) turns each window and each topic into an
   embedding. A topic is represented by `"<topic>: <description> Related terms: <search terms>."`. The score is the
   cosine similarity between the two (higher = closer in meaning).
6. **Tags.**
   - *By meaning*: each window gets the **one** topic it is most similar to, if the score is at least 0.60. A window
     close to two topics only counts for the closer one. Within a sentence a topic is tagged once, from its best window.
   - *By name*: a sentence also gets every topic whose name or search terms appear in it word for word (a topic name
     ending in a generic word such as "migration" or "Act" also matches without it, e.g. "Irish Potato Famine"), so two
     topics named in the same sentence are both tagged.
   - `method` says which rule tagged it: `meaning`, `name`, or `both`. `matched` holds the words that triggered the tag
     (the window, or the name found), `char_start`/`char_end` their place in the unit text, and `word_pos` their place
     in the document (words from the start of the document).
7. **Cut-off and repeats.** Every tag keeps its `score`, and `top_score` is the sentence's best score over all topics.
   Weak matches are removed by choosing a minimum score (the website has a slider, default 0.70); named tags can be
   kept whatever their score. The website can also skip a tag when the same topic was already tagged within N words
   (default 25) before it in the same document, using `word_pos`.

## Files

| File | One row per | Columns |
|---|---|---|
| `topics.csv` | topic (numbered 1-106 in the order of the reference list) | topic_no, era, topic, years, description, search_terms |
| `topic_tags.csv` | tag | state, file, unit, sentence_no, category, grades, course, course_title, topic_no, topic, era, score, method, top_score, matched, char_start, char_end, word_pos, sentence |
| `text_words.csv` | state × category × grade group | words, sentences (denominators for rates; use the standards rows) |
| `state_summary.csv` | state | standards words, tags, tags per 10,000 words at the default cut-off |
| `topic_tags_meta.json` | run | model, settings, counts, date |
| `keyword_tags.csv` | match of a keyword ("immigration" or "migra", in `keyword`) | as `topic_tags.csv` without topic and score, plus `keyword` and `sentence_char` (written by `scripts/keyword_tags.py`) |

## Keyword count

`scripts/keyword_tags.py` is a plain word search kept apart from the topics, with two keywords counted
separately: "immigration", every word starting with "immigra" (immigration, immigrant(s), immigrate(d)…; not
emigration or migration), and "migra", every word containing "migra" (migration, migrant, emigration, immigration…).
Both are case-insensitive, in the same sentences as
above (same text, same once-per-state rule, same grades). Every match counts, so a sentence with two matches counts
twice. It needs no model and runs in seconds.

`python scripts/topic_tags.py --retag` rebuilds these files without the model when only the choice of counted
sentences changed (as with the main-document rule): a sentence's tags depend on its text only, so each sentence gets
the tags its text had in the last full run. It stops if a sentence was not in that run.

`state`, `file` and `unit` point to the exact place in the source: `data/clean/units/<state>/<file>.units.jsonl`, or
the website's side-by-side viewer.

## Rerun

```
pip install fastembed
python3 scripts/topic_tags.py           # about 2 hours on 4 CPU cores; caches the similarity matrices
python3 scripts/topic_tags.py --reuse   # only re-applies the tagging rules (seconds)
```

In R: `tags <- read.csv("data/analysis/topic_tags.csv")`, then
`subset(tags, category == "standards" & (score >= 0.7 | method != "meaning"))`.
