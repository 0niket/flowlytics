# Flowlytics — User Stories

This file contains all user stories for the Flowlytics pretreatment transporter simulator.  
Each story was reviewed through DDD (Eric Evans), Refactoring (Martin Fowler), and TDD (Kent Beck) lenses before approval.

**Status legend:** `DRAFT` = not yet reviewed | `REVIEWING` = under review | `APPROVED` = ready to implement | `DONE` = implemented and verified

---

## US-001: Drawing & Station Detection

**Status:** `DRAFT`  
**Parent phase:** [Phase 1 — Drawing & Station Detection](ordered_tasks.md#phase-1-drawing--station-detection)

### Description
As a system designer, I want to upload a drawing/CAD file and detect stations, so I can configure the line without manually recreating the layout.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-002: Tank Sequence & Configuration

**Status:** `DRAFT`  
**Parent phase:** [Phase 2 — Tank Sequence & Configuration](ordered_tasks.md#phase-2-tank-sequence--configuration)

### Description
As a system designer, I want to define the tank sequence, tank type, and dwell timing, so the simulation matches the real process flow.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-003: Tolerance by Tank Type

**Status:** `DRAFT`  
**Parent phase:** [Phase 3 — Tolerance by Tank Type](ordered_tasks.md#phase-3-tolerance-by-tank-type)

### Description
As a system designer, I want tank-specific tolerance windows, so the system reflects the difference between chemical and rinse processes.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

---

## US-004: PLC-Style State Tracking

**Status:** `DRAFT`  
**Parent phase:** [Phase 4 — PLC-Style State Tracking](ordered_tasks.md#phase-4-plc-style-state-tracking)

### Description
As a system designer, I want the system to track basket location, timing, and completion state, so the software mirrors how the control program operates.

### Acceptance Criteria
*TBD during review*

### Unit Test Specs
*TBD during review*

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
