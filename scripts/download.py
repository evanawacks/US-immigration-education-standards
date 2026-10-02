#!/usr/bin/env python3
"""Phase 1: download state standards documents.

Reads the source CSV (+ manual_overrides.csv), downloads direct files, crawls
landing pages for document links, and writes data/manifest.csv and
data/needs_manual.csv. Raw files go to data/raw/<ABBR>/ (git-ignored).

Usage: python scripts/download.py [--only AL,AK] [--delay 1.0]
"""
import argparse, csv, glob, hashlib, re, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
DOC_EXT = (".pdf", ".docx", ".doc", ".xlsx", ".xls")
MAGIC = {"pdf": b"%PDF", "docx": b"PK", "xlsx": b"PK", "doc": b"\xd0\xcf\x11\xe0", "xls": b"\xd0\xcf\x11\xe0"}
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
           "Accept": "text/html,application/pdf,application/xhtml+xml,*/*;q=0.8"}
KEYWORDS = re.compile(r"social|stud|histor|civic|geograph|econom|standard|framework|grade|kindergarten|\bk[-_ ]?\d|\b[1-9]\d?(st|nd|rd|th)\b|course", re.I)
NEGATIVE = re.compile(r"science|math|ela\b|english|language arts|mathematics|physical|health|fine arts|music|world language|\bcte\b|agenda|minutes|press|faq|crosswalk|webinar", re.I)
URL_RE = re.compile(r"https?://[^\s<>\"']+")

session = requests.Session()
session.headers.update(HEADERS)


def get(url, delay, stream=False, retries=3):
    err = None
    for i in range(retries):
        try:
            time.sleep(delay)
            r = session.get(url, timeout=(15, 120), stream=stream, allow_redirects=True)
            if r.status_code in (429, 503):
                err = f"HTTP {r.status_code}"
                time.sleep(5 * (i + 1)); continue
            return r, None
        except requests.RequestException as e:
            err = f"{type(e).__name__}: {str(e)[:150]}"
            time.sleep(2 * (i + 1))
    return None, err or "no response"


def ext_of(url, ctype=""):
    p = unquote(urlparse(url).path).lower()
    for e in DOC_EXT:
        if p.endswith(e):
            return e[1:]
    if "pdf" in ctype: return "pdf"
    if "wordprocessingml" in ctype: return "docx"
    if "spreadsheetml" in ctype: return "xlsx"
    return None


def safe_name(url, ext):
    name = Path(unquote(urlparse(url).path)).name or "download"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:120]
    stem = name.rsplit(".", 1)[0] if "." in name else name
    h = hashlib.md5(url.encode()).hexdigest()[:6]
    return f"{stem}_{h}.{ext}"


