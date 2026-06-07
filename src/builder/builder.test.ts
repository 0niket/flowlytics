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
    expect(wdo!.dryTimeSec).toBe(600);
    expect(wdo!.dwellSec).toBe(0);
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

  it("setWagonHandlingTime works for single wagon", () => {
    const b = new Builder();
    b.setWagonHandlingTime(0, "liftSec", 15);
    expect(b.config.transport.wagons![0].liftSec).toBe(15);
  });

  it("setWagonHandlingTime is safe for out-of-range index", () => {
    const b = new Builder();
    b.setWagonCount(2);
    b.setWagonHandlingTime(5, "liftSec", 10);
    // should not throw
    expect(b.config.transport.wagons!.length).toBe(2);
  });

  it("wagon configs are initialized with sensible defaults", () => {
    const b = new Builder();
    const w = b.config.transport.wagons![0];
    expect(w.speedMPerMin).toBe(18);
    expect(w.liftSec).toBe(10);
    expect(w.dripSec).toBe(4);
    expect(w.lowerSec).toBe(6);
    expect(w.pickSec).toBe(6);
    expect(w.dropSec).toBe(4);
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

  it("setWagonCount = 1 creates a single wagon config", () => {
    const b = new Builder();
    b.setWagonCount(2);
    expect(b.config.transport.wagons!.length).toBe(2);
    b.setWagonCount(1);
    expect(b.config.transport.wagons).toBeDefined();
    expect(b.config.transport.wagons!.length).toBe(1);
    expect(b.config.transport.wagons![0].id).toBe("W1");
  });

  it("_syncWagonConfigs divides stations with overlap", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.setWagonCount(2);
    const wagons = b.config.transport.wagons!;
    expect(wagons.length).toBe(2);
    // Consecutive wagons must overlap: W1.to === W2.from
    expect(wagons[0].toStationId).toBe(wagons[1].fromStationId);
  });

  it("setWagonRange updates a specific wagon's range", () => {
    const b = new Builder();
    b.addTank(1);
    b.setWagonCount(2);
    b.setWagonRange(0, "T1", "T2");
    expect(b.config.transport.wagons![0].fromStationId).toBe("T1");
    expect(b.config.transport.wagons![0].toStationId).toBe("T2");
  });

  it("setWagonRange updates the default single wagon", () => {
    const b = new Builder();
    b.setWagonRange(0, "T1", "T1");
    expect(b.config.transport.wagons).toBeDefined();
    expect(b.config.transport.wagons![0].fromStationId).toBe("T1");
    expect(b.config.transport.wagons![0].toStationId).toBe("T1");
  });
});

describe("Builder — station equipment capex", () => {
  it("setStationEquipmentCost sets value on station", () => {
    const b = new Builder();
    b.setStationEquipmentCost(1, 500_000);
    expect(b.config.stations[1].equipmentCostRs).toBe(500_000);
  });

  it("setStationEquipmentLifeYears sets value on station", () => {
    const b = new Builder();
    b.setStationEquipmentLifeYears(1, 10);
    expect(b.config.stations[1].equipmentLifeYears).toBe(10);
  });

  it("setStationEquipmentOperatingHoursPerYear sets value on station", () => {
    const b = new Builder();
    b.setStationEquipmentOperatingHoursPerYear(1, 4000);
    expect(b.config.stations[1].equipmentOperatingHoursPerYear).toBe(4000);
  });

  it("setStationEquipmentCost throws for invalid index", () => {
    const b = new Builder();
    expect(() => b.setStationEquipmentCost(99, 100)).toThrow("No station at index 99");
  });

  it("setStationEquipmentCost clamps negative to 0", () => {
    const b = new Builder();
    b.setStationEquipmentCost(1, -500);
    expect(b.config.stations[1].equipmentCostRs).toBe(0);
  });

  it("works on WDO stations too", () => {
    const b = new Builder();
    b.enableWdo();
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    b.setStationEquipmentCost(wdoIdx, 300_000);
    expect(b.config.stations[wdoIdx].equipmentCostRs).toBe(300_000);
  });
});

