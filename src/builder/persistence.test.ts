import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft } from "./persistence";
import { createDefaultLineConfig, createDefaultEconomicsConfig } from "./LineConfig";

function createMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => store.clear()),
    get length() { return store.size; },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
  };
}

beforeEach(() => {
  const storage = createMockStorage();
  vi.stubGlobal("localStorage", storage);
});

describe("persistence", () => {
  it("saveDraft stores config as JSON", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      "flowlytics_builder_draft",
      expect.any(String),
    );
  });

  it("loadDraft returns the saved config", () => {
    const config = createDefaultLineConfig();
    config.settings.targetBph = 5;
    saveDraft(config);
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.config.settings.targetBph).toBe(5);
  });

  it("loadDraft returns null when no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft removes the stored draft", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    expect(loadDraft()).not.toBeNull();
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("loadDraft returns null for corrupted JSON", () => {
    globalThis.localStorage.setItem("flowlytics_builder_draft", "not-valid-json");
    expect(loadDraft()).toBeNull();
  });

  it("loadDraft returns null for missing fields", () => {
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify({ foo: "bar" }));
    expect(loadDraft()).toBeNull();
  });

  it("round-trips all station config fields", () => {
    const config = createDefaultLineConfig();
    config.stations.push({
      id: "WDO", label: "WDO", kind: "wdo", dwellSec: 600, maxDwellSec: 900,
    });
    saveDraft(config);
    const draft = loadDraft()!;
    expect(draft.config.stations).toEqual(config.stations);
  });

  it("round-trips transport settings", () => {
    const config = createDefaultLineConfig();
    config.transport.wagonCount = 3;
    config.transport.liftSec = 15;
    saveDraft(config);
    const draft = loadDraft()!;
    expect(draft.config.transport.wagonCount).toBe(3);
    expect(draft.config.transport.liftSec).toBe(15);
  });

  it("round-trips description fields", () => {
    const config = createDefaultLineConfig();
    config.stations[0].loadingDescription = "Manual loading process";
    config.stations[1].chemicalDescription = "Alkaline cleaner 50g/L";
    config.stations[2].unloadingDescription = "Automated unloading";
    saveDraft(config);
    const draft = loadDraft()!;
    expect(draft.config.stations[0].loadingDescription).toBe("Manual loading process");
    expect(draft.config.stations[1].chemicalDescription).toBe("Alkaline cleaner 50g/L");
    expect(draft.config.stations[2].unloadingDescription).toBe("Automated unloading");
  });

  it("round-trips per-wagon handling times", () => {
    const config = createDefaultLineConfig();
    config.transport.wagons = [
      { id: "W1", fromStationId: "T1", toStationId: "T1", speedMPerMin: 18, liftSec: 12, dripSec: 5, lowerSec: 8, pickSec: 7, dropSec: 3 },
    ];
    saveDraft(config);
    const draft = loadDraft()!;
    expect(draft.config.transport.wagons).toBeDefined();
    expect(draft.config.transport.wagons![0].liftSec).toBe(12);
    expect(draft.config.transport.wagons![0].dripSec).toBe(5);
    expect(draft.config.transport.wagons![0].pickSec).toBe(7);
  });

  it("saveDraft writes version 5", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    const raw = globalThis.localStorage.getItem("flowlytics_builder_draft")!;
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(5);
  });

  it("migrates v4 draft — removes centralized cost fields", () => {
    const v4Config = {
      ...createDefaultLineConfig(),
      economics: {
        revenuePerArticle: 50,
        operatorCostPerHr: 450,
        energyCostPerHr: 280,
        maintenanceCostPerHr: 120,
        waterAndEffluentCostPerHr: 150,
        basketCostRs: 50000,
        basketLifeYears: 5,
        operatingHoursPerYear: 4000,
      },
    };
    v4Config.stations[1] = {
      ...v4Config.stations[1],
      tankFixedCostPerHr: 180,
    } as never;
    if (v4Config.transport.wagons) {
      v4Config.transport.wagons[0] = {
        ...v4Config.transport.wagons[0],
        lifeYears: 10,
      } as never;
    }
    const v4Draft = { config: v4Config, version: 4 };
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify(v4Draft));

    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(5);

    // Removed fields should be gone
    const econ = draft!.config.economics as unknown as Record<string, unknown>;
    expect(econ.operatorCostPerHr).toBeUndefined();
    expect(econ.waterAndEffluentCostPerHr).toBeUndefined();
    expect(econ.basketCostRs).toBeUndefined();
    expect(econ.basketLifeYears).toBeUndefined();
    expect(econ.operatingHoursPerYear).toBeUndefined();

    // Kept fields should be preserved
    expect(draft!.config.economics.revenuePerArticle).toBe(50);
    expect(draft!.config.economics.energyCostPerHr).toBe(280);
    expect(draft!.config.economics.maintenanceCostPerHr).toBe(120);

    // tankFixedCostPerHr removed from stations
    expect((draft!.config.stations[1] as unknown as Record<string, unknown>).tankFixedCostPerHr).toBeUndefined();

    // lifeYears removed from wagons
    if (draft!.config.transport.wagons) {
      expect((draft!.config.transport.wagons[0] as unknown as Record<string, unknown>).lifeYears).toBeUndefined();
    }
  });

  it("migrates v1 draft (drops currentStep, adds economics, cleans v4 fields)", () => {
    const v1Draft = {
      config: createDefaultLineConfig(),
      currentStep: 2,
    };
    // Remove economics to simulate v1
    delete (v1Draft.config as unknown as Record<string, unknown>).economics;
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify(v1Draft));
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(5);
    expect(draft!.config).toBeDefined();
    expect(draft!.config.economics).toEqual(createDefaultEconomicsConfig());
  });

  it("migrates v3 draft (adds economics, cleans v4 fields)", () => {
    const v3Config = createDefaultLineConfig();
    delete (v3Config as unknown as Record<string, unknown>).economics;
    const v3Draft = { config: v3Config, version: 3 };
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify(v3Draft));
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(5);
    expect(draft!.config.economics).toEqual(createDefaultEconomicsConfig());
  });

  it("does not migrate v5 drafts", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(5);
  });

  it("v5 draft preserves existing economics values", () => {
    const config = createDefaultLineConfig();
    config.economics.revenuePerArticle = 75;
    config.economics.energyCostPerHr = 280;
    saveDraft(config);
    const draft = loadDraft();
    expect(draft!.config.economics.revenuePerArticle).toBe(75);
    expect(draft!.config.economics.energyCostPerHr).toBe(280);
  });

  it("v5 draft preserves distributed cost fields", () => {
    const config = createDefaultLineConfig();
    config.stations[1].tankCapacityLitres = 500;
    config.stations[1].chemicalCostPerLitre = 25;
    config.stations[1].bathLifeHours = 200;
    config.stations[0].labourCount = 2;
    config.stations[0].labourCostPerHr = 200;
    config.transport.rawMaterialCostPerArticle = 15;
    saveDraft(config);
    const draft = loadDraft();
    expect(draft!.config.stations[1].tankCapacityLitres).toBe(500);
    expect(draft!.config.stations[1].chemicalCostPerLitre).toBe(25);
    expect(draft!.config.stations[1].bathLifeHours).toBe(200);
    expect(draft!.config.stations[0].labourCount).toBe(2);
    expect(draft!.config.stations[0].labourCostPerHr).toBe(200);
    expect(draft!.config.transport.rawMaterialCostPerArticle).toBe(15);
  });
});
