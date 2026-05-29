# Plan: Builder + Sidebar Redesign

## 1. Vision

Replace the current DXF/DWG file-upload wizard with an interactive **Builder** that guides the user through explicitly configuring every aspect of the pretreatment line — one step at a time. The Builder produces the same `SimParams` + `Layout` that the simulation engine already consumes, so no engine changes are needed.

**Why?** Accuracy over convenience. A CAD file may be incomplete, outdated, or mislabeled. Human-specified inputs eliminate guesswork and build user confidence.

**What is "Builder"?** An interactive setup wizard that lets you build an assembly line step-by-step: declare stations with their types and sequence; configure transport (split into individual motions); set targets. After initial setup, the **sidebar remains live-editable** for routine tuning.

---

## 2. Three Pillars of the Redesign

Three domain changes (from the diagrams) drive everything:

### 2.1 Article Material Type (replaces Recipe Preset)

| Current | New |
|---------|-----|
| `<select>` with 3 options: ms / al / custom | Searchable combobox with 10+ named materials |
| `preset` drives dwell defaults | Material type is a label — **same defaults for all materials** |
| No "Article" concept | Article = manufactured part in the basket. Article Material Type is a primary config input. |

The material selection is a **searchable combobox** (input + datalist) with common industrial materials: Mild Steel, Aluminium, Stainless Steel, Galvanised Steel, Cast Iron, Brass, Copper, Zinc Die Cast, HSS, Other. All materials use the **same default dwell (2.5 min) and tolerance (10%)**. Selection is about correct labeling, not per-material defaults.

### 2.2 Station Type Taxonomy

Every station in the line carries a **declared type** that drives what parameters are shown and what simulation rules apply:

| Station Type | Parameters | Violation model |
|---|---|---|
| **Loading** | Loading time, Max loading time | Max-time violation |
| **Chemical Tank** | Dwell, Tolerance | Over/under-dwell via tolerance window |
| **Rinse Tank** | Dwell, Tolerance | Over/under-dwell via tolerance window |
| **Extra Tank** | (no params yet — placeholder) | None |
| **WDO (Water Drying Oven)** | Drying time, Max drying time | Max-time violation |
| **Unloading** | Unloading time, Max unloading time | Max-time violation |

Key change: Loading, Unloading, and WDO gain max-time parameters, extending the violation model to **all** stations (currently only tanks have violations). `Extra tank` is a named extension point for future use.

### 2.3 Transport Domain Redesign

| Current (combined) | New (split) | Purpose |
|---|---|---|
| `liftLowerSec` | `liftSec` + `dripSec` + `lowerSec` | Drip is a sub-phase of Lift — the basket pauses at height to drain before travel |
| `pickDropSec` | `pickSec` + `dropSec` | Pick (clamp/grab) and Drop (release) are asymmetric operations |
| — | `maxWeightKg` (optional) | Rated basket gross weight limit |
| — | `articleWeightKg` (optional) | Weight of one article/part |
| — | `maxArticlesPerBasket` (optional) | Fixture capacity — unlocks `articles/hr` and `kg/hr` metrics |

Transport becomes a nested `TransportConfig` type inside `SimParams`.

---

## 3. Builder Flow (4 Steps)

### Step 1: Station Builder (Visual Lane Diagram)

```
[LOAD] → [T1] → [T2] → [WDO] → [UNLOAD]
```

- LOAD and UNLOAD are fixed endpoints
- Click `[+]` between stations to insert a new tank
- **Each station has a type selector** — click a tile to set its type (Chemical Tank, Rinse Tank, Extra Tank, WDO). LOAD and UNLOAD have fixed types.
- **Type-driven parameters** — when a type is selected, the correct parameter fields appear:
  - Chemical/Rinse: dwell (min), tolerance (±%, advanced)
  - Extra tank: no parameters (placeholder state)
  - WDO: drying time (min), max drying time (min, optional/advanced)
  - LOAD: loading time (min), max loading time (min, optional/advanced)
  - UNLOAD: unloading time (min), max unloading time (min, optional/advanced)
- **Article Material Type** selector at the top of the step (searchable combobox)
- Tank label (optional): e.g. "Zinc Phosphate"
- Color-coded tiles: Chemical=amber, Rinse=blue, WDO=gray, Extra=dashed border
- Live cycle estimate in step header
- WDO auto-positions after last tank. `[+]` not shown after WDO.
- Minimum 1 tank

**Collapsed tile:**
```
┌───────────────────┐
│  T3  ● Chemical   │
│      2.5 min      │
└───────────────────┘
```

### Step 2: Transport

