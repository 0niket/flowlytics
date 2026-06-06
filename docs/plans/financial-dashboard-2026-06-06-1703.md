# Plan: Unified Financial Dashboard — "The Goal is to Make Money"

## Context

The blog post "What is the Goal?" establishes the product thesis: a pretreatment line simulator must answer three interdependent questions — *How fast?* (throughput), *Will quality hold?* (violations), *Is it worth it?* (economics) — and all three resolve to a single unit: **money**.

Today, the simulator computes throughput, violations, utilization, and queue analysis — but has **zero financial modeling**. The dashboard shows constraint analysis (loading/unloading bottlenecks) but cannot answer whether a configuration is *profitable*. When Kaka asks "should I add a second wagon for 12 lakhs?", the tool cannot answer.

**Goal:** Transform the dashboard into a unified financial view where every input change (dwell time, wagon count, basket count) immediately reflects its impact on **profit per hour (Rs/hr)** — the north star metric. Every operational metric is translated into its monetary equivalent.

*Plan reviewed by GPT-5.5 (via Codex) and DeepSeek-v4-flash (via OpenCode). Key feedback incorporated.*

---

## UX Design: Progressive Disclosure

### User Experience Flow

The user's journey through the financial dashboard follows **progressive disclosure** — reveal complexity only when the user asks for it. The user should never feel overwhelmed by economics inputs on first load.

**Level 0 — Zero Configuration (default):**
The user opens the app for the first time. The sidebar shows the existing station/wagon configuration. Below Simulation Settings, a collapsed "Economics" section shows a single summary line: `No economics configured`. The main dashboard shows only the existing constraint analysis. No financial numbers anywhere. The user can use the simulator exactly as before — economics is invisible until requested.

**Level 1 — Economics Section Expanded:**
The user clicks "Economics" to expand it. They see sub-groups (Revenue, Costs, Equipment, Plant) with clear labels and placeholder text showing typical Indian pretreatment values. Each sub-group is a collapsible fieldset. The user fills in what they know and skips what they don't. Every field defaults to 0, so partial input is always valid.

**Level 2 — Financial Dashboard Appears:**
The moment `revenuePerArticle > 0` AND `articlesPerBasket > 0` (minimum viable economics input), the profit/hr hero card appears at the top of the main dashboard. Even with no cost inputs, this shows revenue and "profit = revenue" — which is wrong but immediately communicates "you need to add costs." This is intentional friction that teaches the user the model.

**Level 3 — Full Financial View:**
As the user fills in costs, the cost breakdown card populates line by line. Each cost category appears only when its value is non-zero. The break-even throughput, chemical cost %, and unit economics rows appear when enough data exists to compute them. The dashboard grows organically with the user's inputs.

**Level 4 — Violation Warning (guardrail):**
If the user changes dwell times or wagon count and introduces violations, the profit card is immediately replaced by a red alert card: "Configuration has violations — fix timing before economics are meaningful." This is a hard stop — no financial numbers are shown for broken configurations. The user must fix the operational issue before they can reason about money.

### Component Mapping (shadcn patterns adapted to existing CSS)

The existing design system uses CSS variables, dark theme, and a card/section pattern. We map shadcn patterns to this system:

| shadcn Component | Our Implementation | CSS Class | Usage |
|---|---|---|---|
| **Card** (Header + Content) | `div.financial-card` | `.financial-card`, `.financial-card__header`, `.financial-card__content` | Profit hero card, cost breakdown card, unit economics card |
| **Alert** (destructive) | `div.violation-alert` | `.violation-alert` with `--danger` left border | Violation warning replacing profit card |
| **Accordion** / Collapsible | `<details>` + `<summary>` | `.config-section--details` (existing pattern) | Economics section in sidebar, sub-groups |
| **FieldSet** + Legend | `<fieldset>` + `<legend>` | `.economics-fieldset`, `.economics-fieldset__legend` | Revenue, Costs, Equipment, Plant sub-groups |
| **Field** (Label + Input + Description) | `<label>` + `<input>` + `<span>` | `.field__label`, `.field__control`, `.field__hint` | Each economics input |
| **Badge** | `<span>` | `.badge--ok`, `.badge--bad` (existing) + `.badge--profit`, `.badge--loss` | Profit/loss indicator on collapsed summary |
| **Separator** | `<hr>` | `.separator` | Between cost categories in breakdown |
| **Tooltip** | `title` attribute or custom | Native `title` for v1 | Help text for financial terms |

### UI Component Specifications

#### Profit/Hr Hero Card (main dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ financial-card financial-card--hero ────────────────────────┐ │
│ │ ┌─ financial-card__header ────────────────────────────────┐  │ │
│ │ │  PROFIT / HOUR          [badge: 37% margin]            │  │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ │ ┌─ financial-card__value ─────────────────────────────────┐ │ │
│ │ │  Rs 1,247 /hr                                          │ │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ │ ┌─ financial-card__detail ────────────────────────────────┐ │ │
│ │ │  Revenue: Rs 3,400/hr    Costs: Rs 2,153/hr            │ │ │
│ │ │  3.8 bph x 20 articles x Rs 44.7/article              │ │ │
│ │ └────────────────────────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Left border: 3px solid `--accent2` (green) when profitable, `--danger` (red) when loss
- Background: `--surface` (existing panel background)
- Value text: 24px, weight 700, `--accent2` or `--danger` color
- Header: 11px uppercase, `--muted` color, letter-spacing 0.05em
- Badge: existing `.badge` pattern, green for positive margin, red for negative
- Detail: 12px, `--muted` color

#### Violation Alert Card (replaces profit card)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─ violation-alert ───────────────────────────────────────────┐ │
│ │  [!] CONFIGURATION HAS VIOLATIONS                          │ │
│ │  Fix timing before economics are meaningful.               │ │
│ │  3 baskets violated across 5 tanks.                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Styling:**
- Left border: 3px solid `--danger`
- Background: `rgba(255,107,107,0.08)` (danger tint)
- Title: 13px weight 700, `--danger` color
- Description: 12px, `--muted` color

