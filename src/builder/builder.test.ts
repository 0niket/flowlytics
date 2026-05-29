import { describe, it, expect } from "vitest";
import { Builder } from "./builder";
import { createDefaultLineConfig } from "./LineConfig";

describe("Builder", () => {
  it("starts at step 0 (STATIONS)", () => {
    const b = new Builder();
    expect(b.currentStep).toBe(0);
  });

  it("starts with default LineConfig", () => {
    const b = new Builder();
    expect(b.config.stations.length).toBe(3);
  });

  it("pre-fills from existing config", () => {
    const config = createDefaultLineConfig();
    config.settings.targetBph = 5;
    const b = new Builder(config);
    expect(b.config.settings.targetBph).toBe(5);
  });
});

describe("Builder — station operations", () => {
  it("addTank inserts a chemical tank after the given index", () => {
    const b = new Builder();
    b.addTank(1);
    expect(b.config.stations.length).toBe(4);
    expect(b.config.stations[1].id).toBe("T1");
    expect(b.config.stations[1].kind).toBe("tank");
    expect(b.config.stations[1].tankType).toBe("chemical");
    expect(b.config.stations[2].id).toBe("T2");
  });

  it("addTank re-indexes existing tank IDs", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    expect(b.config.stations.length).toBe(5);
    expect(b.config.stations[1].id).toBe("T1");
    expect(b.config.stations[2].id).toBe("T2");
    expect(b.config.stations[3].id).toBe("T3");
  });

  it("addTank throws when index is 0 (before LOAD)", () => {
    const b = new Builder();
    expect(() => b.addTank(0)).toThrow("Cannot add tank before LOAD");
  });

  it("addTank throws when index is at or past UNLOAD", () => {
    const b = new Builder();
    const unloadIdx = b.config.stations.findIndex((s) => s.kind === "unloading");
    expect(() => b.addTank(unloadIdx)).toThrow("Cannot add tank after UNLOAD");
  });

  it("removeTank removes the station at the given index", () => {
    const b = new Builder();
    b.addTank(1);
    b.removeTank(2);
    expect(b.config.stations.length).toBe(3);
    expect(b.config.stations[2].id).toBe("UNLOAD");
  });

  it("removeTank re-indexes remaining tanks", () => {
    const b = new Builder();
    b.addTank(1);
    b.removeTank(1);
    expect(b.config.stations.filter((s) => s.kind === "tank").length).toBe(1);
    expect(b.config.stations[1].id).toBe("T1");
  });

  it("removeTank throws when attempting to remove last tank", () => {
    const b = new Builder();
    expect(() => b.removeTank(1)).toThrow("At least 1 tank is required");
  });

  it("removeTank throws when index is not a tank", () => {
    const b = new Builder();
    expect(() => b.removeTank(0)).toThrow("No tank at index 0");
  });

  it("setTankType updates tank type", () => {
    const b = new Builder();
    b.setTankType(1, "rinse");
    const tank = b.config.stations.find((s) => s.kind === "tank")!;
    expect(tank.tankType).toBe("rinse");
    expect(tank.tolerancePct).toBe(0.5);
  });

  it("setTankType to extra clears dwell and tolerance", () => {
    const b = new Builder();
    b.setTankType(1, "extra");
    const tank = b.config.stations.find((s) => s.kind === "tank")!;
    expect(tank.tankType).toBe("extra");
    expect(tank.dwellSec).toBe(0);
    expect(tank.tolerancePct).toBeUndefined();
  });

  it("setTankType throws when index is not a tank", () => {
    const b = new Builder();
    expect(() => b.setTankType(0, "rinse")).toThrow("No tank at index 0");
  });

  it("setDwell updates tank dwell", () => {
    const b = new Builder();
    b.setDwell(1, 300);
    const tank = b.config.stations.find((s) => s.kind === "tank")!;
    expect(tank.dwellSec).toBe(300);
  });

  it("setDwell throws when index is not a tank", () => {
    const b = new Builder();
    expect(() => b.setDwell(0, 100)).toThrow("No tank at index 0");
  });

  it("setDwell throws on negative dwell", () => {
    const b = new Builder();
    expect(() => b.setDwell(1, -1)).toThrow("Dwell time cannot be negative");
  });

  it("enableWdo adds WDO after last tank", () => {
    const b = new Builder();
    b.enableWdo();
    const wdo = b.config.stations.find((s) => s.kind === "wdo");
    expect(wdo).toBeDefined();
    expect(wdo!.dwellSec).toBe(600);
    expect(wdo!.maxDwellSec).toBe(900);
    const unloadIdx = b.config.stations.findIndex((s) => s.kind === "unloading");
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    expect(wdoIdx).toBeLessThan(unloadIdx);
  });

  it("disableWdo removes WDO", () => {
    const b = new Builder();
    b.enableWdo();
    expect(b.config.stations.some((s) => s.kind === "wdo")).toBe(true);
    b.disableWdo();
    expect(b.config.stations.some((s) => s.kind === "wdo")).toBe(false);
  });

  it("enableWdo is idempotent", () => {
    const b = new Builder();
    b.enableWdo();
    b.enableWdo();
    const wdoCount = b.config.stations.filter((s) => s.kind === "wdo").length;
    expect(wdoCount).toBe(1);
  });

  it("setLoadStationTime updates loading dwell", () => {
    const b = new Builder();
    b.setLoadStationTime(120);
    const load = b.config.stations.find((s) => s.kind === "loading")!;
    expect(load.dwellSec).toBe(120);
  });

  it("setLoadStationTime throws on negative", () => {
    const b = new Builder();
    expect(() => b.setLoadStationTime(-1)).toThrow("Load time cannot be negative");
  });

  it("setUnloadStationTime updates unloading dwell", () => {
    const b = new Builder();
    b.setUnloadStationTime(60);
    const unload = b.config.stations.find((s) => s.kind === "unloading")!;
    expect(unload.dwellSec).toBe(60);
  });

  it("setUnloadStationTime throws on negative", () => {
    const b = new Builder();
    expect(() => b.setUnloadStationTime(-5)).toThrow("Unload time cannot be negative");
  });
});

