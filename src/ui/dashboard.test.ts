// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderFinancialDashboard, renderThroughputTab } from "./dashboard";
import type { EconomicsResult, SimPlan, SimulationResult } from "../types";
import type { LineConfig } from "../builder/LineConfig";
import { createDefaultLineConfig } from "../builder/LineConfig";

function mockContainer(): HTMLElement {
  return document.createElement("div");
}

function mockEconomics(overrides: Partial<EconomicsResult> = {}): EconomicsResult {
  return {
    revenuePerHr: 0,
    totalCostPerHr: 0,
    profitPerHr: 0,
    profitMarginPct: 0,
    costBreakdown: {
      rawMaterialPerHr: 0,
      chemicalPerHr: 0,
      laborPerHr: 0,
      energyPerHr: 0,
      maintenancePerHr: 0,
      depreciationPerHr: 0,
      wdoCostPerHr: 0,
    },
    capex: { totalWagonCost: 0, totalStationEquipmentCost: 0 },
    unitEconomics: {
      costPerBasket: 0,
      costPerArticle: 0,
      revenuePerBasket: 0,
      profitPerBasket: 0,
    },
    throughputBph: 5,
    hasViolations: false,
    breakEvenBph: 0,
    completedCount: 10,
    simHours: 2,
    ...overrides,
  };
}

function configWithEconomics(): LineConfig {
  const config = createDefaultLineConfig();
  config.economics.revenuePerArticle = 50;
  config.transport.maxArticlesPerBasket = 20;
  return config;
}

describe("renderFinancialDashboard — missing economics config", () => {
  it("renders empty pinned section when revenuePerArticle is zero", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = createDefaultLineConfig();
    config.transport.maxArticlesPerBasket = 20;
    renderFinancialDashboard(mockEconomics(), config, [], pinned, overview, violations);
    expect(pinned.children.length).toBe(0);
  });

  it("renders empty pinned section when maxArticlesPerBasket is not set", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    renderFinancialDashboard(mockEconomics(), config, [], pinned, overview, violations);
    expect(pinned.children.length).toBe(0);
  });

  it("renders empty pinned section when neither field is set", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = createDefaultLineConfig();
    renderFinancialDashboard(mockEconomics(), config, [], pinned, overview, violations);
    expect(pinned.children.length).toBe(0);
  });

  it("renders profit card when both fields are configured", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({ revenuePerHr: 1000, profitPerHr: 500, profitMarginPct: 50 });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = pinned.textContent ?? "";
    expect(text).toContain("PROFIT");
  });
});

describe("renderFinancialDashboard — WDO cost line", () => {
  it("renders WDO operating cost line in overview when wdoCostPerHr > 0", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 500,
      profitPerHr: 3500,
      profitMarginPct: 87.5,
      costBreakdown: {
        rawMaterialPerHr: 0,
        chemicalPerHr: 0,
        laborPerHr: 0,
        energyPerHr: 0,
        maintenancePerHr: 0,
        depreciationPerHr: 0,
        wdoCostPerHr: 500,
      },
    });
    config.stations.splice(2, 0, {
      id: "WDO", label: "WDO", kind: "wdo", dwellSec: 0, dryTimeSec: 600, operatingCostPerHr: 500,
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("WDO Operating");
  });
});

describe("renderFinancialDashboard — station equipment capex", () => {
  it("renders station equipment in capex card when totalStationEquipmentCost > 0", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 100,
      profitPerHr: 3900,
      profitMarginPct: 97.5,
      capex: { totalWagonCost: 0, totalStationEquipmentCost: 500000 },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("Station Equipment");
  });
});