#### Cost Breakdown Card (main dashboard)

```
┌─ financial-card ─────────────────────────────────┐
│  COSTS / HOUR                     Rs 2,052 /hr   │
│ ─────────────────────────────────────────────────│
│  ┌─ cost-group ────────────────────────────────┐ │
│  │  Equipment (amortized)       Rs 312 /hr     │ │
│  │    Wagons (2x)  Rs 240                      │ │
│  │    Baskets (4x) Rs 72                       │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─ cost-group ────────────────────────────────┐ │
│  │  Chemicals                   Rs 540 /hr     │ │
│  │    T1 Degreasing  Rs 180                    │ │
│  │    T2 Phosphating Rs 340                    │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─ cost-group ────────────────────────────────┐ │
│  │  Operating                   Rs 1,200 /hr   │ │
│  │    Water & Effluent  Rs 150                 │ │
│  │    Labor  Rs 450                            │ │
│  │    Energy  Rs 280                           │ │
│  │    Maintenance  Rs 120                      │ │
│  └─────────────────────────────────────────────┘ │
│ ─────────────────────────────────────────────────│
│  Chemical cost: 16% of revenue                   │
└──────────────────────────────────────────────────┘
```

**Styling:**
- Same card pattern as constraint cards (existing)
- Cost groups separated by `--border` separators
- Category totals: 12px weight 600, right-aligned
- Sub-items: 11px, `--muted`, indented 16px
- Chemical cost % line: 11px, `--accent2` (green) to draw attention

#### Unit Economics Row (main dashboard)

```
┌─ financial-card ─────────────────────────────────┐
│  UNIT ECONOMICS                                  │
│  ┌─ grid-3 ────────────────────────────────────┐ │
│  │  Cost/basket    Cost/article   Break-even   │ │
│  │  Rs 540         Rs 27          2.1 bph      │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Styling:**
- Three-column grid using existing `.grid3` class
- Metric label: 10px, `--muted`, uppercase
- Metric value: 15px, weight 600
- Break-even value: `--accent2` if current throughput > break-even, `--danger` if below

#### Economics Sidebar Section (input panel)

```
┌─ details.config-section--details ─────────────────┐
│  ▸ Economics  [badge: No economics configured]     │  ← collapsed by default
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  When expanded:                                    │
│                                                    │
│  ┌─ fieldset: Revenue ───────────────────────────┐ │
│  │  Revenue per article (Rs)  [_____]            │ │
│  │  typical: Rs 30-80/article                    │ │
│  │                                               │ │
│  │  Articles per basket       [_____]            │ │
│  │  typical: 10-50 articles                      │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ fieldset: Costs ────────────────────────────┐  │
│  │  Labor (Rs/hr)             [_____]            │ │
│  │  Energy (Rs/hr)            [_____]            │ │
│  │  Maintenance (Rs/hr)       [_____]            │ │
│  │  Water & Effluent (Rs/hr)  [_____]            │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ fieldset: Equipment ────────────────────────┐  │
│  │  Basket cost (Rs)          [_____]            │ │
│  │  Basket life (years)       [_____]            │ │
│  └───────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ fieldset: Plant ────────────────────────────┐  │
│  │  Operating hours/year      [_____]            │ │
│  │  default: 4000 (2 shifts x 250 days)          │ │
│  └───────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────┘
```

**Styling:**
- Uses existing `<details>` / `<summary>` pattern (`.config-section--details`)
- Summary badge: `.badge` with dynamic text ("No economics configured" / "Rs 1,247/hr profit")
- Fieldset legend: 11px, weight 600, uppercase, `--muted` color
- Input fields: existing `.station-card__input` pattern (monospace, 12px)
- Hint text: 10px, italic, `--muted` color — shows typical values for Indian pretreatment

#### Per-Tank Cost Input (in station card)

```
┌─ station-card--chemical ─────────────────────────┐
│  T1 (Chemical)                              [×]  │
│  Type: [chemical ▾]                              │
│  Dwell: [2.5] min   Tolerance: [10] %           │
│  Description: [_______________________]          │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  Tank cost (Rs/hr)    [_____]                    │  ← NEW: separator + cost field
│  all-in: heating, chemicals, agitation           │
└──────────────────────────────────────────────────┘
```

**Styling:**
- Thin separator (`--border`) before cost field
- Same input pattern as existing fields
- Hint text below: 10px, italic, `--muted`
- Only shown for chemical and rinse tanks (not extra/loading/unloading)

#### Per-Wagon Cost Inputs (in wagon card)

```
┌─ wagon-config-card ──────────────────────────────┐
│  W1                                              │
│  Speed: [18] m/min                               │
│  Handling (sec): [Lift][Drip][Low][Pick][Drop]   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  Wagon cost (Rs)      [_________]                │  ← NEW
│  Wagon life (years)   [_________]                │  ← NEW
└──────────────────────────────────────────────────┘
```

**Styling:**
- Same separator + field pattern as tank cost
- Same input classes as existing wagon fields

### Progressive Disclosure Summary

| User Action | What Changes | Cognitive Load |
|---|---|---|
| First open | Nothing new visible | Zero |
| Click "Economics" | 4 fieldsets with ~10 inputs, all defaulted to 0 | Low — grouped, labeled, hinted |
| Enter revenue per article + articles per basket | Profit hero card appears on dashboard | Medium — one new card |
| Enter cost values | Cost breakdown populates line by line | Medium — grows with input |
| Per-tank/wagon costs filled | Equipment and chemical lines get specific | Low — inline with existing cards |
| Introduce violations | Red alert replaces profit card | High signal — intentional friction |

---

## Engineering Discipline

### Domain-Driven Design (Eric Evans)

The Economics layer introduces a **new bounded context** that consumes output from the existing Simulation context. Rather than entangling financial logic into the simulation engine, we model it as a separate concern with a clear **anti-corruption layer** at the boundary.

**Bounded Contexts:**

```
┌────────────────────────────┐     ┌───────────────────────────┐
│  Line Configuration (BC1)  │     │  Economics (BC3) — NEW    │
│                            │     │                           │
│  Aggregates:               │     │  Value Objects:           │
│    LineConfig (root)       │     │    EconomicsConfig        │
│      StationConfig[]       │     │    EconomicsResult        │
│      TransportConfig       │     │                           │
│      RunSettings           │     │  Services:                │
│      EconomicsConfig — NEW │     │    calculateEconomics()   │
│                            │     │    formatCurrency()       │
│  Services:                 │     │    countUniqueViolated()  │
│    Builder (mutations)     │     │                           │
│    lineConfigToSimParams() │     │  Consumes:                │
│    createDefault*()        │     │    LineConfig (input)     │
└────────────┬───────────────┘     │    SimulationResult       │
             │                     │    (output from BC2)      │
             ▼                     └───────────────────────────┘
