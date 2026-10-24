#!/usr/bin/env python3
"""Tag the labeled text of every used document with immigration topics, using a local embedding
model (no LLM).

Rules (agreed with the project lead):
  - Text is split into sentences (bullet items count as sentences), and each sentence is read in
    overlapping windows of WINDOW words (step STRIDE); a sentence of WINDOW words or fewer is one window.
  - By meaning: each window gets the ONE topic whose embedding is most similar to it (top-1 cosine),
    so a passage close to two topics only counts for the closer one, while a sentence that moves
    from one topic to another gets both. Within a sentence a topic is tagged once (its best window).
  - By name: a sentence also gets every topic whose name or search terms appear in it literally,
    so two topics named in the same sentence are both tagged.
  - Each tag records the words that triggered it (the window, or the name found) with their place in
    the unit text and in the document (word position), so repeats close together can be dropped later.
  - Every tag keeps its similarity score, so a minimum score can be applied later (on the website or
    in R) to cut false positives. Tags are stored down to a low floor (SCORE_FLOOR) or when named.
  - All labeled text of used documents is tagged (standards, examples and backup; never running
    headers), so every tag can be seen in the document viewer. The analysis (summaries, the website's
    Topics and Charts pages) uses the STANDARDS text only (ANALYSIS_CATS), and leaves out text written for every grade
    at once (K-12, PK-12: anchor standards and overviews; ANALYSIS_EXCLUDE_GRADES).
    Each sentence is counted once per state: an identical sentence with the same grades and category
    in two places of the same state's documents is kept once (its first occurrence).
  - Main documents and subfiles (scripts/doc_parts.py): when one document holds the text of other documents of the
    state, the subfiles count on their own and a sentence of the main document that is also in a subfile is left out.
  - Grades are the grades the document assigns to the text (a 4-6 band stays "04-06"; it is not
    split into grades), from the same rules the database assembler uses.

Outputs (data/analysis/):
  topics.csv            the 106 topics, numbered in the order of data/reference/immigration_topics.csv
  topic_tags.csv        one row per tag: sentence, the matched words, where it is (state, file, unit, character
                        span in the unit, word position in the document), grades, course, category, topic,
                        similarity score, and how it was found (meaning / name / both)
  text_words.csv        words and sentences counted per state x category x grade group (denominators)
  state_summary.csv     per state (standards text): words, tags and tags per 10,000 words at DEFAULT_MIN_SCORE
  topic_tags_meta.json  model, settings and run date
Usage: python scripts/topic_tags.py [--reuse] [--count] [--retag]   (needs: pip install fastembed; --reuse skips
       re-embedding when only the tagging rules or settings changed; --retag needs no model: it reuses the tags already in
       topic_tags.csv, since a sentence's tags depend on its text only, when only the choice of counted sentences changed,
       e.g. main documents and subfiles)
"""
import csv, json, re, sys, collections, datetime
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from assemble_clean import CLEAN, case_csv_text, doc_grade_context, label_grades, gtoken, limit_labels
from check_labels import parse_units
from course_vocab import standardize
import doc_parts
OUT = ROOT / "data" / "analysis"
MODEL = "BAAI/bge-base-en-v1.5"
SCORE_FLOOR = 0.60          # top-1 matches below this are not stored (named matches always are)
DEFAULT_MIN_SCORE = 0.70    # default cut-off for summaries; the website lets you change it
WINDOW, STRIDE = 12, 6      # words per window and step between windows
PARTS = [("standards", "examples"), ("backup",)]   # tagged in two runs, each with its own similarity cache
ANALYSIS_CATS = ("standards",)                      # what the summaries and website analysis count
ANALYSIS_EXCLUDE_GRADES = ("K-12", "PK-12")         # text for every grade at once (anchor standards, overviews): tagged and
                                                    # shown in the viewer, not counted in the summaries or website analysis

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

