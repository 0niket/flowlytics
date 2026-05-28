import { describe, it, expect } from "vitest";
import { detectStationsFromLabels, validateStationClarity } from "./detector";
import type { DxfLabel } from "../types";

function label(text: string, x = 0, y = 0): DxfLabel {
  return { type: "TEXT", layer: "0", text, x, y, rotation: null, height: null };
}

describe("detectStationsFromLabels", () => {
  it("detects AS-tag stations", () => {
    const labels = [label("AS01", 100, 200), label("AS02", 300, 400), label("AS03", 500, 600)];
    const stations = detectStationsFromLabels(labels);
    expect(stations.length).toBe(3);
    expect(stations[0].id).toBe("AS01");
    expect(stations[0].num).toBe(1);
    expect(stations[1].id).toBe("AS02");
    expect(stations[2].id).toBe("AS03");
  });

  it("detects TANK-tag stations", () => {
    const labels = [label("TANK 1", 100, 200), label("TANK 2", 300, 400)];
    const stations = detectStationsFromLabels(labels);
    expect(stations.length).toBe(2);
    expect(stations[0].id).toBe("T1");
    expect(stations[0].num).toBe(1);
    expect(stations[1].id).toBe("T2");
  });

  it("sorts stations by number", () => {
    const labels = [label("AS03", 500, 600), label("AS01", 100, 200), label("AS02", 300, 400)];
    const stations = detectStationsFromLabels(labels);
    expect(stations[0].num).toBe(1);
    expect(stations[1].num).toBe(2);
    expect(stations[2].num).toBe(3);
  });

  it("handles non-station labels gracefully", () => {
    const labels = [label("HANGER LOADING"), label("SOME_OTHER_TEXT")];
    const stations = detectStationsFromLabels(labels);
    expect(stations.length).toBe(0);
  });

  it("handles empty input", () => {
    const stations = detectStationsFromLabels([]);
    expect(stations.length).toBe(0);
  });

  it("preserves coordinates from labels", () => {
    const labels = [label("AS01", 150, 250)];
    const stations = detectStationsFromLabels(labels);
    expect(stations[0].x).toBe(150);
    expect(stations[0].y).toBe(250);
  });
});

describe("validateStationClarity", () => {
  it("returns high confidence when all stations detected", () => {
    const stations = [
      { id: "T1", num: 1, x: 0, y: 0, label: "TANK 1" },
      { id: "T2", num: 2, x: 100, y: 0, label: "TANK 2" },
      { id: "T3", num: 3, x: 200, y: 0, label: "TANK 3" },
    ];
    const result = validateStationClarity(stations, 3);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.missingStations.length).toBe(0);
    expect(result.ambiguousStations.length).toBe(0);
  });

  it("reports missing stations", () => {
    const stations = [
      { id: "T1", num: 1, x: 0, y: 0, label: "TANK 1" },
      { id: "T3", num: 3, x: 200, y: 0, label: "TANK 3" },
    ];
    const result = validateStationClarity(stations, 4);
    expect(result.missingStations).toContain("T2");
    expect(result.missingStations).toContain("T4");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("reports ambiguous stations (duplicate numbers)", () => {
    const stations = [
      { id: "T1", num: 1, x: 0, y: 0, label: "TANK 1" },
      { id: "T1-dup", num: 1, x: 50, y: 0, label: "TANK 1" },
      { id: "T2", num: 2, x: 100, y: 0, label: "TANK 2" },
    ];
    const result = validateStationClarity(stations, 2);
    expect(result.ambiguousStations).toContain("T1");
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("returns low confidence when detected far exceeds expected", () => {
    const stations = [
      { id: "T1", num: 1, x: 0, y: 0, label: "TANK 1" },
      { id: "T2", num: 2, x: 100, y: 0, label: "TANK 2" },
      { id: "T3", num: 3, x: 200, y: 0, label: "TANK 3" },
      { id: "T4", num: 4, x: 300, y: 0, label: "TANK 4" },
    ];
    const result = validateStationClarity(stations, 2);
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });
});