┌────────────────────────────┐
│  Simulation Engine (BC2)   │
│                            │
│  Entities:                 │
│    Basket (lifecycle FSM)  │
│    Wagon (position/state)  │
│                            │
│  Services:                 │
│    runSimulation()         │
│    buildSimPlan()          │
│                            │
│  Output:                   │
│    SimulationResult        │
│      .throughputSteadyBph  │
│      .violations[]         │
│      .baskets[]            │
└────────────────────────────┘
```

**Key DDD decisions:**

1. **EconomicsConfig is a value object** attached to the LineConfig aggregate root. It has no identity of its own — it describes the financial parameters of the line. When the line changes, economics is recalculated.

2. **EconomicsResult is a value object** — an immutable snapshot of financial calculations. It is derived from `LineConfig + SimulationResult` through a pure function. It has no lifecycle.

3. **`calculateEconomics()` is a domain service** — it sits at the boundary between BC1 (config) and BC2 (simulation), consuming both to produce BC3 output. It is a pure function with no side effects.

4. **Anti-corruption layer**: The economics calculator does NOT import simulation internals. It receives `SimulationResult` as a read-only input and extracts only what it needs: `throughputSteadyBph`, `violations.length`, and basket counts.

5. **Ubiquitous language additions**: "good output" (zero-violation baskets), "amortized cost" (capex spread over operating hours), "break-even throughput" (costs / revenue per basket), "profit margin" (profit / revenue %).

### Red-Green-Refactor (Kent Beck / Martin Fowler)

Every checklist item follows this cycle strictly:

1. **RED** — Write a failing test that describes the desired behavior
2. **GREEN** — Write the minimum code to make the test pass
3. **REFACTOR** — Clean up without changing behavior; run `npm run ci` to verify

**Commit discipline:**
- One commit per red-green-refactor cycle per checklist item
- Commit message format: `[task-N] description` (e.g., `[task-1] Add EconomicsConfig interface and defaults`)
- Every commit must pass `npm run ci` (TypeScript + ESLint + all tests)
- Never commit red (failing) tests — the commit is always at green or refactor

### Refactoring Before Implementation (Martin Fowler)

Before implementing each task, identify preparatory refactoring that makes the change easy, then make the easy change. Specific refactorings identified:

**Task 0 — Preparatory refactoring for the entire feature:**
- `readParamsFromUi()` in `config.ts` has a DOM fallback path that creates a parallel truth. This must be eliminated before adding economics, or the economics config will diverge from the simulation config.

**Task 1 — Before adding EconomicsConfig:**
- `LineConfig` currently has no optional sub-objects. Adding `economics` is a structural change. Verify that `lineConfigFromSimParams()` round-trip handles the new field (it won't include economics since `SimParams` has no economics — this is correct, economics is config-only).

**Task 3 — Before adding builder mutations:**
- The Builder class has clear patterns for station/transport/settings mutations. Economics mutations follow the same pattern — no structural refactoring needed, just extension.

**Task 4 — Before persistence migration:**
- Read the existing persistence code to understand the current version scheme and migration pattern. The migration is additive (new field with defaults), so no schema-breaking changes.

---

## Specification: Input Model

### 1. Revenue Inputs

| Field | Type | Default | Where in UI | Notes |
|-------|------|---------|-------------|-------|
| `revenuePerArticle` | number | 0 | Economics section | Rs per successfully treated article |
| `articlesPerBasket` | number | 0 | Economics section | **Required** when economics is configured. No fallback — revenue is always derived as `articlesPerBasket x revenuePerArticle` |

Revenue/hr derivation:
```
revenuePerBasket = articlesPerBasket x revenuePerArticle    (always derived, never a direct input)
revenuePerHr     = throughputSteadyBph x revenuePerBasket
```

**"Good output" definition:** A basket is "good" if and only if it completes the entire line with **zero violations** across all tanks and water drying. Any violation — even one — means the basket is rejected. Violations are not allowed — a configuration that produces violations is broken.

### 2. Equipment Cost Inputs

| Field | Type | Default | Where in UI | Notes |
|-------|------|---------|-------------|-------|
| `wagonCostRs` | number | 0 | Per-wagon in Transport | One-time purchase cost per wagon |
| `wagonLifeYears` | number | 10 | Per-wagon in Transport | Useful life for amortization |
| `basketCostRs` | number | 0 | Economics section | One-time cost per basket fixture |
| `basketLifeYears` | number | 5 | Economics section | Useful life |

Amortized cost/hr = `costRs / (lifeYears x operatingHoursPerYear)`.

### 3. Chemical Cost Inputs (per tank — fixed only)

Each tank has a single fixed cost rate — the all-in hourly cost to keep that tank operational. The user provides this as a single Rs/hr input per tank.

| Field | Type | Default | Where in UI | Notes |
|-------|------|---------|-------------|-------|
| `tankFixedCostPerHr` | number | 0 | Per-tank in station card | Rs/hr — all-in tank operating cost. Rinse tanks default to 0 |

Total chemical cost/hr = `Sum(tankFixedCostPerHr)` across all tanks.

### 4. Operating Cost Inputs

| Field | Type | Default | Where in UI | Notes |
|-------|------|---------|-------------|-------|
| `operatorCostPerHr` | number | 0 | Economics section | Labor cost for line operators |
| `energyCostPerHr` | number | 0 | Economics section | Electricity/gas for wagons, ovens, pumps |
| `maintenanceCostPerHr` | number | 0 | Economics section | Scheduled maintenance amortized hourly |
| `waterAndEffluentCostPerHr` | number | 0 | Economics section | Water supply + effluent treatment (ETP) |

### 5. Violations — Strict Zero-Tolerance

Violations are **not allowed**. There is no violation cost input. A configuration that produces violations is considered invalid — the user must fix it until violations reach zero. The dashboard treats violations as a **hard constraint**: if violations exist, a red warning replaces the profit card.

### 6. Plant-Level Inputs

| Field | Type | Default | Where in UI | Notes |
|-------|------|---------|-------------|-------|
| `operatingHoursPerYear` | number | 4000 | Economics section | Default 4000 = 2 shifts x 250 days |

---

## Specification: Dashboard Output

### North Star: Profit/Hr Card

```
+-------------------------------------------------------+
|  PROFIT / HOUR                                        |
|  Rs 1,247 /hr                          37% margin     |
|                                                       |
|  Revenue: Rs 3,400/hr    Costs: Rs 2,153/hr           |
|  Good output: 3.8 bph x 20 articles x Rs 44.7/article|
+-------------------------------------------------------+
```

- Profit margin = `profitPerHr / revenuePerHr x 100`
- Green if positive, red if negative
- If violations exist: red warning card replaces profit card

**`formatCurrency(value)` utility:**
- `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`
- `maximumFractionDigits: 0` for values >= 100
- Compact notation for >= 1,00,000 ("Rs 1.2L", "Rs 3.4Cr")

### Cost Breakdown

```
+------------------------------------------+
|  COSTS / HOUR            Rs 2,052 /hr    |
|                                          |
|  Equipment (amortized)     Rs 312 /hr    |
|    Wagons (2x)  Rs 240                   |
|    Baskets (4x) Rs 72                    |
|  Chemicals                 Rs 540 /hr    |
|    T1 Degreasing  Rs 180                 |
|    T2 Phosphating Rs 340                 |
|    T3 Rinse       Rs 0                   |
|  Water & Effluent          Rs 150 /hr    |
|  Labor                     Rs 450 /hr    |
|  Energy                    Rs 280 /hr    |
|  Maintenance               Rs 120 /hr    |
|                                          |
|  Chemical cost: 16% of revenue           |
+------------------------------------------+
```

### Key Derived Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Profit/hr** | Revenue/hr - Total Cost/hr | North star |
| **Profit margin %** | Profit/hr / Revenue/hr x 100 | Context for absolute profit |
| **Cost per basket** | Total Cost/hr / throughputSteadyBph | Unit economics |
| **Cost per article** | Cost per basket / articlesPerBasket | Quoting metric |
| **Chemical cost % of revenue** | Chemical cost/hr / Revenue/hr x 100 | Most actionable cost lever |
| **Break-even throughput** | Total costs/hr / revenue/basket | All costs fixed, so break-even = total / revenue per basket |
| **Equipment cost/hr** | Sum(costRs / lifeYears / operatingHrsPerYear) | Capex to hourly |

---

## Implementation Checklist

Each sub-task follows a strict engineering discipline. The template for every item:

```
UNDERSTAND  → Read relevant code before touching it (Fowler: "never change code you haven't read")
REFACTOR    → Make the change easy first (Fowler: preparatory refactoring)
RED         → Write a failing test that describes desired behavior
GREEN       → Write minimum code to pass the test
REFACTOR    → Clean up without changing behavior
CI          → Run `npm run ci` (TypeScript + ESLint + all tests)
COMMIT      → One commit at green. Message format: `[task-N] description`
```

For UI-only items (no unit tests possible): replace RED/GREEN with IMPLEMENT, keep CI and COMMIT.

---

### Task 0: Pipeline Fix — Single Source of Truth

**DDD context:** The `readParamsFromUi()` DOM fallback creates a parallel truth for the `LineConfig` aggregate. This is a Fowler "Divergent Change" smell. Must be eliminated before adding economics.

#### task-0: Remove DOM fallback

- [ ] UNDERSTAND: Read `src/ui/config.ts` — map the two paths: `state.params` vs DOM fallback in `readParamsFromUi()`
- [ ] UNDERSTAND: Identify all callers of `readParamsFromUi()` — confirm it's only `recomputePlan()`
- [ ] REFACTOR: Identify dead code that becomes unreachable after removing the fallback (`readRecipeStepsFromSidebar()`)
- [ ] RED: Write test that `recomputePlan()` uses `lineConfigToSimParams(state.lineConfig)` as sole source
- [ ] GREEN: Change `recomputePlan()` to use `lineConfigToSimParams(state.lineConfig)`, remove DOM fallback
- [ ] REFACTOR: Delete dead `readRecipeStepsFromSidebar()` function
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-0] Remove DOM fallback, use lineConfig as single source of truth`

