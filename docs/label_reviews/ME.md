# ME (Maine) review

## Verdict
The low word count is genuine, not a labeling mistake. Maine's 2019 Learning Results are short: four strands, each a
one-row table per grade or band, about 8,600 words of standards in total before deduplication. The doc_parts handling
is correct. The Geography and History text of the main .docx (about 2,730 words) is dropped and counted once, from
the subfiles. Civics & Government and Personal Finance & Economics exist only in the main .docx and count in full
(about 2,370 words). Nothing is double-counted and no real content is lost.

The 1-tag result comes from the topic matching, not from the text or the labels. Eleven counted standards sentences say
"immigrant groups" or "migrant groups", but none of the 106 topics lists "immigrant" or "migrant" as a search term. The
name patterns use word boundaries, so "immigration" and "migration" do not match "immigrant" or "migrant". By meaning,
these sentences score only 0.65-0.69, just below the 0.70 cut-off.

## What the text is
| File / units | Current label | What it really is | Social studies? | Duplicate of |
|---|---|---|---|---|
| docx u1-u39 | backup, all | Intro, Guiding Principles, skills, key ideas, themes, eras table, statutes | front matter (c) | the same front matter is u1-u18 in each subfile (backup, not counted) |
| docx u40-u63, u101-u124 (Civics, PF&E K-5) | per-grade cells K..5; strand/standard rows K-2 / 3-5 | performance expectations by grade (a) | yes | none, found only in the docx (counted) |
| docx u64-u100, u125-u166 (Civics, PF&E 6-8, 9-12) | 6-8 / 9-12 | standard plus F/D performance expectations (a) | yes | none, found only in the docx (counted) |
| docx u167-u278 (Geography, History, all grades) | per grade / 6-8 / 9-12 | standards (a) | yes | the Geography and History subfiles. All of these sentences are dropped by doc_parts; only the "Performance Expectations" cell headings are lost (also K-2/3-5 band headings, trivial) |
| docx u279-u282 | backup | definitions | (c) | none |
| Geo pdf / Hist pdf u1-u18 | backup, all | the docx front matter repeated | (c) | docx u1-u39 |
| Geo / Hist pdf u19 | standards K-12 | the strand heading, one word | n/a | none |
| Geo / Hist pdf u20-u52/53 | standards K, 1-5, 6-8, 9-12 | standard plus performance expectations per grade (a) | yes | docx Geography / History tables. Counted here (subfile first) |
| 2007 pdf | skipped | superseded version | n/a | correctly not used |

Checks run: doc_parts detects the docx as the main document and the two PDFs as its subfiles. Every Geography and
History sentence of the docx is matched to a subfile; the 3 partial matches are typos or page splits ("United State",
a sentence split at a page break). Every Civics and PF&E sentence of the docx is kept. Counted words: 6,551 with parts
(6,379 after removing the K-2 and 3-5 bands, 86 words each, which hold only the strand and standard statements and the
"Childhood" headings), against 8,589 without parts. K-2 and 3-5 are correctly treated as umbrella bands. The grade
cells, including the merged-cell Grade 2 column at u51 and u112, were checked against the subfiles' per-grade text and
are correct.

## Proposed changes
```json
[
  {"rule": "Add generic search terms 'immigrant', 'immigrants', 'immigrant groups', 'migrant', 'migrants' to a generic topic (e.g. topic 105 'Migration patterns and demographics', which already has 'immigration' and 'migration'; or topic 21 for 'historical and recent immigrant groups'). Reason: term_patterns uses (?<![A-Za-z])...(?![A-Za-z]) boundaries, so 'immigration'/'migration' never match 'immigrant'/'migrant'. ME's 11 counted standards sentences naming immigrant/migrant groups get no topic (meaning scores 0.65-0.69 < 0.70). Corpus-wide change; affects every state the same way."}
]
```
No label changes are needed. An optional, very small change: the K-2 and 3-5 "Standard" statements of the Civics and
PF&E tables (docx u43, u55, u104, u116) are lost to the band exclusion. For Geography and History the subfiles count
the same statements per grade. They are generic strand descriptions with no immigration content, so this is not worth
a rule exception.

## Immigration mentions not counted (as topics)
All of the following are counted as standards text, but they get no tag at 0.70 or above:
- Hist pdf u47/u48 (6-8): "(F2) Identifying a variety of cultures through time, including comparisons of native and immigrant groups in the United States, and eastern and western societies in the world." The best score is 0.68 (melting pot / new immigration).
- Hist pdf u47/u48 (6-8): "(F3)/(D3) ... the history of Maine Native Americans and various historical and recent immigrant groups in Maine, the United States, and other cultures in the world." The score is 0.67.
- Hist pdf u53 (9-12): "(F2) Identifying and analyzing major turning points and events in the history of Native Americans and various historical and recent immigrant groups in the United State..." and "... as it pertains to various historical and recent migrant groups." The scores are 0.65-0.67.
- Geo pdf u48 (6-8) and u52 (9-12): "... including Maine Native Americans, various historical and recent immigrant groups in Maine, the United States, and the world." The scores are 0.66-0.69.
- Hist pdf u27 (1), u31 (2), u39 (4): "... various historical and recent immigrant groups and traditions common to all" / "... in the community and the state." The scores are 0.65-0.67.
- docx u144 (Economics 6-8): "(F1) Researching the pros and cons of economic processes ... of diverse cultures, including Maine Native Americans, various historical and recent immigrant groups in the United States..." The score is 0.68.
- Backup only (correctly not counted): eras table "Beginnings to 1607: Migration, contact, and exchange..." (Geo/Hist pdf u15, docx u29).

(The 24 keyword_tags rows are the 12 sentences above, each matched by both "immigra" and "migra"; 11 of them are counted standards sentences, and one is backup.)
