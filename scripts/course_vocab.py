#!/usr/bin/env python3
"""Standardized course vocabulary: map a course title as written in a state document to
(standard course name, category). Used by assemble_clean.py; reviewed in data/clean/NAMING.md."""
import re

STATE_HISTORY = ["alabama studies", "alaska history", "arkansas history", "kansas history", "mississippi studies",
                 "oklahoma history", "tennessee history", "utah studies", "district of columbia history",
                 "new mexico history", "modern california", "history of hawai", "hawaiian kingdom"]

def standardize(title):
    t = re.sub(r"^(hs|high school)\s+", "", title.strip(), flags=re.I)
    l = t.lower()
    def has(*w): return any(x in l for x in w)
    if has(*STATE_HISTORY): return ("State History", "State/Local History")
    if l in ("advanced placement",): return ("Advanced Placement", "Advanced/Other")
    if l in ("international baccalaureate",): return ("International Baccalaureate", "Advanced/Other")
    if has("research methods"): return ("Social Studies Research Methods", "Advanced/Other")
    if has("special topics"): return ("Special Topics in Social Studies", "Advanced/Other")
    if l.startswith("social studies advanced"): return ("Social Studies Advanced Studies", "Advanced/Other")
    if has("news/media", "media literacy"): return ("News & Media Literacy", "Advanced/Other")
    if has("intelligence and national security"): return ("US Intelligence & National Security", "Civics & Government")
    if has("sports in"): return ("Sports in US Society", "Behavioral Sciences")
    if has("psychology"):
        m = re.search(r"psychology\s+(ii|i)\b", l)
        return (f"Psychology {m.group(1).upper()}" if m else "Psychology", "Behavioral Sciences")
    if has("sociology"): return ("Sociology", "Behavioral Sciences")
    if has("anthropology"): return ("Anthropology", "Behavioral Sciences")
    if has("holocaust"): return ("Holocaust Studies", "History - Topical")
    if has("communism", "totalitarianism"): return ("Communism & Totalitarianism", "History - Topical")
    if has("african american"): return ("African American History", "Ethnic & Cultural Studies")
    if has("mexican american"): return ("Ethnic Studies (Mexican American)", "Ethnic & Cultural Studies")
    if has("ethnic", "minority studies"): return ("Ethnic Studies", "Ethnic & Cultural Studies")
    if has("filipino"): return ("Filipino History & Culture", "Ethnic & Cultural Studies")
    if has("women in"): return ("Women's History", "Ethnic & Cultural Studies")
    if has("old testament"): return ("Religious Studies (Old Testament)", "Religion & Humanities")
    if has("new testament"): return ("Religious Studies (New Testament)", "Religion & Humanities")
    if has("religion", "religious"): return ("Religious Studies", "Religion & Humanities")
    if has("humanities"): return ("Humanities", "Religion & Humanities")
    if has("law"): return ("Law-Related Education", "Civics & Government")
    if has("world affairs"): return ("US & World Affairs", "Contemporary Issues")
    if has("contemporary", "current issues", "american problems") and not has("history"): return ("Contemporary Issues", "Contemporary Issues")
    if has("asian studies", "european studies", "latin american studies", "pacific island"):
        return (re.sub(r"\s+", " ", t.title()), "Regional Studies")
    if has("global studies") and not has("geography"): return ("Global Studies", "Regional Studies")
    if has("comparative political"): return ("Comparative Political & Economic Systems", "Economics")
    if has("constitutional theory"): return ("Constitutional Theory", "Civics & Government")
    if has("problems of american democracy", "problems in american democracy"): return ("Problems of American Democracy", "Civics & Government")
    if has("participation in a democracy"): return ("Civic Participation", "Civics & Government")
    if has("civics & economics", "civics and economics"): return ("Civics & Economics", "Civics & Government")
    if has("personal financ", "financial literacy", "personal finance", "enterprise system, and finance"):
        return ("Economics & Personal Finance", "Economics") if has("econom") else ("Personal Finance", "Economics")
    if has("econom"): return ("Economics (Advanced)", "Economics") if has("advanced") else ("Economics", "Economics")
    if has("civic", "government", "democracy", "founding principles", "political science") and not has("history"):
        if has("civic") and has("government", "democracy", "political"): return ("Civics & Government", "Civics & Government")
        if has("civic", "founding principles"): return ("Civics", "Civics & Government")
        return ("US Government", "Civics & Government")
    if has("human geography"): return ("Human Geography", "Geography")
    if has("physical geography"): return ("Physical Geography", "Geography")
    if has("geography and history of the world"): return ("World Geography & History", "World History")
    if has("advanced world geography"): return ("World Geography (Advanced)", "Geography")
    if has("geography") and not has("history"): return ("World Geography", "Geography")
    if has("western civilization"): return ("Western Civilization", "World History")
    if has("historical studies"): return ("Historical Studies", "History - Topical")
    us = has("u.s.", "united states", "american history", "us history")
    if us:
        m = re.search(r"\b(iii|ii|i)\b(?=[:\s]|$)", l)
        if has("comprehensive"): return ("US History (Comprehensive)", "US History")
        return (f"US History {m.group(1).upper()}" if m else "US History", "US History")
    if has("world", "global history", "ancient", "civilization", "medieval", "middle east"):
        m = re.search(r"\b(ii|i)\b(?=[:\s]|$)", l)
        if m: return (f"World History {m.group(1).upper()}", "World History")
        if has("ancient", "medieval", "early world"): return ("World History (Ancient)", "World History")
        if has("modern world"): return ("World History (Modern)", "World History")
        return ("World History", "World History")
    if has("geography"): return ("World Geography", "Geography")
    return (t, "Other")

if __name__ == "__main__":
    import sqlite3, collections
    from pathlib import Path
    con = sqlite3.connect(Path(__file__).resolve().parent.parent / "data/clean/standards.sqlite")
    seen = collections.defaultdict(list)
    for st, g, t in con.execute("select state, grade, course_title from standards where course_title != ''"):
        s, c = standardize(t); seen[(st, g, s)].append(t)
        print(f"{st:3} {g:14} {t[:60]:60} -> {s} [{c}]")
    print("\nCOLLISIONS:", {k: v for k, v in seen.items() if len(v) > 1})
