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

/**
 * Renders the throughput tab: hero, three-tier, formula, Gantt chart,
 * and cycle time bucket breakdown.
 */
export function renderThroughputTab(
  economics: EconomicsResult,
  plan: SimPlan,
  _sim: SimulationResult,
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
      <div class="throughput-hero__sub" style="color:var(--muted);">pipeline throughput — multiple baskets move through stations simultaneously</div>
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

  // Cycle time breakdown + Gantt
  const cycleCard = document.createElement("div");
  cycleCard.className = "financial-card";
  const b = plan.buckets;
  const total = plan.cycleSeconds;

  let cycleHtml = `<div class="financial-card__header"><span>CYCLE TIME BREAKDOWN</span><span style="font-size:13px;font-weight:600;">${fmtSec(total)}</span></div>`;

  // Gantt bar
  cycleHtml += `<div class="gantt" style="margin:14px 0 8px;">`;
  cycleHtml += `<div class="gantt__bar" style="display:flex;height:28px;border-radius:4px;overflow:hidden;background:var(--bg-dark,#0d1117);border:1px solid var(--border);">`;
  if (b.manual > 0) cycleHtml += `<div class="gantt__seg gantt__seg--manual" style="flex:${b.manual};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#0d1117;background:#da3633;">${fmtSec(b.manual)}</div>`;
  if (b.dwell > 0) cycleHtml += `<div class="gantt__seg gantt__seg--dwell" style="flex:${b.dwell};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#0d1117;background:#58a6ff;">${fmtSec(b.dwell)}</div>`;
  if (b.handling > 0) cycleHtml += `<div class="gantt__seg gantt__seg--handling" style="flex:${b.handling};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#0d1117;background:#d29922;">${fmtSec(b.handling)}</div>`;
  if (b.travel > 0) cycleHtml += `<div class="gantt__seg gantt__seg--travel" style="flex:${b.travel};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#0d1117;background:#a371f7;">${fmtSec(b.travel)}</div>`;
  if (b.drip > 0) cycleHtml += `<div class="gantt__seg gantt__seg--drip" style="flex:${b.drip};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#0d1117;background:#3fb950;">${fmtSec(b.drip)}</div>`;
  cycleHtml += `</div>`;

  // Legend
  cycleHtml += `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;">`;
  const legendItems = [
    { label: "Manual", color: "#da3633", value: b.manual },
    { label: "Dwell", color: "#58a6ff", value: b.dwell },
    { label: "Handling", color: "#d29922", value: b.handling },
    { label: "Travel", color: "#a371f7", value: b.travel },
    { label: "Drip", color: "#3fb950", value: b.drip },
  ];
  for (const item of legendItems) {
    if (item.value > 0) {
      cycleHtml += `<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--muted);"><div style="width:8px;height:8px;border-radius:2px;background:${item.color};"></div>${item.label}</div>`;
    }
  }
  cycleHtml += `</div></div>`;

  // Bucket breakdown rows
  const bucketRows = [
    { label: "Manual", color: "#da3633", detail: "load + unload", value: b.manual },
    { label: "Dwell", color: "#58a6ff", detail: "tank + wdo times", value: b.dwell },
    { label: "Handling", color: "#d29922", detail: "pick/lift/lower/drop", value: b.handling },
    { label: "Travel", color: "#a371f7", detail: "wagon movement", value: b.travel },
    { label: "Drip", color: "#3fb950", detail: "post-pickup drain", value: b.drip },
  ];

  for (const row of bucketRows) {
    if (row.value > 0) {
      cycleHtml += `<div class="cycle-row"><div class="cycle-dot" style="background:${row.color};"></div><div class="cycle-row__label">${row.label}</div><div class="cycle-row__detail">${row.detail}</div><div class="cycle-row__value">${fmtSec(row.value)}</div></div>`;
    }
  }

  // Total row
  cycleHtml += `<div class="cycle-row cycle-row--total"><div></div><div class="cycle-row__label" style="font-weight:600;">Total Cycle</div><div class="cycle-row__detail"></div><div class="cycle-row__value" style="color:var(--accent);font-weight:700;">${fmtSec(total)}</div></div>`;

  // Step-by-step details
  cycleHtml += `<hr class="separator" />`;
  cycleHtml += `<div class="financial-card__header" style="margin-top:8px;"><span>STEP-BY-STEP</span></div>`;
  for (const step of plan.steps) {
    const dur = step.end - step.start;
    cycleHtml += `<div class="cost-group__item">${escapeHtml(step.label)}: ${fmtSec(dur)}</div>`;
  }

  cycleCard.innerHTML = cycleHtml;
  container.appendChild(cycleCard);
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
