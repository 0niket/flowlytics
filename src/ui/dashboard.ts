import type { EconomicsResult, SimPlan, SimulationResult } from "../types";
import type { LineConfig } from "../builder/LineConfig";
import { formatCurrency, countUniqueViolatedBaskets } from "../engine/economics";
import type { Violation } from "../types";

function escapeHtml(s: string): string {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtPct(value: number): string {
  if (!isFinite(value)) return "\u221E";
  return value.toFixed(1) + "%";
}

function fmtBph(value: number): string {
  if (!isFinite(value)) return "\u221E";
  return value.toFixed(1) + " bph";
}

/**
 * Renders the pinned economics hero section: profit/hr card and missing-config notice.
 */
export function renderPinnedEconomics(
  economics: EconomicsResult,
  config: LineConfig,
  container: HTMLElement,
): void {
  container.textContent = "";

  const articlesPerBasket = config.transport.maxArticlesPerBasket ?? 0;
  const hasRevenue = config.economics.revenuePerArticle > 0 && articlesPerBasket > 0;

  if (!hasRevenue) return;

  // Profit/Hr Hero Card
  const profitable = economics.profitPerHr >= 0;
  const hero = document.createElement("div");
  hero.className = `financial-card financial-card--hero`;
  hero.style.borderLeftColor = profitable ? "var(--accent2)" : "var(--danger)";

  const marginBadgeClass = profitable ? "badge--ok" : "badge--bad";
  const valueColor = profitable ? "var(--accent2)" : "var(--danger)";

  hero.innerHTML = `
    <div class="financial-card__header">
      <span>PROFIT / HOUR</span>
      <span class="badge ${marginBadgeClass}">${fmtPct(economics.profitMarginPct)} margin</span>
    </div>
    <div class="financial-card__value" style="color:${valueColor}">
      ${formatCurrency(economics.profitPerHr)} /hr
    </div>
    <div class="financial-card__detail">
      Revenue: ${formatCurrency(economics.revenuePerHr)}/hr &nbsp;&nbsp; Costs: ${formatCurrency(economics.totalCostPerHr)}/hr
    </div>
    <div class="financial-card__detail">
      ${economics.throughputBph.toFixed(1)} bph \u00D7 ${articlesPerBasket} articles \u00D7 ${formatCurrency(config.economics.revenuePerArticle)}/article
    </div>
  `;
  container.appendChild(hero);
}

/**
 * Renders the overview tab: cost breakdown, capex, and unit economics cards.
 */
export function renderOverviewTab(
  economics: EconomicsResult,
  config: LineConfig,
  container: HTMLElement,
): void {
  container.textContent = "";

  const articlesPerBasket = config.transport.maxArticlesPerBasket ?? 0;
  const hasRevenue = config.economics.revenuePerArticle > 0 && articlesPerBasket > 0;
  if (!hasRevenue) return;

  const hasCosts = economics.totalCostPerHr > 0;

  // Cost Breakdown Card
  if (hasCosts) {
    const costCard = document.createElement("div");
    costCard.className = "financial-card";

    let costHtml = `
      <div class="financial-card__header">
        <span>COSTS / HOUR</span>
        <span style="font-size:13px;font-weight:600;">${formatCurrency(economics.totalCostPerHr)} /hr</span>
      </div>
    `;

    // Raw Materials
    if (economics.costBreakdown.rawMaterialPerHr > 0) {
      const rawCostPerArticle = config.transport.rawMaterialCostPerArticle ?? 0;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Raw Materials</span><span>${formatCurrency(economics.costBreakdown.rawMaterialPerHr)} /hr</span></div>`;
      costHtml += `<div class="cost-group__item">${articlesPerBasket} articles \u00D7 ${formatCurrency(rawCostPerArticle)}/article \u00D7 ${economics.throughputBph.toFixed(1)} bph</div>`;
      costHtml += `</div>`;
    }

    // Chemicals
    if (economics.costBreakdown.chemicalPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Chemicals</span><span>${formatCurrency(economics.costBreakdown.chemicalPerHr)} /hr</span></div>`;
      for (const station of config.stations) {
        if (station.kind !== "tank") continue;
        const cap = station.tankCapacityLitres;
        const costPerL = station.chemicalCostPerLitre;
        const bathLife = station.bathLifeHours;
        if (cap != null && cap > 0 && costPerL != null && costPerL > 0 && bathLife != null && bathLife > 0) {
          const perHr = (cap * costPerL) / bathLife;
          costHtml += `<div class="cost-group__item">${escapeHtml(station.id)}: ${cap}L \u00D7 ${formatCurrency(costPerL)}/L \u00F7 ${bathLife}h = ${formatCurrency(perHr)}/hr</div>`;
        }
      }
      costHtml += `</div>`;
    }

    // Labour
    if (economics.costBreakdown.laborPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Labour</span><span>${formatCurrency(economics.costBreakdown.laborPerHr)} /hr</span></div>`;
      for (const station of config.stations) {
        if (station.kind !== "loading" && station.kind !== "unloading") continue;
        const count = station.labourCount;
        const costPerHr = station.labourCostPerHr;
        if (count != null && count > 0 && costPerHr != null && costPerHr > 0) {
          const label = station.kind === "loading" ? "Loading" : "Unloading";
          costHtml += `<div class="cost-group__item">${label}: ${count} operator${count !== 1 ? "s" : ""} \u00D7 ${formatCurrency(costPerHr)}/hr</div>`;
        }
      }
      costHtml += `</div>`;
    }

    // WDO Operating Cost
    if (economics.costBreakdown.wdoCostPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>WDO Operating</span><span>${formatCurrency(economics.costBreakdown.wdoCostPerHr)} /hr</span></div>`;
      for (const station of config.stations) {
        if (station.kind !== "wdo") continue;
        const opCost = station.operatingCostPerHr;
        if (opCost != null && opCost > 0) {
          costHtml += `<div class="cost-group__item">${escapeHtml(station.id)}: ${formatCurrency(opCost)}/hr</div>`;
        }
      }
      costHtml += `</div>`;
    }

    // Energy
    if (economics.costBreakdown.energyPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Energy</span><span>${formatCurrency(economics.costBreakdown.energyPerHr)} /hr</span></div>`;
      costHtml += `<div class="cost-group__item">plant-level energy cost (configured)</div>`;
      costHtml += `</div>`;
    }

    // Maintenance
    if (economics.costBreakdown.maintenancePerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Maintenance</span><span>${formatCurrency(economics.costBreakdown.maintenancePerHr)} /hr</span></div>`;
      costHtml += `<div class="cost-group__item">plant-level maintenance cost (configured)</div>`;
      costHtml += `</div>`;
    }

    // Depreciation
    if (economics.costBreakdown.depreciationPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Depreciation</span><span>${formatCurrency(economics.costBreakdown.depreciationPerHr)} /hr</span></div>`;
      // Per-wagon depreciation
      const wagons = config.transport.wagons ?? [];
      for (const w of wagons) {
        if (w.costRs != null && w.costRs > 0) {
          const life = w.usefulLifeYears ?? 0;
          const opHrs = w.operatingHoursPerYear ?? 0;
          const totalHours = life * opHrs;
          if (totalHours > 0) {
            const perHr = w.costRs / totalHours;
            costHtml += `<div class="cost-group__item">${escapeHtml(w.id)}: ${formatCurrency(w.costRs)} \u00F7 (${life}yr \u00D7 ${opHrs}h/yr) = ${formatCurrency(perHr)}/hr</div>`;
          }
        }
      }
      // Per-station equipment depreciation
      for (const station of config.stations) {
        const cost = station.equipmentCostRs;
        if (cost != null && cost > 0) {
          const life = station.equipmentLifeYears ?? 0;
          const opHrs = station.equipmentOperatingHoursPerYear ?? 0;
          const totalHours = life * opHrs;
          if (totalHours > 0) {
            const perHr = cost / totalHours;
            costHtml += `<div class="cost-group__item">${escapeHtml(station.id)}: ${formatCurrency(cost)} \u00F7 (${life}yr \u00D7 ${opHrs}h/yr) = ${formatCurrency(perHr)}/hr</div>`;
          }
        }
      }
      costHtml += `</div>`;
    }

    costCard.innerHTML = costHtml;
    container.appendChild(costCard);
  }

  // Capex Section
  if (economics.capex.totalWagonCost > 0 || economics.capex.totalStationEquipmentCost > 0) {
    const capexCard = document.createElement("div");
    capexCard.className = "financial-card";

    let capexHtml = `<div class="financial-card__header"><span>ONE-TIME CAPEX</span></div>`;

    if (economics.capex.totalWagonCost > 0) {
      const wagonCount = config.transport.wagons?.length ?? config.transport.wagonCount;
      capexHtml += `
        <div class="cost-group__header" style="margin-top:8px;">
          <span>Wagons (${wagonCount}\u00D7)</span>
          <span>${formatCurrency(economics.capex.totalWagonCost)}</span>
        </div>
      `;
      const wagons = config.transport.wagons ?? [];
      for (const w of wagons) {
        if (w.costRs != null && w.costRs > 0) {
          capexHtml += `<div class="cost-group__item">${escapeHtml(w.id)}: ${formatCurrency(w.costRs)}</div>`;
          const life = w.usefulLifeYears ?? 0;
          const opHrs = w.operatingHoursPerYear ?? 0;
          const totalHours = life * opHrs;
          if (totalHours > 0) {
            const perHr = w.costRs / totalHours;
            capexHtml += `<div class="cost-group__item">\u21B3 ${formatCurrency(w.costRs)} \u00F7 (${life}yr \u00D7 ${opHrs}h) = ${formatCurrency(perHr)}/hr amortised</div>`;
          }
        }
      }
    }

    if (economics.capex.totalStationEquipmentCost > 0) {
      capexHtml += `
        <div class="cost-group__header" style="margin-top:8px;">
          <span>Station Equipment</span>
          <span>${formatCurrency(economics.capex.totalStationEquipmentCost)}</span>
        </div>
      `;
      for (const station of config.stations) {
        const cost = station.equipmentCostRs;
        if (cost != null && cost > 0) {
          capexHtml += `<div class="cost-group__item">${escapeHtml(station.id)}: ${formatCurrency(cost)}</div>`;
          const life = station.equipmentLifeYears ?? 0;
          const opHrs = station.equipmentOperatingHoursPerYear ?? 0;
          const totalHours = life * opHrs;
          if (totalHours > 0) {
            const perHr = cost / totalHours;
            capexHtml += `<div class="cost-group__item">\u21B3 ${formatCurrency(cost)} \u00F7 (${life}yr \u00D7 ${opHrs}h) = ${formatCurrency(perHr)}/hr amortised</div>`;
          }
        }
      }
    }

    // Total amortised depreciation
    if (economics.costBreakdown.depreciationPerHr > 0) {
      capexHtml += `<hr class="separator" />`;
      capexHtml += `<div class="cost-group__header" style="font-size:11px;color:var(--muted);"><span>Total amortised depreciation</span><span style="color:var(--text);">${formatCurrency(economics.costBreakdown.depreciationPerHr)}/hr</span></div>`;
    }

    capexCard.innerHTML = capexHtml;
    container.appendChild(capexCard);
  }

  // Unit Economics Card
  if (hasCosts && hasRevenue) {
    const unitCard = document.createElement("div");
    unitCard.className = "financial-card";

    const breakEvenColor = economics.throughputBph > economics.breakEvenBph
      ? "var(--accent2)"
      : "var(--danger)";

    unitCard.innerHTML = `
      <div class="financial-card__header"><span>UNIT ECONOMICS</span></div>
      <div class="grid3" style="margin-top:8px;">
        <div>
          <div class="unit-metric__label">Cost/basket</div>
          <div class="unit-metric__value">${formatCurrency(economics.unitEconomics.costPerBasket)}</div>
          <div class="unit-metric__detail">${formatCurrency(economics.totalCostPerHr)}/hr \u00F7 ${economics.throughputBph.toFixed(1)} bph = ${formatCurrency(economics.unitEconomics.costPerBasket)}</div>
        </div>
        <div>
          <div class="unit-metric__label">Cost/article</div>
          <div class="unit-metric__value">${formatCurrency(economics.unitEconomics.costPerArticle)}</div>
          <div class="unit-metric__detail">${formatCurrency(economics.unitEconomics.costPerBasket)} \u00F7 ${articlesPerBasket} articles = ${formatCurrency(economics.unitEconomics.costPerArticle)}</div>
        </div>
        <div>
          <div class="unit-metric__label">Break-even</div>
          <div class="unit-metric__value" style="color:${breakEvenColor}">${fmtBph(economics.breakEvenBph)}</div>
          <div class="unit-metric__detail">${formatCurrency(economics.totalCostPerHr)}/hr \u00F7 ${formatCurrency(economics.unitEconomics.revenuePerBasket)}/basket = ${economics.breakEvenBph.toFixed(1)} bph</div>
        </div>
      </div>
    `;
    container.appendChild(unitCard);
  }

}

function fmtSec(sec: number): string {
  if (sec >= 60) {
    const min = sec / 60;
    return min.toFixed(1) + "m";
  }
  return sec.toFixed(0) + "s";
}

// ─── Gantt chart helpers ──────────────────────────────────────

const GANTT_STATE_COLORS: Record<string, string> = {
  LOADING: "#da3633",
  IN_TRANSIT: "#a371f7",
  UNLOADING: "#3fb950",
  WAITING_LOAD: "#21262d",
  WAITING_UNLOAD: "#21262d",
  READY_FOR_PICKUP: "#e3b341",
  DONE: "#30363d",
  FAILED: "#ff6b6b",
};

const GANTT_TANK_COLORS: Record<string, string> = {
  T1: "#58a6ff", T2: "#388bfd", T3: "#1f6feb", T4: "#1a7f37",
  WDO: "#d29922",
};

function ganttColor(state: string, station: string): string {
  if (state === "IN_TANK") return GANTT_TANK_COLORS[station] ?? "#58a6ff";
  return GANTT_STATE_COLORS[state] ?? "#30363d";
}

function extractStation(reason: string): string {
  const m = reason.match(/dropped_at_(\w+)/);
  return m ? m[1] : "";
}

interface GanttSegment {
  start: number;
  end: number;
  state: string;
  station: string;
  color: string;
  isWaiting: boolean;
}

function basketToSegments(
  history: { timestamp: number; fromState: string; toState: string; reason: string }[],
  simEnd: number,
): GanttSegment[] {
  const segments: GanttSegment[] = [];
  for (let i = 0; i < history.length; i++) {
    const tr = history[i];
    const nextTr = history[i + 1];
    const start = tr.timestamp;
    const end = nextTr ? nextTr.timestamp : simEnd;
    const state = tr.toState;
    const station = state === "IN_TANK" ? extractStation(tr.reason) : "";
    const isWaiting = state === "WAITING_LOAD" || state === "WAITING_UNLOAD" || state === "DONE";
    segments.push({ start, end, state, station, color: ganttColor(state, station), isWaiting });
  }
  return segments;
}

const GANTT_LEGEND = [
  { label: "Loading", color: "#da3633" },
  { label: "Dwell", color: "#58a6ff" },
  { label: "WDO", color: "#d29922" },
  { label: "Transit", color: "#a371f7" },
  { label: "Unloading", color: "#3fb950" },
  { label: "Ready", color: "#e3b341" },
  { label: "Wait/Idle", color: "#21262d" },
];

/**
 * Renders the throughput tab: hero, formula, and simulation Gantt chart.
 */
export function renderThroughputTab(
  economics: EconomicsResult,
  plan: SimPlan,
  sim: SimulationResult,
  container: HTMLElement,
): void {
  container.textContent = "";

  // Hero card — pipeline throughput from simulation
  const heroCard = document.createElement("div");
  heroCard.className = "financial-card";
  const singleBasketBph = plan.cycleSeconds > 0 ? (3600 / plan.cycleSeconds) : 0;
  heroCard.innerHTML = `
    <div class="throughput-hero">
      <div class="throughput-hero__value">${economics.throughputBph.toFixed(1)}<span class="throughput-hero__unit"> bph</span></div>
      <div class="throughput-hero__sub">${economics.completedCount} baskets completed in ${economics.simHours}h simulation</div>
      <div class="throughput-hero__sub" style="color:var(--muted);">pipeline throughput \u2014 multiple baskets move through stations simultaneously</div>
    </div>
  `;
  container.appendChild(heroCard);

  // Throughput formula
  const formulaCard = document.createElement("div");
  formulaCard.className = "financial-card";
  formulaCard.innerHTML = `
    <div class="financial-card__header"><span>THROUGHPUT FORMULA</span></div>
    <div class="formula-box">
      <div class="formula-box__main">single-basket cycle = ${plan.cycleSeconds.toFixed(0)}s (${fmtSec(plan.cycleSeconds)})</div>
      <div class="formula-box__detail">3600s \u00F7 ${plan.cycleSeconds.toFixed(0)}s = ${singleBasketBph.toFixed(1)} bph if only 1 basket in the line</div>
      <div class="formula-box__detail" style="margin-top:4px;">With ${economics.completedCount} baskets pipelining through ${plan.steps.filter(s => s.type === "dwell").length} stations: ${economics.throughputBph.toFixed(1)} bph (measured from simulation)</div>
    </div>
  `;
  container.appendChild(formulaCard);

  // Simulation Timeline Gantt
  const basketsWithHistory = sim.baskets.filter(b => b.stateHistory && b.stateHistory.length > 0);
  if (basketsWithHistory.length === 0) return;

  const ganttCard = document.createElement("div");
  ganttCard.className = "financial-card";

  // Header
  const header = document.createElement("div");
  header.className = "financial-card__header";
  header.innerHTML = `<span>SIMULATION TIMELINE</span><span style="font-size:11px;color:var(--muted);">${basketsWithHistory.length} baskets \u00B7 ${(sim.simEnd / 3600).toFixed(1)}h</span>`;
  ganttCard.appendChild(header);

  // Legend
  const legend = document.createElement("div");
  legend.className = "gantt-legend";
  for (const item of GANTT_LEGEND) {
    const el = document.createElement("div");
    el.className = "gantt-legend__item";
    el.innerHTML = `<span class="gantt-legend__dot" style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${item.color};"></span>${escapeHtml(item.label)}`;
    legend.appendChild(el);
  }
  ganttCard.appendChild(legend);

  // Gantt body: labels + scrollable area
  const ROW_H = 26;
  const LABEL_W = 56;
  const PX_PER_SEC = 0.15; // 540px per hour — reasonable for 4h sim
  const canvasWidth = Math.ceil(sim.simEnd * PX_PER_SEC) + 20;
  const maxHeight = Math.min(basketsWithHistory.length * ROW_H + 28, 400); // 28 for time axis

  const ganttWrap = document.createElement("div");
  ganttWrap.style.cssText = "position:relative;overflow:hidden;";

  // Y-axis labels
  const labelsDiv = document.createElement("div");
  labelsDiv.style.cssText = `position:absolute;left:0;top:28px;width:${LABEL_W}px;z-index:3;background:var(--panel,#131920);border-right:1px solid var(--border);`;
  for (const basket of basketsWithHistory) {
    const row = document.createElement("div");
    row.className = "gantt-label";
    row.style.cssText = `height:${ROW_H}px;display:flex;align-items:center;padding:0 8px;font-family:var(--mono);font-size:10px;font-weight:600;color:var(--muted);border-bottom:1px solid rgba(255,255,255,0.03);`;
    row.textContent = basket.id;
    labelsDiv.appendChild(row);
  }
  ganttWrap.appendChild(labelsDiv);

  // Scrollable area
  const scrollDiv = document.createElement("div");
  scrollDiv.className = "gantt-scroll";
  scrollDiv.style.cssText = `overflow-x:auto;overflow-y:auto;max-height:${maxHeight}px;margin-left:${LABEL_W}px;`;

  const canvasDiv = document.createElement("div");
  canvasDiv.style.cssText = `position:relative;min-width:${canvasWidth}px;`;

  // Time axis (sticky top)
  const timeAxis = document.createElement("div");
  timeAxis.style.cssText = "position:sticky;top:0;z-index:2;height:28px;background:var(--panel,#131920);border-bottom:1px solid var(--border);";
  const tickInterval = sim.simEnd > 7200 ? 1800 : sim.simEnd > 3600 ? 600 : 300;
  for (let t = 0; t <= sim.simEnd; t += tickInterval) {
    const x = t * PX_PER_SEC;
    const mark = document.createElement("div");
    mark.style.cssText = `position:absolute;bottom:4px;left:${x}px;transform:translateX(-50%);font-family:var(--mono);font-size:9px;color:var(--muted);white-space:nowrap;`;
    mark.textContent = fmtSec(t);
    timeAxis.appendChild(mark);
  }
  canvasDiv.appendChild(timeAxis);

  // Rows
  const rowsDiv = document.createElement("div");
  rowsDiv.style.cssText = "position:relative;";

  // Grid lines
  for (let t = tickInterval; t <= sim.simEnd; t += tickInterval) {
    const line = document.createElement("div");
    line.style.cssText = `position:absolute;top:0;bottom:0;left:${t * PX_PER_SEC}px;width:1px;background:rgba(255,255,255,0.035);pointer-events:none;z-index:0;`;
    rowsDiv.appendChild(line);
  }

  for (const basket of basketsWithHistory) {
    const segments = basketToSegments(basket.stateHistory!, sim.simEnd);
    const row = document.createElement("div");
    row.className = "gantt-row";
    row.style.cssText = `height:${ROW_H}px;position:relative;border-bottom:1px solid rgba(255,255,255,0.03);`;

    for (const seg of segments) {
      const left = seg.start * PX_PER_SEC;
      const width = Math.max(1, (seg.end - seg.start) * PX_PER_SEC);
      const el = document.createElement("div");
      el.className = "gantt-seg" + (seg.isWaiting ? " gantt-seg--waiting" : "");
      el.style.cssText = `position:absolute;top:3px;left:${left}px;width:${width}px;height:${ROW_H - 6}px;border-radius:2px;background:${seg.color};cursor:pointer;`;
      if (seg.isWaiting) el.style.opacity = "0.35";

      // Label on wide segments
      if (width > 28) {
        const lbl = document.createElement("span");
        lbl.style.cssText = "font-family:var(--mono);font-size:8px;font-weight:600;color:rgba(0,0,0,0.7);padding:0 3px;line-height:" + (ROW_H - 6) + "px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;";
        if (seg.state === "IN_TANK") lbl.textContent = seg.station;
        else if (seg.state === "IN_TRANSIT") lbl.textContent = "\u2192";
        else if (width > 40) {
          const short: Record<string, string> = { LOADING: "LOAD", UNLOADING: "UNLD", READY_FOR_PICKUP: "RDY", WAITING_LOAD: "WAIT", WAITING_UNLOAD: "WAIT", DONE: "DONE" };
          lbl.textContent = short[seg.state] ?? seg.state;
        }
        el.appendChild(lbl);
      }

      // Tooltip via title attribute (lightweight, no JS tooltip system needed)
      const stateLabel = seg.state === "IN_TANK" ? `IN_TANK @ ${seg.station}` : seg.state;
      const dur = seg.end - seg.start;
      el.title = `${basket.id} \u2014 ${stateLabel}\n${fmtSec(seg.start)} \u2192 ${fmtSec(seg.end)} (${fmtSec(dur)})`;

      row.appendChild(el);
    }
    rowsDiv.appendChild(row);
  }

  canvasDiv.appendChild(rowsDiv);
  scrollDiv.appendChild(canvasDiv);
  ganttWrap.appendChild(scrollDiv);

  // Sync label scroll with content scroll
  scrollDiv.addEventListener("scroll", () => {
    labelsDiv.style.top = `${-scrollDiv.scrollTop + 28}px`;
  });

  ganttCard.appendChild(ganttWrap);
  container.appendChild(ganttCard);
}

/**
 * Renders the violations tab: alert banner, per-tank violation cards,
 * or a "no violations" message when clean.
 */
export function renderViolationsTab(
  violations: Violation[],
  economics: EconomicsResult,
  container: HTMLElement,
): void {
  container.textContent = "";

  if (!economics.hasViolations || violations.length === 0) {
    const clean = document.createElement("div");
    clean.className = "financial-card";
    clean.innerHTML = `
      <div class="financial-card__header"><span>VIOLATIONS</span></div>
      <div class="financial-card__detail" style="margin-top:8px;color:var(--accent2);">
        No violations detected — all baskets met dwell targets.
      </div>
    `;
    container.appendChild(clean);
    return;
  }

  const uniqueCount = countUniqueViolatedBaskets(violations);

  // Alert banner
  const alert = document.createElement("div");
  alert.className = "violation-alert";
  alert.innerHTML = `
    <div class="violation-alert__title">\u26A0 ${uniqueCount} basket${uniqueCount !== 1 ? "s" : ""} violated</div>
    <div class="violation-alert__desc">${violations.length} violation event${violations.length !== 1 ? "s" : ""} — economics may not reflect actual performance</div>
  `;
  container.appendChild(alert);

  // Group violations by tankId
  const byTank = new Map<string, Violation[]>();
  for (const v of violations) {
    const group = byTank.get(v.tankId) ?? [];
    group.push(v);
    byTank.set(v.tankId, group);
  }

  const typeLabel = (t: string): string => {
    if (t === "over_dwell") return "over-dwell";
    if (t === "under_dwell") return "under-dwell";
    if (t === "max_time") return "max-time";
    return t;
  };

  const causeExplanation = (stationName: string, cause: string): string => {
    if (cause === "wagon_unavailable")
      return `Wagon couldn\u2019t reach ${stationName} in time to pick up the basket before dwell tolerance expired.`;
    if (cause === "destination_blocked")
      return `The next station after ${stationName} was occupied, so the basket couldn\u2019t be moved out in time.`;
    if (cause === "line_design")
      return `The line configuration makes it impossible to meet dwell targets at ${stationName}.`;
    return "";
  };

  for (const [tankId, tankViolations] of byTank) {
    const typeCounts = new Map<string, number>();
    const causeCounts = new Map<string, number>();
    for (const v of tankViolations) {
      typeCounts.set(v.type, (typeCounts.get(v.type) ?? 0) + 1);
      causeCounts.set(v.cause, (causeCounts.get(v.cause) ?? 0) + 1);
    }
    const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const dominantCause = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const count = tankViolations.length;
    const summary = `${escapeHtml(tankId)} \u2014 ${count} ${typeLabel(dominantType)} violation${count !== 1 ? "s" : ""}`;

    let rowsHtml = "";
    for (const v of tankViolations) {
      rowsHtml += `<tr>
        <td>${escapeHtml(v.tankId)}</td>
        <td>${escapeHtml(v.basketId)}</td>
        <td>${v.elapsed.toFixed(0)}s</td>
        <td>${v.dwellTime}s \u00B1${(v.tolerancePct * 100).toFixed(0)}%</td>
        <td>${typeLabel(v.type)}</td>
      </tr>`;
    }

    const card = document.createElement("details");
    card.className = "violation-card";
    card.innerHTML = `
      <summary>${summary}</summary>
      <div class="violation-card__body">
        <div class="violation-card__cause">${causeExplanation(escapeHtml(tankId), dominantCause)}</div>
        <table class="violation-card__table">
          <thead><tr><th>Station</th><th>Basket</th><th>Elapsed</th><th>Target</th><th>Type</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
    container.appendChild(card);
  }
}

/**
 * Main entry point — delegates to the 3 sub-renderers for the pinned,
 * overview, and violations zones.
 */
export function renderFinancialDashboard(
  economics: EconomicsResult,
  config: LineConfig,
  violations: Violation[],
  pinnedContainer: HTMLElement,
  overviewContainer: HTMLElement,
  violationsContainer: HTMLElement,
): void {
  renderPinnedEconomics(economics, config, pinnedContainer);
  renderOverviewTab(economics, config, overviewContainer);
  renderViolationsTab(violations, economics, violationsContainer);
}