describe("Builder — transport operations", () => {
  it("setWagonCount updates wagon count", () => {
    const b = new Builder();
    b.setWagonCount(2);
    expect(b.config.transport.wagonCount).toBe(2);
  });

  it("setWagonSpeed updates speed", () => {
    const b = new Builder();
    b.setWagonSpeed(25);
    expect(b.config.transport.wagonSpeedMPerMin).toBe(25);
  });

  it("setWagonSpeed throws on zero", () => {
    const b = new Builder();
    expect(() => b.setWagonSpeed(0)).toThrow("Speed must be at least 1");
  });

  it("setLiftTime updates lift sec", () => {
    const b = new Builder();
    b.setLiftTime(12);
    expect(b.config.transport.liftSec).toBe(12);
  });

  it("setLowerTime updates lower sec", () => {
    const b = new Builder();
    b.setLowerTime(8);
    expect(b.config.transport.lowerSec).toBe(8);
  });

  it("setDripTime updates drip sec", () => {
    const b = new Builder();
    b.setDripTime(5);
    expect(b.config.transport.dripSec).toBe(5);
  });

  it("setPickTime updates pick sec", () => {
    const b = new Builder();
    b.setPickTime(7);
    expect(b.config.transport.pickSec).toBe(7);
  });

  it("setDropTime updates drop sec", () => {
    const b = new Builder();
    b.setDropTime(3);
    expect(b.config.transport.dropSec).toBe(3);
  });
});

describe("Builder — settings operations", () => {
  it("setArticleMaterial updates material type", () => {
    const b = new Builder();
    b.setArticleMaterial("aluminium");
    expect(b.config.settings.articleMaterialType).toBe("aluminium");
  });

  it("setTargetBph updates target", () => {
    const b = new Builder();
    b.setTargetBph(3);
    expect(b.config.settings.targetBph).toBe(3);
  });

  it("setSimHours updates duration", () => {
    const b = new Builder();
    b.setSimHours(4);
    expect(b.config.settings.simHours).toBe(4);
  });

  it("setBasketCount updates count", () => {
    const b = new Builder();
    b.setBasketCount(3);
    expect(b.config.settings.basketCount).toBe(3);
  });
});

