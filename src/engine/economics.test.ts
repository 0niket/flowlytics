import { describe, it, expect } from "vitest";
import { calculateEconomics, countUniqueViolatedBaskets, formatCurrency } from "./economics";
import { createDefaultLineConfig } from "../builder/LineConfig";
import type { SimulationResult, Violation } from "../types";

// ─── Test Helpers ─────────────────────────────────────────────

function makeSimResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    simEnd: 7200,
    completedCount: 8,
    throughputBph: 4,
    throughputSteadyBph: 4,
    throughputTrimmedBph: 4,
    throughputStatus: "ok",
    avgLeadTimeSec: 900,
    waits: {},
    bottleneck: "none",
    violations: [],
    util: { wagons: [], stations: [] },
    loading: { avgQueueWaitSec: 0, maxQueueDepth: 0, processingUtil01: 0, totalBasketsLoaded: 0 },
    unloading: { maxQueueDepth: 0 },
    inventory: { avgWip: 2, maxWip: 3, optimalWip: 2, recommendedBuffer: 1, excessWip: 0, recommendedBph: 4, arrivalBph: 4, isOverfeeding: false, wipSamples: [] },
    baskets: [],
    events: [],
    snapshots: [],
    schedulingDecisions: [],
    failures: [],
    lineStopped: false,
    targetThroughput: 4,
    simulatedThroughput: 4,
    theoreticalMaxThroughput: 6,
    ...overrides,
  };
}

