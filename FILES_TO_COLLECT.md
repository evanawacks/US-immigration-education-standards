# Files to collect manually

Drop new files in `inbox/` (see `inbox/README.md`; start the filename with the state code, e.g. `TX_Subchapter_A.pdf`) and tell me. "Link originally used" is the page listed in the source spreadsheet; where the crawler pulled a specific file, that URL is in the last column.

## Required (corpus is incomplete or unusable without these)

| Priority | State | What's missing | Link originally used | File we actually got (and why it isn't enough) |
|---|---|---|---|---|
| 1 | **MD** Maryland | Everything. The site was down ("under construction") so nothing was downloaded. Need the state social studies standards and grade-level frameworks, all grades K-12. Board requested revisions in June 2025, so get the current in-force version and note any newer draft. | https://marylandpublicschools.org/about/Pages/DCAA/Social-Studies/MSSS.aspx | None |
| 1 | **TX** Texas | K-8 and high school required-course standards. Chapter 113 has Subchapter A (Elementary, K-5), B (Middle School, 6-8), C (High School), and D (Other Social Studies Courses). Only D was downloaded. | https://tea.texas.gov/laws-and-rules/texas-administrative-code/19-tac-chapter-113 | `ch113d.pdf` (7 pages, only electives such as AP US History): https://tea.texas.gov/laws-and-rules/sboe-rules-tac/sboe-tac-currently-effect/ch113d.pdf . Subchapters A, B and C are probably in the same folder as `ch113a.pdf`, `ch113b.pdf`, `ch113c.pdf` (guess, not checked) |
| 1 | **GA** Georgia | Grades 6-12. The file is a web print of the elementary K-5 page only. Need Middle School (6-8) and High School courses (e.g. US History, World History, American Government, Economics). | https://gadoe.org/learning/social-studies/ (alternate listed in the spreadsheet: https://case.georgiastandards.org/a446e74c-463e-11e7-94f5-b49cee8b2d8c/a446e74c-463e-11e7-94f5-b49cee8b2d8c ) | `GA Social Studies K-12.pdf` (your upload; contains K-5 only) |
| 1 | **UT** Utah | Grades 7 and 8 (and confirm which grades the "highschool" course files cover). The spreadsheet says K-6 were revised in 2022 and 7-12 in 2016. Only K-6 and high-school-labeled courses are in the corpus. | https://www.uen.org/core/socialstudies/ | Crawler got only `UtahSocialStudiesK-6StandardsImplementationTimeline_2023 - 2025_ADA_Compliant.pdf` (not standards): https://www.uen.org/core/socialstudies/downloads/UtahSocialStudiesK-6StandardsImplementationTimeline_2023%20-%202025_ADA_Compliant.pdf |
| 1 | **VT** Vermont | Vermont's own K-8 framework/expectations. The two files are the national C3 Framework (the same document, saved twice). | https://education.vermont.gov/student-learning/content-areas/global-citizenship/social-studies | https://www.socialstudies.org/sites/default/files/c3/c3-framework-for-social-studies-rev0617.pdf and https://www.socialstudies.org/system/files/2022/c3-framework-for-social-studies-rev0617.2.pdf (national C3, not Vermont-specific) |
| 1 | **DC** District of Columbia | English-language version of the standards. The main file is the Spanish translation. | https://osse.dc.gov/node/1524706 | `TAL_SSStandards_SinglePageLayout_BW.pdf` (Spanish): https://osse.dc.gov/sites/default/files/dc/sites/osse/page_content/attachments/TAL_SSStandards_SinglePageLayout_BW.pdf . Other files from that page are tools, not standards. |

## Recommended (improves quality)

| Priority | State | What's missing | Link originally used | File we actually got |
|---|---|---|---|---|
| 2 | **WV** West Virginia | A text-based (not scanned) copy of Policy 2520.4. The PDF is a scan; I OCR'd it, but words run together, so counts are approximate. Same policy on the WVDE site (look for a Word/PDF version) would be better. | https://apps.sos.wv.gov/adlaw/csr/readfile.aspx?DocId=57330&Format=PDF | Same URL (scanned) |
| 2 | **OH** Ohio | Confirm the standards are complete. All 14 Ohio files you uploaded are byte-identical (one 47-page PDF, "adopted February 2018"), so the per-grade links all returned the same file. Check whether grade/course-specific documents exist. | https://education.ohio.gov/Topics/Learning-in-Ohio/Social-Studies/Ohio-s-Learning-Standards-for-Social-Studies | Your uploads: `Ohio-s-Learning-Standards-for-Social-Studies_01-2019 *.pdf` |
| 2 | **MO** Missouri | Cleaner PDFs of the K-5 and 6-12 grade-level expectations. Both extract with doubled/garbled text; the Excel version is usable but the PDFs are not. | https://dese.mo.gov/college-career-readiness/curriculum/missouri-learning-standards | Your uploads: `curr-MO-standards-ss-k-5-sboe-2016_AOD.pdf`, `curr-MO-standards-ss-6-12-sboe-2016_AOD.pdf` |
| 3 | **WI** Wisconsin | Optional: a text-based copy of "WMAS for Social Studies" (scanned). The main 2018 standards are fine. | https://dpi.wi.gov/social-studies/standards | https://dpi.wi.gov/sites/default/files/imce/social-studies/WMAS%20for%20Social%20Studies.pdf |

## Also worth a look (no action needed unless you want to)

- **NE**: revised standards expected fall 2026. **TN**: revised standards take effect 2027-28. **ND**: draft 2026 revision under way. **ID**: 2026 revision went to the Legislature. Our files are the current in-force versions, flagged in the master report.
- **DE** documents are very short (about 4,000 words across 4 Word files). Probably complete, since Delaware writes standards by grade cluster, but worth a glance on the Delaware page: https://education.delaware.gov/educators/academic-support/standards-and-assessments/social-studies/standards
