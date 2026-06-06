import { minutesToSeconds } from "../utils";
import type { SimParams, Layout, LayoutNode, RecipeStep } from "../types";

// ─── Types ───────────────────────────────────────────────────

export type ArticleMaterialType =
  | "mild_steel" | "aluminium" | "stainless_steel" | "galvanised_steel"
  | "cast_iron" | "brass" | "copper" | "zinc_die_cast" | "hss" | "other";

export type TankType = "chemical" | "rinse" | "extra";

export type StationKind = "loading" | "unloading" | "tank" | "wdo";

export interface StationConfig {
  id: string;
  label: string;
  kind: StationKind;
  tankType?: TankType;
  dwellSec: number;
  dryTimeSec?: number;
  tolerancePct?: number;
  maxDwellSec?: number;
  chemicalDescription?: string;
  loadingDescription?: string;
  unloadingDescription?: string;
  // Tank chemical cost (tank kind only):
  tankCapacityLitres?: number;
  chemicalCostPerLitre?: number;
  bathLifeHours?: number;
  // Labour (loading/unloading kind only):
  labourCount?: number;
  labourCostPerHr?: number;
}

export interface WagonConfig {
  id: string;
  fromStationId: string;
  toStationId: string;
  speedMPerMin: number;
  liftSec: number;
  dripSec: number;
  lowerSec: number;
  pickSec: number;
  dropSec: number;
  costRs?: number;                    // One-time purchase cost
}

export interface TransportConfig {
  wagonCount: number;
  wagonSpeedMPerMin: number;
  liftSec: number;
  dripSec: number;
  lowerSec: number;
  pickSec: number;
  dropSec: number;
  distanceMode: "manhattan" | "euclidean";
  maxWeightKg?: number;
  articleWeightKg?: number;
  maxArticlesPerBasket?: number;
  rawMaterialCostPerArticle?: number;
  wagons?: WagonConfig[];
}

export interface RunSettings {
  articleMaterialType: ArticleMaterialType;
  targetBph: number;
  simHours: number;
  basketCount: number;
}

export interface EconomicsConfig {
  revenuePerArticle: number;
  energyCostPerHr: number;
  maintenanceCostPerHr: number;
}

export interface LineConfig {
  stations: StationConfig[];
  transport: TransportConfig;
  settings: RunSettings;
  economics: EconomicsConfig;
}

// ─── Defaults ─────────────────────────────────────────────────

export function createDefaultEconomicsConfig(): EconomicsConfig {
  return {
    revenuePerArticle: 0,
    energyCostPerHr: 0,
    maintenanceCostPerHr: 0,
  };
}

export function createDefaultLineConfig(): LineConfig {
  return {
    stations: [
      { id: "LOAD", label: "Loading", kind: "loading", dwellSec: 0 },
      { id: "T1", label: "Tank 1", kind: "tank", tankType: "chemical", dwellSec: minutesToSeconds(2.5), tolerancePct: 0.1 },
      { id: "UNLOAD", label: "Unloading", kind: "unloading", dwellSec: 0 },
    ],
    transport: {
      wagonCount: 1,
      wagonSpeedMPerMin: 18,
      liftSec: 10,
      dripSec: 4,
      lowerSec: 6,
      pickSec: 6,
      dropSec: 4,
      distanceMode: "manhattan",
    },
    settings: {
      articleMaterialType: "mild_steel",
      targetBph: 2.0,
      simHours: 2,
      basketCount: 2,
    },
    economics: createDefaultEconomicsConfig(),
  };
}

// ─── Mapping Helpers ─────────────────────────────────────────

function toRecipeStep(st: StationConfig): RecipeStep {
  const base = { id: st.id, label: st.label, dwellSec: st.kind === "wdo" ? 0 : st.dwellSec };
  if (st.kind === "tank") {
    // "extra" tankType doesn't exist on the legacy RecipeStep type yet,
    // so it maps to undefined — treated as a no-parameter placeholder.
    const tankType = st.tankType === "extra" ? undefined : st.tankType;
    return { ...base, kind: "tank" as const, tankType, tolerancePct: st.tolerancePct };
  }
  if (st.kind === "wdo") {
    return { ...base, kind: "oven" as const, dryTimeSec: st.dryTimeSec, tolerancePct: st.tolerancePct };
  }
  return { ...base, kind: "station" as const };
}

