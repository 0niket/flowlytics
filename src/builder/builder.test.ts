import { describe, it, expect } from "vitest";
import { Builder } from "./builder";
import { createDefaultLineConfig } from "./LineConfig";

describe("Builder", () => {
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

  it("enableWdo allows adding multiple WDOs", () => {
    const b = new Builder();
    b.enableWdo();
    b.enableWdo();
    const wdos = b.config.stations.filter((s) => s.kind === "wdo");
    expect(wdos.length).toBe(2);
    expect(wdos[0].id).toBe("WDO1");
    expect(wdos[1].id).toBe("WDO2");
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

describe("Builder — addStation", () => {
  it("addStation with kind=tank adds a chemical tank", () => {
    const b = new Builder();
    b.addStation(1, "tank");
    expect(b.config.stations.length).toBe(4);
    const tanks = b.config.stations.filter((s) => s.kind === "tank");
    expect(tanks.length).toBe(2);
  });

  it("addStation with kind=tank and tankType option", () => {
    const b = new Builder();
    b.addStation(1, "tank", { tankType: "rinse" });
    const newTank = b.config.stations[1];
    expect(newTank.tankType).toBe("rinse");
    expect(newTank.tolerancePct).toBe(0.5);
  });

  it("addStation with kind=wdo adds WDO at given position", () => {
    const b = new Builder();
    b.addStation(2, "wdo");
    expect(b.config.stations.some((s) => s.kind === "wdo")).toBe(true);
  });

  it("addWdo inserts WDO at specified index", () => {
    const b = new Builder();
    b.addTank(1); // now: LOAD T1 T2 UNLOAD
    b.addWdo(2); // now: LOAD T1 WDO T2 UNLOAD
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    expect(wdoIdx).toBe(2);
    expect(b.config.stations[3].kind).toBe("tank");
  });

  it("addWdo allows multiple WDOs", () => {
    const b = new Builder();
    b.addWdo(2);
    b.addWdo(2);
    const wdos = b.config.stations.filter((s) => s.kind === "wdo");
    expect(wdos.length).toBe(2);
    expect(wdos[0].id).toBe("WDO1");
    expect(wdos[1].id).toBe("WDO2");
  });

  it("removeWdo removes WDO at given index", () => {
    const b = new Builder();
    b.enableWdo();
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    b.removeWdo(wdoIdx);
    expect(b.config.stations.some((s) => s.kind === "wdo")).toBe(false);
  });

  it("removeWdo throws when index is not a WDO", () => {
    const b = new Builder();
    expect(() => b.removeWdo(0)).toThrow("No WDO at index 0");
  });
});

describe("Builder — description operations", () => {
  it("setChemicalDescription sets description on a tank", () => {
    const b = new Builder();
    b.setChemicalDescription(1, "Alkaline cleaner 50g/L");
    expect(b.config.stations[1].chemicalDescription).toBe("Alkaline cleaner 50g/L");
  });

  it("setChemicalDescription throws when index is not a tank", () => {
    const b = new Builder();
    expect(() => b.setChemicalDescription(0, "test")).toThrow("No tank at index 0");
  });

  it("setLoadingDescription sets description on loading station", () => {
    const b = new Builder();
    b.setLoadingDescription("Manual hanger loading, 2 operators");
    const load = b.config.stations.find((s) => s.kind === "loading")!;
    expect(load.loadingDescription).toBe("Manual hanger loading, 2 operators");
  });

  it("setUnloadingDescription sets description on unloading station", () => {
    const b = new Builder();
    b.setUnloadingDescription("Automated unloading with conveyor");
    const unload = b.config.stations.find((s) => s.kind === "unloading")!;
    expect(unload.unloadingDescription).toBe("Automated unloading with conveyor");
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

describe("Builder — per-wagon handling times", () => {
  it("setWagonHandlingTime updates a specific wagon field", () => {
    const b = new Builder();
    b.setWagonCount(2);
    b.setWagonHandlingTime(0, "liftSec", 15);
    expect(b.config.transport.wagons![0].liftSec).toBe(15);
  });

  it("setWagonHandlingTime clamps negative values to 0", () => {
    const b = new Builder();
    b.setWagonCount(2);
    b.setWagonHandlingTime(0, "dripSec", -5);
    expect(b.config.transport.wagons![0].dripSec).toBe(0);
  });

  it("setWagonHandlingTime is safe when wagons is undefined", () => {
    const b = new Builder();
    // wagons is undefined for 1 wagon
    b.setWagonHandlingTime(0, "liftSec", 10);
    expect(b.config.transport.wagons).toBeUndefined();
  });

  it("setWagonHandlingTime is safe for out-of-range index", () => {
    const b = new Builder();
    b.setWagonCount(2);
    b.setWagonHandlingTime(5, "liftSec", 10);
    // should not throw
    expect(b.config.transport.wagons!.length).toBe(2);
  });

  it("wagon configs are initialized from global transport defaults", () => {
    const b = new Builder();
    b.setLiftTime(12);
    b.setDripTime(5);
    b.setLowerTime(8);
    b.setPickTime(7);
    b.setDropTime(3);
    b.setWagonCount(2);
    const w = b.config.transport.wagons![0];
    expect(w.liftSec).toBe(12);
    expect(w.dripSec).toBe(5);
    expect(w.lowerSec).toBe(8);
    expect(w.pickSec).toBe(7);
    expect(w.dropSec).toBe(3);
  });
});

describe("Builder — wagon config sync", () => {
  it("setWagonCount > 1 creates wagon configs", () => {
    const b = new Builder();
    b.setWagonCount(2);
    expect(b.config.transport.wagons).toBeDefined();
    expect(b.config.transport.wagons!.length).toBe(2);
    expect(b.config.transport.wagons![0].id).toBe("W1");
    expect(b.config.transport.wagons![1].id).toBe("W2");
  });

  it("setWagonCount = 1 clears wagon configs", () => {
    const b = new Builder();
    b.setWagonCount(2);
    expect(b.config.transport.wagons).toBeDefined();
    b.setWagonCount(1);
    expect(b.config.transport.wagons).toBeUndefined();
  });

  it("_syncWagonConfigs divides stations across wagons", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.setWagonCount(2);
    const wagons = b.config.transport.wagons!;
    expect(wagons.length).toBe(2);
    expect(wagons[0].fromStationId).toBe("T1");
    expect(wagons[1].fromStationId).toBeDefined();
  });

  it("setWagonRange updates a specific wagon's range", () => {
    const b = new Builder();
    b.addTank(1);
    b.setWagonCount(2);
    b.setWagonRange(0, "T1", "T2");
    expect(b.config.transport.wagons![0].fromStationId).toBe("T1");
    expect(b.config.transport.wagons![0].toStationId).toBe("T2");
  });

  it("setWagonRange is safe when wagons is undefined", () => {
    const b = new Builder();
    b.setWagonRange(0, "T1", "T1");
    expect(b.config.transport.wagons).toBeUndefined();
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

  it("validate returns error when material is missing", () => {
    const config = createDefaultLineConfig();
    config.settings.articleMaterialType = "" as never;
    const b = new Builder(config);
    expect(b.validate()).toContain("Article material is required");
  });

  it("validate includes wagon validation errors", () => {
    const b = new Builder();
    b.addTank(1);
    b.setWagonCount(2);
    // Set reversed range on wagon 0
    b.setWagonRange(0, "T2", "T1");
    const errors = b.validate();
    expect(errors.some((e) => e.includes("From station must come before To station"))).toBe(true);
  });
});

describe("Builder — validateWagons", () => {
  it("returns empty for valid wagon zones", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.setWagonCount(2);
    // Default sync should produce valid zones
    expect(b.validateWagons()).toEqual([]);
  });

  it("returns empty when no wagons defined", () => {
    const b = new Builder();
    expect(b.validateWagons()).toEqual([]);
  });

  it("detects reversed from/to", () => {
    const b = new Builder();
    b.addTank(1);
    b.setWagonCount(2);
    b.setWagonRange(0, "T2", "T1");
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("From station must come before To station"))).toBe(true);
  });

  it("detects uncovered process stations", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.setWagonCount(2);
    // Set both wagons to only cover T1, leaving T2 and T3 uncovered
    b.setWagonRange(0, "T1", "T1");
    b.setWagonRange(1, "T1", "T1");
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("not covered by any wagon"))).toBe(true);
  });

  it("detects negative handling times", () => {
    const b = new Builder();
    b.setWagonCount(2);
    // Force a negative value directly
    b.config.transport.wagons![0].liftSec = -1;
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("handling times must be >= 0"))).toBe(true);
  });

  it("detects invalid station references", () => {
    const b = new Builder();
    b.setWagonCount(2);
    b.config.transport.wagons![0].fromStationId = "NONEXISTENT";
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("invalid station reference"))).toBe(true);
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
