import { ui, state } from "./state";
import { defaultRecipe, buildSyntheticLayout, buildLayoutFromDxfLabels } from "../engine/layout";
import { buildSimPlan, runSimulation } from "../engine/simulation";
import { minutesToSeconds, clamp } from "../utils";
import type { SimParams, RecipeStep, TankType } from "../types";

export function readParamsFromUi(): SimParams {
  const tankCount = clamp(Number(ui.tankCount.value), 3, 20);
  const preset = ui.recipePreset.value;
  const recipeSteps: RecipeStep[] = defaultRecipe(tankCount, preset).map((s) => ({ ...s }));
  for (const tr of ui.tankTableBody.querySelectorAll("tr")) {
    const id = tr.getAttribute("data-id");
    const dwellInput = tr.querySelector<HTMLInputElement>(".dwell-input");
    const typeSelect = tr.querySelector<HTMLSelectElement>(".type-select");
    const tolInput = tr.querySelector<HTMLInputElement>(".tol-input");
    const dwell = dwellInput ? Number(dwellInput.value) : 0;
    const tankType = typeSelect ? (typeSelect.value as TankType) : undefined;
    const tol = tolInput ? clamp(Number(tolInput.value), 0, 50) / 100 : 0.1;
    if (id && id.startsWith("T")) {
      const step = recipeSteps.find((x) => x.id === id);
      if (step) {
        step.dwellSec = minutesToSeconds(Math.max(0, dwell));
        if (tankType) step.tankType = tankType;
        step.tolerancePct = tol;
      }
    }
  }
  const wdoStep = recipeSteps.find((x) => x.id === "WDO");
  if (wdoStep) wdoStep.dwellSec = minutesToSeconds(Math.max(0, Number(ui.wdoTimeMin.value)));
  return {
    preset, recipeSteps,
    basketCount: Math.max(1, Math.floor(Number(ui.basketCount.value))),
    tankCount,
    wdoTimeMin: Math.max(0, Number(ui.wdoTimeMin.value)),
    loadTimeMin: Math.max(0, Number(ui.loadTimeMin.value)),
    unloadTimeMin: Math.max(0, Number(ui.unloadTimeMin.value)),
    dripTimeSec: Math.max(0, Number(ui.dripTimeSec.value)),
    targetBph: 0,
    simHours: Math.max(0.25, Number(ui.simHours.value)),
    wagonSpeedMPerMin: Math.max(1, Number(ui.wagonSpeedMPerMin.value)),
    liftLowerSec: Math.max(0, Number(ui.liftLowerSec.value)),
    pickDropSec: Math.max(0, Number(ui.pickDropSec.value)),
    wagonCount: Math.max(1, Math.floor(Number(ui.wagonCount.value))),
    distanceMode: (ui.distanceMode?.value as "manhattan" | "euclidean") || "manhattan",
    dwellClockOffsetSec: null,
  };
}

export function rebuildTankTable(tankCount: number, dwellMinDefault: number, tolDefault: number = 10): void {
  ui.tankTableBody.textContent = "";
  for (let i = 0; i < tankCount; i++) {
    const id = `T${i + 1}`;
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", id);

    const td1 = document.createElement("td");
    td1.textContent = id;

    const td2 = document.createElement("td");
    const select = document.createElement("select");
    select.className = "type-select";
    select.innerHTML = `<option value="chemical">Chemical</option><option value="rinse">Rinse</option>`;
    td2.appendChild(select);

    const td3 = document.createElement("td");
    const input = document.createElement("input");
    input.className = "dwell-input";
    input.type = "number";
    input.min = "0";
    input.step = "0.5";
    input.value = String(dwellMinDefault);
    td3.appendChild(input);

    const td4 = document.createElement("td");
    const tolInput = document.createElement("input");
    tolInput.className = "tol-input";
    tolInput.type = "number";
    tolInput.min = "0";
    tolInput.max = "50";
    tolInput.step = "1";
    tolInput.value = String(tolDefault);
    td4.appendChild(tolInput);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    ui.tankTableBody.appendChild(tr);

    const onChange = () => { if (ui.autoRun.checked) recomputeAndRender(); };
    input.addEventListener("input", onChange);
    select.addEventListener("change", onChange);
    tolInput.addEventListener("input", onChange);
  }
}

