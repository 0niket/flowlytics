import type { LineConfig } from "../builder/LineConfig";
import type { SimulationResult, Violation, ViolationCause } from "../types";

// ─── Types ───────────────────────────────────────────────────

export interface ComponentConstraint {
  componentId: string;
  componentType: "tank" | "wdo" | "loading" | "unloading" | "wagon" | "basket";
  label: string;
  rule: string;
  status: "ok" | "warning" | "violated";
  violations: ConstraintViolationDetail[];
  totalViolationCount: number;
  queueAnalysis?: QueueDepthAnalysis;
}

export interface QueueDepthAnalysis {
  serviceRateBph: number;
  arrivalRateBph: number;
  isBottleneck: boolean;
  formula: string;
  explanation: string;
  timeline: { timeMin: number; depth: number }[];
}

export interface ConstraintViolationDetail {
  description: string;
  cause: string;
  basketId: string;
  timestamp: number;
  elapsed: number;
  limit: number;
}

// ─── Helpers ─────────────────────────────────────────────────

const MAX_VIOLATIONS_PER_COMPONENT = 5;

function formatTimeShort(seconds: number): string {
  if (!Number.isFinite(seconds)) return "-";
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(0)}s`;
  const mm = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${mm}m${String(ss).padStart(2, "0")}s`;
}

function causeToHumanString(cause: ViolationCause): string {
  switch (cause) {
    case "wagon_unavailable": return "Wagon was unavailable for pickup";
    case "destination_blocked": return "Next station was occupied by another basket";
    case "line_design": return "Line configuration limitation";
  }
}

function formatDwellRule(dwellSec: number, tolerancePct: number): string {
  const min = Math.round(dwellSec * (1 - tolerancePct));
  const max = Math.round(dwellSec * (1 + tolerancePct));
  const pct = Math.round(tolerancePct * 100);
  return `Dwell: ${formatTimeShort(dwellSec)} \u00b1 ${pct}% (${formatTimeShort(min)} \u2013 ${formatTimeShort(max)})`;
}

function buildViolationDetail(v: Violation): ConstraintViolationDetail {
  const limit = v.type === "under_dwell" ? v.earliestExit : v.latestExit;
  const overshoot = Math.abs(v.elapsed - limit);
  const direction = v.type === "under_dwell" ? "under" : "over";
  const description = `Basket ${v.basketId} stayed ${v.elapsed}s (${v.type === "under_dwell" ? "min" : "max"} ${limit}s) \u2014 ${overshoot}s ${direction} limit`;
  return {
    description,
    cause: causeToHumanString(v.cause),
    basketId: v.basketId,
    timestamp: v.timestamp,
    elapsed: v.elapsed,
    limit,
  };
}

// ─── Main Function ───────────────────────────────────────────

export function analyzeConstraints(
  config: LineConfig,
  result: SimulationResult,
): ComponentConstraint[] {
  const entries: ComponentConstraint[] = [];

  // Group violations by component (tank/WDO id)
  const violationsByComponent = new Map<string, Violation[]>();
  for (const v of result.violations) {
    const list = violationsByComponent.get(v.tankId) ?? [];
    list.push(v);
    violationsByComponent.set(v.tankId, list);
  }

  // Process each station
  for (const station of config.stations) {
    if (station.kind === "tank") {
      entries.push(analyzeTank(station, violationsByComponent.get(station.id) ?? []));
    } else if (station.kind === "wdo") {
      entries.push(analyzeWdo(station, violationsByComponent.get(station.id) ?? []));
    } else if (station.kind === "loading") {
      entries.push(analyzeLoading(station, result));
    } else if (station.kind === "unloading") {
      entries.push(analyzeUnloading(station, result));
    }
  }

  // Process wagons
  const wagonConfigs = config.transport.wagons ?? [];
  for (const wc of wagonConfigs) {
    const wUtil = result.util.wagons.find((w) => w.id === wc.id);
    entries.push(analyzeWagon(wc.id, wUtil, result));
  }

  // Process basket capacity
  entries.push(analyzeBasket(config));

  return entries;
}

// ─── Component Analyzers ─────────────────────────────────────

function analyzeTank(
  station: LineConfig["stations"][number],
  violations: Violation[],
): ComponentConstraint {
  const isExtra = station.tankType === "extra";

  if (isExtra) {
    return {
      componentId: station.id,
      componentType: "tank",
      label: station.label,
      rule: "Passthrough (no dwell constraint)",
      status: "ok",
      violations: [],
      totalViolationCount: 0,
    };
  }

  const tolerancePct = station.tolerancePct ?? 0.1;
  const rule = formatDwellRule(station.dwellSec, tolerancePct);
  const details = violations.map(buildViolationDetail);
  const capped = details.slice(0, MAX_VIOLATIONS_PER_COMPONENT);

  return {
    componentId: station.id,
    componentType: "tank",
    label: station.label,
    rule,
    status: violations.length > 0 ? "violated" : "ok",
    violations: capped,
    totalViolationCount: violations.length,
  };
}

