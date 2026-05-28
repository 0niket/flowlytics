import type { Layout, SimParams } from "../types";
import { runSimulation } from "./simulation";

export interface SweepConfig {
  basketCounts: number[];
  wagonCounts: number[];
  costPerWagon?: number;
  costPerBasket?: number;
}

export interface SweepPoint {
  basketCount: number;
  wagonCount: number;
  throughputBph: number;
  throughputTrimmedBph: number;
  avgLeadTimeSec: number;
  violationCount: number;
  failureCount: number;
  handoffCount: number;
  costIndex: number;
  lineStopped: boolean;
}

export function runSweep(layout: Layout, baseParams: SimParams, config: SweepConfig): SweepPoint[] {
  const costPerWagon = config.costPerWagon ?? 10;
  const costPerBasket = config.costPerBasket ?? 1;
  const points: SweepPoint[] = [];

  for (const bc of config.basketCounts) {
    for (const wc of config.wagonCounts) {
      const params: SimParams = { ...baseParams, basketCount: bc, wagonCount: wc };
      const result = runSimulation(layout, params);

      const costIndex = wc * costPerWagon + bc * costPerBasket;

      points.push({
        basketCount: bc,
        wagonCount: wc,
        throughputBph: result.throughputBph,
        throughputTrimmedBph: result.throughputTrimmedBph,
        avgLeadTimeSec: result.avgLeadTimeSec,
        violationCount: result.violations.length,
        failureCount: result.failures.length,
        handoffCount: result.handoffStats?.count ?? 0,
        costIndex: result.throughputBph > 0 ? costIndex / result.throughputBph : Infinity,
        lineStopped: result.lineStopped,
      });
    }
  }

  return points;
}

export interface OptimalResult {
  bestValue: SweepPoint;
  points: SweepPoint[];
}

export function findOptimal(points: SweepPoint[]): OptimalResult {
  const valid = points.filter((p) => p.throughputBph > 0 && !p.lineStopped);
  if (valid.length === 0) return { bestValue: points[0], points };

  const sorted = [...valid].sort((a, b) => a.costIndex - b.costIndex);
  return { bestValue: sorted[0], points };
}
