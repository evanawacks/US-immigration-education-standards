# MT (Montana) review

## Verdict
The low count is genuine. Montana's 2021 social studies standards (Administrative Rules of Montana, New Rules I-IX) really are this short: about 2,700 words for all of K-12, written as 2-14 one-line lettered standards per content area per grade, with no examples, elaborations or course standards. The near-identical "backup" counts come from a real duplication in the workbook (the "K-12 Complete" sheet repeats every per-grade sheet word for word). That copy is already labeled `backup`, so nothing is counted twice and no real content is being lost. The two skipped PDFs are copies or excerpts of the same text and add no standards.

## What the text is
File: `2021_SS_for_Web_4e6bb2.xlsx` (the only used file)

| Units | Current label | What it really is | Social studies? | Duplicate of |
|---|---|---|---|---|
| u1-u8 | backup / all | Intro sheet: adoption date, CASE link, contact | No (front matter) | - |
| u9 | backup / all | Sheet marker | No | - |
| u10-u22 | backup / K-12 | K-12 Complete, Rule I: four content areas + six inquiry skills | Skills/framing | Exactly the same as u206-u218 |
| u23-u204 | backup / K..9-12 per Rule | K-12 Complete, Rules II-IX: all grade standards | Yes (content standards) | Word for word the same as u220-u408. I checked with a diff after stripping row tags, "NEW RULE n" prefixes and sheet markers, and the result was empty |
| u205, u219 (+ other SHEET markers inside ranges) | backup / standards | Sheet markers | No (a few words) | - |
| u206-u218 | standards / K-12 | Rule I content areas + inquiry skills ("develop questions ... take informed action") | Skills/practices, no content | Same as u10-u22. Already excluded as K-12 |
| u220-u229 | standards / K | Kindergarten standards (9 standards) | Yes | - |
| u230-u243 | standards / 1 | Grade 1 standards | Yes | - |
| u244-u259 | standards / 2 | Grade 2 | Yes | - |
| u260-u276 | standards / 3 | Grade 3 | Yes | - |
| u277-u299 | standards / 4 | Grade 4 (Montana focus) | Yes | - |
| u300-u324 | standards / 5 | Grade 5 (US focus) | Yes | - |
| u325-u359 | standards / 6-8 | Grades 6-8 band. Montana writes no single grades here, so it is not an umbrella band and is counted | Yes | - |
| u360-u408 | standards / 9-12 | Grades 9-12 band (no courses) | Yes | - |

Counted words = K 139 + 1 171 + 2 209 + 3 209 + 4 304 + 5 330 + 6-8 573 + 9-12 803 = 2,738. All grade-level content is counted. Only the 88 K-12 words (Rule I) are left out, and that is correct.

Skipped files in `data/raw/MT` (both checked by reading their view.txt):
- `SIPL_CSI_..._2021.04.05_86672e.pdf`: the official OPI PDF of the same standards, with codes (SS.CG.K.1 ...), a coding key and a "2000 to 2021 Comparison" table. The table has the six old 2000 broad standards next to the six 2021 skills. These are not current grade standards, and the only movement-related wording is "(e.g., ... movement, and regions)". The standards text matches the Excel. Skipping it is correct.
- `IEFA_Connections_Social_Studies_Standards_6a3222.pdf`: Indian Education for All connections. It is only a selected subset of the same standards, plus a one-paragraph intro and a note about numbering. It has no extra content. Skipping it is correct.
- No other Montana file is in `data/raw/MT`. The IEFA intro mentions the OPI "Model Curriculum Guide Documents", which are not in the corpus. They would be support material (`examples`), not standards.

Small note: the lead-in rows ("(1) The civics and government content standards for kindergarten are that each student will:") are counted as standards. They are only a few words each and other states handle lead-ins the same way, so they are not worth changing.

## Proposed changes
```json
[]
```
None needed. The labels are already right: the duplicate K-12 Complete sheet is `backup`, the per-grade sheets are `standards`, Rule I skills are K-12 (excluded), and no band is wrongly excluded.

## Immigration mentions not counted
None of Montana's real standards are left out. Every "migra" match in the standards sheets is counted:
- u294 (Gr 4): "...how humans and the environment impact each other with relation to settlements and migration in Montana."
- u318 (Gr 5): "...with relation to settlements and migration."
- u392 (9-12): "evaluate the influence of long-term climate variability on human migration and settlement patterns..."
- u393 (9-12): "evaluate the consequences of human-driven and natural catastrophes on global trade, politics, and human migration."

Their copies in the K-12 Complete sheet (u93, u116, u188, u189) are `backup` and are not counted, which is correct. The text never uses the words "immigrant" or "immigration". Related movement standards are u291 (Gr 4: "explain the movement of people"), u347 and u348 (6-8: "settlement and movement", "movement of people, goods, and ideas"). All are counted.
