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
  layoutMode: el("layoutMode"),
  fetchDxfBtn: el("fetchDxfBtn"),
  loadFilesBtn: el("loadFilesBtn"),
  filePicker: el("filePicker"),
  layoutStatus: el("layoutStatus"),
  recipePreset: el("recipePreset"),
  tankCount: el("tankCount"),
  wdoTimeMin: el("wdoTimeMin"),
  loadTimeMin: el("loadTimeMin"),
  unloadTimeMin: el("unloadTimeMin"),
  tolerancePct: el("tolerancePct"),
  dripTimeSec: el("dripTimeSec"),
  targetBph: el("targetBph"),
  simHours: el("simHours"),
  dwellPreset: el("dwellPreset"),
  tankTableBody: el("tankTableBody"),
  tankOverridesDetails: el("tankOverridesDetails"),
  wagonSpeedMPerMin: el("wagonSpeedMPerMin"),
  liftLowerSec: el("liftLowerSec"),
  pickDropSec: el("pickDropSec"),
  wagonCount: el("wagonCount"),
  distanceMode: el<HTMLSelectElement>("distanceMode"),
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
  nowOut: el("nowOut"),
  hoverTip: el("hoverTip"),
  stationMetricsBody: el("stationMetricsBody"),
  wagonMetricsBody: el("wagonMetricsBody"),
  loadingKvGrid: el("loadingKvGrid"),
  loadingQueueSvg: svgEl("loadingQueueSvg"),
  throughputSvg: svgEl("throughputSvg"),
  wipSvg: svgEl("wipSvg"),
  ganttSvg: svgEl("ganttSvg"),
  exportSummaryBtn: (document.getElementById("exportSummaryBtn") as HTMLButtonElement | null),
  summaryInline: el("summaryInline"),
  summaryText: el("summaryText"),
  summarySelectBtn: el("summarySelectBtn"),
  summaryHideBtn: el("summaryHideBtn"),
  configPanel: el("configPanel"),
  recipeSummary: el("recipeSummary"),
  manualSummary: el("manualSummary"),
  transportSummary: el("transportSummary"),
  simSettingsSummary: el("simSettingsSummary"),
};

export const state: AppState = {
  layout: buildSyntheticLayout(12),
  dxfLabelsRows: null,
  params: null,
  plan: null,
  sim: null,
  chartsStale: true,
  chartMeta: null,
  activeTab: "stations",
  detectedStations: null,
};
