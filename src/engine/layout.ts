import type { Layout, LayoutNode, DxfLabel, StationLabel, RecipeStep } from "../types";
import { approxTextMatch, minutesToSeconds } from "../utils";

export function buildSyntheticLayout(tankCount: number): Layout {
  const leftX = 0, baseY = 0, tankSpacing = 1400, tankStartX = leftX + 2400;
  const nodes: LayoutNode[] = [];
  nodes.push({ id: "LOAD", label: "HANGER LOADING", type: "station", x: leftX, y: baseY });
  for (let i = 0; i < tankCount; i++) nodes.push({ id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank", x: tankStartX + i * tankSpacing, y: baseY });
  nodes.push({ id: "WDO", label: "DRY-OFF OVEN", type: "oven", x: tankStartX + tankCount * tankSpacing + 2000, y: baseY - 1400 });
  nodes.push({ id: "UNLOAD", label: "HANGER UNLOADING", type: "station", x: tankStartX + tankCount * tankSpacing + 4200, y: baseY });
  nodes.push({ id: "PCO", label: "PCO", type: "marker", x: tankStartX + tankCount * tankSpacing + 6200, y: baseY - 1400 });
  return { nodes, meta: { source: "synthetic", distanceMode: "manhattan" } };
}

export function buildLayoutFromDxfLabels(
  labelsRows: DxfLabel[],
  tankCount: number,
  detectedStations: StationLabel[] | null,
): Layout {
  const anchors: Record<string, { x: number; y: number }> = {};
  for (const r of labelsRows) {
    const x = r.x;
    const y = r.y;
    if (x == null || y == null) continue;
    if (!anchors.LOAD && approxTextMatch(r.text, "HANGER LOADING")) anchors.LOAD = { x, y };
    if (!anchors.UNLOAD && approxTextMatch(r.text, "HANGER UNLOADING")) anchors.UNLOAD = { x, y };
    if (!anchors.WDO && approxTextMatch(r.text, "WDO")) anchors.WDO = { x, y };
    if (!anchors.PCO && approxTextMatch(r.text, "PCO")) anchors.PCO = { x, y };
    if (!anchors.PROCESS && approxTextMatch(r.text, "PROCESS TANK ZONE")) anchors.PROCESS = { x, y };
    if (approxTextMatch(r.text, "BUFFER")) anchors.BUFFER = { x, y };
  }
  if (!anchors.LOAD || !anchors.UNLOAD) return buildSyntheticLayout(tankCount);

  const nodes: LayoutNode[] = [];
  nodes.push({ id: "LOAD", label: "HANGER LOADING", type: "station", x: anchors.LOAD.x, y: anchors.LOAD.y });

  if (detectedStations && detectedStations.length > 0) {
    const stationsToUse = detectedStations.slice(0, tankCount);
    for (let i = 0; i < stationsToUse.length; i++) {
      const s = stationsToUse[i];
      nodes.push({ id: `T${i + 1}`, label: s.label, type: "tank", x: s.x, y: s.y });
    }
  } else if (anchors.PROCESS) {
    const dir = { x: anchors.UNLOAD.x - anchors.LOAD.x, y: anchors.UNLOAD.y - anchors.LOAD.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const unit = { x: dir.x / len, y: dir.y / len };
    const minSpacing = 1400;
    const idealSpan = 0.70 * len;
    const idealSpacing = idealSpan / Math.max(1, tankCount - 1);
    const spacing = Math.max(minSpacing, idealSpacing);
    const totalTankSpan = spacing * Math.max(1, tankCount - 1);
    const offsetX = unit.x * (totalTankSpan / 2);
    const offsetY = unit.y * (totalTankSpan / 2);
    const start = { x: anchors.PROCESS.x - offsetX, y: anchors.PROCESS.y - offsetY };
    for (let i = 0; i < tankCount; i++) {
      nodes.push({
        id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank",
        x: start.x + unit.x * spacing * i, y: start.y + unit.y * spacing * i,
      });
    }
  } else {
    const dir = { x: anchors.UNLOAD.x - anchors.LOAD.x, y: anchors.UNLOAD.y - anchors.LOAD.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const unit = { x: dir.x / len, y: dir.y / len };
    const spacing = len / (tankCount + 2);
    for (let i = 0; i < tankCount; i++) {
      const offset = spacing * (i + 1);
      nodes.push({
        id: `T${i + 1}`, label: `TANK ${i + 1}`, type: "tank",
        x: anchors.LOAD.x + unit.x * offset, y: anchors.LOAD.y + unit.y * offset,
      });
    }
  }

  if (anchors.BUFFER) nodes.push({ id: "BUFFER", label: "BUFFER", type: "marker", x: anchors.BUFFER.x, y: anchors.BUFFER.y });
  if (anchors.WDO) nodes.push({ id: "WDO", label: "DRY-OFF OVEN", type: "oven", x: anchors.WDO.x, y: anchors.WDO.y });
  nodes.push({ id: "UNLOAD", label: "HANGER UNLOADING", type: "station", x: anchors.UNLOAD.x, y: anchors.UNLOAD.y });
  if (anchors.PCO) nodes.push({ id: "PCO", label: "PCO", type: "marker", x: anchors.PCO.x, y: anchors.PCO.y });
  return { nodes, meta: { source: "dxf_labels", anchors, detectedStations: detectedStations?.length || 0, distanceMode: "manhattan" } };
}

export function defaultRecipe(tankCount: number, preset: string): RecipeStep[] {
  let dwellMin = 2;
  if (preset === "ms") dwellMin = 2.5;
  if (preset === "al") dwellMin = 1.5;
  const tolerance = 0.1;
  const steps: RecipeStep[] = [];
  steps.push({ id: "LOAD", label: "Load", dwellSec: 0, kind: "station" });
  for (let i = 0; i < tankCount; i++) {
    steps.push({ id: `T${i + 1}`, label: `Tank ${i + 1}`, dwellSec: minutesToSeconds(dwellMin), kind: "tank", tankType: "chemical", tolerancePct: tolerance });
  }
  steps.push({ id: "WDO", label: "Dry-Off Oven", dwellSec: minutesToSeconds(10), kind: "oven" });
  steps.push({ id: "UNLOAD", label: "Unload", dwellSec: 0, kind: "station" });
  return steps;
}