```
--- Wagons ---
# Wagons:      [1]      (1+)
Speed (m/min): [18]     (1+)
Lift (sec):    [10]     (0+)    — upward hoist
Drip (sec):    [5]      (0+)    — pause at height after lift
Lower (sec):   [10]     (0+)    — downward immersion
Pick (sec):    [6]      (0+)    — clamp/grab attachment
Drop (sec):    [4]      (0+)    — release

--- Baskets (optional) ---
Max weight per basket (kg):    [ ]    — rated limit
Article weight (kg):           [ ]    — per part
Max articles per basket:       [ ]    — fixture capacity
```

- Split lift/lower and pick/drop into individual fields
- Drip shown as a child of Lift (grouped visually: Lift → Drip → Lower)
- Basket section collapsed by default under "Configure basket payload"
- Distance model hidden under "Advanced" (default: Rail/Manhattan)

### Step 3: Run Settings

```
--- Line Capacity ---
Concurrent baskets (in-flight): [2]   (1–20)
*How many baskets the line holds simultaneously.*

--- Run Settings ---
Article Material Type:  [Mild Steel ▼]  (searchable combobox)
Target throughput:      [2.0]           (baskets/hr)
Sim duration:           [2 hr]          (collapsed under Advanced)
```

- Article material type is repeated here for visibility (primary config input)
- Same combobox as Step 1; changes sync

### Step 4: Review & Run

- Full summary with inline editing (pencil icons turn fields into inline inputs)
- Station sequence: mini non-interactive lane diagram (colored, with types shown)
- Transport summary with split times shown
- Basket payload summary (if configured)
- "Run Simulation" CTA (disabled until valid)
- "Edit line structure" → reopens Step 1 with pre-filled data

---

## 4. Sidebar Redesign

The sidebar becomes the **primary permanent editing surface** after the Builder is dismissed.

### 4.1 Layout and Order

```
┌────────────────────────────┐
│ [Edit line structure] btn   │  ← reopens Builder Step 1
├────────────────────────────┤
│ Article Material Type      │  ← searchable combobox, always visible
│ [Mild Steel ▼............] │
├────────────────────────────┤
│ Station Sequence           │  ← mini lane diagram (read-only, colored)
│ [LOAD] → [T1] → [T2] → ...│
├────────────────────────────┤
│ Per-Station Parameters     │  ← type-driven, one collapsible per station
│ ▼ T1 (Chemical)            │
│   Dwell: [2.5] min         │
│   Tolerance: [10] %        │
│ ▼ T2 (Rinse)               │
│   Dwell: [1.0] min         │
│   Tolerance: [50] %        │
│ ▼ WDO                      │
│   Drying time: [10] min    │
│   Max drying: [15] min     │
│ ▼ LOAD                     │
│   Loading time: [20] min   │
│   Max loading: [30] min    │
│ ▼ UNLOAD                   │
│   Unloading: [10] min      │
│   Max unload: [15] min     │
├────────────────────────────┤
│ Transport                  │
│ # Wagons: [1]   Speed: [18]│
│ Lift [10] Drip [5] Lwr [10]│
│ Pick [6]  Drop [4]         │
│ [▸ Basket payload]         │  ← collapsed section
├────────────────────────────┤
│ Run Settings               │
│ Baskets: [2]  Target: [2.0]│
│ Duration: [2 hr]           │
└────────────────────────────┘
```

### 4.2 Key Behaviors

- **Any field change triggers recompute** (if auto-run is on)
- **Per-station parameters are type-driven** — changing a tank's type from Chemical to Extra hides dwell/tolerance and shows an "Extra tank (no params)" label
- **"Edit line structure"** reopens the Builder modal pre-filled with current config — for structural changes (add/remove tanks, reorder, change station types en masse)
- **Auto-save to localStorage** on every change (debounced 500ms)
- **Mini lane diagram** at the top gives spatial context while editing individual stations

---

## 5. Type Changes (`src/types.ts`)

### Additions

```typescript
// Station type taxonomy
export type TankType = "chemical" | "rinse" | "extra";

// Article material type (searchable combobox values)
export type ArticleMaterialType =
  | "mild_steel" | "aluminium" | "stainless_steel" | "galvanised_steel"
  | "cast_iron" | "brass" | "copper" | "zinc_die_cast" | "hss" | "other";

// Max-time params on RecipeStep (for LOAD, UNLOAD, WDO violation model)
export interface RecipeStep {
  // ... existing fields ...
  maxDwellSec?: number;  // new — for max-time violations on all station kinds
}

// Transport as nested config
export interface TransportConfig {
  wagonCount: number;
  wagonSpeedMPerMin: number;
  liftSec: number;
  dripTimeSec: number;
  lowerSec: number;
  pickSec: number;
  dropSec: number;
  distanceMode: DistanceMode;
  basketCapacity?: {
    maxWeightKg: number;
    articleWeightKg: number;
    maxArticlesPerBasket: number;
  };
}

// SimParams gets transport field, articleMaterialType
export interface SimParams {
  // ... existing fields ...
  articleMaterialType: ArticleMaterialType;  // replaces preset
  transport: TransportConfig;                 // replaces flat fields
  maxLoadTimeMin?: number;
  maxUnloadTimeMin?: number;
  maxWdoTimeMin?: number;
}
```

