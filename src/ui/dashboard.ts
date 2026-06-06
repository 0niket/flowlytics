import type { EconomicsResult } from "../types";
import type { LineConfig } from "../builder/LineConfig";
import { formatCurrency, countUniqueViolatedBaskets } from "../engine/economics";
import type { Violation } from "../types";

function escapeHtml(s: string): string {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtPct(value: number): string {
  if (!isFinite(value)) return "∞";
  return value.toFixed(1) + "%";
}

function fmtBph(value: number): string {
  if (!isFinite(value)) return "∞";
  return value.toFixed(1) + " bph";
}

export function renderFinancialDashboard(
  economics: EconomicsResult,
  config: LineConfig,
  violations: Violation[],
  container: HTMLElement,
): void {
  container.textContent = "";

  const hasRevenue = config.economics.revenuePerArticle > 0 && config.economics.articlesPerBasket > 0;

  // If violations, show alert
  if (economics.hasViolations && hasRevenue) {
    const uniqueCount = countUniqueViolatedBaskets(violations);
    const alert = document.createElement("div");
    alert.className = "violation-alert";
    alert.innerHTML = `
      <div class="violation-alert__title">CONFIGURATION HAS VIOLATIONS</div>
      <div class="violation-alert__desc">Fix timing before economics are meaningful.</div>
      <div class="violation-alert__detail">${uniqueCount} basket${uniqueCount !== 1 ? "s" : ""} violated across ${violations.length} event${violations.length !== 1 ? "s" : ""}.</div>
    `;
    container.appendChild(alert);
    return;
  }

  // No revenue configured — don't show financial dashboard
  if (!hasRevenue) return;

  // ─── Profit/Hr Hero Card ────────────────────────────────
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
      ${economics.throughputBph.toFixed(1)} bph × ${config.economics.articlesPerBasket} articles × ${formatCurrency(config.economics.revenuePerArticle)}/article
    </div>
  `;
  container.appendChild(hero);

  // ─── Cost Breakdown Card ─────────────────────────────────
  const hasCosts = economics.totalCostPerHr > 0;
  if (hasCosts) {
    const costCard = document.createElement("div");
    costCard.className = "financial-card";

    let costHtml = `
      <div class="financial-card__header">
        <span>COSTS / HOUR</span>
        <span style="font-size:13px;font-weight:600;">${formatCurrency(economics.totalCostPerHr)} /hr</span>
      </div>
    `;

    // Equipment group
    if (economics.costBreakdown.equipmentPerHr > 0) {
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Equipment (amortized)</span><span>${formatCurrency(economics.costBreakdown.equipmentPerHr)} /hr</span></div>`;
      if (economics.costBreakdown.wagonCostPerHr > 0) {
        const wagonCount = config.transport.wagons?.length ?? config.transport.wagonCount;
        costHtml += `<div class="cost-group__item">Wagons (${wagonCount}×) ${formatCurrency(economics.costBreakdown.wagonCostPerHr)}</div>`;
      }
      if (economics.costBreakdown.basketCostPerHr > 0) {
        costHtml += `<div class="cost-group__item">Baskets (${config.settings.basketCount}×) ${formatCurrency(economics.costBreakdown.basketCostPerHr)}</div>`;
      }
      costHtml += `</div>`;
    }

    // Chemicals group
    if (economics.costBreakdown.chemicalPerHr > 0) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Chemicals</span><span>${formatCurrency(economics.costBreakdown.chemicalPerHr)} /hr</span></div>`;
      for (const station of config.stations) {
        if (station.tankFixedCostPerHr != null && station.tankFixedCostPerHr > 0) {
          costHtml += `<div class="cost-group__item">${escapeHtml(station.id)} ${escapeHtml(station.label)} ${formatCurrency(station.tankFixedCostPerHr)}</div>`;
        }
      }
      costHtml += `</div>`;
    }

    // Operating group
    const opCosts = [
      { label: "Water & Effluent", value: economics.costBreakdown.waterEffluentPerHr },
      { label: "Labor", value: economics.costBreakdown.laborPerHr },
      { label: "Energy", value: economics.costBreakdown.energyPerHr },
      { label: "Maintenance", value: economics.costBreakdown.maintenancePerHr },
    ].filter((c) => c.value > 0);

    if (opCosts.length > 0) {
      const opTotal = opCosts.reduce((sum, c) => sum + c.value, 0);
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Operating</span><span>${formatCurrency(opTotal)} /hr</span></div>`;
      for (const c of opCosts) {
        costHtml += `<div class="cost-group__item">${c.label} ${formatCurrency(c.value)}</div>`;
      }
      costHtml += `</div>`;
    }

    // Chemical cost % of revenue
    if (economics.ratios.chemicalCostPctOfRevenue > 0 && isFinite(economics.ratios.chemicalCostPctOfRevenue)) {
      costHtml += `<hr class="separator" />`;
      costHtml += `<div class="financial-card__ratio">Chemical cost: ${fmtPct(economics.ratios.chemicalCostPctOfRevenue)} of revenue</div>`;
    }

    costCard.innerHTML = costHtml;
    container.appendChild(costCard);
  }

  // ─── Unit Economics Card ─────────────────────────────────
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
