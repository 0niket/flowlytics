import type { SimParams, RecipeStep } from "../types";

export function parseParamsJson(json: string): Partial<SimParams> {
  const raw = JSON.parse(json);
  const params: Partial<SimParams> = {};
  if (typeof raw.tankCount === "number") params.tankCount = raw.tankCount;
  if (typeof raw.basketCount === "number") params.basketCount = raw.basketCount;
  if (typeof raw.wagonCount === "number") params.wagonCount = raw.wagonCount;
  if (typeof raw.simHours === "number") params.simHours = raw.simHours;
  if (typeof raw.wagonSpeedMPerMin === "number") params.wagonSpeedMPerMin = raw.wagonSpeedMPerMin;
  if (typeof raw.loadTimeMin === "number") params.loadTimeMin = raw.loadTimeMin;
  if (typeof raw.unloadTimeMin === "number") params.unloadTimeMin = raw.unloadTimeMin;
  if (typeof raw.wdoTimeMin === "number") params.wdoTimeMin = raw.wdoTimeMin;
  if (typeof raw.liftLowerSec === "number") params.liftLowerSec = raw.liftLowerSec;
  if (typeof raw.pickDropSec === "number") params.pickDropSec = raw.pickDropSec;
  if (typeof raw.targetBph === "number") params.targetBph = raw.targetBph;
  if (typeof raw.distanceMode === "string") params.distanceMode = raw.distanceMode as "manhattan" | "euclidean";
  if (typeof raw.preset === "string") params.preset = raw.preset;
  if (raw.recipeSteps && Array.isArray(raw.recipeSteps)) {
    params.recipeSteps = raw.recipeSteps.map((rs: Record<string, unknown>) => {
      const k = String(rs.kind ?? "tank");
      const id = String(rs.id);
      return {
        id,
        label: String(rs.label ?? id),
        kind: k === "tank" || k === "station" || k === "oven" ? (k as "tank" | "station" | "oven") : "tank",
        dwellSec: Number(rs.dwellSec) || 0,
        tolerancePct: rs.tolerancePct != null ? Number(rs.tolerancePct) : 0.1,
        tankType: rs.tankType as RecipeStep["tankType"] | undefined,
        dripSec: rs.dripSec != null ? Number(rs.dripSec) : undefined,
      };
    });
  }
  return params;
}

export function parseRecipeCsv(csv: string): RecipeStep[] {
  const lines = csv.trim().split("\n");
  const steps: RecipeStep[] = [];
  for (const line of lines) {
    const cols = line.split(",").map((c) => c.trim());
    const [id, kind, dwellStr, tolStr, tankType] = cols;
    if (!id || id.startsWith("#")) continue;
    steps.push({
      id,
      label: id,
      kind: kind === "tank" || kind === "station" || kind === "oven" ? kind : "tank",
      dwellSec: dwellStr ? Number(dwellStr) || 0 : 0,
      tolerancePct: tolStr != null && tolStr !== "" ? clamp(+tolStr, 0, 0.5) : 0.1,
      tankType: tankType as RecipeStep["tankType"] | undefined,
    });
  }
  return steps;
}

export function validateSimulation(
  simResult: { throughputBph: number; avgLeadTimeSec: number; violations: unknown[]; completedCount: number },
  expected: { minThroughput?: number; maxLeadTime?: number; maxViolations?: number },
): { passed: boolean; messages: string[] } {
  const messages: string[] = [];
  if (expected.minThroughput != null && simResult.throughputBph < expected.minThroughput) {
    messages.push(`Throughput ${simResult.throughputBph.toFixed(2)} bph < min ${expected.minThroughput} bph`);
  }
  if (expected.maxLeadTime != null && simResult.avgLeadTimeSec > expected.maxLeadTime) {
    messages.push(`Lead time ${simResult.avgLeadTimeSec.toFixed(0)}s > max ${expected.maxLeadTime}s`);
  }
  if (expected.maxViolations != null && simResult.violations.length > expected.maxViolations) {
    messages.push(`Violations ${simResult.violations.length} > max ${expected.maxViolations}`);
  }
  return { passed: messages.length === 0, messages };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
