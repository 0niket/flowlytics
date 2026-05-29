# Station Type Taxonomy — Design Document

**Source diagram:** `docs/diagrams/station_type.png`
**Date analysed:** 2026-05-29
**Scope:** Domain redesign, type system refactoring, UI/UX redesign

---

## 1. Diagram Description

The diagram is a hand-drawn hierarchical tree (mind-map style) that defines the complete taxonomy of station types in the Flowlytics line configuration UI.

### Root node

`Select Station Type` — a rounded rectangle at the left edge. This is a UI action/decision point, not a data node. It represents a picker/modal that the user interacts with to choose what kind of station they are configuring.

### First-level branches (station categories)

Four branches radiate right from the root:

| Branch | Visual shape | Notes |
|---|---|---|
| `Loading` | rounded rectangle | Manual basket preparation station at line entry |
| `Unloading` | rounded rectangle | Manual basket removal station at line exit |
| `Tank` | rounded rectangle | Immersion station (chemical or rinse) |
| `WDO (Water Drying Oven)` | rounded rectangle | Heated oven station post-tanks |

### Second-level leaves — parameters per station type

**Loading** branches to two parameter leaves (arrows pointing right):
- `loading time` — the nominal/target operator loading duration
- `Max loading time` — an upper bound on acceptable loading duration

**Unloading** branches to two parameter leaves:
- `Unloading time` — the nominal/target operator unloading duration
- `Max unloading time` — an upper bound on acceptable unloading duration

**Tank** branches to three sub-type leaves, then those converge on shared parameters:
- `Chemical tank` → both sub-types point to `Dwell (in min)` and `Tolerance (in percentage)`
- `Rinse tank` → both sub-types point to `Dwell (in min)` and `Tolerance (in percentage)`
- `Extra tank (for future use)` — labelled explicitly as a placeholder; does **not** connect to the parameter nodes

**WDO (Water Drying Oven)** branches to two parameter leaves:
- `Drying time` — the nominal/target oven dwell duration
- `Max drying time` — an upper bound on acceptable drying duration

### Key structural observation — shared parameter nodes

The diagram draws `Dwell (in min)` and `Tolerance (in percentage)` as **two shared terminal nodes** that both `Chemical tank` and `Rinse tank` point to with crossing arrows. This is significant: both tank sub-types carry identical parameter shapes. `Extra tank` deliberately omits these connections, signalling that its parameter shape is undefined/TBD.

### Grouping logic

- Loading, Unloading, and WDO are **single-type stations** — no sub-type branching.
- Tank is a **polymorphic station** — three sub-types with a shared parameter schema (for the two concrete ones).
- Max-time parameters appear on Loading, Unloading, and WDO but not on Tank. This is because tanks already have the `Tolerance (±%)` concept which implicitly encodes the same idea (target ± tolerance = valid window).

---

## 2. Domain Meaning

### What the taxonomy encodes

The diagram redesigns Flowlytics's station model from an implicit, positionally-fixed system into an **explicit, type-annotated sequence**. Currently, stations are defined by their position (first = LOAD, middle = tanks, near-end = WDO, last = UNLOAD). The diagram proposes that each station in a recipe carries a declared type, which drives what parameters are shown and what simulation rules apply.

### Max-time parameters — the new violation framework for non-tank stations

The most significant new concept is the **Max time** parameter on Loading, Unloading, and WDO.

Currently, only chemical tanks have a violation system (dwell time vs. target ± tolerance). The diagram extends this philosophy to all station types:

| Station | Target time (already exists) | Max time (new) | Violation when |
|---|---|---|---|
| Loading | `loadTimeMin` | `maxLoadTimeMin` | operator takes longer than max |
| Unloading | `unloadTimeMin` | `maxUnloadTimeMin` | operator takes longer than max |
| WDO | `wdoTimeMin` | `maxWdoTimeMin` | basket stays in oven beyond max |
| Chemical tank | `dwellSec` | derived from `tolerancePct` | over-dwell past target × (1 + tol) |
| Rinse tank | `dwellSec` | derived from `tolerancePct` | same (typically wide tolerance) |

This creates a unified violation model: every station type can produce a timing violation. The current system only tracks violations for tanks.

### Extra tank — extensibility marker

`Extra tank (for future use)` is a named stub. Its presence in the diagram signals that the station type system should be **open for extension** — the UI and type system must not hard-code exactly two tank sub-types. Likely candidates for future expansion: buffer station, inspection station, spray rinse, heated tank.

---

## 3. Cross-Reference with Glossary (`src/glossary/data.ts`)

### Concepts already in glossary

