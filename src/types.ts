// ─── Geometry & Layout ─────────────────────────────────────────

export type DistanceMode = "manhattan" | "euclidean";

export interface LayoutNode {
  id: string;
  label: string;
  type: "station" | "tank" | "oven" | "marker";
  x: number;
  y: number;
}

export interface LayoutMeta {
  source: "synthetic" | "dxf_labels";
  distanceMode: DistanceMode;
  anchors?: Record<string, { x: number; y: number }>;
  detectedStations?: number;
}

export interface Layout {
  nodes: LayoutNode[];
  meta: LayoutMeta;
}

export interface DxfLabel {
  type: string;
  layer: string;
  text: string;
  x: number;
  y: number;
  rotation: number | null;
  height: number | null;
}

export interface StationLabel {
  id: string;
  num: number;
  x: number;
  y: number;
  label: string;
}

// ─── Recipe & Process ──────────────────────────────────────────

export type TankType = "chemical" | "rinse";

export interface RecipeStep {
  id: string;
  label: string;
  dwellSec: number;
  kind: "tank" | "station" | "oven";
  tankType?: TankType;
  tolerancePct?: number;
}

export interface TankConfig {
  id: string;
  sequenceIndex: number;
  type: TankType;
  dwellTimeMin: number;
  dwellTimeSec: number;
  tolerancePct: number;
}

// ─── Simulation Parameters ─────────────────────────────────────

export interface SimParams {
  preset: string;
  tankCount: number;
  basketCount: number;
  recipeSteps: RecipeStep[];
  wdoTimeMin: number;
  loadTimeMin: number;
  unloadTimeMin: number;
  dripTimeSec: number;
  targetBph: number;
  simHours: number;
  wagonSpeedMPerMin: number;
  liftLowerSec: number;
  pickDropSec: number;
  wagonCount: number;
  distanceMode: DistanceMode;
  dwellClockOffsetSec: number | null;
  wagonFailureTimeSec?: number;
}

// ─── Simulation Resources ──────────────────────────────────────

export interface TankResource {
  id: string;
  cap: number;
  occupants: Set<string>;
  reserved: number;
}

export interface WagonZone {
  idx: number;
  startTank: number;
  endTank: number;
  homePos: string;
  label: string;
}

export interface WagonState {
  id: string;
  pos: string;
  availableAt: number;
  busySec: number;
  zone: WagonZone;
  state: WagonActivityState;
  movingSec: number;
  waitingSec: number;
  blockedSec: number;
  handlingSec: number;
  idleSince: number;
}

export type WagonActivityState =
  | { kind: "idle" }
  | { kind: "transfer"; from: string; to: string; basketId: string; start: number; end: number }
  | { kind: "failed" };

export interface StationResource {
  id: string;
  cap: number;
  busyUntil: number;
  queue: string[];
  processing: string | null;
  occupants: Set<string>;
  reserved: number;
}

export interface Resources {
  tanks: Record<string, TankResource>;
  wdo: StationResource;
  load: StationResource;
  unload: StationResource;
  wagons: WagonState[];
}

// ─── Basket ─────────────────────────────────────────────────────

export type BasketState =
  | "WAITING_LOAD"
  | "LOADING"
  | "IN_TANK"
  | "READY_FOR_PICKUP"
  | "IN_TRANSIT"
  | "WAITING_UNLOAD"
  | "UNLOADING"
  | "DONE"
  | "FAILED";

export interface Basket {
  id: string;
  createdAt: number;
  cycleCount: number;
  currentState: BasketState;
  stateEnteredAt: number;
  elapsedInState: number;
  loc: string;
  insertedAt: number | null;
  readyAt: number | null;
  doneAt: number | null;
  totalWaitSec: number;
  totalTravelSec: number;
  totalDwellSec: number;
  lastBlockReason?: ViolationCause;
  stateHistory?: BasketStateTransition[];
}

export interface BasketStateTransition {
  timestamp: number;
  fromState: BasketState;
  toState: BasketState;
  reason: string;
}

