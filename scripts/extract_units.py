#!/usr/bin/env python3
"""Clean extraction layer: split each source document into ordered 'units'
(paragraphs, table cells, spreadsheet rows) with stable IDs.

Output per document in data/clean/units/<ABBR>/:
  <stem>.units.jsonl  one unit per line: {id, page, kind, table, row, col, x, text, furniture}
  <stem>.view.txt     compact view for reading/labeling:  'u12 text' / 'u13 [T1 R2 C3] text'
Repeated page furniture (running headers/footers/page numbers) is detected and marked
furniture=true; it is omitted from the view and goes to the backup column automatically.

Image-only PDF pages (no text layer) are read with tesseract only for the files listed in
data/raw/<ABBR>/ocr.txt (one file name per line); other files are unchanged by this option.

Usage: python scripts/extract_units.py [ABBR ...]
"""
import csv, json, re, shutil, subprocess, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "clean" / "units"

def ocr_files(abbr):
    """File names listed in data/raw/<ABBR>/ocr.txt: PDFs whose image-only pages are read with OCR. Opt-in, because
    many PDFs carry pictures on pages that already have text, and OCR would change their unit IDs."""
    p = ROOT / "data" / "raw" / abbr / "ocr.txt"
    return {l.strip() for l in p.read_text().splitlines() if l.strip()} if p.exists() else set()

def norm(s):
    s = s.replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\s*\n\s*", " ", s)).strip()

# ---------------- PDF ----------------
def ocr_words(page, dpi=300):
    """Words of an image-only page from tesseract, as (x, y, width, height, text) in PDF points.
    Returns [] if tesseract is not installed."""
    if shutil.which("tesseract") is None: return []
    png = page.get_pixmap(dpi=dpi).tobytes("png")
    res = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "4", "tsv"], input=png, capture_output=True)
    if res.returncode != 0: return []
    s = 72 / dpi
    out = []
    for row in res.stdout.decode("utf-8", "replace").splitlines()[1:]:
        f = row.split("\t")
        if len(f) >= 12 and f[0] == "5" and f[11].strip():
            out.append((int(f[6]) * s, int(f[7]) * s, int(f[8]) * s, int(f[9]) * s, f[11].strip()))
    return out

def grid_starts(page_words):
    """Grade-column starts of a run of pages: a standard code such as 6.1.3-5.B or 17.2.K-2.A opens every grade
    cell, so clustered code positions give the cell starts (the label column is everything left of them)."""
    xs = sorted(w[0] for ws in page_words for w in ws if re.match(r"\d+\.\d+\.(PreK|K|\d)", w[4]))
    groups = []
    for x in xs:
        if groups and x - groups[-1][-1] < 12: groups[-1].append(x)
        else: groups.append([x])
    return [min(g) - 5 for g in groups if len(g) >= 2]