GENERIC_TAIL = {"migration", "migrations", "movement", "act", "era", "crisis", "decision", "decisions"}

def term_patterns(topics):
    pats = []
    for t in topics:
        name = t["topic"].split("(")[0].strip()
        names = [name] + t["terms"]
        w = name.split()
        if len(w) >= 3 and w[-1].lower() in GENERIC_TAIL: names.append(" ".join(w[:-1]))   # "Irish Potato Famine migration" -> "Irish Potato Famine"
        alts = sorted({re.escape(n) for n in names if len(n) >= 4}, key=len, reverse=True)
        pats.append(re.compile(r"(?<![A-Za-z])(?:" + "|".join(alts) + r")(?![A-Za-z])", re.I) if alts else None)
    return pats

# ---------- corpus ----------
def windows(sentence):
    """[(char_start, char_end, text)] of the overlapping word windows of a sentence."""
    toks = [(m.start(), m.end()) for m in re.finditer(r"\S+", sentence)]
    n = len(toks)
    if n <= WINDOW: return [(0, len(sentence), sentence)]
    starts = list(range(0, n - WINDOW + 1, STRIDE))
    if starts[-1] + WINDOW < n: starts.append(n - WINDOW)
    return [(toks[a][0], toks[a + WINDOW - 1][1], sentence[toks[a][0]:toks[a + WINDOW - 1][1]]) for a in starts]

def corpus(cats, use_parts=True):
    cfg = json.loads((CLEAN / "state_config.json").read_text())
    seen, items, words = set(), [], collections.Counter()
    sents_n = collections.Counter()
    for st in sorted(cfg):
        files = [f for f, v in cfg[st].get("files", {}).items() if v == "use"]
        for fname in (doc_parts.order(st, files) if use_parts else files):
            uf = CLEAN / "units" / st / f"{fname}.units.jsonl"; lf = CLEAN / "labels" / st / f"{fname}.labels.json"
            if not uf.exists() or not lf.exists(): continue
            units = {int(json.loads(l)["id"][1:]): json.loads(l) for l in open(uf)}
            labels, _ = limit_labels(cfg[st], fname, json.loads(lf.read_text()).get("labels", []))
            doc_grades, clamp = doc_grade_context(labels)
            which = {}
            for l in labels:
                for x in parse_units(l["units"]): which.setdefault(x, l)
            doc_words = 0   # running word count of the document (all non-header units), for word positions
            for n in sorted(units):
                u = units[n]; l = which.get(n)
                if u.get("furniture"): continue
                text = case_csv_text(u["text"]) if fname.lower().endswith(".csv") else u["text"]
                before = doc_words; doc_words += len(text.split())
                if not l or l["cat"] not in cats: continue
                g = gtoken(label_grades(l, doc_grades, clamp))
                course = " ".join(l["course"].split()) if l.get("course") else ""
                cursor = 0
                for si, s in enumerate(sentences(text), start=1):
                    at = text.find(s, cursor)
                    if at >= 0: cursor = at + len(s)
                    key = (st, l["cat"], g, " ".join(s.lower().split()))
                    if key in seen or (use_parts and doc_parts.repeated_in_subfile(st, fname, s)): continue
                    seen.add(key)
                    w = len(s.split())
                    words[(st, l["cat"], g)] += w; sents_n[(st, l["cat"], g)] += 1
                    items.append({"state": st, "file": fname, "unit": n, "sentence_no": si, "sentence": s, "category": l["cat"], "grades": g,
                                  "course": standardize(course)[0] if course else "", "course_title": course, "words": w,
                                  "at": at, "wpos": before + (len(text[:at].split()) if at >= 0 else 0)})
    return items, words, sents_n