def fetch_file(url, abbr, found_via, delay):
    """Download one document. Returns (manifest_row | None, error | None)."""
    r, err = get(url, delay)
    if r is None:
        return None, err
    if r.status_code != 200:
        return None, f"HTTP {r.status_code}"
    ctype = r.headers.get("content-type", "").split(";")[0].strip()
    ext = ext_of(r.url, ctype) or ext_of(url, ctype)
    body = r.content
    if not ext or not body.startswith(MAGIC[ext]):
        return None, f"not a document (content-type {ctype}, starts {body[:8]!r})"
    d = RAW / abbr
    d.mkdir(parents=True, exist_ok=True)
    path = d / safe_name(url, ext)
    path.write_bytes(body)
    return {"abbr": abbr, "source_url": url, "final_url": r.url, "local_path": str(path.relative_to(ROOT)),
            "file_type": ext, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
            "found_via": found_via, "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, None


def candidate_links(html, base):
    soup = BeautifulSoup(html, "lxml")
    out = {}
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].strip())
        if not href.startswith("http") or not ext_of(href):
            continue
        text = " ".join(a.get_text(" ", strip=True).split())
        label = f"{text} {unquote(urlparse(href).path)}"
        if NEGATIVE.search(label) and not re.search(r"social|histor|civic", label, re.I):
            continue
        if KEYWORDS.search(label):
            out.setdefault(href, text)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--delay", type=float, default=1.0)
    a = ap.parse_args()
    only = {x.strip().upper() for x in a.only.split(",") if x.strip()}

    src = ROOT / glob.glob(str(ROOT / "US_State*.csv"))[0].split("/")[-1]
    rows = list(csv.DictReader(open(src, encoding="utf-8")))
    overrides = {}
    for r in csv.DictReader(open(ROOT / "manual_overrides.csv")):
        if r.get("url"): overrides.setdefault(r["Abbr."], []).append(r["url"])

    DATA.mkdir(exist_ok=True)
    manifest, manual = [], []
    for row in rows:
        abbr = row["Abbr."]
        if only and abbr not in only: continue
        seen, got = set(), 0
        # seed URLs: main link, any URLs written in Notes, manual overrides
        seeds = [(row["Link"].strip(), "direct" if row["Link type"] == "PDF" else "landing")]
        seeds += [(u.rstrip(".,)"), "notes") for u in URL_RE.findall(row["Notes"])]
        seeds += [(u, "manual") for u in overrides.get(abbr, [])]
        problems = []
        for url, kind in seeds:
            if url in seen: continue
            seen.add(url)
            if ext_of(url) or kind in ("direct", "manual"):
                m, err = fetch_file(url, abbr, kind, a.delay)
                if m and not any(x["sha256"] == m["sha256"] for x in manifest if x["abbr"] == abbr):
                    manifest.append(m); got += 1
                elif err and kind != "notes" or (err and not got):
                    # a "direct" link may really be an HTML page; fall through to crawl
                    r, e2 = get(url, a.delay)
                    if r is not None and r.status_code == 200 and "html" in r.headers.get("content-type", ""):
                        kind = "landing"
                    else:
                        problems.append(f"{url}: {err}"); continue
                else:
                    continue
            if kind in ("landing", "notes"):
                r, err = get(url, a.delay)
                if r is None or r.status_code != 200:
                    problems.append(f"{url}: {err or 'HTTP ' + str(r.status_code)}"); continue
                if "html" not in r.headers.get("content-type", ""):
                    continue
                links = candidate_links(r.text, r.url)
                if not links:
                    problems.append(f"{url}: no document links found (JS-rendered page?)")
                for link in links:
                    if link in seen: continue
                    seen.add(link)
                    m, err = fetch_file(link, abbr, f"crawled:{url}", a.delay)
                    if m and not any(x["sha256"] == m["sha256"] for x in manifest if x["abbr"] == abbr):
                        manifest.append(m); got += 1
                    elif err:
                        problems.append(f"{link}: {err}")
        print(f"{abbr}: {got} file(s)" + (f"  [{len(problems)} problem(s)]" if problems else ""), flush=True)
        if got == 0 or problems:
            manual.append({"abbr": abbr, "state": row["State"], "files_downloaded": got,
                           "source_link": row["Link"], "problems": " | ".join(problems)[:1500], "notes": row["Notes"]})

    # merge with any prior run so --only doesn't clobber other states
    def merge(path, new, key_fields, replace_abbrs):
        old = []
        if path.exists():
            old = [r for r in csv.DictReader(open(path)) if r["abbr"] not in replace_abbrs]
        allr = old + new
        if not allr: return
        with open(path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(allr[0].keys()) if not new else list(new[0].keys()))
            w.writeheader(); w.writerows(allr)
    ran = {r["Abbr."] for r in rows if not only or r["Abbr."] in only}
    merge(DATA / "manifest.csv", manifest, None, ran)
    merge(DATA / "needs_manual.csv", manual, None, ran)
    print(f"\n{len(manifest)} files this run; {len(manual)} jurisdictions need attention -> data/needs_manual.csv")


if __name__ == "__main__":
    main()