// ─── Simulation Events ─────────────────────────────────────────

export type SimEventKind =
  | "basket_arrival"
  | "load_done"
  | "unload_done"
  | "pickup"
  | "drop"
  | "dwell_done"
  | "loading_complete"
  | "transfer_done"
  | "wagon_failure"
  | "line_stop";

export interface SimEvent {
  t: number;
  kind: SimEventKind;
  basketId?: string;
  wagonId?: string;
  src?: string;
  dst?: string;
  start?: number;
  end?: number;
  from?: string;
  to?: string;
  at?: string;
  arriveDestAt?: number;
}

// ─── Violations ────────────────────────────────────────────────

export type ViolationType = "over_dwell" | "under_dwell";
export type ViolationCause = "wagon_unavailable" | "destination_blocked" | "line_design";

export interface Violation {
  basketId: string;
  tankId: string;
  type: ViolationType;
  elapsed: number;
  dwellTime: number;
  tolerancePct: number;
  earliestExit: number;
  latestExit: number;
  timestamp: number;
  cause: ViolationCause;
}

// ─── Utilization ───────────────────────────────────────────────

export interface WagonUtil {
  id: string;
  util01: number;
  zone: WagonZone;
  busySec: number;
  idleSec: number;
  movingSec: number;
  waitingSec: number;
  blockedSec: number;
  handlingSec: number;
}

export interface StationUtil {
  id: string;
  util01: number;
  avgDwellSec: number;
  targetDwellSec: number;
  violationCount: number;
  dwellCount: number;
}

export interface LoadingMetrics {
  avgQueueWaitSec: number;
  maxQueueDepth: number;
  processingUtil01: number;
  totalBasketsLoaded: number;
}

export interface UnloadingMetrics {
  maxQueueDepth: number;
}

export interface InventoryAnalysis {
  avgWip: number;
  maxWip: number;
  optimalWip: number;
  recommendedBuffer: number;
  excessWip: number;
  recommendedBph: number;
  arrivalBph: number;
  isOverfeeding: boolean;
  wipSamples: number[];
}

// ─── Scheduling Decisions ──────────────────────────────────────

export interface SchedulingDecision {
  timestamp: number;
  wagonId: string;
  selectedBasketId: string;
  urgencyScore: number;
  rejectedCandidates: { basketId: string; reason: string; urgency: number }[];
  travelTimeEstimate: number;
  reason: string;
}

// ─── Failure ───────────────────────────────────────────────────

export interface FailureRecord {
  wagonId: string;
  timestamp: number;
  impact: "line_stopped" | "zone_isolated";
  stuckBaskets: number;
}

// ─── Simulation Output ─────────────────────────────────────────

export interface SimulationResult {
  simEnd: number;
  completedCount: number;
  throughputBph: number;
  throughputSteadyBph: number;
  throughputTrimmedBph: number;
  throughputStatus: "ok" | "warm_up_bias" | "insufficient_data";
  avgLeadTimeSec: number;
  waits: Record<string, number>;
  bottleneck: string;
  violations: Violation[];
  util: {
    wagons: WagonUtil[];
    stations: StationUtil[];
  };
  loading: LoadingMetrics;
  unloading: UnloadingMetrics;
  inventory: InventoryAnalysis;
  baskets: Basket[];
  events: SimEvent[];
  snapshots: { t: number; completed: number; locCounts: Record<string, number>; wagonStates?: { id: string; pos: string; availableAt: number; state: WagonActivityState }[] }[];
  schedulingDecisions: SchedulingDecision[];
  failures: FailureRecord[];
  lineStopped: boolean;
  handoffStats?: {
    count: number;
    avgDelaySec: number;
    maxDelaySec: number;
  };
  // Three-tier throughput
  targetThroughput: number;
  simulatedThroughput: number;
  theoreticalMaxThroughput: number;
  throughputLimitation?: {
    factor: "wagon_bottleneck" | "dwell_bottleneck" | "tank_occupancy" | "loading_constraint" | "configuration_incomplete";
    description: string;
  };
}