def main():
    topics = load_topics()
    reuse = "--reuse" in sys.argv
    if "--retag" in sys.argv: return retag(topics)
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
        wins = [windows(it["sentence"]) for it in items]
        flat = [(k, j) for k, ws in enumerate(wins) for j in range(len(ws))]
        print(f"{'/'.join(cats)}: {len(items):,} unique sentences, {len(flat):,} windows, {sum(w.values()):,} words", flush=True)
        cache = OUT / f"similarity_cache_{'_'.join(cats)}.npy"   # not committed; --reuse skips re-embedding
        sim_all = np.load(cache) if reuse and cache.exists() else None
        if sim_all is not None and sim_all.shape != (len(flat), len(topics)): sim_all = None
        if sim_all is None:
            # embed in order of length (less padding per batch, much faster), keep results in window order
            texts = [wins[k][j][2] for k, j in flat]
            order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
            sim_all = np.zeros((len(texts), len(topics)), dtype=np.float32)
            B = 8192
            for b0 in range(0, len(order), B):
                idx = order[b0:b0 + B]
                sv = embed([texts[i] for i in idx])
                sv /= np.linalg.norm(sv, axis=1, keepdims=True)
                sim_all[idx] = sv @ tvec.T
                print(f"  embedded {min(b0 + B, len(order)):,}/{len(order):,} windows", flush=True)
            np.save(cache, sim_all)
        row0 = 0
        for it, ws in zip(items, wins):
            sim = sim_all[row0:row0 + len(ws)]; row0 += len(ws)
            sent = it["sentence"]
            best_w = sim.argmax(axis=1)                       # each window's top topic
            top_score = float(sim.max())
            found = {}                                        # topic -> (score, char span in sentence, method)
            for j, (a0, a1, _) in enumerate(ws):
                t = int(best_w[j]); sc = float(sim[j, t])
                if sc >= SCORE_FLOOR and (t not in found or sc > found[t][0]): found[t] = (sc, a0, a1, "meaning")
            for i, p in enumerate(pats):
                m = p.search(sent) if p else None
                if not m: continue
                sc = float(sim[:, i].max())
                found[i] = (sc, m.start(), m.end(), "both" if i in found else "name")
            for i, (sc, a0, a1, method) in sorted(found.items(), key=lambda x: -x[1][0]):
                rows.append(tag_row(it, topics[i], round(sc, 4), method, round(top_score, 4), a0, a1))
    write_outputs(topics, rows, words, sents_n, n_items)

def tag_row(it, topic, score, method, top_score, a0, a1):
    """One output row: topic tag on a corpus item, the matched words at a0:a1 of its sentence."""
    sent, at = it["sentence"], it["at"]
    return {**{k: it[k] for k in ("state", "file", "unit", "sentence_no", "category", "grades", "course", "course_title")},
            "topic_no": topic["no"], "topic": topic["topic"], "era": topic["era"],
            "score": score, "method": method, "top_score": top_score,
            "matched": sent[a0:a1], "char_start": at + a0 if at >= 0 else "", "char_end": at + a1 if at >= 0 else "",
            "word_pos": it["wpos"] + len(sent[:a0].split()), "sentence": sent}

