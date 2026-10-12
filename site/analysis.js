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

// ---------- grades ----------
const gIsBand = (g) => /[-+]/.test(g);
const gNum = (x) => (x === "PK" ? -1 : x === "K" ? 0 : +x);
const gLabel = (g) => g.split(/([-+])/).map((p) => (p === "-" ? "–" : p === "+" ? ", " : p === "PK" ? "Pre-K" : p.replace(/^0(\d)/, "$1"))).join("");
const gSortKey = (g) => { const p = g.split(/[-+]/); return gNum(p[0]) * 100 + gNum(p[p.length - 1]); };

// ---------- shared filters (one set for both tabs; score settings remembered) ----------
const AF = {
  states: null, regions: new Set(REGION_NAMES), grade: "all", topics: null,
  minScore: store.get("minScore", null), named: store.get("named", true),
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
/** Indices of the tags that pass the filters. opts.ignoreGrade / ignoreTopics / ignoreStates relax one filter. */
function filteredTags(D, opts = {}) {
  const T = D.tags, out = [];
  const st = new Set(opts.ignoreStates ? D.states : effStates(D));
  const stOK = D.states.map((s) => st.has(s));
  const gOK = D.grades.map((g) => opts.ignoreGrade || gradeOK(g));
  const min = Math.round(AF.minScore * 1000);
  for (let i = 0; i < D.n; i++) {
    if (!stOK[T.st[i]] || !gOK[T.g[i]] || !catOK(T.c[i])) continue;
    if (!opts.ignoreTopics && !AF.topics.has(T.t[i])) continue;
    if (T.sc[i] < min && !(AF.named && T.m[i] !== 0)) continue;
    out.push(i);
  }
  return out;
}
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
const tagPasses = (tag) => tag.sc >= AF.minScore || (AF.named && tag.m !== "meaning");

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

function filterBar(D, onChange, { topics = true } = {}) {
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
    groups: D.eras.map((e) => ({ name: e, items: D.topics.filter((t) => t.era === e).map((t) => ({ value: t.no, label: `${t.no}. ${t.topic}` })) })) }) : null;
  return h("div", { class: "filters filterbar", role: "search" }, stSel, regions,
    h("div", { class: "field" }, h("label", { for: "af-grade" }, "Grade"), grSel),
    topicSel, scoreControl(D, onChange));
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

// tooltip (one per page)
function tooltip() {
  let tip = document.getElementById("viz-tip");
  if (!tip) { tip = h("div", { id: "viz-tip", class: "viz-tip", role: "tooltip", hidden: true }); document.body.append(tip); }
  return {
    show(e, rows) {
      tip.replaceChildren(...rows.map(([v, l, color]) => h("div", { class: "tip-row" }, color ? h("i", { class: "tip-key", style: `background:${color}` }) : null, h("b", {}, v), l ? h("span", {}, l) : null)));
      tip.hidden = false;
      const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8), y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8);
      tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    },
    hide() { tip.hidden = true; },
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

// ================= TOPICS TAB =================
async function topicsPage(no) {
  const [D, idx] = await Promise.all([loadTopicData(), loadIndex()]);
  D.stateNames = Object.fromEntries(Object.entries(idx.states).map(([k, s]) => [k, s.name]));
  initFilters(D);
  if (no) return topicDetail(D, idx, +no);
  const body = h("div", { class: "topic-eras" });
  const stat = h("p", { class: "stats" });
  function draw() {
    const keep = filteredTags(D, { ignoreTopics: true });
    const count = {}, states = {};
    for (const i of keep) { const t = D.tags.t[i]; count[t] = (count[t] || 0) + 1; (states[t] ||= new Set()).add(D.tags.st[i]); }
    const max = Math.max(1, ...Object.values(count));
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), " tags"), h("span", {}, h("b", {}, Object.keys(count).length), " of ", h("b", {}, D.topics.length), " topics found"),
      h("span", {}, h("b", {}, effStates(D).length), " states selected"));
    body.replaceChildren(...D.eras.map((era) => {
      const ts = D.topics.filter((t) => t.era === era);
      const n = ts.reduce((a, t) => a + (count[t.no] || 0), 0);
      return h("section", { class: "era" },
        h("header", {}, h("h2", {}, era), h("span", { class: "muted mono" }, `${fmt(n)} tags`)),
        h("ol", { class: "topic-list" }, ts.map((t) => h("li", { value: t.no },
          h("a", { class: "tl-name", href: `#/topics/${t.no}` }, h("span", { class: "tl-no mono" }, `${t.no}.`), h("span", {}, t.topic, h("span", { class: "muted" }, ` · ${t.years}`))),
          h("span", { class: "tl-bar", "aria-hidden": "true" }, h("i", { style: `width:${((count[t.no] || 0) / max) * 100}%` })),
          h("span", { class: "tl-n mono" }, fmt(count[t.no] || 0)),
          h("span", { class: "tl-s muted" }, `${states[t.no]?.size || 0} states`)))));
    }));
  }
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, "Immigration topics"), h("h1", {}, "106 topics, numbered by era")),
    h("p", { class: "lede" }, "Each sentence of the standards text was compared with every topic by a local language model. A sentence gets the one topic it is most similar to, plus any topic it names outright. Raise the minimum similarity score to drop weak matches. Examples and backup text are tagged too, but only in the document viewer; they are not counted here."),
    filterBar(D, draw, { topics: false }), stat, body));
  draw();
}

