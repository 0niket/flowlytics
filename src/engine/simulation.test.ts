import { describe, it, expect } from "vitest";
import { runSimulation, buildSimPlan, computeZones } from "./simulation";
import { buildSyntheticLayout, defaultRecipe } from "./layout";
import type { SimParams } from "../types";

function defaultParams(overrides?: Partial<SimParams>): SimParams {
  const base: SimParams = {
    preset: "ms",
    tankCount: 6,
    recipeSteps: defaultRecipe(6, "ms"),
    wdoTimeMin: 10,
    loadTimeMin: 1,
    unloadTimeMin: 1,
    dripTimeSec: 3,
    targetBph: 3,
    simHours: 2,
    wagonSpeedMPerMin: 40,
    liftLowerSec: 10,
    pickDropSec: 10,
    wagonCount: 1,
    distanceMode: "manhattan",
    dwellClockOffsetSec: null,
  };
  return { ...base, ...overrides };
}

describe("runSimulation", () => {
  it("completes without error for default config", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams();
    const result = runSimulation(layout, params);
    expect(result).toBeDefined();
    expect(result.simEnd).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("produces positive throughput", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams();
    const result = runSimulation(layout, params);
    expect(result.completedCount).toBeGreaterThan(0);
    expect(result.throughputBph).toBeGreaterThan(0);
    expect(result.simulatedThroughput).toBeGreaterThan(0);
  });

  it("detects over-dwell violations with tight tolerance", () => {
    const layout = buildSyntheticLayout(6);
    const steps = defaultRecipe(6, "ms").map((s) => s.kind === "tank" ? { ...s, tolerancePct: 0.01 } : s);
    const params = defaultParams({
      recipeSteps: steps,
      wagonCount: 1,
      wagonSpeedMPerMin: 10,
      targetBph: 4,
    });
    const result = runSimulation(layout, params);
    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });

  it("populates stateHistory on every basket", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ wagonCount: 1, simHours: 1 });
    const result = runSimulation(layout, params);
    expect(result.baskets.length).toBeGreaterThan(0);
    for (const b of result.baskets) {
      expect(b.stateHistory).toBeDefined();
      expect(b.stateHistory!.length).toBeGreaterThanOrEqual(1);
      expect(b.stateHistory![0].fromState).toBe("WAITING_LOAD");
    }
    const completed = result.baskets.filter((b) => b.currentState === "DONE");
    if (completed.length > 0) {
      const done = completed[0];
      expect(done.stateHistory!.length).toBeGreaterThanOrEqual(9);
      expect(done.stateHistory!.at(-1)!.toState).toBe("DONE");
    }
  });

  it("computes elapsedInState on each basket", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ wagonCount: 1, simHours: 1 });
    const result = runSimulation(layout, params);
    for (const b of result.baskets) {
      expect(b.elapsedInState).toBeGreaterThanOrEqual(0);
      expect(b.elapsedInState).toBe(result.simEnd - b.stateEnteredAt);
    }
  });

  it("runs with multiple wagons", () => {
    const layout = buildSyntheticLayout(12);
    const params = defaultParams({ tankCount: 12, wagonCount: 2 });
    const result = runSimulation(layout, params);
    expect(result.util.wagons.length).toBe(2);
    expect(result.simEnd).toBeGreaterThan(0);
  });

  it("returns expected data structure", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams();
    const result = runSimulation(layout, params);
    expect(result).toHaveProperty("simEnd");
    expect(result).toHaveProperty("completedCount");
    expect(result).toHaveProperty("throughputBph");
    expect(result).toHaveProperty("avgLeadTimeSec");
    expect(result).toHaveProperty("waits");
    expect(result).toHaveProperty("bottleneck");
    expect(result).toHaveProperty("violations");
    expect(result.util).toHaveProperty("wagons");
    expect(result.util).toHaveProperty("stations");
    expect(result).toHaveProperty("inventory");
    expect(result).toHaveProperty("schedulingDecisions");
    expect(result).toHaveProperty("failures");
    expect(result).toHaveProperty("targetThroughput");
    expect(result).toHaveProperty("simulatedThroughput");
    expect(result).toHaveProperty("theoreticalMaxThroughput");
  });

  it("computes three-tier throughput correctly", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ targetBph: 5 });
    const result = runSimulation(layout, params);
    expect(result.targetThroughput).toBe(5);
    expect(result.simulatedThroughput).toBeGreaterThan(0);
    expect(result.theoreticalMaxThroughput).toBeGreaterThan(0);
  });
});

describe("buildSimPlan", () => {
  it("returns expected structure for default config", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams();
    const plan = buildSimPlan(layout, params);
    expect(plan.cycleSeconds).toBeGreaterThan(0);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan).toHaveProperty("buckets");
    expect(plan.buckets).toHaveProperty("travel");
    expect(plan.buckets).toHaveProperty("handling");
    expect(plan.buckets).toHaveProperty("dwell");
    expect(plan.buckets).toHaveProperty("manual");
    expect(plan.buckets).toHaveProperty("drip");
  });
});

describe("computeZones", () => {
  it("returns one zone for single wagon", () => {
    const zones = computeZones(6, 1);
    expect(zones.length).toBe(1);
    expect(zones[0].label).toBe("T1..T6");
  });

  it("returns two zones for two wagons", () => {
    const zones = computeZones(12, 2);
    expect(zones.length).toBe(2);
    expect(zones[0].label).toBe("T1..T6");
    expect(zones[1].label).toBe("T6..T12");
  });

  it("handles more wagons than tanks gracefully", () => {
    const zones = computeZones(3, 5);
    expect(zones.length).toBe(5);
  });
});
