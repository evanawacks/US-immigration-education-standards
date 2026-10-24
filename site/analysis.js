/* Topics and Charts tabs: immigration-topic tags from scripts/topic_tags.py (data in site/data/topics/).
   Uses the helpers defined in app.js (h, store, getJSON, loadIndex, fmt, setMain). */
"use strict";

const REGIONS = {
  Northeast: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  Midwest: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  South: ["AL", "AR", "DE", "DC", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV"],
  West: ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY"],
};
const REGION_NAMES = Object.keys(REGIONS);
const REGION_OF = Object.fromEntries(Object.entries(REGIONS).flatMap(([r, sts]) => sts.map((s) => [s, r])));
const CAT_NAMES = ["standards", "examples", "backup"];
const METHOD_NAMES = ["meaning", "name", "both"];
const METHOD_LABEL = { meaning: "by meaning", name: "named in the sentence", both: "by meaning and named" };

// ---------- data ----------
let TD = null;   // prepared topic data
async function loadTopicData() {
  if (TD) return TD;
  const [list, tags, words] = await Promise.all([getJSON("topics/list.json"), getJSON("topics/tags.json"), getJSON("topics/words.json")]);
  const topicByNo = Object.fromEntries(list.topics.map((t) => [t.no, t]));
  const eraIdx = Object.fromEntries(list.eras.map((e, i) => [e, i]));
  TD = { ...list, tags, words, topicByNo, eraOfTopic: Object.fromEntries(list.topics.map((t) => [t.no, eraIdx[t.era]])), n: tags.t.length };
  return TD;
}
const loadTopicText = () => getJSON("topics/text.json");

// ---------- the separate keyword counts: plain word search (scripts/keyword_tags.py), apart from the topics ----------
// Each keyword is a pseudo-topic with a number of 0 or below (the 106 topics are numbered from 1).
const KWS = [   // keep in step with KEYWORDS in scripts/keyword_tags.py
  { id: "immigration", no: 0, slug: "kw", tag: "kw", re: /(?<![A-Za-z])immigra[A-Za-z]*/gi, word: "“immigra…”", rule: "every word starting with “immigra”",
    topic: "“Immigration” keyword", terms: ["immigration", "immigrant(s)", "immigrate(d)", "any word starting with “immigra”"],
    description: "Not one of the 106 topics: a plain word search, counted on its own. Every word starting with “immigra” (immigration, immigrant, immigrated…) is one match, whatever its meaning; “emigration” and “migration” are not matched." },
  { id: "migra", no: -1, slug: "kw-migra", tag: "mg", re: /[A-Za-z]*migra[A-Za-z]*/gi, word: "“…migra…”", rule: "every word containing “migra”",
    topic: "“Migra” keyword", terms: ["migration", "migrant(s)", "immigration", "emigration", "any word containing “migra”"],
    description: "Not one of the 106 topics: a plain word search, counted on its own. Every word containing “migra” (migration, migrant, immigration, emigrated, outmigration…) is one match, whatever its meaning. It includes every “immigra” match." },
].map((k) => ({ ...k, era: "Keyword", years: "all" }));
const KW_BY_NO = Object.fromEntries(KWS.map((k) => [k.no, k]));
const isKw = (t) => t in KW_BY_NO;
const KDS = {};   // keyword data shaped like TD, by keyword id (null: not built)
async function loadKeywordData(id = KWS[0].id) {
  if (id in KDS) return KDS[id];
  const D = await loadTopicData();
  const all = await getJSON("topics/keyword.json").catch(() => null);
  const k = KWS.find((x) => x.id === id), kw = all?.keywords?.[id];
  KDS[id] = kw && k ? { ...D, tags: kw.tags, text: kw.text, n: kw.tags.t.length, topics: [k], eras: [k.era], topicByNo: { [k.no]: k }, eraOfTopic: { [k.no]: 0 }, keyword: k } : null;
  return KDS[id];
}
/** [{ k, D }] for every keyword that has been built. */
async function loadKeywords() { return (await Promise.all(KWS.map(async (k) => ({ k, D: await loadKeywordData(k.id) })))).filter((x) => x.D); }
const topicHref = (t) => (isKw(t) ? `#/topics/${KW_BY_NO[t].slug}` : `#/topics/${t}`);
const topicNo = (t) => (isKw(t) ? KW_BY_NO[t].tag : String(t));

// ---------- global topic filter (Topic filter tab): leaves topics out of every tab and the viewer; remembered ----------
const GF = { excluded: new Set(store.get("gfExcluded", [])), kwOff: new Set(store.get("gfKwOff", store.get("gfKw", true) ? [] : ["immigration"])) };
function saveGF() { store.set("gfExcluded", [...GF.excluded]); store.set("gfKwOff", [...GF.kwOff]); navBadge(); }
const topicOn = (t) => (isKw(t) ? !GF.kwOff.has(KW_BY_NO[t].id) : !GF.excluded.has(t));
const kwOn = (k) => !GF.kwOff.has(k.id);
function navBadge() {
  const a = document.querySelector('.nav a[data-nav="filters"]');
  if (!a) return;
  const n = GF.excluded.size + GF.kwOff.size;
  a.replaceChildren("Topic filter", n ? h("span", { class: "nav-badge", title: `${n} topic${n > 1 ? "s" : ""} filtered out` }, String(n)) : "");
}
/** A line saying which topics the global filter leaves out (null when none). */
function gfNote() {
  const n = GF.excluded.size;
  if (!n && !GF.kwOff.size) return null;
  const off = KWS.filter((k) => !kwOn(k)).map((k) => k.topic);
  const parts = [n ? `${n} topic${n > 1 ? "s are" : " is"} filtered out` : null, off.length ? `the ${off.join(" and ")} ${off.length > 1 ? "are" : "is"} off` : null].filter(Boolean).join(" and ");
  return h("p", { class: "gf-note" }, `${parts[0].toUpperCase()}${parts.slice(1)} on every tab. `, h("a", { href: "#/filters" }, "Change the global filter"));
}

// ---------- grades ----------
const gIsBand = (g) => /[-+]/.test(g);
const gNum = (x) => (x === "PK" ? -1 : x === "K" ? 0 : +x);
const gLabel = (g) => g.split(/([-+])/).map((p) => (p === "-" ? "–" : p === "+" ? ", " : p === "PK" ? "Pre-K" : p.replace(/^0(\d)/, "$1"))).join("");
const gSortKey = (g) => { const p = g.split(/[-+]/); return gNum(p[0]) * 100 + gNum(p[p.length - 1]); };
/** Positions on a PK..12 axis (PK = 0, K = 1, grade 1 = 2, ...) of the grades a grade group covers: "K-02" -> [1, 2, 3]. */
const gPos = (x) => gNum(x) + 1;
function gSpan(g) {
  if (g.includes("-")) { const [a, b] = g.split("-").map(gPos); return Array.from({ length: b - a + 1 }, (_, i) => a + i); }
  return g.split("+").map(gPos);
}
const AXIS_GRADES = ["Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
/** The bands of the "by grade" line graph in its bands view (K-12; Pre-K text is left out), as grade groups and axis positions. */
const LINE_BANDS = [["K-02", [1, 2, 3]], ["03-05", [4, 5, 6]], ["06-08", [7, 8, 9]], ["09-12", [10, 11, 12, 13]]].map(([g, pos]) => ({ g, pos }));

// ---------- shared filters (one set for both tabs; score settings remembered) ----------
const AF = {
  states: null, regions: new Set(REGION_NAMES), grade: "all", topics: null,
  minScore: store.get("minScore", null), named: store.get("named", true),
  gapOn: store.get("gapOn", false), gap: store.get("gap", 25),
};
function initFilters(D) {
  if (AF.minScore == null) AF.minScore = D.meta.default_min_score;
  if (!AF.states) AF.states = new Set(D.states);
  if (!AF.topics) AF.topics = new Set(D.topics.map((t) => t.no));
}
function effStates(D) { return D.states.filter((s) => AF.states.has(s) && AF.regions.has(REGION_OF[s])); }
function gradeOK(g) {
  if (AF.grade === "all") return true;
  if (AF.grade === "bands") return gIsBand(g);
  if (AF.grade === "singles") return !gIsBand(g);
  return AF.grade.slice(2) === g;   // "g:05" or "b:K-02": an exact grade group
}
const catOK = () => true;   // the analysis data holds standards text only (examples and backup are excluded)
/** Indices of the tags that pass the filters. opts.ignoreGrade / ignoreTopics / ignoreStates / ignoreGlobal relax one filter. */
function filteredTags(D, opts = {}) {
  const T = D.tags, out = [];
  const st = new Set(opts.ignoreStates ? D.states : effStates(D));
  const stOK = D.states.map((s) => st.has(s));
  const gOK = D.grades.map((g) => opts.ignoreGrade || gradeOK(g));
  const min = Math.round(AF.minScore * 1000);
  for (let i = 0; i < D.n; i++) {
    if (!stOK[T.st[i]] || !gOK[T.g[i]] || !catOK(T.c[i])) continue;
    if (!opts.ignoreGlobal && !topicOn(T.t[i])) continue;
    if (!opts.ignoreTopics && !D.keyword && !AF.topics.has(T.t[i])) continue;
    if (T.sc[i] < min && !(AF.named && T.m[i] !== 0)) continue;
    out.push(i);
  }
  return AF.gapOn ? dropRepeats(D, out) : out;
}
/** Drop a tag when the same topic was already tagged within AF.gap words before it in the same document
    (distance from the previous mention, so a run of repeats counts once). */
function dropRepeats(D, idx) {
  const T = D.tags;
  const sorted = idx.slice().sort((a, b) => T.st[a] - T.st[b] || T.d[a] - T.d[b] || T.t[a] - T.t[b] || T.wp[a] - T.wp[b]);
  const keep = [];
  let prev = -1;
  for (const i of sorted) {
    const same = prev >= 0 && T.st[prev] === T.st[i] && T.d[prev] === T.d[i] && T.t[prev] === T.t[i];
    if (!(same && T.wp[i] - T.wp[prev] <= AF.gap)) keep.push(i);
    prev = i;
  }
  return keep;
}
/** Number of distinct topics among tag indices. */
const distinct = (D, idx) => new Set(idx.map((i) => D.tags.t[i])).size;
/** Words of counted text per state (and per grade group) under the state/grade/category filters. */
function wordTotals(D, opts = {}) {
  const W = D.words, st = new Set(opts.ignoreStates ? D.states : effStates(D));
  const byState = {}, byStateGrade = {};
  for (let i = 0; i < W.w.length; i++) {
    const s = D.states[W.st[i]], g = D.grades[W.g[i]];
    if (!st.has(s) || !catOK(W.c[i]) || (!opts.ignoreGrade && !gradeOK(g))) continue;
    byState[s] = (byState[s] || 0) + W.w[i];
    const k = `${s}|${g}`; byStateGrade[k] = (byStateGrade[k] || 0) + W.w[i];
  }
  return { byState, byStateGrade };
}
const tagPasses = (tag) => topicOn(tag.t) && (tag.sc >= AF.minScore || (AF.named && tag.m !== "meaning"));

// ---------- small UI pieces ----------
function multiSelect({ id, label, groups, selected, onChange, noun, max }) {
  const all = groups.flatMap((g) => g.items.map((x) => x.value));
  const summary = h("summary", { class: "ms-sum", id });
  const det = h("details", { class: "ms" }, summary);
  const panel = h("div", { class: "ms-panel", role: "group", "aria-label": label });
  const search = h("input", { type: "search", placeholder: `Find ${noun}…`, "aria-label": `Find ${noun}` });
  const boxes = new Map();
  const groupBoxes = [];
  function sync() {
    const n = all.filter((v) => selected.has(v)).length;
    summary.textContent = n === all.length ? `All ${noun} (${n})` : n === 0 ? `No ${noun}` : n === 1 ? labelOf(all.find((v) => selected.has(v))) : `${n} of ${all.length} ${noun}`;
    for (const [v, cb] of boxes) cb.checked = selected.has(v);
    for (const [gcb, items] of groupBoxes) {
      const k = items.filter((v) => selected.has(v)).length;
      gcb.checked = k === items.length; gcb.indeterminate = k > 0 && k < items.length;
    }
  }
  const labelOf = (v) => groups.flatMap((g) => g.items).find((x) => x.value === v)?.label ?? String(v);
  function set(vals, on) {
    for (const v of vals) on ? selected.add(v) : selected.delete(v);
    if (max && selected.size > max) { const keep = [...selected].slice(-max); selected.clear(); keep.forEach((v) => selected.add(v)); }
    sync(); onChange(selected);
  }
  const tools = h("div", { class: "ms-tools" },
    max ? h("span", { class: "muted" }, `Up to ${max}`) : h("button", { type: "button", onclick: () => set(all, true) }, "Select all"),
    h("button", { type: "button", onclick: () => set(all, false) }, "Clear"));
  const list = h("div", { class: "ms-list" });
  for (const g of groups) {
    const items = g.items.map((x) => x.value);
    let head = null;
    if (g.name) {
      const gcb = h("input", { type: "checkbox", "aria-label": `All of ${g.name}` });
      gcb.addEventListener("change", () => set(items, gcb.checked));
      groupBoxes.push([gcb, items]);
      head = h("div", { class: "ms-group" }, h("label", {}, gcb, h("b", {}, g.name)), max ? null : h("button", { type: "button", class: "link", onclick: () => { selected.clear(); set(items, true); } }, "only"));
    }
    const rows = g.items.map((x) => {
      const cb = h("input", { type: "checkbox" });
      cb.addEventListener("change", () => set([x.value], cb.checked));
      boxes.set(x.value, cb);
      return h("div", { class: "ms-item", "data-label": x.label.toLowerCase() }, h("label", {}, cb, x.label),
        h("button", { type: "button", class: "link", onclick: () => { selected.clear(); set([x.value], true); } }, "only"));
    });
    list.append(h("div", { class: "ms-sec" }, head, rows));
  }
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    list.querySelectorAll(".ms-item").forEach((r) => (r.hidden = q && !r.dataset.label.includes(q)));
  });
  panel.append(search, tools, list);
  det.append(panel);
  document.addEventListener("click", (e) => { if (det.open && !det.contains(e.target)) det.open = false; });
  sync();
  return h("div", { class: "field" }, h("label", { for: id }, label), det);
}

