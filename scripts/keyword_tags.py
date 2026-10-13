#!/usr/bin/env python3
"""Count the word "immigration" (and its forms) in the labeled text, as a keyword check kept apart from the 106
topic tags of scripts/topic_tags.py.

Rules:
  - Same text and sentences as topic_tags.py: all labeled text of used documents (standards, examples, backup; never
    running headers), split into the same sentences, an identical sentence with the same grades and category in one
    state's documents counted once, and the same grades.
  - A match is any word starting with "immigra", case-insensitive: immigration, immigrant(s), immigrate(d), ...
    Not "emigration" or "migration". Every match counts (two in one sentence count twice).

Output: data/analysis/keyword_tags.csv, one row per match (columns as topic_tags.csv, without topic and score;
        sentence_char is where the match starts in the sentence).
Usage: python scripts/keyword_tags.py   (seconds; no model needed)
"""
import csv, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from topic_tags import corpus, OUT

KEYWORD = "immigration"
PATTERN = re.compile(r"(?<![A-Za-z])immigra[A-Za-z]*", re.I)   # keep in step with KW_RE in site/analysis.js
CATS = ("standards", "examples", "backup")

def main():
    items, _, _ = corpus(CATS)
    rows = []
    for it in items:
        sent, at = it["sentence"], it["at"]
        for m in PATTERN.finditer(sent):
            rows.append({**{k: it[k] for k in ("state", "file", "unit", "sentence_no", "category", "grades", "course", "course_title")},
                         "keyword": KEYWORD, "matched": m.group(0),
                         "char_start": at + m.start() if at >= 0 else "", "char_end": at + m.end() if at >= 0 else "",
                         "word_pos": it["wpos"] + len(sent[:m.start()].split()), "sentence_char": m.start(), "sentence": sent})
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "keyword_tags.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    by = {}
    for r in rows: by[r["category"]] = by.get(r["category"], 0) + 1
    print(f"{len(rows):,} matches of /{PATTERN.pattern}/ in {len(items):,} sentences:", by)

if __name__ == "__main__":
    main()