function makeViolation(basketId: string): Violation {
  return {
    basketId,
    tankId: "T1",
    type: "over_dwell",
    elapsed: 200,
    dwellTime: 150,
    tolerancePct: 0.1,
    earliestExit: 135,
    latestExit: 165,
    timestamp: 3600,
    cause: "wagon_unavailable",
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe("calculateEconomics", () => {
  it("default config with zero economics → all values 0, profit = 0", () => {
    const config = createDefaultLineConfig();
    const sim = makeSimResult();
    const result = calculateEconomics(config, sim);

    expect(result.revenuePerHr).toBe(0);
    expect(result.totalCostPerHr).toBe(0);
    expect(result.profitPerHr).toBe(0);
    expect(result.hasViolations).toBe(false);
  });

  it("revenue only (no costs) → profit = revenue, margin = 100%", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    config.transport.maxArticlesPerBasket = 20;
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    expect(result.revenuePerHr).toBe(4000); // 4 × 20 × 50
    expect(result.totalCostPerHr).toBe(0);
    expect(result.profitPerHr).toBe(4000);
    expect(result.profitMarginPct).toBe(100);
    expect(result.unitEconomics.revenuePerBasket).toBe(1000); // 20 × 50
  });

  it("raw material cost → rawMaterialPerHr = throughput × articles × costPerArticle", () => {
    const config = createDefaultLineConfig();
    config.transport.maxArticlesPerBasket = 20;
    config.transport.rawMaterialCostPerArticle = 15;
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    // 4 bph × 20 articles × ₹15/article = ₹1200/hr
    expect(result.costBreakdown.rawMaterialPerHr).toBe(1200);
    expect(result.totalCostPerHr).toBe(1200);
  });

  it("rawMaterialCostPerArticle undefined → 0 contribution", () => {
    const config = createDefaultLineConfig();
    config.transport.maxArticlesPerBasket = 20;
    // rawMaterialCostPerArticle is undefined by default
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.rawMaterialPerHr).toBe(0);
  });

  it("single tank chemical cost → (capacity × cost/L) / bathLife", () => {
    const config = createDefaultLineConfig();
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 25;
    config.stations[1].bathLifeHours = 200;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    // 500 × 25 / 200 = 62.5
    expect(result.costBreakdown.chemicalPerHr).toBe(62.5);
  });

  it("multiple tanks → sum of derived costs", () => {
    const config = createDefaultLineConfig();
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 25;
    config.stations[1].bathLifeHours = 200;
    config.stations.splice(2, 0, {
      id: "T2", label: "Tank 2", kind: "tank", tankType: "chemical",
      dwellSec: 150, tolerancePct: 0.1,
      tankCapacityLitres: 300, chemicalCostPerLitre: 40, bathLifeHours: 150,
    });
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    // T1: 500×25/200 = 62.5, T2: 300×40/150 = 80 → total = 142.5
    expect(result.costBreakdown.chemicalPerHr).toBe(142.5);
  });

  it("partial tank config (missing bathLifeHours) → zero contribution", () => {
    const config = createDefaultLineConfig();
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 25;
    // bathLifeHours is undefined
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.chemicalPerHr).toBe(0);
  });

  it("bathLifeHours = 0 → Infinity (graceful)", () => {
    const config = createDefaultLineConfig();
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 25;
    config.stations[1].bathLifeHours = 0;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.chemicalPerHr).toBe(Infinity);
    expect(result.totalCostPerHr).toBe(Infinity);
  });

  it("loading labour: 2 operators × ₹200/hr = ₹400/hr", () => {
    const config = createDefaultLineConfig();
    const load = config.stations.find((s) => s.kind === "loading")!;
    load.labourCount = 2;
    load.labourCostPerHr = 200;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.laborPerHr).toBe(400);
  });

  it("both loading + unloading labour → sum", () => {
    const config = createDefaultLineConfig();
    const load = config.stations.find((s) => s.kind === "loading")!;
    load.labourCount = 2;
    load.labourCostPerHr = 200;
    const unload = config.stations.find((s) => s.kind === "unloading")!;
    unload.labourCount = 1;
    unload.labourCostPerHr = 200;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    // Loading: 2×200=400, Unloading: 1×200=200 → 600
    expect(result.costBreakdown.laborPerHr).toBe(600);
  });

  it("tank station with labour fields → ignored", () => {
    const config = createDefaultLineConfig();
    // Putting labour fields on a tank should be ignored
    config.stations[1].labourCount = 5;
    config.stations[1].labourCostPerHr = 300;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.laborPerHr).toBe(0);
  });

  it("energy + maintenance from economics config", () => {
    const config = createDefaultLineConfig();
    config.economics.energyCostPerHr = 280;
    config.economics.maintenanceCostPerHr = 120;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.costBreakdown.energyPerHr).toBe(280);
    expect(result.costBreakdown.maintenancePerHr).toBe(120);
    expect(result.totalCostPerHr).toBe(400);
  });

  it("full config → totalCostPerHr = sum of all hourly categories", () => {
    const config = createDefaultLineConfig();
    config.transport.maxArticlesPerBasket = 20;
    config.economics.revenuePerArticle = 50;

    // Raw materials
    config.transport.rawMaterialCostPerArticle = 10;
    // Chemical on tank
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 20;
    config.stations[1].bathLifeHours = 100;
    // Labour
    const load = config.stations.find((s) => s.kind === "loading")!;
    load.labourCount = 2;
    load.labourCostPerHr = 200;
    // Plant-level
    config.economics.energyCostPerHr = 280;
    config.economics.maintenanceCostPerHr = 120;

    const sim = makeSimResult({ throughputSteadyBph: 4 });
    const result = calculateEconomics(config, sim);

    // Raw: 4×20×10 = 800
    // Chemical: 500×20/100 = 100
    // Labour: 2×200 = 400
    // Energy: 280, Maintenance: 120
    expect(result.costBreakdown.rawMaterialPerHr).toBe(800);
    expect(result.costBreakdown.chemicalPerHr).toBe(100);
    expect(result.costBreakdown.laborPerHr).toBe(400);
    expect(result.totalCostPerHr).toBe(1700); // 800+100+400+280+120
  });

  it("wagon capex in capex.totalWagonCost, NOT in totalCostPerHr", () => {
    const config = createDefaultLineConfig();
    config.transport.wagons = [
      { id: "W1", fromStationId: "T1", toStationId: "T1", speedMPerMin: 18, liftSec: 10, dripSec: 4, lowerSec: 6, pickSec: 6, dropSec: 4, costRs: 1200000 },
      { id: "W2", fromStationId: "T1", toStationId: "T1", speedMPerMin: 18, liftSec: 10, dripSec: 4, lowerSec: 6, pickSec: 6, dropSec: 4, costRs: 800000 },
    ];
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.capex.totalWagonCost).toBe(2000000);
    // Wagon cost should NOT be in totalCostPerHr
    expect(result.totalCostPerHr).toBe(0);
  });

  it("maxArticlesPerBasket undefined → revenue = 0", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    // maxArticlesPerBasket is undefined by default
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    expect(result.unitEconomics.revenuePerBasket).toBe(0);
    expect(result.revenuePerHr).toBe(0);
  });

  it("simulation has violations → hasViolations = true", () => {
    const config = createDefaultLineConfig();
    const sim = makeSimResult({
      violations: [makeViolation("B1"), makeViolation("B2")],
    });

    const result = calculateEconomics(config, sim);
    expect(result.hasViolations).toBe(true);
  });

  it("break-even throughput = totalCosts/hr ÷ revenuePerBasket", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    config.transport.maxArticlesPerBasket = 20;
    config.economics.energyCostPerHr = 1000;
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    // revenuePerBasket = 1000, totalCost = 1000, breakEven = 1000/1000 = 1
    expect(result.breakEvenBph).toBe(1);
  });

  it("break-even when revenuePerBasket = 0 → Infinity", () => {
    const config = createDefaultLineConfig();
    config.economics.energyCostPerHr = 1000;
    const sim = makeSimResult();

    const result = calculateEconomics(config, sim);

    expect(result.breakEvenBph).toBe(Infinity);
  });

  it("chemical cost as % of revenue calculated correctly", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    config.transport.maxArticlesPerBasket = 20;
    config.stations[1].tankCapacityLitres = 1000;
    config.stations[1].chemicalCostPerLitre = 54;
    config.stations[1].bathLifeHours = 100;
    const sim = makeSimResult({ throughputSteadyBph: 4 });

    const result = calculateEconomics(config, sim);

    // Revenue = 4000, Chemical = 1000×54/100 = 540 → 13.5%
    expect(result.ratios.chemicalCostPctOfRevenue).toBeCloseTo(13.5, 1);
  });

  it("profit margin % = profitPerHr / revenuePerHr × 100", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 100;
    config.transport.maxArticlesPerBasket = 10;
    config.economics.energyCostPerHr = 600;
    const sim = makeSimResult({ throughputSteadyBph: 2 });

    const result = calculateEconomics(config, sim);

    // Revenue = 2 × 10 × 100 = 2000, Cost = 600, Profit = 1400
    // Margin = 1400/2000 × 100 = 70%
    expect(result.profitMarginPct).toBe(70);
  });

  it("zero throughput → revenue = 0, costPerBasket = Infinity", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    config.transport.maxArticlesPerBasket = 20;
    config.economics.energyCostPerHr = 450;
    const sim = makeSimResult({ throughputSteadyBph: 0 });

    const result = calculateEconomics(config, sim);

    expect(result.revenuePerHr).toBe(0);
    expect(result.unitEconomics.costPerBasket).toBe(Infinity);
  });
});