describe("renderFinancialDashboard — depreciation line", () => {
  it("renders depreciation line in overview when depreciationPerHr > 0", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 120,
      profitPerHr: 3880,
      profitMarginPct: 97,
      costBreakdown: {
        rawMaterialPerHr: 0,
        chemicalPerHr: 0,
        laborPerHr: 0,
        energyPerHr: 0,
        maintenancePerHr: 0,
        depreciationPerHr: 120,
        wdoCostPerHr: 0,
      },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("Depreciation");
  });

  it("shows per-wagon depreciation formula when wagon has cost/life/hours", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    config.transport.wagons = [
      { id: "W1", fromStationId: "T1", toStationId: "T1", speedMPerMin: 18, liftSec: 10, dripSec: 4, lowerSec: 6, pickSec: 6, dropSec: 4, costRs: 1200000, usefulLifeYears: 5, operatingHoursPerYear: 2000 },
    ];
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 120,
      profitPerHr: 3880,
      profitMarginPct: 97,
      costBreakdown: {
        rawMaterialPerHr: 0, chemicalPerHr: 0, laborPerHr: 0,
        energyPerHr: 0, maintenancePerHr: 0,
        depreciationPerHr: 120, wdoCostPerHr: 0,
      },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("W1:");
    expect(text).toContain("5yr");
  });

  it("shows per-station equipment depreciation formula", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    config.stations[1].equipmentCostRs = 500000;
    config.stations[1].equipmentLifeYears = 10;
    config.stations[1].equipmentOperatingHoursPerYear = 4000;
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 12.5,
      profitPerHr: 3987.5,
      profitMarginPct: 99.7,
      costBreakdown: {
        rawMaterialPerHr: 0, chemicalPerHr: 0, laborPerHr: 0,
        energyPerHr: 0, maintenancePerHr: 0,
        depreciationPerHr: 12.5, wdoCostPerHr: 0,
      },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("T1");
    expect(text).toContain("10yr");
  });
});

describe("renderFinancialDashboard — energy/maintenance formula detail", () => {
  it("shows energy detail line with plant-level label", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 280,
      profitPerHr: 3720,
      profitMarginPct: 93,
      costBreakdown: {
        rawMaterialPerHr: 0, chemicalPerHr: 0, laborPerHr: 0,
        energyPerHr: 280, maintenancePerHr: 0,
        depreciationPerHr: 0, wdoCostPerHr: 0,
      },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("Energy");
    expect(text).toContain("plant-level");
  });
});

describe("renderFinancialDashboard — capex card", () => {
  it("uses ONE-TIME CAPEX heading", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 0,
      profitPerHr: 4000,
      profitMarginPct: 100,
      capex: { totalWagonCost: 1200000, totalStationEquipmentCost: 0 },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("ONE-TIME CAPEX");
    expect(text).not.toContain("CAPITAL EQUIPMENT");
  });

  it("shows per-wagon capex breakdown with amortised cost", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    config.transport.wagons = [
      { id: "W1", fromStationId: "T1", toStationId: "T1", speedMPerMin: 18, liftSec: 10, dripSec: 4, lowerSec: 6, pickSec: 6, dropSec: 4, costRs: 1200000, usefulLifeYears: 5, operatingHoursPerYear: 2000 },
    ];
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 120,
      profitPerHr: 3880,
      profitMarginPct: 97,
      capex: { totalWagonCost: 1200000, totalStationEquipmentCost: 0 },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("W1");
    expect(text).toContain("amortised");
  });

  it("shows per-station equipment capex with amortised cost", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    config.stations[1].equipmentCostRs = 500000;
    config.stations[1].equipmentLifeYears = 10;
    config.stations[1].equipmentOperatingHoursPerYear = 4000;
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 12.5,
      profitPerHr: 3987.5,
      profitMarginPct: 99.7,
      capex: { totalWagonCost: 0, totalStationEquipmentCost: 500000 },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("T1");
    expect(text).toContain("amortised");
  });
});

describe("renderFinancialDashboard — unit economics formulas", () => {
  it("shows cost/basket formula with bph", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 1000,
      profitPerHr: 3000,
      profitMarginPct: 75,
      unitEconomics: { costPerBasket: 200, costPerArticle: 10, revenuePerBasket: 1000, profitPerBasket: 800 },
      throughputBph: 5,
      breakEvenBph: 1,
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("\u00F7");
    expect(text).toContain("bph");
  });

  it("shows break-even formula with /basket", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 1000,
      profitPerHr: 3000,
      profitMarginPct: 75,
      unitEconomics: { costPerBasket: 200, costPerArticle: 10, revenuePerBasket: 1000, profitPerBasket: 800 },
      throughputBph: 5,
      breakEvenBph: 1,
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("/basket");
  });
});

