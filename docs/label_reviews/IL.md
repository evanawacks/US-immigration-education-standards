# IL (Illinois) — manual label review

**File:** `IL-Social-Science-Standards_4db7c3.pdf` (23 pages, 610 units). Only used file; no subfiles, no overlap with other IL documents.

## Verdict
The low count (5,098 words, 9 tags) is **genuine**. The 2022 Illinois Learning Standards for Social Science are a short (~22 pp.) set of one-sentence, inquiry/concept-style standards: whole document holds only ~5,700 words of standards text, and the labels put almost all of it in counted rows. The standards deliberately leave content to districts ("These standards are not content specific, allowing districts to determine the precise historical events and periods", u187), so there are almost no named topics or eras. Nothing real is hidden in `examples` (there are none), `backup`, K-12 or an excluded band, apart from ~300 words of K-2/3-5 inquiry skills that are excluded by the project-wide umbrella-band rule on purpose and contain nothing on immigration.

## What the text is
| Units | Current label | What it really is | Social studies standards? | Duplicate of |
|---|---|---|---|---|
| u1-u16 | backup all | Cover, background, introduction | No (front matter) | – |
| u18 | backup all | Page-4 "Features / grade-level structure" narrative flattened together with the sample 6-8 complexity table (605 w) | No | sample table repeats u234-u236 |
| u19-u25 | backup 6-8 | How-to-read illustration: SS.CV.1.6-8 LC/MdC/MC | No (illustration) | exact copy of u234-u236 (correctly not counted) |
| u26 | backup 9-12 | High school overview narrative | No (intro) | – |
| u27-u78 | backup all | How to read, common vocabulary, Table 1 (teacher's role across inquiry stages), inquiry-skills intro | No (pedagogy) | – |
| u80-u179 | standards K-12 / K-2 / 3-5 / 6-8 / 9-12 | K-12 Inquiry Skills tables (SS.K-2.IS.n, SS.3-5.IS.n, SS.6-8.IS.n.LC/MdC/MC, SS.9-12.IS.n); K-12 = table/strand headings | Yes (skills standards) | K-2/3-5 parts are excluded umbrella bands (157 + 172 w); not repeated per grade anywhere |
| u181-u192 | backup all; u185-186, u188-189, u191 standards K-12 | Disciplinary-concepts intro narrative (3 interleaved columns); strand name lists | Narrative no; strand lists = headings | strand lists repeat the table strand headings |
| u194-u224, u265-u300, u351-u384, u427-u458 | standards K..5 (headers K-5) | Elementary Civics/Economics/Geography/History tables, grade-specific codes SS.<g>.<disc>.n + grade themes | Yes | – (K-5 = strand-heading cells only, 63 w) |
| u226-u263, u302-u349, u386-u425, u460-u496 | standards 6-8 / 9-12 (headers 6-12) | 6-12 discipline tables (6-8 LC/MdC/MC, 9-12) | Yes | – (6-12 = strand-heading cells only, 60 w) |
| u498-u560 | standards 9-12, course Anthropology / Psychology / Sociology / Religious Studies | Supplementary HS course standards (6-9 one-line standards each, 85-213 w per course) | Yes (behavioral science / religious studies electives) | – |
| u562-u610 | backup all | Task force list, acknowledgments | No | – |

Checks requested:
- **Excluded bands:** K-5 (63 w) and 6-12 (60 w) are only table titles/strand-name cells ("Civic and Political Institutions", "Topics"). K-2 (157 w) and 3-5 (172 w) are the elementary inquiry-skill standards, which exist only as bands (not written per grade). Excluding them is exactly what the umbrella-band rule intends (shared skills over grades written individually); they contain no immigration/migration language, so including them would add ~330 words and no tags. No change proposed.
- **Backup K-12 (3,319 counted words)** = the `all` backup: front matter, how-to-read, vocabulary, Table 1, narrative intros, task force list. Not standards. Correct as is.
- **HS elective database rows (~2,000 w each):** the assembler copies the shared 9-12 (course: null) standards (~1,960 w incl. 9-12 inquiry) into each course row, plus that course's own 85-213 words. That is the database's normal row design, not a labeling error; the analysis counts each unit once (9-12 counted = 1,749 shared + 527 elective raw words → 2,214 after dedup). No double count.
- **Light on content: confirmed.** Named content is limited to a handful of items: U.S./Illinois Constitution (SS.5.CV.2, SS.6-8.CV.2), "Illinois history" (SS.4.H.3), the "American Dream" (SS.9-12.H.6), "imperialism and colonization" (SS.9-12.H.14), "global conflicts and economic crises" (SS.9-12.H.12), tribal nations/U.S. territories. No eras, wars, people or events. The Illinois mandated units (School Code) are only referenced (u4), not included.

## Proposed changes
```json
[]
```
No relabeling needed. (Optional and not recommended: dropping "K-02"/"03-05" from ANALYSIS_EXCLUDE_BANDS["IL"] would count ~330 words of elementary inquiry skills, but that contradicts the rule applied to AK, LA, ME, MI, TN, WV and adds no immigration tags.)

## Immigration mentions
All explicit mentions in standards are already counted:
- u234 (6-8, counted): "SS.6-8.CV.1.LC. Identify different types of citizenship and immigration statuses of individuals in the United States ... based on citizenship or immigration status."
- u384 (5): "SS.5.G.4. Analyze the effects of catastrophic environmental and technological events on human settlements and migration."
- u411 (6-8): "Explain how environmental characteristics affect human migration and settlement."
- u408, u414, u416 (9-12): G.8 "...how these events affect trade, politics, and migration"; G.10 "...have influenced migration patterns and the distribution of the human population"; G.12 "...climate variability affects human migration and settlement patterns".

Not counted (correctly): u23 (backup 6-8) and u18 (backup all) — both are copies of SS.6-8.CV.1.LC in the how-to-read illustration; counting them would double count u234.
