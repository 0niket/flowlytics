// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderFinancialDashboard } from "./dashboard";
import type { EconomicsResult } from "../types";
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

describe("renderFinancialDashboard — throughput card", () => {
  it("renders throughput card with THROUGHPUT header", () => {
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
    expect(text).toContain("THROUGHPUT");
  });

  it("shows completed basket count in throughput card", () => {
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
    expect(text).toContain("10 baskets");
  });
});