describe("renderFinancialDashboard — throughput moved to separate tab", () => {
  it("overview tab does NOT contain THROUGHPUT card", () => {
    const pinned = mockContainer();
    const overview = mockContainer();
    const violations = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({
      revenuePerHr: 4000,
      totalCostPerHr: 1000,
      profitPerHr: 3000,
      profitMarginPct: 75,
      throughputBph: 5,
      completedCount: 10,
      simHours: 2,
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).not.toContain("THROUGHPUT");
  });
});

function mockSimResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    simEnd: 7200,
    completedCount: 10,
    throughputBph: 5,
    throughputSteadyBph: 5,
    throughputTrimmedBph: 5,
    throughputStatus: "ok" as const,
    avgLeadTimeSec: 600,
    waits: {},
    bottleneck: "none",
    violations: [],
    util: { wagons: [], stations: [] },
    loading: { queueWaits: [], avgQueueWait: 0, util01: 0.5 },
    unloading: { util01: 0.5 },
    inventory: {
      avgWip: 2, maxWip: 3, optimalWip: 2,
      recommendedBuffer: 2, excessWip: 0, recommendedBph: 5,
      arrivalBph: 5, isOverfeeding: false, wipSamples: [],
    },
    baskets: [],
    events: [],
    snapshots: [],
    schedulingDecisions: [],
    failures: [],
    lineStopped: false,
    targetThroughput: 6,
    simulatedThroughput: 5,
    theoreticalMaxThroughput: 8,
    ...overrides,
  } as SimulationResult;
}

function mockPlan(overrides: Partial<SimPlan> = {}): SimPlan {
  return {
    steps: [
      { type: "manual", at: "LOAD", label: "Loading", start: 0, end: 150 },
      { type: "travel", from: "LOAD", to: "T1", label: "Travel LOAD -> T1", start: 150, end: 200, distanceMm: 1400 },
      { type: "handling", at: "T1", label: "Drop/Lower @ T1", start: 200, end: 230 },
      { type: "dwell", at: "T1", label: "Dwell @ T1", start: 230, end: 530 },
    ],
    cycleSeconds: 948,
    violations: [],
    buckets: { travel: 78, handling: 80, dwell: 450, manual: 300, drip: 40 },
    ...overrides,
  };
}