export function updateLayout(): void {
  const tankCount = clamp(Number(ui.tankCount.value), 3, 20);
  if (ui.layoutMode.value === "dxf_labels" && state.dxfLabelsRows) {
    state.layout = buildLayoutFromDxfLabels(state.dxfLabelsRows, tankCount, state.detectedStations);
    ui.layoutStatus.textContent = `DXF labels (${state.layout.meta.source}).`;
  } else {
    state.layout = buildSyntheticLayout(tankCount);
    ui.layoutStatus.textContent = "Synthetic layout.";
  }
  state.layout.meta.distanceMode = state.params?.distanceMode || "manhattan";
}

export function recomputePlan(): void {
  state.params = readParamsFromUi();
  updateLayout();
  state.plan = buildSimPlan(state.layout, state.params);
  state.sim = runSimulation(state.layout, state.params);
}

// ─── Rendering ────────────────────────────────────────────────

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const total = Math.round(Math.max(0, seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}m ${String(ss).padStart(2, "0")}s`;
}

function formatPct01(x: number): string {
  if (!Number.isFinite(x)) return "-";
  return `${Math.round(clamp(x, 0, 1) * 100)}%`;
}

function pctDelta(actual: number, target: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target <= 0) return null;
  return ((actual - target) / target) * 100;
}

function formatTimeShort(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(0)}s`;
  const mm = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${mm}m${String(ss).padStart(2, "0")}s`;
}

function escapeHtml(s: string): string {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function svgClear(svg: SVGSVGElement): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function svgEl(name: string): Element {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}

function renderLineChart(
  svg: SVGSVGElement,
  series: { x: number; y: number }[],
  opts?: { stroke?: string; fill?: string; yMax?: number; unit?: string },
): { pad: number; width: number; height: number; xMin: number; xMax: number; xFor: (x: number) => number; yFor: (y: number) => number; yMax: number; h: number } {
  const width = Number(svg.getAttribute("width")) || 600;
  const height = Number(svg.getAttribute("height")) || 130;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgClear(svg);
  const pad = 14;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = 0;
  const yMax = Math.max(1e-6, Math.max(...ys, opts?.yMax ?? 0));
  const xFor = (x: number) => pad + ((x - xMin) / Math.max(1e-6, xMax - xMin)) * w;
  const yFor = (y: number) => pad + (1 - (y - yMin) / Math.max(1e-6, yMax - yMin)) * h;

  for (let i = 0; i <= 4; i++) {
    const y = pad + (h * i) / 4;
    const line = svgEl("line");
    line.setAttribute("x1", String(pad));
    line.setAttribute("x2", String(pad + w));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "rgba(255,255,255,0.06)");
    line.setAttribute("stroke-width", "1");
    svg.appendChild(line);
  }

  const tickInterval = 900;
  for (let tt = Math.ceil(xMin / tickInterval) * tickInterval; tt <= xMax; tt += tickInterval) {
    const x = xFor(tt);
    const lbl = svgEl("text");
    lbl.setAttribute("x", String(x));
    lbl.setAttribute("y", String(height - 2));
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("fill", "rgba(146,162,187,0.6)");
    lbl.setAttribute("font-size", "9");
    lbl.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
    lbl.textContent = `${Math.floor(tt / 60)}m`;
    svg.appendChild(lbl);
  }

  let d = "";
  for (let i = 0; i < series.length; i++) {
    const p = series[i];
    const x = xFor(p.x);
    const y = yFor(p.y);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  if (opts?.fill) {
    const area = svgEl("path");
    area.setAttribute("d", `${d} L ${xFor(xMax)} ${yFor(0)} L ${xFor(xMin)} ${yFor(0)} Z`);
    area.setAttribute("fill", opts.fill);
    area.setAttribute("stroke", "none");
    svg.appendChild(area);
  }
  const path = svgEl("path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", opts?.stroke ?? "rgba(74,163,255,0.75)");
  path.setAttribute("stroke-width", "1.5");
  svg.appendChild(path);

  const yTop = svgEl("text");
  yTop.setAttribute("x", String(pad));
  yTop.setAttribute("y", "10");
  yTop.setAttribute("fill", "rgba(146,162,187,0.8)");
  yTop.setAttribute("font-size", "9");
  yTop.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
  yTop.textContent = `${Math.round(yMax)}${opts?.unit ? " " + opts.unit : ""}`;
  svg.appendChild(yTop);

  return { pad, width, height, xMin, xMax, xFor, yFor, yMax, h };
}

function renderGantt(svg: SVGSVGElement): void {
  const width = Number(svg.getAttribute("width")) || 600;
  const height = Number(svg.getAttribute("height")) || 200;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgClear(svg);
  if (!state.sim) return;
  const pad = 14;
  const w = width - pad * 2;
  const rowH = 16;
  const rowsMax = 12;
  const ordered = [...state.sim.baskets].sort((a, b) => a.createdAt - b.createdAt);
  const shown = ordered.slice(0, rowsMax);
  const ids = new Set(shown.map((b) => b.id));
  const evs = state.sim.events.filter((e) => e.basketId && ids.has(e.basketId)).sort((a, b) => a.t - b.t);
  const segsByBasket = new Map<string, { kind: string; at: string; start: number; end: number }[]>();
  for (const b of shown) segsByBasket.set(b.id, []);
  for (const e of evs) {
    if (e.kind === "load_done" && e.start != null && e.end != null) segsByBasket.get(e.basketId!)?.push({ kind: "load", at: "LOAD", start: e.start, end: e.end });
    if (e.kind === "unload_done" && e.start != null && e.end != null) segsByBasket.get(e.basketId!)?.push({ kind: "unload", at: "UNLOAD", start: e.start, end: e.end });
    if (e.kind === "transfer_done" && e.start != null && e.end != null) segsByBasket.get(e.basketId!)?.push({ kind: "transfer", at: `${e.from}->${e.to}`, start: e.start, end: e.end });
  }
  const lastDrop = new Map<string, { at: string; t: number }>();
  for (const e of evs) {
    if (e.kind === "drop" && e.t) lastDrop.set(e.basketId!, { at: e.to || "", t: e.t });
    if (e.kind === "pickup") {
      const d = lastDrop.get(e.basketId!);
      if (d && d.at === e.from && d.t < e.t && d.at !== "UNLOAD") segsByBasket.get(e.basketId!)?.push({ kind: "dwell", at: d.at, start: d.t, end: e.t });
    }
  }
  const tMax = Math.max(1, state.sim.simEnd);
  const xFor = (t: number) => pad + (t / tMax) * w;

  const axisY = height - 4;
  const axisLineY = height - 14;
  const axisLine = svgEl("line");
  axisLine.setAttribute("x1", String(pad));
  axisLine.setAttribute("x2", String(pad + w));
  axisLine.setAttribute("y1", String(axisLineY));
  axisLine.setAttribute("y2", String(axisLineY));
  axisLine.setAttribute("stroke", "rgba(255,255,255,0.1)");
  axisLine.setAttribute("stroke-width", "1");
  svg.appendChild(axisLine);

  const maxTicks = Math.max(2, Math.floor(w / 55));
  const candidateIntervals = [300, 600, 900, 1800, 3600, 7200];
  const tickIntervalSec = candidateIntervals.find((iv) => tMax / iv <= maxTicks) || 7200;
  for (let tt = 0; tt <= tMax; tt += tickIntervalSec) {
    const x = xFor(tt);
    const tick = svgEl("line");
    tick.setAttribute("x1", String(x));
    tick.setAttribute("x2", String(x));
    tick.setAttribute("y1", String(axisLineY));
    tick.setAttribute("y2", String(axisLineY + 4));
    tick.setAttribute("stroke", "rgba(146,162,187,0.4)");
    svg.appendChild(tick);
    const lbl = svgEl("text");
    lbl.setAttribute("x", String(x));
    lbl.setAttribute("y", String(axisY));
    lbl.setAttribute("text-anchor", "middle");
    lbl.setAttribute("fill", "rgba(146,162,187,0.6)");
    lbl.setAttribute("font-size", "9");
    lbl.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
    const mins = Math.round(tt / 60);
    lbl.textContent = mins >= 60 ? Math.floor(mins / 60) + "h" + (mins % 60 > 0 ? String(mins % 60).padStart(2, "0") + "m" : "") : mins + "m";
    svg.appendChild(lbl);
  }

  let y = pad;
  for (const b of shown) {
    const segs = (segsByBasket.get(b.id) || []).filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start).sort((a, b) => a.start - b.start);
    const label = svgEl("text");
    label.setAttribute("x", "3");
    label.setAttribute("y", String(y + rowH - 4));
    label.setAttribute("fill", "rgba(146,162,187,0.85)");
    label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "ui-monospace, Menlo, Monaco, Consolas, monospace");
    label.textContent = b.id;
    svg.appendChild(label);
    for (const s of segs) {
      const x1 = xFor(s.start);
      const x2 = xFor(s.end);
      const rect = svgEl("rect");
      rect.setAttribute("x", String(x1));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(Math.max(1, x2 - x1)));
      rect.setAttribute("height", String(rowH - 3));
      rect.setAttribute("rx", "2");
      function color(seg: { kind: string; at: string }): string {
        if (seg.kind === "transfer") return "rgba(146,162,187,0.22)";
        if (seg.kind === "load" || seg.kind === "unload") return "rgba(255,191,105,0.22)";
        if (seg.at === "WDO") return "rgba(74,163,255,0.20)";
        return "rgba(112,240,184,0.18)";
      }
      rect.setAttribute("fill", color(s));
      rect.setAttribute("stroke", "rgba(255,255,255,0.06)");
      const title = svgEl("title");
      title.textContent = `${s.kind}: ${s.at} (${(s.end - s.start).toFixed(0)}s)`;
      rect.appendChild(title);
      svg.appendChild(rect);
    }
    y += rowH;
  }
}

function updateResults(): void {
  if (!state.sim || !state.params) return;
  const s = state.sim;
  const p = state.params;

  const achieved = Number.isFinite(s.throughputTrimmedBph) ? s.throughputTrimmedBph : Number.isFinite(s.throughputSteadyBph) ? s.throughputSteadyBph : s.throughputBph;
  const delta = pctDelta(achieved, p.targetBph);
  ui.kpiThroughput.textContent = s.throughputStatus === "insufficient_data" ? "N/A" : `${achieved.toFixed(2)}`;
  ui.kpiThroughput.className = "kpi-card__value mono" + (delta != null ? (delta >= 0 ? " kpi-card__value--ok" : " kpi-card__value--bad") : "");
  const deltaStr = delta != null ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%)` : "";
  ui.kpiThroughputSub.textContent = `target: ${p.targetBph.toFixed(2)} bph${deltaStr}`;

  ui.kpiLeadTime.textContent = formatSeconds(s.avgLeadTimeSec);
  const b = state.plan?.buckets;
  ui.kpiLeadTimeSub.textContent = b ? `manual ${formatTimeShort(b.manual)} | dwell ${formatTimeShort(b.dwell)} | travel ${formatTimeShort(b.travel)}` : "-";

  const bottleneckLabels: Record<string, string> = { dest_full: "Tank occupied", wagon_busy: "Wagon busy", unload_busy: "Unload busy", load_busy: "Load busy", none: "None" };
  ui.kpiBottleneck.textContent = bottleneckLabels[s.bottleneck] || s.bottleneck;
  ui.kpiBottleneck.className = "kpi-card__value mono" + (s.bottleneck !== "none" ? " kpi-card__value--warn" : " kpi-card__value--ok");
  ui.kpiBottleneckSub.textContent = `tank-full: ${s.waits.dest_full} | wagon: ${s.waits.wagon_busy}`;

  ui.kpiViolations.textContent = String(s.violations.length);
  ui.kpiViolations.className = "kpi-card__value mono" + (s.violations.length > 0 ? " kpi-card__value--bad" : " kpi-card__value--ok");
  ui.kpiViolationsSub.textContent = s.violations.length === 0 ? "all within tolerance" : `${s.violations.length} over-dwell events`;

  const avgWagonUtil = s.util.wagons.length ? s.util.wagons.reduce((a, w) => a + w.util01, 0) / s.util.wagons.length : 0;
  ui.kpiWagonUtil.textContent = formatPct01(avgWagonUtil);
  ui.kpiWagonUtil.className = "kpi-card__value mono" + (avgWagonUtil > 0.9 ? " kpi-card__value--bad" : avgWagonUtil > 0.7 ? " kpi-card__value--warn" : "");
  ui.kpiWagonUtilSub.textContent = s.util.wagons.map((w) => `${w.id}: ${formatPct01(w.util01)}`).join(" | ");

  const inv = s.inventory;
  if (inv && ui.kpiOptimalWip) {
    const optWip = Number.isFinite(inv.optimalWip) ? inv.optimalWip : 0;
    ui.kpiOptimalWip.textContent = Number.isFinite(optWip) ? optWip.toFixed(1) : "-";
    if (inv.isOverfeeding) {
      ui.kpiOptimalWip.className = "kpi-card__value mono kpi-card__value--warn";
      ui.kpiOptimalWipSub.textContent = "actual avg " + inv.avgWip.toFixed(1) + " | overfeeding by " + ((p.targetBph - inv.recommendedBph) / inv.recommendedBph * 100).toFixed(0) + "%";
    } else {
      ui.kpiOptimalWip.className = "kpi-card__value mono kpi-card__value--ok";
      ui.kpiOptimalWipSub.textContent = "actual avg " + inv.avgWip.toFixed(1) + " | balanced";
    }
  }

  ui.recipeSummary.textContent = `${p.tankCount} tanks, ${p.preset.toUpperCase()}`;
  ui.manualSummary.textContent = `Load ${p.loadTimeMin}m, Unload ${p.unloadTimeMin}m`;
  ui.transportSummary.textContent = `${p.wagonCount} wagon${p.wagonCount > 1 ? "s" : ""}, ${p.wagonSpeedMPerMin} m/min`;
  ui.simSettingsSummary.textContent = `${p.basketCount} baskets, ${p.simHours}hr`;

  renderStationMetrics();
  renderWagonMetrics();
  renderLoadingMetrics();
  state.chartsStale = true;
}

