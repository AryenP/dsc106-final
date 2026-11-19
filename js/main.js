// Prototype for the DSC 106 final project (team Data brokers).
// Loads the weighted averages made by prep/build_data.py and draws three views.

const AGES = ["15-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const LATEST = 2024;

// Bands in the stacked area chart, bottom to top. `from` lists the
// activity groups in data/activities.csv that make up each band.
const BANDS = [
  { key: "Sleep", from: ["Sleep"], color: "#dcd8d1" },
  { key: "Personal care", from: ["Personal care"], color: "#bdb8b0" },
  { key: "Work & school", from: ["Work", "School"], color: "#a29d94" },
  { key: "Chores & caring", from: ["Housework & chores", "Caring for others"], color: "#cbc6be" },
  { key: "Eating & drinking", from: ["Eating & drinking"], color: "#b2ada5" },
  { key: "Shopping & errands", from: ["Shopping & errands"], color: "#d6d2cb" },
  { key: "Travel", from: ["Travel"], color: "#aba69e" },
  { key: "TV & movies", from: ["TV & movies"], color: "#8d8880" },
  { key: "Games & computer", from: ["Games & computer"], color: "#c0bbb3" },
  { key: "Socializing", from: ["Socializing"], color: "#c2410c" },
  { key: "Other leisure", from: ["Other leisure & sports", "Religious & volunteer", "Other"], color: "#d2cdc6" },
];

// Sliders in step 1 (hours). Whatever is left of 24 h is "everything else".
const SLIDERS = [
  { key: "Sleep", from: ["Sleep"], def: 8, max: 14 },
  { key: "Work or school", from: ["Work", "School"], def: 6, max: 14 },
  { key: "Chores & caring for others", from: ["Housework & chores", "Caring for others"], def: 1.5, max: 8 },
  { key: "Eating & drinking", from: ["Eating & drinking"], def: 1, max: 4 },
  { key: "TV, games & computer", from: ["TV & movies", "Games & computer"], def: 3, max: 12 },
  { key: "Seeing people in person", from: ["Socializing"], def: 1, max: 8 },
  { key: "Getting around", from: ["Travel"], def: 1, max: 5 },
];
const REST = "Everything else";

// Durations are written like a diary entry: hours:minutes.
const fmtMin = (m) => {
  const t = Math.round(m);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const fig = (m) => `<span class="fig">${fmtMin(m)}</span>`;
const fmtHours = (h) => fmtMin(h * 60);

function fillSelect(sel, values, labels = values, selected) {
  sel.selectAll("option").data(values).join("option")
    .attr("value", (d) => d).text((d, i) => labels[i])
    .property("selected", (d) => d === selected);
}

function onResize(fn) {
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fn, 150); });
}

const [acts, company] = await Promise.all([
  d3.csv("data/activities.csv", d3.autoType),
  d3.csv("data/company.csv", d3.autoType),
]);

// key "year|age|employment" -> { activity: minutes }
const byGroup = new Map();
for (const r of acts) {
  const k = `${r.year}|${r.age}|${r.employment}`;
  if (!byGroup.has(k)) byGroup.set(k, {});
  byGroup.get(k)[r.activity] = r.minutes;
}
const minutesFor = (year, age, emp, from) => {
  const row = byGroup.get(`${year}|${age}|${emp}`);
  return d3.sum(from, (a) => row?.[a] ?? 0);
};
const YEARS = [...new Set(acts.map((d) => d.year))].sort((a, b) => a - b);

/* ---------------- 1. Fill in your day ---------------- */
const day = {
  hours: Object.fromEntries(SLIDERS.map((s) => [s.key, s.def])),
  revealed: false,
};
fillSelect(d3.select("#day-age"), AGES, AGES, "15-24");

const rows = d3.select("#sliders").selectAll(".slider-row")
  .data(SLIDERS).join("div").attr("class", "slider-row");
rows.append("label").attr("for", (d, i) => `s${i}`).text((d) => d.key);
rows.append("output").attr("id", (d, i) => `o${i}`);
rows.append("input")
  .attr("type", "range").attr("id", (d, i) => `s${i}`)
  .attr("min", 0).attr("max", (d) => d.max).attr("step", 0.25)
  .property("value", (d) => d.def)
  .on("input", function (event, d) {
    const others = d3.sum(SLIDERS, (s) => (s.key === d.key ? 0 : day.hours[s.key]));
    const v = Math.min(+this.value, 24 - others);
    this.value = v;
    day.hours[d.key] = v;
    drawDay();
  });
const restRow = d3.select("#sliders").append("div").attr("class", "slider-row rest");
restRow.append("span").text(REST);
restRow.append("output").attr("id", "o-rest");