function analyzeWdo(
  station: LineConfig["stations"][number],
  violations: Violation[],
): ComponentConstraint {
  const maxDwell = station.maxDwellSec ?? 0;
  const rule = maxDwell > 0
    ? `Dry: min ${formatTimeShort(station.dwellSec)}, max ${formatTimeShort(maxDwell)}`
    : `Dry: min ${formatTimeShort(station.dwellSec)}`;

  const details = violations.map(buildViolationDetail);
  const capped = details.slice(0, MAX_VIOLATIONS_PER_COMPONENT);

  return {
    componentId: station.id,
    componentType: "wdo",
    label: station.label,
    rule,
    status: violations.length > 0 ? "violated" : "ok",
    violations: capped,
    totalViolationCount: violations.length,
  };
}

function sampleQueueTimeline(
  snapshots: SimulationResult["snapshots"],
  locKey: string,
  intervalSec: number,
  simEndSec: number,
): { timeMin: number; depth: number }[] {
  const timeline: { timeMin: number; depth: number }[] = [];
  for (let t = 0; t <= simEndSec; t += intervalSec) {
    // Find the closest snapshot at or before time t
    let best = snapshots[0];
    for (const snap of snapshots) {
      if (snap.t <= t) best = snap;
      else break;
    }
    const depth = best?.locCounts?.[locKey] ?? 0;
    timeline.push({ timeMin: Math.round(t / 60), depth });
  }
  return timeline;
}

function analyzeLoading(
  station: LineConfig["stations"][number],
  result: SimulationResult,
): ComponentConstraint {
  const loadTimeSec = station.dwellSec;
  const loadTimeMin = loadTimeSec / 60;
  const serviceRateBph = loadTimeMin > 0 ? 60 / loadTimeMin : Infinity;

  // Arrival rate at loading = achieved throughput (how fast baskets cycle through the system and return)
  // If system is slow (long dwell, slow wagon), fewer baskets return, so arrival rate is low.
  // If system is fast, baskets return quickly and may overwhelm loading.
  const achieved = Number.isFinite(result.throughputTrimmedBph) ? result.throughputTrimmedBph
    : Number.isFinite(result.throughputSteadyBph) ? result.throughputSteadyBph
    : result.throughputBph;
  const arrivalRateBph = achieved;

  const isBottleneck = Number.isFinite(serviceRateBph) && arrivalRateBph > serviceRateBph;

  const timeline = sampleQueueTimeline(result.snapshots, "LOADQ", 300, result.simEnd);

  let formula: string;
  let explanation: string;
  if (!Number.isFinite(serviceRateBph) || loadTimeMin <= 0) {
    formula = "Service rate: instant (0 min load time)";
    explanation = "No loading time configured — baskets pass through immediately.";
  } else {
    formula = `Service rate = 60 / ${loadTimeMin.toFixed(1)} min = ${serviceRateBph.toFixed(1)} bph | Arrival rate = ${arrivalRateBph.toFixed(1)} bph`;
    if (isBottleneck) {
      const buildupRate = arrivalRateBph - serviceRateBph;
      explanation = `Baskets arrive at ${arrivalRateBph.toFixed(1)} bph but loading can only process ${serviceRateBph.toFixed(1)} bph. Queue grows by ~${buildupRate.toFixed(1)} baskets/hr. Loading is the bottleneck — reduce load time or add a parallel loading station.`;
    } else {
      explanation = `Loading can handle ${serviceRateBph.toFixed(1)} bph, arrival rate is ${arrivalRateBph.toFixed(1)} bph. Loading station is keeping up.`;
    }
  }

  const status: "ok" | "warning" | "violated" = isBottleneck ? "violated" : "ok";

  return {
    componentId: station.id,
    componentType: "loading",
    label: station.label,
    rule: isBottleneck ? "Loading is the bottleneck" : "Loading station is keeping up",
    status,
    violations: [],
    totalViolationCount: 0,
    queueAnalysis: {
      serviceRateBph,
      arrivalRateBph,
      isBottleneck,
      formula,
      explanation,
      timeline,
    },
  };
}

