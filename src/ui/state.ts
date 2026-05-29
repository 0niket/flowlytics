import type { UiElements, AppState } from "../types";
import { buildSyntheticLayout } from "../engine/layout";

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing element: ${id}`);
  return e as unknown as T;
}

function svgEl(id: string): SVGSVGElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing SVG element: ${id}`);
  return e as unknown as SVGSVGElement;
}

export const ui: UiElements = {
  autoRun: el("autoRun"),
  kpiThroughput: el("kpiThroughput"),
  kpiThroughputSub: el("kpiThroughputSub"),
  kpiLeadTime: el("kpiLeadTime"),
  kpiLeadTimeSub: el("kpiLeadTimeSub"),
  kpiBottleneck: el("kpiBottleneck"),
  kpiBottleneckSub: el("kpiBottleneckSub"),
  kpiViolations: el("kpiViolations"),
  kpiViolationsSub: el("kpiViolationsSub"),
  kpiWagonUtil: el("kpiWagonUtil"),
  kpiWagonUtilSub: el("kpiWagonUtilSub"),
  kpiOptimalWip: el("kpiOptimalWip"),
  kpiOptimalWipSub: el("kpiOptimalWipSub"),
  stationMetricsBody: el("stationMetricsBody"),
  wagonMetricsBody: el("wagonMetricsBody"),
  loadingKvGrid: el("loadingKvGrid"),
  loadingQueueSvg: svgEl("loadingQueueSvg"),
  throughputSvg: svgEl("throughputSvg"),
  wipSvg: svgEl("wipSvg"),
  ganttSvg: svgEl("ganttSvg"),
  violationSvg: svgEl("violationSvg"),
  wagonActivitySvg: svgEl("wagonActivitySvg"),
  exportSummaryBtn: (document.getElementById("exportSummaryBtn") as HTMLButtonElement | null),
  summaryInline: el("summaryInline"),
  summaryText: el("summaryText"),
  summarySelectBtn: el("summarySelectBtn"),
  summaryHideBtn: el("summaryHideBtn"),
  configPanel: el("configPanel"),
};

export const state: AppState = {
  layout: buildSyntheticLayout(12),
  params: null,
  plan: null,
  sim: null,
  chartsStale: true,
  chartMeta: null,
  activeTab: "stations",
  lineConfig: null,
};
