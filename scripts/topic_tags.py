#!/usr/bin/env python3
"""Tag every sentence of the standards and examples text with immigration topics, using a local
embedding model (no LLM).

Rules (agreed with the project lead):
  - The tagging unit is the sentence (each unit of a used document is split into sentences; bullet
    items count as sentences).
  - By meaning: each sentence gets the ONE topic whose embedding is most similar to it (top-1 cosine).
  - By name: a sentence also gets every topic whose name or search terms appear in it literally,
    so two topics named in the same sentence are both tagged.
  - Every tag keeps its similarity score, so a minimum score can be applied later (on the website or
    in R) to cut false positives. Tags are stored down to a low floor (SCORE_FLOOR) or when named.
  - All labeled text of used documents is tagged (standards, examples and backup; never running
    headers), so every tag can be seen in the document viewer. The analysis (summaries, the website's
    Topics and Charts pages) uses the STANDARDS text only (ANALYSIS_CATS).
    Each sentence is counted once per state: an identical sentence with the same grades and category
    in two places of the same state's documents is kept once (its first occurrence).
  - Grades are the grades the document assigns to the text (a 4-6 band stays "04-06"; it is not
    split into grades), from the same rules the database assembler uses.

Outputs (data/analysis/):
  topics.csv            the 106 topics, numbered in the order of data/reference/immigration_topics.csv
  topic_tags.csv        one row per tag: sentence, where it is (state, file, unit), grades, course,
                        category, topic, similarity score, and how it was found (meaning / name / both)
  text_words.csv        words and sentences counted per state x category x grade group (denominators)
  state_summary.csv     per state (standards text): words, tags and tags per 10,000 words at DEFAULT_MIN_SCORE
  topic_tags_meta.json  model, settings and run date
Usage: python scripts/topic_tags.py [--reuse] [--count]   (needs: pip install fastembed; --reuse skips re-embedding
       when only the tagging rules or settings changed)
"""
import csv, json, re, sys, collections, datetime
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from assemble_clean import CLEAN, case_csv_text, doc_grade_context, label_grades, gtoken
from check_labels import parse_units
from course_vocab import standardize
OUT = ROOT / "data" / "analysis"
MODEL = "BAAI/bge-base-en-v1.5"
SCORE_FLOOR = 0.60          # top-1 matches below this are not stored (named matches always are)
DEFAULT_MIN_SCORE = 0.70    # default cut-off for summaries; the website lets you change it
PARTS = [("standards", "examples"), ("backup",)]   # tagged in two runs, each with its own similarity cache
ANALYSIS_CATS = ("standards",)                      # what the summaries and website analysis count

# ---------- sentences ----------
ABBR = r"\b(?:e\.g|i\.e|etc|v|U\.S|U\.S\.A|U\.K|U\.N|D\.C|St|Mr|Mrs|Ms|Dr|Jr|Sr|vs|No|Gov|Pres|Gen|Rev|ca|c|approx|Ch|Vol|pp|p|Fig|Inc|Co|Corp|Ltd|Mt|Ft|B\.C|A\.D|B\.C\.E|C\.E)\."
BULLET = re.compile(r"\s*(?:[●•▪■◦○❖➢►✓\uf0b7\uf0a7\uf076\uf0d8]|(?<=\s)[-–]{1,2}(?=\s)|(?:^|(?<=\s))o(?=\s+[A-Z]))\s*")

def sentences(text):
    out = []
    for part in BULLET.split(text):
        part = part.strip()
        if not part: continue
        prot = re.sub(ABBR, lambda m: m.group(0).replace(".", "\x00"), part)
        prot = re.sub(r"\b([A-Z])\.(?=\s*[A-Z]\.)", "\\1\x00", prot)   # initials: W. E. B.
        for s in re.split(r"(?<=[.!?])[\"”’)]?\s+(?=[\"“(]?[A-Z0-9])", prot):
            s = s.replace("\x00", ".").strip()
            if len(re.findall(r"[A-Za-z]{2,}", s)) >= 2: out.append(s)
    return out

# ---------- topics ----------
def load_topics():
    rows = list(csv.DictReader(open(ROOT / "data" / "reference" / "immigration_topics.csv", encoding="utf-8")))
    topics = []
    for i, r in enumerate(rows, start=1):
        terms = [t.strip() for t in r["search_terms"].split(";") if t.strip()]
        topics.append({"no": i, "era": r["era"], "topic": r["topic"], "years": r["years"], "description": r["description"], "terms": terms})
    return topics

def term_patterns(topics):
    pats = []
    for t in topics:
        names = [t["topic"].split("(")[0].strip()] + t["terms"]
        alts = sorted({re.escape(n) for n in names if len(n) >= 4}, key=len, reverse=True)
        pats.append(re.compile(r"(?<![A-Za-z])(?:" + "|".join(alts) + r")(?![A-Za-z])", re.I) if alts else None)
    return pats