function filterBar(D, onChange, { topics = true, score = true, extra = null } = {}) {
  const stateGroups = REGION_NAMES.map((r) => ({ name: r, items: REGIONS[r].filter((s) => D.states.includes(s)).map((s) => ({ value: s, label: `${s} · ${D.stateNames[s]}` })) }));
  const stSel = multiSelect({ id: "af-states", label: "States", groups: stateGroups, selected: AF.states, onChange, noun: "states" });
  const regions = h("div", { class: "field" }, h("span", { class: "flabel" }, "Regions"),
    h("div", { class: "chips", role: "group", "aria-label": "Regions" }, REGION_NAMES.map((r) => h("button", { type: "button", "aria-pressed": String(AF.regions.has(r)), onclick: (e) => {
      AF.regions.has(r) ? AF.regions.delete(r) : AF.regions.add(r); e.currentTarget.setAttribute("aria-pressed", String(AF.regions.has(r))); onChange();
    } }, r))));
  const singles = D.grades.filter((g) => !gIsBand(g)).sort((a, b) => gSortKey(a) - gSortKey(b));
  const bands = D.grades.filter(gIsBand).sort((a, b) => gSortKey(a) - gSortKey(b));
  const grSel = h("select", { id: "af-grade" },
    h("option", { value: "all" }, "All grades and bands"),
    h("optgroup", { label: "Single grades (bands excluded)" }, h("option", { value: "singles" }, "Every single grade"), singles.map((g) => h("option", { value: `g:${g}` }, `Grade ${gLabel(g)}`))),
    h("optgroup", { label: "Grade bands (as the state wrote them)" }, h("option", { value: "bands" }, "Every grade band"), bands.map((g) => h("option", { value: `b:${g}` }, gLabel(g)))));
  grSel.value = AF.grade;
  grSel.addEventListener("change", () => { AF.grade = grSel.value; onChange(); });
  const topicSel = topics ? multiSelect({ id: "af-topics", label: "Topics", noun: "topics", selected: AF.topics, onChange,
    groups: D.eras.map((e) => ({ name: e, items: D.topics.filter((t) => t.era === e && topicOn(t.no)).map((t) => ({ value: t.no, label: `${t.no}. ${t.topic}` })) })).filter((g) => g.items.length) }) : null;
  return h("div", { class: "filters filterbar", role: "search" }, extra, stSel, regions,
    h("div", { class: "field" }, h("label", { for: "af-grade" }, "Grade"), grSel),
    topicSel, score ? scoreControl(D, onChange) : null, repeatControl(onChange));
}

function repeatControl(onChange) {
  const on = h("input", { type: "checkbox", id: "af-gap-on" });
  on.checked = AF.gapOn;
  const n = h("input", { type: "number", id: "af-gap", min: "1", max: "500", step: "1", value: String(AF.gap), "aria-label": "Words", class: "num-in" });
  on.addEventListener("change", () => { AF.gapOn = on.checked; store.set("gapOn", AF.gapOn); onChange(); });
  n.addEventListener("change", () => { AF.gap = Math.max(1, +n.value || 25); n.value = String(AF.gap); store.set("gap", AF.gap); if (AF.gapOn) onChange(); });
  return h("div", { class: "field" }, h("span", { class: "flabel" }, "Repeats"),
    h("div", { class: "score-row" }, h("label", { class: "check", for: "af-gap-on", title: "Skip a tag when the same topic was already tagged within this many words before it, in the same document" }, on, "Skip a topic repeated within"), n, h("span", {}, "words")));
}

function scoreControl(D, onChange, { compact = false } = {}) {
  const id = compact ? "sc-min-v" : "sc-min";
  const out = h("output", { for: id, class: "mono" }, AF.minScore.toFixed(2));
  const range = h("input", { type: "range", id, min: String(D.meta.score_floor), max: "0.95", step: "0.01", value: String(AF.minScore) });
  range.addEventListener("input", () => { AF.minScore = +range.value; out.textContent = AF.minScore.toFixed(2); });
  range.addEventListener("change", () => { store.set("minScore", AF.minScore); onChange(); });
  const named = h("input", { type: "checkbox", id: id + "-named" });
  named.checked = AF.named;
  named.addEventListener("change", () => { AF.named = named.checked; store.set("named", AF.named); onChange(); });
  return h("div", { class: "field score-field" }, h("label", { for: id }, "Minimum similarity score"),
    h("div", { class: "score-row" }, range, out, h("label", { class: "check", for: id + "-named", title: "Keep a topic whose name or search terms appear in the sentence, whatever its score" }, named, "Keep named topics")));
}

/** Show a tooltip on hover, and on a tap (a touch screen sends no pointermove before the tap). */
const onPoint = (el, fn) => { el.addEventListener("pointermove", fn); el.addEventListener("pointerdown", fn); };
// tooltip (one per page)
function tooltip() {
  let tip = document.getElementById("viz-tip");
  if (!tip) {
    tip = h("div", { id: "viz-tip", class: "viz-tip", role: "tooltip", hidden: true }); document.body.append(tip);
    // Safety net: pointerleave does not fire when the chart under the pointer is redrawn or removed, when the page
    // scrolls under a still pointer, or after a tap on a touch screen. Hide the tip whenever the pointer is anywhere
    // but on the element that opened it, and on scroll, resize, or leaving the window.
    const off = (e) => { if (!tip.hidden && !(tip.owner?.isConnected && e.target instanceof Node && tip.owner.contains(e.target))) tip.hidden = true; };
    document.addEventListener("pointermove", off, true);
    document.addEventListener("pointerdown", off, true);
    const hideNow = () => { tip.hidden = true; };
    window.addEventListener("scroll", hideNow, true);
    window.addEventListener("resize", hideNow);
    document.documentElement.addEventListener("pointerleave", (e) => e.pointerType !== "touch" && hideNow());
    window.addEventListener("blur", hideNow);
    document.addEventListener("keydown", (e) => e.key === "Escape" && hideNow());
  }
  return {
    show(e, rows) {
      tip.owner = e.currentTarget instanceof Element ? e.currentTarget : null;   // null (keyboard focus): any pointer move hides it
      tip.replaceChildren(...rows.map(([v, l, color]) => h("div", { class: "tip-row" }, color ? h("i", { class: "tip-key", style: `background:${color}` }) : null, h("b", {}, v), l ? h("span", {}, l) : null)));
      tip.hidden = false;
      tip.touch = e.pointerType === "touch";
      // last line of defense, whatever events the browser does or does not send: while the tip is up, check four
      // times a second that a mouse is still over the element that opened it
      clearInterval(tip.watch);
      tip.watch = setInterval(() => {
        if (tip.hidden) { clearInterval(tip.watch); return; }
        if (!tip.owner?.isConnected || (!tip.touch && tip.owner && !tip.owner.matches(":hover"))) { tip.hidden = true; clearInterval(tip.watch); }
      }, 250);
      // beside the pointer, flipped to the other side near an edge, so it never sits under the pointer
      const W = tip.offsetWidth, H = tip.offsetHeight;
      const x = e.clientX + 14 + W + 8 <= window.innerWidth ? e.clientX + 14 : Math.max(8, e.clientX - 14 - W);
      const y = e.clientY + 14 + H + 8 <= window.innerHeight ? e.clientY + 14 : Math.max(8, e.clientY - 14 - H);
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    },
    hide(e) { if (e?.pointerType !== "touch") tip.hidden = true; },   // a finger lifting is not leaving: a tap elsewhere or a scroll hides it
  };
}
const svg = (tag, attrs, ...kids) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const fmt1 = (x) => (x >= 100 ? fmt(Math.round(x)) : x >= 10 ? x.toFixed(1) : x.toFixed(2));

