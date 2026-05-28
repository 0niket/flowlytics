import { describe, it, expect } from "vitest";
import { defaultRecipe } from "./layout";

describe("defaultRecipe", () => {
  it("returns correct step count for MS preset", () => {
    const steps = defaultRecipe(6, "ms");
    expect(steps.length).toBe(9); // LOAD + 6 tanks + WDO + UNLOAD
  });

  it("sets MS dwell to 2.5 min per tank", () => {
    const steps = defaultRecipe(6, "ms");
    const tanks = steps.filter((s) => s.kind === "tank");
    expect(tanks.length).toBe(6);
    for (const t of tanks) expect(t.dwellSec).toBe(150);
  });

  it("sets AL dwell to 1.5 min per tank", () => {
    const steps = defaultRecipe(6, "al");
    const tanks = steps.filter((s) => s.kind === "tank");
    for (const t of tanks) expect(t.dwellSec).toBe(90);
  });

  it("defaults all tanks to chemical for MS preset", () => {
    const steps = defaultRecipe(4, "ms");
    const tanks = steps.filter((s) => s.kind === "tank");
    for (const t of tanks) expect(t.tankType).toBe("chemical");
  });

  it("defaults all tanks to chemical for AL preset", () => {
    const steps = defaultRecipe(4, "al");
    const tanks = steps.filter((s) => s.kind === "tank");
    for (const t of tanks) expect(t.tankType).toBe("chemical");
  });

  it("sets WDO dwell to 10 min", () => {
    const steps = defaultRecipe(6, "ms");
    const wdo = steps.find((s) => s.id === "WDO");
    expect(wdo!.dwellSec).toBe(600);
  });

  it("sets LOAD and UNLOAD dwell to 0", () => {
    const steps = defaultRecipe(6, "ms");
    expect(steps.find((s) => s.id === "LOAD")!.dwellSec).toBe(0);
    expect(steps.find((s) => s.id === "UNLOAD")!.dwellSec).toBe(0);
  });

  it("defaults all tank tolerances to 10%", () => {
    const steps = defaultRecipe(6, "ms");
    const tanks = steps.filter((s) => s.kind === "tank");
    for (const t of tanks) expect(t.tolerancePct).toBe(0.1);
  });

  it("does not set tolerancePct on non-tank steps", () => {
    const steps = defaultRecipe(6, "ms");
    for (const s of steps) {
      if (s.kind !== "tank") expect(s.tolerancePct).toBeUndefined();
    }
  });
});
