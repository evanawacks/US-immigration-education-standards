# GA guide

Files to label (`use`):
- `Social Studies - Georgia Department of Education-CASE-items.csv`

Not used (do not label):
- CASE-Social Studies - Georgia Department of Education.json — skip: same standards as the CASE items CSV (subset print / JSON / CSV with notes)
- GA Social Studies K-12.pdf — skip: same standards as the CASE items CSV (subset print / JSON / CSV with notes)
- GA_Social_Studies_items_with_GOAL .csv — skip: same standards as the CASE items CSV (subset print / JSON / CSV with notes)

Row clusters for grade-level (non-course) content: K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12. Course-based content (mostly high school) gets course rows via the `course` field.

Known structure (from the corpus survey; verify against the document):
- Grade groupings found: [0],[1],[2],[3],[4],[5],[6],[7],[8],[9-12]
- Topics/courses: History, Geography, Government/Civics, Economics (K-8 strands); HS: American Government/Civics, Economics (Microeconomics, Macroeconomics, Personal Finance, Fundamentals of Economic Decision-Making), US & World History, Psychology, Sociology, Anthropology, Ethnic Studies, Comparative Religions, The Humanities, Current Issues, Constitutional Theory, The Individual and the Law, Sports in US Society, Intro to US Intelligence & National Security
- Notes: Source is the CASE export (items CSV counted; JSON and GOAL CSV are the same content). K-5 print was a subset. Some HS literacy standards are banded 9-10 and 11-12; HS course standards are 9-12. Spreadsheet says 2026 standards, file is the 2021 GSE as published on the CASE site

Specific hints: use ONLY the CASE items CSV ("Social Studies - Georgia Department of Education-CASE-items.csv"). Each unit is one CSV row: `Item Type | Sequence | Human Code | Full Statement | Ed. Level | Last Modified`. Rows are in hierarchical order: Grade Level → Course (e.g. "Social Studies/Grade 4", or HS course names such as "American Government/Civics", "Psychology") → Domain/Cluster/Topic → Standard/Content Standard → Element.
- grades from `Ed. Level` (KG→K, 01..08, 09-12, 06-08, KG-12 ...). A row whose Ed. Level is a band (KG-12 skills, 06-08 literacy) applies to that band.
- HS (09-12): everything under a Course row belongs to that course → course = the Course row's Full Statement until the next Course row. K-8 "Social Studies/Grade N" course rows are grade rows (course null).
- `Deprecated` item types → backup (issue note). Map and Globe Skills / Information Processing Skills (KG-12 skills charts) → standards for the grades they mark. Reading/Writing Standards for Literacy in History/Social Studies (RH/WHST) → backup.
- The header row (u1-ish) → backup.
A script that walks the rows and applies these rules is appropriate; still read the whole view to verify.
