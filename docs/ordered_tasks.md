# Flowlytics — Ordered Task List

This file enumerates every task needed to rewrite the Flowlytics pretreatment transporter simulator.  
Each task is atomic, has a verification step, and depends on all prior tasks being complete.  
A coding agent should work through this list sequentially, marking `[x]` as each is verified.

Detailed acceptance criteria and unit test specs for each user story are defined in [`docs/user_stories.md`](./user_stories.md).  
Each phase below links to its parent user story via `US-NNN`.

---

## Phase 0: Project Infrastructure & TypeScript Conversion  
*No user story — foundational setup*

### Task 0.0 — Initialize project with npm, Vite, TypeScript, vitest
- [ ] Create `package.json` with `npm init`
- [ ] Install dependencies: `typescript`, `vite`, `vitest`, `@types/node`
- [ ] Create `tsconfig.json` (strict mode, target ES2022, module ESNext)
- [ ] Create `vite.config.ts`
- [ ] Create `vitest.config.ts`
- [ ] Add npm scripts: `dev`, `build`, `test`, `typecheck`
- [ ] Verify: `npm run build` produces output in `dist/`

### Task 0.1 — Create source directory structure
- [ ] Create `src/` with subdirectories:
  - `src/engine/` — simulation engine
  - `src/ui/` — UI/DOM interaction
  - `src/dxf/` — DXF/DWG parsing
  - `src/glossary/` — glossary data + renderer
  - `src/config/` — config panel logic
- [ ] Create `src/types.ts` — shared type definitions (Tank, Basket, Wagon, Event, SimulationResult, etc.)
- [ ] Move `web/index.html` to project root (Vite convention) or configure Vite to use `web/` as root
- [ ] Verify: `npm run dev` serves the app without errors

### Task 0.2 — Convert utility functions to TypeScript
- [ ] Move and type: `clamp`, `formatPct01`, `formatSeconds`, `formatTimeShort`, `mPerMinToMmPerSec`, `minutesToSeconds`, `escapeHtml`
- [ ] Verify: all functions have typed signatures
- [ ] Verify: `npm run typecheck` passes

### Task 0.3 — Convert heap/priority queue to TypeScript module
- [ ] Create `src/engine/heap.ts` with typed generic heap
- [ ] Export `heapPush<T>`, `heapPop<T>`, `heapPeek<T>`
- [ ] Add unit tests in `src/engine/heap.test.ts`
- [ ] Verify: `npm test` passes

### Task 0.4 — Convert layout builders to TypeScript
- [ ] Create `src/engine/layout.ts`:
  - `buildSyntheticLayout(tankCount): Layout`
  - `buildLayoutFromDxfLabels(labelsRows, tankCount): Layout`
  - `defaultRecipe(tankCount, preset): RecipeStep[]`
- [ ] Define types: `Layout`, `LayoutNode`, `RecipeStep`, `DistanceMode`
- [ ] Verify: `npm run typecheck` passes

### Task 0.5 — Convert simulation engine to TypeScript module
- [ ] Create `src/engine/simulation.ts`:
  - `computeZones(tankCount, wagonCount): Zone[]`
  - `makeResources(params): Resources`
  - `runSimulation(layout, params): SimulationResult`
  - `buildSimPlan(layout, params): SimPlan`
- [ ] All internal helper functions become private module functions
- [ ] Define types: `SimParams`, `Resources`, `Basket`, `WagonState`, `SimEvent`, `SimulationResult`, `SimPlan`
- [ ] Verify: `npm run typecheck` passes

### Task 0.6 — Write smoke tests for simulation engine
- [ ] Create `src/engine/simulation.test.ts`:
  - Test: default single-basket run completes without error
  - Test: basic throughput is positive
  - Test: violations are detected when dwell exceeds tolerance
  - Test: multi-wagon configuration runs
  - Test: `buildSimPlan` returns expected structure
