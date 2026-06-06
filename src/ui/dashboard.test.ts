// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderFinancialDashboard } from "./dashboard";
import type { EconomicsResult } from "../types";
import type { LineConfig } from "../builder/LineConfig";
import { createDefaultLineConfig } from "../builder/LineConfig";

function mockContainer(): HTMLElement {
  const el = document.createElement("div");
  return el;
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
    },
    capex: { totalWagonCost: 0 },
    unitEconomics: {
      costPerBasket: 0,
      costPerArticle: 0,
      revenuePerBasket: 0,
      profitPerBasket: 0,
    },
    ratios: { chemicalCostPctOfRevenue: 0 },
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
  it("shows error when revenuePerArticle is zero", () => {
    const container = mockContainer();
    const config = createDefaultLineConfig();
    config.transport.maxArticlesPerBasket = 20;
    // revenuePerArticle defaults to 0
    renderFinancialDashboard(mockEconomics(), config, [], container);
    const text = container.textContent ?? "";
    expect(text).toContain("Revenue per article");
  });

  it("shows error when maxArticlesPerBasket is not set", () => {
    const container = mockContainer();
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 50;
    // maxArticlesPerBasket not set (undefined → 0)
    renderFinancialDashboard(mockEconomics(), config, [], container);
    const text = container.textContent ?? "";
    expect(text).toContain("articles per basket");
  });

  it("shows error listing both missing fields when neither is set", () => {
    const container = mockContainer();
    const config = createDefaultLineConfig();
    renderFinancialDashboard(mockEconomics(), config, [], container);
    const text = container.textContent ?? "";
    expect(text).toContain("Revenue per article");
    expect(text).toContain("articles per basket");
  });

  it("does not show error when both fields are configured", () => {
    const container = mockContainer();
    const config = configWithEconomics();
    const econ = mockEconomics({ revenuePerHr: 1000, profitPerHr: 500, profitMarginPct: 50 });
    renderFinancialDashboard(econ, config, [], container);
    const text = container.textContent ?? "";
    expect(text).not.toContain("missing");
    expect(text).toContain("PROFIT");
  });
});