function renderStationMetrics(): void {
  ui.stationMetricsBody.textContent = "";
  if (!state.sim) return;
  const stations = state.sim.util.stations.filter((s) => s.id !== "LOAD" && s.id !== "UNLOAD");
  for (const st of stations) {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = st.id;
    td1.style.fontWeight = "600";

    const td2 = document.createElement("td");
    const pct = Math.round(clamp(st.util01, 0, 1) * 100);
    const barColor = pct > 85 ? "util-high" : pct > 60 ? "util-med" : "util-low";
    td2.innerHTML = `<span class="station-util-bar ${barColor}" style="width:${Math.max(2, pct * 0.6)}px"></span><span class="mono small">${pct}%</span>`;

    const td3 = document.createElement("td");
    td3.className = "mono small";
    td3.textContent = Number.isFinite(st.avgDwellSec) ? formatTimeShort(st.avgDwellSec) : "-";

    const td4 = document.createElement("td");
    td4.className = "mono small";
    td4.textContent = Number.isFinite(st.targetDwellSec) && st.targetDwellSec > 0 ? formatTimeShort(st.targetDwellSec) : "-";

    const td5 = document.createElement("td");
    if (st.violationCount > 0) td5.innerHTML = `<span class="badge badge--bad">${st.violationCount}</span>`;
    else td5.innerHTML = `<span class="badge badge--ok">0</span>`;

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    ui.stationMetricsBody.appendChild(tr);
  }
}

