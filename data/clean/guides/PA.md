# PA guide

Files to label (`use`):
- `Pennsylvania_Code_Chapter_4.pdf` (Pennsylvania Code, Title 22, Chapter 4, 137 pages; printed from the official Pennsylvania Code site)

Sections (`structure` in `labels/PA/`):
- Pages 1-78: regulations (sections 4.1-4.83) and Appendices A-2 (English language arts and mathematics) and B-1 (science, environment, technology). Not social studies: backup.
- Appendix C, pages 79-105: Academic Standards for Civics and Government (5.1-5.4), Geography (7.1-7.4) and History (8.1-8.4), plus the Reading and Writing in History and Social Studies standards (CCSS 8.5, 8.6, backup) and three glossaries (backup).
- Appendix C-1, pages 106-109: Economics (grid, pages 107-109 are pictures, text from OCR).
- Appendices D, D-1, E, E-1 (arts and humanities, health, family and consumer sciences, career education): not social studies, backup.
- Appendix F, pages 130-136: Personal Finance (grid, pages 132-136 are pictures, text from OCR).

Row clusters:
- Civics, geography, history: K-3, 4-6, 7-9, 10-12 (the table columns for grades 3, 6, 9 and 12; project convention for PA).
- Economics and personal finance: K-2, 3-5, 6-8, 9-12 (the grid's four grade columns).
- Shared lead-in and strand headings: K-12.

Notes:
- Civics, geography and history tables: column C1 = grade 3, C2 = grade 6, C3 = grade 9, C4 = grade 12. Row 1 = strand heading, row 2 = grade headers, row 3 = lead-in, rows 4+ = lettered statements.
- Economics and personal finance grids: the first column is the substrand (label, x = 0); grade cells sit at about x = 101-104 (K-2), 168-173 (3-5), 235-249 (6-8) and 320-339 (9-12). Page text was OCR'd by `scripts/extract_units.py` (`ocr_units`), so check those units against the PDF.
- No course rows: PA standards are by grade.
