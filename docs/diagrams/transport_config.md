# Transport Configuration — Diagram Analysis

**Source:** `docs/diagrams/transport_config.png`  
**Date:** 2026-05-29  
**Purpose:** Domain redesign, refactoring, and UI/UX reference for the Transport configuration subsystem.

---

## 1. Visual Structure

The diagram is a hand-drawn mind map with **"Transport"** as the root node. Two primary branches extend from it:

```
Transport
├── Wagons
│   ├── Speed (Meters / Min)  [horizontal movement]
│   ├── Lift & Lower (in seconds)  [Vertical movement]
│   │   ├── Lift (in sec)  ──→  Drip (in sec)
│   │   └── Lower (in sec)
│   └── Basket pick & drop time (in seconds)
│       ├── Pick (in sec)
│       └── Drop (in sec)
└── Baskets
    ├── Max weight per basket
    ├── Individual Article weight
    └── Max articles per basket
```

Two hand-written annotation blocks appear outside the tree:

**Top-right annotation (Drip definition):**
> "Drip: After the wagon lifts a basket from a tank, it pauses to let excess liquid drain back into the tank before moving to the next station."

This annotation hangs off the **Lift** leaf, clarifying that `Drip (in sec)` is a time penalty that happens *after* lift and *before* horizontal travel begins. It is a sub-phase of the lift action, not a separate transfer phase.

**Bottom-left annotation (Wagon-Basket equation):**
> "Transport is essentially wagon-basket equation. The number of baskets being processed in the assembly line depends on the number of wagons. If there are 10 stations and single wagon is going across each station then system can handle only one basket. If there are two wagons — W1, W2. W1 traveling from loading station to T5 and W2 traveling from T5 to unloading station, then assembly line / conveyor belt is processing two baskets at a time and so on."

This is the most conceptually dense part of the diagram. It articulates the **fundamental throughput invariant** of the Transport domain.

---

## 2. Domain Meaning

### 2.1 The Transport Domain

"Transport" is the mechanical layer responsible for moving baskets between stations. It is structurally distinct from:
- The **chemical process** (recipe, dwell times, tolerances)
- The **manual operations** (load/unload time)
- The **simulation settings** (run duration, basket count)

The diagram declares Transport to be a **wagon-basket equation**: the number of concurrent baskets in active processing is constrained by and proportional to the number of wagons. This is why Transport deserves its own first-class domain grouping in the configuration model, separate from recipe and simulation settings.

### 2.2 Wagons Branch — Every Element

| Label in diagram | Unit | Domain meaning |
|---|---|---|
| Speed (Meters / Min) [horizontal movement] | m/min | Rail travel velocity — how fast the wagon moves laterally along the track between tank positions |
| Lift & Lower (in seconds) [Vertical movement] | sec | Parent grouping for the vertical hoist operations — raising out of source tank and lowering into destination tank |
| Lift (in sec) | sec | Upward hoist motion: raises the basket from its current tank until it clears the liquid surface and reaches the travel height |
| Drip (in sec) | sec | Mandatory hold at raised position: basket hangs above the tank while excess chemicals drain back in — waste prevention and cross-contamination control |
| Lower (in sec) | sec | Downward immersion into the destination tank: controlled descent until the basket is fully submerged |
| Basket pick & drop time (in seconds) | sec | Parent grouping for the gripper/clamp operations — attaching to and releasing the basket |
| Pick (in sec) | sec | Grab/clamp attachment: wagon mechanism aligns with basket lift points, clamps, and confirms secure hold |
| Drop (in sec) | sec | Release: wagon mechanism releases clamp and withdraws from the basket |

**Key structural insight from the diagram:** Drip is shown as a **child of Lift**, not as a sibling of Lift/Lower. This means the temporal sequence for each transfer is:

```
Pick → Lift → [Drip at height] → Horizontal travel → Lower → Drop
```

Drip occurs while the basket is stationary at raised height, before horizontal travel begins. This is currently collapsed with `liftLowerSec` in the codebase, but the distinction matters: drip time is chemically driven and should be configurable independently of hoist motor speed.

