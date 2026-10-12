/* Immigration Standards Explorer: a static, no-build front end for the clean database.
   Data comes from site/data/ (written by scripts/build_site.py); original files from data/raw/. */
"use strict";

const DATA = "site/data/";
const COLS = [["body_standards", "standards", "Standards"], ["body_examples", "examples", "Examples / clarifications"], ["backup", "backup", "Backup (non-standards text)"]];
const GRADES = ["PK", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "site/vendor/pdf.worker.min.js";

// ---------- small helpers ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
const app = () => document.getElementById("app");
const fmt = (n) => n.toLocaleString("en-US");
const fileUrl = (p) => p.split("/").map(encodeURIComponent).join("/");
const store = {
  get(k, d) { try { const v = localStorage.getItem("ise:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ise:" + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const cache = {};
function getJSON(path) {
  if (!cache[path]) cache[path] = fetch(DATA + path).then((r) => { if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status}).`); return r.json(); });
  return cache[path];
}
const loadIndex = () => getJSON("index.json");
const loadRows = (st) => getJSON(`rows/${st}.json`);
const loadDoc = (st, n) => getJSON(`docs/${st}/${n}.json`);
const stateOf = (id) => id.split("_")[0];
function gradeLabel(g) {
  if (g === "[ALL]") return "State-wide";
  if (g === "[]") return "—";
  const v = g.slice(1, -1).split(",");
  const num = v.map((x) => (x === "PK" ? -1 : +x));
  const name = (x) => (x === "PK" ? "Pre-K" : x === "0" ? "K" : x);
  const consecutive = num.every((x, i) => i === 0 || x === num[i - 1] + 1);
  return v.length > 2 && consecutive ? `${name(v[0])}–${name(v[v.length - 1])}` : v.map(name).join(", ");
}
function rowText(row, col) { return (row.seg?.[col] || []).map((s) => s[2]).join("\n"); }
function setMain(...kids) { const m = app(); m.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false)); return m; }
function errorView(e) { setMain(h("p", { class: "error" }, e.message || String(e))); }

// ---------- router ----------
let current = null;   // active view controller (viewer keeps itself alive across unit changes)
async function route() {
  const parts = (location.hash || "#/db").slice(2).split("/").map(decodeURIComponent);
  const [view, a, b, c] = parts;
  document.querySelectorAll(".nav a").forEach((x) => x.toggleAttribute("aria-current", false));
  const navKey = { db: "db", row: "db", docs: "docs", doc: "docs", about: "about", topics: "topics", charts: "charts" }[view] || "db";
  document.querySelector(`.nav a[data-nav="${navKey}"]`)?.setAttribute("aria-current", "page");
  try {
    if (view === "doc") {
      const unit = c && c.startsWith("u") ? parseInt(c.slice(1), 10) : null;
      if (current && current.kind === "doc" && current.st === a && current.n === +b) { if (unit) current.select(unit, "url"); return; }
      current?.destroy?.();
      current = await viewer(a, +b, unit);
      return;
    }
    current?.destroy?.(); current = null;
    if (view === "row") await rowPage(a);
    else if (view === "docs") await docsPage(a);
    else if (view === "about") await aboutPage();
    else if (view === "topics") await topicsPage(a);
    else if (view === "charts") await chartsPage();
    else await dbPage();
    window.scrollTo(0, 0);
  } catch (e) { console.error(e); errorView(e); }
}
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);

// ---------- database page ----------
const dbState = { st: "", grade: "", cat: "", q: "", full: false, sort: null, limit: 200 };
async function dbPage() {
  const idx = await loadIndex();
  const all = [];
  for (const [st, s] of Object.entries(idx.states)) for (const r of s.rows) all.push({ ...r, state: st });
  const cats = [...new Set(all.map((r) => r.course_category).filter(Boolean))].sort();

  const stSel = h("select", { id: "f-state" }, h("option", { value: "" }, "All states"), Object.entries(idx.states).map(([k, s]) => h("option", { value: k }, `${k} · ${s.name}`)));
  const grSel = h("select", { id: "f-grade" }, h("option", { value: "" }, "Any grade"), GRADES.map((g) => h("option", { value: g }, g === "PK" ? "Pre-K" : g === "K" ? "Kindergarten" : `Grade ${g}`)), h("option", { value: "ALL" }, "State-wide (_ALL)"));
  const catSel = h("select", { id: "f-cat" }, h("option", { value: "" }, "All rows"), h("option", { value: "-" }, "Grade rows (no course)"), cats.map((c) => h("option", { value: c }, c)));
  const q = h("input", { type: "search", id: "f-q", placeholder: "ID, course, or title" });
  const full = h("input", { type: "checkbox", id: "f-full" });
  const status = h("span", { class: "muted" });
  for (const [el, k] of [[stSel, "st"], [grSel, "grade"], [catSel, "cat"], [q, "q"]]) el.value = dbState[k];
  full.checked = dbState.full;

  const tbody = h("tbody");
  const heads = [["id", "Row ID"], ["grade", "Grades"], ["course", "Course"], ["course_category", "Category"], ["w0", "Standards words", 1], ["w1", "Examples words", 1], ["w2", "Backup words", 1]];
  const thead = h("thead", {}, h("tr", {}, heads.map(([k, label, num]) => h("th", { "data-sort": k, class: num ? "num" : null, scope: "col" }, label))));
  const more = h("div", { class: "more" });
  const table = h("div", { class: "table-wrap" }, h("table", { class: "ledger" }, thead, tbody));

  thead.addEventListener("click", (e) => {
    const k = e.target.closest("th")?.dataset.sort; if (!k) return;
    dbState.sort = dbState.sort && dbState.sort[0] === k ? [k, -dbState.sort[1]] : [k, 1];
    draw();
  });

  async function fullTextMatches(term) {
    const states = dbState.st ? [dbState.st] : Object.keys(idx.states);
    let done = 0;
    const hits = new Map();
    await Promise.all(states.map(async (st) => {
      const rows = await loadRows(st);
      done++; status.textContent = `Searching text… ${done}/${states.length} states loaded`;
      for (const r of rows) {
        for (const [col] of COLS) {
          const t = rowText(r, col); const i = t.toLowerCase().indexOf(term);
          if (i >= 0) { hits.set(r.id, { col, snip: t.slice(Math.max(0, i - 60), i + term.length + 80), i: Math.min(60, i) }); break; }
        }
      }
    }));
    return hits;
  }

  let token = 0;
  async function draw() {
    const my = ++token;
    Object.assign(dbState, { st: stSel.value, grade: grSel.value, cat: catSel.value, q: q.value.trim(), full: full.checked });
    const term = dbState.q.toLowerCase();
    let rows = all.filter((r) => (!dbState.st || r.state === dbState.st)
      && (!dbState.grade || (dbState.grade === "ALL" ? r.grade === "[ALL]" : r.grade.slice(1, -1).split(",").includes(dbState.grade === "K" ? "0" : dbState.grade)))
      && (!dbState.cat || (dbState.cat === "-" ? !r.course && r.grade !== "[ALL]" : r.course_category === dbState.cat)));
    let hits = null;
    if (term) {
      if (dbState.full) {
        if (term.length < 3) { status.textContent = "Type at least 3 characters to search the text."; }
        else { hits = await fullTextMatches(term); if (my !== token) return; rows = rows.filter((r) => hits.has(r.id)); }
      } else rows = rows.filter((r) => `${r.id} ${r.course} ${r.course_title}`.toLowerCase().includes(term));
    }
    if (dbState.sort) {
      const [k, dir] = dbState.sort;
      const val = (r) => (k[0] === "w" && k.length === 2 ? r.words[+k[1]] : r[k] || "");
      rows.sort((x, y) => (val(x) > val(y) ? 1 : val(x) < val(y) ? -1 : 0) * dir);
    }
    thead.querySelectorAll("th").forEach((th) => th.classList.remove("sorted-asc", "sorted-desc"));
    if (dbState.sort) thead.querySelector(`th[data-sort="${dbState.sort[0]}"]`)?.classList.add(dbState.sort[1] > 0 ? "sorted-asc" : "sorted-desc");
    status.textContent = `${fmt(rows.length)} of ${fmt(all.length)} rows`;
    const shown = rows.slice(0, dbState.limit);
    tbody.replaceChildren(...shown.map((r) => {
      const hit = hits?.get(r.id);
      const first = h("td", {}, h("a", { href: `#/row/${encodeURIComponent(r.id)}` }, r.id));
      if (hit) {
        const s = hit.snip;
        first.append(h("div", { class: "snip" }, `${COLS.find((c) => c[0] === hit.col)[2]}: …${s.slice(0, hit.i)}`, h("mark", {}, s.slice(hit.i, hit.i + term.length)), `${s.slice(hit.i + term.length)}…`));
      }
      return h("tr", { onclick: (e) => { if (!e.target.closest("a")) location.hash = `#/row/${encodeURIComponent(r.id)}`; } },
        first, h("td", {}, gradeLabel(r.grade)), h("td", {}, r.course || h("span", { class: "muted" }, "—"), r.course_title && r.course_title !== r.course ? h("div", { class: "snip" }, r.course_title) : null),
        h("td", {}, r.course_category || ""), ...r.words.map((w) => h("td", { class: "num" }, fmt(w))));
    }));
    more.replaceChildren(rows.length > shown.length ? h("button", { onclick: () => { dbState.limit += 400; draw(); } }, `Show more (${fmt(rows.length - shown.length)} hidden)`) : "");
  }
  let timer;
  for (const el of [stSel, grSel, catSel, full]) el.addEventListener("change", () => { dbState.limit = 200; draw(); });
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { dbState.limit = 200; draw(); }, dbState.full ? 350 : 120); });

  const t = idx.totals;
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Clean database"), h("h1", {}, "K-12 social studies standards, by state, grade, and course")),
    h("p", { class: "lede" }, "One row per state × grade (or grade band) × course. Every line of text is copied verbatim from a source document; open a row to see where each line came from."),
    h("div", { class: "stats" }, h("span", {}, h("b", {}, fmt(t.rows)), " rows"), h("span", {}, h("b", {}, t.states), " jurisdictions"),
      h("span", {}, h("b", {}, t.used), " documents used of ", h("b", {}, t.files), " collected"),
      h("span", {}, "Download: ", h("a", { href: "data/clean/standards.csv" }, "standards.csv"), " · ", h("a", { href: "data/clean/standards.sqlite" }, "standards.sqlite"))),
    h("div", { class: "filters", role: "search" },
      h("div", { class: "field" }, h("label", { for: "f-state" }, "State"), stSel),
      h("div", { class: "field" }, h("label", { for: "f-grade" }, "Grade"), grSel),
      h("div", { class: "field" }, h("label", { for: "f-cat" }, "Course category"), catSel),
      h("div", { class: "field" }, h("label", { for: "f-q" }, "Search"), q),
      h("label", { class: "check", for: "f-full" }, full, "Search the full text"), status),
    table, more));
  draw();
}