// ---------- binning (colors come from CSS classes, so both themes work) ----------
function bins(values, scale, k = 7) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return { edges: [], cls: () => "q0" };
  let edges;
  if (scale === "quantile") {
    k = Math.min(5, v.length);
    edges = Array.from({ length: k - 1 }, (_, i) => v[Math.floor(((i + 1) * v.length) / k)]);
  } else if (scale === "log") {
    const lo = Math.log(v[0]), hi = Math.log(v[v.length - 1]);
    edges = Array.from({ length: k - 1 }, (_, i) => Math.exp(lo + ((hi - lo) * (i + 1)) / k));
  } else {
    const hi = v[v.length - 1];
    edges = Array.from({ length: k - 1 }, (_, i) => (hi * (i + 1)) / k);
  }
  const steps = edges.length + 1;
  const lo0 = scale === "linear" ? 0 : v[0];
  const map = steps === 5 ? [1, 2, 4, 5, 7] : Array.from({ length: steps }, (_, i) => Math.round(1 + (i * 6) / Math.max(1, steps - 1)));
  const cls = (x) => { if (!(x > 0)) return "q0"; let i = 0; while (i < edges.length && x >= edges[i]) i++; return `q${map[i]}`; };
  return { edges, cls, steps, map, min: lo0, max: v[v.length - 1] };
}
function legendBins(b, fmtv, note) {
  if (!b.edges.length && !b.min) return h("div", { class: "legend" }, h("span", {}, "No tags under these filters"));
  const ranges = [];
  const lo = [b.min, ...b.edges], hi = [...b.edges, b.max];
  for (let i = 0; i < lo.length; i++) ranges.push(h("span", { class: "lg" }, h("i", { class: `sw q${b.map[i]}` }), `${fmtv(lo[i])}–${fmtv(hi[i])}`));
  return h("div", { class: "legend" }, h("span", { class: "lg" }, h("i", { class: "sw q0" }), "0 / not selected"), ranges, note ? h("span", { class: "muted" }, note) : null);
}

function markMatch(sentence, start, len) {
  if (!(start >= 0) || !len) return sentence;
  return [sentence.slice(0, start), h("mark", { class: "match" }, sentence.slice(start, start + len)), sentence.slice(start + len)];
}

// ================= TOPICS TAB =================
async function topicsPage(no) {
  const [D, KL, idx] = await Promise.all([loadTopicData(), loadKeywords(), loadIndex()]);
  D.stateNames = Object.fromEntries(Object.entries(idx.states).map(([k, s]) => [k, s.name]));
  for (const x of KL) x.D.stateNames = D.stateNames;
  initFilters(D);
  const kwPage = KWS.find((k) => k.slug === no);
  if (kwPage) { const x = KL.find((y) => y.k === kwPage); if (!x) throw new Error("The keyword counts have not been built (run scripts/keyword_tags.py, then scripts/build_site.py)."); return topicDetail(x.D, idx, kwPage.no); }
  if (no) return topicDetail(D, idx, +no);
  const body = h("div", { class: "topic-eras" });
  const kwBox = h("div", {});
  const stat = h("p", { class: "stats" });
  const onTopics = D.topics.filter((t) => topicOn(t.no));
  function draw() {
    const keep = filteredTags(D, { ignoreTopics: true });
    const count = {}, states = {};
    for (const i of keep) { const t = D.tags.t[i]; count[t] = (count[t] || 0) + 1; (states[t] ||= new Set()).add(D.tags.st[i]); }
    const max = Math.max(1, ...Object.values(count));
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), " tags"), h("span", {}, h("b", {}, Object.keys(count).length), " of ", h("b", {}, onTopics.length), " distinct topics found"),
      h("span", {}, h("b", {}, effStates(D).length), " states selected"));
    // the keyword counts, apart from the topics
    const KON = KL.filter((x) => kwOn(x.k));
    if (KON.length) {
      const { byState: w } = wordTotals(D);
      const words = effStates(D).reduce((a, s) => a + (w[s] || 0), 0);
      const rows = KON.map(({ k, D: K }) => { const kk = filteredTags(K); return { k, n: kk.length, states: new Set(kk.map((i) => K.tags.st[i])).size }; });
      const kmax = Math.max(1, ...rows.map((r) => r.n));
      kwBox.replaceChildren(h("section", { class: "era kw-era" },
        h("header", {}, h("h2", {}, "Separate keyword counts"), h("span", { class: "muted mono" }, rows.map((r) => `${fmt(r.n)} ${r.k.word}`).join(" · "))),
        h("p", { class: "muted small" }, "Not part of the topic counts below: plain text search for words starting with “immigra” (immigration, immigrant…) and, separately, words containing “migra” (migration, migrant, emigration, immigration…)."),
        h("ol", { class: "topic-list" }, rows.map(({ k, n, states }) => h("li", {},
          h("a", { class: "tl-name", href: topicHref(k.no) }, h("span", { class: "tl-no mono" }, k.tag), h("span", {}, k.topic, h("span", { class: "muted" }, ` · ${k.rule} · ${words ? fmt1((n / words) * 1e4) : "—"} per 10,000 words`))),
          h("span", { class: "tl-bar", "aria-hidden": "true" }, h("i", { style: `width:${(n / kmax) * 100}%` })),
          h("span", { class: "tl-n mono" }, fmt(n)),
          h("span", { class: "tl-s muted" }, `${states} states`))))));
    } else kwBox.replaceChildren();
    body.replaceChildren(...D.eras.map((era) => {
      const ts = D.topics.filter((t) => t.era === era && topicOn(t.no));
      if (!ts.length) return null;
      const n = ts.reduce((a, t) => a + (count[t.no] || 0), 0);
      return h("section", { class: "era" },
        h("header", {}, h("h2", {}, era), h("span", { class: "muted mono" }, `${fmt(n)} tags`)),
        h("ol", { class: "topic-list" }, ts.map((t) => h("li", { value: t.no },
          h("a", { class: "tl-name", href: `#/topics/${t.no}` }, h("span", { class: "tl-no mono" }, `${t.no}.`), h("span", {}, t.topic, h("span", { class: "muted" }, ` · ${t.years}`))),
          h("span", { class: "tl-bar", "aria-hidden": "true" }, h("i", { style: `width:${((count[t.no] || 0) / max) * 100}%` })),
          h("span", { class: "tl-n mono" }, fmt(count[t.no] || 0)),
          h("span", { class: "tl-s muted" }, `${states[t.no]?.size || 0} states`)))));
    }).filter(Boolean));
  }
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Immigration topics"), h("h1", {}, `${onTopics.length === D.topics.length ? D.topics.length : `${onTopics.length} of ${D.topics.length}`} topics, numbered by era`)), gfNote(),
    h("p", { class: "lede" }, "Each sentence of the standards text was compared with every topic by a local language model. A sentence gets the one topic it is most similar to, plus any topic it names outright. Raise the minimum similarity score to drop weak matches. Examples and backup text are tagged too, but only in the document viewer; they are not counted here."),
    filterBar(D, draw, { topics: false }), stat, kwBox, body));
  draw();
}

async function topicDetail(D, idx, no) {
  const t = D.topicByNo[no];
  if (!t) throw new Error(`There is no topic ${no}.`);
  const text = D.text || await loadTopicText();
  const off = !topicOn(no) ? h("p", { class: "gf-note" }, `This ${D.keyword ? "keyword" : "topic"} is filtered out on every tab, so nothing is counted here. `,
    h("button", { type: "button", class: "link", onclick: () => { D.keyword ? GF.kwOff.delete(D.keyword.id) : GF.excluded.delete(no); saveGF(); route(); } }, "Include it again"), " · ", h("a", { href: "#/filters" }, "Global filter")) : null;
  const byState = h("div", { class: "table-wrap" });
  const occ = h("div", { class: "occ" });
  const stat = h("p", { class: "stats" });
  let limit = 200;
  function draw() {
    const keep = filteredTags(D, { ignoreTopics: true }).filter((i) => D.tags.t[i] === no);
    const noun = D.keyword ? "matches" : "tags";
    const { byState: words } = wordTotals(D);
    const per = {};
    for (const i of keep) { const s = D.states[D.tags.st[i]]; per[s] = (per[s] || 0) + 1; }
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), ` ${noun}`), h("span", {}, h("b", {}, Object.keys(per).length), " states"));
    const rows = Object.entries(per).sort((a, b) => b[1] - a[1]);
    byState.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, h("th", {}, "State"), h("th", {}, "Region"), h("th", { class: "num" }, D.keyword ? "Matches" : "Tags"), h("th", { class: "num" }, "Per 10,000 words"))),
      h("tbody", {}, rows.map(([s, n]) => h("tr", {}, h("td", {}, `${s} · ${D.stateNames[s]}`), h("td", {}, REGION_OF[s]), h("td", { class: "num" }, fmt(n)), h("td", { class: "num" }, words[s] ? fmt1((n / words[s]) * 1e4) : "—"))))));
    // occurrences grouped by state and document
    keep.sort((a, b) => D.tags.st[a] - D.tags.st[b] || D.tags.d[a] - D.tags.d[b] || D.tags.u[a] - D.tags.u[b]);
    const shown = keep.slice(0, limit);
    const out = [];
    let lastKey = null;
    for (const i of shown) {
      const T = D.tags, s = D.states[T.st[i]], d = T.d[i];
      const key = `${s}|${d}`;
      if (key !== lastKey) { out.push(h("h3", { class: "occ-doc" }, `${D.stateNames[s]} · `, h("span", { class: "muted" }, idx.states[s].files[d]?.name || "?"))); lastKey = key; }
      out.push(h("a", { class: "occ-row", href: `#/doc/${s}/${d}/u${T.u[i]}` },
        h("span", { class: "occ-text" }, markMatch(text[T.x[i]], T.ms[i], T.ml[i])),
        h("span", { class: "occ-meta" }, D.keyword ? h("b", {}, "keyword match") : [h("b", { class: "mono" }, (T.sc[i] / 1000).toFixed(2)), ` ${METHOD_LABEL[METHOD_NAMES[T.m[i]]]}`],
          ` · ${CAT_NAMES[T.c[i]]} · grades ${gLabel(D.grades[T.g[i]])}`, T.co[i] >= 0 ? ` · ${D.courses[T.co[i]]}` : "", ` · u${T.u[i]}`)));
    }
    if (keep.length > shown.length) out.push(h("button", { onclick: () => { limit += 400; draw(); } }, `Show more (${fmt(keep.length - shown.length)} more)`));
    occ.replaceChildren(...(out.length ? out : [h("p", { class: "muted" }, "No sentences match these filters.")]));
  }
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, h("a", { href: "#/topics" }, "Topics"), ` / ${t.era}`), h("h1", {}, D.keyword ? t.topic : `${t.no}. ${t.topic}`)), off,
    h("dl", { class: "meta" }, h("dt", {}, "Years"), h("dd", {}, t.years), h("dt", {}, "Description"), h("dd", {}, t.description), h("dt", {}, D.keyword ? "Matches" : "Search terms"), h("dd", {}, t.terms.join("; "))),
    filterBar(D, draw, { topics: false, score: !D.keyword }), stat,
    h("div", { class: "two-col" }, h("section", {}, h("h2", {}, "By state"), byState), h("section", { class: "minw0" }, h("h2", {}, "Where it appears"), h("p", { class: "muted" }, "Click a sentence to open it in the side-by-side viewer."), occ))));
  draw();
}