---

### Task 1: Domain Model — EconomicsConfig Value Object

**DDD context:** `EconomicsConfig` is a value object attached to the `LineConfig` aggregate root. It describes the financial parameters of a line. No identity, no lifecycle.

#### task-1a: EconomicsConfig interface and defaults

- [ ] UNDERSTAND: Read `LineConfig` interface and `createDefaultLineConfig()` in `src/builder/LineConfig.ts`
- [ ] UNDERSTAND: Read `lineConfigFromSimParams()` — confirm economics won't round-trip through SimParams (correct — economics is config-only)
- [ ] RED: Write test `createDefaultEconomicsConfig()` returns object with all zeros except `operatingHoursPerYear: 4000`
- [ ] GREEN: Add `EconomicsConfig` interface and `createDefaultEconomicsConfig()` to `LineConfig.ts`
- [ ] REFACTOR: Clean up any imports or exports
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-1a] Add EconomicsConfig value object with defaults`

#### task-1b: Attach EconomicsConfig to LineConfig aggregate

- [ ] UNDERSTAND: Check all existing code that creates `LineConfig` objects — will adding a required field break anything?
- [ ] RED: Write test `createDefaultLineConfig().economics` is defined and matches default economics
- [ ] GREEN: Add `economics: EconomicsConfig` to `LineConfig` interface, update `createDefaultLineConfig()`
- [ ] REFACTOR: Fix TypeScript errors in any code that constructs `LineConfig` (e.g., `lineConfigFromSimParams`)
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-1b] Attach EconomicsConfig to LineConfig aggregate`