- [ ] Verify: `npm test` passes

### Task 0.7 — Convert DXF parser to TypeScript module
- [ ] Create `src/dxf/parser.ts`:
  - `extractLabelsFromDxfText(dxfText): DxfLabel[]`
  - `handleDxfFile(file): Promise<DxfLabel[]>`
- [ ] Create `src/dxf/detector.ts`:
  - `detectStationsFromLabels(labels): DetectedStations`
  - Types: `DxfLabel`, `DetectedStations`
- [ ] Verify: `npm run typecheck` passes

### Task 0.8 — Convert glossary to TypeScript module
- [ ] Create `src/glossary/data.ts` — typed glossary entries
- [ ] Create `src/glossary/renderer.ts` — `renderGlossary()`, `initGlossary()`
- [ ] Verify: `npm run typecheck` passes

### Task 0.9 — Convert UI modules to TypeScript
- [ ] Create `src/ui/dom.ts` — `el`, `elRequired` helpers
- [ ] Create `src/ui/config.ts` — `readParamsFromUi()`, `rebuildTankTable()`, config DOM refs
- [ ] Create `src/ui/kpis.ts` — `updateKpiCards()`, KPI rendering
- [ ] Create `src/ui/metrics.ts` — `renderStationMetrics()`, `renderWagonMetrics()`, `renderLoadingMetrics()`
- [ ] Create `src/ui/charts.ts` — `renderCharts()`, `renderGantt()`, `renderLineChart()`
- [ ] Create `src/ui/export.ts` — `exportSummaryText()`, `copyToClipboard()`
- [ ] Create `src/ui/theme.ts` — theme toggle, localStorage
- [ ] Create `src/ui/startup.ts` — startup wizard/modal
- [ ] Define types: `UiElements` (typed map of all DOM element references)
- [ ] Verify: `npm run typecheck` passes

### Task 0.10 — Create main entry point
- [ ] Create `src/main.ts`:
  - Initialize DOM references (`const ui: UiElements = { ... }`)
  - Initialize state (`const state: AppState = { ... }`)
  - Wire event listeners (`initUi()`)
  - Wire auto-run (`recomputeAndRender()`)
  - Call `initStartupModal()`
- [ ] Define `AppState` type
- [ ] Update `index.html` to load built JS (from `dist/` or via Vite dev server)
- [ ] Verify: `npm run dev` serves a working app
- [ ] Verify: simulation runs, KPI cards update, tabs work

### Task 0.11 — Build production bundle
- [ ] Configure Vite for production build (minify, target ES2022)
- [ ] Verify: `npm run build` succeeds
- [ ] Verify: `npm run preview` serves working production build
- [ ] Verify: no console errors on page load
- [ ] Verify: all three files (JS, HTML, CSS) load correctly

### Task 0.12 — End-to-end smoke test
- [ ] Create `src/e2e/smoke.test.ts`:
  - Test: loading the page (in jsdom) creates expected DOM structure
  - Test: default configuration renders KPI cards with values
  - Test: changing tankCount triggers recompute
- [ ] Verify: `npm test` passes

---

