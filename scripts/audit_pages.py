#!/usr/bin/env python3
"""Build a side-by-side review page for the audit sample: the original PDF page (rendered image)
next to the extracted text unit and the grade/course/category it was given.
Output (local only, not committed): data/validation/audit_html/<ST>.html + page images.
Usage: python scripts/audit_pages.py [ST ...]
"""
import csv, html, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
V = ROOT / "data" / "validation"; OUTD = V / "audit_html"; OUTD.mkdir(parents=True, exist_ok=True)
man = {(r["abbr"], Path(r["local_path"]).name): ROOT / r["local_path"] for r in csv.DictReader(open(ROOT / "data/manifest.csv"))}
rows = list(csv.DictReader(open(V / "audit_sample.csv")))
states = sorted(set(sys.argv[1:]) or {r["state"] for r in rows})
import pymupdf
for st in states:
    items = [r for r in rows if r["state"] == st]
    parts = [f"<html><head><meta charset='utf-8'><title>Audit {st}</title><style>body{{font-family:sans-serif;margin:16px}} .it{{display:flex;gap:16px;border-top:2px solid #888;padding:12px 0}} img{{max-width:640px;border:1px solid #ccc}} .t{{max-width:560px}} .u{{background:#ffef9f;padding:6px;white-space:pre-wrap}}</style></head><body><h1>{st}: audit sample ({len(items)} units)</h1><p>For each item: find the yellow text on the page image, then fill the REVIEW columns of data/validation/audit_sample.csv.</p>"]
    for i, r in enumerate(items, 1):
        img = ""
        src = man.get((st, r["file"]))
        if src and src.suffix.lower() == ".pdf" and r["page_or_sheet"]:
            pn = int(r["page_or_sheet"]); name = f"{st}_{i}_p{pn}.png"
            if not (OUTD / name).exists():
                doc = pymupdf.open(str(src))
                page = doc[pn - 1]
                for q in page.search_for(r["text"][:60])[:3]:
                    page.add_highlight_annot(q)
                page.get_pixmap(dpi=90).save(str(OUTD / name))
            img = f"<img src='{name}'>"
        else:
            img = f"<p><i>{html.escape(r['file'])} — not a PDF; open the file and search for the text.</i></p>"
        parts.append(f"<div class='it'><div>{img}</div><div class='t'><b>#{i}</b> {html.escape(r['file'])} — page/sheet {r['page_or_sheet']} {r['where_in_table']} ({r['unit']})"
                     f"<div class='u'>{html.escape(r['text'])}</div><p><b>grades:</b> {r['assigned_grades']} &nbsp; <b>course:</b> {html.escape(r['assigned_course'] or '—')} &nbsp; <b>category:</b> {r['assigned_category']}<br><b>section:</b> {html.escape(r['section'])}</p></div></div>")
    (OUTD / f"{st}.html").write_text("\n".join(parts) + "</body></html>")
    print(st, len(items), "items ->", OUTD / f"{st}.html")