#### task-1c: Station and Wagon cost fields

- [ ] UNDERSTAND: Read `StationConfig` and `WagonConfig` interfaces — confirm optional fields are safe to add
- [ ] RED: Write test that `StationConfig` accepts optional `tankFixedCostPerHr`
- [ ] GREEN: Add `tankFixedCostPerHr?: number` to `StationConfig`
- [ ] RED: Write test that `WagonConfig` accepts optional `costRs` and `lifeYears`
- [ ] GREEN: Add `costRs?: number` and `lifeYears?: number` to `WagonConfig`
- [ ] REFACTOR: No cleanup needed — fields are optional
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-1c] Add cost fields to StationConfig and WagonConfig`

#### task-1d: EconomicsResult output type

- [ ] UNDERSTAND: Read `SimulationResult` in `src/types.ts` — understand the existing output type pattern
- [ ] RED: Write test that imports and constructs a valid `EconomicsResult` (TypeScript compile check)
- [ ] GREEN: Add `EconomicsResult` interface to `src/types.ts`
- [ ] REFACTOR: Ensure interface is exported
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-1d] Add EconomicsResult output type`

---

### Task 2: Economics Calculator — Pure Domain Service (TDD)

**DDD context:** `calculateEconomics()` is a pure domain service at the boundary between Configuration (BC1) and Simulation (BC2). It takes `LineConfig` + `SimulationResult`, produces `EconomicsResult`. No side effects, no state.

#### task-2a: Calculator stub with zero-case test

- [ ] UNDERSTAND: Read `SimulationResult` interface — identify fields needed: `throughputSteadyBph`, `violations`, `baskets`
- [ ] UNDERSTAND: Read `Violation` interface — confirm `basketId` field exists
- [ ] RED: Create `src/engine/economics.test.ts`. Test `calculateEconomics(defaultConfig, zeroResult)` returns all zeros, profit = 0
- [ ] GREEN: Create `src/engine/economics.ts` with stub `calculateEconomics()` returning zero-valued `EconomicsResult`
- [ ] REFACTOR: Ensure function signature is clean
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2a] Economics calculator stub with zero-case test`

#### task-2b: Revenue calculation

- [ ] RED: Test revenue-only config (revenuePerArticle=50, articlesPerBasket=20, throughput=4) -> profit = revenue = 4000, margin = 100%
- [ ] GREEN: Implement revenue: `throughputSteadyBph x articlesPerBasket x revenuePerArticle`
- [ ] REFACTOR: Extract `revenuePerBasket` derivation if needed
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2b] Revenue calculation`

#### task-2c: Cost breakdown calculation

- [ ] RED: Test costs-only config -> profit = -costs
- [ ] RED: Test equipment amortization: `costRs / (lifeYears x operatingHoursPerYear)`
- [ ] RED: Test chemical cost sums across all tanks (fixed costs only)
- [ ] RED: Test multiple wagons with different costs -> sum of individual amortizations
- [ ] GREEN: Implement all cost calculations
- [ ] REFACTOR: Extract `amortize(cost, life, hours)` helper if pattern repeats
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2c] Cost breakdown calculation`

#### task-2d: Edge case handling

- [ ] RED: Test `lifeYears = 0` -> amortization = Infinity, handled gracefully
- [ ] RED: Test `operatingHoursPerYear = 0` -> handled gracefully (no crash)
- [ ] RED: Test zero throughput -> revenue = 0, costPerBasket = Infinity
- [ ] RED: Test `articlesPerBasket = 0` -> revenuePerBasket = 0, revenue = 0
- [ ] GREEN: Add defensive guards — all division-by-zero returns Infinity or 0, never NaN
- [ ] REFACTOR: Ensure consistent guard pattern across all divisions
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2d] Edge case handling — no NaN`

#### task-2e: Violation detection flag

- [ ] RED: Test simulation with violations -> `hasViolations = true`
- [ ] RED: Test `countUniqueViolatedBaskets([{basketId:"B1"}, {basketId:"B1"}, {basketId:"B2"}])` returns 2
- [ ] GREEN: Implement `countUniqueViolatedBaskets(violations)` helper using `new Set()` on basketId
- [ ] GREEN: Set `hasViolations = violations.length > 0` in calculator
- [ ] REFACTOR: Ensure helper is exported for reuse
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2e] Violation detection flag and unique basket counter`

#### task-2f: Derived metrics

- [ ] RED: Test break-even throughput = totalCosts/hr / revenuePerBasket
- [ ] RED: Test break-even when revenuePerBasket = 0 -> Infinity
- [ ] RED: Test chemical cost as % of revenue (540/3400 = 15.88%)
- [ ] RED: Test profit margin % = profitPerHr / revenuePerHr x 100
- [ ] GREEN: Implement all derived metrics
- [ ] REFACTOR: Ensure ratio calculations handle zero revenue gracefully
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2f] Derived metrics — break-even, margins, ratios`

#### task-2g: Full integration test