function stationKindFromRecipeStep(step: RecipeStep): StationConfig["kind"] {
  if (step.kind === "tank") return "tank";
  if (step.kind === "oven") return "wdo";
  return step.id === "UNLOAD" ? "unloading" : "loading";
}

// ─── Basket Count Heuristic ──────────────────────────────────

export function computeOptimalBasketCount(config: LineConfig): number {
  const tanks = config.stations.filter((s) => s.kind === "tank" && s.tankType !== "extra");
  const activeTankCount = tanks.length;
  if (activeTankCount === 0) return 1;

  const totalDwellSec = tanks.reduce((sum, t) => sum + t.dwellSec, 0);
  const handlingPerTank = config.transport.liftSec + config.transport.dripSec +
    config.transport.lowerSec + config.transport.pickSec + config.transport.dropSec;
  const totalCycleSec = totalDwellSec + activeTankCount * handlingPerTank;
  const loadStation = config.stations.find((s) => s.kind === "loading");
  const unloadStation = config.stations.find((s) => s.kind === "unloading");
  const serviceSec = (loadStation?.dwellSec ?? 0) + (unloadStation?.dwellSec ?? 0);

  // Little's Law approximation: baskets = throughput * cycle_time
  // throughput ≈ 1 / max(service_time, cycle_time / wagon_count)
  const effectiveCycle = Math.max(serviceSec, totalCycleSec / Math.max(1, config.transport.wagonCount));
  const throughput = effectiveCycle > 0 ? 1 / effectiveCycle : 0;
  const optimalWip = throughput * totalCycleSec;

  // Add buffer of 1, clamp between 1 and tank count + 2
  return Math.max(1, Math.min(activeTankCount + 2, Math.ceil(optimalWip) + 1));
}

// ─── Converters ───────────────────────────────────────────────

export function lineConfigToSimParams(config: LineConfig): SimParams {
  const recipeSteps: RecipeStep[] = [];
  const tankIds: string[] = [];

  for (const st of config.stations) {
    recipeSteps.push(toRecipeStep(st));
    if (st.kind === "tank") tankIds.push(st.id);
  }

  const wdoStation = config.stations.find((s) => s.kind === "wdo");
  const loadStation = config.stations.find((s) => s.kind === "loading");
  const unloadStation = config.stations.find((s) => s.kind === "unloading");

  // Build custom wagon zones and per-wagon handling from config
  let customZones: { fromStationId: string; toStationId: string }[] | undefined;
  let perWagonHandling: SimParams["perWagonHandling"];
  if (config.transport.wagons && config.transport.wagons.length > 0) {
    customZones = config.transport.wagons.map((w) => ({
      fromStationId: w.fromStationId,
      toStationId: w.toStationId,
    }));
    perWagonHandling = config.transport.wagons.map((w) => ({
      wagonId: w.id,
      speedMPerMin: w.speedMPerMin,
      liftSec: w.liftSec,
      dripSec: w.dripSec,
      lowerSec: w.lowerSec,
      pickSec: w.pickSec,
      dropSec: w.dropSec,
    }));
  }

  return {
    preset: "custom",
    tankCount: tankIds.length,
    basketCount: computeOptimalBasketCount(config),
    recipeSteps,
    wdoTimeMin: wdoStation ? (wdoStation.dryTimeSec ?? wdoStation.dwellSec) / 60 : 10,
    loadTimeMin: loadStation ? loadStation.dwellSec / 60 : 20,
    unloadTimeMin: unloadStation ? unloadStation.dwellSec / 60 : 10,
    dripTimeSec: config.transport.dripSec,
    targetBph: config.settings.targetBph,
    simHours: config.settings.simHours,
    wagonSpeedMPerMin: config.transport.wagonSpeedMPerMin,
    liftLowerSec: config.transport.liftSec + config.transport.lowerSec,
    pickDropSec: config.transport.pickSec + config.transport.dropSec,
    wagonCount: config.transport.wagonCount,
    distanceMode: config.transport.distanceMode,
    dwellClockOffsetSec: null,
    customZones,
    perWagonHandling,
  };
}