// ---------- row page ----------
async function rowPage(id) {
  const st = stateOf(id);
  const [idx, rows] = await Promise.all([loadIndex(), loadRows(st)]);
  const r = rows.find((x) => x.id === id);
  if (!r) throw new Error(`No row with ID ${id}.`);
  const files = idx.states[st].files;
  const fileName = (fi) => files[fi]?.name || "?";
  const blocks = COLS.map(([col, cat, label]) => {
    const segs = r.seg?.[col] || [];
    return h("section", { class: "colblock" },
      h("header", {}, h("h2", {}, label), h("span", { class: "muted mono" }, `${fmt(r.words[COLS.findIndex((c) => c[0] === col)])} words · ${fmt(segs.length)} lines`)),
      h("div", { class: "segs" }, segs.length ? segs.map(([fi, u, text]) => h("div", { class: `seg ${cat}` },
        h("div", { class: "txt" }, text),
        h("a", { class: "src", href: `#/doc/${st}/${fi}${u ? `/u${u}` : ""}`, title: `${fileName(fi)}, unit u${u}` }, `${u ? "u" + u : "headers"} · ${shortName(fileName(fi))}`)))
        : h("p", { class: "empty" }, "(empty)")));
  });
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, h("a", { href: "#/db" }, "Database"), ` / ${idx.states[st].name}`), h("h1", { class: "mono" }, r.id)),
    h("dl", { class: "meta" },
      h("dt", {}, "State"), h("dd", {}, `${idx.states[st].name} (${st})`),
      h("dt", {}, "Grades"), h("dd", {}, gradeLabel(r.grade), h("span", { class: "muted mono" }, `  ${r.grade}`)),
      h("dt", {}, "Course"), h("dd", {}, r.course ? `${r.course} — ${r.course_category}` : "(grade row, no course)"),
      r.course_title ? [h("dt", {}, "Title as written"), h("dd", {}, r.course_title)] : null,
      h("dt", {}, "Source files"), h("dd", {}, (r.source_files ? r.source_files.split("; ") : []).map((f, i) => {
        const fi = files.findIndex((x) => x.name === f);
        return h("div", {}, fi >= 0 ? h("a", { href: `#/doc/${st}/${fi}` }, f) : f);
      }))),
    h("p", { class: "legend" }, "Each line links to the unit it came from; click to see it on the original page."),
    blocks,
    h("section", { class: "colblock" }, h("header", {}, h("h2", {}, "Issues")), h("pre", { class: "issues" }, r.issues || "(none)"))));
}
const shortName = (f) => (f.length > 34 ? f.slice(0, 31) + "…" : f);

