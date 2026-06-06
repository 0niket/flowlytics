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

  const articlesPerBasket = config.transport.maxArticlesPerBasket ?? 0;
  const hasRevenue = config.economics.revenuePerArticle > 0 && articlesPerBasket > 0;

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
      ${economics.throughputBph.toFixed(1)} bph × ${articlesPerBasket} articles × ${formatCurrency(config.economics.revenuePerArticle)}/article
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

    // Raw Materials
    if (economics.costBreakdown.rawMaterialPerHr > 0) {
      const rawCostPerArticle = config.transport.rawMaterialCostPerArticle ?? 0;
      costHtml += `<div class="cost-group">`;
      costHtml += `<div class="cost-group__header"><span>Raw Materials</span><span>${formatCurrency(economics.costBreakdown.rawMaterialPerHr)} /hr</span></div>`;
      costHtml += `<div class="cost-group__item">${articlesPerBasket} articles × ${formatCurrency(rawCostPerArticle)}/article × ${economics.throughputBph.toFixed(1)} bph</div>`;
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
          costHtml += `<div class="cost-group__item">${escapeHtml(station.id)}: ${cap}L × ${formatCurrency(costPerL)}/L ÷ ${bathLife}h = ${formatCurrency(perHr)}/hr</div>`;
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
          costHtml += `<div class="cost-group__item">${label}: ${count} operator${count !== 1 ? "s" : ""} × ${formatCurrency(costPerHr)}/hr</div>`;
        }
      }
      costHtml += `</div>`;
    }

    // Energy + Maintenance
    const plantCosts = [
      { label: "Energy", value: economics.costBreakdown.energyPerHr },
      { label: "Maintenance", value: economics.costBreakdown.maintenancePerHr },
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

  // ─── Capex Section ──────────────────────────────────────
  if (economics.capex.totalWagonCost > 0) {
    const capexCard = document.createElement("div");
    capexCard.className = "financial-card";

    const wagonCount = config.transport.wagons?.length ?? config.transport.wagonCount;
    capexCard.innerHTML = `
      <div class="financial-card__header"><span>CAPITAL EQUIPMENT (one-time)</span></div>
      <div class="cost-group__header" style="margin-top:8px;">
        <span>Wagons (${wagonCount}×)</span>
        <span>${formatCurrency(economics.capex.totalWagonCost)}</span>
      </div>
    `;
    container.appendChild(capexCard);
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