def retag(topics):
    """Rebuild the outputs from the tags already in topic_tags.csv, without the model: a sentence's tags depend on its
    text only, so each sentence of the current corpus gets the tags its text had in the last full run."""
    by_no = {t["no"]: t for t in topics}
    old_meta = json.loads((OUT / "topic_tags_meta.json").read_text())
    rows, words, sents_n, n_items = [], collections.Counter(), collections.Counter(), 0
    for cats in PARTS:
        # where each sentence of the last run sat (the corpus without the main/subfile rule, as tagged)
        old_items = corpus(cats, use_parts=False)[0]
        at = {(it["state"], it["file"], int(it["unit"]), it["sentence_no"]): it["at"] for it in old_items}
        ws = lambda x: " ".join(x.split())   # the same sentence can differ in white space only (a no-break space)
        known = {ws(it["sentence"]) for it in old_items}
        tags = {}   # sentence -> (its text, [(topic, score, method, top_score, a0, a1)]) from its first tagged occurrence
        first = {}
        for r in csv.DictReader(open(OUT / "topic_tags.csv", encoding="utf-8")):
            if r["category"] not in cats: continue
            occ = (r["state"], r["file"], int(r["unit"]), int(r["sentence_no"]))
            if first.setdefault(r["sentence"], occ) != occ: continue
            a = at.get(occ, -1)
            a0 = int(r["char_start"]) - a if r["char_start"] != "" and a >= 0 else r["sentence"].find(r["matched"])
            tags.setdefault(ws(r["sentence"]), (r["sentence"], []))[1].append((by_no[int(r["topic_no"])], float(r["score"]), r["method"], float(r["top_score"]), a0, a0 + len(r["matched"])))
        items, w, sn = corpus(cats)
        # a state missing from the last run's word counts (its documents were replaced since) is left out until a full run
        tagged = {r["state"] for r in csv.DictReader(open(OUT / "text_words.csv", encoding="utf-8"))}
        skip = sorted({it["state"] for it in items} - tagged)
        if skip:
            print(f"  not in the last full run, left out until scripts/topic_tags.py runs with the model: {', '.join(skip)}")
            items = [it for it in items if it["state"] in tagged]
            w = collections.Counter({k: v for k, v in w.items() if k[0] in tagged}); sn = collections.Counter({k: v for k, v in sn.items() if k[0] in tagged})
        new = [it["sentence"] for it in items if ws(it["sentence"]) not in known]
        if new: sys.exit(f"{len(new)} sentences were not in the last full run (e.g. {new[0][:80]!r}): run without --retag")
        words.update(w); sents_n.update(sn); n_items += len(items)
        for it in items:
            text, found = tags.get(ws(it["sentence"]), ("", []))
            for t in found:
                if len(text) != len(it["sentence"]):   # white space changed length: find the matched words again
                    m = re.search(r"\s+".join(map(re.escape, text[t[4]:t[5]].split())), it["sentence"])
                    t = (*t[:4], m.start(), m.end()) if m else t
                rows.append(tag_row(it, *t))
        print(f"{'/'.join(cats)}: {len(items):,} sentences (was {len(old_items):,}), {sum(w.values()):,} words")
    write_outputs(topics, rows, words, sents_n, n_items, {"run": old_meta.get("run"), "retagged": now()})

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

def write_outputs(topics, rows, words, sents_n, n_items, meta_extra=None):
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
        if c in ANALYSIS_CATS and g not in ANALYSIS_EXCLUDE_GRADES: summ[st][0] += n
    for r in rows:
        if r["category"] in ANALYSIS_CATS and r["grades"] not in ANALYSIS_EXCLUDE_GRADES and (r["score"] >= DEFAULT_MIN_SCORE or r["method"] != "meaning"): summ[r["state"]][1] += 1
    with open(OUT / "state_summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["state", "text", "words", "tags", "tags_per_10k_words", "min_score"])
        for st, (n, t) in sorted(summ.items()): w.writerow([st, "+".join(ANALYSIS_CATS), n, t, round(t / n * 1e4, 2) if n else "", DEFAULT_MIN_SCORE])
    (OUT / "topic_tags_meta.json").write_text(json.dumps({"model": MODEL, "score": "cosine similarity of a text window and the topic embedding",
        "window_words": WINDOW, "window_step": STRIDE,
        "topic_text": "'<topic>: <description> Related terms: <search terms>.'", "score_floor": SCORE_FLOOR, "default_min_score": DEFAULT_MIN_SCORE,
        "tagged_categories": [c for p in PARTS for c in p], "analysis_categories": list(ANALYSIS_CATS), "analysis_exclude_grades": list(ANALYSIS_EXCLUDE_GRADES),
        "sentences": n_items, "tags": len(rows), "run": now(), **(meta_extra or {})}, indent=1))
    print("wrote", OUT)

if __name__ == "__main__":
    main()
