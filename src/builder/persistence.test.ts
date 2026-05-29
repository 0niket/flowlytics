import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft } from "./persistence";
import { createDefaultLineConfig } from "./LineConfig";

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

  it("saveDraft writes version 3", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    const raw = globalThis.localStorage.getItem("flowlytics_builder_draft")!;
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(3);
  });

  it("migrates v1 draft (drops currentStep)", () => {
    const v1Draft = {
      config: createDefaultLineConfig(),
      currentStep: 2,
    };
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify(v1Draft));
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(3);
    expect(draft!.config).toBeDefined();
    // v3 drafts have no currentStep
    expect((draft as unknown as Record<string, unknown>).currentStep).toBeUndefined();
  });

  it("migrates v2 draft (drops currentStep)", () => {
    const v2Draft = {
      config: createDefaultLineConfig(),
      currentStep: 3,
      version: 2,
    };
    globalThis.localStorage.setItem("flowlytics_builder_draft", JSON.stringify(v2Draft));
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(3);
    expect(draft!.config).toBeDefined();
  });

  it("does not migrate v3 drafts", () => {
    const config = createDefaultLineConfig();
    saveDraft(config);
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.version).toBe(3);
  });
});
