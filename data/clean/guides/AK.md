# AK guide

Files to label (`use`):
- `Adopted-AK-SS-Standards-2024_09c1fb.pdf`

Not used (do not label):
- none

Row clusters for grade-level (non-course) content: K, 1, 2, 3, 4, 5, 6, 7, 8, 9-12. Course-based content (mostly high school) gets course rows via the `course` field.

Known structure (from the corpus survey; verify against the document):
- Grade groupings found: [0],[1],[2],[3],[4],[5],[6],[7],[8],[9-12]
- Topics/courses: Inquiry skills, Civics, Economics, Geography, History (US, World, Alaska history), Alaska Studies
- Notes: K-2, 3-5 standards are written as grade-band standards with 'By the end of K/1/2' leveled content, so counted as individual; 6-8 and 9-12 are separate. Grade 9-12 is one band with courses

Specific hints:
- K-2 and 3-5 standards tables have three columns: C1 anchor standard (e.g. "Civics Anchor Standard 6 Civic and Political Institutions"), C2 "Grade-Band Standard" (e.g. `SS.K‐2.6.1 ...`), C3 "Leveled Content Standard" cells starting "By the end of K:" / "By the end of 1:" / "By the end of 2:" with codes `SS.K.1.6.1`, `SS.1.1.6.1`, `SS.2.1.6.1`.
  → C1 anchor and C2 grade-band standard: grades `K-2` (or `3-5`), cat standards (copied to each grade). C3 leveled cells: the single grade named in "By the end of X", cat standards.
- Inquiry standards (Anchor Standards 1-5, codes SS.K-2.1.1 ...) are grade-band skills standards → standards with the band.
- Grades 6, 7, 8 each have their own themed standards (Grade 6 Alaska Studies and Geography, Grade 7 World History and Geography, Grade 8 U.S. History and Civics); the "Grade 6 through 8 Inquiry Standards" apply to 6-8.
- Grades 9-12: band standards by discipline (Inquiry, Civics, Economics, Geography, Alaska History, U.S. History, World History). Treat each discipline section as a course: course = the section title (e.g. "U.S. History"), grades 9-12; the 9-12 Inquiry Standards: course null, grades 9-12 (shared).
- "Sample ... Standard" pages under "How to Read the Standards" are backup.