describe("countUniqueViolatedBaskets", () => {
  it("counts unique basketIds in violations array", () => {
    const violations: Violation[] = [
      makeViolation("B1"),
      makeViolation("B1"),
      makeViolation("B2"),
    ];
    expect(countUniqueViolatedBaskets(violations)).toBe(2);
  });

  it("returns 0 for empty violations", () => {
    expect(countUniqueViolatedBaskets([])).toBe(0);
  });

  it("returns 1 for single violation", () => {
    expect(countUniqueViolatedBaskets([makeViolation("B1")])).toBe(1);
  });
});

describe("formatCurrency", () => {
  it("formats values under 1 lakh with Indian number format", () => {
    const result = formatCurrency(1247);
    expect(result).toContain("1,247");
    expect(result).toContain("₹");
  });

  it("uses compact lakh notation for >= 1,00,000", () => {
    const result = formatCurrency(124700);
    expect(result).toBe("₹1.2L");
  });

  it("returns ₹0 for zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("₹");
    expect(result).toContain("0");
  });

  it("uses crore notation for >= 1,00,00,000", () => {
    const result = formatCurrency(34500000);
    expect(result).toBe("₹3.5Cr");
  });

  it("handles negative values", () => {
    const result = formatCurrency(-1247);
    expect(result).toContain("1,247");
  });

  it("handles Infinity", () => {
    const result = formatCurrency(Infinity);
    expect(result).toBe("₹∞");
  });

  it("formats values between 100 and 1 lakh without decimals", () => {
    const result = formatCurrency(540);
    expect(result).toContain("540");
    expect(result).not.toContain(".");
  });
});
