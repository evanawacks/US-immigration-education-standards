/* Immigration Standards Explorer: a static, no-build front end for the clean database.
   Data comes from site/data/ (written by scripts/build_site.py); original files from data/raw/. */
"use strict";

const DATA = "site/data/";
const VER = "2026-10-24g";   // bump with every site update, so browsers fetch the new data (index.html carries the same for the scripts)
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
  if (!cache[path]) cache[path] = fetch(`${DATA}${path}?v=${VER}`).then((r) => { if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status}).`); return r.json(); });
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
  document.getElementById("viz-tip")?.toggleAttribute("hidden", true);   // a chart tooltip open when a click navigated away
  const navKey = { db: "db", row: "db", docs: "docs", doc: "docs", about: "about", topics: "topics", charts: "charts", filters: "filters" }[view] || "db";
  document.querySelector(`.nav a[data-nav="${navKey}"]`)?.setAttribute("aria-current", "page");
  try {
    if (view === "doc") {
      const unit = c && c.startsWith("u") ? parseInt(c.slice(1), 10) : null;
      if (current && current.kind === "doc" && current.st === a) { current.go(b, unit); return; }
      current?.destroy?.();
      current = await viewer(a, b, unit);
      return;
    }
    current?.destroy?.(); current = null;
    let scrolled = false;   // a page that scrolled to a target itself (documents page with a state) keeps its place
    if (view === "row") await rowPage(a);
    else if (view === "docs") scrolled = await docsPage(a);
    else if (view === "about") await aboutPage();
    else if (view === "topics") await topicsPage(a);
    else if (view === "charts") await chartsPage();
    else if (view === "filters") await filtersPage();
    else if (!view || view === "db") await dbPage();
    else throw new Error(`There is no page “${view}”. If you just updated the site, reload the page (Ctrl+Shift+R / Cmd+Shift+R).`);
    if (!scrolled) window.scrollTo(0, 0);
  } catch (e) { console.error(e); errorView(e); }
}
window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => { navBadge(); route(); });

// ---------- database page ----------
const dbState = { st: "", grade: "", cat: "", q: "", topic: "", full: false, sort: null, limit: 200 };
async function dbPage() {
  const [idx, TDb, KLb, RT] = await Promise.all([loadIndex(), loadTopicData().catch(() => null), loadKeywords().catch(() => []), getJSON("topics/rowtags.json").catch(() => null)]);
  const KON = KLb.filter((x) => kwOn(x.k));   // keywords not switched off on the Topic filter page
  const all = [];
  for (const [st, s] of Object.entries(idx.states)) for (const r of s.rows) all.push({ ...r, state: st });
  // topic tags and "immigration" keyword matches in each row's standards text, under the global filter and score settings
  if (TDb) initFilters(TDb);
  const min = TDb ? Math.round(AF.minScore * 1000) : 0;
  const tagOK = (i) => topicOn(TDb.tags.t[i]) && (TDb.tags.sc[i] >= min || (AF.named && TDb.tags.m[i] !== 0));
  for (const r of all) {
    r.tt = RT && TDb ? (RT.tags[r.id] || []).filter(tagOK) : [];
    r.kw = Object.fromEntries(KON.map(({ k }) => [k.id, (RT?.kw?.[k.id]?.[r.id] || []).length]));
  }
  const hasTopics = !!(RT && TDb);
  const cats = [...new Set(all.map((r) => r.course_category).filter(Boolean))].sort();

  const stSel = h("select", { id: "f-state" }, h("option", { value: "" }, "All states"), Object.entries(idx.states).map(([k, s]) => h("option", { value: k }, `${k} · ${s.name}`)));
  const grSel = h("select", { id: "f-grade" }, h("option", { value: "" }, "Any grade"), GRADES.map((g) => h("option", { value: g }, g === "PK" ? "Pre-K" : g === "K" ? "Kindergarten" : `Grade ${g}`)), h("option", { value: "ALL" }, "State-wide (_ALL)"));
  const catSel = h("select", { id: "f-cat" }, h("option", { value: "" }, "All rows"), h("option", { value: "-" }, "Grade rows (no course)"), cats.map((c) => h("option", { value: c }, c)));
  const q = h("input", { type: "search", id: "f-q", placeholder: "ID, course, or title" });
  const topicSel = hasTopics ? h("select", { id: "f-topic" }, h("option", { value: "" }, "Any text"), h("option", { value: "any" }, "Has any counted topic"),
    KON.map(({ k }) => h("option", { value: `kw:${k.id}` }, `Has a ${k.word} word (${k.topic})`)),
    TDb.eras.map((e) => h("optgroup", { label: e }, TDb.topics.filter((t) => t.era === e && topicOn(t.no)).map((t) => h("option", { value: String(t.no) }, `${t.no}. ${t.topic}`))))) : null;
  if (topicSel) topicSel.value = dbState.topic;
  const full = h("input", { type: "checkbox", id: "f-full" });
  const status = h("span", { class: "muted" });
  for (const [el, k] of [[stSel, "st"], [grSel, "grade"], [catSel, "cat"], [q, "q"]]) el.value = dbState[k];
  full.checked = dbState.full;

  const tbody = h("tbody");
  const heads = [["id", "Row ID"], ["grade", "Grades"], ["course", "Course"], ["course_category", "Category"], ["w0", "Standards words", 1], ["w1", "Examples words", 1], ["w2", "Backup words", 1],
    ...(hasTopics ? [["ntt", "Topic tags", 1], ...KON.map(({ k }) => [`kw:${k.id}`, `${k.word} words`, 1])] : [])];
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
    Object.assign(dbState, { st: stSel.value, grade: grSel.value, cat: catSel.value, q: q.value.trim(), full: full.checked, topic: topicSel?.value || "" });
    const term = dbState.q.toLowerCase();
    let rows = all.filter((r) => (!dbState.st || r.state === dbState.st)
      && (!dbState.grade || (dbState.grade === "ALL" ? r.grade === "[ALL]" : r.grade.slice(1, -1).split(",").includes(dbState.grade === "K" ? "0" : dbState.grade)))
      && (!dbState.cat || (dbState.cat === "-" ? !r.course && r.grade !== "[ALL]" : r.course_category === dbState.cat))
      && (!dbState.topic || (dbState.topic === "any" ? r.tt.length > 0 : dbState.topic.startsWith("kw:") ? r.kw[dbState.topic.slice(3)] > 0 : r.tt.some((i) => TDb.tags.t[i] === +dbState.topic))));
    let hits = null;
    if (term) {
      if (dbState.full) {
        if (term.length < 3) { status.textContent = "Type at least 3 characters to search the text."; }
        else { hits = await fullTextMatches(term); if (my !== token) return; rows = rows.filter((r) => hits.has(r.id)); }
      } else rows = rows.filter((r) => `${r.id} ${r.course} ${r.course_title}`.toLowerCase().includes(term));
    }
    if (dbState.sort) {
      const [k, dir] = dbState.sort;
      const val = (r) => (k[0] === "w" && k.length === 2 ? r.words[+k[1]] : k === "ntt" ? r.tt.length : k.startsWith("kw:") ? r.kw[k.slice(3)] || 0 : r[k] || "");
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
        h("td", {}, r.course_category || ""), ...r.words.map((w) => h("td", { class: "num" }, fmt(w))),
        hasTopics ? h("td", { class: "num", title: dbState.topic && dbState.topic !== "any" && !dbState.topic.startsWith("kw:") ? `${r.tt.filter((i) => TDb.tags.t[i] === +dbState.topic).length} of them this topic` : null }, fmt(r.tt.length)) : null,
        hasTopics ? KON.map(({ k }) => h("td", { class: "num" }, r.kw[k.id] ? fmt(r.kw[k.id]) : h("span", { class: "muted" }, "0"))) : null);
    }));
    more.replaceChildren(rows.length > shown.length ? h("button", { onclick: () => { dbState.limit += 400; draw(); } }, `Show more (${fmt(rows.length - shown.length)} hidden)`) : "");
  }
  let timer;
  for (const el of [stSel, grSel, catSel, full, topicSel].filter(Boolean)) el.addEventListener("change", () => { dbState.limit = 200; draw(); });
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
      topicSel ? h("div", { class: "field" }, h("label", { for: "f-topic" }, "Immigration topic"), topicSel) : null,
      h("div", { class: "field" }, h("label", { for: "f-q" }, "Search"), q),
      h("label", { class: "check", for: "f-full" }, full, "Search the full text"), status),
    hasTopics ? h("p", { class: "muted small" }, "Topic tags and keyword words count the standards text of each row, at the minimum score set on Topics and Charts; topics left out on the Topic filter page are not counted or offered.") : null,
    gfNoteSafe(), table, more));
  draw();
}
const gfNoteSafe = () => (typeof gfNote === "function" ? gfNote() : null);

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
      }), files.filter((x) => x.status === "use").length > 1 ? h("div", {}, h("a", { href: `#/doc/${st}` }, `Read all of ${idx.states[st].name}'s documents together`)) : null)),
    h("p", { class: "legend" }, "Each line links to the unit it came from; click to see it on the original page."),
    blocks,
    h("section", { class: "colblock" }, h("header", {}, h("h2", {}, "Issues")), h("pre", { class: "issues" }, r.issues || "(none)"))));
}
const shortName = (f) => (f.length > 34 ? f.slice(0, 31) + "…" : f);

