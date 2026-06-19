import { describe, it, expect } from "vitest";
import { analyzeConstraints } from "./constraints";
import { createDefaultLineConfig } from "../builder/LineConfig";
import type { LineConfig } from "../builder/LineConfig";
import type { SimulationResult } from "../types";

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
    { id: "WDO", label: "Dry-Off Oven", kind: "wdo", dwellSec: 0, dryTimeSec: 120, maxDwellSec: 300 },
    { id: "UNLOAD", label: "Unloading", kind: "unloading", dwellSec: 0 },
  ];
  cfg.transport.wagonCount = 1;
  cfg.transport.wagons = [
    { id: "W1", fromStationId: "LOAD", toStationId: "UNLOAD", speedMPerMin: 18, liftSec: 10, lowerSec: 6, pickSec: 6, dropSec: 4 },
  ];
  return cfg;
}

describe("analyzeConstraints", () => {
  it("returns one entry per loading/unloading component", () => {
    const cfg = multiStationConfig();
    const result = mockResult();
    const entries = analyzeConstraints(cfg, result);
    // LOAD + UNLOAD = 2
    expect(entries).toHaveLength(2);
  });

  it("loading shows queue depth and queue analysis", () => {
    const cfg = multiStationConfig();
    const result = mockResult({
      loading: { avgQueueWaitSec: 10, maxQueueDepth: 5, processingUtil01: 0.9, totalBasketsLoaded: 10 },
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
    });
    const entries = analyzeConstraints(cfg, result);
    const unload = entries.find((e) => e.componentId === "UNLOAD")!;
    expect(unload.queueAnalysis).toBeDefined();
    expect(unload.queueAnalysis!.timeline.length).toBeGreaterThan(0);
  });
});
