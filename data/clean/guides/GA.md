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