// ---------- documents page ----------
/** One collapsible row per state; a state opens to its documents. #/docs/ST opens and scrolls to that state. */
async function docsPage(focus) {
  const idx = await loadIndex();
  const open = new Set(store.get("docsOpen", []));
  const saveOpen = () => store.set("docsOpen", [...open]);
  const nUsed = (s) => s.files.filter((f) => f.status === "use").length;
  const cards = Object.entries(idx.states).map(([st, s]) => {
    const used = nUsed(s);
    const pos = new Map(s.files.filter((f) => f.status === "use").map((f, i) => [f.n, i + 1]));
    const det = h("details", { class: "state-card", id: `st-${st}`, "data-q": `${st} ${s.name} ${s.files.map((f) => f.name).join(" ")}`.toLowerCase(), open: open.has(st) || focus === st },
      h("summary", {}, h("span", { class: "st-name" }, s.name, h("span", { class: "muted mono" }, ` ${st}`)),
        h("span", { class: "muted st-count" }, s.files.length ? `${used} of ${s.files.length} document${s.files.length > 1 ? "s" : ""} used` : "no document collected"),
        used ? h("a", { class: "st-read", href: `#/doc/${st}`, onclick: (e) => e.stopPropagation() }, used > 1 ? `Read all ${used} together` : "Read it") : null),
      s.files.length ? h("ul", { class: "files" }, s.files.map((f) => h("li", {},
        h("span", { class: "fname" }, f.status === "use" ? [h("span", { class: "muted mono" }, `${pos.get(f.n)}. `), h("a", { href: `#/doc/${st}/${f.n}` }, f.name)] : f.name),
        h("span", { class: "links" },
          h("span", { class: `chip ${f.status === "use" ? "use" : "skip"}` }, f.status === "use" ? "Used" : "Not used"),
          f.subfiles?.length ? h("span", { class: "chip part", title: "Its text that is repeated in its subfiles is counted once, in the subfiles" }, `Main document of ${f.subfiles.map((x) => pos.get(x)).join(" and ")}`) : null,
          f.part_of != null ? h("span", { class: "chip part", title: "Counted on its own; the main document's copy of this text is not counted again" }, `Part of ${pos.get(f.part_of)}`) : null,
          h("span", { class: "chip" }, f.type.toUpperCase()),
          f.status === "use" ? h("a", { href: `#/doc/${st}/${f.n}` }, "Open this one only") : null,
          f.path ? h("a", { href: fileUrl(f.path), target: "_blank", rel: "noopener" }, "Original file") : null,
          f.url ? h("a", { href: f.url, target: "_blank", rel: "noopener" }, "Source link") : null),
        f.status !== "use" ? h("span", { class: "why" }, f.status) : null)))
        : h("p", { class: "muted" }, (s.issues || []).join(" ") || "No source file collected."));
    det.addEventListener("toggle", () => { det.open ? open.add(st) : open.delete(st); saveOpen(); });
    return det;
  });
  const setAll = (on) => { for (const c of cards) c.open = on; };
  const find = h("input", { type: "search", id: "docs-q", placeholder: "State or file name" });
  find.addEventListener("input", () => {
    const q = find.value.trim().toLowerCase();
    for (const c of cards) c.hidden = q && !c.dataset.q.includes(q);
  });
  const goTo = (st) => { const c = document.getElementById(`st-${st}`); if (!c) return; c.open = true; c.scrollIntoView({ block: "start" }); };
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Source documents"), h("h1", {}, "Every document collected, by state")),
    h("p", { class: "lede" }, "Click a state to see its documents. “Read all together” opens every document the state uses in one reader, one after the other; you can still focus on one document or one grade there. Documents marked “Not used” are older or duplicate versions; the reason is listed under each."),
    h("div", { class: "filters" },
      h("div", { class: "field" }, h("label", { for: "jump" }, "Jump to state"),
        h("select", { id: "jump", onchange: (e) => goTo(e.target.value) },
          h("option", { value: "" }, "Choose…"), Object.entries(idx.states).map(([k, s]) => h("option", { value: k }, `${k} · ${s.name}`)))),
      h("div", { class: "field" }, h("label", { for: "docs-q" }, "Find"), find),
      h("div", { class: "chips" }, h("button", { type: "button", onclick: () => setAll(true) }, "Expand all"), h("button", { type: "button", onclick: () => setAll(false) }, "Collapse all"))),
    h("div", { class: "state-list" }, cards)));
  const card = focus && document.getElementById(`st-${focus}`);
  if (!card) return false;
  card.classList.add("focus");
  card.scrollIntoView({ block: "start" });
  return true;
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
      h("li", {}, "A state's documents open together in one reader, one after the other. The Focus menus narrow every pane, and the Topics pane's tags, to one document or one grade."),
      h("li", {}, "Click any unit, page box, or database line: the other panes jump to the same text and highlight it."),
      h("li", {}, "Colored boxes on the original pages show what each unit was labeled: blue for standards, amber for examples, grey for backup."),
      h("li", {}, "Word documents are shown as pages rendered by LibreOffice; spreadsheets are shown as their sheets. The original file is always one click away.")),
    h("h2", {}, "Immigration topics"),
    h("ul", {},
      h("li", {}, "Every sentence of the labeled text was compared with the 106 immigration topics by a language model that runs locally (BAAI/bge-base-en-v1.5). The similarity score runs from 0 to 1."),
      h("li", {}, "The Topics and Charts pages count the standards text only. Tags in examples and backup text are shown in the document viewer for reference."),
      h("li", {}, "Standards written for every grade at once (K–12 or Pre-K–12: anchor standards, strand overviews) are left out of the Topics, Charts and Database counts, since they belong to no grade. So are a state's umbrella bands: shared skills, practices and overviews written for a band such as K–2 or 6–8 when the same document also writes each of those grades on its own. Both stay visible, with their tags, in the document reader."),
      h("li", {}, "A passage gets the topic it is closest to in meaning. It also gets every topic it names outright (the topic's name or one of its search terms), so two topics named in one sentence are both tagged."),
      h("li", {}, "Sentences are read in overlapping 12-word windows; each window gets its closest topic, and a topic counts once per sentence. In the viewer, the words behind each tag are underlined and numbered with their topic."),
      h("li", {}, "Use the minimum score to drop weak matches. “Keep named topics” keeps a named topic whatever its score. “Skip a topic repeated within N words” counts a run of mentions of the same topic once."),
      h("li", {}, "Distinct topics counts how many different topics appear, to show the span of what a state covers."),
      h("li", {}, "Apart from the topics, two separate keyword counts use plain text search: words starting with “immigra” (immigration, immigrant, immigrated…) and words containing “migra” (migration, migrant, emigration, immigration…). They have their own lines on the Topics page, columns and a filter on the Database page, counts on the Charts page, and an option there to chart either one."),
      h("li", {}, "The Topic filter page leaves chosen topics out of every page and the document viewer."),
      h("li", {}, "When one document holds the text of other documents of the same state (Maine's full 2019 standards and its separate History and Geography files), the separate files count on their own and the main document's copy of that text is not counted again. This is found automatically by comparing the documents' text."),
      h("li", {}, "Each sentence is counted once per state, at the grades its document gives it. Bands such as 4–6 are never split into grades; choosing a single grade leaves bands out.")),
    h("p", {}, "Project documentation, validation reports, and code: ", h("a", { href: repo, target: "_blank", rel: "noopener" }, "GitHub repository"), "."))));
}

