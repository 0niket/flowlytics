import type { EconomicsResult } from "../types";
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

    // Energy + Maintenance + Depreciation
    const plantCosts = [
      { label: "Energy", value: economics.costBreakdown.energyPerHr },
      { label: "Maintenance", value: economics.costBreakdown.maintenancePerHr },
      { label: "Depreciation", value: economics.costBreakdown.depreciationPerHr },
    ].filter((c) => c.value > 0);

    if (plantCosts.length > 0) {
      costHtml += `<hr class="separator" />`;
      for (const c of plantCosts) {
        costHtml += `<div class="cost-group__header"><span>${c.label}</span><span>${formatCurrency(c.value)} /hr</span></div>`;
      }
    }

    // Chemical cost % of revenue
    if (economics.ratios.chemicalCostPctOfRevenue > 0 && isFinite(economics.ratios.chemicalCostPctOfRevenue)) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="financial-card__ratio">Chemical cost: ${fmtPct(economics.ratios.chemicalCostPctOfRevenue)} of revenue</div>`;
    }

    costCard.innerHTML = costHtml;
    container.appendChild(costCard);
  }

  // Capex Section
  if (economics.capex.totalWagonCost > 0) {
    const capexCard = document.createElement("div");
    capexCard.className = "financial-card";

    const wagonCount = config.transport.wagons?.length ?? config.transport.wagonCount;
    capexCard.innerHTML = `
      <div class="financial-card__header"><span>CAPITAL EQUIPMENT (one-time)</span></div>
      <div class="cost-group__header" style="margin-top:8px;">
        <span>Wagons (${wagonCount}\u00D7)</span>
        <span>${formatCurrency(economics.capex.totalWagonCost)}</span>
      </div>
    `;
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
        </div>
        <div>
          <div class="unit-metric__label">Cost/article</div>
          <div class="unit-metric__value">${formatCurrency(economics.unitEconomics.costPerArticle)}</div>
        </div>
        <div>
          <div class="unit-metric__label">Break-even</div>
          <div class="unit-metric__value" style="color:${breakEvenColor}">${fmtBph(economics.breakEvenBph)}</div>
        </div>
      </div>
    `;
    container.appendChild(unitCard);
  }
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
