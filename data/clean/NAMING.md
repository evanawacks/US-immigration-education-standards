# Naming convention (draft v0 — reviewed after all states are labeled)

## Row IDs

`<ST>_<GRADE>[_<Course>]`

| Part | Rule | Examples |
|---|---|---|
| `ST` | USPS code (DC for District of Columbia) | `AR`, `DC` |
| `GRADE` | `PK`, `K`, two-digit grades `01`–`12`; clusters as `first-last`; non-contiguous joined with `+` | `K`, `03`, `K-02`, `06-08`, `09-12` |
| `Course` | CamelCase of the standardized course name (only for course rows) | `USHistory`, `Psychology`, `ArkansasHistory` |
| special | `<ST>_ALL` holds document-wide backup text (intros, front matter, running headers) for the state; `<ST>_NONE` marks a state with no source file | `MD_NONE` |

## Columns

| Column | Content |
|---|---|
| `id` | row ID above |
| `state` | USPS code |
| `grade` | list form, K = 0, Pre-K = PK: `[3]`, `[0,1,2]`, `[9,10,11,12]`, `[PK]`, `[ALL]` |
| `course` | standardized course name (empty for grade rows) |
| `course_title` | course title exactly as written in the source |
| `body_standards` | verbatim standards text for that state/grade/course (formal standards, benchmarks, expectations, and shared skills standards copied into each grade they apply to) |
| `body_examples` | verbatim examples, clarifications, teacher notes, suggested topics, content narrative |
| `backup` | verbatim non-standards text from the same sections (intros, how-to-read, pedagogy, literacy standards, front matter) |
| `source_files` | files that contributed |
| `issues` | extraction/labeling problems, unused files and why |

## Course names

Course titles are kept verbatim in `course_title`; `course` uses a standardized vocabulary built while labeling (see `course_names.json`).