- [ ] RED: Test full config with all inputs populated -> verify every field in EconomicsResult
- [ ] GREEN: Should already pass if all previous tests pass — if not, fix
- [ ] REFACTOR: Review test for completeness
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2g] Full economics integration test`

#### task-2h: formatCurrency utility

- [ ] RED: Test `formatCurrency(1247)` returns Rs-formatted string without decimals
- [ ] RED: Test `formatCurrency(124700)` uses compact lakh notation
- [ ] RED: Test `formatCurrency(0)` returns Rs 0
- [ ] RED: Test `formatCurrency(34500000)` uses crore notation
- [ ] GREEN: Implement `formatCurrency()` using `Intl.NumberFormat("en-IN")`
- [ ] REFACTOR: Ensure utility is exported from economics module
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-2h] formatCurrency utility with Indian number formatting`

---

### Task 3: Builder — Economics Mutation Methods

**DDD context:** The Builder is the command interface for the `LineConfig` aggregate. Economics mutations are simple setters following the same pattern as existing station/transport/settings mutations.

#### task-3a: Revenue mutations

- [ ] UNDERSTAND: Read `Builder` class mutation pattern — direct property set with optional validation
- [ ] RED: Test `builder.setRevenuePerArticle(50)` -> `config.economics.revenuePerArticle === 50`
- [ ] RED: Test `builder.setArticlesPerBasket(20)` -> `config.economics.articlesPerBasket === 20`
- [ ] GREEN: Add `setRevenuePerArticle()` and `setArticlesPerBasket()` to Builder
- [ ] REFACTOR: Ensure validation (non-negative) matches existing setter pattern
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-3a] Builder revenue mutations`

#### task-3b: Operating cost mutations

- [ ] RED: Test `setOperatorCostPerHr(450)` updates config
- [ ] RED: Test `setEnergyCostPerHr(280)` updates config
- [ ] RED: Test `setMaintenanceCostPerHr(120)` updates config
- [ ] RED: Test `setWaterEffluentCostPerHr(150)` updates config
- [ ] GREEN: Add all four setters
- [ ] REFACTOR: No cleanup needed — simple setters
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-3b] Builder operating cost mutations`

#### task-3c: Equipment and plant mutations

- [ ] RED: Test `setBasketCostRs(50000)` updates config
- [ ] RED: Test `setBasketLifeYears(5)` updates config
- [ ] RED: Test `setOperatingHoursPerYear(6000)` updates config
- [ ] GREEN: Add the three setters
- [ ] REFACTOR: No cleanup needed
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-3c] Builder equipment and plant mutations`

#### task-3d: Per-station and per-wagon cost mutations

- [ ] RED: Test `builder.setTankFixedCostPerHr(1, 180)` sets cost on tank at station index 1
- [ ] RED: Test throws error for non-tank station index
- [ ] RED: Test `builder.setWagonCostRs(0, 1200000)` sets cost on wagon 0
- [ ] RED: Test `builder.setWagonLifeYears(0, 10)` sets life on wagon 0
- [ ] GREEN: Add `setTankFixedCostPerHr()`, `setWagonCostRs()`, `setWagonLifeYears()`
- [ ] REFACTOR: Ensure index validation matches existing pattern (e.g., `setDwell()`)
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-3d] Builder per-station and per-wagon cost mutations`

---

### Task 4: Persistence — v4 Migration

**DDD context:** Persistence is infrastructure. Schema evolution must be backward-compatible — v3 configs load with default economics.

#### task-4: v3 to v4 migration

- [ ] UNDERSTAND: Read `src/builder/persistence.ts` — understand current version scheme and migration chain
- [ ] UNDERSTAND: Identify current version number
- [ ] RED: Test loading a v3 draft (no `economics`) -> migrates with `createDefaultEconomicsConfig()`
- [ ] RED: Test loading a v4 draft (has `economics`) -> preserves existing values
- [ ] RED: Test station `tankFixedCostPerHr` defaults to undefined on migration
- [ ] RED: Test wagon `costRs` and `lifeYears` default to undefined on migration
- [ ] GREEN: Add v3->v4 migration logic to persistence.ts
- [ ] REFACTOR: Ensure migration chain is documented
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-4] Persistence v4 migration with economics defaults`

---

### Task 5: Renderer — Economics Input UI

**DDD context:** Presentation layer. No domain logic — translates `EconomicsConfig` into HTML inputs and wires to Builder mutations.

#### task-5a: Economics collapsible section

- [ ] UNDERSTAND: Read `src/builder/renderer.ts` — study existing `<details>` / `<summary>` section pattern (`.config-section--details`)
- [ ] UNDERSTAND: Identify insertion point (below Sim Settings, above Run button)
- [ ] UNDERSTAND: Study how inputs wire to builder mutations (event listeners -> builder method -> recompute)
- [ ] REFACTOR: If existing section rendering has duplication, extract a helper before adding new section
- [ ] IMPLEMENT: Add `<details class="config-section--details">` for Economics, **collapsed by default** (no `open` attribute)
- [ ] IMPLEMENT: Summary badge on collapsed state: `.badge` with text "No economics configured" (dynamic — updates to "Rs X/hr profit" when economics exist)
- [ ] IMPLEMENT: **Revenue fieldset** (`<fieldset>` + `<legend>` "Revenue"):
  - Revenue per article (Rs) — `.station-card__input` type="number", placeholder="typical: 30-80"
  - Articles per basket — `.station-card__input` type="number", placeholder="typical: 10-50"
- [ ] IMPLEMENT: **Costs fieldset** (`<fieldset>` + `<legend>` "Operating Costs"):
  - Labor (Rs/hr) — `.station-card__input`
  - Energy (Rs/hr) — `.station-card__input`
  - Maintenance (Rs/hr) — `.station-card__input`
  - Water & Effluent (Rs/hr) — `.station-card__input`
- [ ] IMPLEMENT: **Equipment fieldset** (`<fieldset>` + `<legend>` "Equipment"):
  - Basket cost (Rs) — `.station-card__input`
  - Basket life (years) — `.station-card__input`
- [ ] IMPLEMENT: **Plant fieldset** (`<fieldset>` + `<legend>` "Plant"):
  - Operating hours/year — `.station-card__input`, default value 4000
  - Hint text: "default: 4000 (2 shifts x 250 days)" in `.field__hint` (10px, italic, `--muted`)
- [ ] IMPLEMENT: Add CSS for `.economics-fieldset` (border: 1px solid `--border`, border-radius: `--radius`, padding: 8px, margin-bottom: 6px)
- [ ] IMPLEMENT: Add CSS for `.economics-fieldset__legend` (11px, weight 600, uppercase, `--muted`)
- [ ] IMPLEMENT: Add CSS for `.field__hint` (10px, italic, `--muted`, margin-top: 2px)
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-5a] Economics collapsible section with fieldset sub-groups`

