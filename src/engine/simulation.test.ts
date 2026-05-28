import { describe, it, expect } from "vitest";
import { runSimulation, buildSimPlan, computeZones } from "./simulation";
import { buildSyntheticLayout, defaultRecipe } from "./layout";
import type { SimParams } from "../types";

function defaultParams(overrides?: Partial<SimParams>): SimParams {
  const base: SimParams = {
    preset: "ms",
    tankCount: 6,
    basketCount: 3,
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
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("populates stateHistory on every basket", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 1 });
    const result = runSimulation(layout, params);
    expect(result.baskets.length).toBe(2);
    for (const b of result.baskets) {
      expect(b.stateHistory).toBeDefined();
      expect(b.stateHistory!.length).toBeGreaterThanOrEqual(1);
      expect(b.stateHistory![0].fromState).toBe("WAITING_LOAD");
    }
  });

  it("baskets cycle via RESTART when unload completes", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 1, wagonCount: 1, simHours: 4 });
    const result = runSimulation(layout, params);
    expect(result.baskets.length).toBe(1);
    const b = result.baskets[0];
    expect(b.cycleCount).toBeGreaterThan(0);
    const restartEntry = b.stateHistory!.find((h) => h.reason === "cycle_restart");
    expect(restartEntry).toBeDefined();
    expect(restartEntry!.fromState).toBe("DONE");
    expect(restartEntry!.toState).toBe("WAITING_LOAD");
  });

  it("computes elapsedInState on each basket", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 1 });
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

  it("runs with 2 baskets", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 1 });
    const result = runSimulation(layout, params);
    expect(result.completedCount).toBeGreaterThan(0);
    expect(result.baskets.length).toBe(2);
  });

  it("runs with 5 baskets", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 5, wagonCount: 2, simHours: 1 });
    const result = runSimulation(layout, params);
    expect(result.completedCount).toBeGreaterThan(0);
    expect(result.baskets.length).toBe(5);
  });

  it("produces more throughput with more baskets", () => {
    const layout = buildSyntheticLayout(6);
    const p1 = defaultParams({ basketCount: 1, wagonCount: 1, simHours: 4 });
    const p5 = defaultParams({ basketCount: 5, wagonCount: 2, simHours: 4 });
    const r1 = runSimulation(layout, p1);
    const r5 = runSimulation(layout, p5);
    expect(r5.completedCount).toBeGreaterThan(r1.completedCount);
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

  it("pickup from LOAD only after load_done fires", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 2 });
    const result = runSimulation(layout, params);
    for (const e of result.events) {
      if (e.kind === "pickup" && e.from === "LOAD") {
        const hasPreceding = result.events.some(
          (ld) => ld.kind === "load_done" && ld.basketId === e.basketId && ld.t <= e.t,
        );
        expect(hasPreceding).toBe(true);
      }
    }
  });

  it("blocked basket waits at LOAD when T1 is occupied", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 2 });
    const result = runSimulation(layout, params);
    const b2LoadDone = result.events.find(
      (e) => e.kind === "load_done" && e.basketId === "B2",
    )!;
    const b2PickupFromLoad = result.events.find(
      (e) => e.kind === "pickup" && e.basketId === "B2" && e.from === "LOAD",
    )!;
    expect(b2PickupFromLoad.t - b2LoadDone.t).toBeGreaterThan(10);
  });

  it("FIFO: load_done occurs in creation order for first cycle", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 3, wagonCount: 1, simHours: 2 });
    const result = runSimulation(layout, params);
    const firstLoadEach = new Map<string, number>();
    for (const e of result.events) {
      if (e.kind === "load_done" && !firstLoadEach.has(e.basketId!)) {
        firstLoadEach.set(e.basketId!, e.t);
      }
    }
    expect(firstLoadEach.get("B1")).toBeLessThanOrEqual(firstLoadEach.get("B2")!);
    expect(firstLoadEach.get("B2")).toBeLessThanOrEqual(firstLoadEach.get("B3")!);
  });

  it("handles loadTimeMin = 0 edge case", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 1, wagonCount: 1, simHours: 1, loadTimeMin: 0 });
    const result = runSimulation(layout, params);
    const loadDone = result.events.find((e) => e.kind === "load_done" && e.basketId === "B1");
    expect(loadDone).toBeDefined();
    expect(loadDone!.t).toBeLessThan(10);
    expect(result.completedCount).toBeGreaterThan(0);
  });

  it("scheduling decisions contain urgency scores", () => {
    const layout = buildSyntheticLayout(6);
    const steps = defaultRecipe(6, "ms").map((s) => s.kind === "tank" ? { ...s, tolerancePct: 0.01 } : s);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 2, recipeSteps: steps });
    const result = runSimulation(layout, params);
    expect(result.schedulingDecisions.length).toBeGreaterThan(0);
    for (const d of result.schedulingDecisions) {
      expect(typeof d.urgencyScore).toBe("number");
      expect(Number.isNaN(d.urgencyScore)).toBe(false);
    }
  });

  it("scheduling decisions log rejected candidates", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 2, wagonCount: 1, simHours: 2 });
    const result = runSimulation(layout, params);
    const withRejects = result.schedulingDecisions.filter((d) => d.rejectedCandidates.length > 0);
    expect(withRejects.length).toBeGreaterThan(0);
    for (const d of withRejects) {
      for (const r of d.rejectedCandidates) {
        expect(r.basketId).toBeTruthy();
        expect(r.reason).toBeTruthy();
        expect(typeof r.urgency).toBe("number");
      }
    }
  });

  it("tie-breaking is deterministic (same input = same output)", () => {
    const layout = buildSyntheticLayout(6);
    const params = defaultParams({ basketCount: 3, wagonCount: 1, simHours: 2 });
    const r1 = runSimulation(layout, params);
    const r2 = runSimulation(layout, params);
    expect(r1.schedulingDecisions.length).toBe(r2.schedulingDecisions.length);
    for (let i = 0; i < r1.schedulingDecisions.length; i++) {
      expect(r1.schedulingDecisions[i].selectedBasketId).toBe(r2.schedulingDecisions[i].selectedBasketId);
      expect(r1.schedulingDecisions[i].urgencyScore).toBe(r2.schedulingDecisions[i].urgencyScore);
      expect(r1.schedulingDecisions[i].timestamp).toBe(r2.schedulingDecisions[i].timestamp);
    }
  });

  it("violation cause is wagon_unavailable when wagon is too slow", () => {
    const layout = buildSyntheticLayout(6);
    const steps = defaultRecipe(6, "ms").map((s) => s.kind === "tank" ? { ...s, tolerancePct: 0.01 } : s);
    const params = defaultParams({
      recipeSteps: steps, wagonCount: 1, wagonSpeedMPerMin: 5, targetBph: 5,
      basketCount: 2, simHours: 2,
    });
    const result = runSimulation(layout, params);
    expect(result.violations.length).toBeGreaterThan(0);
    const wagonCauses = result.violations.filter((v) => v.cause === "wagon_unavailable");
    expect(wagonCauses.length).toBeGreaterThan(0);
  });

  it("violation cause is destination_blocked when next tank is occupied", () => {
    const layout = buildSyntheticLayout(6);
    const steps = defaultRecipe(6, "ms").map((s) => s.kind === "tank" ? { ...s, tolerancePct: 0.05 } : s);
    const params = defaultParams({
      recipeSteps: steps, wagonCount: 1, wagonSpeedMPerMin: 40, targetBph: 6,
      basketCount: 3, simHours: 3,
    });
    const result = runSimulation(layout, params);
    const blockedCauses = result.violations.filter((v) => v.cause === "destination_blocked");
    expect(blockedCauses.length).toBeGreaterThan(0);
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
