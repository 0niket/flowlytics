import { describe, it, expect } from "vitest";
import { MATERIALS } from "./data";

describe("MATERIALS", () => {
  it("has 10 entries", () => {
    expect(MATERIALS.length).toBe(10);
  });

  it("includes mild_steel as first/default", () => {
    expect(MATERIALS[0].type).toBe("mild_steel");
    expect(MATERIALS[0].label).toBe("Mild Steel");
  });

  it("all entries have type and label", () => {
    for (const m of MATERIALS) {
      expect(m.type).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });

  it("types are unique", () => {
    const types = MATERIALS.map((m) => m.type);
    expect(new Set(types).size).toBe(types.length);
  });
});