#### task-5b: Per-tank and per-wagon cost inputs

- [ ] UNDERSTAND: Read station card rendering — identify where tank-specific fields (dwell, tolerance) are rendered
- [ ] UNDERSTAND: Read wagon card rendering — identify where per-wagon fields (speed, handling) are rendered
- [ ] IMPLEMENT: Add thin `<hr class="separator">` before cost field in station cards (1px, `--border` color)
- [ ] IMPLEMENT: Add "Tank cost (Rs/hr)" input in `.station-card` for chemical and rinse tanks only (not extra/loading/unloading)
- [ ] IMPLEMENT: Add hint text below tank cost: "all-in: heating, chemicals, agitation" (`.field__hint`)
- [ ] IMPLEMENT: Add `<hr class="separator">` before cost fields in `.wagon-config-card`
- [ ] IMPLEMENT: Add "Wagon cost (Rs)" and "Wagon life (years)" inputs in wagon cards
- [ ] IMPLEMENT: Wire each input to builder mutation (`setTankFixedCostPerHr`, `setWagonCostRs`, `setWagonLifeYears`)
- [ ] CI: `npm run ci`
- [ ] MANUAL TEST: All inputs render, values persist, separator styling correct
- [ ] COMMIT: `[task-5b] Per-tank and per-wagon cost inputs with separators`

---

### Task 6: Dashboard Renderer

**DDD context:** Output surface. Renders `EconomicsResult` as financial summary. Consumes domain service output — no calculation logic here.

#### task-6a: AppState extension

- [ ] UNDERSTAND: Read `AppState` in `src/types.ts` — understand existing state shape
- [ ] RED: Write test that `AppState` type accepts `economics: EconomicsResult | null`
- [ ] GREEN: Add `economics` field to `AppState`
- [ ] REFACTOR: Ensure all `AppState` initializations include `economics: null`
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-6a] Add economics to AppState`

#### task-6b: Financial dashboard renderer

- [ ] UNDERSTAND: Read `renderConstraintsTab()` in `config.ts` — study existing DOM creation pattern (createElement, className, innerHTML)
- [ ] IMPLEMENT: Create `src/ui/dashboard.ts` with `renderFinancialDashboard(economics: EconomicsResult, container: HTMLElement): void`
- [ ] IMPLEMENT: **Profit/hr hero card** (`.financial-card.financial-card--hero`):
  - Left border: 3px solid `--accent2` (profit) or `--danger` (loss)
  - Header: "PROFIT / HOUR" (11px uppercase `--muted`) + `.badge` with margin %
  - Value: `formatCurrency(profitPerHr)` + "/hr" (24px, weight 700, `--accent2` or `--danger`)
  - Detail line: Revenue vs Costs, throughput x articles x price/article (12px, `--muted`)
- [ ] IMPLEMENT: **Violation alert** (`.violation-alert`) — replaces hero card when `hasViolations`:
  - Left border: 3px solid `--danger`
  - Background: `rgba(255,107,107,0.08)`
  - Title: "CONFIGURATION HAS VIOLATIONS" (13px weight 700, `--danger`)
  - Description: "Fix timing before economics are meaningful." (12px, `--muted`)
- [ ] IMPLEMENT: **Cost breakdown card** (`.financial-card`):
  - Header: "COSTS / HOUR" + total (right-aligned)
  - Cost groups (`.cost-group`) separated by `.separator` (1px `--border`):
    - Equipment (amortized): wagon + basket sub-items
    - Chemicals: per-tank sub-items (only non-zero tanks)
    - Operating: water, labor, energy, maintenance sub-items (only non-zero)
  - Category total: 12px weight 600, right-aligned
  - Sub-items: 11px `--muted`, indented 16px
  - Footer: "Chemical cost: X% of revenue" (11px, `--accent2`)
- [ ] IMPLEMENT: **Unit economics card** (`.financial-card`):
  - Header: "UNIT ECONOMICS" (11px uppercase `--muted`)
  - Three-column grid (`.grid3`):
    - Cost/basket (label 10px `--muted` uppercase, value 15px weight 600)
    - Cost/article (same pattern)
    - Break-even (value colored: `--accent2` if above break-even, `--danger` if below)
- [ ] IMPLEMENT: **Progressive disclosure**: Only render cards when there's meaningful data:
  - Hero card: only when `revenuePerArticle > 0 && articlesPerBasket > 0`
  - Cost breakdown: only when any cost > 0
  - Unit economics: only when both revenue and costs are configured
- [ ] IMPLEMENT: Use `formatCurrency()` for all monetary values throughout
- [ ] CI: `npm run ci`
- [ ] COMMIT: `[task-6b] Financial dashboard renderer with shadcn-inspired cards`

#### task-6c: Wire into pipeline + styles

- [ ] UNDERSTAND: Read `recomputeAndRender()` pipeline — identify exact insertion points
- [ ] REFACTOR: If `updateResults()` is too coupled, extract financial rendering as a separate step
- [ ] IMPLEMENT: Add `<section id="financialDashboard"></section>` to `index.html`, placed **above** `#constraintsBody`
- [ ] IMPLEMENT: Wire `calculateEconomics()` into `recomputeAndRender()` in `config.ts`
- [ ] IMPLEMENT: Wire `renderFinancialDashboard()` to populate `#financialDashboard` on each recompute
- [ ] IMPLEMENT: Add CSS to `styles.css`:
  - `.financial-card`: border 1px solid `--border`, border-radius `--radius`, background `--surface`, padding 12px, margin-bottom 8px
  - `.financial-card--hero`: border-left 3px solid (dynamic), padding 14px
  - `.financial-card__header`: 11px uppercase `--muted`, letter-spacing 0.05em, display flex, justify-content space-between
  - `.financial-card__value`: 24px weight 700, margin 4px 0
  - `.financial-card__detail`: 12px `--muted`
  - `.violation-alert`: border-left 3px solid `--danger`, background `rgba(255,107,107,0.08)`, padding 12px, border-radius `--radius`
  - `.cost-group`: padding 6px 0
  - `.cost-group__item`: 11px `--muted`, padding-left 16px
  - `.separator`: 1px solid `--border`, margin 4px 0
