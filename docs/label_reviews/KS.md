# KS (Kansas) review

File: `KS hgss-standards-benchmarks-and-appendices.pdf` (single file, 187 labels, all units read)

## Verdict
The low count is **real, not a labeling mistake**. Kansas's 2020 HGSS standards are five abstract, concept-based K-12 standards, each with four benchmarks (u194-u252). They name no content, and the analysis leaves them out on purpose as K-12 anchors. All the grade-level and course content (the Kansas History, US History, Government and Psychology units) sits in the Appendices. The document says outright that this material is not required: "THE FOLLOWING APPENDICES DOCUMENT IS NOT A STATE-MANDATED CURRICULUM" (u413), and every grade repeats "The units and topics listed below are provided as a planning guide and are not mandated" (16 times, e.g. u493, u773, u1098). Under LABELING_GUIDE rule 4, that is `examples` (course description narrative, suggested units and topics), and that is how it is labeled now. Immigration does appear in Kansas's documents, about 40 times, but only in this non-mandated suggested content, so the 0 tags for standards is accurate.

## What the text is
| Units | Current label | What it really is | Social studies? | Duplicate of |
|---|---|---|---|---|
| u1-u193 | backup, all | Cover, board, committee lists, table of contents, mission | no (front matter) | – |
| u194-u252 | standards, K-12 (excluded) | The 5 K-12 standards: description, bulleted aspects, benchmarks 1.1-5.4. The only formal standards, with no content named | yes (abstract concepts) | – |
| u253-u292 | backup, all | Classroom practices, inquiry, scope-and-sequence intro (pedagogy) | no | – |
| u293-u334 | standards, K..5 | Suggested scope table per grade: content focus and focus-standard number | yes (themes only) | – |
| u338-u372 | standards, 6-8 / 9-12 by course | Scope table rows: course titles, standards "1, 2, 3, 4, 5" | yes (titles only) | – |
| u373-u458 | backup, all | Footnotes, instructional steps (u390/u391/u413 disclaimers), appendices TOC | no | – |
| u461-u471, u513-u524, u568-u580, u624-u635, u679-u693 | standards, K/1/2/3/4 | "Focus Standard N" repeated word for word in each K-4 appendix | yes | **verbatim copy of the K-12 Standards 1, 2, 4, 3, 5.** These count once per grade because the K-12 originals are excluded. That is acceptable: each copy is a different grade, so nothing is double-counted within a grade |
| u741-u742, u803-u804, u859-u860, u909-u910, u969-u970, u1020-21, u1076-77, u1142-43, u1286-87, u1334-35, u1420-21 | standards | Grade/course title and course code only (grades 5-12 do not repeat the standards) | yes | – |
| Per-grade "Instructional Best Practices", "Culturally Relevant Pedagogy", "Suggested Units" intro, CBA notes | backup | The same boilerplate repeated in every grade | no | repeated per grade (backup, so not counted) |
| Per-grade Course Description, Expanding/Connecting learning | examples | Overview narrative of the grade or course | yes | "Expanding/Connecting" repeats the neighboring grade's description (examples, not counted) |
| Per-grade "Suggested Units" + "Suggested topics" (e.g. u499-u509, u776-u799, u936-u965, u994-u1017, u1101-u1138) | examples | Explicitly "not mandated" planning guide: unit narratives and topic lists | yes | – |
| u1200-u1276 | examples, 9-12 | List of elective course titles; generic elective description | yes (titles) | – |
| u1286-u1603 | standards (title) / examples | Sample electives: Economics, World Geography, Psychology suggested units | yes (social science) | the World Geography "Human: demographics, migration, immigration…" line is repeated 7 times (u1372…u1415). It is examples, and the analysis would count it once anyway |
| u1606-u1685 | backup, all | Glossary, contact | no | – |

None of the text is outside social studies. There is no literacy (RH/WHST) section and no embedded subfile. The only overlaps are (1) the K-4 Focus Standards copying the K-12 standards (handled correctly: excluded at K-12 and counted once per grade) and (2) boilerplate and neighbor-grade descriptions repeated per grade (backup or examples, so not counted).

## Proposed changes
```json
[
  {"rule": "No relabeling. Kansas's grade/course content is explicitly non-mandated suggested material (u413, u493 and 15 other repeats of 'not mandated'), so `examples` matches the labeling guide and how other states label suggested units and topics. Changing it to `standards` would make Kansas inconsistent with other states. Recommendation: flag KS in state_summary/reporting as a 'concept-only standards' state (formal standards are K-12 and name no content), and if a content-level comparison is wanted, report KS's examples-category tags as a separate, clearly marked supplementary measure instead of folding them into standards."}
]
```
Optional, low priority (not proposed as a change): grades 5-12 courses list "1, 2, 3, 4, 5" as their focus standards but do not repeat the standards' text, while K-4 do. So K-4 each gain about 180 counted words that grades 5-12 do not. Copying the K-12 standards into 5-12 would add identical concept text and no topics. I recommend leaving it.

## Immigration mentions not counted (all `examples`, non-mandated suggested units)
- u610 (gr 2): "Students will analyze push and pull factors of voluntary and involuntary migration and how different groups of people contribute to Kansas."
- u724 (gr 4): "Suggested Topics: … emigration, immigration, … Exodusters, immigrant settlers …"
- u953 (gr 7 Kansas History): "They will examine the influx of unique European immigrant communities and their impact on Kansas, politics, economy, and cultural identity."
- u1016 (gr 8 US History 1789-1898): "Students will investigate how immigration fueled the rapid industrial and imperial growth …"; u1017 lists "Chinese Exclusion Act (1882) … Ellis and Angel Islands"
- u1138 (HS US History 1898-Present): "immigration (Dreamers, refugees, asylum seekers)"
- u1175 (HS Governments of the US): "Suggested Topics: citizen (tribal, state, dual, federal), citizenship, … immigration …"

None of these is counted because each one is in a "Suggested Units and Content Topics" block that the state labels "not mandated". The counted standards text (the K-4 focus standards, scope rows and titles) never mentions immigration.