### 2.3 Baskets Branch — Every Element

| Label in diagram | Domain meaning |
|---|---|
| Max weight per basket | Maximum total gross weight: basket tare + parts payload. This is the wagon hoist's rated load limit. If exceeded, it creates a mechanical safety risk and must be flagged as a configuration violation. |
| Individual Article weight | Weight of a single part/article loaded into the basket (kg/article). Combined with max articles, it gives the maximum payload weight that must not exceed the basket max weight. |
| Max articles per basket | Physical fixture capacity — how many individual parts the basket rack/fixture can hold. The production multiplier: `bph × max articles = articles/hr`. |

These three parameters are currently absent from the Flowlytics codebase entirely. Their presence in this diagram signals an intent to:

1. **Validate configurations:** ensure `individual article weight × max articles ≤ max weight per basket`
2. **Compute mass throughput:** `kg/hr = bph × (max articles × article weight kg)`
3. **Compute parts throughput:** `articles/hr = bph × max articles per basket`
4. **Unlock production planning metrics** that sales engineers and production planners actually quote — `kg/shift`, `articles/shift` — rather than the abstract `bph` metric

### 2.4 The Wagon-Basket Equation (Bottom Annotation)

This annotation is the most important conceptual statement in the diagram. It formalizes the invariant:

> **At any instant, the maximum number of baskets simultaneously in active transport equals the number of wagons.**

With 1 wagon and 10 stations, only 1 basket moves at a time. The wagon must complete its pick-travel-drop cycle before it can begin the next basket. With 2 wagons (W1 serving LOAD→T5, W2 serving T5→UNLOAD), 2 baskets are in flight simultaneously. This is the mechanism by which wagon count directly controls throughput.

This is already modeled in the simulation engine through `WagonZone` (`src/types.ts:102`) and the multi-wagon scheduling logic, but it is nowhere stated as a domain principle in the glossary or documentation.

---

## 3. Glossary Cross-Reference (`src/glossary/data.ts`)

### Terms Already Covered

| Diagram element | Glossary term | Section | Match quality |
|---|---|---|---|
| Speed (Meters/Min) | Wagon Speed | Configuration | Exact — "Horizontal travel speed of the transporter wagon along the rail track, measured in meters per minute." Range 10–30 m/min noted. |
| Lift & Lower (in seconds) | Lift + Lower Time | Configuration | Partial — treats lift+lower as a single combined value. The split into individual Lift/Lower is not captured. |
| Drip (in sec) | Drip / Drag-out Time | Configuration | Exact — "Mandatory pause time after the wagon lifts a basket out of a tank, before it starts traveling to the next tank." |
| Basket pick & drop time | Pick + Drop Time | Configuration | Partial — combined entry; does not distinguish pick from drop. |
| # Wagons (branch root) | # Wagons | Configuration | Covers wagon count and zone concept. The wagon-basket invariant (bottom annotation) is not explicitly stated. |
| Basket (branch root) | Basket | Simulation Concepts | Covers basket as carrier unit, throughput multiplier, payload weight. |

### New Concepts NOT in Glossary

The following have no corresponding glossary entry anywhere:

| Concept | Why it matters |
|---|---|
| **Max weight per basket** | Physical safety constraint on wagon hoist. Enables configuration validation and prevents mechanical overload. |
| **Individual Article weight** | The unit of production. Enables `kg/hr` and `articles/hr` metrics. |
| **Max articles per basket** | Production multiplier. Links simulation throughput to real-world output figures used in quotations. |
| **Lift time (as distinct from Lower time)** | Asymmetric operations. Lift works against gravity (slower); lower can be gravity-assisted (faster). Splitting enables accurate modeling. |
| **Pick time (as distinct from Drop time)** | Asymmetric operations. Pick requires alignment and clamping under load; drop is typically faster (spring-release mechanism). |
| **Wagon-Basket invariant** | The rule that `concurrent baskets in transport = wagon count`. Core throughput principle; currently undocumented. |
| **Drip as sub-phase of Lift** | Drip is not an independent step — it occurs while the basket is stationary at raised height during the lift phase. The temporal ordering `Lift → [Drip] → travel` vs `Lift → travel → [Drip]` changes when the next tank's dwell clock starts being blocked. |

