import { describe, it, expect } from "vitest";
import { detectStationsFromLabels } from "./detector";
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