// ─── Sim Plan (single-basket theoretical) ──────────────────────

export interface PlanStep {
  type: string;
  at?: string;
  from?: string;
  to?: string;
  label: string;
  start: number;
  end: number;
  distanceMm?: number;
}

export interface SimPlan {
  steps: PlanStep[];
  cycleSeconds: number;
  violations: string[];
  buckets: { travel: number; handling: number; dwell: number; manual: number; drip: number };
}

// ─── Scenario Compare ──────────────────────────────────────────

export interface ScenarioSnapshot {
  at: string;
  params: SimParams;
  metrics: {
    throughputBph: number;
    avgLeadTimeSec: number;
    violations: number;
    bottleneck: string;
  };
}

// ─── Glossary ──────────────────────────────────────────────────

export interface GlossaryEntry {
  section: string;
  term: string;
  tags: string;
  def: string;
  cause: string;
  effect: string;
  example: string;
}

// ─── UI Elements ───────────────────────────────────────────────

export interface UiElements {
  layoutMode: HTMLSelectElement;
  fetchDxfBtn: HTMLButtonElement;
  loadFilesBtn: HTMLButtonElement;
  filePicker: HTMLInputElement;
  layoutStatus: HTMLElement;
  recipePreset: HTMLSelectElement;
  tankCount: HTMLInputElement;
  wdoTimeMin: HTMLInputElement;
  loadTimeMin: HTMLInputElement;
  unloadTimeMin: HTMLInputElement;
  dripTimeSec: HTMLInputElement;
  basketCount: HTMLInputElement;
  simHours: HTMLInputElement;
  dwellPreset: HTMLInputElement;
  tankTableBody: HTMLElement;
  tankOverridesDetails: HTMLDetailsElement;
  wagonSpeedMPerMin: HTMLInputElement;
  liftLowerSec: HTMLInputElement;
  pickDropSec: HTMLInputElement;
  wagonCount: HTMLInputElement;
  distanceMode: HTMLSelectElement;
  autoRun: HTMLInputElement;
  kpiThroughput: HTMLElement;
  kpiThroughputSub: HTMLElement;
  kpiLeadTime: HTMLElement;
  kpiLeadTimeSub: HTMLElement;
  kpiBottleneck: HTMLElement;
  kpiBottleneckSub: HTMLElement;
  kpiViolations: HTMLElement;
  kpiViolationsSub: HTMLElement;
  kpiWagonUtil: HTMLElement;
  kpiWagonUtilSub: HTMLElement;
  kpiOptimalWip: HTMLElement;
  kpiOptimalWipSub: HTMLElement;
  nowOut: HTMLElement;
  hoverTip: HTMLElement;
  stationMetricsBody: HTMLElement;
  wagonMetricsBody: HTMLElement;
  loadingKvGrid: HTMLElement;
  loadingQueueSvg: SVGSVGElement;
  throughputSvg: SVGSVGElement;
  wipSvg: SVGSVGElement;
  ganttSvg: SVGSVGElement;
  exportSummaryBtn: HTMLButtonElement | null;
  summaryInline: HTMLElement;
  summaryText: HTMLTextAreaElement;
  summarySelectBtn: HTMLButtonElement;
  summaryHideBtn: HTMLButtonElement;
  configPanel: HTMLElement;
  recipeSummary: HTMLElement;
  manualSummary: HTMLElement;
  transportSummary: HTMLElement;
  simSettingsSummary: HTMLElement;
}

// ─── App State ─────────────────────────────────────────────────

export interface AppState {
  layout: Layout;
  dxfLabelsRows: DxfLabel[] | null;
  params: SimParams | null;
  plan: SimPlan | null;
  sim: SimulationResult | null;
  chartsStale: boolean;
  chartMeta: Record<string, unknown> | null;
  activeTab: string;
  detectedStations: StationLabel[] | null;
}