// ---------- find box for a viewer pane ----------
/** Search one pane: items() gives the searchable [element, text, selector of the element's text]; matching elements are
    marked, the words themselves highlighted where the browser has the CSS Custom Highlight API; Enter / Shift+Enter step
    through them, and onPick(element) runs on the current one. */
function findBar(key, label, body, items, onPick) {
  const input = h("input", { type: "search", class: "find-in", placeholder: `Find in ${label}`, "aria-label": `Find in ${label}` });
  const count = h("span", { class: "find-n muted mono", "aria-live": "polite" });
  const prev = h("button", { type: "button", class: "small", title: "Previous match (Shift+Enter)", "aria-label": "Previous match", onclick: () => go(-1) }, "↑");
  const next = h("button", { type: "button", class: "small", title: "Next match (Enter)", "aria-label": "Next match", onclick: () => go(1) }, "↓");
  const hasHL = typeof Highlight === "function" && !!window.CSS?.highlights;
  let hits = [], cur = -1, q = "", timer;
  function ranges(x) {
    const out = [], box = x.el.querySelector(x.sel) || x.el;
    const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) {
      const low = t.data.toLowerCase();
      for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + q.length)) { const r = new Range(); r.setStart(t, i); r.setEnd(t, i + q.length); out.push(r); }
    }
    return out;
  }
  function paint() {
    body.querySelectorAll(".find-hit").forEach((e) => e.classList.remove("find-hit", "find-cur"));
    hits.forEach((x) => x.el.classList.add("find-hit"));
    hits[cur]?.el.classList.add("find-cur");
    count.textContent = q ? (hits.length ? `${fmt(cur + 1)} of ${fmt(hits.length)}` : "no matches") : "";
    if (!hasHL) return;
    const rest = [], now = [];
    hits.forEach((x, i) => (i === cur ? now : rest).push(...ranges(x)));
    CSS.highlights.set(`find-${key}`, new Highlight(...rest));
    CSS.highlights.set(`find-${key}-cur`, new Highlight(...now));
  }
  function run(keep) {
    const old = hits[cur]?.el;
    q = input.value.trim().toLowerCase();
    hits = q ? items().filter(([el, text]) => el && text.toLowerCase().includes(q)).map(([el, , sel]) => ({ el, sel })) : [];
    cur = !hits.length ? -1 : keep && old ? Math.max(0, hits.findIndex((x) => x.el === old)) : 0;
    paint();
  }
  function show() {
    const el = hits[cur]?.el;
    if (!el) return;
    onPick?.(el);
    const B = body.getBoundingClientRect(), E = el.getBoundingClientRect();
    body.scrollTop += E.top - B.top - body.clientHeight / 3;
  }
  function go(d) {
    if (input.value.trim().toLowerCase() !== q) { run(false); show(); return; }
    if (!hits.length) return;
    cur = (cur + d + hits.length) % hits.length; paint(); show();
  }
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { run(false); show(); }, 200); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); go(e.shiftKey ? -1 : 1); }
    else if (e.key === "Escape") { input.value = ""; run(false); }
  });
  return {
    el: h("span", { class: "group find", role: "search" }, input, prev, next, count),
    refresh: () => { if (q) run(true); },
    clear: () => { if (hasHL) { CSS.highlights.delete(`find-${key}`); CSS.highlights.delete(`find-${key}-cur`); } },
  };
}

// ---------- document viewer: every used document of a state, read together ----------
/** #/doc/ST: all of the state's documents; #/doc/ST/n: document n only; #/doc/ST/n/u12: unit 12 of document n (with all
    documents). A unit is known by its key, document number × UKEY + unit number, since unit numbers restart in every file.
    The Focus menus narrow every pane (and the Topics pane's tags) to one document and/or one grade. */