- [ ] IMPLEMENT: Ensure existing constraints section renders below financial dashboard
- [ ] CI: `npm run ci`
- [ ] MANUAL TEST: Profit card renders with correct colors, progressive disclosure works (cards appear/hide based on input)
- [ ] COMMIT: `[task-6c] Wire financial dashboard + CSS styles`

---

### Task 7: Integration & Polish

#### task-7: End-to-end verification

- [ ] CI: `npm run ci` — TypeScript compiles, ESLint passes, all tests pass
- [ ] MANUAL TEST: Economics section collapsed with "No economics configured" summary
- [ ] MANUAL TEST: Enter revenue + costs -> profit card appears with margin %
- [ ] MANUAL TEST: Change wagon count -> equipment cost changes, profit updates
- [ ] MANUAL TEST: Change dwell time -> throughput changes, revenue changes, profit updates
- [ ] MANUAL TEST: Introduce violations (reduce dwell tolerance) -> red warning replaces profit card
- [ ] MANUAL TEST: Fix violations -> profit card reappears with correct numbers
- [ ] MANUAL TEST: Chemical cost % of revenue shown in cost breakdown
- [ ] MANUAL TEST: Indian number format correct (lakhs/crores, compact for large values)
- [ ] MANUAL TEST: Load v3 persistence draft -> migrates cleanly with default economics
- [ ] MANUAL TEST: Zero-input edge case -> shows Rs 0 profit, not NaN
- [ ] COMMIT: `[task-7] Integration polish and verification`

---

## Type Definitions (reference)

```typescript
// src/builder/LineConfig.ts — new value object
export interface EconomicsConfig {
  revenuePerArticle: number;
  articlesPerBasket: number;
  operatorCostPerHr: number;
  energyCostPerHr: number;
  maintenanceCostPerHr: number;
  waterAndEffluentCostPerHr: number;
  basketCostRs: number;
  basketLifeYears: number;
  operatingHoursPerYear: number;
}

// Additions to existing interfaces
interface StationConfig { tankFixedCostPerHr?: number; }
interface WagonConfig { costRs?: number; lifeYears?: number; }
interface LineConfig { economics: EconomicsConfig; }
```

```typescript
// src/types.ts — new value object
export interface EconomicsResult {
  revenuePerHr: number;
  totalCostPerHr: number;
  profitPerHr: number;
  profitMarginPct: number;

  costBreakdown: {
    equipmentPerHr: number;
    wagonCostPerHr: number;
    basketCostPerHr: number;
    chemicalPerHr: number;
    laborPerHr: number;
    energyPerHr: number;
    maintenancePerHr: number;
    waterEffluentPerHr: number;
  };

  unitEconomics: {
    costPerBasket: number;
    costPerArticle: number;
    revenuePerBasket: number;
    profitPerBasket: number;
  };

  ratios: {
    chemicalCostPctOfRevenue: number;
  };

  throughputBph: number;
  hasViolations: boolean;
  breakEvenBph: number;
}
```

---

## Critical Files Summary

| File | Task | Change |
|------|------|--------|
| `src/ui/config.ts` | 0 | Remove DOM fallback, single source of truth |
| `src/builder/LineConfig.ts` | 1 | Add `EconomicsConfig`, tank/wagon cost fields, defaults |
| `src/builder/LineConfig.test.ts` | 1 | Economics defaults and round-trip tests |
| `src/types.ts` | 1, 6 | Add `EconomicsResult`, add `economics` to `AppState` |
| `src/engine/economics.ts` | 2 | **NEW** — Pure domain service + `formatCurrency()` |
| `src/engine/economics.test.ts` | 2 | **NEW** — 17+ test cases, TDD |
| `src/builder/builder.ts` | 3 | Economics mutation methods |
| `src/builder/builder.test.ts` | 3 | Economics mutation tests |
| `src/builder/persistence.ts` | 4 | v3->v4 migration |
| `src/builder/persistence.test.ts` | 4 | Migration tests |
| `src/builder/renderer.ts` | 5 | Economics input section (collapsed, sub-grouped) |
| `src/ui/dashboard.ts` | 6 | **NEW** — Financial dashboard renderer |
| `index.html` | 6 | Add financial dashboard section |
| `styles.css` | 6 | Financial dashboard styles |

---

## Deferred to v2

- **What-if delta comparison** — Store `prevEconomicsResult`, show deltas on config change
- **Incremental payback period** — Requires baseline scenario comparison
- **Bath lifecycle costs** — `bathDumpCostRs` + `bathLifeHours` for periodic tank drain/refill
- **Variable chemical costs (per-basket)** — Drag-out modeling. v1 uses fixed-only for simplicity
- **Violation costing** — If zero-tolerance is relaxed, add `violationCostRs` per basket
- **Minimum simulation hours** — Derive formula for minimum sim hours required for stable `throughputSteadyBph`
- **Sludge/hazardous waste disposal** — Needs more domain research
- **Cost per square meter** — Surface-area based pricing for some customers
- **Overhead/factory allocation** — Percentage-based overhead add-on
