# ND review: Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf

## Verdict
The low count is genuine. North Dakota writes only 52 short K-5 band standards (K-2 and 3-5) and one 6-12 band of broad
strand standards with a few benchmarks each. The document itself says grade-level benchmarks are left to districts and
the "Guiding Topics" are "not required". The labels are right: the examples are the non-required Guiding Topics, and
the 6-12 backup is the coding explanation, intros and the RH/WHST literacy appendix. No real standards are hidden in
`examples` or `backup`, and the 6-12 band is how the document is written. The one real labeling error makes the count
too high, not too low: every K-5 standard is printed twice (first as a plain list, then in the theme tables). The two
copies extract differently ("C.K_2.5 Identify ways ... community decisions." vs "C.K 2.5 Identify ways ... _ community
decisions."), so the exact-sentence dedup misses them and K-2/3-5 is counted about twice (1,512 words now, about 705
unique).

## What the text is
| Units | Current label | What it really is | Social studies? | Duplicate of |
|---|---|---|---|---|
| u2-u192 | backup all | Front matter, revision log, TOC, intro, references | no | – |
| u195-u210 | backup K-5 | How-to-read sample table | no | u230-u231 |
| u214-u216, u236-u238, u257-u259, u284-u285 | standards K-2 / 3-5 | K-5 standards as plain lists (clean text, all 52 codes) | yes (a) | same 52 codes as the table cells |
| u221-u222, u230-u231, u243-u244, u252, u264-u265, u273-u274, u280, u290-u291, u299-u300, u306-u307 | standards K-2 / 3-5 | Same 52 K-5 standards again in theme tables (with " _" wrap artifacts) | yes (a) | **duplicate of the lists above** |
| u217, u226, u239, u248, u260, u269, u276, u286, u295, u302 (+ u213, u235, u256) | standards K-5 (excluded band) | Strand and theme headings | headings | – |
| u220, u223 ... u308 | examples K-5 / 3-5 | Guiding Questions column | (b) | – |
| u311-u356 | backup 6-12 | 6-12 intro and coding examples | no (copies C.6_12.2 and US Era 1) | u382-u387, u587-u605 |
| u359-u1005 (code/standard/benchmark cells) | standards 6-12 | 8 strands: Civ, Econ, Geo, US Hist (5 eras), World Hist (4 eras), ND Studies, Sociology, Psychology | yes (a) | anchor standards repeated per era/domain, which the exact-match dedup already removes (3,797 raw words, 2,588 counted) |
| Guiding Topics cells in u359-u1005; strand narratives u361, u425, u584, u691, u693, u779, u841 ... | examples 6-12 | Non-required "Guiding Topics" and what-students-study narrative | (b) | – |
| u360, u362, u426-u427, u585, u692, u694 | backup 6-12 | Pedagogy and banding notes | no | – |
| u1009-u1300 | backup / examples per grade | App. A: optional scope-and-sequence. The K-5 chart repeats the K-2/3-5 standards (backup) and adds per-grade topic words. Options A/B suggest courses but are not standards. | (b)/(c) | standards repeated |
| u1308-u1330, u1366-u1371 | examples K-12 | NDNAEU (Native American Essential Understandings) | (b) | – |
| u1331-u1406 | examples 6-12 | Inquiry Design Model sample lessons | (b) | – |
| u1410-u1424 | backup all | App. C: civics learning design | (c) | – |
| u1428-u1580 | backup | App. D: RH/WHST literacy standards 6-12 | no (literacy) | – |

The 6-12 band is correct. The document says the standards "do not specify a course" and that benchmarks for each grade
are set by districts. Appendix A's course and grade sequence is optional, and its Options A and B disagree, so it
cannot be used to split the band.

## Proposed changes
```json
[
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u221", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Table copy of the K-2 civics list u214; differently extracted, so dedup misses it. Keep the clean list copy."},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u222", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u215-u216"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u230", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u214"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u231", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u215-u216"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u243", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u236"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u244", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u237-u238"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u252", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u238"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u264", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u257"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u265", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u258-u259"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u273", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u257"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u274", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u259"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u280", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u259 (G.3_5.7-8 settlement)"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u290", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u284"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u291", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u285"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u299", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u284"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u300", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u285"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u306", "from": {"cat": "standards", "grades": "K-2"}, "to": {"cat": "backup", "grades": "K-2", "course": null}, "reason": "Duplicate of u284"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u307", "from": {"cat": "standards", "grades": "3-5"}, "to": {"cat": "backup", "grades": "3-5", "course": null}, "reason": "Duplicate of u285"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u248", "from": {"cat": "standards", "grades": "K-5"}, "to": {"cat": "standards", "grades": "3-5", "course": null}, "reason": "Theme heading 'National Economy' has only 3-5 standards (no K-2 cell); it is now lost in the excluded K-5 band"},
  {"file": "Rev7_2023.11.30_Social_Studies_Content_Standards_2e5e84.pdf", "units": "u276", "from": {"cat": "standards", "grades": "K-5"}, "to": {"cat": "standards", "grades": "3-5", "course": null}, "reason": "Theme heading 'Human Population: Spatial Patterns and Movements' has only 3-5 standards (G.3_5.7-8 settlement); migration-relevant heading now lost in the excluded K-5 band"}
]
```
Net effect: about 800 duplicate K-5 words drop out, so ND's counted standards fall from about 4,100 to about 3,300 words.
The four 6-12 groups stay as they are. Optional: the theme tables could be kept and the lists marked backup instead, but
the list copy is cleaner text with no " _" wrap artifacts, so it is the better copy to keep. As an alternative or an
addition, the sentence dedup could normalize ND's code spacing and the " _" artifacts. That analysis-rule change is not
needed if the labels change.

## Immigration mentions not counted
- u831 (examples 6-12, ND Studies Guiding Topics for ND.6_12.4.3 "Describe the major factors that brought settlers to North Dakota"): "Homestead Act, Timber Culture Act, preemption, immigration, development of the railroad". Not counted because Guiding Topics are labeled examples, which is correct: the document calls them "not required".
- u677 (examples 6-12, US Era 5 Guiding Topics): "Congressional debates regarding immigration and differentiate between different residency statuses (immigrant, refugee, migrant worker, asylee)". Same reason.
- u544 (examples 6-12, Geography Guiding Topics for G.6_12.2.3): "Refugee vs. immigrant, mass migrations, push/pull factors". Same reason.
- u637 (examples 6-12, US Era 3 Guiding Topics): "... urbanization, inventions and innovations, public education, immigration". Same reason.
- Already counted as standards: u676 "US.6_12.1-6.E5.3 Explain the social, political, and cultural influences on government policies regarding global immigration", u543 "G.6_12.2.3 Explain the patterns, causes, and consequences of major human migrations", u414 "C.6_12.4.2 Describe and evaluate the criteria and process for naturalization", u259 "G.3_5.7-8 Analyze patterns of human settlement in North Dakota / North America".
