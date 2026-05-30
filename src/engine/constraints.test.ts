import { describe, it, expect } from "vitest";
import { analyzeConstraints } from "./constraints";
import { createDefaultLineConfig } from "../builder/LineConfig";
import type { LineConfig } from "../builder/LineConfig";
import type { SimulationResult, Violation } from "../types";

/** Build a minimal SimulationResult with only the fields analyzeConstraints reads. */
function mockResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    simEnd: 7200,
    completedCount: 10,
    throughputBph: 5,
    throughputSteadyBph: 5,
    throughputTrimmedBph: 5,
    throughputStatus: "ok",
    avgLeadTimeSec: 600,
    waits: {},
    bottleneck: "none",
    violations: [],
    util: { wagons: [], stations: [] },
    loading: { avgQueueWaitSec: 0, maxQueueDepth: 1, processingUtil01: 0.5, totalBasketsLoaded: 10 },
    unloading: { maxQueueDepth: 1 },
    inventory: { avgWip: 2, maxWip: 3, optimalWip: 2, recommendedBuffer: 1, excessWip: 0, recommendedBph: 5, arrivalBph: 5, isOverfeeding: false, wipSamples: [] },
    baskets: [],
    events: [],
    snapshots: [],
    schedulingDecisions: [],
    failures: [],
    lineStopped: false,
    targetThroughput: 5,
    simulatedThroughput: 5,
    theoreticalMaxThroughput: 6,
    ...overrides,
  } as SimulationResult;
}

/** Build a config with LOAD + T1 + T2 + WDO + UNLOAD and 1 wagon. */
function multiStationConfig(): LineConfig {
  const cfg = createDefaultLineConfig();
  cfg.stations = [
    { id: "LOAD", label: "Loading", kind: "loading", dwellSec: 0 },
    { id: "T1", label: "Tank 1", kind: "tank", tankType: "chemical", dwellSec: 150, tolerancePct: 0.1 },
    { id: "T2", label: "Tank 2", kind: "tank", tankType: "rinse", dwellSec: 60, tolerancePct: 0.5 },
    { id: "WDO", label: "Dry-Off Oven", kind: "wdo", dwellSec: 120, maxDwellSec: 300 },
    { id: "UNLOAD", label: "Unloading", kind: "unloading", dwellSec: 0 },
  ];
  cfg.transport.wagonCount = 1;
  cfg.transport.wagons = [
    { id: "W1", fromStationId: "LOAD", toStationId: "UNLOAD", speedMPerMin: 18, liftSec: 10, dripSec: 4, lowerSec: 6, pickSec: 6, dropSec: 4 },
  ];
  return cfg;
}

