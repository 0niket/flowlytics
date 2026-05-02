# UX Refactor Plan: Flowlytics Pretreatment Simulator

## Problem Analysis

The current UX has several structural issues that prevent users from focusing on what matters:

1. **Results are buried** — The Results panel is sticky in the sidebar but competes with configuration inputs for attention. The most important output (throughput, bottlenecks, violations) is small text crammed into a narrow 380px sidebar.

2. **Configuration is scattered** — Recipe, Wagon, and Layout settings are separate sidebar sections with no clear hierarchy. Users must scroll to find related parameters.

3. **No per-component metrics** — There's no per-tank utilization, no per-station dwell analysis, no loading queue depth over time. Users can't drill into individual component performance.

4. **Loading/inventory optimization is invisible** — Loading queue buildup, basket arrival rate impact, and manual handling bottlenecks have no dedicated visibility.

5. **Simulation visualization is opt-in** — The canvas is hidden by default behind an empty state. The most informative view requires clicking through.

6. **Flat information architecture** — Everything is at the same visual weight. No dashboard-style overview with drill-down.

---

## Design Principles for Refactor

1. **Results first, configuration second** — The main area should show metrics/dashboard. Configuration lives in a collapsible sidebar or panel.
2. **Important things in focus** — Key metrics (throughput, bottleneck, violations) get large, prominent treatment at the top.
3. **Per-component drill-down** — Each station/tank/wagon gets its own utilization and performance metrics.
4. **Loading inventory visibility** — Dedicated section for loading queue analysis and manual operation impact.

---

## New Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TOPBAR: Project name | Mode toggle | Run Sim | Export       │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  CONFIG      │   MAIN DASHBOARD                             │
│  PANEL       │                                              │
│  (320px,     │   ┌─────────────────────────────────────┐    │
│  collapsible)│   │  KPI CARDS (large, prominent)       │    │
│              │   │  Throughput | Lead Time | Violations │    │
│  - Recipe    │   │  Bottleneck | Target Delta          │    │
│  - Wagon     │   └─────────────────────────────────────┘    │
│  - Load/     │                                              │
│    Unload    │   ┌───────────────────┬─────────────────┐    │
│  - Timing    │   │ LINE VISUALIZATION│ COMPONENT       │    │
│              │   │ (inline, always   │ METRICS         │    │
│              │   │  visible, compact)│ (tabbed panel)  │    │
│              │   │                   │                  │    │
│              │   │  Canvas with      │ - Stations      │    │
│              │   │  tank/station     │ - Wagons        │    │
│              │   │  layout           │ - Loading Queue  │    │
│              │   │                   │ - Timeline       │    │
│              │   └───────────────────┴─────────────────┘    │
│              │                                              │
│              │   ┌─────────────────────────────────────┐    │
│              │   │  SCENARIO COMPARISON (bottom)       │    │
│              │   └─────────────────────────────────────┘    │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│ STATUS BAR: Sim status | Playback controls | Speed          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Restructure HTML layout

**What changes:**
- Move from `sidebar (380px) + main` to `config-panel (320px, collapsible) + dashboard`
- Add a collapse/expand button for the config panel
- Main area becomes a vertical stack: KPI cards → content area → status bar
- Content area splits into visualization (left) + component metrics (right)

**Files:** `index.html`, `styles.css`

### Step 2: Build KPI cards row

**What changes:**
- Create 5 large, prominent metric cards at the top of the dashboard:
  1. **Throughput** — achieved vs target, with delta badge (large number)
  2. **Avg Lead Time** — formatted prominently
  3. **Violations** — count with severity indicator
  4. **Bottleneck** — identified constraint with explanation
  5. **Wagon Utilization** — average across all wagons
- Each card is a colored card with large mono number + label + context
- Cards update reactively when simulation runs

**Files:** `index.html`, `styles.css`, `app.js` (updateResults function)

### Step 3: Make visualization always visible (compact)

**What changes:**
- Remove the empty state / "Show Simulation" flow
- Canvas is always visible in the content area (left side), just smaller
- Remove the toggle show/hide pattern — simulation is always rendered
- Playback controls move to a slim status bar at the bottom
- Canvas auto-sizes to its container

**Files:** `index.html`, `styles.css`, `app.js` (initUi, setSimulationVisible, renderFrame)

### Step 4: Build Component Metrics panel (tabbed)

**What changes:**
- Add a tabbed panel to the right of the canvas with tabs:
  - **Stations** — per-tank/station utilization table with bars, dwell time, occupancy, violation count per station
  - **Wagons** — per-wagon utilization, busy time, idle time, zone info
  - **Loading** — loading queue depth, manual handling time breakdown, arrival rate vs processing rate, queue wait distribution
  - **Timeline** — the existing throughput/WIP/Gantt charts, moved here

**New simulation metrics needed in `app.js`:**
- Per-tank utilization (track occupancy time / sim duration for each tank)
- Loading queue depth over time (already tracked in snapshots as LOADQ)
- Per-station violation count (already available in violations array)
- Loading wait time (time baskets spend in queue before loading starts)