const UKEY = 100000;
const ukey = (n, u) => n * UKEY + u;
async function viewer(st, docArg, startUnit) {
  setMain(h("p", { class: "loading" }, "Loading documents…"));
  const idx = await loadIndex();
  const S = idx.states[st];
  const one = docArg == null || docArg === "" || docArg === "all" ? null : +docArg;
  const f0 = one != null ? S?.files[one] : null;
  const used = (S?.files || []).filter((f) => f.status === "use");
  if (!S || (one != null && (!f0 || f0.status !== "use")) || !used.length) {
    setMain(h("div", { class: "page" }, h("p", { class: "error" }, !S ? `There is no state ${st}.` : f0 ? `${f0.name} is not used in the database (${f0.status}), so it has no side-by-side view.`
      : one != null ? `There is no document ${one} for ${st}.` : `None of ${S.name}'s documents is used in the database.`),
      h("p", {}, h("a", { href: `#/docs/${st}` }, "See this state's documents"), f0?.path ? [" · ", h("a", { href: fileUrl(f0.path), target: "_blank", rel: "noopener" }, "Open the original file")] : null)));
    return { kind: "msg" };
  }
  const [docs0, rows, TL] = await Promise.all([Promise.all(used.map((f) => loadDoc(st, f.n).catch(() => null))), loadRows(st), getJSON("topics/list.json").catch(() => null)]);
  const docs = docs0.filter(Boolean);
  const files = S.files;
  const rowById = Object.fromEntries(rows.map((r) => [r.id, r]));
  const dpos = new Map(docs.map((D, i) => [D.n, i + 1]));   // document number shown to the reader: 1, 2, ...
  const byK = new Map();
  for (const D of docs) for (const u of D.units) { u.D = D; u.K = ukey(D.n, u.n); byK.set(u.K, u); }
  const catOf = (u) => (u.f ? "furniture" : u.l >= 0 ? u.D.labels[u.l].cat : "none");
  const prefs = { panes: { topics: true, ...store.get("panes", { orig: true, text: true, db: true }) }, tmarks: store.get("tmarks", true), boxes: store.get("boxes", true), furn: false, hide: store.get("hide", {}), zoom: store.get("zoom", 1) };
  let selected = null;
  const ctl = { kind: "doc", st, go, destroy };
  const docName = (D) => `${dpos.get(D.n)}. ${D.file}`;
  /** Main documents and subfiles (scripts/doc_parts.py): the repeated text counts once, in the subfile. */
  function partNote(D) {
    const f = files[D.n];
    if (f.subfiles?.length) return h("span", { class: "part-note" }, `Main document. Its text repeated in ${f.subfiles.map((x) => `document ${dpos.get(x) ?? "?"}`).join(" and ")} is counted there, once.`);
    if (f.part_of != null) return h("span", { class: "part-note" }, `Part of document ${dpos.get(f.part_of) ?? "?"}, counted on its own.`);
    return null;
  }

  // ----- focus: one document and/or one grade -----
  const rowGrades = new Map(S.rows.map((r) => [r.id, r.grade === "[ALL]" || r.grade === "[]" ? null : new Set(r.grade.slice(1, -1).split(","))]));
  const gradeToks = ["PK", ...Array.from({ length: 13 }, (_, i) => String(i))].filter((g) => [...rowGrades.values()].some((s) => s?.has(g)));
  const gName = (g) => (g === "PK" ? "Pre-K" : g === "0" ? "Kindergarten" : `Grade ${g}`);
  const scope = { doc: startUnit ? null : one, grade: "" };
  /** A unit is in focus when it is in the chosen document and in a database row for the chosen grade. */
  const inScope = (u) => (scope.doc == null || u.D.n === scope.doc) && (!scope.grade || u.r.some(([rid]) => rowGrades.get(rid)?.has(scope.grade)));
  const scopeLabel = () => [scope.doc == null ? (docs.length > 1 ? `all ${docs.length} documents` : "this document") : `document ${dpos.get(scope.doc)}`, scope.grade ? gName(scope.grade).toLowerCase() : "all grades"].join(", ");
  const docSel = h("select", { id: "v-doc", "aria-label": "Document" }, h("option", { value: "" }, docs.length > 1 ? `All ${docs.length} documents together` : "The document"),
    docs.length > 1 ? docs.map((D) => h("option", { value: String(D.n) }, `${docName(D)}${files[D.n].subfiles?.length ? " (main document)" : files[D.n].part_of != null ? ` (part of ${dpos.get(files[D.n].part_of)})` : ""}`)) : null);
  const gradeSel = h("select", { id: "v-grade", "aria-label": "Grade" }, h("option", { value: "" }, "All grades"), gradeToks.map((g) => h("option", { value: g }, gName(g))));
  const syncScope = () => { docSel.value = scope.doc == null ? "" : String(scope.doc); gradeSel.value = scope.grade; };
  const refocus = () => { applyScope(!(selected && inScope(selected))); if (selected && inScope(selected)) select(selected.K, "scope"); else setUrl(); };
  docSel.addEventListener("change", () => { scope.doc = docSel.value === "" ? null : +docSel.value; refocus(); });
  gradeSel.addEventListener("change", () => { scope.grade = gradeSel.value; refocus(); });

  // ----- toolbar -----
  const paneBtn = (k, label) => h("button", { "aria-pressed": String(!!prefs.panes[k]), onclick: (e) => {
    const on = !prefs.panes[k];
    if (!on && Object.values(prefs.panes).filter(Boolean).length === 1) return;
    prefs.panes[k] = on; e.currentTarget.setAttribute("aria-pressed", String(on)); store.set("panes", prefs.panes); layoutPanes();
  } }, label);
  const jump = h("input", { type: "text", id: "jump-unit", placeholder: "u123", "aria-label": "Go to unit (in the selected unit's document)", title: "Go to a unit number, in the selected unit's document (or 2:u123 for document 2)" });
  jump.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const m = jump.value.trim().match(/^(?:(\d+)\s*[:.]\s*)?u?(\d+)$/i);
    if (!m) return;
    const D = m[1] ? docs[+m[1] - 1] : selected?.D || docs.find((x) => x.n === scope.doc) || docs[0];
    if (D) select(ukey(D.n, +m[2]), "jump");
  });
  const boxBtn = h("button", { "aria-pressed": String(prefs.boxes), title: "Color each unit on the original pages by its label", onclick: (e) => {
    prefs.boxes = !prefs.boxes; e.currentTarget.setAttribute("aria-pressed", String(prefs.boxes)); store.set("boxes", prefs.boxes); origBody.classList.toggle("boxes-on", prefs.boxes);
  } }, "Label colors");
  const tmarkBtn = h("button", { "aria-pressed": String(prefs.tmarks), title: "Outline the text that carries immigration-topic tags", onclick: (e) => {
    prefs.tmarks = !prefs.tmarks; e.currentTarget.setAttribute("aria-pressed", String(prefs.tmarks)); store.set("tmarks", prefs.tmarks);
    origBody.classList.toggle("tmarks-on", prefs.tmarks); textBody.classList.toggle("tmarks-on", prefs.tmarks);
  } }, "Topic marks");
  const title = h("strong", {});
  const bar = h("div", { class: "vbar" },
    h("div", { class: "doc-title" }, h("span", { class: "eyebrow" }, h("a", { href: `#/docs/${st}` }, S.name), ` · ${docs.length} document${docs.length > 1 ? "s" : ""} used`), title),
    h("div", { class: "group focus", role: "group", "aria-label": "Focus" }, h("span", { class: "eyebrow" }, "Focus"), docs.length > 1 ? docSel : null, gradeSel),
    h("div", { class: "group", role: "group", "aria-label": "Panes" }, h("span", { class: "eyebrow" }, "Show"), paneBtn("orig", "Original"), paneBtn("text", "Clean text"), paneBtn("db", "Database text"), TL ? paneBtn("topics", "Topics") : null),
    h("div", { class: "group" }, boxBtn, TL ? tmarkBtn : null, jump),
    h("div", { class: "legend" }, ["standards", "examples", "backup"].map((c) => h("span", {}, h("i", { class: `cat-dot ${c}` }), c))));
  const selbar = h("div", { class: "selbar", "aria-live": "polite" }, h("span", { class: "muted" }, "Click a unit, a box on the page, or a database line to trace it across the panes."));

  // ----- pane: original (one section per document; PDF pages load as they scroll into view) -----
  const origBody = h("div", { class: "body" + (prefs.boxes ? " boxes-on" : "") + (prefs.tmarks ? " tmarks-on" : "") });
  const zoomLabel = h("span", { class: "muted mono" }, `${Math.round(prefs.zoom * 100)}%`);
  const zoomBy = (f) => {
    prefs.zoom = Math.min(4, Math.max(0.5, Math.round(prefs.zoom * f * 4) / 4));
    zoomLabel.textContent = `${Math.round(prefs.zoom * 100)}%`; store.set("zoom", prefs.zoom); rerender();
  };
  const isPdf = (D) => !D.grid && !D.blocks && /\.pdf$/i.test(D.view || "");
  const zoomCtl = docs.some(isPdf) ? h("span", { class: "group", role: "group", "aria-label": "Zoom" },
    h("button", { class: "small", onclick: () => zoomBy(1 / 1.25), "aria-label": "Zoom out" }, "−"), zoomLabel, h("button", { class: "small", onclick: () => zoomBy(1.25), "aria-label": "Zoom in" }, "+")) : null;
  const origPane = h("section", { class: "pane", "aria-label": "Original documents" }, h("header", {}, h("h2", {}, "Original"), zoomCtl), origBody);
  const boxes = new Map();   // unit key -> [box elements]
  const osec = new Map();    // document n -> its section
  const pdfs = new Map();    // document n -> { pagesEl, pgs, addPage, rendered, load, task }
  const addBox = (K, el) => { el.dataset.k = K; if (!boxes.has(K)) boxes.set(K, []); boxes.get(K).push(el); };
  let observer = null;

  function buildOrig() {
    observer = new IntersectionObserver(onPages, { root: origBody, rootMargin: "800px 0px" });
    for (const D of docs) {
      const sec = h("section", { class: "odoc", "data-d": D.n },
        h("header", { class: "odoc-h" }, h("strong", {}, docName(D)),
          D.path ? h("a", { href: fileUrl(D.path), target: "_blank", rel: "noopener" }, `Open ${D.type.toUpperCase()} file`) : null,
          D.url ? h("a", { href: D.url, target: "_blank", rel: "noopener" }, "Source link") : null, partNote(D)));
      osec.set(D.n, sec);
      origBody.append(sec);
      if (D.grid) buildGrid(D, sec);
      else if (D.blocks) buildBlocks(D, sec);
      else if (isPdf(D)) buildPages(D, sec);
      else sec.append(h("p", { class: "empty" }, "No page view for this file type. Use the link above to open the original."));
    }
    origBody.addEventListener("click", (e) => { const el = e.target.closest("[data-k]"); if (el && el.dataset.k) select(+el.dataset.k, "orig"); });
  }
  function buildPages(D, sec) {
    const notes = [];
    if (D.type === "docx") notes.push("Word document shown as pages rendered by LibreOffice. Layout can differ slightly from Word; use “Open DOCX file” for the original.");
    if (D.view_note) notes.push(D.view_note);
    if (notes.length) sec.append(h("div", { class: "render-note" }, notes.join(" ")));
    if (!window.pdfjsLib) { sec.append(h("p", { class: "error" }, "The PDF viewer did not load. Use the link above to open the file.")); return; }
    const pagesEl = h("div", { class: "pages" });
    pagesEl.style.width = `${prefs.zoom * 100}%`;
    const byPage = new Map();
    let last = 1;
    for (const u of D.units) { if (u.p > last) last = u.p; if (u.b) { if (!byPage.has(u.p)) byPage.set(u.p, []); byPage.get(u.p).push(u); } }
    const P = { pagesEl, pgs: [], rendered: new Set(), load: null, task: null };
    // pages are laid out (with their unit boxes) before the PDF loads, so every box can be clicked and scrolled to
    P.addPage = (p) => {
      const pg = h("div", { class: "pg", "data-d": D.n, "data-p": p, style: `aspect-ratio: ${P.ratio || "8.5 / 11"}` }, h("span", { class: "pno" }, `p. ${p}`));
      for (const u of byPage.get(p) || []) {
        const [x0, y0, x1, y1] = u.b;
        const bx = h("div", { class: `box ${catOf(u)}`, title: `u${u.n}`, style: `left:${x0 * 100}%;top:${y0 * 100}%;width:${(x1 - x0) * 100}%;height:${(y1 - y0) * 100}%` });
        addBox(u.K, bx);
        pg.append(bx);
      }
      P.pgs.push(pg); pagesEl.append(pg); observer.observe(pg);
    };
    for (let p = 1; p <= last; p++) P.addPage(p);
    sec.append(pagesEl);
    pdfs.set(D.n, P);
    P.open = () => P.load ||= (P.task = pdfjsLib.getDocument({ url: fileUrl(D.view || D.path) })).promise.then(async (pdf) => {
      const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
      P.ratio = `${vp.width} / ${vp.height}`;
      P.pgs.forEach((pg) => { if (!pg.querySelector("canvas")) pg.style.aspectRatio = P.ratio; });
      for (let p = P.pgs.length + 1; p <= pdf.numPages; p++) P.addPage(p);
      return pdf;
    }).catch((err) => { sec.append(h("p", { class: "error" }, `Could not show the pages: ${err.message}. Use the link above to open the file.`)); throw err; });
  }
  function onPages(entries) {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const P = pdfs.get(+en.target.dataset.d), p = +en.target.dataset.p;
      if (!P || P.rendered.has(p)) continue;
      P.rendered.add(p);
      P.open().then((pdf) => (p <= pdf.numPages ? pdf.getPage(p) : null)).then((page) => {
        if (!page) return;
        const vp1 = page.getViewport({ scale: 1 });
        en.target.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
        const scale = Math.min(3, Math.max(1, (en.target.clientWidth * (window.devicePixelRatio || 1)) / vp1.width));
        const vp = page.getViewport({ scale });
        const cv = h("canvas", { width: Math.round(vp.width), height: Math.round(vp.height), "aria-label": `Page ${p}` });
        en.target.querySelector("canvas")?.remove();
        en.target.prepend(cv);
        return page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      }).catch((err) => console.warn("page", p, err));
    }
  }
  function rerender() {
    const top = origBody.scrollTop / Math.max(1, origBody.scrollHeight);
    for (const P of pdfs.values()) {
      P.pagesEl.style.width = `${prefs.zoom * 100}%`;
      P.pgs.forEach((pg) => { pg.querySelector("canvas")?.remove(); observer.unobserve(pg); });
      P.rendered.clear();
    }
    origBody.scrollTop = top * origBody.scrollHeight;
    for (const P of pdfs.values()) P.pgs.forEach((pg) => observer.observe(pg));
    if (selected) markOrig(selected, true);
  }
  function buildGrid(D, sec) {
    const wrap = h("div", { class: "grid-wrap" });
    const map = new Map();
    for (const u of D.units) if (u.k === "row") map.set(`${D.type === "csv" ? 1 : u.p}:${parseInt(String(u.t).replace(/^R/, ""), 10)}`, u);
    D.grid.forEach((sheet, si) => {
      const width = Math.max(1, ...sheet.rows.map((r) => r[1].length));
      wrap.append(h("h3", {}, `Sheet ${si + 1}: ${sheet.name}`));
      const tb = h("tbody");
      for (const [rn, cells] of sheet.rows) {
        const u = map.get(`${si + 1}:${rn}`);
        const tr = h("tr", { class: u ? catOf(u) : "" }, h("th", {}, rn), Array.from({ length: width }, (_, i) => h("td", {}, cells[i] ?? "")));
        if (u) addBox(u.K, tr);
        tb.append(tr);
      }
      wrap.append(h("div", { style: "overflow-x:auto" }, h("table", {}, tb)));
    });
    sec.append(h("div", { class: "render-note" }, `Spreadsheet shown as its ${D.grid.length > 1 ? "sheets" : "rows"}; each spreadsheet row is one unit.`), wrap);
  }
  function buildBlocks(D, sec) {
    const wrap = h("div", { class: "docx-wrap" });
    const add = (el, n) => { if (n == null) return; const u = D.units.find((x) => x.n === n); if (!u) return; el.classList.add(catOf(u)); addBox(u.K, el); };
    for (const b of D.blocks) {
      if (b.table) {
        const tb = h("tbody");
        for (const row of b.table) { const tr = h("tr"); for (const [n, t] of row) { const td = h("td", {}, t); add(td, n); tr.append(td); } tb.append(tr); }
        wrap.append(h("div", { style: "overflow-x:auto" }, h("table", {}, tb)));
      } else { const el = h(b.h ? "h3" : "p", {}, b.s); add(el, b.n); wrap.append(el); }
    }
    sec.append(h("div", { class: "render-note" }, D.view_note || ""), wrap);
  }

  // ----- pane: clean text -----
  const textBody = h("div", { class: "body" + (prefs.tmarks ? " tmarks-on" : "") });
  const unitEls = new Map();   // unit key -> element
  const markers = [];          // [heading element, [its unit elements]]: hidden when none of its units is in focus
  const hideBtns = ["standards", "examples", "backup"].map((c) => h("button", { "aria-pressed": String(!prefs.hide[c]), title: `Show ${c} units`, onclick: (e) => {
    prefs.hide[c] = !prefs.hide[c]; e.currentTarget.setAttribute("aria-pressed", String(!prefs.hide[c])); store.set("hide", prefs.hide); applyHide();
  } }, h("i", { class: `cat-dot ${c}` }), ` ${c}`));
  const furnBtn = h("button", { "aria-pressed": "false", title: "Show running headers and footers", onclick: (e) => {
    prefs.furn = !prefs.furn; e.currentTarget.setAttribute("aria-pressed", String(prefs.furn)); textBody.firstChild?.classList.toggle("show-furn", prefs.furn); textFind.refresh();
  } }, "Headers");
  const isHidden = (u) => !!prefs.hide[catOf(u)];   // its category is filtered out: not traced into the clean text or database panes
  const allUnits = docs.flatMap((D) => D.units);
  const textFind = findBar("text", "clean text", textBody, () => allUnits.filter((u) => !isHidden(u) && inScope(u) && (!u.f || prefs.furn)).map((u) => [unitEls.get(u.K), u.s, ".utext"]), (el) => select(+el.dataset.k, "text-find"));
  const textCount = h("span", { class: "muted" });
  const textPane = h("section", { class: "pane", "aria-label": "Clean text" },
    h("header", {}, h("h2", {}, "Clean text"), textCount, h("span", { class: "group" }, hideBtns, furnBtn), textFind.el), textBody);
  /** Filtered-out categories leave the clean text and database panes, and their boxes on the original pages stop responding. */
  function applyHide() {
    for (const body of [textBody, dbBody, origBody]) for (const k of ["standards", "examples", "backup"]) body.classList.toggle(`hide-${k}`, !!prefs.hide[k]);
    if (selected && isHidden(selected)) { clearMarks(); selbar.replaceChildren(...hiddenNote(selected)); }
    textFind.refresh(); dbFind.refresh();
  }
  function buildText() {
    const box = h("div", { class: "units" });
    const frag = document.createDocumentFragment();
    for (const D of docs) {
      const dm = [h("div", { class: "tdoc-h", "data-d": D.n }, h("b", {}, docName(D)), partNote(D)), []];
      markers.push(dm); frag.append(dm[0]);
      let page, lastLabel = -2, pm = null, lm = null;
      for (const u of D.units) {
        if (u.p !== page && u.p != null && D.type !== "csv") {
          page = u.p;
          pm = [h("div", { class: "pmark" }, `${dpos.get(D.n)} · ${D.type === "xlsx" ? `sheet ${page}` : `page ${page}${D.type === "docx" ? " (rendered)" : ""}`}`), []];
          markers.push(pm); frag.append(pm[0]);
        }
        if (!u.f && u.l !== lastLabel && u.l >= 0) {
          const L = D.labels[u.l];
          lm = [h("div", { class: `lab-start ${L.cat}` }, h("i", { class: `cat-dot ${L.cat}` }), h("b", {}, L.cat), `grades ${L.grades}`, L.course ? `· ${L.course}` : null, L.section ? `· ${L.section}` : null), []];
          markers.push(lm); frag.append(lm[0]);
          lastLabel = u.l;
        }
        const el = h("div", { class: `u ${catOf(u)}`, "data-k": u.K }, h("span", { class: "uid" }, `u${u.n}`), u.t ? h("span", { class: "tag" }, `[${u.t}]`) : null, h("span", { class: "utext" }, u.s));
        unitEls.set(u.K, el);
        for (const m of [dm, pm, lm]) m?.[1].push(el);
        frag.append(el);
      }
    }
    box.append(frag);
    box.addEventListener("click", (e) => { const el = e.target.closest(".u"); if (el) select(+el.dataset.k, "text"); });
    textBody.append(box);
  }

  // ----- pane: database text -----
  const dbBody = h("div", { class: "body" });
  const rowSel = h("select", { id: "db-row", "aria-label": "Database row" });
  let dbRow = store.get(`dbrow:${st}`, null);
  rowSel.addEventListener("change", () => { dbRow = rowSel.value; store.set(`dbrow:${st}`, dbRow); buildDb(); if (selected) markDb(selected, true); });
  const rowLink = h("a", { href: "#" }, "Open row");
  const dbFind = findBar("db", "database text", dbBody, () => [...dbBody.querySelectorAll(".dbcol")].filter((c) => !prefs.hide[c.dataset.cat]).flatMap((c) => [...c.querySelectorAll(".seg")].map((el) => [el, el.querySelector(".txt").textContent, ".txt"])),
    (el) => { if (el.dataset.k) select(+el.dataset.k, "db-find"); });
  const dbPane = h("section", { class: "pane", "aria-label": "Database text" },
    h("header", {}, h("h2", {}, "Database text"), rowSel, rowLink, dbFind.el), dbBody);
  let segEls = new Map(), textEls = new Map(), feed = new Map();
  const normText = (t) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const rowOK = (rid) => !scope.grade || !!rowGrades.get(rid)?.has(scope.grade);
  /** The database rows the documents in focus feed (for the chosen grade), ranked by how many of their units they hold. */
  function buildRowSel() {
    feed = new Map();
    for (const D of docs) if (scope.doc == null || D.n === scope.doc) for (const u of D.units) for (const [rid] of u.r) if (rowOK(rid)) feed.set(rid, (feed.get(rid) || 0) + 1);
    const list = [...feed.keys()].sort((a, b) => (a.endsWith("_ALL") - b.endsWith("_ALL")) || a.localeCompare(b, "en", { numeric: true }));
    if (!feed.has(dbRow)) dbRow = list.find((r) => !r.endsWith("_ALL")) || list[0] || null;
    rowSel.replaceChildren(...list.map((rid) => h("option", { value: rid }, `${rid} (${fmt(feed.get(rid))} units)`)));
    rowSel.disabled = !list.length;
  }
  function buildDb() {
    segEls = new Map(); textEls = new Map();
    if (!dbRow) { dbBody.replaceChildren(h("p", { class: "empty" }, scope.grade ? `No database row for ${gName(scope.grade).toLowerCase()} uses ${scope.doc == null ? "these documents" : "this document"}.` : "No database rows use these documents.")); rowLink.hidden = true; dbFind?.refresh(); return; }
    rowLink.hidden = false;
    rowSel.value = dbRow;
    rowLink.href = `#/row/${encodeURIComponent(dbRow)}`;
    const r = rowById[dbRow];
    const out = h("div", {});
    for (const [col, cat, label] of COLS) {
      const segs = r.seg?.[col] || [];
      const box = h("div", { class: `dbcol ${cat}`, "data-cat": cat }, h("div", { class: "dbcol-h" }, `${label} · ${fmt(segs.length)} lines`));
      out.append(box);
      if (!segs.length) { box.append(h("p", { class: "empty" }, "(empty)")); continue; }
      const frag = document.createDocumentFragment();
      for (const [fi, u, text] of segs) {
        const K = u ? ukey(fi, u) : null, mine = K != null && byK.has(K);
        const away = !mine || (scope.doc != null && fi !== scope.doc);
        const el = h("div", { class: `seg ${cat} ${mine ? "mine" : ""} ${away ? "other" : ""}`, "data-k": mine ? K : "" },
          h("div", { class: "txt" }, text),
          h("span", { class: "src", title: files[fi]?.name }, `${u ? "u" + u : "headers"}${docs.length > 1 || !mine ? ` · ${dpos.has(fi) ? `doc ${dpos.get(fi)}` : shortName(files[fi]?.name || "?")}` : ""}`));
        if (mine) { if (!segEls.has(K)) segEls.set(K, []); segEls.get(K).push(el); }
        const k = normText(text); if (!textEls.has(k)) textEls.set(k, []); textEls.get(k).push(el);
        frag.append(el);
      }
      box.append(frag);
    }
    out.addEventListener("click", (e) => { const el = e.target.closest(".seg.mine"); if (el && el.dataset.k) select(+el.dataset.k, "db"); });
    dbBody.replaceChildren(out);
    dbFind?.refresh();
  }

  // ----- pane: topics (immigration-topic tags of the documents in focus) -----
  const docTags = [];
  for (const D of docs) for (const [u, sno, t, sc, top, m, c, cs, ce, mt] of D.tags || []) docTags.push({ k: docTags.length, K: ukey(D.n, u), u, sno, t, sc: sc / 1000, top: top / 1000, m: METHOD_NAMES[m], c: CAT_NAMES[c], cs, ce, mt });
  // the separate keywords: every match in labeled text (not running headers)
  for (const kw of KWS) for (const u of allUnits) {
    if (u.f || u.l < 0 || !CAT_NAMES.includes(catOf(u))) continue;
    for (const m of u.s.matchAll(kw.re)) docTags.push({ k: docTags.length, K: u.K, u: u.n, sno: 0, t: kw.no, sc: 1, top: 1, m: "name", c: catOf(u), cs: m.index, ce: m.index + m[0].length, mt: m[0], kw: true });
  }
  /** Character span of a tag's matched words in its unit's text (null if they cannot be found). */
  const spanOf = (tg) => {
    const s = byK.get(tg.K)?.s || "";
    if (tg.cs >= 0 && s.slice(tg.cs, tg.ce) === tg.mt) return [tg.cs, tg.ce];
    const i = tg.mt ? s.indexOf(tg.mt) : -1;
    return i >= 0 ? [i, i + tg.mt.length] : null;
  };
  /** Rewrite a unit's text with the matched words of its tags marked, each led by its topic number. */
  function paintUnit(el, u, tags) {
    const box = el.querySelector(".utext"), s = u.s;
    const spans = tags.map((tg) => [spanOf(tg), tg]).filter((x) => x[0]);
    if (!spans.length) { box.textContent = s; return; }
    const cuts = [...new Set([0, s.length, ...spans.flatMap(([[a, b]]) => [a, b])])].sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      for (const [[x], tg] of spans) if (x === a) parts.push(h("sup", { class: "tno", "data-t": tg.k, title: tg.kw ? topicName(tg.t) : `${tg.t}. ${topicName(tg.t)} · score ${tg.sc.toFixed(2)}` }, topicNo(tg.t)));
      const cover = spans.filter(([[x, y]]) => x <= a && y >= b).map(([, tg]) => tg.k);
      parts.push(cover.length ? h("mark", { class: "tm", "data-t": cover.join(" ") }, s.slice(a, b)) : s.slice(a, b));
    }
    box.replaceChildren(...parts);
  }
  /** Highlight the words of one tag (k) in the clean text, or clear with null. */
  const hot = (k) => textBody.querySelectorAll(".tm, .tno").forEach((m) => m.classList.toggle("hot", k != null && m.dataset.t.split(" ").includes(String(k))));
  const tcats = { standards: true, examples: true, backup: true, ...store.get("tcats", {}) };
  const shown = (tg) => tcats[tg.c] && tagPasses(tg) && inScope(byK.get(tg.K));
  if (TL && AF.minScore == null) AF.minScore = TL.meta.default_min_score;
  const topicName = (t) => (isKw(t) ? KW_BY_NO[t].topic : TL?.topics.find((x) => x.no === t)?.topic || `Topic ${t}`);
  const tagsOfUnit = new Map();
  for (const tg of docTags) { if (!tagsOfUnit.has(tg.K)) tagsOfUnit.set(tg.K, []); tagsOfUnit.get(tg.K).push(tg); }
  const topicsBody = h("div", { class: "body" });
  const topicsCount = h("span", { class: "muted" });
  const topicsScope = h("p", { class: "small pane-note scope-note" });
  const tcatBtns = ["standards", "examples", "backup"].map((c) => h("button", { "aria-pressed": String(tcats[c]), title: `Show tags in ${c} text`, onclick: (e) => {
    tcats[c] = !tcats[c]; e.currentTarget.setAttribute("aria-pressed", String(tcats[c])); store.set("tcats", tcats); renderTopics();
  } }, h("i", { class: `cat-dot ${c}` }), ` ${c}`));
  const topicsPane = h("section", { class: "pane", "aria-label": "Topics" },
    h("header", {}, h("h2", {}, "Topics"), topicsCount, topicsScope, h("span", { class: "group" }, tcatBtns),
      h("p", { class: "muted small pane-note" }, "The Topics and Charts pages count standards only; examples and backup tags are shown here for reference."),
      TL ? scoreControl(TL, renderTopics, { compact: true }) : null, gfNote()), topicsBody);
  let topicRows = new Map();   // unit key -> [row elements]
  function renderTopics() {
    const pass = docTags.filter(shown);
    const units = new Set(pass.map((x) => x.K));
    const byTopic = new Map();
    for (const tg of pass) { if (!byTopic.has(tg.t)) byTopic.set(tg.t, []); byTopic.get(tg.t).push(tg); }
    topicsCount.textContent = docTags.length ? `${fmt(pass.length)} tags · ${byTopic.size} topics · ${units.size} units` : "No tags in these documents";
    topicsScope.replaceChildren("Tags in ", h("b", {}, scopeLabel()), ...(scope.doc != null || scope.grade ? [" · ", h("button", { type: "button", class: "link", onclick: () => { scope.doc = null; scope.grade = ""; applyScope(true); setUrl(); } }, "show all")] : []));
    topicRows = new Map();
    const open = new Set([...topicsBody.querySelectorAll("details[open]")].map((d) => +d.dataset.t));
    const many = new Set(pass.map((x) => byK.get(x.K).D.n)).size > 1;
    topicsBody.replaceChildren(...(byTopic.size ? [...byTopic.keys()].sort((a, b) => a - b).map((t) => {
      const list = byTopic.get(t).sort((a, b) => dpos.get(byK.get(a.K).D.n) - dpos.get(byK.get(b.K).D.n) || a.u - b.u || a.sno - b.sno);
      return h("details", { class: "tp", "data-t": t, open: open.has(t) },
        h("summary", {}, h("span", { class: "mono" }, `${topicNo(t)}.`), ` ${topicName(t)} `, h("span", { class: "chip" }, fmt(list.length)),
          h("a", { class: "tp-more", href: topicHref(t), title: "See this topic in every state" }, "all states")),
        list.map((tg) => {
          const row = h("button", { type: "button", class: "tp-row", onclick: () => { select(tg.K, "topics"); hot(tg.k); }, onmouseenter: () => hot(tg.k), onmouseleave: () => hot(null) },
            h("span", { class: "mono muted" }, many ? `${dpos.get(byK.get(tg.K).D.n)}·u${tg.u}` : `u${tg.u}`), h("b", { class: "mono" }, tg.kw ? "word" : tg.sc.toFixed(2)),
            h("span", { class: "tp-chips" }, tg.c !== "standards" ? h("span", { class: `chip cat-${tg.c}` }, tg.c) : null, tg.m !== "meaning" && !tg.kw ? h("span", { class: "chip" }, "named") : null),
            h("span", { class: "tp-s" }, "“", h("b", {}, tg.mt), "”"));
          if (!topicRows.has(tg.K)) topicRows.set(tg.K, []);
          topicRows.get(tg.K).push(row);
          return row;
        }));
    }) : [h("p", { class: "empty" }, docTags.length ? `No tags in ${scopeLabel()} at these settings.` : "No tags in these documents.")]));
    // tag chips under the units in the clean text, and marks on the original pages
    for (const [K, el] of unitEls) {
      el.querySelector(".tchips")?.remove();
      const mine = (tagsOfUnit.get(K) || []).filter(shown);
      el.classList.toggle("tagged", mine.length > 0);
      if (mine.length || el.querySelector(".tm")) paintUnit(el, byK.get(K), mine);
      if (mine.length) el.append(h("div", { class: "tchips" }, mine.map((tg) => h("span", { class: `tchip${tg.kw ? " kw" : ""}`, "data-t": tg.k, onmouseenter: () => hot(tg.k), onmouseleave: () => hot(null),
        title: tg.kw ? `Keyword match: “${tg.mt}”` : `Matched: “${tg.mt}”\n${METHOD_LABEL[tg.m]}; this sentence's best score ${tg.top.toFixed(2)}` },
        h("b", { class: "mono" }, topicNo(tg.t)), ` ${topicName(tg.t)}`, tg.kw ? null : h("span", { class: "mono" }, tg.sc.toFixed(2)), tg.m !== "meaning" && !tg.kw ? " · named" : ""))));
    }
    for (const [K, els] of boxes) els.forEach((b) => b.classList.toggle("tagged", units.has(K)));
    if (selected) markTopics(selected, false);
    textFind.refresh();   // the unit text was rewritten
  }
  function markTopics(u, scroll) {
    topicsBody.querySelectorAll(".tp-row.hl").forEach((x) => x.classList.remove("hl"));
    const rws = topicRows.get(u.K) || [];
    rws.forEach((r) => { r.classList.add("hl"); r.closest("details").open = true; });
    if (scroll && rws[0]) scrollInto(topicsBody, rws[0]);
  }

  // ----- focus applied to every pane -----
  /** Narrow every pane to the focus; scroll: bring the first unit in focus into view. */
  function applyScope(scroll) {
    syncScope();
    for (const D of docs) osec.get(D.n).hidden = scope.doc != null && D.n !== scope.doc;
    let n = 0;
    for (const u of allUnits) {
      const ok = inScope(u); if (ok) n++;
      unitEls.get(u.K)?.classList.toggle("out", !ok);
      boxes.get(u.K)?.forEach((b) => b.classList.toggle("out", !ok));
    }
    for (const [el, els] of markers) el.hidden = !els.some((e) => !e.classList.contains("out"));
    const D1 = docs.find((D) => D.n === scope.doc);
    title.textContent = D1 ? docName(D1) : docs.length > 1 ? `All ${docs.length} documents, read together` : docName(docs[0]);
    textCount.textContent = `${fmt(n)} units${scope.grade ? ` for ${gName(scope.grade).toLowerCase()}` : ""}`;
    buildRowSel(); buildDb();
    renderTopics();
    if (selected && !inScope(selected)) { selected = null; clearMarks(); origBody.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl")); markTopics({ K: -1 }, false);
      selbar.replaceChildren(h("span", { class: "muted" }, "Click a unit, a box on the page, or a database line to trace it across the panes.")); }
    dbFind.refresh();
    if (scroll) {
      const first = allUnits.find((u) => inScope(u) && !isHidden(u) && !u.f);
      const head = markers.find(([el]) => !el.hidden)?.[0];
      if (head) textBody.scrollTop += head.getBoundingClientRect().top - textBody.getBoundingClientRect().top;
      if (first) markOrigView(first);
      dbBody.scrollTop = 0; topicsBody.scrollTop = 0;
    }
  }
  /** Scroll the original pane to a unit without highlighting it. */
  function markOrigView(u) {
    const el = boxes.get(u.K)?.[0] || (u.p && osec.get(u.D.n).querySelector(`.pg[data-p="${u.p}"]`)) || osec.get(u.D.n);
    scrollInto(origBody, el, false);
  }
  function setUrl() {
    const want = selected ? `#/doc/${st}/${selected.D.n}/u${selected.n}` : scope.doc != null ? `#/doc/${st}/${scope.doc}` : `#/doc/${st}`;
    if (location.hash !== want) history.replaceState(null, "", want);
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
    const els = boxes.get(u.K) || [];
    els.forEach((x) => x.classList.add("hl"));
    if (!scroll) return;
    if (els[0]) scrollInto(origBody, els[0]);
    else scrollInto(origBody, (u.p && u.D.type !== "xlsx" && u.D.type !== "csv" && osec.get(u.D.n).querySelector(`.pg[data-p="${u.p}"]`)) || osec.get(u.D.n), false);
  }
  function markText(u, scroll) {
    textBody.querySelectorAll(".u.hl").forEach((x) => x.classList.remove("hl"));
    const el = unitEls.get(u.K);
    if (!el || isHidden(u)) return;
    el.classList.add("hl");
    if (u.f && !prefs.furn) furnBtn.click();
    if (scroll) scrollInto(textBody, el);
  }
  function showCat(c) { if (!prefs.hide[c]) return; prefs.hide[c] = false; store.set("hide", prefs.hide); hideBtns[["standards", "examples", "backup"].indexOf(c)]?.setAttribute("aria-pressed", "true"); applyHide(); }
  function clearMarks() { textBody.querySelectorAll(".u.hl").forEach((x) => x.classList.remove("hl")); dbBody.querySelectorAll(".seg.hl").forEach((x) => x.classList.remove("hl")); }
  function hiddenNote(u) {
    const c = catOf(u);
    return [h("strong", { class: "mono" }, `u${u.n}`), h("span", {}, h("i", { class: `cat-dot ${c}` }), ` ${c} text is filtered out, so it is not opened in the clean text or database panes.`),
      h("button", { type: "button", class: "link", onclick: () => { showCat(c); select(u.K, "show"); } }, `Show ${c}`)];
  }
  function markDb(u, scroll) {
    dbBody.querySelectorAll(".seg.hl").forEach((x) => x.classList.remove("hl"));
    if (isHidden(u)) return;
    // a repeated unit is kept once in a row: then highlight the identical line it was merged into
    const els = segEls.get(u.K) || (u.r.some((x) => x[0] === dbRow) ? textEls.get(normText(u.s)) || [] : []);
    els.forEach((x) => x.classList.add("hl"));
    if (scroll && els[0]) scrollInto(dbBody, els[0]);
  }
  function select(K, from) {
    const u = byK.get(K);
    if (!u) { selbar.replaceChildren(h("span", { class: "error" }, `There is no unit u${K % UKEY} in ${files[Math.floor(K / UKEY)]?.name || "that document"}.`)); return; }
    selected = u;
    // a unit outside the focus (a link, a typed number, another document's database line) widens the focus to show it
    if (!inScope(u)) {
      if (scope.doc != null && u.D.n !== scope.doc) scope.doc = null;
      if (!inScope(u)) scope.grade = "";
      selected = null; applyScope(); selected = u;
    }
    // a link from another page (or a typed unit number) opens a filtered-out category; a click inside the viewer does not
    if (isHidden(u) && (from === "url" || from === "jump")) showCat(catOf(u));
    if (isHidden(u)) {
      markOrig(u, from !== "orig"); markTopics(u, from !== "topics"); clearMarks();
      selbar.replaceChildren(...hiddenNote(u));
      setUrl();
      return;
    }
    // choose a database row that holds this unit (keep the current one if it does), for the grade in focus if one is
    const holding = (u.r.some((x) => x[2]) ? u.r.filter((x) => x[2]) : u.r).map((x) => x[0]);
    if (holding.length && !holding.includes(dbRow)) {
      dbRow = holding.find((r) => !r.endsWith("_ALL") && rowOK(r)) || holding.find((r) => !r.endsWith("_ALL")) || holding[0];
      if (!feed.has(dbRow)) rowSel.append(h("option", { value: dbRow }, dbRow));
      buildDb();
    }
    markOrig(u, from !== "orig");
    markText(u, from !== "text" && from !== "text-find");
    markDb(u, from !== "db" && from !== "db-find");
    markTopics(u, from !== "topics");
    const L = u.l >= 0 ? u.D.labels[u.l] : null;
    const utags = (tagsOfUnit.get(u.K) || []).filter(shown);
    const where = [docs.length > 1 ? `document ${dpos.get(u.D.n)}` : null, u.p ? (u.D.type === "xlsx" ? `sheet ${u.p}` : `page ${u.p}`) : null, u.t ? u.t : null].filter(Boolean).join(" · ");
    const kept = u.r.filter((x) => x[2]), dropped = u.r.filter((x) => !x[2]);
    selbar.replaceChildren(...[
      h("strong", { class: "mono" }, `u${u.n}`), where ? h("span", { class: "muted", title: u.D.file }, where) : null,
      h("span", {}, h("i", { class: `cat-dot ${catOf(u)}` }), " ", u.f ? "running header/footer" : L ? L.cat : "unlabeled"),
      L ? h("span", {}, `grades ${L.grades}${L.course ? ` · ${L.course}` : ""}`) : null,
      L && L.section ? h("span", { class: "muted" }, L.section) : null,
      h("span", {}, kept.length ? [`In ${kept.length} row${kept.length > 1 ? "s" : ""}: `, kept.slice(0, 12).flatMap((x, i) => [i ? ", " : "", h("a", { class: "rowlink", href: "#", onclick: (e) => { e.preventDefault(); dbRow = x[0]; if (!feed.has(dbRow)) rowSel.append(h("option", { value: dbRow }, dbRow)); buildDb(); markDb(u, true); } }, x[0]), h("span", { class: "muted" }, ` (${x[1]})`)]), kept.length > 12 ? ` and ${kept.length - 12} more` : ""]
        : dropped.length ? null : h("span", { class: "muted" }, "Not in any row's text")),
      dropped.length ? h("span", { class: "muted" }, `Repeat of text already in ${dropped.map((x) => x[0]).join(", ")} (kept once)`) : null,
      utags.length ? h("span", {}, "Topics: ", utags.flatMap((tg, i) => [i ? "; " : "", h("a", { href: topicHref(tg.t) }, tg.kw ? topicName(tg.t) : `${tg.t}. ${topicName(tg.t)}`), h("span", { class: "muted" }, ` ← “${tg.mt}”`), tg.kw ? null : h("span", { class: "muted mono" }, ` ${tg.sc.toFixed(2)}`)])) : null].flat(Infinity).filter(Boolean));
    setUrl();
  }
  /** A new hash for the same state: a unit link selects it, a document link changes the focus. */
  function go(docArg, unit) {
    if (unit) { select(ukey(+docArg, unit), "url"); return; }
    scope.doc = docArg == null || docArg === "" || docArg === "all" || !dpos.has(+docArg) ? null : +docArg;
    applyScope(true); setUrl();
  }

  // ----- layout -----
  const panes = h("div", { class: "panes" });
  function layoutPanes() {
    panes.replaceChildren(...[["orig", origPane], ["text", textPane], ["db", dbPane], ["topics", TL ? topicsPane : null]].filter(([k, p]) => p && prefs.panes[k]).map(([, p]) => p));
    if (selected) { markOrig(selected, true); markText(selected, true); markDb(selected, true); markTopics(selected, true); }
    textFind.refresh(); dbFind.refresh();
  }
  function destroy() { observer?.disconnect(); for (const P of pdfs.values()) P.task?.destroy?.(); textFind.clear(); dbFind.clear(); }

  setMain(h("div", { class: "viewer" }, bar, selbar, panes));
  layoutPanes();
  buildText();
  buildOrig();
  applyHide();
  applyScope();
  if (startUnit) select(ukey(one ?? docs[0].n, startUnit), "url");
  else setUrl();
  return ctl;
}