---

## 4. Codebase Mapping

### 4.1 `src/types.ts` — `SimParams` (lines 73–91)

```typescript
// Current SimParams — Transport-related fields
wagonSpeedMPerMin: number;   // ✓ matches "Speed (Meters/Min)"
liftLowerSec: number;        // ⚠ COMBINED — diagram splits Lift + Lower
pickDropSec: number;         // ⚠ COMBINED — diagram splits Pick + Drop
dripTimeSec: number;         // ✓ matches "Drip (in sec)"
wagonCount: number;          // ✓ matches wagon count
// ABSENT:
// maxWeightKg                — "Max weight per basket"
// articleWeightKg            — "Individual Article weight"
// maxArticlesPerBasket       — "Max articles per basket"
```

The `liftLowerSec` / `pickDropSec` merger is the primary structural gap. The diagram shows four distinct leaf nodes, not two. The current code uses these combined values to compute per-transfer overhead in the simulation engine.

### 4.2 `src/ui/config.ts` — UI Inputs and Rendering

Config reads via DOM element IDs registered at line 789:
```typescript
"wagonSpeedMPerMin"  // ✓ exists
"liftLowerSec"       // ⚠ combined — needs splitting into liftSec + lowerSec
"pickDropSec"        // ⚠ combined — needs splitting into pickSec + dropSec
"wagonCount"         // ✓ exists
"dripTimeSec"        // ✓ exists
// ABSENT: maxWeightKg, articleWeightKg, maxArticlesPerBasket
```

The Transport summary line at line 389:
```typescript
ui.transportSummary.textContent = `${p.wagonCount} wagon${p.wagonCount > 1 ? "s" : ""}, ${p.wagonSpeedMPerMin} m/min`;
```
Shows only wagon count and speed. With the basket payload fields added, this summary should expand to reflect the full transport configuration, or a dedicated Transport KPI card should be added.

The `readParamsFromUi()` function (lines 7–47) reads `liftLowerSec` and `pickDropSec` as single numeric inputs. Splitting these requires adding two DOM inputs each and updating the `SimParams` construction.

### 4.3 `src/engine/layout.ts`

The layout engine is not directly affected by Transport config parameters — those flow only to the simulation engine. The synthetic layout at line 5 uses hardcoded `tankSpacing = 1400` mm, and real layout distances are pulled from DXF anchor coordinates. The wagon speed combined with actual inter-tank distances drives travel time in the simulation engine.

No layout changes are needed for the basket payload parameters. However, if lift and lower times are split, the simulation engine's transfer time formula changes from:
```
liftLowerSec + dripTimeSec + travelSec
```
to:
```
liftSec + dripTimeSec + travelSec + lowerSec
```
This is semantically equivalent but makes it explicit that drip occurs between lift completion and travel start — matching the diagram's hierarchy.

### 4.4 Key Simulation Engine Impact

The per-transfer time budget currently computed in the simulation engine is:
```
pickDropSec + liftLowerSec + dripTimeSec + (distance / wagonSpeedMPerMin × 60)
```

After splitting, it becomes:
```
pickSec + liftSec + dripTimeSec + travelSec + lowerSec + dropSec
```

This preserves total transfer time when `pickSec + dropSec = pickDropSec` and `liftSec + lowerSec = liftLowerSec`, ensuring no regression in results when default values are migrated proportionally (e.g., 50/50 split).

---

## 5. Required Changes for Implementation

### 5.1 Split `liftLowerSec` → `liftSec` + `lowerSec`

**Files affected:** `src/types.ts`, `src/ui/config.ts`, simulation engine.

```typescript
// src/types.ts — replace liftLowerSec with:
liftSec: number;    // upward hoist time (seconds), excludes drip
lowerSec: number;   // immersion time (seconds)
```