**Files:** `index.html`, `styles.css`, `app.js` (runSimulation output, new render functions)

### Step 5: Enhance simulation engine for per-component metrics

**What changes to `runSimulation`:**
- Track per-tank occupancy duration (add/remove timestamps → compute utilization)
- Track loading queue wait times (basket creation → load_done start)
- Track per-station dwell actual vs target (for a dwell compliance table)
- Add station utilization to the output: `util.stations: [{id, util01, avgDwell, violations}]`
- Add loading metrics: `loading: {avgQueueWait, maxQueueDepth, avgQueueDepth, processingUtil}`

**Files:** `app.js` (runSimulation function, makeResources, event handlers)

### Step 6: Reorganize config panel

**What changes:**
- Group configuration into collapsible sections with clear headers:
  1. **Process Recipe** — preset, tank count, dwell times, WDO, tolerance
  2. **Manual Operations** — load time, unload time, drip time (these are the "inventory optimization" levers)
  3. **Transport** — wagon count, speed, lift/lower, pick/drop
  4. **Simulation** — target BPH, duration, auto-run
- Each section has a compact summary line when collapsed (e.g., "12 tanks, 2.5m dwell, MS preset")
- Move scenario compare out of sidebar into the main dashboard bottom area

**Files:** `index.html`, `styles.css`

### Step 7: Scenario comparison in dashboard

**What changes:**
- Move scenario comparison from sidebar to a dedicated section at the bottom of the dashboard
- Support saving up to 3 scenarios (A, B, C) instead of just A
- Side-by-side cards showing all key metrics per scenario
- Highlight which parameters differ between scenarios
- Visual delta indicators (arrows, color coding)

**Files:** `index.html`, `styles.css`, `app.js` (scenario state, render functions)

### Step 8: Loading queue analysis view

**What changes in the "Loading" tab of Component Metrics:**
- **Queue depth chart** — loading queue depth over simulation time (from snapshots)
- **Arrival vs capacity** — visual showing basket arrival rate vs loading processing rate
- **Wait time histogram** — distribution of basket wait times at loading
- **Manual time breakdown** — pie/bar showing load time vs unload time vs total manual
- **Optimization hints** — if loading is bottleneck, show: "Loading utilization at X%. Consider: offline basket prep, reduce load time from Ym to Zm, add parallel loading"

**Files:** `index.html`, `styles.css`, `app.js` (new rendering functions, enhanced sim output)

### Step 9: Visual polish and responsiveness

**What changes:**
- Ensure the dashboard works at different screen widths
- Add smooth transitions for panel collapse/expand
- Consistent card styling for KPI cards and metric panels
- Better color system for utilization bars (green → yellow → red gradient based on %)
- Loading state while simulation runs (for larger configs)

**Files:** `styles.css`

### Step 10: Export and presentation mode update

**What changes:**
- Presentation mode now shows the dashboard view with larger KPI cards and the visualization
- Hides configuration panel entirely in presentation mode
- Export generates a more comprehensive summary including per-component metrics
- Add "Copy metrics table" for pasting into spreadsheets

**Files:** `index.html`, `styles.css`, `app.js`

---

## Key Simulation Engine Changes (Step 5 detail)

```javascript
// New tracking structures in runSimulation:

// Per-tank occupancy tracking
const tankOccupancy = {}; // {tankId: {totalOccupiedSec: 0, entries: [{start, end}]}}

// Loading queue tracking
const loadingMetrics = {
  queueWaits: [],        // time each basket waited in queue
  maxQueueDepth: 0,
  queueDepthSamples: [], // {t, depth} sampled every snapshot
};

// Per-station dwell compliance
const dwellCompliance = {}; // {stationId: {count: 0, totalActual: 0, violations: 0}}

// New output shape additions:
return {
  ...existingOutput,
  util: {
    wagons: [...],
    stations: [{ id, util01, avgDwellSec, targetDwellSec, violationCount }],
  },
  loading: {
    avgQueueWaitSec,
    maxQueueDepth,
    processingUtil01,
    queueDepthOverTime: [{t, depth}],
  },
};
```

---

## File Change Summary

| File | Changes |
|------|---------|
| `web/index.html` | Major restructure — new layout grid, KPI cards, tabbed metrics panel, reorganized config, scenario section |
| `web/styles.css` | New styles for KPI cards, tabs, component metrics, collapsible config, responsive layout |
| `web/app.js` | Enhanced simulation output, new render functions for component metrics, loading analysis, restructured updateResults, scenario comparison |

---

## What stays the same

- Simulation engine core logic (event loop, dispatch, dwell tracking)
- Canvas rendering approach (Canvas 2D)
- DXF integration
- Dark theme aesthetic
- No framework — stays vanilla JS/HTML/CSS
- Auto-run behavior

---

## Execution Order

Steps 1–3 first (structural layout change + KPI cards + inline visualization). This delivers the biggest UX improvement.

Steps 4–5 next (component metrics + engine enhancements). This adds the drill-down capability.

Steps 6–8 next (config reorg + scenario + loading analysis). This completes the feature set.

Steps 9–10 last (polish + export). Final refinements.
