import { describe, it, expect } from "vitest";
import {
  createDefaultLineConfig,
  lineConfigToSimParams,
  lineConfigToLayout,
  lineConfigFromSimParams,
  type LineConfig,
} from "./LineConfig";

describe("createDefaultLineConfig", () => {
  it("returns LOAD + 1 tank + UNLOAD", () => {
    const config = createDefaultLineConfig();
    expect(config.stations.length).toBe(3);
    expect(config.stations[0].id).toBe("LOAD");
    expect(config.stations[0].kind).toBe("loading");
    expect(config.stations[1].id).toBe("T1");
    expect(config.stations[1].kind).toBe("tank");
    expect(config.stations[2].id).toBe("UNLOAD");
    expect(config.stations[2].kind).toBe("unloading");
  });

  it("defaults tank 1 to chemical with 2.5 min dwell", () => {
    const config = createDefaultLineConfig();
    const tank = config.stations.find((s) => s.kind === "tank")!;
    expect(tank.tankType).toBe("chemical");
    expect(tank.dwellSec).toBe(150);
    expect(tank.tolerancePct).toBe(0.1);
  });

  it("load/unload stations have zero dwell", () => {
    const config = createDefaultLineConfig();
    const load = config.stations.find((s) => s.kind === "loading")!;
    const unload = config.stations.find((s) => s.kind === "unloading")!;
    expect(load.dwellSec).toBe(0);
    expect(unload.dwellSec).toBe(0);
  });

  it("no WDO in default config", () => {
    const config = createDefaultLineConfig();
    const wdo = config.stations.find((s) => s.kind === "wdo");
    expect(wdo).toBeUndefined();
  });

  it("transport defaults are sensible", () => {
    const config = createDefaultLineConfig();
    const t = config.transport;
    expect(t.wagonCount).toBe(1);
    expect(t.wagonSpeedMPerMin).toBe(18);
    expect(t.liftSec + t.dripSec + t.lowerSec).toBe(20);
    expect(t.pickSec + t.dropSec).toBe(10);
    expect(t.distanceMode).toBe("manhattan");
  });

  it("settings defaults are sensible", () => {
    const config = createDefaultLineConfig();
    expect(config.settings.articleMaterialType).toBe("mild_steel");
    expect(config.settings.targetBph).toBe(2.0);
    expect(config.settings.simHours).toBe(2);
    expect(config.settings.basketCount).toBe(2);
  });
});

describe("lineConfigToSimParams", () => {
  it("preserves station sequence in recipeSteps", () => {
    const config = lineConfigWithWdo();
    const params = lineConfigToSimParams(config);
    expect(params.recipeSteps.length).toBe(4);
    expect(params.recipeSteps[0].id).toBe("LOAD");
    expect(params.recipeSteps[1].id).toBe("T1");
    expect(params.recipeSteps[2].id).toBe("WDO");
    expect(params.recipeSteps[3].id).toBe("UNLOAD");
  });

  it("maps tank-type stations to recipe steps with dwell", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    const tankStep = params.recipeSteps.find((s) => s.id === "T1")!;
    expect(tankStep).toBeDefined();
    expect(tankStep.dwellSec).toBe(150);
    expect(tankStep.tankType).toBe("chemical");
    expect(tankStep.kind).toBe("tank");
  });

  it("maps loading/unloading stations to recipe steps", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    const load = params.recipeSteps.find((s) => s.id === "LOAD")!;
    const unload = params.recipeSteps.find((s) => s.id === "UNLOAD")!;
    expect(load.kind).toBe("station");
    expect(unload.kind).toBe("station");
  });

  it("sets tankCount from number of tanks", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    expect(params.tankCount).toBe(1);
  });

  it("sets transport fields from TransportConfig", () => {
    const config = createDefaultLineConfig();
    config.transport = { ...config.transport, liftSec: 8, dripSec: 4, lowerSec: 8, pickSec: 5, dropSec: 5, wagonSpeedMPerMin: 20 };
    const params = lineConfigToSimParams(config);
    expect(params.wagonSpeedMPerMin).toBe(20);
  });

  it("sets settings fields from RunSettings", () => {
    const config = createDefaultLineConfig();
    config.settings = { ...config.settings, targetBph: 3.5, simHours: 4, basketCount: 3 };
    const params = lineConfigToSimParams(config);
    expect(params.targetBph).toBe(3.5);
    expect(params.simHours).toBe(4);
    // basketCount is now auto-computed via computeOptimalBasketCount, not from settings
    expect(params.basketCount).toBeGreaterThanOrEqual(1);
  });

  it("produces preset 'custom' for all configs", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    expect(params.preset).toBe("custom");
  });
});

describe("lineConfigToSimParams — extra tank", () => {
  it("extra tank type maps to tankType undefined (placeholder)", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1, {
      id: "T1", label: "Tank 1", kind: "tank", tankType: "extra", dwellSec: 0,
    });
    const params = lineConfigToSimParams(config);
    const t1 = params.recipeSteps.find((s) => s.id === "T1")!;
    expect(t1.tankType).toBeUndefined();
    expect(t1.tolerancePct).toBeUndefined();
  });
});