export function lineConfigToLayout(config: LineConfig): Layout {
  const leftX = 0;
  const baseY = 0;
  const tankSpacing = 1400;
  const tankStartX = leftX + 2400;
  const tanks = config.stations.filter((s) => s.kind === "tank");
  const wdos = config.stations.filter((s) => s.kind === "wdo");

  const nodes: LayoutNode[] = [];

  nodes.push({ id: "LOAD", label: "HANGER LOADING", type: "station", x: leftX, y: baseY });

  for (let i = 0; i < tanks.length; i++) {
    nodes.push({
      id: tanks[i].id,
      label: `TANK ${i + 1}`,
      type: "tank",
      x: tankStartX + i * tankSpacing,
      y: baseY,
    });
  }

  for (let i = 0; i < wdos.length; i++) {
    nodes.push({
      id: wdos[i].id,
      label: wdos.length === 1 ? "DRY-OFF OVEN" : `DRY-OFF OVEN ${i + 1}`,
      type: "oven",
      x: tankStartX + tanks.length * tankSpacing + 2000 + i * tankSpacing,
      y: baseY - 1400,
    });
  }

  const afterProcessX = tankStartX + tanks.length * tankSpacing + (wdos.length > 0 ? 2000 + wdos.length * tankSpacing : 0);

  nodes.push({
    id: "UNLOAD",
    label: "HANGER UNLOADING",
    type: "station",
    x: afterProcessX + 2200,
    y: baseY,
  });

  nodes.push({
    id: "PCO",
    label: "PCO",
    type: "marker",
    x: afterProcessX + 4200,
    y: baseY - 1400,
  });

  return { nodes, meta: { source: "synthetic", distanceMode: config.transport.distanceMode } };
}

export function lineConfigFromSimParams(params: SimParams): LineConfig {
  const stations: StationConfig[] = [];

  for (const step of params.recipeSteps) {
    const kind = stationKindFromRecipeStep(step);
    const station: StationConfig = {
      id: step.id,
      label: step.label,
      kind,
      dwellSec: step.dwellSec,
    };
    if (kind === "tank") {
      station.tankType = step.tankType || "chemical";
      station.tolerancePct = step.tolerancePct;
    }
    if (kind === "wdo") {
      station.dryTimeSec = step.dryTimeSec ?? step.dwellSec;
      station.tolerancePct = step.tolerancePct;
    }
    stations.push(station);
  }

  // Round-trip note: liftSec/lowerSec and pickSec/dropSec are split 50/50
  // because the legacy SimParams stores them as combined totals. Asymmetric
  // splits are preserved through toSimParams (where they sum back to the
  // combined value) but are lost when round-tripping through fromSimParams.
  // articleMaterialType is hardcoded to "mild_steel" because SimParams has no
  // equivalent field — this is resolved when SimParams is updated downstream.
  return {
    stations,
    transport: {
      wagonCount: params.wagonCount,
      wagonSpeedMPerMin: params.wagonSpeedMPerMin,
      liftSec: Math.round(params.liftLowerSec / 2),
      dripSec: params.dripTimeSec,
      lowerSec: Math.round(params.liftLowerSec / 2),
      pickSec: Math.round(params.pickDropSec / 2),
      dropSec: Math.round(params.pickDropSec / 2),
      distanceMode: params.distanceMode,
    },
    settings: {
      articleMaterialType: "mild_steel",
      targetBph: params.targetBph,
      simHours: params.simHours,
      basketCount: params.basketCount,
    },
    economics: createDefaultEconomicsConfig(),
  };
}
