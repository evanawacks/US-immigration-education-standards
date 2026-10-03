# Naming convention (v1 — reviewed after all states were labeled)

## Row IDs

`<ST>_<GRADE>[_<Course>]`

| Part | Rule | Examples |
|---|---|---|
| `ST` | USPS code (DC for District of Columbia) | `AR`, `DC` |
| `GRADE` | `PK`, `K`, two-digit grades `01`-`12`; clusters as `first-last` (`K-02`, `06-08`, `09-12`); `ALL` = state-wide backup row; `NONE` = state with no source file | `K`, `03`, `K-02`, `09-12` |
| `Course` | CamelCase of the standardized course name (acronyms and Roman numerals kept) — only for course rows | `USHistoryII`, `CivicsGovernment`, `StateHistory` |

Examples: `CA_05` (California grade 5), `NJ_K-02` (New Jersey K-2 band), `NY_11_USHistory` (New York grade 11 US History and Government), `AR_07-08_StateHistory` (Arkansas History, grades 7-8), `MS_09-12_PsychologyI`, `TX_ALL`, `MD_NONE`.

### Changes made in the review (v0 → v1)

- Course part of the ID now uses the standardized course name instead of the raw title (raw titles produced IDs such as `RI_09-12_UnitedStatesHistoryIPreEuropeanContactTo`; now `RI_09-12_USHistoryI`).
- Added `course_category` so courses can be grouped across states.
- CamelCase keeps acronyms/numerals (`USHistoryII`, not `UsHistoryIi`).
- Course matching is case-insensitive and also keyed by grade span (e.g. NV Financial Literacy 6-8 and 9-12 are two rows).
- Rows that ended up with no standards and no examples text (only front matter) were folded into the state's `_ALL` backup row.

## Grade rule

Rows use the smallest grade cluster the document supports. Grade-specific content gets single-grade rows (`[3]`); content written only for a band gets a band row (`[0,1,2]`). Shared content (K-12 inquiry/practice standards, band standards in a per-grade state) is copied into every grade row it applies to. High-school courses are `[9,10,11,12]` unless the document ties the course to a grade (NY, VA, CA, AL, WV US Studies → grade 10). Pre-K rows exist where a state has Pre-K standards (MA, OK, CO).

## Columns

| Column | Content |
|---|---|
| `id` | row ID above |
| `state` | USPS code |
| `grade` | list form, K = 0, Pre-K = PK: `[3]`, `[0,1,2]`, `[9,10,11,12]`, `[PK]`, `[ALL]` |
| `course` | standardized course name (empty for grade rows) |
| `course_category` | category of the standardized course |
| `course_title` | course title exactly as written in the source |
| `body_standards` | verbatim standards text (standards, benchmarks, expectations, grade/course titles and headings, shared skills standards) |
| `body_examples` | verbatim examples, clarifications, teacher notes, suggested topics, guiding questions, content narrative |
| `backup` | verbatim non-standards text from the same sections (intros, how-to-read, pedagogy, literacy-in-history standards, superseded editions) — the safety net |
| `source_files` | files that contributed |
| `issues` | extraction/labeling problems with unit IDs, unused files and why, reviewer decisions |

Exact repeats inside one column of one row (sidebars and headers printed on every page) are kept once.

## Course vocabulary