function renderWagonMetrics(): void {
  ui.wagonMetricsBody.textContent = "";
  if (!state.sim) return;
  for (const w of state.sim.util.wagons) {
    const card = document.createElement("div");
    card.className = "wagon-card";
    const total = w.movingSec + w.handlingSec + w.waitingSec + w.blockedSec;
    const utilPct = total > 0 ? Math.round(((w.movingSec + w.handlingSec) / total) * 100) : 0;
    const mPct = total > 0 ? (w.movingSec / total) * 100 : 0;
    const hPct = total > 0 ? (w.handlingSec / total) * 100 : 0;
    const bPct = total > 0 ? (w.blockedSec / total) * 100 : 0;
    const barColor = utilPct > 85 ? "var(--danger)" : utilPct > 60 ? "var(--warn)" : "var(--accent2)";
    card.innerHTML = `
      <div class="wagon-card__header">
        <span class="wagon-card__name">${escapeHtml(w.id)}</span>
        <span class="wagon-card__util" style="color:${barColor}">${utilPct}%</span>
      </div>
      <div class="wagon-card__bar">
        <div class="wagon-card__bar-segment wagon-card__bar-moving" style="width:${mPct}%"></div>
        <div class="wagon-card__bar-segment wagon-card__bar-handling" style="width:${hPct}%"></div>
        <div class="wagon-card__bar-segment wagon-card__bar-blocked" style="width:${bPct}%"></div>
      </div>
      <div class="wagon-card__details">
        <div>Moving <span class="wagon-card__detail-value">${formatTimeShort(w.movingSec)}</span></div>
        <div>Handling <span class="wagon-card__detail-value">${formatTimeShort(w.handlingSec)}</span></div>
        <div>Waiting <span class="wagon-card__detail-value">${formatTimeShort(w.waitingSec)}</span></div>
        <div>Blocked <span class="wagon-card__detail-value">${formatTimeShort(w.blockedSec)}</span></div>
        <div>Zone <span class="wagon-card__detail-value">${w.zone ? w.zone.label : "-"}</span></div>
      </div>`;
    ui.wagonMetricsBody.appendChild(card);
  }
}

