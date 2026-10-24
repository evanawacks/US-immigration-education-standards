#!/usr/bin/env python3
"""Main documents and their subfiles: one used document of a state that also holds the text of other used documents of
the same state, e.g. Maine's full 2019 standards and its separate History and Geography extracts.

Counting rule (scripts/topic_tags.py and scripts/keyword_tags.py): the subfiles count on their own, and a sentence of the
main document that is also in one of its subfiles is not counted again; text found only in the main document still counts.

Detection: file A is a subfile of file B when at least PART_SHARE of A's distinctive standards text is in B. Text is
compared as 8-word sequences; "distinctive" leaves out the sequences found in two or more other files of the state, so
boilerplate a state repeats in every document (an introduction, a shared skills table) does not make one document look
like part of another. On the current corpus subfiles score 0.89-0.95 and every other pair 0.28 or less.
A state's "parts" in data/clean/state_config.json overrides detection: {"main file": ["subfile", ...]} ({} turns it off).

Usage: python scripts/doc_parts.py [ST ...]   prints the main documents and subfiles found
"""
import collections, json, re, sys
from functools import lru_cache
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from check_labels import parse_units
CLEAN = ROOT / "data" / "clean"
PART_SHARE = 0.6
SENTENCE_SHARE = 0.8
GRAM = 8

def words(text):
    return re.findall(r"[a-z0-9]+", text.lower())

def norm(text):
    """Lowercase words joined by single spaces, padded, so `norm(a) in norm(b)` matches whole words."""
    return " " + " ".join(words(text)) + " "

def _units(st, fname):
    uf = CLEAN / "units" / st / f"{fname}.units.jsonl"; lf = CLEAN / "labels" / st / f"{fname}.labels.json"
    if not uf.exists() or not lf.exists(): return None
    cat = {}
    for l in json.loads(lf.read_text()).get("labels", []):
        for x in parse_units(l["units"]): cat.setdefault(x, l["cat"])
    out = []
    for line in open(uf):
        u = json.loads(line)
        if not u.get("furniture"): out.append((cat.get(int(u["id"][1:])), u["text"]))
    return out

def detect(st, c):
    """{main file: [subfiles]} for one state's config."""
    if "parts" in c: return {m: list(s) for m, s in c["parts"].items()}
    used = [f for f, v in c.get("files", {}).items() if v == "use"]
    if len(used) < 2: return {}
    grams = {}
    for f in used:
        us = _units(st, f)
        if us is None: continue
        g = set()
        for cat, text in us:
            if cat != "standards": continue
            w = words(text)
            g.update(" ".join(w[i:i + GRAM]) for i in range(len(w) - GRAM + 1))
        grams[f] = g
    seen = collections.Counter(x for g in grams.values() for x in g)
    parts = {}
    for a, A in grams.items():
        own = [x for x in A if seen[x] <= 2]   # in A and at most one other file
        if len(own) < 50: continue
        best = max(((sum(x in B for x in own) / len(own), b) for b, B in grams.items() if b != a and len(B) > len(A)), default=None)
        if best and best[0] >= PART_SHARE: parts.setdefault(best[1], []).append(a)
    return {m: sorted(s) for m, s in parts.items()}

@lru_cache(maxsize=None)
def _state(st):
    cfg = json.loads((CLEAN / "state_config.json").read_text())
    return detect(st, cfg.get(st, {}))

def parts(st):
    """{main file: [subfiles]} for a state (detected once per run)."""
    return _state(st)

@lru_cache(maxsize=None)
def _subtext(st, main):
    """The subfiles' text as one normalized string, and its set of 8-word sequences."""
    text = "".join(norm(t) for sub in parts(st).get(main, []) for _, t in (_units(st, sub) or []))
    w = text.split()
    return text, {" ".join(w[i:i + GRAM]) for i in range(len(w) - GRAM + 1)}

def repeated_in_subfile(st, fname, sentence):
    """True when fname is a main document and this sentence is also in one of its subfiles (count it there only):
    the same words, or for a longer sentence at least SENTENCE_SHARE of its 8-word sequences (the two copies can be
    split into units differently, or differ in a word or a heading number)."""
    if fname not in parts(st): return False
    s = norm(sentence)
    text, grams = _subtext(st, fname)
    if len(s) > 2 and s in text: return True
    w = s.split()
    g = [" ".join(w[i:i + GRAM]) for i in range(len(w) - GRAM + 1)]
    return bool(g) and sum(x in grams for x in g) >= SENTENCE_SHARE * len(g)

def order(st, files):
    """Files with every subfile ahead of the other files, so a sentence repeated in a subfile is credited to it."""
    subs = {s for ss in parts(st).values() for s in ss}
    return [f for f in files if f in subs] + [f for f in files if f not in subs]

if __name__ == "__main__":
    cfg = json.loads((CLEAN / "state_config.json").read_text())
    for st in sys.argv[1:] or sorted(cfg):
        for m, subs in parts(st).items(): print(f"{st}: {m}\n    subfiles: {', '.join(subs)}")