describe("Builder — WDO operating cost", () => {
  it("setWdoOperatingCostPerHr sets value on WDO station", () => {
    const b = new Builder();
    b.enableWdo();
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    b.setWdoOperatingCostPerHr(wdoIdx, 500);
    expect(b.config.stations[wdoIdx].operatingCostPerHr).toBe(500);
  });

  it("setWdoOperatingCostPerHr throws for non-WDO station", () => {
    const b = new Builder();
    expect(() => b.setWdoOperatingCostPerHr(0, 500)).toThrow("No WDO station at index 0");
  });

  it("setWdoOperatingCostPerHr clamps negative to 0", () => {
    const b = new Builder();
    b.enableWdo();
    const wdoIdx = b.config.stations.findIndex((s) => s.kind === "wdo");
    b.setWdoOperatingCostPerHr(wdoIdx, -100);
    expect(b.config.stations[wdoIdx].operatingCostPerHr).toBe(0);
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

  it("setBasketCount sets basketCountOverride", () => {
    const b = new Builder();
    b.setBasketCount(5);
    expect(b.config.settings.basketCountOverride).toBe(5);
  });

  it("setBasketCount(null) clears override", () => {
    const b = new Builder();
    b.setBasketCount(5);
    b.setBasketCount(null);
    expect(b.config.settings.basketCountOverride).toBeNull();
  });

  it("setBasketCount(0) clamps to 1", () => {
    const b = new Builder();
    b.setBasketCount(0);
    expect(b.config.settings.basketCountOverride).toBe(1);
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

  it("returns empty for default single wagon", () => {
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
    b.addTank(3);
    b.setWagonCount(2);
    // W1 covers T1-T2, W2 starts at T2 but only covers T2 — T3 and T4 uncovered
    b.setWagonRange(0, "T1", "T2");
    b.setWagonRange(1, "T2", "T2");
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("not covered by any wagon"))).toBe(true);
  });

  it("detects non-overlapping consecutive wagons", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.addTank(3);
    b.setWagonCount(2);
    // W1 covers T1-T2, W2 covers T4 — no overlap (gap at T3)
    b.setWagonRange(0, "T1", "T2");
    b.setWagonRange(1, "T4", "T4");
    const errors = b.validateWagons();
    expect(errors.some((e) => e.includes("must overlap"))).toBe(true);
  });

  it("accepts overlapping consecutive wagons", () => {
    const b = new Builder();
    b.addTank(1);
    b.addTank(2);
    b.addTank(3);
    b.setWagonCount(2);
    // W1 covers T1-T3, W2 covers T3-T4 — overlap at T3
    b.setWagonRange(0, "T1", "T3");
    b.setWagonRange(1, "T3", "T4");
    const errors = b.validateWagons();
    expect(errors).toEqual([]);
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
      id: "WDO", label: "WDO", kind: "wdo", dwellSec: 0, dryTimeSec: 600, maxDwellSec: 900,
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

describe("Builder — economics operations", () => {
  it("setRevenuePerArticle updates config", () => {
    const b = new Builder();
    b.setRevenuePerArticle(50);
    expect(b.config.economics.revenuePerArticle).toBe(50);
  });

  it("setRevenuePerArticle clamps negative to 0", () => {
    const b = new Builder();
    b.setRevenuePerArticle(-10);
    expect(b.config.economics.revenuePerArticle).toBe(0);
  });

  it("setEnergyCostPerHr updates config", () => {
    const b = new Builder();
    b.setEnergyCostPerHr(280);
    expect(b.config.economics.energyCostPerHr).toBe(280);
  });

  it("setMaintenanceCostPerHr updates config", () => {
    const b = new Builder();
    b.setMaintenanceCostPerHr(120);
    expect(b.config.economics.maintenanceCostPerHr).toBe(120);
  });

  it("setWagonCostRs sets cost on wagon", () => {
    const b = new Builder();
    b.setWagonCostRs(0, 1200000);
    expect(b.config.transport.wagons![0].costRs).toBe(1200000);
  });

  it("setWagonCostRs is safe for out-of-range index", () => {
    const b = new Builder();
    b.setWagonCostRs(5, 1000);
    // should not throw
    expect(b.config.transport.wagons!.length).toBe(1);
  });

  it("setWagonUsefulLifeYears sets value on wagon", () => {
    const b = new Builder();
    b.setWagonUsefulLifeYears(0, 5);
    expect(b.config.transport.wagons![0].usefulLifeYears).toBe(5);
  });

  it("setWagonOperatingHoursPerYear sets value on wagon", () => {
    const b = new Builder();
    b.setWagonOperatingHoursPerYear(0, 2000);
    expect(b.config.transport.wagons![0].operatingHoursPerYear).toBe(2000);
  });
});

describe("Builder — distributed cost operations", () => {
  it("setRawMaterialCostPerArticle sets value on transport", () => {
    const b = new Builder();
    b.setRawMaterialCostPerArticle(15);
    expect(b.config.transport.rawMaterialCostPerArticle).toBe(15);
  });

  it("setRawMaterialCostPerArticle clamps negative to 0", () => {
    const b = new Builder();
    b.setRawMaterialCostPerArticle(-5);
    expect(b.config.transport.rawMaterialCostPerArticle).toBe(0);
  });

  it("setTankCapacityLitres sets on tank", () => {
    const b = new Builder();
    b.setTankCapacityLitres(1, 500);
    expect(b.config.stations[1].tankCapacityLitres).toBe(500);
  });

  it("setTankCapacityLitres throws for non-tank index", () => {
    const b = new Builder();
    expect(() => b.setTankCapacityLitres(0, 500)).toThrow("No tank at index 0");
  });

  it("setChemicalCostPerLitre sets on tank", () => {
    const b = new Builder();
    b.setChemicalCostPerLitre(1, 25);
    expect(b.config.stations[1].chemicalCostPerLitre).toBe(25);
  });

  it("setChemicalCostPerLitre throws for non-tank index", () => {
    const b = new Builder();
    expect(() => b.setChemicalCostPerLitre(0, 25)).toThrow("No tank at index 0");
  });

  it("setBathLifeHours sets on tank", () => {
    const b = new Builder();
    b.setBathLifeHours(1, 200);
    expect(b.config.stations[1].bathLifeHours).toBe(200);
  });

  it("setBathLifeHours throws for non-tank index", () => {
    const b = new Builder();
    expect(() => b.setBathLifeHours(0, 200)).toThrow("No tank at index 0");
  });

  it("setLabourCount sets on loading station", () => {
    const b = new Builder();
    b.setLabourCount(0, 3);
    expect(b.config.stations[0].labourCount).toBe(3);
  });

  it("setLabourCount rounds to integer", () => {
    const b = new Builder();
    b.setLabourCount(0, 2.7);
    expect(b.config.stations[0].labourCount).toBe(3);
  });

  it("setLabourCount throws for tank station", () => {
    const b = new Builder();
    expect(() => b.setLabourCount(1, 2)).toThrow("No loading/unloading station at index 1");
  });

  it("setLabourCostPerHr sets on unloading station", () => {
    const b = new Builder();
    const unloadIdx = b.config.stations.findIndex((s) => s.kind === "unloading");
    b.setLabourCostPerHr(unloadIdx, 200);
    expect(b.config.stations[unloadIdx].labourCostPerHr).toBe(200);
  });

  it("setLabourCostPerHr throws for tank station", () => {
    const b = new Builder();
    expect(() => b.setLabourCostPerHr(1, 200)).toThrow("No loading/unloading station at index 1");
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


  it("setMaxWeightKg stores value and clamps min 0", () => {
    const b = new Builder();
    b.setMaxWeightKg(50);
    expect(b.config.transport.maxWeightKg).toBe(50);
    b.setMaxWeightKg(-5);
    expect(b.config.transport.maxWeightKg).toBe(0);
  });

  it("setArticleWeightKg stores value and clamps min 0", () => {
    const b = new Builder();
    b.setArticleWeightKg(2.5);
    expect(b.config.transport.articleWeightKg).toBe(2.5);
    b.setArticleWeightKg(-1);
    expect(b.config.transport.articleWeightKg).toBe(0);
  });

  it("maxArticlesPerBasket is derived from maxWeightKg / articleWeightKg", () => {
    const b = new Builder();
    b.setMaxWeightKg(50);
    b.setArticleWeightKg(2);
    expect(b.config.transport.maxArticlesPerBasket).toBe(25); // floor(50/2)
  });

  it("maxArticlesPerBasket floors to integer", () => {
    const b = new Builder();
    b.setMaxWeightKg(50);
    b.setArticleWeightKg(3);
    expect(b.config.transport.maxArticlesPerBasket).toBe(16); // floor(50/3) = 16
  });

  it("maxArticlesPerBasket is undefined when articleWeightKg is 0", () => {
    const b = new Builder();
    b.setMaxWeightKg(50);
    b.setArticleWeightKg(0);
    expect(b.config.transport.maxArticlesPerBasket).toBeUndefined();
  });

  it("maxArticlesPerBasket is undefined when only one weight field is set", () => {
    const b = new Builder();
    b.setMaxWeightKg(50);
    expect(b.config.transport.maxArticlesPerBasket).toBeUndefined();
  });

  it("maxArticlesPerBasket updates when maxWeightKg changes", () => {
    const b = new Builder();
    b.setArticleWeightKg(2);
    b.setMaxWeightKg(50);
    expect(b.config.transport.maxArticlesPerBasket).toBe(25);
    b.setMaxWeightKg(30);
    expect(b.config.transport.maxArticlesPerBasket).toBe(15);
  });
});