# ---------- corpus ----------
def corpus(cats):
    cfg = json.loads((CLEAN / "state_config.json").read_text())
    seen, items, words = set(), [], collections.Counter()
    sents_n = collections.Counter()
    for st in sorted(cfg):
        for fname, v in cfg[st].get("files", {}).items():
            if v != "use": continue
            uf = CLEAN / "units" / st / f"{fname}.units.jsonl"; lf = CLEAN / "labels" / st / f"{fname}.labels.json"
            if not uf.exists() or not lf.exists(): continue
            units = {int(json.loads(l)["id"][1:]): json.loads(l) for l in open(uf)}
            labels = json.loads(lf.read_text()).get("labels", [])
            doc_grades, clamp = doc_grade_context(labels)
            which = {}
            for l in labels:
                for x in parse_units(l["units"]): which.setdefault(x, l)
            for n in sorted(units):
                u = units[n]; l = which.get(n)
                if u.get("furniture") or not l or l["cat"] not in cats: continue
                text = case_csv_text(u["text"]) if fname.lower().endswith(".csv") else u["text"]
                g = gtoken(label_grades(l, doc_grades, clamp))
                course = " ".join(l["course"].split()) if l.get("course") else ""
                for si, s in enumerate(sentences(text), start=1):
                    key = (st, l["cat"], g, " ".join(s.lower().split()))
                    if key in seen: continue
                    seen.add(key)
                    w = len(s.split())
                    words[(st, l["cat"], g)] += w; sents_n[(st, l["cat"], g)] += 1
                    items.append({"state": st, "file": fname, "unit": n, "sentence_no": si, "sentence": s, "category": l["cat"], "grades": g,
                                  "course": standardize(course)[0] if course else "", "course_title": course, "words": w})
    return items, words, sents_n

def main():
    topics = load_topics()
    reuse = "--reuse" in sys.argv
    if "--count" in sys.argv:
        for cats in PARTS:
            items, words, _ = corpus(cats); print(cats, f"{len(items):,} unique sentences, {sum(words.values()):,} words")
        return
    from fastembed import TextEmbedding
    model = TextEmbedding(MODEL)
    def embed(texts, bs=64):
        return np.array(list(model.embed(texts, batch_size=bs)), dtype=np.float32)
    OUT.mkdir(parents=True, exist_ok=True)
    tvec = embed([f"{t['topic']}: {t['description']} Related terms: {', '.join(t['terms'])}." for t in topics])
    tvec /= np.linalg.norm(tvec, axis=1, keepdims=True)
    pats = term_patterns(topics)
    rows, words, sents_n, n_items = [], collections.Counter(), collections.Counter(), 0
    for cats in PARTS:
        items, w, sn = corpus(cats)
        words.update(w); sents_n.update(sn); n_items += len(items)
        print(f"{'/'.join(cats)}: {len(items):,} unique sentences, {sum(w.values()):,} words", flush=True)
        cache = OUT / f"similarity_cache_{'_'.join(cats)}.npy"   # not committed; --reuse skips re-embedding
        sim_all = np.load(cache) if reuse and cache.exists() else None
        if sim_all is not None and sim_all.shape != (len(items), len(topics)): sim_all = None
        if sim_all is None:
            # embed in order of length (less padding per batch, much faster), keep results in corpus order
            order = sorted(range(len(items)), key=lambda i: len(items[i]["sentence"]))
            sim_all = np.zeros((len(items), len(topics)), dtype=np.float32)
            B = 4096
            for b0 in range(0, len(order), B):
                idx = order[b0:b0 + B]
                sv = embed([items[i]["sentence"] for i in idx])
                sv /= np.linalg.norm(sv, axis=1, keepdims=True)
                sim_all[idx] = sv @ tvec.T
                print(f"  embedded {min(b0 + B, len(order)):,}/{len(order):,} sentences", flush=True)
            np.save(cache, sim_all)
        for it, srow in zip(items, sim_all):
            best = int(srow.argmax())
            named = {i for i, p in enumerate(pats) if p and p.search(it["sentence"])}
            tags = set(named) | ({best} if srow[best] >= SCORE_FLOOR else set())
            for i in sorted(tags, key=lambda i: -srow[i]):
                method = "both" if i == best and i in named else ("meaning" if i == best else "name")
                rows.append({**{k: it[k] for k in ("state", "file", "unit", "sentence_no", "category", "grades", "course", "course_title")},
                             "topic_no": topics[i]["no"], "topic": topics[i]["topic"], "era": topics[i]["era"],
                             "score": round(float(srow[i]), 4), "method": method, "top_score": round(float(srow[best]), 4), "sentence": it["sentence"]})
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "topics.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["topic_no", "era", "topic", "years", "description", "search_terms"])
        for t in topics: w.writerow([t["no"], t["era"], t["topic"], t["years"], t["description"], "; ".join(t["terms"])])
    with open(OUT / "topic_tags.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    with open(OUT / "text_words.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["state", "category", "grades", "words", "sentences"])
        for (st, c, g), n in sorted(words.items()): w.writerow([st, c, g, n, sents_n[(st, c, g)]])
    summ = collections.defaultdict(lambda: [0, 0])
    for (st, c, g), n in words.items():
        if c in ANALYSIS_CATS: summ[st][0] += n
    for r in rows:
        if r["category"] in ANALYSIS_CATS and (r["score"] >= DEFAULT_MIN_SCORE or r["method"] != "meaning"): summ[r["state"]][1] += 1
    with open(OUT / "state_summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["state", "text", "words", "tags", "tags_per_10k_words", "min_score"])
        for st, (n, t) in sorted(summ.items()): w.writerow([st, "+".join(ANALYSIS_CATS), n, t, round(t / n * 1e4, 2) if n else "", DEFAULT_MIN_SCORE])
    (OUT / "topic_tags_meta.json").write_text(json.dumps({"model": MODEL, "score": "cosine similarity of sentence and topic embeddings",
        "topic_text": "'<topic>: <description> Related terms: <search terms>.'", "score_floor": SCORE_FLOOR, "default_min_score": DEFAULT_MIN_SCORE,
        "tagged_categories": [c for p in PARTS for c in p], "analysis_categories": list(ANALYSIS_CATS),
        "sentences": n_items, "tags": len(rows), "run": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")}, indent=1))
    print("wrote", OUT)

if __name__ == "__main__":
    main()
