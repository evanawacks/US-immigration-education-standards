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
3. **Grades.** Each sentence keeps the grades its document assigns to it (the labels used to build the database). A
   band such as `04-06` stays a band; it is never split into single grades or counted once per grade.
4. **Scoring.** The model (`BAAI/bge-base-en-v1.5`, via `fastembed`) turns each sentence and each topic into an
   embedding. A topic is represented by `"<topic>: <description> Related terms: <search terms>."`. The score is the
   cosine similarity between the two (higher = closer in meaning).
5. **Tags.**
   - *By meaning*: each sentence gets the **one** topic it is most similar to (its top match), if the score is at
     least 0.60. A sentence that is close to two topics only counts for the closer one.
   - *By name*: a sentence also gets every topic whose name or search terms appear in it word for word, so two topics
     named in the same sentence are both tagged.
   - `method` says which rule tagged it: `meaning`, `name`, or `both`.
6. **Cut-off.** Every tag keeps its `score`, and `top_score` is the sentence's best score over all topics. Weak matches
   are removed by choosing a minimum score (the website has a slider, default 0.70). Named tags can be kept whatever
   their score.

## Files

| File | One row per | Columns |
|---|---|---|
| `topics.csv` | topic (numbered 1-106 in the order of the reference list) | topic_no, era, topic, years, description, search_terms |
| `topic_tags.csv` | tag | state, file, unit, sentence_no, category, grades, course, course_title, topic_no, topic, era, score, method, top_score, sentence |
| `text_words.csv` | state × category × grade group | words, sentences (denominators for rates; use the standards rows) |
| `state_summary.csv` | state | standards words, tags, tags per 10,000 words at the default cut-off |
| `topic_tags_meta.json` | run | model, settings, counts, date |

`state`, `file` and `unit` point to the exact place in the source: `data/clean/units/<state>/<file>.units.jsonl`, or
the website's side-by-side viewer.

## Rerun

```
pip install fastembed
python3 scripts/topic_tags.py           # about 1.5 hours on 4 CPU cores; caches the similarity matrices
python3 scripts/topic_tags.py --reuse   # only re-applies the tagging rules (seconds)
```

In R: `tags <- read.csv("data/analysis/topic_tags.csv")`, then
`subset(tags, category == "standards" & (score >= 0.7 | method != "meaning"))`.
