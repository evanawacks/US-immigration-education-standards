# DE (Delaware) manual review

**Verdict.** The low count is genuine. Delaware's 2018 standards are four short Word files, each with 4 anchor standards, a one-paragraph rationale per anchor, and 1-2 one-sentence benchmarks per grade cluster (K-3, 4-5, 6-8, 9-12). I read all 171 units: the docx text is fully captured (raw ~4,180 words vs ~3,950 in units; the gap is only tokenization), every benchmark is labeled `standards` in the right cluster, and nothing real is hidden in `examples`, `backup`, `K-12` or an excluded band. The only explicit immigration content is two counted History content-list bullets (u32 K-3, u42 4-5), which are the state's 2 tags.

## What the text is

All four files have the same layout. Units are per file.

| Units (pattern per anchor) | Current label | What it really is | Social studies? | Duplicate? |
|---|---|---|---|---|
| "X Anchor Standard N: Students will ..." (Civ u1,u11,u21,u29; Eco u1,u10,u17,u24; Geo u1,u13,u20,u28; Hist u1,u8,u18,u25) | standards K-12 (excluded) | The anchor standard statement for all grades, which the cluster benchmarks restate at each level | yes | no; it is the same kind of anchor that other states keep at K-12 |
| Rationale paragraph after each anchor (Civ u2,u12,u22,u30; Eco u2,u11,u18,u25; Geo u2,u14,u21,u29; Hist u2,u9,u19,u26) | examples K-12 | The rationale for the anchor across all grades: why the topic matters, with no grade or cluster tie. These are not grade-band content and are correctly not counted | yes (content support) | no |
| "The complexity of the standard will increase at each succeeding grade cluster:" | backup K-12 | Boilerplate | no | repeated 16 times, harmless |
| K-3a/b, 4-5a/b, 6-8a/b, 9-12a/b benchmark sentences | standards in their cluster | The real grade-cluster expectations | yes | no |
| Geo u8-u11 (9-12 principles list); Hist u29-u30, u32-u34, u36-u40, u42-u45, u47-u51, u53-u57, u59-u64, u66-u69 (era and theme lists) | standards in their cluster | The "including:" content lists that belong to the benchmark, counted correctly per the guide | yes | Hist u66 "Intensified hemispheric interactions (1,000-1,500 AD)" repeats u57 (6-8b) in 9-12b. The bands differ and the state writes it twice, so it is fine |

There is no front matter, literacy content, appendix, subfile or text that isn't social studies. The bands K-3/4-5/6-8/9-12 are Delaware's only grade units, so no umbrella band applies.

## Proposed changes

```json
[]
```

No relabeling is warranted. Moving the K-12 rationale paragraphs (1,146 words) to counted standards would go against the guide, which treats rationale and overview narrative as examples. It would also let anchor-level text count, while other states have their K-12 anchors and overviews excluded. Even if it did count, it adds no immigration tag; the only hit is the phrase "migrations of a population" in History u2. If the project wants more Delaware text, that is a corpus-scope question, not a labeling one. Supplementary Delaware DOE material (for example, clarification or grade-level expectation documents, if the project chooses to treat them as standards) is not in `data/raw/DE`.

## Immigration mentions not counted

- History u2 (examples K-12, rationale for History Anchor 1): "The continuing migrations of a population, the development of a religion or a philosophy, ... all represent possible subjects for investigation." This is correctly not counted: it is a generic illustration in a K-12 rationale.

Mentions already counted (standards):
- History u32 (K-3): "-- Who lives here and how did they get here? (immigrants, demographics, ethnic and religious groups)"
- History u42 (4-5): "-- Who are the American people? (demographics, immigration)"