async function topicDetail(D, idx, no) {
  const t = D.topicByNo[no];
  if (!t) throw new Error(`There is no topic ${no}.`);
  const text = await loadTopicText();
  const byState = h("div", { class: "table-wrap" });
  const occ = h("div", { class: "occ" });
  const stat = h("p", { class: "stats" });
  let limit = 200;
  function draw() {
    const keep = filteredTags(D, { ignoreTopics: true }).filter((i) => D.tags.t[i] === no);
    const { byState: words } = wordTotals(D);
    const per = {};
    for (const i of keep) { const s = D.states[D.tags.st[i]]; per[s] = (per[s] || 0) + 1; }
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), " tags"), h("span", {}, h("b", {}, Object.keys(per).length), " states"));
    const rows = Object.entries(per).sort((a, b) => b[1] - a[1]);
    byState.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, h("th", {}, "State"), h("th", {}, "Region"), h("th", { class: "num" }, "Tags"), h("th", { class: "num" }, "Per 10,000 words"))),
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
        h("span", { class: "occ-text" }, text[i]),
        h("span", { class: "occ-meta" }, h("b", { class: "mono" }, (T.sc[i] / 1000).toFixed(2)), ` ${METHOD_LABEL[METHOD_NAMES[T.m[i]]]}`,
          ` · ${CAT_NAMES[T.c[i]]} · grades ${gLabel(D.grades[T.g[i]])}`, T.co[i] >= 0 ? ` · ${D.courses[T.co[i]]}` : "", ` · u${T.u[i]}`)));
    }
    if (keep.length > shown.length) out.push(h("button", { onclick: () => { limit += 400; draw(); } }, `Show more (${fmt(keep.length - shown.length)} more)`));
    occ.replaceChildren(...(out.length ? out : [h("p", { class: "muted" }, "No sentences match these filters.")]));
  }
  setMain(h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, h("a", { href: "#/topics" }, "Topics"), ` / ${t.era}`), h("h1", {}, `${t.no}. ${t.topic}`)),
    h("dl", { class: "meta" }, h("dt", {}, "Years"), h("dd", {}, t.years), h("dt", {}, "Description"), h("dd", {}, t.description), h("dt", {}, "Search terms"), h("dd", {}, t.terms.join("; "))),
    filterBar(D, draw, { topics: false }), stat,
    h("div", { class: "two-col" }, h("section", {}, h("h2", {}, "By state"), byState), h("section", { class: "minw0" }, h("h2", {}, "Where it appears"), h("p", { class: "muted" }, "Click a sentence to open it in the side-by-side viewer."), occ))));
  draw();
}

