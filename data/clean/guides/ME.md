# ME guide

Files to label (`use`):
- `MLR_-_Social_Studies_2019_revised_standards_-_10.2025_fcf62a.docx`
- `Social_Studies_-_MLR_Social_Studies_Geography_2019_-_10.9.2025_83d3f3.pdf`
- `Social_Studies_-_MLR_Social_Studies_History_2019_-_10.9.2025_7f7403.pdf`

Not used (do not label):
- Maine_Learning_Results_for_Social_Studies_-_2007_Version_0_0d4c29.pdf — skip: superseded 2007 version / extracts of the 2019 standards

Row clusters for grade-level (non-course) content: K, 1, 2, 3, 4, 5, 6-8, 9-12. Course-based content (mostly high school) gets course rows via the `course` field.

Known structure (from the corpus survey; verify against the document):
- Grade groupings found: [0],[1],[2],[3],[4],[5],[6-8],[9-12]
- Topics/courses: Civics & Government, Economics (incl. personal finance), Geography, History (Maine Native Americans, US, world)
- Notes: Performance expectations written per grade for K-5, as spans for 6-8 and 9-12. Four files: 2019 revised standards (docx), geography and history extracts (2025), and the superseded 2007 version

Specific hints: the 2019 docx is a sequence of tables per strand (Civics & Government, Economics/Personal Finance, Geography, History). Each table has a "Strand / Standard" header, a row with grade columns ("Kindergarten | Grade 1 | Grade 2", "Grade 3 | Grade 4 | Grade 5") or a single span ("Grades 6-8", "Grades 9-Diploma"), then "Performance Expectations" cells. Map each cell to its column's grade (C index matches the header row's columns). Rows: K,1,2,3,4,5, 6-8, 9-12 (9-Diploma = 9-12). The Strand/Standard statement rows apply to all grades of that table. Intro, Guiding Principles, skills explanation → backup (but the "Skills in Social Studies" performance expectations, if grade-tied, are standards).