describe("lineConfigToLayout", () => {
  it("has a node for every station", () => {
    const config = lineConfigWithWdo();
    const layout = lineConfigToLayout(config);
    const ids = layout.nodes.map((n) => n.id);
    expect(ids).toContain("LOAD");
    expect(ids).toContain("T1");
    expect(ids).toContain("WDO");
    expect(ids).toContain("UNLOAD");
  });

  it("correctly types each layout node", () => {
    const config = lineConfigWithWdo();
    const layout = lineConfigToLayout(config);
    expect(layout.nodes.find((n) => n.id === "LOAD")!.type).toBe("station");
    expect(layout.nodes.find((n) => n.id === "T1")!.type).toBe("tank");
    expect(layout.nodes.find((n) => n.id === "WDO")!.type).toBe("oven");
    expect(layout.nodes.find((n) => n.id === "UNLOAD")!.type).toBe("station");
  });

  it("positions nodes along x-axis with spacing", () => {
    const config = lineConfigWithWdo();
    const layout = lineConfigToLayout(config);
    const load = layout.nodes.find((n) => n.id === "LOAD")!;
    const t1 = layout.nodes.find((n) => n.id === "T1")!;
    const unload = layout.nodes.find((n) => n.id === "UNLOAD")!;
    expect(load.x).toBeLessThan(t1.x);
    expect(t1.x).toBeLessThan(unload.x);
  });

  it("positions multiple tanks with increasing x", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 0,
      { id: "T1", label: "Tank 1", kind: "tank", tankType: "chemical", dwellSec: 150, tolerancePct: 0.1 },
      { id: "T2", label: "Tank 2", kind: "tank", tankType: "rinse", dwellSec: 60, tolerancePct: 0.5 },
    );
    const layout = lineConfigToLayout(config);
    const t1 = layout.nodes.find((n) => n.id === "T1")!;
    const t2 = layout.nodes.find((n) => n.id === "T2")!;
    expect(t2.x - t1.x).toBe(1400);
  });

  it("sets meta.source to synthetic", () => {
    const config = createDefaultLineConfig();
    const layout = lineConfigToLayout(config);
    expect(layout.meta.source).toBe("synthetic");
  });

  it("includes a PCO marker after UNLOAD", () => {
    const config = createDefaultLineConfig();
    const layout = lineConfigToLayout(config);
    const pco = layout.nodes.find((n) => n.id === "PCO");
    expect(pco).toBeDefined();
    expect(pco!.type).toBe("marker");
  });
});

describe("lineConfigFromSimParams — station kind inference", () => {
  it("infers loading from LOAD id", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    const restored = lineConfigFromSimParams(params);
    const load = restored.stations.find((s) => s.id === "LOAD")!;
    expect(load.kind).toBe("loading");
  });

  it("infers unloading from UNLOAD id", () => {
    const config = createDefaultLineConfig();
    const params = lineConfigToSimParams(config);
    const restored = lineConfigFromSimParams(params);
    const unload = restored.stations.find((s) => s.id === "UNLOAD")!;
    expect(unload.kind).toBe("unloading");
  });

  it("falls back to loading for non-LOAD station id", () => {
    const config = lineConfigToSimParams(createDefaultLineConfig());
    // Insert a recipe step with a non-standard station id
    config.recipeSteps.push({ id: "CUSTOM", label: "Custom", dwellSec: 0, kind: "station" });
    const restored = lineConfigFromSimParams(config);
    const custom = restored.stations.find((s) => s.id === "CUSTOM")!;
    expect(custom.kind).toBe("loading");
  });
});

describe("lineConfigFromSimParams — round-trip", () => {
  it("round-trips through toSimParams", () => {
    const original = lineConfigWithWdo();
    const params = lineConfigToSimParams(original);
    const restored = lineConfigFromSimParams(params);
    expect(restored.stations.length).toBe(original.stations.length);
    for (let i = 0; i < original.stations.length; i++) {
      expect(restored.stations[i].id).toBe(original.stations[i].id);
      expect(restored.stations[i].kind).toBe(original.stations[i].kind);
      expect(restored.stations[i].dwellSec).toBe(original.stations[i].dwellSec);
    }
  });

  it("restores total transport combined values (lossy split)", () => {
    const config = lineConfigWithWdo();
    config.transport = { ...config.transport, liftSec: 12, lowerSec: 8, pickSec: 7, dropSec: 3 };
    const params = lineConfigToSimParams(config);
    expect(params.liftLowerSec).toBe(20);
    expect(params.pickDropSec).toBe(10);
    const restored = lineConfigFromSimParams(params);
    // Round-trip note: asymmetric splits are lost — only the total sum is preserved
    expect(restored.transport.liftSec + restored.transport.lowerSec).toBe(20);
    expect(restored.transport.pickSec + restored.transport.dropSec).toBe(10);
  });

  it("restores transport fields", () => {
    const original = lineConfigWithWdo();
    const params = lineConfigToSimParams(original);
    const restored = lineConfigFromSimParams(params);
    expect(restored.transport.wagonCount).toBe(original.transport.wagonCount);
    expect(restored.transport.wagonSpeedMPerMin).toBe(original.transport.wagonSpeedMPerMin);
  });

  it("restores settings", () => {
    const original = lineConfigWithWdo();
    const params = lineConfigToSimParams(original);
    const restored = lineConfigFromSimParams(params);
    expect(restored.settings.targetBph).toBe(original.settings.targetBph);
    expect(restored.settings.simHours).toBe(original.settings.simHours);
    expect(restored.settings.basketCount).toBe(original.settings.basketCount);
  });
});

function lineConfigWithWdo(): LineConfig {
  const config = createDefaultLineConfig();
  config.stations.splice(2, 0, {
    id: "WDO",
    label: "WDO",
    kind: "wdo",
    dwellSec: 600,
    maxDwellSec: 900,
  });
  return config;
}