describe("Builder — step navigation", () => {
  it("canGoNext returns true when valid", () => {
    const b = new Builder();
    expect(b.canGoNext()).toBe(true);
  });

  it("canGoNext returns false when no tanks", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1);
    const b = new Builder(config);
    expect(b.canGoNext()).toBe(false);
  });

  it("next advances step, back returns", () => {
    const b = new Builder();
    b.next();
    expect(b.currentStep).toBe(1);
    b.back();
    expect(b.currentStep).toBe(0);
  });

  it("next does nothing if canGoNext is false", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1);
    const b = new Builder(config);
    b.next();
    expect(b.currentStep).toBe(0);
  });

  it("back does nothing at step 0", () => {
    const b = new Builder();
    b.back();
    expect(b.currentStep).toBe(0);
  });

  it("next advances through all 4 steps", () => {
    const b = new Builder();
    expect(b.currentStep).toBe(0);
    b.next(); expect(b.currentStep).toBe(1);
    b.next(); expect(b.currentStep).toBe(2);
    b.next(); expect(b.currentStep).toBe(3);
  });

  it("next does nothing at REVIEW_STEP", () => {
    const b = new Builder();
    b.next(); b.next(); b.next();
    b.next();
    expect(b.currentStep).toBe(3);
  });
});

describe("Builder — validation", () => {
  it("validate returns empty when config is valid", () => {
    const b = new Builder();
    expect(b.validate()).toEqual([]);
  });

  it("validate returns error when no tanks", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1);
    const b = new Builder(config);
    expect(b.validate()).toContain("At least 1 tank is required");
  });

  it("validate skips station checks outside STATION or REVIEW step", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1);
    const b = new Builder(config);
    b.currentStep = 1; // TRANSPORT step — should skip station validation
    expect(b.validate()).toEqual([]);
  });
});

describe("Builder — isComplete", () => {
  it("isComplete returns false before reaching REVIEW", () => {
    const b = new Builder();
    expect(b.isComplete()).toBe(false);
  });

  it("isComplete returns true at REVIEW step when valid", () => {
    const b = new Builder();
    b.next(); b.next(); b.next();
    expect(b.isComplete()).toBe(true);
  });

  it("isComplete returns false at REVIEW with validation errors", () => {
    const config = createDefaultLineConfig();
    config.stations.splice(1, 1);
    const b = new Builder(config);
    b.next(); b.next(); b.next();
    expect(b.isComplete()).toBe(false);
  });
});

describe("Builder — pre-fill from existing", () => {
  it("creates builder with custom config", () => {
    const custom = createDefaultLineConfig();
    custom.settings.articleMaterialType = "stainless_steel";
    custom.transport.wagonCount = 3;
    custom.stations.push({
      id: "WDO", label: "WDO", kind: "wdo", dwellSec: 600, maxDwellSec: 900,
    });
    const b = new Builder(custom);
    expect(b.config.settings.articleMaterialType).toBe("stainless_steel");
    expect(b.config.transport.wagonCount).toBe(3);
    expect(b.config.stations.some((s) => s.kind === "wdo")).toBe(true);
  });
});

describe("Builder — toLineConfig", () => {
  it("returns a deep copy of the config", () => {
    const b = new Builder();
    const cfg = b.toLineConfig();
    cfg.settings.targetBph = 999;
    expect(b.config.settings.targetBph).not.toBe(999);
  });
});

describe("Builder — clamping and edge cases", () => {
  it("setWagonCount clamps to 1", () => {
    const b = new Builder();
    b.setWagonCount(0);
    expect(b.config.transport.wagonCount).toBe(1);
  });

  it("setSimHours clamps to 0.25 minimum", () => {
    const b = new Builder();
    b.setSimHours(0.1);
    expect(b.config.settings.simHours).toBe(0.25);
  });

  it("setBasketCount clamps to 1 minimum", () => {
    const b = new Builder();
    b.setBasketCount(0);
    expect(b.config.settings.basketCount).toBe(1);
  });

  it("setBasketCount floors to integer", () => {
    const b = new Builder();
    b.setBasketCount(2.7);
    expect(b.config.settings.basketCount).toBe(2);
  });
});