// ================= CHARTS TAB =================
async function chartsPage() {
  const [TD0, KL0, idx] = await Promise.all([loadTopicData(), loadKeywords(), loadIndex()]);
  TD0.stateNames = Object.fromEntries(Object.entries(idx.states).map(([k, s]) => [k, s.name]));
  for (const x of KL0) x.D.stateNames = TD0.stateNames;
  initFilters(TD0);
  const KL = KL0.filter((x) => kwOn(x.k));   // keywords not switched off on the Topic filter page
  // what is counted: the 106 topics, or one of the separate keywords
  let src = store.get("chartSource", "topics");
  if (src === "kw") src = "immigration";
  const kwSrc = KL.find((x) => x.k.id === src);
  const D = kwSrc ? kwSrc.D : TD0;
  const srcSel = KL.length ? h("select", { id: "af-src" }, h("option", { value: "topics" }, "Immigration topics (106)"), KL.map(({ k }) => h("option", { value: k.id }, `${k.topic} (${k.word}, separate)`))) : null;
  if (srcSel) { srcSel.value = kwSrc ? kwSrc.k.id : "topics"; srcSel.addEventListener("change", () => { store.set("chartSource", srcSel.value); chartsPage(); }); }
  const srcField = srcSel ? h("div", { class: "field" }, h("label", { for: "af-src" }, "Count"), srcSel) : null;
  const geo = await fetch("site/vendor/states-albers-10m.json").then((r) => r.json());
  const tip = tooltip();
  const opt = { mapMeasure: "rate", mapScale: "linear", mtxValue: "share", mtxCols: "eras", lineMeasure: "count", lineAgg: "avg", lineGrades: "bands", lineBy: "combined", compare: new Set(),
    smMeasure: "count", smRows: "states", profile: store.get("profile", null) };

  const stat = h("p", { class: "stats" });
  const mapBox = h("div", { class: "viz-map" }), mapLegend = h("div", {}), mapTable = h("div", { class: "table-wrap", hidden: true });
  const mtxBox = h("div", { class: "viz-mtx table-wrap" });
  const lineBox = h("div", { class: "viz-line" }), smBox = h("div", { class: "viz-line viz-rows" }), profBox = h("div", { class: "profile" }), lineLegend = h("div", {}), lineTable = h("div", { class: "table-wrap", hidden: true });
  const sel = (id, options, key) => {
    const s = h("select", { id }, options.map(([v, l]) => h("option", { value: v }, l)));
    s.value = opt[key]; s.addEventListener("change", () => { opt[key] = s.value; draw(); }); return s;
  };
  const tableBtn = (tbl) => h("button", { type: "button", "aria-pressed": "false", onclick: (e) => { tbl.hidden = !tbl.hidden; e.currentTarget.setAttribute("aria-pressed", String(!tbl.hidden)); } }, "Table");
  const compareWrap = h("div", {});

  const features = topojson.feature(geo, geo.objects.states).features;
  const nameToAbbr = Object.fromEntries(Object.entries(D.stateNames).map(([a, n]) => [n, a]));

  let kwPer = [];
  function draw() {
    tip.hide();   // the element that opened it is about to be replaced
    const keep = filteredTags(D);
    const { byState: words } = wordTotals(D);
    const eff = effStates(D).filter((s) => words[s] > 0);
    const per = {}, top = {};
    for (const i of keep) { const s = D.states[D.tags.st[i]]; per[s] = (per[s] || 0) + 1; ((top[s] ||= {})[D.tags.t[i]] = (top[s][D.tags.t[i]] || 0) + 1); }
    const totW = eff.reduce((a, s) => a + words[s], 0);
    // the separate keyword counts, shown beside the topic tags (same states and grades)
    kwPer = D.keyword ? [] : KL.map(({ k, D: K }) => { const per = {}; for (const i of filteredTags(K)) { const s = D.states[K.tags.st[i]]; per[s] = (per[s] || 0) + 1; } return { k, per, n: Object.values(per).reduce((a, b) => a + b, 0) }; });
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), " tags"), h("span", {}, h("b", {}, distinct(D, keep)), " distinct topics"), h("span", {}, h("b", {}, eff.length), " states with text"),
      h("span", {}, h("b", {}, fmt(totW)), " words of standards"), h("span", {}, h("b", {}, totW ? fmt1((keep.length / totW) * 1e4) : "—"), " tags per 10,000 words"),
      kwPer.map(({ k, n }) => h("a", { href: topicHref(k.no), class: "kw-stat" }, h("b", {}, fmt(n)), ` ${k.word} keyword matches`)));
    drawMap(eff, per, words, top);
    drawMatrix(keep, eff, words);
    const all = wordTotals(D, { ignoreGrade: true });
    const effAll = effStates(D).filter((s) => all.byState[s] > 0);
    const keepAll = filteredTags(D, { ignoreGrade: true });
    drawLine(keepAll, all.byStateGrade, effAll);
    drawStates(keepAll, all.byStateGrade, effAll);
    drawProfile(effAll);
  }

  // ----- map -----
  function drawMap(eff, per, words, top) {
    const nTop = (s) => Object.keys(top[s] || {}).length;   // distinct topics in the state
    const unit = { rate: "per 10,000 words", count: "tags", distinct: "distinct topics" }[opt.mapMeasure];
    const val = (s) => (opt.mapMeasure === "rate" ? (words[s] ? ((per[s] || 0) / words[s]) * 1e4 : 0) : opt.mapMeasure === "distinct" ? nTop(s) : per[s] || 0);
    const b = bins(eff.map(val), opt.mapScale);
    const effSet = new Set(eff);
    const paths = features.map((f) => {
      const s = nameToAbbr[f.properties.name];
      const p = svg("path", { d: geoPath(f.geometry), class: `st ${effSet.has(s) ? b.cls(val(s)) : "q0 off"}`, tabindex: "0", "aria-label": s });
      const show = (e) => {
        const tops = Object.entries(top[s] || {}).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([t, n]) => [fmt(n), D.keyword ? "keyword matches" : `${t}. ${D.topicByNo[t].topic}`]);
        tip.show(e, effSet.has(s) ? [[D.stateNames[s] || f.properties.name, `${REGION_OF[s]}`], [fmt(per[s] || 0), "tags"], [fmt(nTop(s)), "distinct topics"], [fmt1(words[s] ? ((per[s] || 0) / words[s]) * 1e4 : 0), "tags per 10,000 words"], [fmt(words[s] || 0), "words counted"], ...kwPer.map(({ k, per: kp }) => [fmt(kp[s] || 0), `${k.word} keyword matches`]), ...tops, ["", "Click to see its documents"]]
          : [[f.properties.name, s === "MD" ? "no standards file collected" : "not selected"]]);
      };
      onPoint(p, show); p.addEventListener("pointerleave", tip.hide);
      p.addEventListener("focus", (e) => { if (!document.activeElement?.matches(":focus-visible")) return; const r = p.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
      p.addEventListener("blur", tip.hide);
      p.addEventListener("click", () => { if (s) location.hash = `#/docs/${s}`; });
      return p;
    });
    // DC is too small to see: add a marker beside it
    const dc = features.find((f) => f.properties.name === "District of Columbia");
    const extra = [];
    if (dc) {
      const c = centroid(dc.geometry);
      const cls = effSet.has("DC") ? b.cls(val("DC")) : "q0 off";
      const m = svg("circle", { cx: c[0] + 28, cy: c[1] + 18, r: 7, class: `st ${cls}` });
      onPoint(m, (e) => tip.show(e, [[D.stateNames.DC, REGION_OF.DC], [fmt(per.DC || 0), "tags"], [fmt(nTop("DC")), "distinct topics"], [fmt1(val("DC")), unit]]));
      m.addEventListener("pointerleave", tip.hide);
      extra.push(svg("line", { x1: c[0], y1: c[1], x2: c[0] + 28, y2: c[1] + 18, class: "leader" }), m, svg("text", { x: c[0] + 38, y: c[1] + 22, class: "map-lab" }, "DC"));
    }
    mapBox.replaceChildren(svg("svg", { viewBox: "-60 0 1040 620", role: "img", "aria-label": "Map of states colored by immigration-topic tags" }, paths, extra));
    const f = opt.mapMeasure === "rate" ? fmt1 : (x) => fmt(Math.round(x));
    mapLegend.replaceChildren(legendBins(b, f, opt.mapScale === "quantile" ? "Five equal-size groups of states" : opt.mapScale === "log" ? "Log scale" : ""));
    mapTable.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, ["State", "Region", "Tags", "Distinct topics", "Words", "Per 10,000 words", ...kwPer.map(({ k }) => `${k.word} words`)].map((x, i) => h("th", { class: i > 1 ? "num" : null }, x)))),
      h("tbody", {}, eff.slice().sort((a, c) => val(c) - val(a)).map((s) => h("tr", {}, h("td", {}, `${s} · ${D.stateNames[s]}`), h("td", {}, REGION_OF[s]), h("td", { class: "num" }, fmt(per[s] || 0)), h("td", { class: "num" }, fmt(nTop(s))), h("td", { class: "num" }, fmt(words[s])), h("td", { class: "num" }, fmt1(((per[s] || 0) / words[s]) * 1e4)), kwPer.map(({ per: kp }) => h("td", { class: "num" }, fmt(kp[s] || 0))))))));
  }

  // ----- matrix: distribution of topic mentions -----
  function drawMatrix(keep, eff, words) {
    const selTopics = D.topics.filter((t) => (D.keyword || AF.topics.has(t.no)) && topicOn(t.no));
    const useTopics = opt.mtxCols === "topics";
    const cols = useTopics ? selTopics.map((t) => ({ key: t.no, label: String(t.no), title: `${t.no}. ${t.topic}` }))
      : D.eras.map((e, i) => ({ key: i, label: e.replace(/\s*\(.*\)/, ""), title: e })).filter((c) => selTopics.some((t) => D.eraOfTopic[t.no] === c.key));
    const cell = {}, rowTot = {}, cellTopics = {};
    for (const i of keep) {
      const s = D.states[D.tags.st[i]], k = useTopics ? D.tags.t[i] : D.eraOfTopic[D.tags.t[i]];
      cell[`${s}|${k}`] = (cell[`${s}|${k}`] || 0) + 1; rowTot[s] = (rowTot[s] || 0) + 1;
      (cellTopics[`${s}|${k}`] ||= new Set()).add(D.tags.t[i]);
    }
    const rowsOrder = REGION_NAMES.flatMap((r) => eff.filter((s) => REGION_OF[s] === r));
    const value = (s, k) => { const n = cell[`${s}|${k}`] || 0; return opt.mtxValue === "share" ? (rowTot[s] ? (n / rowTot[s]) * 100 : 0) : opt.mtxValue === "rate" ? (n / words[s]) * 1e4 : opt.mtxValue === "distinct" ? cellTopics[`${s}|${k}`]?.size || 0 : n; };
    const b = bins(rowsOrder.flatMap((s) => cols.map((c) => value(s, c.key))), "linear");
    const fv = opt.mtxValue === "share" ? (x) => `${x.toFixed(x >= 10 ? 0 : 1)}%` : opt.mtxValue === "rate" ? fmt1 : (x) => fmt(Math.round(x));
    const table = h("table", { class: "mtx" },
      h("thead", {}, h("tr", {}, h("th", {}, "State"), cols.map((c) => h("th", { title: c.title, class: useTopics ? "rot" : "" }, h("span", {}, c.label))))),
      h("tbody", {}, rowsOrder.flatMap((s, ri) => [ri === 0 || REGION_OF[rowsOrder[ri - 1]] !== REGION_OF[s] ? h("tr", { class: "region-row" }, h("th", { colspan: String(cols.length + 1) }, REGION_OF[s])) : null,
        h("tr", {},
        h("th", { title: D.stateNames[s] }, s),
        cols.map((c) => {
          const v = value(s, c.key), n = cell[`${s}|${c.key}`] || 0;
          const td = h("td", { class: b.cls(v), tabindex: "-1" }, n ? fv(v) : "");
          onPoint(td, (e) => tip.show(e, [[fv(v), opt.mtxValue === "share" ? `of ${D.stateNames[s]}'s tags` : opt.mtxValue === "rate" ? "per 10,000 words" : opt.mtxValue === "distinct" ? "distinct topics" : "tags"], [fmt(n), "tags"], [c.title, D.stateNames[s]]]));
          td.addEventListener("pointerleave", tip.hide);
          return td;
        }))]).filter(Boolean)));
    mtxBox.replaceChildren(table, legendBins(b, fv, opt.mtxValue === "share" ? "Each row adds up to 100%" : ""));
  }

  // ----- line graph over grade bands (K-2, 3-5, 6-8, 9-12), or over single grades (band values then go in its table) -----
  function drawLine(keep, byStateGrade, eff) {
    let series;
    if (opt.lineBy === "region") series = REGION_NAMES.filter((r) => AF.regions.has(r)).map((r) => ({ name: r, states: eff.filter((s) => REGION_OF[s] === r) })).filter((x) => x.states.length);
    else if (opt.lineBy === "state") {
      if (!opt.compare.size) eff.slice(0, 4).forEach((s) => opt.compare.add(s));
      series = [...opt.compare].filter((s) => eff.includes(s)).slice(0, 8).map((s) => ({ name: s, label: `${s} · ${D.stateNames[s]}`, states: [s] }));
    } else series = [{ name: "Selected states", states: eff }];
    if (opt.lineBy === "state") {
      compareWrap.replaceChildren(multiSelect({ id: "cmp-states", label: "Compare states", noun: "states", max: 8, selected: opt.compare, onChange: () => draw(),
        groups: REGION_NAMES.map((r) => ({ name: r, items: eff.filter((s) => REGION_OF[s] === r).map((s) => ({ value: s, label: `${s} · ${D.stateNames[s]}` })) })).filter((g) => g.items.length) }));
    } else compareWrap.replaceChildren();
    let cnt = {}, tset = {};
    for (const i of keep) { const k = `${D.states[D.tags.st[i]]}|${D.grades[D.tags.g[i]]}`; cnt[k] = (cnt[k] || 0) + 1; (tset[k] ||= new Set()).add(D.tags.t[i]); }
    const present = [...new Set(Object.keys(byStateGrade).filter((k) => eff.includes(k.split("|")[0])).map((k) => k.split("|")[1]))];
    const byBand = opt.lineGrades === "bands";
    let singles, words = byStateGrade;
    if (byBand) {
      // every grade group goes to the bands its grades fall in; one that crosses bands (e.g. 4-6) is split by its share of
      // grades in each (its words and tags, so its rate is kept), and its topics count in each band it reaches
      const share = (g) => { const sp = gSpan(g), o = {}; sp.forEach((p) => { const b = LINE_BANDS.findIndex((x) => x.pos.includes(p)); if (b >= 0) o[b] = (o[b] || 0) + 1 / sp.length; }); return o; };
      const c2 = {}, w2 = {}, t2 = {};
      for (const k of Object.keys(byStateGrade)) {
        const [s, g] = k.split("|");
        for (const [b, f] of Object.entries(share(g))) {
          const k2 = `${s}|${LINE_BANDS[b].g}`;
          w2[k2] = (w2[k2] || 0) + byStateGrade[k] * f; c2[k2] = (c2[k2] || 0) + (cnt[k] || 0) * f;
          if (tset[k]) for (const t of tset[k]) (t2[k2] ||= new Set()).add(t);
        }
      }
      words = w2; cnt = c2; tset = t2;
      singles = LINE_BANDS.map((x) => x.g).filter((g) => eff.some((s) => words[`${s}|${g}`] > 0));
    } else singles = present.filter((g) => !gIsBand(g)).sort((a, b) => gSortKey(a) - gSortKey(b));
    const point = (S, g) => {
      const withText = S.states.filter((s) => words[`${s}|${g}`] > 0);
      if (!withText.length) return null;
      const n = withText.map((s) => cnt[`${s}|${g}`] || 0), w = withText.map((s) => words[`${s}|${g}`]);
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      if (opt.lineMeasure === "distinct") {
        const sets = withText.map((s) => tset[`${s}|${g}`] || new Set());
        const v = opt.lineAgg === "avg" ? sum(sets.map((x) => x.size)) / sets.length : new Set(sets.flatMap((x) => [...x])).size;
        return { v, states: withText.length, tags: Math.round(sum(n)) };
      }
      const v = opt.lineMeasure === "count" ? (opt.lineAgg === "avg" ? sum(n) / n.length : sum(n))
        : opt.lineAgg === "avg" ? sum(n.map((x, i) => (x / w[i]) * 1e4)) / n.length : (sum(n) / sum(w)) * 1e4;
      return { v, states: withText.length, tags: Math.round(sum(n)) };
    };
    const data = series.map((S, si) => ({ ...S, si, color: `var(--viz-${(si % 8) + 1})`, cls: `s${(si % 8) + 1}`, pts: singles.map((g) => point(S, g)) }));
    // bands present in at least one series
    const bands = byBand ? [] : present.filter(gIsBand).sort((a, b) => gSortKey(a) - gSortKey(b)).filter((g) => data.some((d) => point(d, g)));
    data.forEach((d) => (d.bpts = bands.map((g) => point(d, g))));
    const meas = opt.lineMeasure === "count" ? (opt.lineAgg === "avg" ? "tags per state (average)" : "tags (total)")
      : opt.lineMeasure === "distinct" ? (opt.lineAgg === "avg" ? "distinct topics per state (average)" : "distinct topics (all states together)")
      : (opt.lineAgg === "avg" ? "per 10,000 words (state average)" : "per 10,000 words (pooled)");
    const yMax = 1.1 * Math.max(1e-9, ...data.flatMap((d) => d.pts.filter(Boolean).map((p) => p.v)));   // axis ends 10% above the highest point
    const tipRows = (title, key, i) => [[title, meas], ...data.map((d) => { const q = d[key][i]; return [q ? fmt1(q.v) : "—", q ? `${d.label || d.name} · ${fmt(q.tags)} tags, ${q.states} state${q.states > 1 ? "s" : ""}` : `${d.label || d.name} · no text`, d.color]; })];

    // line chart
    // states in these lines that wrote a grade only inside a band (e.g. 3-5): they are not in that grade's point
    const lineStates = [...new Set(data.flatMap((d) => d.states))];
    const bandOnly = singles.map((gr) => byBand ? [] : lineStates.filter((s) => !(byStateGrade[`${s}|${gr}`] > 0)
      && Object.keys(byStateGrade).some((k) => { const [s2, g2] = k.split("|"); return s2 === s && gIsBand(g2) && byStateGrade[k] > 0 && gSpan(g2).includes(gPos(gr)); })));
    const W = 1000, H = 384, L = 76, R = 130, T = 16, Bm = 68;
    const xs = (i) => L + (singles.length > 1 ? (i * (W - R - L)) / (singles.length - 1) : (W - R - L) / 2);
    const ys = (v) => T + (H - T - Bm) * (1 - v / yMax);
    const g = [];
    for (const [k, v] of niceTicks(yMax).entries()) {
      g.push(svg("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: k ? "grid" : "axis" }), svg("text", { x: L - 8, y: ys(v) + 4, class: "tick", "text-anchor": "end" }, fmt1(v)));
    }
    singles.forEach((gr, i) => g.push(svg("text", { x: xs(i), y: H - Bm + 18, class: "tick", "text-anchor": "middle" }, gLabel(gr))));
    if (bandOnly.some((x) => x.length)) {
      g.push(svg("text", { x: L - 8, y: H - Bm + 38, class: "tick band-only", "text-anchor": "end" }, "band only"));
      bandOnly.forEach((x, i) => x.length && g.push(svg("text", { x: xs(i), y: H - Bm + 38, class: "tick band-only", "text-anchor": "middle" }, `+${x.length}`)));
    }
    g.push(svg("text", { x: (L + W - R) / 2, y: H - 6, class: "axis-title", "text-anchor": "middle" }, byBand ? "Grade band (single grades and the state's own bands together)" : "Grade (text written for that grade only)"));
    const marks = [], labels = [];
    for (const d of data) {
      let dstr = "", pen = false;
      d.pts.forEach((p, i) => { if (p) { dstr += `${pen ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.v).toFixed(1)}`; pen = true; } else pen = false; });
      marks.push(svg("path", { d: dstr, class: `ln ${d.cls}` }));
      d.pts.forEach((p, i) => p && marks.push(svg("circle", { cx: xs(i), cy: ys(p.v), r: 4, class: `dot ${d.cls}` })));
      const li = d.pts.length - 1 - [...d.pts].reverse().findIndex(Boolean);
      if (data.length > 1 && data.length <= 4 && li < d.pts.length) labels.push({ x: xs(li) + 9, y: ys(d.pts[li].v) + 4, text: d.name });
    }
    labels.sort((a, b) => a.y - b.y).forEach((l, i, a) => { if (i && l.y - a[i - 1].y < 15) l.y = a[i - 1].y + 15; });
    labels.forEach((l) => marks.push(svg("text", { x: l.x, y: l.y, class: "end-lab" }, l.text)));
    const cross = svg("line", { class: "cross", y1: T, y2: H - Bm, visibility: "hidden" });
    const hit = svg("rect", { x: L - 20, y: T, width: W - R - L + 40, height: H - T - Bm, class: "hit" });
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": byBand ? "Immigration-topic tags by grade band" : "Immigration-topic tags by single grade" }, g, marks, cross, hit);
    onPoint(hit, (e) => {
      if (!singles.length) return;
      const pt = root.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const x = pt.matrixTransform(root.getScreenCTM().inverse()).x;
      let i = 0; singles.forEach((_, k) => { if (Math.abs(xs(k) - x) < Math.abs(xs(i) - x)) i = k; });
      cross.setAttribute("x1", xs(i)); cross.setAttribute("x2", xs(i)); cross.setAttribute("visibility", "visible");
      const bo = bandOnly[i];
      tip.show(e, [...tipRows(`${byBand && gIsBand(singles[i]) ? "Grades" : "Grade"} ${gLabel(singles[i])}`, "pts", i), ...(bo.length ? [[`${bo.length} state${bo.length > 1 ? "s" : ""}`, `not in this point: grade ${gLabel(singles[i])} only inside a band (${bo.slice(0, 8).join(", ")}${bo.length > 8 ? "…" : ""})`]] : [])]);
    });
    hit.addEventListener("pointerleave", (e) => { cross.setAttribute("visibility", "hidden"); tip.hide(e); });
    lineBox.replaceChildren(singles.length ? root : h("p", { class: "muted" }, byBand ? "No text in the selected states." : "No text written for single grades in the selected states."));

    lineLegend.replaceChildren(h("div", { class: "legend" }, data.length > 1 ? data.map((d) => h("span", { class: "lg" }, h("i", { class: `lk ${d.cls}` }), d.label || d.name)) : h("span", { class: "muted" }, `${eff.length} states combined`),
      opt.lineBy === "state" && eff.length > 8 ? h("span", { class: "muted" }, "Up to 8 states at a time") : null));
    lineTable.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, h("th", {}, "Series"), [...singles, ...bands].map((gr) => h("th", { class: "num" }, gLabel(gr))))),
      h("tbody", {}, data.map((d) => h("tr", {}, h("td", {}, d.label || d.name), [...d.pts, ...d.bpts].map((q) => h("td", { class: "num" }, q ? fmt1(q.v) : "—")))))));
  }

  // ----- per-state charts: one per state, every grade and band as the state wrote it -----
  /** For each "state|grade group": tags, distinct topics (Set) and words, from tag indices keep (all grades). */
  function gradeStats(keep, byStateGrade) {
    const cnt = {}, tset = {};
    for (const i of keep) { const k = `${D.states[D.tags.st[i]]}|${D.grades[D.tags.g[i]]}`; cnt[k] = (cnt[k] || 0) + 1; (tset[k] ||= new Set()).add(D.tags.t[i]); }
    return { cnt, tset, words: byStateGrade };
  }
  /** The single grades a band covers that the same row (state) also wrote text for on their own: "overlap". */
  const bandOverlap = (words, r, g) => gSpan(g).filter((p) => Object.keys(words).some((k) => { const [r2, g2] = k.split("|"); return r2 === r && !gIsBand(g2) && words[k] > 0 && gPos(g2) === p; }));
  const overlapNote = (words, r, g) => { const o = bandOverlap(words, r, g); return o.length ? [["", `overlaps grade${o.length > 1 ? "s" : ""} ${o.map((p) => AXIS_GRADES[p]).join(", ")}, also written on ${o.length > 1 ? "their" : "its"} own: those grades are counted in both`]] : []; };
  const smVal = (G, k, m) => (m === "rate" ? (G.words[k] ? ((G.cnt[k] || 0) / G.words[k]) * 1e4 : 0) : m === "distinct" ? G.tset[k]?.size || 0 : G.cnt[k] || 0);
  const smUnit = { count: "tags", rate: "tags per 10,000 words", distinct: "distinct topics" };
  /** One state's grades: x = grade (Pre-K..12); a single grade is a point; a band is a point at each grade it covers, at
      the band's value, joined by a line. Point color = value relative to the state's own highest value. */
  function statePanel(s, G, m, { w = 330, h: H = 150, yMax = null, big = false } = {}) {
    const groups = D.grades.filter((g) => G.words[`${s}|${g}`] > 0).sort((a, b) => gSpan(b).length - gSpan(a).length || gSortKey(a) - gSortKey(b));
    const vals = groups.map((g) => smVal(G, `${s}|${g}`, m));
    const top = Math.max(1e-9, ...vals);
    const ymax = yMax || 1.1 * top;
    const b = bins(vals, "linear");
    const L = big ? 52 : 34, R = 10, T = 10, Bm = big ? 30 : 22;
    const xs = (p) => L + (p * (w - L - R)) / 13, ys = (v) => T + (H - T - Bm) * (1 - Math.min(v, ymax) / ymax);
    const out = [];
    for (const [k, v] of niceTicks(ymax).entries()) if (big || k === 0 || v === niceTicks(ymax).at(-1)) out.push(svg("line", { x1: L, x2: w - R, y1: ys(v), y2: ys(v), class: k ? "grid" : "axis" }), svg("text", { x: L - 5, y: ys(v) + 4, class: "tick", "text-anchor": "end" }, fmt1(v)));
    AXIS_GRADES.forEach((lab, p) => (big || p % 2 === 1 || p === 0) && out.push(svg("text", { x: xs(p), y: H - Bm + (big ? 18 : 14), class: "tick", "text-anchor": "middle" }, big ? lab : lab.replace("Pre-K", "PK"))));
    groups.forEach((g, gi) => {
      const k = `${s}|${g}`, v = vals[gi], span = gSpan(g), band = span.length > 1;
      const grp = svg("g", { class: `smg${band ? " band" : ""}`, tabindex: big ? "0" : null });
      if (band) grp.append(svg("path", { d: span.map((p, j) => `${j ? "L" : "M"}${xs(p).toFixed(1)},${ys(v).toFixed(1)}`).join(""), class: "band-ln" }));
      span.forEach((p) => grp.append(svg("circle", { cx: xs(p), cy: ys(v), r: big ? (band ? 5 : 6) : band ? 3.2 : 4, class: `smdot ${b.cls(v)}` })));
      const show = (e) => tip.show(e, [[band ? `Band ${gLabel(g)}` : `Grade ${gLabel(g)}`, D.stateNames[s]], [fmt(G.cnt[k] || 0), "tags"], [fmt(G.tset[k]?.size || 0), "distinct topics"],
        [fmt1(smVal(G, k, "rate")), "tags per 10,000 words"], [fmt(G.words[k]), "words of standards"],
        [`${Math.round((v / top) * 100)}%`, `of ${s}'s highest grade group (${smUnit[m]})`], ...(band ? [["", "one value for the whole band, not split into grades"], ...overlapNote(G.words, s, g)] : [])]);
      onPoint(grp, show); grp.addEventListener("pointerleave", tip.hide);
      grp.addEventListener("focus", (e) => { if (!document.activeElement?.matches(":focus-visible")) return; if (!document.activeElement?.matches(":focus-visible")) return; const r = grp.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top }); }); grp.addEventListener("blur", tip.hide);
      out.push(grp);
    });
    return svg("svg", { viewBox: `0 0 ${w} ${H}`, role: "img", "aria-label": `${D.stateNames[s]}: ${smUnit[m]} by grade and band` }, out);
  }
  /** One chart: a row per state (or region), grades Pre-K..12 across. A single grade is a dot; a band is a dot at each
      grade it covers joined by a line, on its own lane under the row's single grades. Dot color = value relative to the
      row's own highest grade group. */
  function drawStates(keep, byStateGrade, eff) {
    const G0 = gradeStats(keep, byStateGrade), m = opt.smMeasure;
    let G = G0, rows;
    if (opt.smRows === "regions") {   // add up the states of each region, grade group by grade group
      const cnt = {}, tset = {}, words = {};
      for (const [k, w] of Object.entries(byStateGrade)) {
        const [st, g] = k.split("|");
        if (!eff.includes(st)) continue;
        const rk = `${REGION_OF[st]}|${g}`;
        words[rk] = (words[rk] || 0) + w; cnt[rk] = (cnt[rk] || 0) + (G0.cnt[k] || 0);
        for (const t of G0.tset[k] || []) (tset[rk] ||= new Set()).add(t);
      }
      G = { cnt, tset, words };
      rows = REGION_NAMES.filter((r) => eff.some((st) => REGION_OF[st] === r)).map((r) => ({ key: r, label: r, sub: `${eff.filter((st) => REGION_OF[st] === r).length} states` }));
    } else {
      const order = opt.smRows === "byRegion" ? REGION_NAMES.flatMap((r) => eff.filter((st) => REGION_OF[st] === r)) : eff;
      rows = order.map((st, i) => ({ key: st, label: `${st} · ${D.stateNames[st]}`, state: st, head: opt.smRows === "byRegion" && (i === 0 || REGION_OF[order[i - 1]] !== REGION_OF[st]) ? REGION_OF[st] : null }));
    }
    const W = 1000, L = 190, R = 24, TOP = 26, LANE = 9, PAD = 7, HEAD = 22;
    const xs = (p) => L + 12 + (p * (W - L - R - 24)) / 13;
    // lay out each row: lane 0 = single grades, bands packed into lanes 1, 2, ... without overlapping
    let y = TOP;
    const laid = rows.map((row) => {
      const groups = D.grades.filter((g) => G.words[`${row.key}|${g}`] > 0);
      const lanes = [];
      const place = groups.filter(gIsBand).sort((a, b) => gSpan(a)[0] - gSpan(b)[0] || gSpan(b).length - gSpan(a).length).map((g) => {
        const sp = gSpan(g);
        let li = lanes.findIndex((end) => end < sp[0]);
        if (li < 0) { lanes.push(-1); li = lanes.length - 1; }
        lanes[li] = sp[sp.length - 1];
        return [g, li + 1];
      });
      const hasSingles = groups.some((g) => !gIsBand(g));
      const nLanes = (hasSingles ? 1 : 0) + lanes.length;
      const head = row.head ? (y += HEAD, y - HEAD) : null;
      const top = y, hgt = Math.max(1, nLanes) * LANE + 2 * PAD;
      y += hgt;
      const laneY = (li) => top + PAD + LANE / 2 + (hasSingles ? li : li - 1) * LANE;
      return { row, groups, place: [...groups.filter((g) => !gIsBand(g)).map((g) => [g, 0]), ...place], top, hgt, laneY, head };
    });
    const H = y + 26;
    const out = [];
    AXIS_GRADES.forEach((lab, p) => {
      out.push(svg("line", { x1: xs(p), x2: xs(p), y1: TOP - 4, y2: y, class: "grid" }));
      out.push(svg("text", { x: xs(p), y: TOP - 10, class: "tick", "text-anchor": "middle" }, lab), svg("text", { x: xs(p), y: y + 16, class: "tick", "text-anchor": "middle" }, lab));
    });
    laid.forEach(({ row, groups, place, top, hgt, laneY, head }, ri) => {
      if (head != null) out.push(svg("text", { x: 4, y: head + 15, class: "row-head" }, row.head));
      out.push(svg("rect", { x: 0, y: top, width: W, height: hgt, class: `row-bg${ri % 2 ? " odd" : ""}` }));
      const lab = svg("text", { x: L - 8, y: top + hgt / 2 + 4, class: `row-lab${row.state ? " link" : ""}`, "text-anchor": "end" }, row.label);
      if (row.state) {
        lab.setAttribute("tabindex", "0");
        const open = () => { opt.profile = row.state; store.set("profile", row.state); drawProfile(eff); profBox.closest(".card").scrollIntoView({ block: "start" }); };
        lab.addEventListener("click", open); lab.addEventListener("keydown", (e) => e.key === "Enter" && open());
      }
      out.push(lab);
      const vals = groups.map((g) => smVal(G, `${row.key}|${g}`, m));
      const top1 = Math.max(1e-9, ...vals), b = bins(vals, "linear");
      for (const [g, li] of place) {
        const k = `${row.key}|${g}`, v = smVal(G, k, m), span = gSpan(g), band = span.length > 1, cy = laneY(li);
        const grp = svg("g", { class: `smg${band ? " band" : ""}`, tabindex: "0" });
        if (band) grp.append(svg("path", { d: `M${xs(span[0])},${cy}L${xs(span[span.length - 1])},${cy}`, class: "band-ln" }));
        span.forEach((p) => grp.append(svg("circle", { cx: xs(p), cy, r: band ? 3.6 : 4.6, class: `smdot ${b.cls(v)}` })));
        const show = (e) => tip.show(e, [[band ? `Band ${gLabel(g)}` : `Grade ${gLabel(g)}`, row.label], [fmt(G.cnt[k] || 0), "tags"], [fmt(G.tset[k]?.size || 0), "distinct topics"],
          [fmt1(smVal(G, k, "rate")), "tags per 10,000 words"], [fmt(G.words[k]), "words of standards"],
          [`${Math.round((v / top1) * 100)}%`, `of the row's highest grade group (${smUnit[m]})`], ...(band ? [["", "one value for the whole band, not split into grades"], ...(row.state ? overlapNote(G.words, row.key, g) : [])] : [])]);
        onPoint(grp, show); grp.addEventListener("pointerleave", tip.hide);
        grp.addEventListener("focus", () => { if (!document.activeElement?.matches(":focus-visible")) return; const r = grp.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top }); }); grp.addEventListener("blur", tip.hide);
        out.push(grp);
      }
    });
    smBox.replaceChildren(rows.length ? svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${smUnit[m]} by grade and band for each ${opt.smRows === "regions" ? "region" : "state"}` }, out)
      : h("p", { class: "muted" }, "No states with text under these filters."));
  }

  // ----- one state's summary -----
  function drawProfile(eff) {
    const s = opt.profile && D.states.includes(opt.profile) ? opt.profile : eff[0];
    if (!s) { profBox.replaceChildren(h("p", { class: "muted" }, "No state selected.")); return; }
    const si = D.states.indexOf(s);
    const keepAll = filteredTags(D, { ignoreGrade: true, ignoreStates: true });
    const mine = keepAll.filter((i) => D.tags.st[i] === si);
    const W = wordTotals(D, { ignoreGrade: true, ignoreStates: true });
    const G = gradeStats(mine, W.byStateGrade);
    const words = W.byState[s] || 0, rate = words ? (mine.length / words) * 1e4 : 0;
    // compare with the selected states (and this one)
    const peers = [...new Set([...eff, s])].filter((x) => W.byState[x] > 0);
    const per = {}; for (const i of keepAll) { const x = D.states[D.tags.st[i]]; per[x] = (per[x] || 0) + 1; }
    const rates = peers.map((x) => [x, ((per[x] || 0) / W.byState[x]) * 1e4]).sort((a, b) => b[1] - a[1]);
    const rank = rates.findIndex(([x]) => x === s) + 1;
    const avgRate = rates.reduce((a, [, r]) => a + r, 0) / Math.max(1, rates.length);
    const byTopic = {}; for (const i of mine) byTopic[D.tags.t[i]] = (byTopic[D.tags.t[i]] || 0) + 1;
    const topics = Object.entries(byTopic).sort((a, b) => b[1] - a[1]);
    const groups = D.grades.filter((g) => W.byStateGrade[`${s}|${g}`] > 0).sort((a, b) => gSortKey(a) - gSortKey(b));
    const bandWords = groups.filter(gIsBand).reduce((a, g) => a + W.byStateGrade[`${s}|${g}`], 0);
    const overBands = groups.filter((g) => gIsBand(g) && bandOverlap(W.byStateGrade, s, g).length);   // bands over grades also written singly
    const overWords = overBands.reduce((a, g) => a + W.byStateGrade[`${s}|${g}`], 0);
    const kwN = D.keyword ? [] : KL.map(({ k, D: K }) => ({ k, n: filteredTags(K, { ignoreGrade: true, ignoreStates: true }).filter((i) => K.tags.st[i] === si).length }));
    const files = idx.states[s]?.files || [];
    const tile = (v, l, sub) => h("div", { class: "tile" }, h("b", {}, v), h("span", {}, l), sub ? h("span", { class: "muted small" }, sub) : null);
    const picker = h("select", { id: "prof-st", "aria-label": "State" }, D.states.filter((x) => W.byState[x] > 0).map((x) => h("option", { value: x }, `${x} · ${D.stateNames[x]}`)));
    picker.value = s;
    picker.addEventListener("change", () => { opt.profile = picker.value; store.set("profile", opt.profile); drawProfile(eff); });
    // eras: this state's share against the selected states'
    const eraN = {}, eraAll = {};
    for (const i of mine) eraN[D.eraOfTopic[D.tags.t[i]]] = (eraN[D.eraOfTopic[D.tags.t[i]]] || 0) + 1;
    const peerSet = new Set(peers.map((x) => D.states.indexOf(x)));
    let peerN = 0;
    for (const i of keepAll) if (peerSet.has(D.tags.st[i])) { eraAll[D.eraOfTopic[D.tags.t[i]]] = (eraAll[D.eraOfTopic[D.tags.t[i]]] || 0) + 1; peerN++; }
    const pct = (a, b) => (b ? (a / b) * 100 : 0);
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    const topTopic = (g) => { const c = {}; for (const i of mine) if (D.grades[D.tags.g[i]] === g) c[D.tags.t[i]] = (c[D.tags.t[i]] || 0) + 1; const t = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return t ? `${topicNo(+t[0])}. ${D.topicByNo[t[0]].topic} (${t[1]})` : "—"; };
    profBox.replaceChildren(
      h("div", { class: "card-tools" }, h("label", { for: "prof-st" }, "State"), picker, h("a", { href: `#/docs/${s}` }, "Documents"), h("span", { class: "muted small" }, "All grades and bands; the other filters above apply.")),
      h("div", { class: "tiles" },
        tile(fmt(words), "words of standards", `${files.filter((f) => f.status === "use").length} documents used`),
        tile(fmt(mine.length), "tags", `${fmt1(rate)} per 10,000 words`),
        tile(`${rank} of ${rates.length}`, "rank, tags per 10,000 words", `selected states average ${fmt1(avgRate)}`),
        D.keyword ? null : tile(`${topics.length}`, "distinct topics", `of ${D.topics.filter((t) => topicOn(t.no)).length} counted`),
        kwN.map(({ k, n }) => tile(fmt(n), `${k.word} keyword matches`, `${words ? fmt1((n / words) * 1e4) : "—"} per 10,000 words`)),
        tile(`${Math.round(pct(bandWords, words))}%`, "of its words written for bands", `${plural(groups.filter((g) => !gIsBand(g)).length, "single grade")}, ${plural(groups.filter(gIsBand).length, "band")}`),
        tile(`${Math.round(pct(overWords, words))}%`, "of its words in bands that overlap its single grades", overBands.length ? `${overBands.map(gLabel).join(", ")}: those grades are counted twice` : "no grade is counted twice")),
      h("div", { class: "viz-line sm-big" }, statePanel(s, G, opt.smMeasure, { w: 1000, h: 300, big: true })),
      h("div", { class: "two-col prof-cols" },
        D.keyword ? null : h("section", {}, h("h3", {}, "Top topics"), topics.length ? h("ol", { class: "topic-list prof-top" }, topics.slice(0, 10).map(([t, n]) => h("li", {},
          h("a", { class: "tl-name", href: topicHref(+t) }, h("span", { class: "tl-no mono" }, `${t}.`), h("span", {}, D.topicByNo[t].topic)),
          h("span", { class: "tl-bar", "aria-hidden": "true" }, h("i", { style: `width:${(n / topics[0][1]) * 100}%` })),
          h("span", { class: "tl-n mono" }, fmt(n)), h("span", { class: "tl-s muted" }, `${Math.round(pct(n, mine.length))}%`)))) : h("p", { class: "muted" }, "No tags.")),
        D.keyword ? null : h("section", {}, h("h3", {}, "Eras: share of the state's tags"), h("p", { class: "muted small" }, "Bar: this state. Tick: all selected states together."),
          h("ul", { class: "era-bars" }, D.eras.map((e, i) => h("li", {}, h("span", {}, e), h("span", { class: "eb", title: `${Math.round(pct(eraN[i] || 0, mine.length))}% here, ${Math.round(pct(eraAll[i] || 0, peerN))}% in the selected states` },
            h("i", { style: `width:${pct(eraN[i] || 0, mine.length)}%` }), h("b", { style: `left:${pct(eraAll[i] || 0, peerN)}%` })), h("span", { class: "mono small" }, `${Math.round(pct(eraN[i] || 0, mine.length))}%`)))))),
      h("h3", {}, "By grade and band"),
      h("div", { class: "table-wrap" }, h("table", { class: "ledger" },
        h("thead", {}, h("tr", {}, ["Grades", "Words", "Tags", "Per 10,000 words", "Distinct topics", D.keyword ? null : "Top topic"].filter(Boolean).map((x, i) => h("th", { class: i && i < 5 ? "num" : null }, x)))),
        h("tbody", {}, groups.map((g) => { const k = `${s}|${g}`; return h("tr", {}, h("td", {}, gIsBand(g) ? `${gLabel(g)} (band)` : `Grade ${gLabel(g)}`), h("td", { class: "num" }, fmt(W.byStateGrade[k])),
          h("td", { class: "num" }, fmt(G.cnt[k] || 0)), h("td", { class: "num" }, fmt1(smVal(G, k, "rate"))), h("td", { class: "num" }, fmt(G.tset[k]?.size || 0)), D.keyword ? null : h("td", {}, topTopic(g))); })))));
  }

  setMain(h("div", { class: "page wide" },
    h("div", {}, h("p", { class: "eyebrow" }, "Data visualization"), h("h1", {}, "Immigration topics across states and grades")),
    h("p", { class: "lede" }, D.keyword
      ? `Standards text only, without K–12 anchor and overview text. Counting the separate ${D.keyword.topic}: ${D.keyword.rule} is one tag, apart from the 106 topics.`
        + " Each sentence is counted once per state, at the grades the state's document assigns it: a 4–6 band is never split into grades, and choosing a single grade leaves bands out."
      : "Standards text only, without text written for every grade at once (K–12 anchor standards and overviews) and without a state's umbrella bands (shared skills and overviews for a band such as K–2 whose grades the document also writes one by one); both stay visible in the document reader. A tag is one sentence matched to one topic. Each sentence is counted once per state, at the grades the state's document assigns it: a 4–6 band is never split into grades, and choosing a single grade leaves bands out."),
    gfNote(), filterBar(D, draw, { topics: !D.keyword, score: !D.keyword, extra: srcField }), stat,
    h("nav", { class: "chart-nav", "aria-label": "Charts on this page" }, h("span", { class: "eyebrow" }, "Jump to"),
      [["c-map", "Map"], ["c-mtx", "Heat map"], ["c-line", "By grade"], ["c-bands", "Grades and bands"], ["c-state", "State summary"]].map(([id, l]) =>
        h("a", { href: `#/charts`, onclick: (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: "start" }); } }, l))),
    h("section", { class: "card", id: "c-map" }, h("header", {}, h("h2", {}, "Where immigration topics appear"),
      h("div", { class: "card-tools" }, h("label", { for: "map-m" }, "Measure"), sel("map-m", [["rate", "Tags per 10,000 words"], ["count", "Tags (count)"], ["distinct", "Distinct topics"]], "mapMeasure"),
        h("label", { for: "map-s" }, "Scale"), sel("map-s", [["linear", "Linear"], ["log", "Log"], ["quantile", "Categories (quintiles)"]], "mapScale"), tableBtn(mapTable))),
      mapBox, mapLegend, mapTable),
    h("section", { class: "card", id: "c-mtx" }, h("header", {}, h("h2", {}, "Which topics each state emphasizes"),
      h("div", { class: "card-tools" }, h("label", { for: "mtx-v" }, "Value"), sel("mtx-v", [["share", "Share of the state's tags"], ["rate", "Tags per 10,000 words"], ["count", "Tags (count)"], ["distinct", "Distinct topics"]], "mtxValue"),
        h("label", { for: "mtx-c" }, "Columns"), sel("mtx-c", [["eras", "Eras"], ["topics", "Topics (selected)"]], "mtxCols"))),
      mtxBox),
    h("section", { class: "card", id: "c-line" }, h("header", {}, h("h2", {}, "Immigration topics by grade"),
      h("div", { class: "card-tools" }, h("label", { for: "ln-g" }, "Grades"), sel("ln-g", [["bands", "Bands (K–2, 3–5, 6–8, 9–12)"], ["singles", "Single grades"]], "lineGrades"),
        h("label", { for: "ln-m" }, "Measure"), sel("ln-m", [["count", "Tags (count)"], ["rate", "Tags per 10,000 words"], ["distinct", "Distinct topics"]], "lineMeasure"),
        h("label", { for: "ln-a" }, "Combine states"), sel("ln-a", [["avg", "Average per state"], ["sum", "Total (raw numbers)"]], "lineAgg"),
        h("label", { for: "ln-b" }, "Lines"), sel("ln-b", [["combined", "All selected states"], ["region", "By region"], ["state", "By state"]], "lineBy"), tableBtn(lineTable))),
      compareWrap, lineLegend, lineBox, lineTable,
      h("p", { class: "muted small" }, "Bands view: every state's text is in its band, whether the state wrote single grades or its own bands; a band of its own that crosses two of these (for example 4–6) is split between them by its share of grades. Pre-K text is left out of this view. Single grades view: only text written for a single grade is in these lines. “band only +N”: N of the states wrote that grade only inside a band (for example 3–5), so they are missing from that point; see each state below. The grade filter above does not apply: every grade is shown. A line skips a grade where none of its states has text written for that grade.")),
    h("section", { class: "card", id: "c-bands" }, h("header", {}, h("h2", {}, "Grades and bands by state"),
      h("div", { class: "card-tools" }, h("label", { for: "sm-m" }, "Measure"), sel("sm-m", [["count", "Tags (count)"], ["rate", "Tags per 10,000 words"], ["distinct", "Distinct topics"]], "smMeasure"),
        h("label", { for: "sm-r" }, "Rows"), sel("sm-r", [["states", "States"], ["byRegion", "States, grouped by region"], ["regions", "Regions (states added up)"]], "smRows"))),
      h("p", { class: "muted small" }, "A row per selected state (or region), grades across. A dot is text written for a single grade; a band (for example K–2 or 9–12) is a line with a dot at each grade it covers, on its own lane under the row's single grades. Where a state wrote text for single grades and also for a band over them (for example Grade 1 and K–2), both are shown as written, so that grade appears twice; the band's hover says which grades it overlaps, and the state summary gives the share of words involved. Darker dots are higher relative to the row's own highest grade group. Hover a dot for its counts; click a state's name for its summary."),
      h("div", { class: "legend" }, h("span", { class: "lg" }, h("i", { class: "sw q0" }), "no tags"), [1, 3, 5, 7].map((q, i) => h("span", { class: "lg" }, h("i", { class: `sw q${q}` }), ["low", "", "", "highest in the row"][i])), h("span", { class: "lg" }, h("i", { class: "lk band-key" }), "band")),
      smBox),
    h("section", { class: "card", id: "c-state" }, h("header", {}, h("h2", {}, "State summary")), profBox)));
  draw();
}