// ---------- documents page ----------
async function docsPage(focus) {
  const idx = await loadIndex();
  const cards = Object.entries(idx.states).map(([st, s]) => h("section", { class: "state-card", id: `st-${st}` },
    h("header", {}, h("h2", {}, `${s.name}`), h("span", { class: "muted mono" }, `${st} · ${s.files.filter((f) => f.status === "use").length}/${s.files.length} used`)),
    s.files.length ? h("ul", { class: "files" }, s.files.map((f) => h("li", {},
      h("span", { class: "fname" }, f.status === "use" ? h("a", { href: `#/doc/${st}/${f.n}` }, f.name) : f.name),
      h("span", { class: "links" },
        h("span", { class: `chip ${f.status === "use" ? "use" : "skip"}` }, f.status === "use" ? "Used" : "Not used"),
        h("span", { class: "chip" }, f.type.toUpperCase()),
        f.status === "use" ? h("a", { href: `#/doc/${st}/${f.n}` }, "Compare side by side") : null,
        f.path ? h("a", { href: fileUrl(f.path), target: "_blank", rel: "noopener" }, "Original file") : null,
        f.url ? h("a", { href: f.url, target: "_blank", rel: "noopener" }, "Source link") : null),
      f.status !== "use" ? h("span", { class: "why" }, f.status) : null)))
      : h("p", { class: "muted" }, (s.issues || []).join(" ") || "No source file collected.")));
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Source documents"), h("h1", {}, "Every document collected, by state")),
    h("p", { class: "lede" }, "Open a used document to compare the original pages with the clean text and the database text side by side. Documents marked “Not used” are older or duplicate versions; the reason is listed under each."),
    h("div", { class: "filters" }, h("div", { class: "field" }, h("label", { for: "jump" }, "Jump to state"),
      h("select", { id: "jump", onchange: (e) => document.getElementById(`st-${e.target.value}`)?.scrollIntoView() },
        h("option", { value: "" }, "Choose…"), Object.entries(idx.states).map(([k, s]) => h("option", { value: k }, `${k} · ${s.name}`))))),
    h("div", { class: "state-list" }, cards)));
  if (focus) document.getElementById(`st-${focus}`)?.scrollIntoView();
}

// ---------- about ----------
async function aboutPage() {
  const repo = "https://github.com/evanawacks/US-immigration-education-standards";
  setMain(h("div", { class: "page" }, h("div", { class: "prose" },
    h("p", { class: "eyebrow" }, "About"), h("h1", {}, "What students learn about immigration"),
    h("p", {}, "This project collects the official K-12 social studies, civics, and history standards for the 50 states and DC, and turns them into one database organized by state, grade, and course. This site gives access to that database and lets you check every line against its source."),
    h("h2", {}, "How the text was built"),
    h("ul", {},
      h("li", {}, "Each document is split into numbered ", h("b", {}, "units"), " (a paragraph, a table cell, or a spreadsheet row). This is the ", h("i", {}, "clean text"), "."),
      h("li", {}, "Each unit is labeled with the grades it applies to, an optional course, and a category: ", h("b", {}, "standards"), ", ", h("b", {}, "examples"), " (clarifications, teacher notes, suggested topics), or ", h("b", {}, "backup"), " (front matter and other non-standards text)."),
      h("li", {}, "The database rows are assembled from those units, verbatim. Text shared by several grades is copied into each grade row. Exact repeats within a row are kept once."),
      h("li", {}, "Running headers and footers are set aside and stored in each state's _ALL row.")),
    h("h2", {}, "Using the side-by-side view"),
    h("ul", {},
      h("li", {}, "Click any unit, page box, or database line: the other panes jump to the same text and highlight it."),
      h("li", {}, "Colored boxes on the original pages show what each unit was labeled: blue for standards, amber for examples, grey for backup."),
      h("li", {}, "Word documents are shown as pages rendered by LibreOffice; spreadsheets are shown as their sheets. The original file is always one click away.")),
    h("h2", {}, "Immigration topics"),
    h("ul", {},
      h("li", {}, "Every sentence of the standards and examples text was compared with the 106 immigration topics by a language model that runs locally (BAAI/bge-base-en-v1.5). The similarity score runs from 0 to 1."),
      h("li", {}, "A sentence gets the one topic it is closest to in meaning. It also gets every topic it names outright (the topic's name or one of its search terms), so two topics named in one sentence are both tagged."),
      h("li", {}, "Use the minimum score to drop weak matches. “Keep named topics” keeps a named topic whatever its score."),
      h("li", {}, "Each sentence is counted once per state, at the grades its document gives it. Bands such as 4–6 are never split into grades; choosing a single grade leaves bands out.")),
    h("p", {}, "Project documentation, validation reports, and code: ", h("a", { href: repo, target: "_blank", rel: "noopener" }, "GitHub repository"), "."))));
}