### Removals

```typescript
// Remove
export interface DxfLabel { ... }
export interface StationLabel { ... }
export interface StationValidation { ... }
// From UiElements: fetchDxfBtn, loadFilesBtn, layoutMode, layoutStatus
// From AppState: dxfLabelsRows, detectedStations
```

---

## 6. UI Elements (`src/types.ts UiElements`)

### Additions/Changes

```typescript
export interface UiElements {
  // Replace
  recipePreset: HTMLInputElement;  // was HTMLSelectElement — now a combobox input

  // Split transport fields
  liftSec: HTMLInputElement;
  dripTimeSec: HTMLInputElement;   // already exists
  lowerSec: HTMLInputElement;
  pickSec: HTMLInputElement;
  dropSec: HTMLInputElement;

  // Max-time fields
  maxLoadTimeMin: HTMLInputElement;
  maxUnloadTimeMin: HTMLInputElement;
  maxWdoTimeMin: HTMLInputElement;

  // Basket payload
  maxWeightKg: HTMLInputElement;
  articleWeightKg: HTMLInputElement;
  maxArticlesPerBasket: HTMLInputElement;

  // Removals
  // fetchDxfBtn, loadFilesBtn, layoutMode, layoutStatus — removed
}
```

---

## 7. TDD Approach

### New Tests (`src/builder/builder.test.ts`)

| Test | What it verifies |
|------|-----------------|
| `builder starts with default line` | Initial state: LOAD + 1 Chemical tank + UNLOAD, sensible defaults |
| `addTank inserts at correct position` | Insert at index 1 → correct ordering |
| `removeTank removes correct tank` | Removes at index, remaining tanks re-indexed |
| `removeLastTank rejected` | Cannot go below 1 tank |
| `setStationType updates parameter form` | Changing Chemical to Rinse preserves dwell, changes default tol to 50% |
| `setStationTypeToExtra hides params` | Extra tank → dwell/tolerance disabled/hidden |
| `setMaxTimeOnLoadUnloadWdo` | Max-time values stored correctly |
| `toggleWDORemovesOrAddsWdoStep` | Toggle off → WDO removed. Toggle on → after last tank |
| `wdoShiftsRightOnTankInsert` | Inserting tank before WDO shifts WDO right |
| `articleMaterialType round-trips` | Selecting from combobox stores the correct type |
| `transportSplitFieldsAccumulate` | liftSec, dripSec, lowerSec, pickSec, dropSec stored individually |
| `basketPayloadOptional` | Basket capacity section can be left empty (all undefined) |
| `toSimParams produces valid object` | All fields present, valid ranges |
| `toLayout produces valid Layout` | All expected nodes including correct types |
| `fromSimParams pre-fills builder` | Existing config re-populates all steps |
| `auto-save/restore partial draft` | Save after Step 2 → restore → resume at Step 3 |
| `auto-save/restore completed config` | Full save → reload → restore exact match |

### Existing Tests

- All 106 tests pass unchanged
- Only DXF/detector tests are removed

---

## 8. Refactoring Plan

### 8.1 New Files

```
src/builder/LineConfig.ts      ~100 lines — LineConfig type, createDefault(), toSimParams(), toLayout()
src/builder/LineConfig.test.ts ~80 lines  — Serialization, defaults, round-trip tests
src/builder/builder.ts          ~180 lines — State machine: steps, transitions, accumulator, fromSimParams()
src/builder/builder.test.ts     ~180 lines — Unit tests for state machine
src/builder/renderer.ts         ~400 lines — DOM rendering: lane builder, transport form, run settings form, review page
src/builder/persistence.ts      ~40 lines  — localStorage save/restore
src/builder/persistence.test.ts ~30 lines  — Persistence round-trip

src/materials/data.ts           ~30 lines  — Static list of material type labels (plain data, no per-material defaults)
```

### 8.2 Modified Files