// ================= FILTERS TAB (global topic filter) =================
async function filtersPage() {
  const [D, KL, idx] = await Promise.all([loadTopicData(), loadKeywords(), loadIndex()]);
  D.stateNames = Object.fromEntries(Object.entries(idx.states).map(([k, s]) => [k, s.name]));
  initFilters(D);
  // tags per topic in all states and grades, at the current score settings, to help decide
  const count = {};
  for (const i of filteredTags(D, { ignoreTopics: true, ignoreStates: true, ignoreGrade: true, ignoreGlobal: true })) count[D.tags.t[i]] = (count[D.tags.t[i]] || 0) + 1;
  const kwCount = Object.fromEntries(KL.map(({ k, D: K }) => [k.no, filteredTags(K, { ignoreStates: true, ignoreGrade: true, ignoreGlobal: true }).length]));
  const status = h("span", { class: "muted" });
  const boxes = new Map(), eraBoxes = [];
  function sync() {
    const on = D.topics.filter((t) => topicOn(t.no)).length;
    status.textContent = `${on} of ${D.topics.length} topics included${KL.length ? `; keywords: ${KL.map(({ k }) => `${k.word} ${kwOn(k) ? "on" : "off"}`).join(", ")}` : ""}`;
    for (const [no, cb] of boxes) { cb.checked = topicOn(no); cb.closest(".gf-item")?.classList.toggle("off", !cb.checked); }
    for (const [cb, nos] of eraBoxes) { const k = nos.filter(topicOn).length; cb.checked = k === nos.length; cb.indeterminate = k > 0 && k < nos.length; }
  }
  function set(nos, on) {
    for (const no of nos) { if (isKw(no)) on ? GF.kwOff.delete(KW_BY_NO[no].id) : GF.kwOff.add(KW_BY_NO[no].id); else on ? GF.excluded.delete(no) : GF.excluded.add(no); }
    saveGF(); sync();
  }
  const search = h("input", { type: "search", id: "gf-q", placeholder: "Find a topic…" });
  const all = D.topics.map((t) => t.no);
  const item = (no, label, sub, n) => {
    const cb = h("input", { type: "checkbox" });
    cb.addEventListener("change", () => set([no], cb.checked));
    boxes.set(no, cb);
    return h("li", { class: "gf-item", "data-label": `${topicNo(no)}. ${label}`.toLowerCase() },
      h("label", {}, cb, h("span", { class: "tl-no mono" }, topicNo(no)), h("span", {}, label, sub ? h("span", { class: "muted" }, ` · ${sub}`) : null)),
      h("span", { class: "tl-n mono", title: "Tags in the standards text of all states at the current score settings" }, fmt(n)),
      h("button", { type: "button", class: "link", onclick: () => { set(all, false); set([no], true); }, title: "Keep only this topic" }, "only"));
  };
  const eras = D.eras.map((era) => {
    const ts = D.topics.filter((t) => t.era === era), nos = ts.map((t) => t.no);
    const cb = h("input", { type: "checkbox", "aria-label": `All topics of ${era}` });
    cb.addEventListener("change", () => set(nos, cb.checked));
    eraBoxes.push([cb, nos]);
    return h("section", { class: "era gf-era" },
      h("header", {}, h("label", { class: "gf-era-h" }, cb, h("h2", {}, era)), h("span", { class: "muted mono" }, `${ts.length} topics`)),
      h("ul", { class: "gf-list" }, ts.map((t) => item(t.no, t.topic, t.years, count[t.no] || 0))));
  });
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    document.querySelectorAll(".gf-item").forEach((r) => (r.hidden = q && !r.dataset.label.includes(q)));
    document.querySelectorAll(".gf-era").forEach((e) => (e.hidden = !e.querySelector(".gf-item:not([hidden])")));
  });
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Global filter"), h("h1", {}, "Choose which topics count, on every tab")),
    h("p", { class: "lede" }, "A topic you uncheck here is left out everywhere: the Topics list, the Charts (map, heat map, grade charts and their totals), and the tags in the document viewer. The choice is saved in this browser."),
    h("div", { class: "filters filterbar" },
      h("div", { class: "field" }, h("label", { for: "gf-q" }, "Find"), search),
      h("div", { class: "field" }, h("span", { class: "flabel" }, "Topics"), h("div", { class: "chips" },
        h("button", { type: "button", onclick: () => set(all, true) }, "Include all"), h("button", { type: "button", onclick: () => set(all, false) }, "Leave all out"))),
      status),
    KL.length ? h("section", { class: "era gf-era kw-era" }, h("header", {}, h("h2", {}, "Separate keyword counts"), h("span", { class: "muted mono" }, "not among the 106 topics")),
      h("ul", { class: "gf-list" }, KL.map(({ k }) => item(k.no, k.topic, k.rule, kwCount[k.no])))) : null,
    h("div", { class: "topic-eras" }, eras)));
  sync();
}

/** Round tick values (0, step, 2*step, ...) that stay within an axis ending at max. */
function niceTicks(max) {
  const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  const out = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}
function geoPath(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.map((poly) => poly.map((ring) => "M" + ring.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z").join("")).join("");
}
function centroid(geom) {
  const pts = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).flat(2);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
