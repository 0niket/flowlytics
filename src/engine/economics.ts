import type { EconomicsResult, SimulationResult, Violation } from "../types";
import type { LineConfig } from "../builder/LineConfig";

// ─── Helpers ──────────────────────────────────────────────────

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

  // Articles per basket — derived from transport basket capacity
  const articlesPerBasket = config.transport.maxArticlesPerBasket ?? 0;

  // Revenue
  const revenuePerBasket = articlesPerBasket * econ.revenuePerArticle;
  const revenuePerHr = throughputBph * revenuePerBasket;

  // Raw material cost
  const rawMaterialCostPerArticle = config.transport.rawMaterialCostPerArticle ?? 0;
  const rawMaterialPerHr = throughputBph * articlesPerBasket * rawMaterialCostPerArticle;

  // Chemical costs — derived from per-tank capacity, cost/litre, bath life
  let chemicalPerHr = 0;
  for (const station of config.stations) {
    if (station.kind !== "tank") continue;
    const cap = station.tankCapacityLitres;
    const costPerL = station.chemicalCostPerLitre;
    const bathLife = station.bathLifeHours;
    // All three fields must be present and positive for a tank to contribute
    if (cap != null && cap > 0 && costPerL != null && costPerL > 0 && bathLife != null) {
      chemicalPerHr += safeDivide(cap * costPerL, bathLife);
    }
  }

  // Labour costs — loading/unloading stations only
  let laborPerHr = 0;
  for (const station of config.stations) {
    if (station.kind !== "loading" && station.kind !== "unloading") continue;
    const count = station.labourCount;
    const costPerHr = station.labourCostPerHr;
    if (count != null && count > 0 && costPerHr != null && costPerHr > 0) {
      laborPerHr += count * costPerHr;
    }
  }

  // WDO operating costs
  let wdoCostPerHr = 0;
  for (const station of config.stations) {
    if (station.kind !== "wdo") continue;
    const opCost = station.operatingCostPerHr;
    if (opCost != null && opCost > 0) {
      wdoCostPerHr += opCost;
    }
  }

  // Plant-level costs
  const energyPerHr = econ.energyCostPerHr;
  const maintenancePerHr = econ.maintenanceCostPerHr;

  // Wagon capex + depreciation
  const wagons = config.transport.wagons ?? [];
  let totalWagonCost = 0;
  let depreciationPerHr = 0;
  for (const w of wagons) {
    if (w.costRs != null && w.costRs > 0) {
      totalWagonCost += w.costRs;
      const life = w.usefulLifeYears ?? 0;
      const opHrs = w.operatingHoursPerYear ?? 0;
      const totalHours = life * opHrs;
      if (totalHours > 0) {
        depreciationPerHr += w.costRs / totalHours;
      }
    }
  }

  // Station equipment capex + depreciation
  let totalStationEquipmentCost = 0;
  for (const station of config.stations) {
    const cost = station.equipmentCostRs;
    if (cost != null && cost > 0) {
      totalStationEquipmentCost += cost;
      const life = station.equipmentLifeYears ?? 0;
      const opHrs = station.equipmentOperatingHoursPerYear ?? 0;
      const totalHours = life * opHrs;
      if (totalHours > 0) {
        depreciationPerHr += cost / totalHours;
      }
    }
  }

  const totalCostPerHr =
    rawMaterialPerHr + chemicalPerHr + laborPerHr + energyPerHr + maintenancePerHr + depreciationPerHr + wdoCostPerHr;

  const profitPerHr = revenuePerHr - totalCostPerHr;
  const profitMarginPct = safeDivide(profitPerHr, revenuePerHr) * 100;

  // Unit economics
  const costPerBasket = safeDivide(totalCostPerHr, throughputBph);
  const costPerArticle = safeDivide(costPerBasket, articlesPerBasket);
  const profitPerBasket = revenuePerBasket - costPerBasket;

  // Break-even
  const breakEvenBph = safeDivide(totalCostPerHr, revenuePerBasket);

  return {
    revenuePerHr,
    totalCostPerHr,
    profitPerHr,
    profitMarginPct,

    costBreakdown: {
      rawMaterialPerHr,
      chemicalPerHr,
      laborPerHr,
      energyPerHr,
      maintenancePerHr,
      depreciationPerHr,
      wdoCostPerHr,
    },

    capex: {
      totalWagonCost,
      totalStationEquipmentCost,
    },

    unitEconomics: {
      costPerBasket,
      costPerArticle,
      revenuePerBasket,
      profitPerBasket,
    },

    throughputBph,
    hasViolations,
    breakEvenBph,
    completedCount: simResult.completedCount,
    simHours: config.settings.simHours,
  };
}
