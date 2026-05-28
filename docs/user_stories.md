# Flowlytics — User Stories

This file contains all user stories for the Flowlytics pretreatment transporter simulator.  
Each story was reviewed through DDD (Eric Evans), Refactoring (Martin Fowler), and TDD (Kent Beck) lenses before approval.

**Status legend:** `DRAFT` = not yet reviewed | `REVIEWING` = under review | `APPROVED` = ready to implement | `DONE` = implemented and verified

---

## US-001: Drawing & Station Detection

**Status:** `BACKLOG`  
**Parent phase:** [Phase 1 — Drawing & Station Detection](ordered_tasks.md#phase-1-drawing--station-detection)

### Review Gates
- [ ] **DDD** — *deferred*
- [ ] **Fowler** — *deferred*
- [ ] **TDD** — *deferred*

### Description
As a system designer, I want to upload a drawing/CAD file and detect stations, so I can configure the line without manually recreating the layout.

### Acceptance Criteria
*Deferred to backlog*

### Unit Test Specs
*Deferred to backlog*

---

## US-002: Tank Sequence & Configuration

**Status:** `DONE`  
**Parent phase:** [Phase 2 — Tank Sequence & Configuration](ordered_tasks.md#phase-2-tank-sequence--configuration)

### Review Gates
- [x] **DDD** — Domain concept: a *tank* is a process step with a *type* (chemical/rinse) and a *dwell time*. The *process sequence* is a domain invariant — baskets always flow LOAD → T1..TN → WDO → UNLOAD. Bounded context: recipe configuration.
- [x] **Fowler** — Incremental: `TankType` already existed in types. Added select dropdown column to existing tank table, read it in `readParamsFromUi`. Removed the apply-to-all button. No simulation engine changes needed.
- [x] **TDD** — 7 new layout tests cover preset defaults, tank type, per-tank dwell, WDO/LOAD/UNLOAD dwell. 36 total tests pass.

### Description
As a system designer, I want to classify each tank as chemical or rinse and set per-tank dwell times, so the simulation applies appropriate tolerance defaults and reflects the real process.

### Acceptance Criteria
1. Tank table shows three columns: Station ID (read-only), Type (dropdown: chemical/rinse), Dwell (min) (editable number)
2. Both recipe presets (MS, AL) default all tanks to chemical
3. User can override per-tank type independently
4. Per-tank dwell is independently editable
5. LOAD, WDO, UNLOAD are always stations — never appear in the tank table
6. Apply-to-all button was removed
7. Tank type is wired into simulation's `RecipeStep.tankType` and accessible in output

### Unit Test Specs
1. `defaultRecipe("ms", 6)` — correct step count, dwell 150s, all chemical ✓
2. `defaultRecipe("al", 6)` — dwell 90s, all chemical ✓
3. LOAD and UNLOAD have 0 dwell ✓
4. WDO has 600s dwell ✓

---

## US-003: Tolerance by Tank Type

**Status:** `DONE`  
**Parent phase:** [Phase 3 — Tolerance by Tank Type](ordered_tasks.md#phase-3-tolerance-by-tank-type)

### Review Gates
- [x] **DDD** — Domain concept: tolerance is the acceptable dwell window. Chemical tanks (±10%) are tight (over-dwell causes surface defects); rinse tanks (±50%) are wide. The process engineer knows which tanks are critical.
- [x] **Fowler** — Incremental: added tolerance column to existing tank table; `defaultRecipe` sets tolerance from `tankType`; simulation reads per-tank `tolerancePct` from each `RecipeStep` instead of a global param; added under-dwell detection; removed global tolerance input and its `SimParams`/`UiElements` field.
- [x] **TDD** — 2 new layout tests (default 10% tolerance, non-tank steps have none). Simulation test overrides per-tank tolerance via `recipeSteps` instead of global param. 38 total tests pass.

### Description
As a system designer, I want tank-specific tolerance windows, so the simulation reflects chemical vs rinse process differences.

### Acceptance Criteria
1. Tank table shows four columns: Step, Type, Dwell (min), Tolerance (±%)
2. Chemical tanks default to ±10%; rinse tanks default to ±50%
3. User can override per-tank tolerance independently
4. Simulation uses per-tank tolerance (not global) for dwell window checks
5. Both over-dwell and under-dwell are detected
6. Global tolerance field removed from config panel
7. No violation when basket exits within its per-tank tolerance window

---

## US-004: PLC-Style State Tracking

**Status:** `DONE`  
**Parent phase:** [Phase 4 — PLC-Style State Tracking](ordered_tasks.md#phase-4-plc-style-state-tracking)

### Review Gates
- [x] **DDD** — Basket lifecycle maps to PLC states: WAITING_LOAD → LOADING → IN_TANK → READY_FOR_PICKUP → IN_TRANSIT → (repeat) → WAITING_UNLOAD → UNLOADING → DONE. Each state corresponds to a physical or control activity.
- [x] **Fowler** — Incremental: formal state machine via `@xstate/fsm` library; `transitionBasketWithLog()` replaces ad-hoc `b.currentState = "..."` at 9 transition sites; `stateHistory` logging added to each Basket; `elapsedInState` computed in output. No architectural changes.
- [x] **TDD** — 13 new basketStateMachine tests (all state transitions, full lifecycle, transition logging). 2 new simulation tests: stateHistory populated on all baskets, elapsedInState computed correctly. 53 total tests pass.

### Description
As a system designer, I want the system to track basket location, timing, and completion state through a formal state machine, so the software mirrors how the control program operates.

### Acceptance Criteria
1. Basket lifecycle follows WAITING_LOAD → LOADING → READY_FOR_PICKUP → IN_TRANSIT → IN_TANK → READY_FOR_PICKUP → ... → WAITING_UNLOAD → UNLOADING → DONE
2. States are defined via `@xstate/fsm` with explicit event transitions. No manual `currentState =` assignments remain.
3. `stateHistory` on each Basket records `{timestamp, fromState, toState, reason}` for every transition
4. `elapsedInState` on each Basket is computed as `simEnd - stateEnteredAt`
5. Invalid transitions are rejected by the state machine
6. Wagon can pick up directly from IN_TANK (before dwell completes)

---

## US-005: Multi-Basket Modeling

**Status:** `DRAFT`  
**Parent phase:** [Phase 5 — Multi-Basket Modeling](ordered_tasks.md#phase-5-multi-basket-modeling)

### Description
As a system designer, I want to simulate multiple baskets in the same line, so I can test realistic parallel operation.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-006: Loading-Complete Signal

**Status:** `DRAFT`  
**Parent phase:** [Phase 6 — Loading-Complete Signal](ordered_tasks.md#phase-6-loading-complete-signal)

### Description
As a system designer, I want basket movement to begin only after a loading-complete signal, so the simulation matches the control logic.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-007: Wagon Scheduling & Dispatch Priority

**Status:** `DRAFT`  
**Parent phase:** [Phase 7 — Wagon Scheduling & Dispatch Priority](ordered_tasks.md#phase-7-wagon-scheduling--dispatch-priority)

### Description
As a system designer, I want the wagon to prioritize baskets whose tank timing has completed, so the line minimizes dwell-time violations.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-008: Violation Detection

**Status:** `DRAFT`  
**Parent phase:** [Phase 8 — Violation Detection](ordered_tasks.md#phase-8-violation-detection)

### Description
As a system designer, I want the system to detect when a basket overstays in a tank beyond tolerance, so I can identify quality or scheduling issues.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-009: Throughput Simulation

**Status:** `DRAFT`  
**Parent phase:** [Phase 9 — Throughput Simulation](ordered_tasks.md#phase-9-throughput-simulation)

### Description
As a system designer, I want the system to calculate achievable throughput, so I can judge whether the line meets expected production output.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-010: Wagon Utilization & Idle Analysis

**Status:** `DRAFT`  
**Parent phase:** [Phase 10 — Wagon Utilization & Idle Analysis](ordered_tasks.md#phase-10-wagon-utilization--idle-analysis)

### Description
As a system designer, I want wagon utilization and idle analysis, so I can understand whether wagons are the real bottleneck.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-011: Multi-Wagon Zone Support

**Status:** `DRAFT`  
**Parent phase:** [Phase 11 — Multi-Wagon Zone Support](ordered_tasks.md#phase-11-multi-wagon-zone-support)

### Description
As a system designer, I want to model multiple wagons handling different tank ranges with a shared handoff station, so I can simulate larger real-world lines.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-012: Failure Handling

**Status:** `DRAFT`  
**Parent phase:** [Phase 12 — Failure Handling](ordered_tasks.md#phase-12-failure-handling)

### Description
As a system designer, I want the system to represent wagon failure scenarios, so I can understand failure impact on the line.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-013: Basket vs Wagon Optimization

**Status:** `DRAFT`  
**Parent phase:** [Phase 13 — Basket vs Wagon Optimization](ordered_tasks.md#phase-13-basket-vs-wagon-optimization)

### Description
As a system designer, I want to compare adding baskets versus adding wagons, so I can improve throughput with the lower-cost option first.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-014: Charts & Operational Visibility

**Status:** `DRAFT`  
**Parent phase:** [Phase 14 — Charts & Operational Visibility](ordered_tasks.md#phase-14-charts--operational-visibility)

### Description
As a system designer, I want charts that correctly represent throughput, WIP, and timeline behavior, so I can trust the outputs when reviewing performance.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-015: Existing-Project Data Import

**Status:** `DRAFT`  
**Parent phase:** [Phase 15 — Existing-Project Data Import](ordered_tasks.md#phase-15-existing-project-data-import)

### Description
As a system designer, I want to input timing data and transporter sequences from commissioned systems, so I can validate the simulator against real installations.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-016: Debugging & Explainability

**Status:** `DRAFT`  
**Parent phase:** [Phase 16 — Debugging & Explainability](ordered_tasks.md#phase-16-debugging--explainability)

### Description
As a system designer, I want the simulator to explain why it made a scheduling decision or failed to achieve throughput, so I can debug configuration and logic issues faster.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*
