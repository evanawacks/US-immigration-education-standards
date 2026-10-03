import json,sys
def mk(file, grade, last, codes, course=None):
    d={"state":"IN","file":file,
    "structure":f"Single-grade document (Grade {grade}). Pages 2-4: context/purpose, C3 and historical thinking skills, acknowledgments (backup). Page 5 onward: one table with four domains (History, Civics and Government, Geography, Economics); each domain has a heading row, a Learning Outcome row, then standard rows with C1 = code ({codes}) and C2 = standard text; '(E)' marks essential standards. No examples or teacher notes.",
    "labels":[
     {"units":"u2-u19","grades":grade,"course":None,"cat":"backup","section":"Context and purpose, introduction, thinking skills, acknowledgments"},
     {"units":"u22","grades":grade,"course":None,"cat":"standards","section":f"Grade {grade} Social Studies title"},
     {"units":"u23","grades":grade,"course":None,"cat":"backup","section":"How to read: essential standards note"},
     {"units":f"u24-u{last}","grades":grade,"course":None,"cat":"standards","section":"Domains 1-4 learning outcomes and standards"}],
    "issues":[]}
    json.dump(d,open(file+".labels.json","w"),indent=1)
