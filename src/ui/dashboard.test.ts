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
    },
    capex: { totalWagonCost: 0 },
    unitEconomics: {
      costPerBasket: 0,
      costPerArticle: 0,
      revenuePerBasket: 0,
      profitPerBasket: 0,
    },
    throughputBph: 5,
    hasViolations: false,
    breakEvenBph: 0,
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
      },
    });
    renderFinancialDashboard(econ, config, [], pinned, overview, violations);
    const text = overview.textContent ?? "";
    expect(text).toContain("Depreciation");
  });
});