function renderLoadingMetrics(): void {
  if (!state.sim || !state.sim.loading) return;
  const ld = state.sim.loading;
  const p = state.params!;

  ui.loadingKvGrid.innerHTML = "";
  const kvs: { label: string; value: string }[] = [
    { label: "Avg Queue Wait", value: formatTimeShort(ld.avgQueueWaitSec) },
    { label: "Max Queue Depth", value: String(ld.maxQueueDepth) },
    { label: "Loading Util", value: formatPct01(ld.processingUtil01) },
    { label: "Baskets Loaded", value: String(ld.totalBasketsLoaded) },
    { label: "Load Time", value: `${p.loadTimeMin} min` },
    { label: "Unload Time", value: `${p.unloadTimeMin} min` },
  ];
  for (const kv of kvs) {
    const item = document.createElement("div");
    item.className = "kv-item";
    item.innerHTML = `<div class="kv-item__label">${escapeHtml(kv.label)}</div><div class="kv-item__value">${escapeHtml(kv.value)}</div>`;
    ui.loadingKvGrid.appendChild(item);
  }

  const inv = state.sim.inventory;
  const invGrid = document.getElementById("inventoryKvGrid");
  const invInsight = document.getElementById("inventoryInsight");
  if (inv && invGrid) {
    invGrid.innerHTML = "";
    const invKvs: { label: string; value: string }[] = [
      { label: "Optimal WIP", value: Number.isFinite(inv.optimalWip) ? inv.optimalWip.toFixed(1) + " baskets" : "-" },
      { label: "Actual Avg WIP", value: inv.avgWip.toFixed(1) + " baskets" },
      { label: "Max WIP", value: String(inv.maxWip) + " baskets" },
      { label: "Excess Inventory", value: inv.excessWip.toFixed(1) + " baskets" },
      { label: "Recommended Rate", value: inv.recommendedBph.toFixed(2) + " bph" },
      { label: "Current Arrival", value: inv.arrivalBph.toFixed(2) + " bph" },
    ];
    for (const kv of invKvs) {
      const item = document.createElement("div");
      item.className = "kv-item";
      item.innerHTML = '<div class="kv-item__label">' + escapeHtml(kv.label) + '</div><div class="kv-item__value">' + escapeHtml(kv.value) + '</div>';
      invGrid.appendChild(item);
    }
  }
  if (inv && invInsight) {
    if (inv.isOverfeeding) {
      const overPct = ((inv.arrivalBph - inv.recommendedBph) / inv.recommendedBph * 100).toFixed(0);
      invInsight.className = "inventory-insight inventory-insight--warn";
      invInsight.innerHTML = '<strong>Overfeeding detected.</strong> You are pushing baskets ' + overPct
        + '% faster than the system can process. '
        + 'The bottleneck processes at ' + inv.recommendedBph.toFixed(2) + ' bph but baskets arrive at ' + inv.arrivalBph.toFixed(2) + ' bph. '
        + 'This creates excess WIP of ~' + inv.excessWip.toFixed(1) + ' baskets waiting in the system — wasted staging space and capital. '
        + '<br><br><strong>Recommendation:</strong> Reduce arrival rate to ~' + inv.recommendedBph.toFixed(1) + ' bph (match the bottleneck), '
        + 'or resolve the bottleneck (' + escapeHtml(state.sim.bottleneck) + ') to increase system capacity.';
    } else {
      invInsight.className = "inventory-insight";
      invInsight.innerHTML = '<strong>Inventory is balanced.</strong> The arrival rate (' + inv.arrivalBph.toFixed(2) + ' bph) is within the system capacity ('
        + inv.recommendedBph.toFixed(2) + ' bph). '
        + 'Optimal WIP is ~' + (Number.isFinite(inv.optimalWip) ? inv.optimalWip.toFixed(1) : "-") + ' baskets in the system at any time. '
        + 'Keep ' + (Number.isFinite(inv.recommendedBuffer) ? inv.recommendedBuffer : 1) + ' basket(s) prepared at loading to prevent bottleneck starvation.';
    }
  }

  const loadEvents = (state.sim.events || []).filter((e) => e.kind === "load_done");
  if (loadEvents.length > 0) {
    const simEnd = state.sim.simEnd;
    const series: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const e of loadEvents) {
      if (e.start == null || e.end == null) continue;
      series.push({ x: e.start, y: 0 });
      series.push({ x: e.start, y: 1 });
      series.push({ x: e.end, y: 1 });
      series.push({ x: e.end, y: 0 });
    }
    series.push({ x: simEnd, y: 0 });
    renderLineChart(ui.loadingQueueSvg, series, {
      stroke: "rgba(74,222,128,0.80)", fill: "rgba(74,222,128,0.15)", yMax: 1, unit: "busy",
    });
  }
}