| Diagram element | Glossary term | Location |
|---|---|---|
| Loading / loading time | `Load Time / Unload Time` | Configuration section |
| Unloading / unloading time | `Load Time / Unload Time` | Configuration section |
| Chemical tank | `Target Dwell`, `Avg Dwell`, `Tolerance (±%)` | Station Metrics / Configuration |
| Rinse tank | `Tolerance (±%)` (mentions water/rinse tanks) | Configuration |
| WDO / Drying time | `WDO (Water Dry-Off Oven)` | Configuration |
| Dwell (in min) | `Target Dwell` | Station Metrics |
| Tolerance (in percentage) | `Tolerance (±%)` | Configuration |
| Violations | `Violations` | Key Metrics |

### New concepts not in glossary

These terms appear in the diagram but have no glossary entry:

1. **Max loading time** — An upper bound on the operator loading operation. Analogous to `dwellMax` for a tank. Triggers a loading violation when exceeded. The glossary covers loading utilisation and queue wait but never a hard ceiling on loading duration.

2. **Max unloading time** — Same concept applied to the unloading station.

3. **Max drying time** — Upper bound on WDO dwell. The glossary mentions WDO can become a bottleneck but does not define a maximum permissible drying time or any WDO violation concept.

4. **Extra tank** — A named, intentional placeholder sub-type with no simulation behaviour defined yet. The glossary has no forward-looking stub for extensible station types.

5. **Select Station Type** (as a UI action) — The glossary documents station configuration parameters but not the UX concept of choosing a type from a picker before configuring parameters.

---

## 4. Codebase Mapping

### 4.1 `src/types.ts`

**`TankType`** (line 51):
```typescript
export type TankType = "chemical" | "rinse";
```
The diagram adds a third sub-type. Required change:
```typescript
export type TankType = "chemical" | "rinse" | "extra";
```

**`RecipeStep`** (lines 53–60):
```typescript
export interface RecipeStep {
  id: string;
  label: string;
  dwellSec: number;
  kind: "tank" | "station" | "oven";
  tankType?: TankType;
  tolerancePct?: number;
}
```
The diagram introduces `maxDwellSec` (or `maxTimeSec`) as a first-class field — not only for tanks but for all station kinds. Currently only tanks have a tolerance window; `station` and `oven` kinds have no max-time concept. Required addition:
```typescript
maxDwellSec?: number;  // max allowed time; used for violation detection on all kinds
```

**`SimParams`** (lines 73–91):
Fields `loadTimeMin`, `unloadTimeMin`, `wdoTimeMin` have no `max*` counterparts. Required additions:
```typescript
maxLoadTimeMin?: number;
maxUnloadTimeMin?: number;
maxWdoTimeMin?: number;
```

Alternatively, if `RecipeStep` gains `maxDwellSec`, and LOAD/UNLOAD/WDO become proper `RecipeStep` entries with `dwellSec` populated from their respective time params, these can be collapsed into the recipe — the cleaner long-term design.

### 4.2 `src/ui/config.ts`

**`rebuildTankTable`** (lines 49–98):
The type selector (line 62) only offers `chemical` and `rinse`:
```typescript
select.innerHTML = `<option value="chemical">Chemical</option><option value="rinse">Rinse</option>`;
```
Required change: add `extra` option. Also, when `extra` is selected, the dwell and tolerance inputs should be disabled or hidden (as the diagram shows no parameter connections for Extra tank).

The table currently has no column or UI for `Max time`. The diagram suggests that tolerance (which maps to max time for tanks) is already present — but for Loading, Unloading, and WDO, a separate `Max time` field in a different section of the config panel needs to be added.

There is no "Select Station Type" modal. Currently, station type is inferred from the tank table row index. The diagram envisions a type picker as the first step before parameter configuration. This would require either:
- A modal/popover triggered by clicking a station row
- An inline type selector as the first column in each row (already partially implemented for tanks, but not for LOAD/UNLOAD/WDO)

**`readParamsFromUi`** (lines 7–47):
Reads `loadTimeMin` and `unloadTimeMin` but has no concept of max times. The per-tank loop reads `type-select`, `dwell-input`, and `tol-input`. A `max-input` column would need to be added and read here.

**`updateResults`** / **`renderStationMetrics`** (lines 344–433):
The station metrics table shows: ID, utilisation, avg dwell, target dwell, violations. After this change, a `maxDwell` column and a `max-time violations` count (for LOAD/UNLOAD/WDO) would belong here.

### 4.3 `src/engine/layout.ts`

