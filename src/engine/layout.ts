import type { Layout, LayoutNode, RecipeStep } from "../types";
import type { ArticleMaterialType } from "../builder/LineConfig";
import { minutesToSeconds } from "../utils";

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

const MATERIAL_DWELL: Record<string, number> = {
  mild_steel: 2.5,
  stainless_steel: 2.5,
  galvanised_steel: 2.5,
  cast_iron: 2.5,
  brass: 2.5,
  copper: 2.5,
  zinc_die_cast: 2.5,
  hss: 2.5,
  other: 2.5,
  aluminium: 1.5,
};

export function defaultRecipe(tankCount: number, material: string | ArticleMaterialType = "ms"): RecipeStep[] {
  let dwellMin = 2;
  if (material === "ms" || material === "mild_steel") dwellMin = 2.5;
  if (material === "al" || material === "aluminium") dwellMin = 1.5;
  if (material in MATERIAL_DWELL) dwellMin = MATERIAL_DWELL[material] ?? dwellMin;
  const steps: RecipeStep[] = [];
  steps.push({ id: "LOAD", label: "Load", dwellSec: 0, kind: "station" });
  for (let i = 0; i < tankCount; i++) {
    steps.push({ id: `T${i + 1}`, label: `Tank ${i + 1}`, dwellSec: minutesToSeconds(dwellMin), kind: "tank", tankType: "chemical", tolerancePct: 0.1 });
  }
  steps.push({ id: "WDO", label: "Dry-Off Oven", dwellSec: minutesToSeconds(10), kind: "oven" });
  steps.push({ id: "UNLOAD", label: "Unload", dwellSec: 0, kind: "station" });
  return steps;
}