def ocr_units(words, pno, cols):
    """Units for an image-only page: each word goes to the column it starts in (cols from grid_starts; column 0
    is the label column, x=0); stacked visual lines in one column with a small gap form one unit. x and y are PDF
    points, so x works like the x of a side-by-side text block."""
    if not words: return []
    colmap = collections.defaultdict(list)
    for w in words:
        colmap[sum(1 for x in cols if w[0] >= x)].append(w)
    line_h = sorted(w[3] for w in words)[len(words) // 2]
    units = []
    for c, ws in colmap.items():
        rows = []   # visual lines in this column: [centre y, top, bottom, words]
        for w in sorted(ws, key=lambda w: w[1] + w[3] / 2):
            yc = w[1] + w[3] / 2
            if rows and abs(rows[-1][0] - yc) < line_h / 2:
                r = rows[-1]; r[3].append(w); r[1] = min(r[1], w[1]); r[2] = max(r[2], w[1] + w[3])
            else:
                rows.append([yc, w[1], w[1] + w[3], [w]])
        cell = None
        for yc, top, bottom, rw in rows:
            text = " ".join(w[4] for w in sorted(rw, key=lambda w: w[0]))
            if cell and top - cell["y1"] <= 1.5 * line_h:
                cell["text"] += " " + text; cell["y1"] = bottom
            else:
                cell = {"x": round(cols[c - 1] if c else 0), "y0": top, "y1": bottom, "text": text}
                units.append(cell)
    out = []
    for u in units:
        t = norm(u["text"])
        if t: out.append({"page": pno, "kind": "text", "table": None, "row": None, "col": None, "x": u["x"],
                          "y0": u["y0"], "y1": u["y1"], "text": t, "ocr": True})
    return out

def pdf_units(path, with_bbox=False, ocr=False):
    """with_bbox=True also returns each unit's position on its page as 'bbox' = [x0, y0, x1, y1]
    in fractions of the page size (used by the website viewer; not stored in the unit files)."""
    import pymupdf
    doc = pymupdf.open(str(path))
    units = []
    # image-only pages (no text layer but pictures) are OCR'd when ocr is set; grid columns are pooled over runs of
    # consecutive pages
    words = {pno: ocr_words(page) for pno, page in enumerate(doc, start=1)
             if ocr and len(page.get_text().strip()) < 200 and page.get_images()}
    cols, run = {}, []
    for pno in sorted(words) + [None]:
        if run and (pno is None or pno != run[-1] + 1):
            starts = grid_starts([words[p] for p in run])
            cols.update({p: starts for p in run}); run = []
        if pno is not None: run.append(pno)
    for pno, page in enumerate(doc, start=1):
        W, H = page.rect.width or 1, page.rect.height or 1
        frac = lambda r: [round(r[0] / W, 4), round(r[1] / H, 4), round(r[2] / W, 4), round(r[3] / H, 4)]
        try:
            tabs = page.find_tables().tables
        except Exception:
            tabs = []
        tboxes = [pymupdf.Rect(t.bbox) for t in tabs]
        items = []  # (y0, order, unit)
        # tables -> one unit per cell
        for ti, t in enumerate(tabs, start=1):
            try:
                rows = t.extract()
            except Exception:
                continue
            k = 0
            for ri, row in enumerate(rows, start=1):
                for ci, cell in enumerate(row, start=1):
                    if cell and norm(cell):
                        u = {"page": pno, "kind": "cell", "table": ti, "row": ri, "col": ci, "x": None, "text": norm(cell)}
                        if with_bbox:
                            try: cb = t.rows[ri - 1].cells[ci - 1]
                            except Exception: cb = None
                            u["bbox"] = frac(cb or t.bbox)
                        items.append((t.bbox[1], k, u))
                        k += 1
        # text outside tables -> lines grouped into paragraph units
        d = page.get_text("dict")
        order = 0
        for b in d["blocks"]:
            if b.get("type") != 0: continue
            cur, cur_x, cur_y1 = [], None, None
            def flush():
                nonlocal cur
                if cur:
                    txt = norm(" ".join(c[2] for c in cur))
                    if txt:
                        u = {"page": pno, "kind": "text", "table": None, "row": None, "col": None, "x": round(cur[0][0]), "y1": cur[-1][3], "y0": cur[0][1], "text": txt}
                        if with_bbox:
                            u["bbox"] = frac((min(c[0] for c in cur), cur[0][1], max(c[4] for c in cur), max(c[3] for c in cur)))
                        items.append((cur[0][1], 10000 + len(items), u))
                cur = []
            for ln in b["lines"]:
                txt = "".join(sp["text"] for sp in ln["spans"])
                if not txt.strip(): continue
                x0, y0, x1, y1 = ln["bbox"]
                c = pymupdf.Rect(ln["bbox"])
                mid = pymupdf.Point((x0 + x1) / 2, (y0 + y1) / 2)
                if any(r.contains(mid) for r in tboxes): continue
                h = max(1.0, y1 - y0)
                if cur and (abs(x0 - cur_x) > 60 or y0 - cur_y1 > 1.2 * h or y0 < cur[-1][1] - 2):
                    flush()
                if not cur: cur_x = x0
                cur.append((x0, y0, txt, y1, x1)); cur_y1 = y1
            flush()
        # no text layer but pictures on the page -> OCR the page (its pieces join the same sorting and column logic)
        if pno in words:
            for u in ocr_units(words[pno], pno, cols[pno]):
                items.append((u["y0"], 10000 + len(items), u))
        # stable order: by vertical position of block start, keeping stream order inside
        items.sort(key=lambda it: (round(it[0] / 4), it[1]))
        # mark side-by-side text units (need x to tell columns apart)
        txt_units = [u for _, _, u in items if u["kind"] == "text"]
        side = [any(v is not u and abs(v["x"] - u["x"]) > 60 and v["y0"] < u["y1"] and u["y0"] < v["y1"] for v in txt_units) for u in txt_units]
        for u, sd in zip(txt_units, side):
            if not sd: u["x"] = None
        for _, _, u in items:
            u.pop("y0", None); u.pop("y1", None)
            units.append(u)
    return units, len(doc)

# ---------------- DOCX ----------------
def docx_units(path):
    import docx
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    d = docx.Document(str(path))
    units, tn = [], 0
    for el in d.element.body.iterchildren():
        tag = el.tag.split("}")[-1]
        if tag == "p":
            p = Paragraph(el, d)
            t = norm(p.text)
            if t:
                st = (p.style.name if p.style is not None else "") or ""
                units.append({"page": None, "kind": "text", "table": None, "row": None, "col": None, "x": None, "style": st if st.lower().startswith(("heading", "title")) else None, "text": t})
        elif tag == "tbl":
            tn += 1
            tb = Table(el, d)
            for ri, row in enumerate(tb.rows, start=1):
                seen = set()
                for ci, cell in enumerate(row.cells, start=1):
                    if id(cell._tc) in seen: continue
                    seen.add(id(cell._tc))
                    t = norm("\n".join(p.text for p in cell.paragraphs))
                    if t:
                        units.append({"page": None, "kind": "cell", "table": tn, "row": ri, "col": ci, "x": None, "text": t})
    # text boxes are skipped by python-docx; append their paragraphs at the end (keeps earlier unit IDs stable)
    have = {u["text"] for u in units}
    for tb in d.element.body.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}txbxContent"):
        for p in tb.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            t = norm("".join(x.text or "" for x in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t")))
            if t and t not in have:
                have.add(t)
                units.append({"page": None, "kind": "text", "table": None, "row": None, "col": None, "x": None, "style": "textbox", "text": t})
    return units, None

# ---------------- XLSX / CSV ----------------
def xlsx_units(path):
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    units = []
    for si, ws in enumerate(wb.worksheets, start=1):
        units.append({"page": si, "kind": "sheet", "table": si, "row": 0, "col": None, "x": None, "text": f"SHEET: {ws.title}"})
        for ri, row in enumerate(ws.iter_rows(values_only=True), start=1):
            vals = [norm(str(c)) for c in row if c is not None and norm(str(c))]
            if vals:
                units.append({"page": si, "kind": "row", "table": si, "row": ri, "col": None, "x": None, "text": " | ".join(vals)})
    return units, len(wb.worksheets)

def csv_units(path):
    units = []
    with open(path, encoding="utf-8-sig", errors="ignore", newline="") as f:
        for ri, row in enumerate(csv.reader(f), start=1):
            vals = [norm(c) for c in row if norm(c)]
            if vals:
                units.append({"page": None, "kind": "row", "table": 1, "row": ri, "col": None, "x": None, "text": " | ".join(vals)})
    return units, None

def mark_furniture(units, npages):
    if not npages or npages < 4: return
    pages_by = collections.defaultdict(set)
    key = lambda t: re.sub(r"\d+", "#", t.lower())[:120]
    for u in units:
        if u["kind"] == "text" and len(u["text"]) < 160: pages_by[key(u["text"])].add(u["page"])
    rep = {k for k, v in pages_by.items() if len(v) >= max(3, 0.3 * npages)}
    for u in units:
        u["furniture"] = bool(u["kind"] == "text" and len(u["text"]) < 160 and (key(u["text"]) in rep or re.fullmatch(r"(page )?\d{1,3}( of \d{1,3})?|[ivx]{1,5}", u["text"].lower())))

def render(units):
    hdr = collections.defaultdict(list)
    for u in units:
        if u.get("furniture") and u["page"] is not None:
            t = u["text"][:70]
            if t not in hdr[u["page"]] and not re.fullmatch(r"(page )?\d{1,3}( of \d{1,3})?|[ivx]{1,5}", t.lower()):
                hdr[u["page"]].append(t)
    out, page = [], object()
    for u in units:
        if u["page"] != page and u["kind"] in ("text", "cell"):
            page = u["page"]
            if page is not None:
                h = " | ".join(hdr.get(page, [])[:5])
                out.append(f"=== page {page} ===" + (f" [running header: {h}]" if h else ""))
        if u.get("furniture"): continue
        tag = ""
        if u["kind"] == "cell": tag = f"[T{u['table']} R{u['row']} C{u['col']}] "
        elif u["kind"] == "row": tag = f"[R{u['row']}] "
        elif u.get("style"): tag = f"[{u['style']}] "
        if u.get("x") is not None: tag += f"(x={u['x']}) "
        out.append(f"{u['id']} {tag}{u['text']}")
    return "\n".join(out) + "\n"

def run(abbrs):
    rows = list(csv.DictReader(open(ROOT / "data" / "manifest.csv")))
    stats = []
    for r in rows:
        if abbrs and r["abbr"] not in abbrs: continue
        p = ROOT / r["local_path"]; ext = p.suffix.lower()
        fn = {".pdf": pdf_units, ".docx": docx_units, ".xlsx": xlsx_units, ".csv": csv_units}.get(ext)
        if not fn: continue
        try:
            units, npages = pdf_units(p, ocr=p.name in ocr_files(r["abbr"])) if ext == ".pdf" else fn(p)
        except Exception as e:
            print("ERROR", p, e); continue
        for i, u in enumerate(units, start=1): u["id"] = f"u{i}"
        mark_furniture(units, npages)
        d = OUT / r["abbr"]; d.mkdir(parents=True, exist_ok=True)
        stem = p.name
        with open(d / f"{stem}.units.jsonl", "w") as f:
            for u in units: f.write(json.dumps(u, ensure_ascii=False) + "\n")
        view = render(units)
        (d / f"{stem}.view.txt").write_text(view)
        stats.append((r["abbr"], stem, len(units), sum(u.get("furniture", False) for u in units), len(view.split())))
        print(r["abbr"], stem[:60], "units", len(units), "furniture", stats[-1][3], "view words", stats[-1][4], flush=True)

if __name__ == "__main__":
    run(set(sys.argv[1:]))