```
src/types.ts:
  - Add: ArticleMaterialType, TransportConfig, maxDwellSec on RecipeStep
  - Add: articleMaterialType, transport, max*TimeMin to SimParams
  - Add: liftSec, lowerSec, pickSec, dropSec, max* inputs to UiElements
  - Change: recipePreset to HTMLInputElement
  - Remove: DxfLabel, StationLabel, StationValidation
  - Remove: fetchDxfBtn, loadFilesBtn, layoutMode, layoutStatus from UiElements
  - Remove: dxfLabelsRows, detectedStations from AppState

src/ui/state.ts:
  - Remove: fetchDxfBtn, loadFilesBtn, layoutMode, layoutStatus bindings
  - Remove: dxfLabelsRows, detectedStations from AppState initial
  - Change: recipePreset type to HTMLInputElement

src/ui/config.ts:
  - readParamsFromUi(): read split transport fields, article material type, max-time params, remove DXF branching
  - updateLayout(): always buildSyntheticLayout(), remove DXF conditional
  - rebuildTankTable(): add Extra option to type selector, disable dwell/tol when Extra selected
  - Sidebar: restructure into sections matching the new layout (Article Material Type, Station Sequence with per-station params, Transport, Run Settings)
  - Add mini lane diagram rendering
  - Add max-time input fields for LOAD/UNLOAD/WDO
  - Replace recipePreset handler with combobox logic

src/engine/layout.ts:
  - defaultRecipe(): accept ArticleMaterialType (all materials use same defaults), accept transport params for dwellSec on LOAD/UNLOAD
  - Remove: buildLayoutFromDxfLabels()

src/engine/simulation.ts:
  - Accept split transport fields in transfer time calculations
  - Detect max-time violations at LOAD, UNLOAD, WDO stations (not just tanks)
  - Extra tank: no violation detection (passthrough)

src/main.ts:
  - Change: import "./ui/wizard" → "./builder/renderer"
  - initStartupModal() → initBuilder()

index.html:
  - Replace startup wizard modal with builder modal (4-step containers + lane builder)
  - Remove: DXF drop zone, file picker, modal status, step indicators
  - Remove from sidebar: layoutMode select, fetchDxfBtn, loadFilesBtn, layoutStatus
  - Add: combobox for article material, split transport inputs, max-time inputs, per-station parameter sections
  - Add: "Edit line structure" button
```

### 8.3 Removed Files

```
src/dxf/parser.ts
src/dxf/parser.test.ts
src/dxf/detector.ts
src/dxf/detector.test.ts
src/ui/wizard.ts
scripts/serve_convert.py
assets/cad/  (entire directory)
```

### 8.4 Migration Path

1. **Phase A** — Implement `src/builder/` with state machine + tests alongside existing wizard (gated). No sidebar changes yet.
2. **Phase B** — Swap `index.html` modal. Remove old wizard. Delete `src/dxf/`, `scripts/`, `assets/`.
3. **Phase C** — Restructure sidebar (`config.ts`) with new layout, split fields, per-station parameter sections.
4. **Phase D** — Update engine for max-time violations. Clean up types and dead code. Final test pass.

---

## 9. HTML Structure Changes

### Builder Modal (4-step container)

```html
<div class="modal-overlay" id="builderModal">
  <div class="modal">
    <div class="modal__header">
      <div class="modal__title">Line Builder</div>
      <div class="step-indicator">
        <span class="step-dot step-dot--active" data-step="1">1</span>
        <span class="step-dot" data-step="2">2</span>
        <span class="step-dot" data-step="3">3</span>
        <span class="step-dot" data-step="4">4</span>
      </div>
    </div>

    <!-- Step 1: Station Builder -->
    <div class="builder-step" id="builderStep1">
      <div class="builder-step__header">
        <div class="builder-step__title">Station Sequence</div>
        <div class="builder-step__hint">Estimated cycle: <span id="cycleEstimate">18.5 min</span></div>
      </div>
      <div class="builder-step__body">
        <div class="lane-builder" id="laneBuilder"><!-- rendered by JS --></div>
      </div>
      <div class="builder-nav">
        <button class="btn" id="builderNext1" disabled>Next →</button>
      </div>
    </div>

    <!-- Step 2: Transport -->
    <div class="builder-step" id="builderStep2" hidden>
      ...
    </div>

    <!-- Step 3: Run Settings -->
    <div class="builder-step" id="builderStep3" hidden>
      ...
    </div>

    <!-- Step 4: Review -->
    <div class="builder-step" id="builderStep4" hidden>
      ...
    </div>
  </div>
</div>
```

### Sidebar Sections

The sidebar keeps its existing `aside.config-panel` wrapper but inner sections are restructured. Each station gets a `details` section with type-labeled header and type-driven parameter inputs.

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Lane builder is unfamiliar** | Common pattern (form builders, pipeline UIs). Prototype-test with 1 user. |
| **Sidebar restructuring breaks existing flow** | Sidebar still has all the same inputs — just reorganized + split fields. No data loss. |
| **Split transport fields change total transfer time** | Defaults sum to original values: `liftSec + dripSec + lowerSec = liftLowerSec`, `pickSec + dropSec = pickDropSec`. No regression. |
| **Extra tank type not used yet** | Implementation treats it as a no-parameter placeholder. Easy to add behavior later. |
| **Max-time violations affect existing simulation results** | Default max values are undefined (no violation check) unless user explicitly sets them. Backward compatible. |
| **Breaking existing tests** | Only DXF/detector tests removed. Engine tests updated for split transport fields. |
