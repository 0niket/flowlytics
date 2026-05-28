import { describe, it, expect } from "vitest";
import { runSweep, findOptimal } from "./optimization";
import { buildSyntheticLayout, defaultRecipe } from "./layout";
import type { SimParams } from "../types";

function baseParams(): SimParams {
  return {
    preset: "ms",
    tankCount: 6,
    basketCount: 3,
    recipeSteps: defaultRecipe(6, "ms"),
    wdoTimeMin: 10,
    loadTimeMin: 1,
    unloadTimeMin: 1,
    dripTimeSec: 3,
    targetBph: 6,
    simHours: 1,
    wagonSpeedMPerMin: 40,
    liftLowerSec: 10,
    pickDropSec: 10,
    wagonCount: 1,
    distanceMode: "manhattan",
    dwellClockOffsetSec: null,
  };
}

describe("runSweep", () => {
  it("returns points for each (basketCount, wagonCount) pair", () => {
    const layout = buildSyntheticLayout(6);
    const params = baseParams();
    const result = runSweep(layout, params, { basketCounts: [2, 3], wagonCounts: [1, 2] });
    expect(result.length).toBe(4); // 2 * 2 = 4 points
  });

  it("computes positive throughput for valid configs", () => {
    const layout = buildSyntheticLayout(6);
    const params = baseParams();
    const result = runSweep(layout, params, { basketCounts: [3, 5], wagonCounts: [1, 2] });
    for (const p of result) {
      expect(p.throughputBph).toBeGreaterThan(0);
    }
  });

  it("computes positive costIndex", () => {
    const layout = buildSyntheticLayout(6);
    const params = baseParams();
    const result = runSweep(layout, params, { basketCounts: [3], wagonCounts: [1] });
    expect(Number.isFinite(result[0].costIndex)).toBe(true);
    expect(result[0].costIndex).toBeGreaterThan(0);
  });
});

describe("findOptimal", () => {
  it("returns the point with lowest costIndex", () => {
    const layout = buildSyntheticLayout(6);
    const params = baseParams();
    const points = runSweep(layout, params, { basketCounts: [2, 3, 5], wagonCounts: [1, 2] });
    const result = findOptimal(points);
    expect(result.bestValue).toBeDefined();
    expect(result.points.length).toBe(points.length);
    const costs = points.filter((p) => p.throughputBph > 0 && !p.lineStopped).map((p) => p.costIndex);
    const minCost = Math.min(...costs);
    expect(result.bestValue.costIndex).toBe(minCost);
  });
});
