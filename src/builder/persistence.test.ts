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
  it("saveDraft stores config and step as JSON", () => {
    const config = createDefaultLineConfig();
    saveDraft(config, 2);
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      "flowlytics_builder_draft",
      expect.any(String),
    );
  });

  it("loadDraft returns the saved config and step", () => {
    const config = createDefaultLineConfig();
    config.settings.targetBph = 5;
    saveDraft(config, 1);
    const draft = loadDraft();
    expect(draft).not.toBeNull();
    expect(draft!.config.settings.targetBph).toBe(5);
    expect(draft!.currentStep).toBe(1);
  });

  it("loadDraft returns null when no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft removes the stored draft", () => {
    const config = createDefaultLineConfig();
    saveDraft(config, 0);
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
    saveDraft(config, 3);
    const draft = loadDraft()!;
    expect(draft.config.stations).toEqual(config.stations);
    expect(draft.currentStep).toBe(3);
  });

  it("round-trips transport settings", () => {
    const config = createDefaultLineConfig();
    config.transport.wagonCount = 3;
    config.transport.liftSec = 15;
    saveDraft(config, 2);
    const draft = loadDraft()!;
    expect(draft.config.transport.wagonCount).toBe(3);
    expect(draft.config.transport.liftSec).toBe(15);
  });
});