| Category | Standardized course (`course`) | Titles as written in the documents (`course_title`) |
|---|---|---|
| Advanced/Other | Advanced Placement | Advanced Placement (TX) |
| Advanced/Other | International Baccalaureate | International Baccalaureate (TX) |
| Advanced/Other | News & Media Literacy | News/Media Literacy (MA) |
| Advanced/Other | Social Studies Advanced Studies | Social Studies Advanced Studies (TX) |
| Advanced/Other | Social Studies Research Methods | Social Studies Research Methods (TX) |
| Advanced/Other | Special Topics in Social Studies | Special Topics in Social Studies (TX) |
| Behavioral Sciences | Anthropology | Anthropology (CA); Anthropology (GA); Anthropology (IL); Anthropology (VT); Cultural Anthropology (HI) |
| Behavioral Sciences | Psychology | Psychology (AL); Psychology (AR); Psychology (CA); Psychology (FL); Psychology (GA); Psychology (HI); Psychology (IA); Psychology (IL); Psychology (KS); Psychology (OK); Psychology (TN); Psychology (TX); … (+2 more) |
| Behavioral Sciences | Psychology I | Psychology I (MS) |
| Behavioral Sciences | Psychology II | Psychology II (MS) |
| Behavioral Sciences | Sociology | Sociology (AL); Sociology (AR); Sociology (CA); Sociology (FL); Sociology (GA); Sociology (HI); Sociology (IA); Sociology (IL); Sociology (IN); Sociology (MS); Sociology (OK); Sociology (TN); … (+3 more) |
| Behavioral Sciences | Sports in US Society | Sports in United States Society (GA) |
| Civics & Government | Civic Participation | Participation in a Democracy (HI) |
| Civics & Government | Civics | Civics (AK); Civics (AR); Civics (KY); Civics (LA); Civics (MI); Civics (RI); Civics (WV); Founding Principles of the United States of America and North Carolina: Civic Literacy (NC); Grade 6 Middle School Civics (IN); HS Civics (NM) |
| Civics & Government | Civics & Economics | Civics & Economics (NV) |
| Civics & Government | Civics & Government | American Government/Civics (GA); Civics and Government (CT); Civics and Government (FL); Civics/Government (IA); Government and Civics (DC); Participation in Government and Civics (NY); United States Government and Civics (TN); United States Government/American Civics (SD) |
| Civics & Government | Constitutional Theory | Constitutional Theory (GA) |
| Civics & Government | Law-Related Education | Law Related Education (MS); Law-Related Education (CA); The Individual and the Law (GA) |
| Civics & Government | Problems of American Democracy | Problems of American Democracy (MS) |
| Civics & Government | US Government | American Government (ID); American Government (OH); Government (MO); Governments of the United States (KS); Political Science/ Government (HI); Principles of American Democracy (CA); U.S. Government (AR); U.S. Government (IN); United States Government (AL); United States Government (MS); United States Government (OK); United States Government (SC); … (+3 more) |
| Civics & Government | US Intelligence & National Security | Introduction to U.S. Intelligence and National Security Studies (GA) |
| Contemporary Issues | Contemporary Issues | American Problems (HI); Contemporary Issues (TN); Contemporary Studies (WV); Contemporary World Issues (AL); Contemporary World Issues (OH); Current Issues (GA) |
| Contemporary Issues | US & World Affairs | United States and World Affairs (GA) |
| Economics | Comparative Political & Economic Systems | Comparative Political/Economic Systems (GA) |
| Economics | Economics | Economics (AK); Economics (AL); Economics (FL); Economics (HI); Economics (IA); Economics (ID); Economics (IN); Economics (KS); Economics (KY); Economics (MA); Economics (MI); Economics (MS); … (+7 more) |
| Economics | Economics & Personal Finance | Economics and Financial Literacy (OH); Economics and Personal Finance (NC); Economics and Personal Finance (SC); Economics with Personal Finance (AR); Economics, the Enterprise System, and Finance (NY); Personal Finance and Economics (GA); Personal Financial Literacy and Economics (TX) |
| Economics | Economics (Advanced) | Economics Advanced Studies (TX) |
| Economics | Personal Finance | Financial Literacy (CA); Financial Literacy (FL); Financial Literacy (HI); Financial Literacy (IA); Financial Literacy (NV); Personal Finance (WV); Personal Financial Literacy (GA); Personal Financial Literacy (MA); Personal Financial Literacy (TX) |
| Ethnic & Cultural Studies | African American History | African American History (AR); African American History (FL); African American History (TN); African American Studies (MS); Ethnic Studies: African American Studies (TX) |
| Ethnic & Cultural Studies | Ethnic Studies | Ethnic Studies (CA); Ethnic Studies (GA); Ethnic, Cultural, and Identity Studies (NM); Minority Studies (MS) |
| Ethnic & Cultural Studies | Ethnic Studies (Mexican American) | Ethnic Studies: Mexican American Studies (TX) |
| Ethnic & Cultural Studies | Filipino History & Culture | Filipino History Culture (HI) |
| Ethnic & Cultural Studies | Women's History | Women in United States History (CA) |
| Geography | Human Geography | Human Geography (AL); Human Geography (SC) |
| Geography | Physical Geography | Physical Geography (CA) |
| Geography | World Geography | Geography (AK); Geography (FL); Geography (HI); Geography (IA); Geography (KY); Geography (MO); Geography (WV); Global Geography (KS); HS Geography (NM); Introduction to Geography (MS); World Geography & Global Studies (NV); World Geography (AR); … (+11 more) |
| Geography | World Geography (Advanced) | Advanced World Geography (MS) |
| History - Topical | Communism & Totalitarianism | History of 20th Century Totalitarianism (OK); History of Communism (FL) |
| History - Topical | Historical Studies | Historical Studies (AL) |
| History - Topical | Holocaust Studies | Holocaust Education (FL); Holocaust Studies (AL) |
| Regional Studies | Asian Studies | Asian Studies (GA); Asian Studies (HI) |
| Regional Studies | European Studies | European Studies (HI) |
| Regional Studies | Global Studies | Global Studies (HI) |
| Regional Studies | Latin American Studies | Latin American Studies (GA) |
| Regional Studies | Pacific Island Studies | Pacific Island Studies (HI) |
| Religion & Humanities | Humanities | Humanities (FL); Humanities (HI); Humanities (MS); The Humanities (CA); The Humanities/Social Studies (GA) |
| Religion & Humanities | Religious Studies | Comparative Religions (GA); Religious Studies (IL); Religious Studies (VT); Survey of World Religions (CA) |
| Religion & Humanities | Religious Studies (New Testament) | History and Literature of the New Testament (GA); Teaching the History and Literature of the New Testament Era (SC) |
| Religion & Humanities | Religious Studies (Old Testament) | History and Literature of the Old Testament (GA); Teaching the History and Literature of the Old Testament Era (SC) |
| State/Local History | State History | Alabama Studies (AL); Alaska History (AK); Arkansas History (AR); District of Columbia History and Government (DC); HS New Mexico History (NM); Kansas History: Prehistoric to Present (KS); Mississippi Studies (MS); Modern California (Twentieth and Twenty-First Centuries) (CA); Modern History of Hawaiʻi (HI); Oklahoma History and Government (OK); Tennessee History (TN); Utah Studies (UT) |
| US History | US History | American History (FL); American History (MO); American History (NC); American History (OH); Early U.S. History & Civic Ideals (NV); HS U.S. History (NM); U.S. History (1877-Present) (NV); U.S. History (AK); U.S. History (IA); U.S. History (IN); U.S. History 1898 C.E. - Present (KS); U.S. History Since 1929 (AR); … (+15 more) |
| US History | US History (Comprehensive) | United States Studies - Comprehensive (WV) |
| US History | US History I | United States History I (ID); United States History I (MA); United States History I (UT); United States History I: Pre-European Contact to Reconstruction (RI) |
| US History | US History II | US History II: Reconstruction through the Present (DC); United States History II (ID); United States History II (MA); United States History II (UT); United States History II: Late 19th Century to the Present (RI) |
| US History | US History III | United States History III (CT) |
| World History | Western Civilization | Foundations of Western Civilization (ID); Western Civilization (MS) |
| World History | World Geography & History | Geography and History of the World (IN) |
| World History | World History | HS World History (NM); World Civilizations and History 1000 C.E. - Present (KS); World History & Geography (1300-Present) (NV); World History (AK); World History (FL); World History (GA); World History (HS.WR) (1789-Present) (OR); World History (IA); World History (KY); World History (LA); World History (MO); World History (NC); … (+10 more) |
| World History | World History (Ancient) | Ancient History (TN); Ancient World History (KS); Ancient and Medieval World History (OK); Early World Civilizations (NV); History of the Ancient Middle East (MS); World History: Ancient to Modern (SD) |
| World History | World History (Modern) | Modern World History (CT); Modern World History (OH); Modern World History (OK); Modern World History (SC) |
| World History | World History I | Global History and Geography I (NY); World History I (DC); World History I (MA); World History I: Ancient to Medieval (RI) |
| World History | World History II | Global History and Geography II (NY); World History II (DC); World History II (MA); World History II: Early Modern to Modern (RI) |