function renderCharts(): void {
  if (!state.sim?.snapshots?.length) return;
  if (!state.chartsStale && state.chartMeta) return;

  const snaps = state.sim.snapshots;
  const windowSec = 600;
  const step = 10;
  const byIdx = new Map(snaps.map((s, i) => [Math.floor(s.t / step), i]));

  const throughputSeries: { x: number; y: number }[] = [];
  for (const s of snaps) {
    const t0 = Math.max(0, s.t - windowSec);
    const i0 = byIdx.get(Math.floor(t0 / step)) ?? 0;
    const s0 = snaps[i0];
    const dC = s.completed - s0.completed;
    throughputSeries.push({ x: s.t, y: (dC / Math.max(1, s.t - s0.t)) * 3600 });
  }

  const wipSeries: { x: number; y: number }[] = [];
  for (const s of snaps) {
    const lc = s.locCounts || {};
    const tanks = Object.keys(lc).filter((k) => k.startsWith("T")).reduce((a, k) => a + (lc[k] || 0), 0);
    wipSeries.push({ x: s.t, y: (lc.LOADQ || 0) + (lc.UNLOADQ || 0) + (lc.IN_TRANSIT || 0) + (lc.WDO || 0) + tanks });
  }

  const meta1 = renderLineChart(ui.throughputSvg, throughputSeries, { stroke: "rgba(74,163,255,0.80)", fill: "rgba(74,163,255,0.12)", yMax: state.params?.targetBph ?? 0, unit: "b/hr" });
  const meta2 = renderLineChart(ui.wipSvg, wipSeries, { stroke: "rgba(112,240,184,0.80)", fill: "rgba(112,240,184,0.10)", unit: "items" });
  state.chartMeta = { throughput: meta1, wip: meta2 };

  const targetBph = state.params?.targetBph ?? 0;
  if (targetBph > 0) {
    const yTarget = meta1.yFor(targetBph);
    const tLine = svgEl("line");
    tLine.setAttribute("x1", String(meta1.pad));
    tLine.setAttribute("x2", String(meta1.width - meta1.pad));
    tLine.setAttribute("y1", String(yTarget));
    tLine.setAttribute("y2", String(yTarget));
    tLine.setAttribute("stroke", "rgba(255,191,105,0.5)");
    tLine.setAttribute("stroke-dasharray", "4 3");
    tLine.setAttribute("stroke-width", "1");
    ui.throughputSvg.appendChild(tLine);
  }

  renderGantt(ui.ganttSvg);
  state.chartsStale = false;
}

