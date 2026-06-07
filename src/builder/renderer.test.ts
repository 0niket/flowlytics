// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy dependencies before importing renderer
vi.mock("../ui/config", () => ({ recomputeAndRender: vi.fn() }));
vi.mock("../ui/state", () => ({ state: { lineConfig: null, layout: null, params: null } }));
vi.mock("./persistence", () => ({ clearDraft: vi.fn() }));
vi.mock("../ui/toast", () => ({ showToast: vi.fn() }));

import { initConfigView } from "./renderer";
import { computeOptimalBasketCount, createDefaultLineConfig } from "./LineConfig";

function setupDOM(): void {
  document.body.innerHTML = '<div class="config-view" id="configViewRoot"></div>';
}

describe("renderer — basket count input", () => {
  beforeEach(() => {
    setupDOM();
    initConfigView();
  });

  it("renders basket count input in sim settings section", () => {
    const input = document.getElementById("bldrBasketCount") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.type).toBe("number");
  });

  it("defaults basket count to auto-computed optimal", () => {
    const input = document.getElementById("bldrBasketCount") as HTMLInputElement;
    const config = createDefaultLineConfig();
    const optimal = computeOptimalBasketCount(config);
    expect(Number(input.value)).toBe(optimal);
  });

  it("shows recommendation hint with computed value", () => {
    const hint = document.getElementById("bldrBasketCountHint");
    expect(hint).not.toBeNull();
    const config = createDefaultLineConfig();
    const optimal = computeOptimalBasketCount(config);
    expect(hint!.textContent).toContain(String(optimal));
    expect(hint!.textContent).toContain("Little");
  });

  it("does not show reset link when using auto value", () => {
    const resetLink = document.getElementById("bldrBasketCountReset");
    expect(resetLink).toBeNull();
  });

  it("shows reset link after changing basket count", () => {
    const input = document.getElementById("bldrBasketCount") as HTMLInputElement;
    input.value = "5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const resetLink = document.getElementById("bldrBasketCountReset");
    expect(resetLink).not.toBeNull();
    expect(resetLink!.textContent).toBe("Reset");
  });

  it("clicking reset restores auto-computed value and removes reset link", () => {
    const input = document.getElementById("bldrBasketCount") as HTMLInputElement;
    input.value = "5";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const resetLink = document.getElementById("bldrBasketCountReset")!;
    resetLink.click();

    const config = createDefaultLineConfig();
    const optimal = computeOptimalBasketCount(config);
    expect(Number(input.value)).toBe(optimal);
    expect(document.getElementById("bldrBasketCountReset")).toBeNull();
  });
});
