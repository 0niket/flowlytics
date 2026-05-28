import { describe, it, expect } from "vitest";
import { parseParamsJson, parseRecipeCsv, validateSimulation } from "./import";

describe("parseParamsJson", () => {
  it("parses valid JSON params", () => {
    const json = `{"tankCount":6,"basketCount":3,"wagonCount":2,"simHours":2,"wagonSpeedMPerMin":40}`;
    const result = parseParamsJson(json);
    expect(result.tankCount).toBe(6);
    expect(result.basketCount).toBe(3);
    expect(result.wagonCount).toBe(2);
    expect(result.simHours).toBe(2);
  });

  it("parses recipe steps from JSON", () => {
    const json = `{"recipeSteps":[{"id":"T1","kind":"tank","dwellSec":120,"tolerancePct":0.1},{"id":"T2","kind":"tank","dwellSec":180}]}`;
    const result = parseParamsJson(json);
    expect(result.recipeSteps).toBeDefined();
    expect(result.recipeSteps!.length).toBe(2);
    expect(result.recipeSteps![0].dwellSec).toBe(120);
  });

  it("returns empty object for empty JSON", () => {
    const result = parseParamsJson("{}");
    expect(Object.keys(result).length).toBe(0);
  });
});

describe("parseRecipeCsv", () => {
  it("parses valid CSV recipe", () => {
    const csv = `T1, tank, 120, 0.1
T2, tank, 180, 0.05
WDO, wdo, 600,`;
    const steps = parseRecipeCsv(csv);
    expect(steps.length).toBe(3);
    expect(steps[0].id).toBe("T1");
    expect(steps[0].dwellSec).toBe(120);
    expect(steps[0].tolerancePct).toBe(0.1);
    expect(steps[1].dwellSec).toBe(180);
  });

  it("skips comment lines", () => {
    const csv = `# Header comment
T1, tank, 120`;
    const steps = parseRecipeCsv(csv);
    expect(steps.length).toBe(1);
  });

  it("uses defaults for missing values", () => {
    const csv = `T1,,,`;
    const steps = parseRecipeCsv(csv);
    expect(steps.length).toBe(1);
    expect(steps[0].dwellSec).toBe(0);
    expect(steps[0].tolerancePct).toBe(0.1);
  });
});

describe("validateSimulation", () => {
  it("passes when all metrics meet expectations", () => {
    const result = validateSimulation(
      { throughputBph: 2.5, avgLeadTimeSec: 300, violations: [], completedCount: 10 },
      { minThroughput: 2, maxLeadTime: 600, maxViolations: 5 },
    );
    expect(result.passed).toBe(true);
    expect(result.messages.length).toBe(0);
  });

  it("fails when throughput is below minimum", () => {
    const result = validateSimulation(
      { throughputBph: 1.5, avgLeadTimeSec: 300, violations: [], completedCount: 5 },
      { minThroughput: 2 },
    );
    expect(result.passed).toBe(false);
    expect(result.messages.some((m) => m.includes("Throughput"))).toBe(true);
  });

  it("fails when violations exceed maximum", () => {
    const result = validateSimulation(
      { throughputBph: 3, avgLeadTimeSec: 200, violations: [{}, {}], completedCount: 8 },
      { maxViolations: 1 },
    );
    expect(result.passed).toBe(false);
    expect(result.messages.some((m) => m.includes("Violations"))).toBe(true);
  });
});
