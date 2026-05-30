import type { LineConfig } from "../builder/LineConfig";
import type { SimulationResult } from "../types";

// ─── Types ───────────────────────────────────────────────────

export interface ComponentConstraint {
  componentId: string;
  componentType: "loading" | "unloading";
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

// ─── Main Function ───────────────────────────────────────────

export function analyzeConstraints(
  config: LineConfig,
  result: SimulationResult,
): ComponentConstraint[] {
  const entries: ComponentConstraint[] = [];

  // Compute service rates for loading/unloading to cross-reference
  const loadStation = config.stations.find((s) => s.kind === "loading");
  const unloadStation = config.stations.find((s) => s.kind === "unloading");
  const loadServiceRate = loadStation && loadStation.dwellSec > 0 ? 3600 / loadStation.dwellSec : Infinity;
  const unloadServiceRate = unloadStation && unloadStation.dwellSec > 0 ? 3600 / unloadStation.dwellSec : Infinity;

  // Process only loading and unloading stations
  for (const station of config.stations) {
    if (station.kind === "loading") {
      entries.push(analyzeLoading(station, result, unloadServiceRate));
    } else if (station.kind === "unloading") {
      entries.push(analyzeUnloading(station, result, loadServiceRate));
    }
  }

  return entries;
}

// ─── Component Analyzers ─────────────────────────────────────

export function sampleQueueTimeline(
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
  upstreamCapacityBph: number,
): ComponentConstraint {
  const loadTimeSec = station.dwellSec;
  const loadTimeMin = loadTimeSec / 60;
  const serviceRateBph = loadTimeMin > 0 ? 60 / loadTimeMin : Infinity;

  // Arrival rate at loading = how fast baskets could arrive
  // Bounded by: unloading service rate (baskets can't return faster than unloading releases them)
  // and the theoretical max throughput (system capacity ceiling)
  const theoMax = result.theoreticalMaxThroughput;
  const arrivalRateBph = Math.min(
    Number.isFinite(upstreamCapacityBph) ? upstreamCapacityBph : Infinity,
    Number.isFinite(theoMax) && theoMax > 0 ? theoMax : Infinity,
  );

  const isBottleneck = Number.isFinite(serviceRateBph) && arrivalRateBph > serviceRateBph;
  const utilPct = Number.isFinite(serviceRateBph) && serviceRateBph > 0 ? (arrivalRateBph / serviceRateBph) * 100 : 0;
  const isUnderutilized = !isBottleneck && Number.isFinite(serviceRateBph) && serviceRateBph > 0 && utilPct < 50;

  const timeline = sampleQueueTimeline(result.snapshots, "LOADQ", 300, result.simEnd);

  let formula: string;
  let explanation: string;
  if (!Number.isFinite(serviceRateBph) || loadTimeMin <= 0) {
    formula = "Service rate: instant (0 min load time)";
    explanation = "No loading time configured — baskets pass through immediately.";
  } else {
    formula = `Service rate = 60 / ${loadTimeMin.toFixed(1)} min = ${serviceRateBph.toFixed(1)} bph | Arrival rate = ${arrivalRateBph.toFixed(1)} bph | Utilization = ${utilPct.toFixed(0)}%`;
    if (isBottleneck) {
      const buildupRate = arrivalRateBph - serviceRateBph;
      explanation = `Baskets arrive at ${arrivalRateBph.toFixed(1)} bph but loading can only process ${serviceRateBph.toFixed(1)} bph. Queue grows by ~${buildupRate.toFixed(1)} baskets/hr. Loading is the bottleneck — reduce load time or add a parallel loading station.`;
    } else if (isUnderutilized) {
      explanation = `Loading station is at ${utilPct.toFixed(0)}% utilization — underutilized. Service capacity is ${serviceRateBph.toFixed(1)} bph but only ${arrivalRateBph.toFixed(1)} bph arriving. The system upstream is the constraint, not loading.`;
    } else {
      explanation = `Loading station is at ${utilPct.toFixed(0)}% utilization — performing well. Service capacity of ${serviceRateBph.toFixed(1)} bph is matched to arrival rate of ${arrivalRateBph.toFixed(1)} bph.`;
    }
  }

  let status: "ok" | "warning" | "violated";
  let rule: string;
  if (isBottleneck) {
    status = "violated";
    rule = "Loading is the bottleneck";
  } else if (isUnderutilized) {
    status = "warning";
    rule = "Loading station is underutilized";
  } else {
    status = "ok";
    rule = "Loading station is performing well";
  }

  return {
    componentId: station.id,
    componentType: "loading",
    label: station.label,
    rule,
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
  upstreamCapacityBph: number,
): ComponentConstraint {
  const unloadTimeSec = station.dwellSec;
  const unloadTimeMin = unloadTimeSec / 60;
  const serviceRateBph = unloadTimeMin > 0 ? 60 / unloadTimeMin : Infinity;

  // Arrival rate at unloading = how fast the upstream system can push baskets through
  // Bounded by: loading service rate (baskets can't enter faster than loading feeds them)
  // and the theoretical max throughput (system capacity ceiling)
  const theoMax = result.theoreticalMaxThroughput;
  const arrivalRateBph = Math.min(
    Number.isFinite(upstreamCapacityBph) ? upstreamCapacityBph : Infinity,
    Number.isFinite(theoMax) && theoMax > 0 ? theoMax : Infinity,
  );

  const isBottleneck = Number.isFinite(serviceRateBph) && arrivalRateBph > serviceRateBph;
  const utilPct = Number.isFinite(serviceRateBph) && serviceRateBph > 0 ? (arrivalRateBph / serviceRateBph) * 100 : 0;
  const isUnderutilized = !isBottleneck && Number.isFinite(serviceRateBph) && serviceRateBph > 0 && utilPct < 50;

  const timeline = sampleQueueTimeline(result.snapshots, "UNLOADQ", 300, result.simEnd);

  let formula: string;
  let explanation: string;
  if (!Number.isFinite(serviceRateBph) || unloadTimeMin <= 0) {
    formula = "Service rate: instant (0 min unload time)";
    explanation = "No unloading time configured — baskets pass through immediately.";
  } else {
    formula = `Service rate = 60 / ${unloadTimeMin.toFixed(1)} min = ${serviceRateBph.toFixed(1)} bph | Arrival rate = ${arrivalRateBph.toFixed(1)} bph | Utilization = ${utilPct.toFixed(0)}%`;
    if (isBottleneck) {
      const buildupRate = arrivalRateBph - serviceRateBph;
      explanation = `Baskets arrive at ${arrivalRateBph.toFixed(1)} bph but unloading can only process ${serviceRateBph.toFixed(1)} bph. Queue grows by ~${buildupRate.toFixed(1)} baskets/hr. Unloading is the bottleneck — reduce unload time or add a parallel unloading station.`;
    } else if (isUnderutilized) {
      explanation = `Unloading station is at ${utilPct.toFixed(0)}% utilization — underutilized. Service capacity is ${serviceRateBph.toFixed(1)} bph but only ${arrivalRateBph.toFixed(1)} bph arriving. The system upstream is the constraint, not unloading.`;
    } else {
      explanation = `Unloading station is at ${utilPct.toFixed(0)}% utilization — performing well. Service capacity of ${serviceRateBph.toFixed(1)} bph is matched to arrival rate of ${arrivalRateBph.toFixed(1)} bph.`;
    }
  }

  let status: "ok" | "warning" | "violated";
  let rule: string;
  if (isBottleneck) {
    status = "violated";
    rule = "Unloading is the bottleneck";
  } else if (isUnderutilized) {
    status = "warning";
    rule = "Unloading station is underutilized";
  } else {
    status = "ok";
    rule = "Unloading station is performing well";
  }

  return {
    componentId: station.id,
    componentType: "unloading",
    label: station.label,
    rule,
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