## Phase 1: Drawing & Station Detection  
*User story: [US-001](user_stories.md#us-001-drawing--station-detection)*

### Task 1.0 — Station clarity validation
- [ ] Add station clarity check in `DetectedStations` type:
  - `confidence: number` (0-1)
  - `missingStations: string[]` (stations not found)
  - `ambiguousStations: string[]` (stations with unclear labels)
- [ ] Implement `validateStationClarity(detected, tankCount): StationValidation`
- [ ] If confidence < threshold, flag drawing as insufficient
- [ ] Show validation result in DXF import UI
- [ ] Unit tests: `src/dxf/detector.test.ts`
- [ ] Verify: drawing with incomplete labels is flagged
- [ ] Verify: drawing with clear labels proceeds

### Task 1.1 — Manual station count override
- [ ] Add UI: if station detection is ambiguous, show manual override input
- [ ] User can enter station count manually
- [ ] Manual override persists for the session
- [ ] Simulation cannot proceed until station mapping is complete
- [ ] Unit tests: manual override logic
- [ ] Verify: override works, simulation blocked if incomplete

### Task 1.2 — DXF station preview in UI
- [ ] Show detected stations list in config panel after DXF import
- [ ] Each station shows: id, confidence, position
- [ ] Missing stations are highlighted
- [ ] Verify: list matches detected data

---

## Phase 2: Tank Sequence & Configuration  
*User story: [US-002](user_stories.md#us-002-tank-sequence--configuration)*

### Task 2.0 — Tank type classification
- [ ] Add `tankType: "chemical" | "rinse"` to tank configuration
- [ ] UI: dropdown or toggle per tank in config panel
- [ ] Default: all tanks as chemical
- [ ] Recipe presets (MS, AL) set appropriate defaults
- [ ] Unit tests: tank type is persisted and round-tripped
- [ ] Verify: tank type appears in config panel and is editable

### Task 2.1 — Per-tank dwell time configuration
- [ ] Ensure each tank has independently editable dwell time
- [ ] UI: table with row per tank, columns: id, type, dwell time
- [ ] Recipe presets fill in defaults, user can override per tank
- [ ] Verify: changing one tank's dwell does not affect others

### Task 2.2 — Fixed process sequence enforcement
- [ ] Simulation engine enforces basket progression in configured sequence
- [ ] Wagon movement may be non-sequential (can skip tanks)
- [ ] Basket cannot skip a tank in the sequence
- [ ] Unit tests: sequence enforcement, non-sequential wagon allowed
- [ ] Verify: basket always follows sequence, wagon can move freely

### Task 2.3 — Loading and unloading station config
- [ ] UI: loading and unloading stations are always first and last
- [ ] Loading station has: load time config
- [ ] Unloading station has: unload time config
- [ ] Verify: simulation uses configured load/unload times

---

## Phase 3: Tolerance by Tank Type  
*User story: [US-003](user_stories.md#us-003-tolerance-by-tank-type)*

### Task 3.0 — Per-tank tolerance configuration
- [ ] Add `tolerancePct: number` to each tank (default ±10% for chemical, ±50% for rinse)
- [ ] UI: tolerance field per tank in config table
- [ ] Tolerance defaults auto-set based on tank type
- [ ] Tolerance changes persist across recipe preset changes (if custom)
- [ ] Unit tests: tolerance defaults, manual override, type-based defaults
- [ ] Verify: chemical tanks show ±10%, rinse tanks show ±50%

### Task 3.1 — Tolerance-aware violation logic
- [ ] Violation engine uses per-tank tolerance (not global)
- [ ] Earliest valid exit = dwellTime * (1 - tolerancePct)
- [ ] Latest valid exit = dwellTime * (1 + tolerancePct)
- [ ] Basket removed before earliest valid exit → under-dwell violation
- [ ] Basket removed after latest valid exit → over-dwell violation
- [ ] Unit tests: both over and under violations with per-tank tolerance
- [ ] Verify: violation count changes when tolerance is narrowed/widened

---

## Phase 4: PLC-Style State Tracking  
*User story: [US-004](user_stories.md#us-004-plc-style-state-tracking)*

### Task 4.0 — Define formal basket state machine
- [ ] States: `WAITING_LOAD` → `LOADING` → `IN_TANK` → `READY_FOR_PICKUP` → `IN_TRANSIT` → (repeat IN_TANK) → `WAITING_UNLOAD` → `UNLOADING` → `DONE`
- [ ] Add `WAITING_LOAD` state (basket in loading queue)
- [ ] Add `LOADING` state (basket being loaded, timer active)
- [ ] Add `IN_TANK` state (basket in tank, dwell timer running)
- [ ] Add `READY_FOR_PICKUP` state (dwell complete, waiting for wagon)
- [ ] Add `IN_TRANSIT` state (basket on wagon, being moved)
- [ ] Add `WAITING_UNLOAD` state (basket in unload queue)
- [ ] Add `UNLOADING` state (basket being unloaded)
- [ ] Add `DONE` state (basket fully processed)
- [ ] Unit tests: basket transitions correctly through all states
- [ ] Verify: state machine covers all valid transitions

### Task 4.1 — Track per-basket timing
- [ ] Each basket stores:
  - `currentState`: BasketState
  - `stateEnteredAt`: number (sim time when current state began)
  - `elapsedInState`: number (computed)
  - `totalWaitSec`: number (cumulative wait time)
  - `totalTravelSec`: number (cumulative travel time)
  - `totalDwellSec`: number (cumulative dwell time per tank)
- [ ] Unit tests: timing is computed correctly
- [ ] Verify: basket timing breakdowns are accessible in simulation output

### Task 4.2 — Expose state history
- [ ] Simulation output includes per-basket state transition log:
  - `{ timestamp, fromState, toState, reason }`
- [ ] Unit tests: state history contains expected transitions
- [ ] Verify: state history is accurate for a simple run

---

## Phase 5: Multi-Basket Modeling  
*User story: [US-005](user_stories.md#us-005-multi-basket-modeling)*

### Task 5.0 — Concurrent basket support in simulation
- [ ] Simulation engine creates baskets at configured `basketCount`
- [ ] Multiple baskets exist simultaneously in the system
- [ ] Each basket is tracked independently through its state machine
- [ ] Baskets can occupy different tanks at the same time
- [ ] Simulation prevents invalid moves (basket to occupied tank)
- [ ] Unit tests: 2, 3, 5 baskets run without errors
- [ ] Verify: `completedCount` increases with more baskets

### Task 5.1 — Basket lifecycle state machine in engine
- [ ] Replace simple `loc`/`insertedAt`/`readyAt` with formal state machine
- [ ] State transitions are explicit events in the event loop
- [ ] Baskets in `READY_FOR_PICKUP` enter dispatch consideration
- [ ] Baskets in `IN_TRANSIT` are not available for new assignments
- [ ] Unit tests: all valid state transitions work
- [ ] Unit tests: invalid transitions are rejected
- [ ] Verify: basket states match expected lifecycle

### Task 5.2 — Basket count configuration in UI
- [ ] Add `basketCount` input to config panel (Simulation Settings section)
- [ ] Default: 2 baskets
- [ ] Range: 1-20
- [ ] Changing basket count triggers auto-run
- [ ] Verify: simulation respects configured basket count

---

## Phase 6: Loading-Complete Signal  
*User story: [US-006](user_stories.md#us-006-loading-complete-signal)*

### Task 6.0 — Loading-complete event in state machine
- [ ] Add explicit `LOADING_COMPLETE` event
- [ ] Basket enters `LOADING` state when load starts
- [ ] After `loadTimeMin` elapses, `LOADING_COMPLETE` fires
- [ ] Basket transitions to `READY_FOR_PICKUP` at LOAD station
- [ ] Wagon cannot pick from LOAD before this event
- [ ] Unit tests: loading-complete is required for pickup
- [ ] Verify: pickup from LOAD only happens after signal

### Task 6.1 — Loading queue with blocked-basket handling
- [ ] If next tank after LOAD is occupied, basket remains `READY_FOR_PICKUP` at LOAD
- [ ] Wagon does not pick basket until destination is available
- [ ] Loading queue is FIFO per station
- [ ] Unit tests: blocked basket waits at LOAD
- [ ] Verify: basket waits at LOAD when T1 is occupied

---

## Phase 7: Wagon Scheduling & Dispatch Priority  
*User story: [US-007](user_stories.md#us-007-wagon-scheduling--dispatch-priority)*

### Task 7.0 — Event-driven scheduler with urgency scoring
- [ ] At each event time, evaluate all baskets in `READY_FOR_PICKUP`
- [ ] For each ready basket, compute urgency score:
  - `urgency = (elapsedDwell - targetDwell) / (tolerancePct * targetDwell)`
  - If urgency >= 1.0, basket is in violation risk
  - Higher urgency = higher priority
- [ ] Dispatch logic: sort ready baskets by urgency (descending)
- [ ] Assign wagon to highest-urgency basket first
- [ ] Unit tests: urgency scoring, priority ordering
- [ ] Verify: wagon picks most urgent basket first

### Task 7.1 — Deterministic tie-breaking
- [ ] If two baskets have equal urgency, break ties by:
  1. Earliest dwell completion time
  2. If still tied, smallest basket id
- [ ] Unit tests: tie-breaking is deterministic
- [ ] Verify: same inputs always produce same scheduling

### Task 7.2 — Scheduling decision logging
- [ ] For each wagon assignment, log:
  - Why this basket was chosen (urgency score, tie-break reason)
  - Why other candidates were not chosen
- [ ] Log accessible in simulation output
- [ ] Unit tests: log contains expected decision records
- [ ] Verify: decision log explains every wagon assignment

### Task 7.3 — Prevent process sequence violations
- [ ] Scheduler never assigns a basket to a tank ahead of its next sequence step
- [ ] Scheduler never moves a basket backward in sequence
- [ ] Wagon travel may be non-sequential (can pass other tanks)
- [ ] Unit tests: sequence violations are prevented
- [ ] Verify: basket always moves to correct next step

---

## Phase 8: Violation Detection  
*User story: [US-008](user_stories.md#us-008-violation-detection)*

### Task 8.0 — Per-tank violation engine
- [ ] On each pickup event, check if basket is within tolerance window:
  - `dwellElapsed = pickupTime - insertedAt`
  - `earliestExit = dwellTime * (1 - tolerancePct)`
  - `latestExit = dwellTime * (1 + tolerancePct)`
- [ ] If `dwellElapsed < earliestExit` → record under-dwell violation
- [ ] If `dwellElapsed > latestExit` → record over-dwell violation
- [ ] Violation record: `{ basketId, tankId, type, elapsed, limit, timestamp }`
- [ ] Unit tests: both violation types detected correctly
- [ ] Verify: violations appear in simulation output

### Task 8.2 — Violation cause attribution
- [ ] For each violation, attribute root cause:
  - `wagon_unavailable` — no wagon could reach basket in time
  - `destination_blocked` — next tank was occupied
  - `line_design` — dwell time is physically impossible given travel times
- [ ] Unit tests: cause attribution logic
- [ ] Verify: violation records include cause

---

## Phase 9: Throughput Simulation  
*User story: [US-009](user_stories.md#us-009-throughput-simulation)*

### Task 9.0 — Three-tier throughput metrics
- [ ] `targetThroughput`: user-entered target
- [ ] `simulatedThroughput`: actual achieved throughput from simulation
- [ ] `theoreticalMaxThroughput`: 3600 / (cycle time of bottleneck step)
- [ ] Display all three separately in KPI cards
- [ ] Unit tests: all three are computed and non-negative
- [ ] Verify: three throughput values are visible in UI

### Task 9.1 — Throughput limitation explanation
- [ ] If simulated throughput < target throughput, show limiting factor:
  - `wagon_bottleneck`: wagons are at 100% utilization
  - `dwell_bottleneck`: tank dwell time is the constraint
  - `tank_occupancy`: all tanks are occupied, blocking movement
  - `loading_constraint`: loading station is maxed out
  - `configuration_incomplete`: missing required settings
- [ ] Unit tests: each bottleneck type is detected correctly
- [ ] Verify: bottleneck explanation appears when throughput is limited

### Task 9.2 — Remove artificial throughput cap
- [ ] Ensure achieved throughput is not capped by target throughput
- [ ] Achieved throughput can exceed target
- [ ] KPI cards show both values independently
- [ ] Verify: setting low target does not artificially limit results

---

## Phase 10: Wagon Utilization & Idle Analysis  
*User story: [US-010](user_stories.md#us-010-wagon-utilization--idle-analysis)*

### Task 10.0 — Per-wagon utilization breakdown
- [ ] `moving`: time spent traveling with or without a basket
- [ ] `waiting`: time spent idle at a position
- [ ] `blocked`: time spent waiting for a destination to free up
- [ ] `handling`: time spent on lift/lower/pick/drop operations
- [ ] Unit tests: breakdown sums to total simulation time
- [ ] Verify: utilization breakdown is visible per wagon

### Task 10.1 — Wagon metrics in UI
- [ ] Update wagon metric cards with:
  - Utilization % (moving / total)
  - Idle % (waiting / total)
  - Blocked % (blocked / total)
  - Move vs wait split bar
- [ ] Verify: metrics update when config changes

---

## Phase 11: Multi-Wagon Zone Support  
*User story: [US-011](user_stories.md#us-011-multi-wagon-zone-support)*

### Task 11.0 — Zone-based wagon ownership
- [ ] Wagon assigned to contiguous tank range
- [ ] Wagon only services tanks in its zone
- [ ] Wagon has home position within zone
- [ ] Unit tests: zone assignment, zone boundaries
- [ ] Verify: wagons stay in their zones

### Task 11.1 — Shared handoff tank
- [ ] Adjacent zones share one transfer tank
- [ ] Wagon A drops basket at shared tank
- [ ] Wagon B picks up from shared tank
- [ ] Handoff modeled as: drop (A) → dwell (if any) → pickup (B)
- [ ] Unit tests: handoff completes correctly
- [ ] Verify: basket transfers between wagons via shared tank

### Task 11.2 — Handoff delay reporting
- [ ] Simulation output includes handoff delay stats:
  - Number of handoffs
  - Average handoff delay
  - Max handoff delay
- [ ] Unit tests: handoff timing is tracked
- [ ] Verify: handoff stats appear in simulation output

---

## Phase 12: Failure Handling  
*User story: [US-012](user_stories.md#us-012-failure-handling)*

### Task 12.0 — Wagon failure state
- [ ] Add `FAILED` state to wagon state machine
- [ ] Failed wagon cannot accept new tasks
- [ ] If wagon has a basket in transit when failure occurs, basket is stuck
- [ ] Unit tests: failure prevents new assignments
- [ ] Verify: failed wagon is excluded from dispatch

### Task 12.1 — Single-wagon failure stops line
- [ ] For single-wagon config, wagon failure stops all movement
- [ ] All active baskets become stuck at current positions
- [ ] Simulation ends with `lineStopped: true`
- [ ] Unit tests: single-wagon failure stops line
- [ ] Verify: simulation output shows line stopped

### Task 12.2 — Multi-wagon failure isolation
- [ ] For multi-wagon config, failed wagon's zone is isolated
- [ ] Baskets in failed zone are stuck
- [ ] Other zones continue operating
- [ ] Baskets needing to cross failed zone are blocked
- [ ] Unit tests: multi-wagon failure isolation
- [ ] Verify: simulation shows zone isolation

### Task 12.3 — Failure consequence in simulation summary
- [ ] Simulation output includes:
  - `failures: { wagonId, timestamp, impact: 'line_stopped' | 'zone_isolated', stuckBaskets: number }`
- [ ] UI displays failure summary if any failures occurred
- [ ] Verify: failure consequences are visible in UI

---

## Phase 13: Basket vs Wagon Optimization  
*User story: [US-013](user_stories.md#us-013-basket-vs-wagon-optimization)*

### Task 13.0 — Basket count sweep analysis
- [ ] Run simulation at multiple basket counts (1 to configured max)
- [ ] Output throughput, violations, utilization for each count
- [ ] Show marginal improvement: how much throughput increases per additional basket
- [ ] Unit tests: sweep produces expected number of results
- [ ] Verify: sweep table is generated

### Task 13.1 — Wagon count sweep analysis
- [ ] Run simulation at multiple wagon counts (1 to configured max)
- [ ] Output throughput, violations, utilization for each count
- [ ] Show marginal improvement per additional wagon
- [ ] Unit tests: sweep produces expected results
- [ ] Verify: sweep shows wagon cost vs benefit

### Task 13.2 — Cost tradeoff recommendation
- [ ] Given relative cost ratio (basket_cost / wagon_cost), compute:
  - Throughput per cost unit for adding baskets
  - Throughput per cost unit for adding wagons
  - Recommended next investment
- [ ] Unit tests: recommendation matches expected cost analysis
- [ ] Verify: UI shows recommendation

---

## Phase 14: Charts & Operational Visibility  
*User story: [US-014](user_stories.md#us-014-charts--operational-visibility)*

### Task 14.0 — Corrected chart data sources
- [ ] Throughput chart uses simulated throughput (not target-capped)
- [ ] WIP chart shows actual basket count in system over time
- [ ] Timeline/Gantt shows accurate state durations
- [ ] Chart labels distinguish target vs simulated values
- [ ] Verify: charts reflect simulation output correctly

### Task 14.1 — Violation timeline chart
- [ ] New chart: violations over time
- [ ] Each violation is a marker at its timestamp
- [ ] Color-coded by type (over/under) and severity
- [ ] Verify: violation chart is populated

### Task 14.2 — Wagon activity timeline
- [ ] New chart: per-wagon activity timeline
- [ ] Shows when wagon is moving, waiting, blocked, handling
- [ ] Color-coded by activity type
- [ ] Verify: wagon timeline is populated

---

## Phase 15: Existing-Project Data Import  
*User story: [US-015](user_stories.md#us-015-existing-project-data-import)*

### Task 15.0 — Tank timing data import
- [ ] User can input tank dwell times from existing commissioned system
- [ ] Format: CSV or JSON with tank id, dwell time, tolerance, type
- [ ] Import populates tank configuration
- [ ] Unit tests: import parses correctly
- [ ] Verify: imported data appears in config panel

### Task 15.1 — Transporter sequence import
- [ ] User can input transporter movement sequence from existing system
- [ ] Format: CSV or JSON with timestamp, from, to, basket id
- [ ] Import is stored for validation comparison
- [ ] Unit tests: sequence import parses correctly
- [ ] Verify: imported sequence is stored

### Task 15.2 — Simulation validation against imported data
- [ ] Run simulation with imported configuration
- [ ] Compare simulation events against imported sequence
- [ ] Show match/mismatch count and details
- [ ] Unit tests: validation detects known mismatches
- [ ] Verify: validation report is generated

---

## Phase 16: Debugging & Explainability  
*User story: [US-016](user_stories.md#us-016-debugging--explainability)*

### Task 16.0 — Wagon decision log UI
- [ ] List all wagon assignments with:
  - Timestamp
  - Selected basket + urgency score
  - Rejected candidates + why not chosen
  - Travel time estimate
- [ ] Filterable by wagon, time range
- [ ] Verify: decision log is readable and accurate

### Task 16.1 — Violation cause display
- [ ] For each violation, show attributed cause
- [ ] Cause-based grouping: all violations caused by wagon unavailability, etc.
- [ ] Verify: violation causes are visible

### Task 16.2 — Bottleneck explanation panel
- [ ] When throughput is limited, show:
  - The bottleneck resource (wagon, tank, loading)
  - Its utilization
  - Its theoretical max throughput contribution
  - Recommended action (add wagon, reduce dwell, etc.)
- [ ] Verify: bottleneck panel is accurate