// ================= CHARTS TAB =================
async function chartsPage() {
  const [D, idx] = await Promise.all([loadTopicData(), loadIndex()]);
  D.stateNames = Object.fromEntries(Object.entries(idx.states).map(([k, s]) => [k, s.name]));
  initFilters(D);
  const geo = await fetch("site/vendor/states-albers-10m.json").then((r) => r.json());
  const tip = tooltip();
  const opt = { mapMeasure: "rate", mapScale: "linear", mtxValue: "share", mtxCols: "eras", lineMeasure: "count", lineAgg: "avg", lineBy: "combined", compare: new Set() };

  const stat = h("p", { class: "stats" });
  const mapBox = h("div", { class: "viz-map" }), mapLegend = h("div", {}), mapTable = h("div", { class: "table-wrap", hidden: true });
  const mtxBox = h("div", { class: "viz-mtx table-wrap" });
  const lineBox = h("div", { class: "viz-line" }), bandBox = h("div", { class: "viz-line viz-bands" }), lineLegend = h("div", {}), lineTable = h("div", { class: "table-wrap", hidden: true });
  const sel = (id, options, key) => {
    const s = h("select", { id }, options.map(([v, l]) => h("option", { value: v }, l)));
    s.value = opt[key]; s.addEventListener("change", () => { opt[key] = s.value; draw(); }); return s;
  };
  const tableBtn = (tbl) => h("button", { type: "button", "aria-pressed": "false", onclick: (e) => { tbl.hidden = !tbl.hidden; e.currentTarget.setAttribute("aria-pressed", String(!tbl.hidden)); } }, "Table");
  const compareWrap = h("div", {});

  const features = topojson.feature(geo, geo.objects.states).features;
  const nameToAbbr = Object.fromEntries(Object.entries(D.stateNames).map(([a, n]) => [n, a]));

  function draw() {
    const keep = filteredTags(D);
    const { byState: words } = wordTotals(D);
    const eff = effStates(D).filter((s) => words[s] > 0);
    const per = {}, top = {};
    for (const i of keep) { const s = D.states[D.tags.st[i]]; per[s] = (per[s] || 0) + 1; ((top[s] ||= {})[D.tags.t[i]] = (top[s][D.tags.t[i]] || 0) + 1); }
    const totW = eff.reduce((a, s) => a + words[s], 0);
    stat.replaceChildren(h("span", {}, h("b", {}, fmt(keep.length)), " tags"), h("span", {}, h("b", {}, eff.length), " states with text"),
      h("span", {}, h("b", {}, fmt(totW)), " words of standards"), h("span", {}, h("b", {}, totW ? fmt1((keep.length / totW) * 1e4) : "—"), " tags per 10,000 words"));
    drawMap(eff, per, words, top);
    drawMatrix(keep, eff, words);
    const all = wordTotals(D, { ignoreGrade: true });
    drawLine(filteredTags(D, { ignoreGrade: true }), all.byStateGrade, effStates(D).filter((s) => all.byState[s] > 0));
  }

  // ----- map -----
  function drawMap(eff, per, words, top) {
    const val = (s) => (opt.mapMeasure === "rate" ? (words[s] ? ((per[s] || 0) / words[s]) * 1e4 : 0) : per[s] || 0);
    const b = bins(eff.map(val), opt.mapScale);
    const effSet = new Set(eff);
    const paths = features.map((f) => {
      const s = nameToAbbr[f.properties.name];
      const p = svg("path", { d: geoPath(f.geometry), class: `st ${effSet.has(s) ? b.cls(val(s)) : "q0 off"}`, tabindex: "0", "aria-label": s });
      const show = (e) => {
        const tops = Object.entries(top[s] || {}).sort((a, c) => c[1] - a[1]).slice(0, 3).map(([t, n]) => [fmt(n), `${t}. ${D.topicByNo[t].topic}`]);
        tip.show(e, effSet.has(s) ? [[D.stateNames[s] || f.properties.name, `${REGION_OF[s]}`], [fmt(per[s] || 0), "tags"], [fmt1(val(s)), opt.mapMeasure === "rate" ? "per 10,000 words" : "tags"], [fmt(words[s] || 0), "words counted"], ...tops]
          : [[f.properties.name, s === "MD" ? "no standards file collected" : "not selected"]]);
      };
      p.addEventListener("pointermove", show); p.addEventListener("pointerleave", tip.hide);
      p.addEventListener("focus", (e) => { const r = p.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); });
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
      m.addEventListener("pointermove", (e) => tip.show(e, [[D.stateNames.DC, REGION_OF.DC], [fmt(per.DC || 0), "tags"], [fmt1(val("DC")), opt.mapMeasure === "rate" ? "per 10,000 words" : "tags"]]));
      m.addEventListener("pointerleave", tip.hide);
      extra.push(svg("line", { x1: c[0], y1: c[1], x2: c[0] + 28, y2: c[1] + 18, class: "leader" }), m, svg("text", { x: c[0] + 38, y: c[1] + 22, class: "map-lab" }, "DC"));
    }
    mapBox.replaceChildren(svg("svg", { viewBox: "-60 0 1040 620", role: "img", "aria-label": "Map of states colored by immigration-topic tags" }, paths, extra));
    const f = opt.mapMeasure === "rate" ? fmt1 : (x) => fmt(Math.round(x));
    mapLegend.replaceChildren(legendBins(b, f, opt.mapScale === "quantile" ? "Five equal-size groups of states" : opt.mapScale === "log" ? "Log scale" : ""));
    mapTable.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, ["State", "Region", "Tags", "Words", "Per 10,000 words"].map((x, i) => h("th", { class: i > 1 ? "num" : null }, x)))),
      h("tbody", {}, eff.slice().sort((a, c) => val(c) - val(a)).map((s) => h("tr", {}, h("td", {}, `${s} · ${D.stateNames[s]}`), h("td", {}, REGION_OF[s]), h("td", { class: "num" }, fmt(per[s] || 0)), h("td", { class: "num" }, fmt(words[s])), h("td", { class: "num" }, fmt1(((per[s] || 0) / words[s]) * 1e4)))))));
  }

  // ----- matrix: distribution of topic mentions -----
  function drawMatrix(keep, eff, words) {
    const selTopics = D.topics.filter((t) => AF.topics.has(t.no));
    const useTopics = opt.mtxCols === "topics";
    const cols = useTopics ? selTopics.map((t) => ({ key: t.no, label: String(t.no), title: `${t.no}. ${t.topic}` }))
      : D.eras.map((e, i) => ({ key: i, label: e.replace(/\s*\(.*\)/, ""), title: e })).filter((c) => selTopics.some((t) => D.eraOfTopic[t.no] === c.key));
    const cell = {}, rowTot = {};
    for (const i of keep) {
      const s = D.states[D.tags.st[i]], k = useTopics ? D.tags.t[i] : D.eraOfTopic[D.tags.t[i]];
      cell[`${s}|${k}`] = (cell[`${s}|${k}`] || 0) + 1; rowTot[s] = (rowTot[s] || 0) + 1;
    }
    const rowsOrder = REGION_NAMES.flatMap((r) => eff.filter((s) => REGION_OF[s] === r));
    const value = (s, k) => { const n = cell[`${s}|${k}`] || 0; return opt.mtxValue === "share" ? (rowTot[s] ? (n / rowTot[s]) * 100 : 0) : opt.mtxValue === "rate" ? (n / words[s]) * 1e4 : n; };
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
          td.addEventListener("pointermove", (e) => tip.show(e, [[fv(v), opt.mtxValue === "share" ? `of ${D.stateNames[s]}'s tags` : opt.mtxValue === "rate" ? "per 10,000 words" : "tags"], [fmt(n), "tags"], [c.title, D.stateNames[s]]]));
          td.addEventListener("pointerleave", tip.hide);
          return td;
        }))]).filter(Boolean)));
    mtxBox.replaceChildren(table, legendBins(b, fv, opt.mtxValue === "share" ? "Each row adds up to 100%" : ""));
  }

  // ----- line graph over single grades, and a dot chart for grade bands -----
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
    const cnt = {};
    for (const i of keep) { const k = `${D.states[D.tags.st[i]]}|${D.grades[D.tags.g[i]]}`; cnt[k] = (cnt[k] || 0) + 1; }
    const present = [...new Set(Object.keys(byStateGrade).filter((k) => eff.includes(k.split("|")[0])).map((k) => k.split("|")[1]))];
    const singles = present.filter((g) => !gIsBand(g)).sort((a, b) => gSortKey(a) - gSortKey(b));
    const point = (S, g) => {
      const withText = S.states.filter((s) => byStateGrade[`${s}|${g}`] > 0);
      if (!withText.length) return null;
      const n = withText.map((s) => cnt[`${s}|${g}`] || 0), w = withText.map((s) => byStateGrade[`${s}|${g}`]);
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const v = opt.lineMeasure === "count" ? (opt.lineAgg === "avg" ? sum(n) / n.length : sum(n))
        : opt.lineAgg === "avg" ? sum(n.map((x, i) => (x / w[i]) * 1e4)) / n.length : (sum(n) / sum(w)) * 1e4;
      return { v, states: withText.length, tags: sum(n) };
    };
    const data = series.map((S, si) => ({ ...S, si, color: `var(--viz-${(si % 8) + 1})`, cls: `s${(si % 8) + 1}`, pts: singles.map((g) => point(S, g)) }));
    // bands present in at least one series
    const bands = present.filter(gIsBand).sort((a, b) => gSortKey(a) - gSortKey(b)).filter((g) => data.some((d) => point(d, g)));
    data.forEach((d) => (d.bpts = bands.map((g) => point(d, g))));
    const meas = opt.lineMeasure === "count" ? (opt.lineAgg === "avg" ? "tags per state (average)" : "tags (total)") : (opt.lineAgg === "avg" ? "per 10,000 words (state average)" : "per 10,000 words (pooled)");
    const yMax = niceMax(Math.max(1e-9, ...data.flatMap((d) => [...d.pts, ...d.bpts].filter(Boolean).map((p) => p.v))));
    const tipRows = (title, key, i) => [[title, meas], ...data.map((d) => { const q = d[key][i]; return [q ? fmt1(q.v) : "—", q ? `${d.label || d.name} · ${fmt(q.tags)} tags, ${q.states} state${q.states > 1 ? "s" : ""}` : `${d.label || d.name} · no text`, d.color]; })];

    // line chart
    const W = 1000, H = 360, L = 56, R = 130, T = 16, Bm = 44;
    const xs = (i) => L + (singles.length > 1 ? (i * (W - R - L)) / (singles.length - 1) : (W - R - L) / 2);
    const ys = (v) => T + (H - T - Bm) * (1 - v / yMax);
    const g = [];
    for (let k = 0; k <= 4; k++) {
      const v = (yMax * k) / 4;
      g.push(svg("line", { x1: L, x2: W - R, y1: ys(v), y2: ys(v), class: k ? "grid" : "axis" }), svg("text", { x: L - 8, y: ys(v) + 4, class: "tick", "text-anchor": "end" }, fmt1(v)));
    }
    singles.forEach((gr, i) => g.push(svg("text", { x: xs(i), y: H - Bm + 18, class: "tick", "text-anchor": "middle" }, gLabel(gr))));
    g.push(svg("text", { x: (L + W - R) / 2, y: H - 6, class: "axis-title", "text-anchor": "middle" }, "Grade (text written for that grade only)"));
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
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Immigration-topic tags by single grade" }, g, marks, cross, hit);
    hit.addEventListener("pointermove", (e) => {
      if (!singles.length) return;
      const pt = root.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const x = pt.matrixTransform(root.getScreenCTM().inverse()).x;
      let i = 0; singles.forEach((_, k) => { if (Math.abs(xs(k) - x) < Math.abs(xs(i) - x)) i = k; });
      cross.setAttribute("x1", xs(i)); cross.setAttribute("x2", xs(i)); cross.setAttribute("visibility", "visible");
      tip.show(e, tipRows(`Grade ${gLabel(singles[i])}`, "pts", i));
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hide(); });
    lineBox.replaceChildren(singles.length ? root : h("p", { class: "muted" }, "No text written for single grades in the selected states."));

    // band dot chart: one row per band, as the states wrote them
    const rowH = 26, BW = 1000, BL = 120, BR = 40, BT = 8;
    const BH = BT + bands.length * rowH + 30;
    const bMax = niceMax(Math.max(1e-9, ...data.flatMap((d) => d.bpts.filter(Boolean).map((p) => p.v))));   // its own scale
    const bxs = (v) => BL + (BW - BL - BR) * (v / bMax);
    const bg = [];
    for (let k = 0; k <= 4; k++) { const v = (bMax * k) / 4; bg.push(svg("line", { x1: bxs(v), x2: bxs(v), y1: BT, y2: BH - 26, class: k ? "grid" : "axis" }), svg("text", { x: bxs(v), y: BH - 10, class: "tick", "text-anchor": "middle" }, fmt1(v))); }
    const brows = bands.map((gr, i) => {
      const y = BT + i * rowH + rowH / 2;
      const grp = svg("g", { class: "brow" }, svg("rect", { x: 0, y: y - rowH / 2, width: BW, height: rowH, class: "hit" }),
        svg("text", { x: BL - 10, y: y + 4, class: "tick", "text-anchor": "end" }, gLabel(gr)),
        svg("line", { x1: BL, x2: BW - BR, y1: y, y2: y, class: "grid" }),
        data.map((d) => { const q = d.bpts[i]; return q ? svg("circle", { cx: bxs(q.v), cy: y + (data.length > 1 ? (d.si - (data.length - 1) / 2) * 3 : 0), r: 5, class: `dot ${d.cls}` }) : null; }));
      grp.addEventListener("pointermove", (e) => tip.show(e, tipRows(`Band ${gLabel(gr)}`, "bpts", i)));
      grp.addEventListener("pointerleave", tip.hide);
      return grp;
    });
    bandBox.replaceChildren(bands.length ? svg("svg", { viewBox: `0 0 ${BW} ${BH}`, role: "img", "aria-label": "Immigration-topic tags by grade band" }, bg, brows) : h("p", { class: "muted" }, "No grade-band text in the selected states."));

    lineLegend.replaceChildren(h("div", { class: "legend" }, data.length > 1 ? data.map((d) => h("span", { class: "lg" }, h("i", { class: `lk ${d.cls}` }), d.label || d.name)) : h("span", { class: "muted" }, `${eff.length} states combined`),
      opt.lineBy === "state" && eff.length > 8 ? h("span", { class: "muted" }, "Up to 8 states at a time") : null));
    lineTable.replaceChildren(h("table", { class: "ledger" }, h("thead", {}, h("tr", {}, h("th", {}, "Series"), [...singles, ...bands].map((gr) => h("th", { class: "num" }, gLabel(gr))))),
      h("tbody", {}, data.map((d) => h("tr", {}, h("td", {}, d.label || d.name), [...d.pts, ...d.bpts].map((q) => h("td", { class: "num" }, q ? fmt1(q.v) : "—")))))));
  }

  setMain(h("div", { class: "page wide" },
    h("div", {}, h("p", { class: "eyebrow" }, "Data visualization"), h("h1", {}, "Immigration topics across states and grades")),
    h("p", { class: "lede" }, "Standards text only. A tag is one sentence matched to one topic. Each sentence is counted once per state, at the grades the state's document assigns it: a 4–6 band is never split into grades, and choosing a single grade leaves bands out."),
    filterBar(D, draw), stat,
    h("section", { class: "card" }, h("header", {}, h("h2", {}, "Where immigration topics appear"),
      h("div", { class: "card-tools" }, h("label", { for: "map-m" }, "Measure"), sel("map-m", [["rate", "Tags per 10,000 words"], ["count", "Tags (count)"]], "mapMeasure"),
        h("label", { for: "map-s" }, "Scale"), sel("map-s", [["linear", "Linear"], ["log", "Log"], ["quantile", "Categories (quintiles)"]], "mapScale"), tableBtn(mapTable))),
      mapBox, mapLegend, mapTable),
    h("section", { class: "card" }, h("header", {}, h("h2", {}, "Which topics each state emphasizes"),
      h("div", { class: "card-tools" }, h("label", { for: "mtx-v" }, "Value"), sel("mtx-v", [["share", "Share of the state's tags"], ["rate", "Tags per 10,000 words"], ["count", "Tags (count)"]], "mtxValue"),
        h("label", { for: "mtx-c" }, "Columns"), sel("mtx-c", [["eras", "Eras"], ["topics", "Topics (selected)"]], "mtxCols"))),
      mtxBox),
    h("section", { class: "card" }, h("header", {}, h("h2", {}, "Immigration topics by grade"),
      h("div", { class: "card-tools" }, h("label", { for: "ln-m" }, "Measure"), sel("ln-m", [["count", "Tags (count)"], ["rate", "Tags per 10,000 words"]], "lineMeasure"),
        h("label", { for: "ln-a" }, "Combine states"), sel("ln-a", [["avg", "Average per state"], ["sum", "Total (raw numbers)"]], "lineAgg"),
        h("label", { for: "ln-b" }, "Lines"), sel("ln-b", [["combined", "All selected states"], ["region", "By region"], ["state", "By state"]], "lineBy"), tableBtn(lineTable))),
      compareWrap, lineLegend, lineBox,
      h("h3", {}, "Grade bands, as the states wrote them"),
      h("p", { class: "muted small" }, "Text written for a band (for example 6–8 or 9–12 courses) is shown here, not split into grades. Same lines and measure as above, on its own scale."),
      bandBox, lineTable,
      h("p", { class: "muted small" }, "The grade filter above does not apply to these two charts: they always show every grade and band. A line skips a grade where none of its states has text written for that grade."))));
  draw();
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
function geoPath(geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return polys.map((poly) => poly.map((ring) => "M" + ring.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L") + "Z").join("")).join("");
}
function centroid(geom) {
  const pts = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).flat(2);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
