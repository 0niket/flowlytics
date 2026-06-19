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

  it("formula explanation is collapsed by default", () => {
    const root = document.getElementById("configViewRoot")!;
    const details = root.querySelector("details.formula-box") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    // Summary is visible with compact label
    const summary = details.querySelector("summary");
    expect(summary!.textContent).toContain("Why");
  });

  it("renders formula box with L = λ × W and variable definitions", () => {
    const root = document.getElementById("configViewRoot")!;
    const formulaBox = root.querySelector(".formula-box");
    expect(formulaBox).not.toBeNull();
    const text = formulaBox!.textContent!;
    // Formal formula
    expect(text).toContain("L = \u03bb \u00d7 W");
    // Variable mapping table
    expect(text).toContain("WIP");
    expect(text).toContain("throughput");
    expect(text).toContain("cycle time");
    // Result
    expect(text).toContain("baskets");
  });

  it("formula shows derivation with dwell, handling, and bottleneck", () => {
    const root = document.getElementById("configViewRoot")!;
    const formulaBox = root.querySelector(".formula-box");
    const text = formulaBox!.textContent!;
    expect(text).toContain("dwell");
    expect(text).toContain("handling");
    expect(text).toContain("bottleneck");
    expect(text).toContain("buffer");
  });
});

describe("renderer — extra tank fields", () => {
  beforeEach(() => {
    setupDOM();
    initConfigView();
  });

  function firstTankCard(): HTMLElement {
    const lane = document.getElementById("cvStationLane")!;
    const card = lane.querySelector(".station-card--chemical, .station-card--rinse, .station-card--extra");
    return card as HTMLElement;
  }

  function setFirstTankType(type: string): void {
    const card = firstTankCard();
    const select = card.querySelector(".bldr-type") as HTMLSelectElement;
    select.value = type;
    select.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("non-extra tank shows dwell time and tolerance inputs", () => {
    // Default first tank is chemical
    const card = firstTankCard();
    expect(card.querySelector(".bldr-dwell")).not.toBeNull();
    expect(card.querySelector(".bldr-tol")).not.toBeNull();
  });

  it("extra tank hides dwell time and tolerance inputs", () => {
    setFirstTankType("extra");
    const card = firstTankCard();
    expect(card.classList.contains("station-card--extra")).toBe(true);
    expect(card.querySelector(".bldr-dwell")).toBeNull();
    expect(card.querySelector(".bldr-tol")).toBeNull();
  });

  it("extra tank hides chemical bath (running cost) inputs", () => {
    setFirstTankType("extra");
    const card = firstTankCard();
    expect(card.querySelector(".bldr-tank-capacity")).toBeNull();
    expect(card.querySelector(".bldr-chem-cost")).toBeNull();
    expect(card.querySelector(".bldr-bath-life")).toBeNull();
  });

  it("extra tank shows equipment setup cost but not life/operating-hours", () => {
    setFirstTankType("extra");
    const card = firstTankCard();
    // Setup (capital) cost is still entered for a reserved tank.
    expect(card.querySelector(".bldr-equip-cost")).not.toBeNull();
    // Life/operating-hours are operating-time concepts — not shown for an
    // idle reserved tank (capex-only, no per-hour depreciation).
    expect(card.querySelector(".bldr-equip-life")).toBeNull();
    expect(card.querySelector(".bldr-equip-ophrs")).toBeNull();
  });

  it("non-extra tank shows equipment life and operating-hours", () => {
    const card = firstTankCard();
    expect(card.querySelector(".bldr-equip-cost")).not.toBeNull();
    expect(card.querySelector(".bldr-equip-life")).not.toBeNull();
    expect(card.querySelector(".bldr-equip-ophrs")).not.toBeNull();
  });

  it("non-extra tank shows the per-tank Drip (s) input", () => {
    const card = firstTankCard();
    expect(card.querySelector(".bldr-drip")).not.toBeNull();
  });

  it("extra tank hides the per-tank Drip (s) input", () => {
    setFirstTankType("extra");
    const card = firstTankCard();
    expect(card.querySelector(".bldr-drip")).toBeNull();
  });

  it("setting drip input updates the tank's dripSec in raw seconds", () => {
    const card = firstTankCard();
    const drip = card.querySelector(".bldr-drip") as HTMLInputElement;
    drip.value = "8";
    drip.dispatchEvent(new Event("input", { bubbles: true }));
    const lane = document.getElementById("cvStationLane")!;
    const updated = lane.querySelector(".bldr-drip") as HTMLInputElement;
    expect(updated.value).toBe("8");
  });
});

describe("renderer — wagon handling has no drip", () => {
  beforeEach(() => {
    setupDOM();
    initConfigView();
  });

  it("wagon card no longer has a drip handling input", () => {
    const root = document.getElementById("configViewRoot")!;
    const dripInput = root.querySelector('[data-handling-field="dripSec"]');
    expect(dripInput).toBeNull();
  });

  it("wagon handling inputs are ordered Pick, Lift, Lower, Drop", () => {
    const root = document.getElementById("configViewRoot")!;
    const fields = Array.from(root.querySelectorAll(".bldr-wagon-handling"))
      .map((el) => el.getAttribute("data-handling-field"));
    expect(fields).toEqual(["pickSec", "liftSec", "lowerSec", "dropSec"]);
  });
});