function analyzeUnloading(
  station: LineConfig["stations"][number],
  result: SimulationResult,
): ComponentConstraint {
  const unloadTimeSec = station.dwellSec;
  const unloadTimeMin = unloadTimeSec / 60;
  const serviceRateBph = unloadTimeMin > 0 ? 60 / unloadTimeMin : Infinity;

  // Arrival rate at unloading = achieved throughput (how fast baskets actually complete the line)
  const achieved = Number.isFinite(result.throughputTrimmedBph) ? result.throughputTrimmedBph
    : Number.isFinite(result.throughputSteadyBph) ? result.throughputSteadyBph
    : result.throughputBph;
  const arrivalRateBph = achieved;

  const isBottleneck = Number.isFinite(serviceRateBph) && arrivalRateBph > serviceRateBph;

  const timeline = sampleQueueTimeline(result.snapshots, "UNLOADQ", 300, result.simEnd);

  let formula: string;
  let explanation: string;
  if (!Number.isFinite(serviceRateBph) || unloadTimeMin <= 0) {
    formula = "Service rate: instant (0 min unload time)";
    explanation = "No unloading time configured — baskets pass through immediately.";
  } else {
    formula = `Service rate = 60 / ${unloadTimeMin.toFixed(1)} min = ${serviceRateBph.toFixed(1)} bph | Arrival rate = ${arrivalRateBph.toFixed(1)} bph`;
    if (isBottleneck) {
      const buildupRate = arrivalRateBph - serviceRateBph;
      explanation = `Baskets arrive at ${arrivalRateBph.toFixed(1)} bph but unloading can only process ${serviceRateBph.toFixed(1)} bph. Queue grows by ~${buildupRate.toFixed(1)} baskets/hr. Unloading is the bottleneck — reduce unload time or add a parallel unloading station.`;
    } else {
      explanation = `Unloading can handle ${serviceRateBph.toFixed(1)} bph, baskets arrive at ${arrivalRateBph.toFixed(1)} bph. Unloading station is keeping up.`;
    }
  }

  const status: "ok" | "warning" | "violated" = isBottleneck ? "violated" : "ok";

  return {
    componentId: station.id,
    componentType: "unloading",
    label: station.label,
    rule: isBottleneck ? "Unloading is the bottleneck" : "Unloading station is keeping up",
    status,
    violations: [],
    totalViolationCount: 0,
    queueAnalysis: {
      serviceRateBph,
      arrivalRateBph,
      isBottleneck,
      formula,
      explanation,
      timeline,
    },
  };
}

function analyzeWagon(
  wagonId: string,
  wUtil: SimulationResult["util"]["wagons"][number] | undefined,
  result: SimulationResult,
): ComponentConstraint {
  const util01 = wUtil?.util01 ?? 0;
  const totalSec = result.simEnd;
  const idleSec = wUtil?.idleSec ?? totalSec;
  const idlePct = totalSec > 0 ? idleSec / totalSec : 0;
  const isOverloaded = util01 > 0.9;
  const isUnderutilized = idlePct > 0.5;

  const violations: ConstraintViolationDetail[] = [];
  let status: "ok" | "warning" = "ok";

  if (isOverloaded) {
    status = "warning";
    violations.push({
      description: `Utilization at ${Math.round(util01 * 100)}% — wagon is a bottleneck`,
      cause: "Wagon is overloaded with transport tasks",
      basketId: "-",
      timestamp: 0,
      elapsed: util01,
      limit: 0.9,
    });
  } else if (isUnderutilized) {
    status = "warning";
    violations.push({
      description: `Idle ${Math.round(idlePct * 100)}% of simulation time — wagon may be unnecessary`,
      cause: "Wagon has insufficient work assigned",
      basketId: "-",
      timestamp: 0,
      elapsed: idlePct,
      limit: 0.5,
    });
  }

  return {
    componentId: wagonId,
    componentType: "wagon",
    label: `Wagon ${wagonId}`,
    rule: `Utilization: >90% overloaded, idle >50% underutilized`,
    status,
    violations,
    totalViolationCount: violations.length,
  };
}

function analyzeBasket(config: LineConfig): ComponentConstraint {
  const { maxWeightKg, articleWeightKg, maxArticlesPerBasket } = config.transport;

  if (maxWeightKg == null || articleWeightKg == null || maxArticlesPerBasket == null) {
    return {
      componentId: "BASKET",
      componentType: "basket",
      label: "Basket Capacity",
      rule: "No capacity constraints configured",
      status: "ok",
      violations: [],
      totalViolationCount: 0,
    };
  }

  const payload = articleWeightKg * maxArticlesPerBasket;
  const rule = `Max ${maxArticlesPerBasket} articles × ${articleWeightKg} kg = ${payload.toFixed(1)} kg (limit ${maxWeightKg} kg)`;
  const violations: ConstraintViolationDetail[] = [];
  let status: "ok" | "warning" | "violated" = "ok";

  if (payload > maxWeightKg) {
    status = "violated";
    const overshoot = payload - maxWeightKg;
    violations.push({
      description: `Payload ${payload.toFixed(1)} kg exceeds basket limit of ${maxWeightKg} kg by ${overshoot.toFixed(1)} kg`,
      cause: "Reduce articles per basket or article weight",
      basketId: "-",
      timestamp: 0,
      elapsed: payload,
      limit: maxWeightKg,
    });
  } else if (payload > maxWeightKg * 0.8) {
    status = "warning";
    const pct = Math.round((payload / maxWeightKg) * 100);
    violations.push({
      description: `Payload ${payload.toFixed(1)} kg is at ${pct}% of basket limit (${maxWeightKg} kg)`,
      cause: "Close to weight limit — consider reducing load",
      basketId: "-",
      timestamp: 0,
      elapsed: payload,
      limit: maxWeightKg,
    });
  }

  return {
    componentId: "BASKET",
    componentType: "basket",
    label: "Basket Capacity",
    rule,
    status,
    violations,
    totalViolationCount: violations.length,
  };
}