describe("analyzeConstraints", () => {
  it("returns one entry per component", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    // LOAD + T1 + T2 + WDO + UNLOAD + W1 + BASKET = 7
    expect(entries).toHaveLength(7);
  });

  it("tank with 0 violations has status ok", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.status).toBe("ok");
    expect(t1.violations).toHaveLength(0);
  });

  it("tank with over-dwell has status violated", () => {
    const cfg = multiStationConfig();
    const violation: Violation = {
      basketId: "B1", tankId: "T1", type: "over_dwell",
      elapsed: 195, dwellTime: 150, tolerancePct: 0.1,
      earliestExit: 135, latestExit: 165, timestamp: 500, cause: "wagon_unavailable",
    };
    const result = mockResult({
      violations: [violation],
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.status).toBe("violated");
    expect(t1.violations.length).toBeGreaterThan(0);
  });

  it("tank with under-dwell has status violated", () => {
    const cfg = multiStationConfig();
    const violation: Violation = {
      basketId: "B2", tankId: "T1", type: "under_dwell",
      elapsed: 120, dwellTime: 150, tolerancePct: 0.1,
      earliestExit: 135, latestExit: 165, timestamp: 300, cause: "line_design",
    };
    const result = mockResult({
      violations: [violation],
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.status).toBe("violated");
  });

  it("violation description includes elapsed, limit, and overshoot", () => {
    const cfg = multiStationConfig();
    const violation: Violation = {
      basketId: "B2", tankId: "T1", type: "over_dwell",
      elapsed: 195, dwellTime: 150, tolerancePct: 0.1,
      earliestExit: 135, latestExit: 165, timestamp: 500, cause: "wagon_unavailable",
    };
    const result = mockResult({
      violations: [violation],
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    const desc = t1.violations[0].description;
    expect(desc).toContain("195s");
    expect(desc).toContain("165s");
    expect(desc).toContain("30s");
  });

  it("violation cause is human-readable", () => {
    const cfg = multiStationConfig();
    const violations: Violation[] = [
      { basketId: "B1", tankId: "T1", type: "over_dwell", elapsed: 195, dwellTime: 150, tolerancePct: 0.1, earliestExit: 135, latestExit: 165, timestamp: 500, cause: "wagon_unavailable" },
      { basketId: "B2", tankId: "T1", type: "over_dwell", elapsed: 200, dwellTime: 150, tolerancePct: 0.1, earliestExit: 135, latestExit: 165, timestamp: 800, cause: "destination_blocked" },
    ];
    const result = mockResult({
      violations,
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.violations[0].cause).toContain("Wagon");
    expect(t1.violations[1].cause).toContain("occupied");
  });

  it("extra tank has no constraints and always ok", () => {
    const cfg = createDefaultLineConfig();
    cfg.stations = [
      { id: "LOAD", label: "Loading", kind: "loading", dwellSec: 0 },
      { id: "T1", label: "Tank 1", kind: "tank", tankType: "extra", dwellSec: 0 },
      { id: "UNLOAD", label: "Unloading", kind: "unloading", dwellSec: 0 },
    ];
    const result = mockResult();
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.status).toBe("ok");
    expect(t1.rule).toContain("Passthrough");
  });

  it("WDO max_time violation is reported", () => {
    const cfg = multiStationConfig();
    const violation: Violation = {
      basketId: "B1", tankId: "WDO", type: "max_time",
      elapsed: 350, dwellTime: 120, tolerancePct: 0,
      earliestExit: 120, latestExit: 300, timestamp: 1000, cause: "wagon_unavailable",
    };
    const result = mockResult({
      violations: [violation],
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const wdo = entries.find((e) => e.componentId === "WDO")!;
    expect(wdo.status).toBe("violated");
    expect(wdo.violations[0].description).toContain("350s");
  });

  it("loading shows queue depth and queue analysis", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      loading: { avgQueueWaitSec: 10, maxQueueDepth: 5, processingUtil01: 0.9, totalBasketsLoaded: 10 },
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const load = entries.find((e) => e.componentId === "LOAD")!;
    expect(load.queueAnalysis).toBeDefined();
    expect(load.queueAnalysis!.timeline.length).toBeGreaterThan(0);
  });

  it("loading with zero load time is not a bottleneck", () => {
    const cfg = multiStationConfig();
    cfg.stations[0].dwellSec = 0; // LOAD has 0 dwell
    const result = mockResult({
      loading: { avgQueueWaitSec: 0, maxQueueDepth: 1, processingUtil01: 0.1, totalBasketsLoaded: 10 },
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const load = entries.find((e) => e.componentId === "LOAD")!;
    expect(load.status).toBe("ok");
    expect(load.queueAnalysis!.isBottleneck).toBe(false);
  });

  it("unloading shows queue depth and queue analysis", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      unloading: { maxQueueDepth: 4 },
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const unload = entries.find((e) => e.componentId === "UNLOAD")!;
    expect(unload.queueAnalysis).toBeDefined();
    expect(unload.queueAnalysis!.timeline.length).toBeGreaterThan(0);
  });

  it("wagon overloaded when util > 0.9", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: {
        wagons: [{ id: "W1", util01: 0.95, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 6840, idleSec: 360, movingSec: 3000, waitingSec: 200, blockedSec: 100, handlingSec: 3540 }],
        stations: [],
      },
    });
    const entries = analyzeConstraints(cfg, result);
    const w1 = entries.find((e) => e.componentId === "W1")!;
    expect(w1.status).toBe("warning");
  });

  it("wagon underutilized when idle > 50%", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: {
        wagons: [{ id: "W1", util01: 0.3, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 2160, idleSec: 5040, movingSec: 1000, waitingSec: 500, blockedSec: 0, handlingSec: 660 }],
        stations: [],
      },
    });
    const entries = analyzeConstraints(cfg, result);
    const w1 = entries.find((e) => e.componentId === "W1")!;
    expect(w1.status).toBe("warning");
  });

  it("rule string is human-readable for chemical tank", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    // T1: dwellSec=150, tolerancePct=0.1 → "Dwell: 2m30s ± 10% (2m15s – 2m45s)"
    expect(t1.rule).toContain("2m30s");
    expect(t1.rule).toContain("10%");
    expect(t1.rule).toContain("2m15s");
    expect(t1.rule).toContain("2m45s");
  });

  it("basket with no capacity fields has status ok", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const basket = entries.find((e) => e.componentId === "BASKET")!;
    expect(basket.status).toBe("ok");
    expect(basket.rule).toContain("No capacity constraints configured");
  });

  it("basket with payload within limit has status ok", () => {
    const cfg = multiStationConfig();
    cfg.transport.maxWeightKg = 50;
    cfg.transport.articleWeightKg = 2;
    cfg.transport.maxArticlesPerBasket = 20; // 40 kg <= 50 kg
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const basket = entries.find((e) => e.componentId === "BASKET")!;
    expect(basket.status).toBe("ok");
  });

  it("basket with payload over 80% has status warning", () => {
    const cfg = multiStationConfig();
    cfg.transport.maxWeightKg = 50;
    cfg.transport.articleWeightKg = 2;
    cfg.transport.maxArticlesPerBasket = 22; // 44 kg = 88% of 50 kg
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const basket = entries.find((e) => e.componentId === "BASKET")!;
    expect(basket.status).toBe("warning");
  });

  it("basket with payload exceeding limit has status violated", () => {
    const cfg = multiStationConfig();
    cfg.transport.maxWeightKg = 50;
    cfg.transport.articleWeightKg = 2;
    cfg.transport.maxArticlesPerBasket = 30; // 60 kg > 50 kg
    const result = mockResult({
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const basket = entries.find((e) => e.componentId === "BASKET")!;
    expect(basket.status).toBe("violated");
    expect(basket.violations[0].description).toContain("exceeds");
  });

  it("violations capped at 5 per component with totalCount", () => {
    const cfg = multiStationConfig();
    const violations: Violation[] = [];
    for (let i = 0; i < 20; i++) {
      violations.push({
        basketId: `B${i}`, tankId: "T1", type: "over_dwell",
        elapsed: 195 + i, dwellTime: 150, tolerancePct: 0.1,
        earliestExit: 135, latestExit: 165, timestamp: 500 + i * 100, cause: "wagon_unavailable",
      });
    }
    const result = mockResult({
      violations,
      util: { wagons: [{ id: "W1", util01: 0.5, zone: { idx: 0, startTank: 0, endTank: 1, homePos: "LOAD", label: "Zone 1" }, busySec: 3600, idleSec: 3600, movingSec: 1800, waitingSec: 900, blockedSec: 0, handlingSec: 900 }], stations: [] },
    });
    const entries = analyzeConstraints(cfg, result);
    const t1 = entries.find((e) => e.componentId === "T1")!;
    expect(t1.violations).toHaveLength(5);
    expect(t1.totalViolationCount).toBe(20);
  });
});