Default split: existing `liftLowerSec` value can be divided evenly, or defaults set to `liftSec = lowerSec = existing / 2`. In practice, lower is often 20–30% faster than lift (gravity-assisted descent), so a reasonable default split is 55/45.

### 5.2 Split `pickDropSec` → `pickSec` + `dropSec`

**Files affected:** same as above.

```typescript
// src/types.ts — replace pickDropSec with:
pickSec: number;    // clamp/grab attachment time
dropSec: number;    // release time
```

Default split: drop is typically 30–40% faster than pick (spring release vs. alignment + clamp). A 60/40 split is a reasonable default.

### 5.3 Add Basket Payload Parameters to `SimParams`

These are optional fields that unlock production-volume metrics without requiring changes to the DES timing engine.

```typescript
// src/types.ts — add to SimParams (optional):
maxWeightKg?: number;           // rated basket gross weight limit (kg)
articleWeightKg?: number;       // weight of one part/article (kg)
maxArticlesPerBasket?: number;  // fixture capacity (articles per basket)
```

Derived metrics to expose in `SimulationResult`:
```typescript
// Derived from basket payload + throughput
articlesPerHour?: number;   // bph × maxArticlesPerBasket
kgPerHour?: number;         // bph × maxArticlesPerBasket × articleWeightKg
```

Config validation warning (not blocking):
```
if articleWeightKg × maxArticlesPerBasket > maxWeightKg → "Payload exceeds basket weight limit"
```

### 5.4 UI/Config Panel Changes (`src/ui/config.ts`)

**Transport section restructure:**

Current: single "Lift+Lower" input, single "Pick+Drop" input.

Target:
```
Wagons
  Speed (m/min)             [existing: wagonSpeedMPerMin]
  Wagon Count               [existing: wagonCount]
  Lift (sec)                [new: liftSec]
  Lower (sec)               [new: lowerSec]
  Drip (sec)                [existing: dripTimeSec]
  Pick (sec)                [new: pickSec]
  Drop (sec)                [new: dropSec]

Baskets (optional / collapsible)
  Max weight per basket (kg)     [new: maxWeightKg]
  Article weight (kg)            [new: articleWeightKg]
  Max articles per basket        [new: maxArticlesPerBasket]
```

**Transport summary line (config.ts:389):**

Current:
```
2 wagons, 18 m/min
```

Proposed (with payload):
```
2 wagons, 18 m/min | 50 articles / basket, 800 kg max
```

**KPI throughput card enhancement:**

When basket payload is configured, the throughput card should show dual metrics:
```
1.85 bph  →  92 articles/hr  →  736 kg/hr
```

### 5.5 Glossary Additions (`src/glossary/data.ts`)

Six new entries required, one update:

| Term | Section | Core content |
|---|---|---|
| **Lift Time** | Configuration | Upward hoist duration (seconds). Distinct from lower time; works against gravity. Typical range: 8–15s. |
| **Lower Time** | Configuration | Immersion duration (seconds). Often faster than lift (gravity-assisted). Typical range: 6–12s. |
| **Pick Time** | Configuration | Gripper attachment time. Requires alignment and clamping under load. Typical range: 3–8s for automated, 10–15s for manual hooks. |
| **Drop Time** | Configuration | Gripper release time. Typically faster than pick (spring release, no alignment required). Typical range: 2–5s. |
| **Max Weight per Basket** | Configuration | Rated gross weight limit for basket + parts. Constrains wagon hoist design. Exceeded limit creates mechanical overload risk and must trigger a validation warning. |
| **Basket Capacity** | Configuration | Combined payload model: max weight (kg), article weight (kg), max articles per basket. Enables `articles/hr` and `kg/hr` production metrics. Links `bph` to real-world output figures used in customer quotations. |