describe("renderThroughputTab", () => {
  it("renders THROUGHPUT FORMULA header", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 10, simHours: 2 });
    const plan = mockPlan();
    const sim = mockSimResult();
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).toContain("THROUGHPUT FORMULA");
  });

  it("does NOT show three-tier comparison (removed)", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 10, simHours: 2 });
    const plan = mockPlan();
    const sim = mockSimResult({ targetThroughput: 6, simulatedThroughput: 5, theoreticalMaxThroughput: 8 });
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).not.toContain("THREE-TIER");
    expect(text).not.toContain("Theoretical");
  });

  it("shows pipeline throughput explanation", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 10, simHours: 2 });
    const plan = mockPlan();
    const sim = mockSimResult();
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).toContain("pipeline");
  });

  it("shows completed basket count and sim hours", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 14, simHours: 4 });
    const plan = mockPlan();
    const sim = mockSimResult();
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).toContain("14 baskets");
    expect(text).toContain("4h");
  });

  it("renders simulation timeline Gantt chart header", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 3, simHours: 2 });
    const plan = mockPlan();
    const sim = mockSimResult({
      simEnd: 7200,
      baskets: [
        {
          id: "B1", createdAt: 0, cycleCount: 1, currentState: "DONE" as const,
          stateEnteredAt: 7000, elapsedInState: 200, loc: "DONE",
          insertedAt: 0, readyAt: 100, doneAt: 7000,
          totalWaitSec: 50, totalTravelSec: 100, totalDwellSec: 600,
          stateHistory: [
            { timestamp: 0, fromState: "WAITING_LOAD" as const, toState: "LOADING" as const, reason: "loading_started" },
            { timestamp: 150, fromState: "LOADING" as const, toState: "READY_FOR_PICKUP" as const, reason: "load_complete" },
            { timestamp: 180, fromState: "READY_FOR_PICKUP" as const, toState: "IN_TRANSIT" as const, reason: "picked_up" },
            { timestamp: 210, fromState: "IN_TRANSIT" as const, toState: "IN_TANK" as const, reason: "dropped_at_T1" },
            { timestamp: 510, fromState: "IN_TANK" as const, toState: "READY_FOR_PICKUP" as const, reason: "dwell_complete" },
          ],
        },
      ],
    });
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).toContain("SIMULATION TIMELINE");
  });

  it("renders Gantt rows for each basket with stateHistory", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 2, simHours: 2 });
    const plan = mockPlan();
    const sim = mockSimResult({
      simEnd: 7200,
      baskets: [
        {
          id: "B1", createdAt: 0, cycleCount: 1, currentState: "DONE" as const,
          stateEnteredAt: 7000, elapsedInState: 200, loc: "DONE",
          insertedAt: 0, readyAt: 100, doneAt: 7000,
          totalWaitSec: 50, totalTravelSec: 100, totalDwellSec: 600,
          stateHistory: [
            { timestamp: 0, fromState: "WAITING_LOAD" as const, toState: "LOADING" as const, reason: "loading_started" },
            { timestamp: 150, fromState: "LOADING" as const, toState: "IN_TANK" as const, reason: "dropped_at_T1" },
          ],
        },
        {
          id: "B2", createdAt: 100, cycleCount: 1, currentState: "IN_TANK" as const,
          stateEnteredAt: 300, elapsedInState: 100, loc: "T1",
          insertedAt: 100, readyAt: 200, doneAt: null,
          totalWaitSec: 30, totalTravelSec: 80, totalDwellSec: 400,
          stateHistory: [
            { timestamp: 100, fromState: "WAITING_LOAD" as const, toState: "LOADING" as const, reason: "loading_started" },
          ],
        },
      ],
    });
    renderThroughputTab(econ, plan, sim, container);
    // Should have gantt rows
    const rows = container.querySelectorAll(".gantt-row");
    expect(rows.length).toBe(2);
  });

  it("renders Gantt segments as positioned divs", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5, completedCount: 1, simHours: 1 });
    const plan = mockPlan();
    const sim = mockSimResult({
      simEnd: 3600,
      baskets: [
        {
          id: "B1", createdAt: 0, cycleCount: 1, currentState: "IN_TANK" as const,
          stateEnteredAt: 200, elapsedInState: 100, loc: "T1",
          insertedAt: 0, readyAt: 150, doneAt: null,
          totalWaitSec: 0, totalTravelSec: 50, totalDwellSec: 300,
          stateHistory: [
            { timestamp: 0, fromState: "WAITING_LOAD" as const, toState: "LOADING" as const, reason: "loading_started" },
            { timestamp: 150, fromState: "LOADING" as const, toState: "READY_FOR_PICKUP" as const, reason: "load_complete" },
            { timestamp: 180, fromState: "READY_FOR_PICKUP" as const, toState: "IN_TRANSIT" as const, reason: "picked_up" },
            { timestamp: 210, fromState: "IN_TRANSIT" as const, toState: "IN_TANK" as const, reason: "dropped_at_T1" },
          ],
        },
      ],
    });
    renderThroughputTab(econ, plan, sim, container);
    const segs = container.querySelectorAll(".gantt-seg");
    expect(segs.length).toBe(4); // LOADING, READY_FOR_PICKUP, IN_TRANSIT, IN_TANK
  });

  it("renders legend with station colors", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5 });
    const plan = mockPlan();
    const sim = mockSimResult({
      simEnd: 3600,
      baskets: [
        {
          id: "B1", createdAt: 0, cycleCount: 1, currentState: "LOADING" as const,
          stateEnteredAt: 0, elapsedInState: 0, loc: "LOAD",
          insertedAt: 0, readyAt: null, doneAt: null,
          totalWaitSec: 0, totalTravelSec: 0, totalDwellSec: 0,
          stateHistory: [
            { timestamp: 0, fromState: "WAITING_LOAD" as const, toState: "LOADING" as const, reason: "loading_started" },
          ],
        },
      ],
    });
    renderThroughputTab(econ, plan, sim, container);
    const legendItems = container.querySelectorAll(".gantt-legend__item");
    expect(legendItems.length).toBeGreaterThan(0);
  });

  it("skips Gantt when baskets have no stateHistory", () => {
    const container = mockContainer();
    const econ = mockEconomics({ throughputBph: 5 });
    const plan = mockPlan();
    const sim = mockSimResult({
      baskets: [
        {
          id: "B1", createdAt: 0, cycleCount: 1, currentState: "DONE" as const,
          stateEnteredAt: 7000, elapsedInState: 200, loc: "DONE",
          insertedAt: 0, readyAt: 100, doneAt: 7000,
          totalWaitSec: 50, totalTravelSec: 100, totalDwellSec: 600,
        },
      ],
    });
    renderThroughputTab(econ, plan, sim, container);
    const text = container.textContent ?? "";
    expect(text).not.toContain("SIMULATION TIMELINE");
  });
});