// ---------- document viewer ----------
async function viewer(st, n, startUnit) {
  setMain(h("p", { class: "loading" }, "Loading document…"));
  const idx0 = await loadIndex();
  const f0 = idx0.states[st]?.files[n];
  if (!f0 || f0.status !== "use") {
    setMain(h("div", { class: "page" }, h("p", { class: "error" }, f0 ? `${f0.name} is not used in the database (${f0.status}), so it has no side-by-side view.` : `There is no document ${n} for ${st}.`),
      h("p", {}, h("a", { href: `#/docs/${st}` }, "See this state's documents"), f0?.path ? [" · ", h("a", { href: fileUrl(f0.path), target: "_blank", rel: "noopener" }, "Open the original file")] : null)));
    return { kind: "msg" };
  }
  const [idx, doc, rows, TL] = await Promise.all([loadIndex(), loadDoc(st, n), loadRows(st), getJSON("topics/list.json").catch(() => null)]);
  const files = idx.states[st].files;
  const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
  const units = doc.units;
  const byN = new Map(units.map((u) => [u.n, u]));
  const catOf = (u) => (u.f ? "furniture" : u.l >= 0 ? doc.labels[u.l].cat : "none");
  const prefs = { panes: { topics: true, ...store.get("panes", { orig: true, text: true, db: true }) }, tmarks: store.get("tmarks", true), boxes: store.get("boxes", true), furn: false, hide: store.get("hide", {}), zoom: store.get("zoom", 1) };
  let selected = null;
  const ctl = { kind: "doc", st, n, select, destroy };

  // rows this document feeds, ranked by how many of its units they hold
  const feed = new Map();
  for (const u of units) for (const [rid] of u.r) feed.set(rid, (feed.get(rid) || 0) + 1);
  const feedRows = [...feed.keys()].sort((a, b) => (a.endsWith("_ALL") - b.endsWith("_ALL")) || a.localeCompare(b, "en", { numeric: true }));
  let dbRow = store.get(`dbrow:${st}:${n}`, null);
  if (!feed.has(dbRow)) dbRow = feedRows.find((r) => !r.endsWith("_ALL")) || feedRows[0] || null;

  // ----- toolbar -----
  const paneBtn = (k, label) => h("button", { "aria-pressed": String(!!prefs.panes[k]), onclick: (e) => {
    const on = !prefs.panes[k];
    if (!on && Object.values(prefs.panes).filter(Boolean).length === 1) return;
    prefs.panes[k] = on; e.currentTarget.setAttribute("aria-pressed", String(on)); store.set("panes", prefs.panes); layoutPanes();
  } }, label);
  const jump = h("input", { type: "text", id: "jump-unit", placeholder: "u123", "aria-label": "Go to unit" });
  jump.addEventListener("keydown", (e) => { if (e.key === "Enter") { const m = jump.value.trim().match(/^u?(\d+)$/i); if (m) select(+m[1], "jump"); } });
  const boxBtn = h("button", { "aria-pressed": String(prefs.boxes), title: "Show label colors on the original pages", onclick: (e) => {
    prefs.boxes = !prefs.boxes; e.currentTarget.setAttribute("aria-pressed", String(prefs.boxes)); store.set("boxes", prefs.boxes); origBody.classList.toggle("boxes-on", prefs.boxes);
  } }, "Label boxes");
  const fileInfo = files[n];
  const tmarkBtn = h("button", { "aria-pressed": String(prefs.tmarks), title: "Outline the text that carries immigration-topic tags", onclick: (e) => {
    prefs.tmarks = !prefs.tmarks; e.currentTarget.setAttribute("aria-pressed", String(prefs.tmarks)); store.set("tmarks", prefs.tmarks);
    origBody.classList.toggle("tmarks-on", prefs.tmarks); textBody.classList.toggle("tmarks-on", prefs.tmarks);
  } }, "Topic marks");
  const bar = h("div", { class: "vbar" },
    h("div", { class: "doc-title" }, h("span", { class: "eyebrow" }, h("a", { href: `#/docs/${st}` }, idx.states[st].name), ` · document ${n + 1} of ${files.length}`), h("strong", {}, doc.file)),
    h("div", { class: "group", role: "group", "aria-label": "Panes" }, h("span", { class: "eyebrow" }, "Show"), paneBtn("orig", "Original"), paneBtn("text", "Clean text"), paneBtn("db", "Database text"), TL ? paneBtn("topics", "Topics") : null),
    h("div", { class: "group" }, boxBtn, TL ? tmarkBtn : null, jump),
    h("div", { class: "legend" }, ["standards", "examples", "backup"].map((c) => h("span", {}, h("i", { class: `cat-dot ${c}` }), c))));
  const selbar = h("div", { class: "selbar", "aria-live": "polite" }, h("span", { class: "muted" }, "Click a unit, a box on the page, or a database line to trace it across the panes."));

  // ----- pane: original -----
  const origBody = h("div", { class: "body" + (prefs.boxes ? " boxes-on" : "") + (prefs.tmarks ? " tmarks-on" : "") });
  const viewUrl = fileUrl(doc.view || doc.path);
  let rerender = null;
  const zoomLabel = h("span", { class: "muted mono" }, `${Math.round(prefs.zoom * 100)}%`);
  const zoomBy = (f) => {
    prefs.zoom = Math.min(4, Math.max(0.5, Math.round(prefs.zoom * f * 4) / 4));
    zoomLabel.textContent = `${Math.round(prefs.zoom * 100)}%`; store.set("zoom", prefs.zoom); rerender?.();
  };
  const zoomCtl = doc.grid || doc.blocks ? null : h("span", { class: "group", role: "group", "aria-label": "Zoom" },
    h("button", { class: "small", onclick: () => zoomBy(1 / 1.25), "aria-label": "Zoom out" }, "−"), zoomLabel, h("button", { class: "small", onclick: () => zoomBy(1.25), "aria-label": "Zoom in" }, "+"));
  const origHead = h("header", {}, h("h2", {}, "Original"), zoomCtl,
    doc.path ? h("a", { href: fileUrl(doc.path), target: "_blank", rel: "noopener" }, `Open ${doc.type.toUpperCase()} file`) : null,
    doc.url ? h("a", { href: doc.url, target: "_blank", rel: "noopener" }, "Source link") : null);
  const origPane = h("section", { class: "pane", "aria-label": "Original document" }, origHead, origBody);
  const boxes = new Map();   // unit n -> [box elements]
  let pdfTask = null, observer = null;

  async function buildPdf() {
    const notes = [];
    if (doc.type === "docx") notes.push("Word document shown as pages rendered by LibreOffice. Layout can differ slightly from Word; use “Open DOCX file” for the original.");
    if (doc.view_note) notes.push(doc.view_note);
    if (notes.length) origBody.append(h("div", { class: "render-note" }, notes.join(" ")));
    const pagesEl = h("div", { class: "pages" }, h("p", { class: "muted" }, "Loading pages…"));
    origBody.append(pagesEl);
    if (!window.pdfjsLib) { pagesEl.replaceChildren(h("p", { class: "error" }, "The PDF viewer did not load. Use the link above to open the file.")); return; }
    pdfTask = pdfjsLib.getDocument({ url: viewUrl });
    const pdf = await pdfTask.promise;
    const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
    const byPage = new Map();
    for (const u of units) if (u.b) { if (!byPage.has(u.p)) byPage.set(u.p, []); byPage.get(u.p).push(u); }
    const pgs = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pg = h("div", { class: "pg", "data-p": p, style: `aspect-ratio: ${first.width} / ${first.height}` }, h("span", { class: "pno" }, `p. ${p}`));
      for (const u of byPage.get(p) || []) {
        const [x0, y0, x1, y1] = u.b;
        const bx = h("div", { class: `box ${catOf(u)}`, "data-n": u.n, title: `u${u.n}`, style: `left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%` });
        pg.append(bx);
        if (!boxes.has(u.n)) boxes.set(u.n, []);
        boxes.get(u.n).push(bx);
      }
      pgs.push(pg);
    }
    pagesEl.replaceChildren(...pgs);
    pagesEl.style.width = `${prefs.zoom * 100}%`;
    renderTopics();   // the page boxes exist now: mark the ones that carry topic tags
    pagesEl.addEventListener("click", (e) => { const b = e.target.closest(".box"); if (b) select(+b.dataset.n, "orig"); });
    const rendered = new Set();
    observer = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const p = +en.target.dataset.p;
        if (rendered.has(p)) continue;
        rendered.add(p);
        pdf.getPage(p).then((page) => {
          const vp1 = page.getViewport({ scale: 1 });
          en.target.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
          const scale = Math.min(3, Math.max(1, (en.target.clientWidth * (window.devicePixelRatio || 1)) / vp1.width));
          const vp = page.getViewport({ scale });
          const cv = h("canvas", { width: Math.round(vp.width), height: Math.round(vp.height), "aria-label": `Page ${p}` });
          en.target.prepend(cv);
          return page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
        }).catch((err) => console.warn("page", p, err));
      }
    }, { root: origBody, rootMargin: "800px 0px" });
    pgs.forEach((pg) => observer.observe(pg));
    rerender = () => {
      const keep = selected;
      const top = origBody.scrollTop / Math.max(1, origBody.scrollHeight);
      pagesEl.style.width = `${prefs.zoom * 100}%`;
      pgs.forEach((pg) => { pg.querySelector("canvas")?.remove(); observer.unobserve(pg); });
      rendered.clear();
      origBody.scrollTop = top * origBody.scrollHeight;
      pgs.forEach((pg) => observer.observe(pg));
      if (keep) markOrig(keep, true);
    };
    if (selected) markOrig(selected, true);
  }

  function buildGrid() {
    const wrap = h("div", { class: "grid-wrap" });
    const map = new Map();
    for (const u of units) if (u.k === "row") map.set(`${doc.type === "csv" ? 1 : unitSheet(u)}:${rowNum(u)}`, u.n);
    doc.grid.forEach((sheet, si) => {
      const width = Math.max(1, ...sheet.rows.map((r) => r[1].length));
      wrap.append(h("h3", {}, `Sheet ${si + 1}: ${sheet.name}`));
      const tb = h("tbody");
      for (const [rn, cells] of sheet.rows) {
        const un = map.get(`${si + 1}:${rn}`);
        const u = un != null ? byN.get(un) : null;
        const tr = h("tr", { "data-n": un ?? "", class: u ? catOf(u) : "" }, h("th", {}, rn), Array.from({ length: width }, (_, i) => h("td", {}, cells[i] ?? "")));
        if (un != null) { if (!boxes.has(un)) boxes.set(un, []); boxes.get(un).push(tr); }
        tb.append(tr);
      }
      wrap.append(h("div", { style: "overflow-x:auto" }, h("table", {}, tb)));
    });
    wrap.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-n]"); if (tr && tr.dataset.n) select(+tr.dataset.n, "orig"); });
    origBody.append(h("div", { class: "render-note" }, `Spreadsheet shown as its ${doc.grid.length > 1 ? "sheets" : "rows"}; each spreadsheet row is one unit.`), wrap);
  }
  function buildBlocks() {
    const wrap = h("div", { class: "docx-wrap" });
    const add = (el, n) => { if (n == null) return; el.dataset.n = n; const u = byN.get(n); if (u) el.classList.add(catOf(u)); if (!boxes.has(n)) boxes.set(n, []); boxes.get(n).push(el); };
    for (const b of doc.blocks) {
      if (b.table) {
        const tb = h("tbody");
        for (const row of b.table) { const tr = h("tr"); for (const [n, t] of row) { const td = h("td", {}, t); add(td, n); tr.append(td); } tb.append(tr); }
        wrap.append(h("div", { style: "overflow-x:auto" }, h("table", {}, tb)));
      } else { const el = h(b.h ? "h3" : "p", {}, b.s); add(el, b.n); wrap.append(el); }
    }
    wrap.addEventListener("click", (e) => { const el = e.target.closest("[data-n]"); if (el) select(+el.dataset.n, "orig"); });
    origBody.append(h("div", { class: "render-note" }, doc.view_note || ""), wrap);
  }
  // spreadsheet units: the sheet number is the unit's page, the row tag is "R<n>"
  function unitSheet(u) { return u.p; }
  function rowNum(u) { return parseInt(String(u.t).replace(/^R/, ""), 10); }

  // ----- pane: clean text -----
  const textBody = h("div", { class: "body" + (prefs.tmarks ? " tmarks-on" : "") });
  const unitEls = new Map();
  const hideBtns = ["standards", "examples", "backup"].map((c) => h("button", { "aria-pressed": String(!prefs.hide[c]), title: `Show ${c} units`, onclick: (e) => {
    prefs.hide[c] = !prefs.hide[c]; e.currentTarget.setAttribute("aria-pressed", String(!prefs.hide[c])); store.set("hide", prefs.hide); applyHide();
  } }, h("i", { class: `cat-dot ${c}` }), ` ${c}`));
  const furnBtn = h("button", { "aria-pressed": "false", title: "Show running headers and footers", onclick: (e) => {
    prefs.furn = !prefs.furn; e.currentTarget.setAttribute("aria-pressed", String(prefs.furn)); textBody.firstChild?.classList.toggle("show-furn", prefs.furn);
  } }, "Headers");
  const textPane = h("section", { class: "pane", "aria-label": "Clean text" },
    h("header", {}, h("h2", {}, "Clean text"), h("span", { class: "muted" }, `${fmt(units.length)} units`), h("span", { class: "group" }, hideBtns, furnBtn)), textBody);
  function applyHide() { const c = textBody.firstChild; if (c) for (const k of ["standards", "examples", "backup"]) c.classList.toggle(`hide-${k}`, !!prefs.hide[k]); }
  function buildText() {
    const box = h("div", { class: "units" });
    const frag = document.createDocumentFragment();
    let page = undefined, lastLabel = -2;
    for (const u of units) {
      if (u.p !== page && u.p != null && doc.type !== "csv") { page = u.p; frag.append(h("div", { class: "pmark" }, doc.type === "xlsx" ? `sheet ${page}` : `page ${page}${doc.type === "docx" ? " (rendered)" : ""}`)); }
      if (!u.f && u.l !== lastLabel && u.l >= 0) {
        const L = doc.labels[u.l];
        frag.append(h("div", { class: `lab-start ${L.cat}` }, h("i", { class: `cat-dot ${L.cat}` }), h("b", {}, L.cat), `grades ${L.grades}`, L.course ? `· ${L.course}` : null, L.section ? `· ${L.section}` : null));
        lastLabel = u.l;
      }
      const el = h("div", { class: `u ${catOf(u)}`, "data-n": u.n }, h("span", { class: "uid" }, `u${u.n}`), u.t ? h("span", { class: "tag" }, `[${u.t}]`) : null, u.s);
      unitEls.set(u.n, el);
      frag.append(el);
    }
    box.append(frag);
    box.addEventListener("click", (e) => { const el = e.target.closest(".u"); if (el) select(+el.dataset.n, "text"); });
    textBody.append(box);
    applyHide();
  }

  // ----- pane: database text -----
  const dbBody = h("div", { class: "body" });
  const rowSel = h("select", { id: "db-row", "aria-label": "Database row" }, feedRows.map((rid) => h("option", { value: rid }, `${rid} (${fmt(feed.get(rid))} units)`)));
  rowSel.addEventListener("change", () => { dbRow = rowSel.value; store.set(`dbrow:${st}:${n}`, dbRow); buildDb(); if (selected) markDb(selected, true); });
  const rowLink = h("a", { href: "#" }, "Open row");
  const dbPane = h("section", { class: "pane", "aria-label": "Database text" },
    h("header", {}, h("h2", {}, "Database text"), rowSel, rowLink), dbBody);
  let segEls = new Map(), textEls = new Map();
  const normText = (t) => t.replace(/\s+/g, " ").trim().toLowerCase();
  function buildDb() {
    segEls = new Map(); textEls = new Map();
    if (!dbRow) { dbBody.replaceChildren(h("p", { class: "empty" }, "No database rows use this document.")); return; }
    rowSel.value = dbRow;
    rowLink.href = `#/row/${encodeURIComponent(dbRow)}`;
    const r = rowById[dbRow];
    const out = h("div", {});
    for (const [col, cat, label] of COLS) {
      const segs = r.seg?.[col] || [];
      out.append(h("div", { class: "dbcol-h" }, `${label} · ${fmt(segs.length)} lines`));
      if (!segs.length) { out.append(h("p", { class: "empty" }, "(empty)")); continue; }
      const frag = document.createDocumentFragment();
      for (const [fi, u, text] of segs) {
        const mine = fi === n;
        const el = h("div", { class: `seg ${cat} ${mine ? "mine" : "other"}`, "data-n": mine ? u : "" },
          h("div", { class: "txt" }, text),
          mine ? h("span", { class: "src" }, u ? `u${u}` : "headers") : h("a", { class: "src", href: `#/doc/${st}/${fi}${u ? `/u${u}` : ""}`, title: files[fi]?.name }, `${u ? "u" + u : "headers"} · ${shortName(files[fi]?.name || "?")}`));
        if (mine && u) { if (!segEls.has(u)) segEls.set(u, []); segEls.get(u).push(el); }
        const k = normText(text); if (!textEls.has(k)) textEls.set(k, []); textEls.get(k).push(el);
        frag.append(el);
      }
      out.append(frag);
    }
    out.addEventListener("click", (e) => { const el = e.target.closest(".seg.mine"); if (el && el.dataset.n && !e.target.closest("a")) select(+el.dataset.n, "db"); });
    dbBody.replaceChildren(out);
  }

  // ----- pane: topics (immigration-topic tags of this document) -----
  const docTags = (doc.tags || []).map(([u, sno, t, sc, top, m, s]) => ({ u, sno, t, sc: sc / 1000, top: top / 1000, m: METHOD_NAMES[m], s }));
  if (TL && AF.minScore == null) AF.minScore = TL.meta.default_min_score;
  const topicName = (t) => TL?.topics.find((x) => x.no === t)?.topic || `Topic ${t}`;
  const tagsOfUnit = new Map();
  for (const tg of docTags) { if (!tagsOfUnit.has(tg.u)) tagsOfUnit.set(tg.u, []); tagsOfUnit.get(tg.u).push(tg); }
  const topicsBody = h("div", { class: "body" });
  const topicsCount = h("span", { class: "muted" });
  const topicsPane = h("section", { class: "pane", "aria-label": "Topics" },
    h("header", {}, h("h2", {}, "Topics"), topicsCount, TL ? scoreControl(TL, renderTopics, { compact: true }) : null), topicsBody);
  let topicRows = new Map();   // unit -> [row elements]
  function renderTopics() {
    const pass = docTags.filter(tagPasses);
    const units = new Set(pass.map((x) => x.u));
    const byTopic = new Map();
    for (const tg of pass) { if (!byTopic.has(tg.t)) byTopic.set(tg.t, []); byTopic.get(tg.t).push(tg); }
    topicsCount.textContent = docTags.length ? `${fmt(pass.length)} tags · ${byTopic.size} topics · ${units.size} units` : "No tags in this document";
    topicRows = new Map();
    const open = new Set([...topicsBody.querySelectorAll("details[open]")].map((d) => +d.dataset.t));
    topicsBody.replaceChildren(...[...byTopic.keys()].sort((a, b) => a - b).map((t) => {
      const list = byTopic.get(t).sort((a, b) => a.u - b.u || a.sno - b.sno);
      return h("details", { class: "tp", "data-t": t, open: open.has(t) },
        h("summary", {}, h("span", { class: "mono" }, `${t}.`), ` ${topicName(t)} `, h("span", { class: "chip" }, fmt(list.length)),
          h("a", { class: "tp-more", href: `#/topics/${t}`, title: "See this topic in every state" }, "all states")),
        list.map((tg) => {
          const row = h("button", { type: "button", class: "tp-row", "data-u": tg.u, onclick: () => select(tg.u, "topics") },
            h("span", { class: "mono muted" }, `u${tg.u}`), h("b", { class: "mono" }, tg.sc.toFixed(2)), tg.m !== "meaning" ? h("span", { class: "chip" }, "named") : null,
            h("span", { class: "tp-s" }, tg.s));
          if (!topicRows.has(tg.u)) topicRows.set(tg.u, []);
          topicRows.get(tg.u).push(row);
          return row;
        }));
    }));
    // tag chips under the units in the clean text, and marks on the original pages
    for (const [u, el] of unitEls) {
      el.querySelector(".tchips")?.remove();
      const mine = (tagsOfUnit.get(u) || []).filter(tagPasses);
      el.classList.toggle("tagged", mine.length > 0);
      if (mine.length) el.append(h("div", { class: "tchips" }, mine.map((tg) => h("span", { class: "tchip", title: `${tg.s}\n${METHOD_LABEL[tg.m]}; top match score ${tg.top.toFixed(2)}` },
        `${tg.t}. ${topicName(tg.t)}`, h("b", { class: "mono" }, tg.sc.toFixed(2)), tg.m !== "meaning" ? " · named" : ""))));
    }
    for (const [u, els] of boxes) els.forEach((b) => b.classList.toggle("tagged", units.has(u)));
    if (selected) markTopics(selected, false);
  }
  function markTopics(u, scroll) {
    topicsBody.querySelectorAll(".tp-row.hl").forEach((x) => x.classList.remove("hl"));
    const rows = topicRows.get(u.n) || [];
    rows.forEach((r) => { r.classList.add("hl"); r.closest("details").open = true; });
    if (scroll && rows[0]) scrollInto(topicsBody, rows[0]);
  }

  // ----- selection -----
  function scrollInto(body, el, center = true) {
    if (!el) return;
    const B = body.getBoundingClientRect(), E = el.getBoundingClientRect();
    body.scrollTop += E.top - B.top - (center ? body.clientHeight / 3 : 40);
    if (body.scrollWidth > body.clientWidth && (E.left < B.left || E.right > B.right)) body.scrollLeft += E.left - B.left - 24;
  }
  function markOrig(u, scroll) {
    origBody.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl"));
    const els = boxes.get(u.n) || [];
    els.forEach((x) => x.classList.add("hl"));
    if (scroll && els[0]) scrollInto(origBody, els[0]);
    else if (scroll && u.p && doc.type !== "xlsx" && doc.type !== "csv") scrollInto(origBody, origBody.querySelector(`.pg[data-p="${u.p}"]`), false);
  }
  function markText(u, scroll) {
    textBody.querySelectorAll(".u.hl").forEach((x) => x.classList.remove("hl"));
    const el = unitEls.get(u.n);
    if (!el) return;
    el.classList.add("hl");
    if (u.f && !prefs.furn) furnBtn.click();
    const c = catOf(u);
    if (prefs.hide[c]) { prefs.hide[c] = false; hideBtns[["standards", "examples", "backup"].indexOf(c)]?.setAttribute("aria-pressed", "true"); applyHide(); }
    if (scroll) scrollInto(textBody, el);
  }
  function markDb(u, scroll) {
    dbBody.querySelectorAll(".seg.hl").forEach((x) => x.classList.remove("hl"));
    // a repeated unit is kept once in a row: then highlight the identical line it was merged into
    const els = segEls.get(u.n) || (u.r.some((x) => x[0] === dbRow) ? textEls.get(normText(u.s)) || [] : []);
    els.forEach((x) => x.classList.add("hl"));
    if (scroll && els[0]) scrollInto(dbBody, els[0]);
  }
  function select(num, from) {
    const u = byN.get(num);
    if (!u) { selbar.replaceChildren(h("span", { class: "error" }, `This document has no unit u${num}.`)); return; }
    selected = u;
    // choose a database row that holds this unit (keep the current one if it does)
    const holding = (u.r.some((x) => x[2]) ? u.r.filter((x) => x[2]) : u.r).map((x) => x[0]);
    if (holding.length && !holding.includes(dbRow)) {
      dbRow = holding.find((r) => !r.endsWith("_ALL")) || holding[0];
      buildDb();
    }
    markOrig(u, from !== "orig");
    markText(u, from !== "text");
    markDb(u, from !== "db");
    markTopics(u, from !== "topics");
    const L = u.l >= 0 ? doc.labels[u.l] : null;
    const utags = (tagsOfUnit.get(u.n) || []).filter(tagPasses);
    const where = [u.p ? (doc.type === "xlsx" ? `sheet ${u.p}` : `page ${u.p}`) : null, u.t ? u.t : null].filter(Boolean).join(" · ");
    const kept = u.r.filter((x) => x[2]), dropped = u.r.filter((x) => !x[2]);
    selbar.replaceChildren(...[
      h("strong", { class: "mono" }, `u${u.n}`), where ? h("span", { class: "muted" }, where) : null,
      h("span", {}, h("i", { class: `cat-dot ${catOf(u)}` }), " ", u.f ? "running header/footer" : L ? L.cat : "unlabeled"),
      L ? h("span", {}, `grades ${L.grades}${L.course ? ` · ${L.course}` : ""}`) : null,
      L && L.section ? h("span", { class: "muted" }, L.section) : null,
      h("span", {}, kept.length ? [`In ${kept.length} row${kept.length > 1 ? "s" : ""}: `, kept.slice(0, 12).flatMap((x, i) => [i ? ", " : "", h("a", { class: "rowlink", href: "#", onclick: (e) => { e.preventDefault(); dbRow = x[0]; buildDb(); markDb(u, true); } }, x[0]), h("span", { class: "muted" }, ` (${x[1]})`)]), kept.length > 12 ? ` and ${kept.length - 12} more` : ""]
        : dropped.length ? null : h("span", { class: "muted" }, "Not in any row's text")),
      dropped.length ? h("span", { class: "muted" }, `Repeat of text already in ${dropped.map((x) => x[0]).join(", ")} (kept once)`) : null,
      utags.length ? h("span", {}, "Topics: ", utags.flatMap((tg, i) => [i ? "; " : "", h("a", { href: `#/topics/${tg.t}` }, `${tg.t}. ${topicName(tg.t)}`), h("span", { class: "muted mono" }, ` ${tg.sc.toFixed(2)}`)])) : null].flat(Infinity).filter(Boolean));
    const want = `#/doc/${st}/${n}/u${u.n}`;
    if (location.hash !== want) history.replaceState(null, "", want);
  }

  // ----- layout -----
  const panes = h("div", { class: "panes" });
  function layoutPanes() {
    panes.replaceChildren(...[["orig", origPane], ["text", textPane], ["db", dbPane], ["topics", TL ? topicsPane : null]].filter(([k, p]) => p && prefs.panes[k]).map(([, p]) => p));
    if (selected) { markOrig(selected, true); markText(selected, true); markDb(selected, true); markTopics(selected, true); }
  }
  function destroy() { observer?.disconnect(); pdfTask?.destroy?.(); }

  setMain(h("div", { class: "viewer" }, bar, selbar, panes));
  layoutPanes();
  buildText();
  buildDb();
  if (doc.grid) buildGrid();
  else if (doc.blocks) buildBlocks();
  else if (/\.(pdf)$/i.test(doc.view || "")) buildPdf().catch((e) => origBody.append(h("p", { class: "error" }, `Could not show the pages: ${e.message}. Use the link above to open the file.`)));
  else origBody.append(h("p", { class: "empty" }, "No page view for this file type. Use the link above to open the original."));
  renderTopics();
  if (startUnit) select(startUnit, "url");
  return ctl;
}