d3.select("#reveal").on("click", () => {
  day.revealed = true;
  d3.select("#reveal").text("Compared with 2024 averages").classed("done", true);
  drawDay();
});
d3.selectAll("#day-age, #day-emp").on("change", drawDay);

function drawDay() {
  const age = d3.select("#day-age").property("value");
  const emp = d3.select("#day-emp").property("value");
  const used = d3.sum(SLIDERS, (s) => day.hours[s.key]);
  SLIDERS.forEach((s, i) => d3.select(`#o${i}`).text(fmtHours(day.hours[s.key])));
  d3.select("#o-rest").text(fmtHours(24 - used));

  const data = SLIDERS.map((s) => ({
    key: s.key,
    you: day.hours[s.key],
    avg: minutesFor(LATEST, age, emp, s.from) / 60,
  }));
  const restAvg = 24 - d3.sum(data, (d) => d.avg);
  data.push({ key: REST, you: 24 - used, avg: restAvg });

  const svg = d3.select("#day-chart");
  const W = svg.node().getBoundingClientRect().width || 600;
  const m = { t: 22, r: 70, b: 26, l: 190 };
  const rowH = 34;
  const H = m.t + m.b + rowH * data.length;
  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);

  const x = d3.scaleLinear()
    .domain([0, Math.max(10, d3.max(data, (d) => Math.max(d.you, day.revealed ? d.avg : 0)))]).nice()
    .range([m.l, W - m.r]);
  const y = d3.scaleBand().domain(data.map((d) => d.key)).range([m.t, H - m.b]).padding(0.2);

  svg.selectAll("g.xaxis").data([0]).join("g").attr("class", "axis xaxis")
    .attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}:00`));

  svg.selectAll("text.legend-you").data([0]).join("text").attr("class", "annot legend-you")
    .attr("x", m.l).attr("y", 12)
    .text(day.revealed ? `Dark bar: you · light bar: the average ${age} year old ${emp === "Employed" ? "with a job" : "without a job"} in ${LATEST}` : "Your day");

  const g = svg.selectAll("g.row").data(data, (d) => d.key).join((enter) => {
    const r = enter.append("g").attr("class", "row");
    r.append("text").attr("class", "lbl annot").attr("text-anchor", "end").attr("dy", "0.35em");
    r.append("rect").attr("class", "avg").attr("rx", 2);
    r.append("rect").attr("class", "you").attr("fill", "var(--you)").attr("rx", 2);
    r.append("text").attr("class", "val").attr("dy", "0.35em");
    return r;
  });
  g.attr("transform", (d) => `translate(0,${y(d.key)})`);
  const bh = y.bandwidth();
  g.select(".lbl").attr("x", m.l - 10).attr("y", bh / 2).text((d) => d.key);
  g.select(".avg").attr("fill", (d) => (d.key === "Seeing people in person" ? "var(--accent-soft)" : "#dedad3"))
    .transition().duration(400).ease(d3.easeCubicOut)
    .attr("x", m.l).attr("y", 0).attr("height", bh)
    .attr("width", (d) => (day.revealed ? x(d.avg) - m.l : 0));
  g.select(".you").attr("x", m.l).attr("y", bh * 0.3).attr("height", bh * 0.4)
    .attr("width", (d) => Math.max(0, x(d.you) - m.l));
  g.select(".val")
    .attr("x", (d) => Math.max(x(d.you), day.revealed ? x(d.avg) : 0) + 6).attr("y", bh / 2)
    .text((d) => (day.revealed ? fmtHours(d.avg) : ""));

  const note = d3.select("#day-note");
  if (!day.revealed) { note.text(""); return; }
  const diffs = data.filter((d) => d.key !== REST).map((d) => ({ ...d, diff: d.you - d.avg }));
  const big = d3.greatest(diffs, (d) => Math.abs(d.diff));
  const social = data.find((d) => d.key === "Seeing people in person");
  note.html(`Your biggest difference is ${big.key.toLowerCase()}, ${fig(Math.abs(big.diff) * 60)} ${big.diff > 0 ? "more" : "less"} than average. ` +
    `The average person like you spends ${fig(social.avg * 60)} a day with people in person. These averages mix weekdays and weekends.`);
}

/* ---------------- 2. Stacked area 2003–2024 ---------------- */
fillSelect(d3.select("#area-age"), ["All", ...AGES], ["Everyone 15+", ...AGES], "All");
d3.selectAll("#area-age, #area-emp, #area-nosleep").on("change", drawArea);


let areaHover = null;

function drawArea() {
  const age = d3.select("#area-age").property("value");
  const emp = d3.select("#area-emp").property("value");
  const noSleep = d3.select("#area-nosleep").property("checked");
  const bands = noSleep ? BANDS.filter((b) => b.key !== "Sleep") : BANDS;

  const table = YEARS.map((year) => {
    const row = { year };
    for (const b of bands) row[b.key] = minutesFor(year, age, emp, b.from);
    return row;
  });
  const series = d3.stack().keys(bands.map((b) => b.key))(table);
  const color = new Map(BANDS.map((b) => [b.key, b.color]));

  const svg = d3.select("#area-chart");
  const W = svg.node().getBoundingClientRect().width || 900;
  const H = Math.min(520, Math.max(340, W * 0.5));
  const m = { t: 28, r: W < 640 ? 16 : 136, b: 32, l: 48 };
  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);

  const x = d3.scaleLinear().domain(d3.extent(YEARS)).range([m.l, W - m.r]);
  const top = d3.max(series.at(-1), (d) => d[1]);
  const y = d3.scaleLinear().domain([0, top]).range([H - m.b, m.t]);
  const step = noSleep ? 120 : 240;
  const ticks = d3.range(0, top + 1, step);

  svg.selectAll("g.yaxis").data([0]).join("g").attr("class", "axis yaxis grid")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).tickValues(ticks).tickSize(-(W - m.l - m.r)).tickFormat((d) => `${d / 60}:00`));
  svg.selectAll("g.xaxis").data([0]).join("g").attr("class", "axis xaxis")
    .attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(W < 640 ? [2003, 2010, 2020, 2024] : [2003, 2006, 2009, 2012, 2015, 2018, 2020, 2024]).tickFormat(d3.format("d")));

  const area = d3.area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1])).curve(d3.curveMonotoneX);
  const layer = svg.selectAll("g.layers").data([0]).join("g").attr("class", "layers");
  layer.selectAll("path").data(series, (d) => d.key).join(
    (enter) => enter.append("path").attr("d", area),
    (update) => update,
    (exit) => exit.remove(),
  )
    .attr("fill", (d) => color.get(d.key))
    .attr("stroke", "#fff").attr("stroke-width", 0.6)
    .transition().duration(400).attr("d", area);

  // label each band at its right edge, if it is tall enough to hold text
  const last = (s) => s.at(-1);
  svg.selectAll("text.band-label").data(W < 640 ? [] : series, (d) => d.key).join("text")
    .attr("class", (d) => `band-label${d.key === "Socializing" ? " hi" : ""}`)
    .attr("x", W - m.r + 8).attr("dy", "0.35em")
    .text((d) => d.key)
    .transition().duration(400)
    .attr("y", (d) => y((last(d)[0] + last(d)[1]) / 2))
    .attr("opacity", (d) => (y(last(d)[0]) - y(last(d)[1]) >= 12 || d.key === "Socializing" ? 1 : 0));

  // 2020 marker
  const mark = svg.selectAll("g.mark2020").data([0]).join((e) => {
    const g = e.append("g").attr("class", "mark2020");
    g.append("line").attr("stroke", "var(--ink-3)").attr("stroke-dasharray", "2 4");
    g.append("text").attr("class", "annot").attr("text-anchor", "end");
    return g;
  });
  mark.select("line").attr("x1", x(2020)).attr("x2", x(2020)).attr("y1", m.t - 6).attr("y2", H - m.b);
  mark.select("text").attr("x", x(2020) - 6).attr("y", m.t - 10).text("No diaries 18 Mar to 9 May 2020");

  // hover
  const rule = svg.selectAll("line.hover").data([0]).join("line").attr("class", "hover")
    .attr("stroke", "var(--ink-2)").attr("y1", m.t).attr("y2", H - m.b).attr("opacity", 0);
  const tip = d3.select("#area-tip");
  const hit = svg.selectAll("rect.hit").data([0]).join("rect").attr("class", "hit")
    .attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
    .attr("fill", "transparent");
  layer.raise(); mark.raise(); rule.raise();

  const show = (event) => {
    const [px, py] = d3.pointer(event, svg.node());
    const year = Math.round(x.invert(px));
    if (year < YEARS[0] || year > YEARS.at(-1)) return hide();
    const row = table.find((r) => r.year === year);
    const hiKey = event.target.__data__?.key ?? null;
    layer.selectAll("path").attr("opacity", (d) => (hiKey && d.key !== hiKey ? 0.55 : 1));
    rule.attr("x1", x(year)).attr("x2", x(year)).attr("opacity", 0.6);
    const items = bands.slice().reverse();
    tip.attr("hidden", null).html(
      `<div class="t-year">${year}${year === 2020 ? " (partial year)" : ""}</div>` +
      items.map((b) => `<div class="t-row${b.key === hiKey ? " hi" : ""}"><span class="sw" style="background:${b.color}"></span><span>${b.key}</span><span>${fmtMin(row[b.key])}</span></div>`).join(""),
    );
    const box = svg.node().getBoundingClientRect();
    const sx = box.width / W;
    const tw = tip.node().offsetWidth;
    let left = px * sx + 14;
    if (left + tw > box.width) left = px * sx - tw - 14;
    tip.style("left", `${left}px`).style("top", `${Math.max(0, py * sx - 60)}px`);
  };
  const hide = () => {
    tip.attr("hidden", true);
    rule.attr("opacity", 0);
    layer.selectAll("path").attr("opacity", 1);
  };
  svg.on("pointermove", show).on("pointerleave", hide);
  areaHover = hide;
}

/* ---------------- 3. Time with friends / alone (draft) ---------------- */
let measure = "friends";
d3.selectAll("#company-measure button").on("click", function () {
  measure = this.dataset.v;
  d3.selectAll("#company-measure button").attr("aria-pressed", function () { return String(this.dataset.v === measure); });
  drawCompany();
});
const ageColor = (age) => (age === "15-24" ? "var(--accent)" : "#aaa59d");

function drawCompany() {
  const rowsC = company.filter((d) => d.employment === "All" && d.age !== "All");
  const lines = d3.groups(rowsC, (d) => d.age).map(([age, v]) => ({ age, values: v.sort((a, b) => a.year - b.year) }));
  const svg = d3.select("#company-chart");
  const W = svg.node().getBoundingClientRect().width || 900;
  const H = Math.min(440, Math.max(300, W * 0.42));
  const m = { t: 24, r: 64, b: 32, l: 48 };
  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("height", H);
  const x = d3.scaleLinear().domain(d3.extent(rowsC, (d) => d.year)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(rowsC, (d) => d[measure])]).nice().range([H - m.b, m.t]);

  svg.selectAll("g.yaxis").data([0]).join("g").attr("class", "axis yaxis grid")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).tickValues(d3.range(0, y.domain()[1] + 1, measure === "friends" ? 30 : 60)).tickSize(-(W - m.l - m.r)).tickFormat(fmtMin));
  svg.selectAll("g.xaxis").data([0]).join("g").attr("class", "axis xaxis")
    .attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues(W < 640 ? [2003, 2010, 2020, 2024] : [2003, 2008, 2013, 2018, 2020, 2024]).tickFormat(d3.format("d")));

  const line = d3.line().x((d) => x(d.year)).y((d) => y(d[measure])).curve(d3.curveMonotoneX);
  const g = svg.selectAll("g.series").data(lines, (d) => d.age).join((e) => {
    const s = e.append("g").attr("class", "series");
    s.append("path").attr("fill", "none");
    s.append("text").attr("class", "annot end").attr("dy", "0.35em");
    return s;
  });
  g.sort((a, b) => (a.age === "15-24") - (b.age === "15-24"));
  g.select("path").attr("stroke", (d) => ageColor(d.age)).attr("stroke-width", (d) => (d.age === "15-24" ? 2.5 : 1.5)).transition().duration(400).attr("d", (d) => line(d.values));
  g.select("text.end").attr("x", W - m.r + 8).attr("fill", (d) => (d.age === "15-24" ? "var(--accent)" : "var(--ink-3)"))
    .text((d) => d.age);

  // end labels: nudge apart so they never overlap
  const ends = lines.map((l) => ({ age: l.age, y: y(l.values.at(-1)[measure]) })).sort((p, q) => p.y - q.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 14);
  const endY = new Map(ends.map((e) => [e.age, e.y]));
  g.select("text.end").transition().duration(400).attr("y", (d) => endY.get(d.age));

  // annotate the age group with the biggest change
  const change = lines.map((l) => ({ ...l, a: l.values[0][measure], b: l.values.at(-1)[measure] }));
  const big = d3.greatest(change, (d) => Math.abs(d.b - d.a));
  svg.selectAll("text.callout").data([big]).join("text").attr("class", "annot callout")
    .attr("x", x(2003) + 8).attr("y", y(big.a) - 10)
    .text(`Ages ${big.age}: ${fmtMin(big.a)} a day in 2003, ${fmtMin(big.b)} in 2024`)
    .attr("fill", big.age === "15-24" ? "var(--accent)" : "var(--ink-2)");

  g.on("pointerenter", (event, d) => g.attr("opacity", (o) => (o.age === d.age ? 1 : 0.2)))
    .on("pointerleave", () => g.attr("opacity", 1));
}

drawDay();
drawArea();
drawCompany();
onResize(() => { drawDay(); drawArea(); drawCompany(); });
