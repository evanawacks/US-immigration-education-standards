#!/usr/bin/env python3
"""Step 2 — validate that the original documents were read completely and correctly.

Compares the clean extraction (data/clean/units, made with PyMuPDF / python-docx / openpyxl) against an
INDEPENDENT extraction of the same file (pdftotext per page; raw XML text for .docx; csv module for .csv):
  recall    = share of the independent extractor's words that appear in our units for that page
  precision = share of our unit words that the independent extractor also found on that page
Low recall  -> text lost (images, cropped tables, unusual fonts).  Low precision -> garbled/duplicated text.
Also flags pages with almost no text (likely scanned images or graphics).
Writes data/validation/extraction_pages.csv and extraction_docs.csv.
Usage: python scripts/validate_extraction.py [ST ...]
"""
import collections, csv, json, re, subprocess, sys, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "validation"; OUT.mkdir(parents=True, exist_ok=True)
tok = lambda s: re.findall(r"[a-z0-9]+", s.lower())

def overlap(a, b):
    ca, cb = collections.Counter(a), collections.Counter(b)
    inter = sum((ca & cb).values())
    return inter / max(1, sum(cb.values())), inter / max(1, sum(ca.values()))  # recall vs b, precision of a

def pdf_pages(p):
    n = int(re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", str(p)], capture_output=True, text=True).stdout).group(1))
    out = subprocess.run(["pdftotext", str(p), "-"], capture_output=True, text=True).stdout.split("\f")
    return {i + 1: out[i] if i < len(out) else "" for i in range(n)}

def docx_text(p):
    with zipfile.ZipFile(p) as z:
        xml = z.read("word/document.xml").decode("utf8", "ignore")
    # join the text runs of each paragraph (Word splits words across runs), keep paragraphs separate
    paras = re.findall(r"<w:p[ >].*?</w:p>", xml, re.S)
    return "\n".join("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)) for p in paras)

def main(states):
    cfg = json.loads((ROOT / "data/clean/state_config.json").read_text())
    man = {(r["abbr"], Path(r["local_path"]).name): r["local_path"] for r in csv.DictReader(open(ROOT / "data/manifest.csv"))}
    pages_out, docs_out = [], []
    for st in sorted(states or cfg):
        for f, v in cfg[st]["files"].items():
            if v != "use": continue
            p = ROOT / man[(st, f)]
            units = [json.loads(l) for l in open(ROOT / f"data/clean/units/{st}/{f}.units.jsonl")]
            ext = p.suffix.lower()
            if ext == ".pdf":
                ref = pdf_pages(p)
                import pymupdf
                doc = pymupdf.open(str(p)); imgshare = {}
                for i, pgobj in enumerate(doc, start=1):
                    area = abs(pgobj.rect)
                    tot = 0
                    for info in pgobj.get_image_info():
                        b = pymupdf.Rect(info["bbox"]) & pgobj.rect
                        tot += abs(b)
                    imgshare[i] = min(1, tot / area) if area else 0
                ours = collections.defaultdict(list)
                for u in units: ours[u["page"]].append(u["text"])
                R = P = W = 0
                for pg in sorted(ref):
                    a, b = tok(" ".join(ours.get(pg, []))), tok(ref[pg])
                    rec, prec = overlap(a, b)
                    flag = []
                    if len(b) < 15 and len(a) < 15: flag.append("almost no text: check for image/scan")
                    elif rec < 0.90: flag.append("text possibly lost")
                    if len(a) >= 15 and prec < 0.90: flag.append("text possibly garbled/duplicated")
                    if imgshare.get(pg, 0) > 0.15: flag.append(f"images cover {imgshare[pg]:.0%} of page: check visually for text inside images")
                    pages_out.append({"state": st, "file": f, "page": pg, "ref_words": len(b), "our_words": len(a),
                                      "recall": round(rec, 3), "precision": round(prec, 3), "image_share": round(imgshare.get(pg, 0), 2), "flag": "; ".join(flag)})
                    R += rec * len(b); P += prec * len(a); W += len(b)
                docs_out.append({"state": st, "file": f, "pages": len(ref), "ref_words": W,
                                 "recall": round(R / max(1, W), 3), "precision": round(P / max(1, sum(len(tok(u['text'])) for u in units)), 3),
                                 "flagged_pages": sum(1 for r in pages_out if r["file"] == f and r["state"] == st and r["flag"])})
            else:
                if ext == ".docx": b = tok(docx_text(p))
                elif ext == ".csv": b = tok(open(p, encoding="utf-8-sig", errors="ignore").read())
                else:
                    import openpyxl
                    wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
                    b = tok(" ".join(str(c) for ws in wb.worksheets for row in ws.iter_rows(values_only=True) for c in row if c is not None))
                a = tok(" ".join(u["text"] for u in units))
                rec, prec = overlap(a, b)
                docs_out.append({"state": st, "file": f, "pages": "", "ref_words": len(b), "recall": round(rec, 3), "precision": round(prec, 3), "flagged_pages": ""})
            print(f"{st} {f[:55]:55} recall={docs_out[-1]['recall']} precision={docs_out[-1]['precision']} flagged_pages={docs_out[-1]['flagged_pages']}", flush=True)
    for name, rows in (("extraction_pages.csv", pages_out), ("extraction_docs.csv", docs_out)):
        prev = OUT / name
        if states and prev.exists():   # partial run: keep other states' results
            done = {r["state"] for r in rows} | set(states)
            rows = [r for r in csv.DictReader(open(prev)) if r["state"] not in done] + rows
        if rows:
            with open(OUT / name, "w", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

if __name__ == "__main__":
    main(sys.argv[1:])