Update required:
| Term | Change |
|---|---|
| **Lift + Lower Time** | Add cross-reference to separate Lift Time and Lower Time entries. Note the asymmetry (lift typically slower than lower). |
| **Pick + Drop Time** | Add cross-reference to Pick Time and Drop Time entries. Note the asymmetry. |
| **Drip / Drag-out Time** | Clarify that drip is architecturally a sub-phase of the Lift action — it occurs while the basket is stationary at raised height, before horizontal travel begins. This affects the order of per-transfer overhead accumulation. |

---

## 6. Domain Redesign Perspective

### 6.1 Transport as a First-Class Domain Object

The diagram establishes "Transport" as a compound domain object with two sub-systems:

1. **The wagon** — a physical mechanism with speed (horizontal), hoist (vertical lift/lower), and gripper (pick/drop) characteristics
2. **The basket** — the payload carrier with physical capacity constraints

Currently the codebase treats transport parameters as a flat list inside `SimParams` alongside recipe and simulation parameters. The diagram suggests these deserve their own type:

```typescript
export interface TransportConfig {
  wagonCount: number;
  wagonSpeedMPerMin: number;
  liftSec: number;
  lowerSec: number;
  dripTimeSec: number;
  pickSec: number;
  dropSec: number;
  basketCapacity?: {
    maxWeightKg: number;
    articleWeightKg: number;
    maxArticlesPerBasket: number;
  };
}
```

`SimParams` would then contain `transport: TransportConfig` as a nested field, matching the diagram's grouping hierarchy.

### 6.2 The Lift-Drip Ordering Is Not Cosmetic

The diagram explicitly places Drip as a **child of Lift**, not as a sibling. This encodes a physical reality: drip time is spent at the height achieved after lift, before horizontal movement starts. The timing consequence is:

- Wagon is **stationary above source tank** during drip — not traveling
- Next tank cannot be approached until drip completes
- Drip is effectively **dead time that serializes with lift**, not with travel

The current `dripTimeSec` is added to per-transfer overhead correctly, but the architectural placement matters for any future visualization (e.g., a Gantt breakdown of wagon activity states: `moving | picking | lifting | dripping | lowering | dropping | idle`).

### 6.3 Basket Payload Unlocks a New Metric Tier

Currently Flowlytics outputs:
- **Operational metrics:** bph, lead time, violations, wagon utilization
- **Configuration quality:** bottleneck, WIP balance

Adding basket payload parameters unlocks:
- **Production metrics:** articles/hr, kg/hr, kg/shift
- **Commercial metrics:** capacity vs. customer order (kg/month at stated shift pattern)
- **Engineering validation:** overload check against hoist rated capacity

This is the metric tier that production planners and sales engineers actually use in customer-facing documents. The diagram's Baskets branch is not about simulation accuracy — it is about connecting the simulator's output to commercial reality.

---

## 7. Summary Table

| Diagram element | In glossary | `SimParams` field | In UI | Required action |
|---|---|---|---|---|
| Speed (Meters/Min) | ✓ | `wagonSpeedMPerMin` | ✓ | None |
| Lift & Lower (parent) | ✓ (combined) | `liftLowerSec` (combined) | ✓ (combined) | Split into two fields |
| Lift (in sec) | Partial | Merged into `liftLowerSec` | Merged | Separate input + glossary entry |
| Lower (in sec) | Partial | Merged | Merged | Separate input + glossary entry |
| Drip (in sec) | ✓ | `dripTimeSec` | ✓ | Update glossary to clarify sub-phase placement |
| Pick (in sec) | Partial | Merged into `pickDropSec` | Merged | Separate input + glossary entry |
| Drop (in sec) | Partial | Merged | Merged | Separate input + glossary entry |
| # Wagons | ✓ | `wagonCount` | ✓ | Add wagon-basket invariant to glossary |
| Max weight per basket | ✗ | ✗ | ✗ | New optional field + glossary entry + validation |
| Individual Article weight | ✗ | ✗ | ✗ | New optional field + glossary entry |
| Max articles per basket | ✗ | ✗ | ✗ | New optional field + glossary entry |
| Wagon-basket equation | ✗ | N/A (concept) | N/A | Add to glossary under Wagon Count or as standalone entry |