export function exportSummaryText(): string {
  if (!state.params || !state.sim) return "No simulation results yet.";
  const p = state.params;
  const s = state.sim;
  const tankDwells = p.recipeSteps.filter((x) => x.kind === "tank").map((x) => `${x.id}:${(x.dwellSec / 60).toFixed(1)}m`).join(", ");
  const tankTols = p.recipeSteps.filter((x) => x.kind === "tank").map((x) => `${x.id}:±${Math.round((x.tolerancePct ?? 0.1) * 100)}%`).join(", ");
  const lines: string[] = [
    "Pretreatment Transporter Simulation Summary",
    `Date: ${new Date().toLocaleString()}`, "",
    `Recipe: ${p.preset} | Tanks: ${p.tankCount} | WDO: ${p.wdoTimeMin}m`,
    `Tank dwells: ${tankDwells}`,
    `Tank tolerances: ${tankTols}`,
    `Load: ${p.loadTimeMin}m | Unload: ${p.unloadTimeMin}m | Drip: ${p.dripTimeSec}s`, "",
    `Wagons: ${p.wagonCount} | Baskets: ${p.basketCount} | Speed: ${p.wagonSpeedMPerMin} m/min`,
    `Lift+Lower: ${p.liftLowerSec}s | Pick+Drop: ${p.pickDropSec}s`, "",
    `Sim: ${p.simHours}hr`,
    `Achieved: ${s.throughputBph.toFixed(2)} bph`,
    `Lead time: ${formatSeconds(s.avgLeadTimeSec)}`,
    `Violations: ${s.violations.length} | Bottleneck: ${s.bottleneck}`, "",
    "Wagon utilization:",
    ...s.util.wagons.map((w) => `  ${w.id}: ${formatPct01(w.util01)}`),
    "", "Station utilization:",
    ...s.util.stations.filter((st) => st.dwellCount > 0).map((st) => `  ${st.id}: ${formatPct01(st.util01)} (avg dwell ${formatTimeShort(st.avgDwellSec)}, violations ${st.violationCount})`),
  ];
  return lines.join("\n");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function switchTab(tabId: string): void {
  state.activeTab = tabId;
  document.querySelectorAll(".metrics-tab").forEach((btn) => {
    const active = btn.getAttribute("data-tab") === tabId;
    btn.classList.toggle("metrics-tab--active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".metrics-content").forEach((el) => {
    (el as HTMLElement).hidden = el.getAttribute("data-tab-content") !== tabId;
  });
  if (tabId === "charts") { state.chartsStale = true; renderCharts(); }
}

export function recomputeAndRender(): void {
  recomputePlan();
  updateResults();
}

export async function setupConfigPanel(): Promise<void> {
  rebuildTankTable(Number(ui.tankCount.value), Number(ui.dwellPreset.value));

  document.querySelectorAll(".metrics-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab") || ""));
  });

  ui.tankCount.addEventListener("input", () => {
    rebuildTankTable(Number(ui.tankCount.value), Number(ui.dwellPreset.value));
    if (ui.autoRun.checked) recomputeAndRender();
  });
  ui.recipePreset.addEventListener("change", () => {
    const preset = ui.recipePreset.value;
    let dwell = Number(ui.dwellPreset.value);
    if (preset === "ms") dwell = 2.5;
    if (preset === "al") dwell = 1.5;
    ui.dwellPreset.value = String(dwell);
    if (preset !== "custom") rebuildTankTable(Number(ui.tankCount.value), dwell);
    if (ui.autoRun.checked) recomputeAndRender();
  });

  for (const id of ["wdoTimeMin", "loadTimeMin", "unloadTimeMin", "dripTimeSec", "simHours", "wagonSpeedMPerMin", "liftLowerSec", "pickDropSec", "wagonCount", "distanceMode", "layoutMode", "basketCount"]) {
    const e = document.getElementById(id);
    if (e) e.addEventListener("input", () => { if (ui.autoRun.checked) recomputeAndRender(); });
  }

  if (ui.exportSummaryBtn) {
    ui.exportSummaryBtn.addEventListener("click", async () => {
      const text = exportSummaryText();
      const ok = await copyToClipboard(text);
      if (ok) { ui.exportSummaryBtn!.textContent = "Copied!"; setTimeout(() => { if (ui.exportSummaryBtn) ui.exportSummaryBtn.textContent = "Export"; }, 1500); }
      else { ui.summaryInline.hidden = false; ui.summaryText.value = text; }
    });
  }
  ui.summarySelectBtn.addEventListener("click", () => { ui.summaryText.focus(); ui.summaryText.select(); });
  ui.summaryHideBtn.addEventListener("click", () => { ui.summaryInline.hidden = true; });
}