**`defaultRecipe`** (lines 82–94):
```typescript
steps.push({ id: "LOAD", label: "Load", dwellSec: 0, kind: "station" });
// ...tanks...
steps.push({ id: "WDO", label: "Dry-Off Oven", dwellSec: minutesToSeconds(10), kind: "oven" });
steps.push({ id: "UNLOAD", label: "Unload", dwellSec: 0, kind: "station" });
```
LOAD and UNLOAD have `dwellSec: 0` — they do not participate in the dwell timing system. To support `maxDwellSec`, these entries need to carry the actual time values. The load/unload times are currently stored only in `SimParams` (not in `recipeSteps`). This disconnect is the architectural root cause of why no max-time concept exists for manual stations.

**`buildSyntheticLayout`** (lines 4–13):
Uses `LayoutNode.type: "station" | "tank" | "oven" | "marker"`. This type field already mirrors the station category taxonomy but is a **layout** concern. The diagram's taxonomy is a **recipe** concern. These two type hierarchies should stay decoupled; `LayoutNode.type` does not need to change.

---

## 5. Required Implementation Changes

### 5.1 Type system

| File | Change | Priority |
|---|---|---|
| `src/types.ts` | Add `"extra"` to `TankType` | Medium |
| `src/types.ts` | Add `maxDwellSec?: number` to `RecipeStep` | High |
| `src/types.ts` | Add `maxLoadTimeMin`, `maxUnloadTimeMin`, `maxWdoTimeMin` to `SimParams` (or migrate these into `recipeSteps`) | High |
| `src/types.ts` | Add `"extra_tank"` violation cause or extend `ViolationCause` | Low |

### 5.2 Engine

| File | Change | Priority |
|---|---|---|
| `src/engine/layout.ts` | `defaultRecipe` — populate LOAD/UNLOAD `dwellSec` from `SimParams` so they carry time data | High |
| `src/engine/simulation.ts` | Detect max-time violations at Loading, Unloading, and WDO stations (not just chemical tanks) | High |
| `src/engine/simulation.ts` | `extra` tank type — no violation detection, no tolerance window, passthrough semantics | Medium |

### 5.3 UI

| File | Change | Priority |
|---|---|---|
| `src/ui/config.ts` — `rebuildTankTable` | Add `extra` option to tank type selector; disable dwell/tol inputs when `extra` selected | Medium |
| `src/ui/config.ts` — `readParamsFromUi` | Read `max-load-time`, `max-unload-time`, `max-wdo-time` inputs | High |
| `src/ui/config.ts` — `renderStationMetrics` | Show max-time violations for LOAD/UNLOAD/WDO rows | High |
| `src/ui/config.ts` — `setupConfigPanel` | Add "Select Station Type" first-step UX: either a modal or inline type badge per station row | Medium |
| HTML/CSS | Add `Max loading time`, `Max unloading time`, `Max drying time` input fields in the config panel | High |

### 5.4 Glossary

| Term | Action |
|---|---|
| Max loading time | Add entry under Configuration section |
| Max unloading time | Add entry under Configuration section |
| Max drying time | Add entry under Configuration section |
| Extra tank | Add entry under Configuration section (stub, forward reference) |
| Station Type | Add entry as overarching concept tying the above together |

---

## 6. Domain Redesign Perspective

The diagram represents a shift from a **fixed-topology simulation** (LOAD → T1..Tn → WDO → UNLOAD, always in that order) toward a **typed-recipe simulation** where each slot in the sequence carries an explicit type declaration.

The consequences of this shift:

**Violation model becomes universal.** Currently, violations are a tank-only concern. After this redesign, every station in the recipe participates in the timing integrity system. A basket overdue at the loading station is as trackable as one overdue in a chromating tank.

**Parameter form is driven by type.** The diagram explicitly encodes this: selecting `Chemical tank` shows dwell + tolerance; selecting `Loading` shows loading time + max loading time; selecting `Extra tank` shows nothing. The UI must render parameter sets conditionally based on the declared type — the current uniform table (every row has dwell + tolerance) will not scale.

**Extension point is named.** `Extra tank (for future use)` is not an oversight — it is a deliberate hook. Any implementation should treat `TankType` as an extensible discriminated union and avoid switch-exhaustiveness checks that would break on addition of new sub-types.

**Symmetry of time parameters.** The diagram reveals that Loading, Unloading, and WDO follow the same two-parameter pattern (nominal time, max time) that tanks follow (dwell, max dwell derived from tolerance). This symmetry suggests a common base schema:

```typescript
interface StationTimingConfig {
  nominalSec: number;       // target time
  maxSec?: number;          // ceiling; undefined = no violation detection
}
```

Adopting this base for all station kinds would unify how the engine tracks timing violations and how the UI renders timing parameters — regardless of whether the station is a chemical tank, a manual loading station, or a drying oven.
