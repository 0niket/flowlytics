import type { EconomicsResult, SimulationResult, Violation } from "../types";
import type { LineConfig } from "../builder/LineConfig";

// ─── Helpers ──────────────────────────────────────────────────

function amortize(costRs: number, lifeYears: number, operatingHoursPerYear: number): number {
  if (lifeYears <= 0 || operatingHoursPerYear <= 0) return Infinity;
  return costRs / (lifeYears * operatingHoursPerYear);
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator === 0 ? 0 : Infinity;
  return numerator / denominator;
}

export function countUniqueViolatedBaskets(violations: Violation[]): number {
  return new Set(violations.map((v) => v.basketId)).size;
}

// ─── Currency Formatting ──────────────────────────────────────

const fmtFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number): string {
  if (!isFinite(value)) return "₹∞";
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) {
    const cr = value / 1_00_00_000;
    return `₹${cr.toFixed(1)}Cr`;
  }
  if (abs >= 1_00_000) {
    const lakh = value / 1_00_000;
    return `₹${lakh.toFixed(1)}L`;
  }
  return fmtFull.format(value);
}

// ─── Calculator ───────────────────────────────────────────────

export function calculateEconomics(
  config: LineConfig,
  simResult: SimulationResult,
): EconomicsResult {
  const econ = config.economics;
  const throughputBph = simResult.throughputSteadyBph;
  const hasViolations = simResult.violations.length > 0;

  // Revenue
  const revenuePerBasket = econ.articlesPerBasket * econ.revenuePerArticle;
  const revenuePerHr = throughputBph * revenuePerBasket;

  // Equipment costs — wagons
  const wagons = config.transport.wagons ?? [];
  let wagonCostPerHr = 0;
  for (const w of wagons) {
    if (w.costRs != null && w.costRs > 0) {
      wagonCostPerHr += amortize(w.costRs, w.lifeYears ?? 10, econ.operatingHoursPerYear);
    }
  }

  // Equipment costs — baskets
  const basketCount = config.settings.basketCount;
  const basketCostPerHr = econ.basketCostRs > 0
    ? basketCount * amortize(econ.basketCostRs, econ.basketLifeYears, econ.operatingHoursPerYear)
    : 0;

  const equipmentPerHr = wagonCostPerHr + basketCostPerHr;

  // Chemical costs — sum of per-tank fixed costs
  let chemicalPerHr = 0;
  for (const station of config.stations) {
    if (station.tankFixedCostPerHr != null && station.tankFixedCostPerHr > 0) {
      chemicalPerHr += station.tankFixedCostPerHr;
    }
  }

  // Operating costs
  const laborPerHr = econ.operatorCostPerHr;
  const energyPerHr = econ.energyCostPerHr;
  const maintenancePerHr = econ.maintenanceCostPerHr;
  const waterEffluentPerHr = econ.waterAndEffluentCostPerHr;

  const totalCostPerHr =
    equipmentPerHr + chemicalPerHr + laborPerHr + energyPerHr + maintenancePerHr + waterEffluentPerHr;

  const profitPerHr = revenuePerHr - totalCostPerHr;
  const profitMarginPct = safeDivide(profitPerHr, revenuePerHr) * 100;

  // Unit economics
  const costPerBasket = safeDivide(totalCostPerHr, throughputBph);
  const costPerArticle = safeDivide(costPerBasket, econ.articlesPerBasket);
  const profitPerBasket = revenuePerBasket - costPerBasket;

  // Ratios
  const chemicalCostPctOfRevenue = safeDivide(chemicalPerHr, revenuePerHr) * 100;

  // Break-even
  const breakEvenBph = safeDivide(totalCostPerHr, revenuePerBasket);

  return {
    revenuePerHr,
    totalCostPerHr,
    profitPerHr,
    profitMarginPct,

    costBreakdown: {
      equipmentPerHr,
      wagonCostPerHr,
      basketCostPerHr,
      chemicalPerHr,
      laborPerHr,
      energyPerHr,
      maintenancePerHr,
      waterEffluentPerHr,
    },

    unitEconomics: {
      costPerBasket,
      costPerArticle,
      revenuePerBasket,
      profitPerBasket,
    },

    ratios: {
      chemicalCostPctOfRevenue,
    },

    throughputBph,
    hasViolations,
    breakEvenBph,
  };
}
