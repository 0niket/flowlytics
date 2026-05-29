# Article Type Selection — Design Analysis

**Diagram:** `article_type_selection.png`
**Domain:** UI/UX redesign · Configuration model · Glossary expansion
**Relates to:** `src/types.ts`, `src/ui/config.ts`, `src/engine/layout.ts`, `src/glossary/data.ts`

---

## 1. Visual Description

The diagram is a hand-drawn sketch in a fan-out (one-to-many) structure on a white background.

### Elements

**Source node (left):** A rounded rectangle containing the two-line label **"Select Article / Material Type"**. It is the sole trigger/input control. No icon, no sublabel, no state indicator.

**Three directed arrows:** Originate at the right edge of the source node and fan outward to the three option nodes. They are hand-drawn with arrowheads on the destination ends. Top and bottom arrows angle away from centre; the middle arrow is horizontal. The arrows communicate that the source control produces exactly one of these three outcomes — mutual exclusion is implied by the fan-out shape.

**Option node 1 — "Mild Steel":** Rounded rectangle at top-right. Roman, upright font. Represents the industry-standard low-carbon steel material class.

**Option node 2 — "Aluminium":** Rounded rectangle at centre-right. Italic/cursive font — visually differentiating it as a distinct material family. Uses British/international spelling ("Aluminium" not "Aluminum").

**Option node 3 — "Other":** Rounded rectangle at bottom-right. Roman font. Acts as an explicit catch-all for any material not in the named list.

**Annotation (top-right, handwritten):**
> *"Selection of Article Material Type should be a searchable dropdown with a static list of options including Mild Steel, Aluminium, and many other common material that used in industry."*

### Structural observations

- All three option nodes are at the same visual level — no hierarchy, no secondary branching, no conditional paths. The three options are equal-weight peers.
- The annotation deliberately says "including ... and many other" — the three visible nodes are *examples*, not the exhaustive list.
- No colour coding. No icons. The only visual distinction between Mild Steel and Aluminium is the font style of the option node labels.
- The diagram communicates two things simultaneously: (1) **interaction pattern** — a searchable dropdown, not a radio group or tabbed selector; (2) **vocabulary scope** — the list is long enough to require search, not short enough to show all at once.

---

## 2. Domain Meaning

### 2.1 "Article" as a domain term

The label **"Article Material Type"** introduces the word **Article** — the industrial term for the manufactured workpiece being surface-treated (e.g. a car door panel, a structural bracket, a chassis rail, a pipe fitting). An Article is the physical part(s) that ride *inside* the Basket through the chemical line.

This is distinct from the existing glossary term **Basket** (`src/glossary/data.ts`, "Simulation Concepts"), which describes the carrier/rack/fixture that transports articles. The distinction is:

| Term | Refers to | Existing glossary entry |
|---|---|---|
| **Basket** | The rack/fixture/carrier that holds parts | Yes — "Simulation Concepts" |
| **Article** | The actual manufactured part(s) inside the basket | **Missing** |
| **Article Material Type** | The base metal classification of the article | **Missing** |

The current "Recipe Preset" glossary entry conflates two separate concerns: *what material you are treating* and *what dwell times that material requires*. The diagram explicitly separates them. Material type is a first-class identity; dwell times are a downstream consequence of that identity.

### 2.2 Why material type is a primary process variable

In pretreatment line engineering, the article material is the single most important input to line configuration because it determines:

- **Default dwell times:** Mild steel requires longer immersion in degreasing and phosphating baths (typically 2.5 min/tank). Aluminium reacts faster and needs shorter, tighter windows (1.5 min/tank). Getting this wrong produces defective parts.
- **Chemical bath selection:** Mild steel uses zinc phosphating. Aluminium uses chromating or zirconium-based conversion coatings. Stainless steel uses acid pickling. These are different tank chemistries, not just different timings.
- **Violation severity:** Aluminium over-dwell in a chromating tank is catastrophic — the surface dissolves visibly within 30 extra seconds. Mild steel over-dwell in a phosphating bath is more forgiving. The glossary entry for Aluminum (AL) documents this explicitly.
- **Tolerance settings:** Tight process windows for reactive materials (aluminium, brass) require lower tolerance percentages on the dwell clock. Forgiving materials (rinse tanks, mild steel) can accept wider windows.
- **WDO requirements:** Aluminium parts have lower thermal mass and reach drying temperature faster; heavier steel articles may need longer WDO times.

### 2.3 The three option nodes

**Mild Steel** maps exactly to the existing glossary entry "Mild Steel (MS)" (section: "Materials", `src/glossary/data.ts:204`): low-carbon steel (AISI 1018/1020), the most common pretreatment material, 2.5 min/tank dwell preset, phosphate-based pretreatment recipe. No new meaning introduced.

**Aluminium** maps to the existing glossary entry "Aluminum (AL)" (section: "Materials", `src/glossary/data.ts:210`). Note the spelling discrepancy: the glossary uses the American spelling "Aluminum" while the diagram uses the international/British standard "Aluminium". Both refer to the same material class — this is a cosmetic inconsistency worth resolving. The 1.5 min/tank dwell and tight tolerance requirement are already documented.

**Other** introduces a new concept with no codebase representation and no glossary entry. It means:
- A third category: any material not explicitly named in the static list (Stainless Steel, Zinc, Galvanised Steel, Copper, Brass, Magnesium alloy, Cast Iron, HSS)
- A gateway to full custom per-tank configuration rather than a preset-driven default
- Implicitly, user responsibility: "Other" means the system cannot suggest defaults, so the user must specify every dwell time manually

### 2.4 The searchable dropdown requirement

The annotation specifies the control "should be a searchable dropdown with a static list of options." This communicates:

1. **Searchable (autocomplete/combobox):** The user types to filter the list. This implies the list is long enough that scrolling alone is cumbersome — estimated 15–30 named materials in industrial practice.
2. **Static list:** Options are hardcoded data, not fetched from an API or user-defined. The system owns the vocabulary.
3. **Inclusive of Mild Steel and Aluminium:** The two named nodes in the diagram are entries *in* this dropdown, not separate from it. The fan-out diagram is illustrating what the dropdown produces, not showing three separate controls.

The current `<select id="recipePreset">` with three options (`ms`, `al`, `custom`) does not satisfy this requirement — it is not searchable and it does not expose a named material vocabulary.

---

## 3. Cross-Reference with Existing Glossary

### Terms the diagram maps to directly

| Diagram concept | Glossary term | Section | Match quality |
|---|---|---|---|
| Mild Steel | "Mild Steel (MS)" | Materials | Exact |
| Aluminium | "Aluminum (AL)" | Materials | Near-exact (American vs British spelling) |
| The preset concept | "Recipe Preset" | Configuration | Partial — "Recipe Preset" conflates material identity with dwell config |

### The "Recipe Preset" gap

The glossary entry "Recipe Preset" (`src/glossary/data.ts:114`) describes the preset as "Pre-configured dwell time profiles for common materials. Mild Steel (MS) uses 2.5 min/tank, Aluminum (AL) uses 1.5 min/tank. Custom allows per-tank overrides."

This is accurate but names the concept from the *implementation* perspective (a preset is a shortcut for configuring dwell times). The diagram names it from the *domain* perspective (the primary classification is the material the article is made from). These are the same information seen from two different angles. The diagram is proposing the domain framing become the user-facing framing.

### New glossary entries required

| Proposed term | Section | Reason needed |
|---|---|---|
| **Article** | Simulation Concepts | The workpiece inside the basket; a domain term used in every real industrial context, currently absent |
| **Article Material Type** | Configuration | The classification of the article's base metal, distinct from the dwell recipe it implies |
| **Material Profile** | Configuration | The bundle of default dwell time, tolerance, and chemistry notes associated with a material type |
| **Other (Material)** | Materials | Catch-all; signals that the system cannot suggest defaults and the user must configure manually |

The existing "Recipe Preset" entry should be updated to cross-reference "Article Material Type" and explain that in the redesigned UI, material selection drives recipe defaults rather than users choosing a recipe that implies a material.

---

## 4. Mapping to the Current Codebase

### 4.1 `src/types.ts`

**`SimParams.preset` (line 77):** Currently typed as unguarded `string`. The value flows through the entire system — it is read in `readParamsFromUi` (config.ts:9), passed to `defaultRecipe` (layout.ts:82), and printed in exports (config.ts:387 as `p.preset.toUpperCase()`). There is no compile-time enforcement that only `"ms"`, `"al"`, or `"custom"` are valid values.

The diagram implies this field should be replaced with or supplemented by a typed `ArticleMaterialType` union — e.g.:

```typescript
export type ArticleMaterialType =
  | "mild_steel" | "aluminium" | "stainless_steel" | "galvanised_steel"
  | "cast_iron" | "brass" | "copper" | "zinc_die_cast" | "hss" | "other";
```

**`TankType` (line 51):** Currently `"chemical" | "rinse"` — this classifies the tank's chemical role, not the article. It is orthogonal to material type and should not be conflated. No change needed here.

**`RecipeStep` (lines 53–60):** Has no field recording what material the step is calibrated for. The material type belongs at `SimParams` level (one material per simulation run), not per-step. No change needed to `RecipeStep` itself, but the material type should be a named field on `SimParams` rather than being derivable only by parsing the `preset` string.

**`UiElements.recipePreset` (line 394):** Typed as `HTMLSelectElement`. If the control changes to a combobox backed by `<input>` + `<datalist>`, this type must change to `HTMLInputElement`. If a JS autocomplete component is used, the element reference may need to be the container `HTMLElement` with a separate accessor for the current value.

### 4.2 `src/ui/config.ts`

**`readParamsFromUi` (lines 7–47):** Reads `ui.recipePreset.value` at line 9 and passes it directly to `defaultRecipe`. If the control becomes a combobox, the raw value may be a display label ("Mild Steel") rather than the internal key ("ms" or "mild_steel"). A normalisation step is needed between the combobox output and `SimParams.preset`.

**`setupConfigPanel` — `recipePreset` change handler (lines 779–787):**

```typescript
// Current (config.ts:781–785)
if (preset === "ms") dwell = 2.5;
if (preset === "al") dwell = 1.5;
```

This hardcodes exactly the two material types shown in the diagram. Extending to a full material list requires replacing these `if` statements with a lookup against `MATERIAL_PROFILES` (see section 5.2).

**`rebuildTankTable` (lines 49–98):** Calls `defaultRecipe(tankCount, preset)` at line 10 of `readParamsFromUi`. The function rebuilds the tank dwell table using the dwell default from the preset. When the preset changes to a typed material type, the dwell default must come from the material profile lookup, and the tolerance default (`tolDefault`) parameter at line 769 should also come from the material profile (currently hardcoded to `10` — always 10% regardless of material).

**`recipePreset.addEventListener` (line 779):** The entire handler needs to be rewritten to:
1. Look up the selected `ArticleMaterialType` in `MATERIAL_PROFILES`
2. Set `dwellPreset.value` from `profile.defaultDwellMin`
3. Set a new `tolPreset` from `profile.defaultTolerancePct`
4. Call `rebuildTankTable` with both dwell and tolerance defaults
5. If material is `"other"`, expand `ui.tankOverridesDetails` so the user immediately sees the per-tank override table

### 4.3 `src/engine/layout.ts`

**`defaultRecipe` (lines 82–94):** This is the single place that translates material identity to dwell defaults. Current code:

```typescript
// layout.ts:83–85
let dwellMin = 2;
if (preset === "ms") dwellMin = 2.5;
if (preset === "al") dwellMin = 1.5;
```

And at line 89, tolerance is hardcoded to `0.1` (10%) regardless of material:

```typescript
steps.push({ ..., tankType: "chemical", tolerancePct: 0.1 });
```

Both of these must come from the material profile lookup when the material list is expanded. The function signature should change from `defaultRecipe(tankCount: number, preset: string)` to `defaultRecipe(tankCount: number, material: ArticleMaterialType)`.

---

## 5. Required Implementation Changes

### 5.1 Type additions (`src/types.ts`)

Add after the existing `TankType` definition (line 51):

```typescript
export type ArticleMaterialType =
  | "mild_steel" | "aluminium" | "stainless_steel" | "galvanised_steel"
  | "cast_iron" | "brass" | "copper" | "zinc_die_cast" | "hss" | "other";

export interface MaterialProfile {
  id: ArticleMaterialType;
  label: string;
  defaultDwellMin: number;
  defaultTolerancePct: number; // as integer percentage, e.g. 10 means ±10%
}
```

Update `SimParams` (line 73) — replace `preset: string` with:

```typescript
articleMaterialType: ArticleMaterialType;
preset: string; // keep temporarily for export label backward compat
```

Or remove `preset` entirely and derive export labels from `articleMaterialType`.

### 5.2 New static data (`src/materials/data.ts` — new file)

The annotation says "static list." This warrants a dedicated data file, not inlining into `layout.ts`:

```typescript
import type { MaterialProfile } from "../types";

export const MATERIAL_PROFILES: MaterialProfile[] = [
  { id: "mild_steel",       label: "Mild Steel",         defaultDwellMin: 2.5, defaultTolerancePct: 10 },
  { id: "aluminium",        label: "Aluminium",          defaultDwellMin: 1.5, defaultTolerancePct: 8  },
  { id: "stainless_steel",  label: "Stainless Steel",    defaultDwellMin: 3.0, defaultTolerancePct: 10 },
  { id: "galvanised_steel", label: "Galvanised Steel",   defaultDwellMin: 2.0, defaultTolerancePct: 12 },
  { id: "cast_iron",        label: "Cast Iron",          defaultDwellMin: 3.5, defaultTolerancePct: 10 },
  { id: "brass",            label: "Brass",              defaultDwellMin: 1.5, defaultTolerancePct: 8  },
  { id: "copper",           label: "Copper",             defaultDwellMin: 1.5, defaultTolerancePct: 8  },
  { id: "zinc_die_cast",    label: "Zinc Die Cast",      defaultDwellMin: 2.0, defaultTolerancePct: 10 },
  { id: "hss",              label: "HSS (High-Strength Steel)", defaultDwellMin: 2.5, defaultTolerancePct: 8 },
  { id: "other",            label: "Other",              defaultDwellMin: 2.0, defaultTolerancePct: 10 },
];
```

This array is both the source for the searchable dropdown and the lookup table for `defaultRecipe`.

### 5.3 Engine refactor (`src/engine/layout.ts`)

Refactor `defaultRecipe` at lines 82–94:

```typescript
// Before
export function defaultRecipe(tankCount: number, preset: string): RecipeStep[] {
  let dwellMin = 2;
  if (preset === "ms") dwellMin = 2.5;
  if (preset === "al") dwellMin = 1.5;
  // tolerance hardcoded to 0.1 at line 89

// After
import { MATERIAL_PROFILES } from "../materials/data";
import type { ArticleMaterialType } from "../types";

export function defaultRecipe(tankCount: number, material: ArticleMaterialType): RecipeStep[] {
  const profile = MATERIAL_PROFILES.find(p => p.id === material);
  const dwellMin = profile?.defaultDwellMin ?? 2.0;
  const tolerancePct = (profile?.defaultTolerancePct ?? 10) / 100;
  // tolerancePct now flows into each RecipeStep instead of hardcoded 0.1
```

This change makes `defaultRecipe` correct for all materials in the static list without any additional `if` branches.

### 5.4 UI changes (`src/ui/config.ts` + HTML)

**Replace `<select id="recipePreset">` with a searchable combobox.** The simplest approach is native HTML:

```html
<input id="recipePreset" list="materialOptionsList" placeholder="Search material..." autocomplete="off">
<datalist id="materialOptionsList">
  <!-- populated from MATERIAL_PROFILES at runtime -->
</datalist>
```

Or, for better UX (highlighted match, keyboard navigation), a small JS autocomplete widget.

**Update `UiElements` in `src/types.ts:394`:** Change `recipePreset: HTMLSelectElement` to `recipePreset: HTMLInputElement`.

**Rewrite the `recipePreset` change handler at `src/ui/config.ts:779–787`:**

```typescript
ui.recipePreset.addEventListener("input", () => {
  const label = ui.recipePreset.value.trim();
  const profile = MATERIAL_PROFILES.find(p => p.label === label);
  if (!profile) return; // user mid-typing, not yet a valid selection
  const dwell = profile.defaultDwellMin;
  const tol = profile.defaultTolerancePct;
  ui.dwellPreset.value = String(dwell);
  rebuildTankTable(Number(ui.tankCount.value), dwell, tol);
  if (profile.id === "other") ui.tankOverridesDetails.open = true;
  if (ui.autoRun.checked) recomputeAndRender();
});
```

**Populate the datalist at startup** inside `setupConfigPanel`:

```typescript
const datalist = document.getElementById("materialOptionsList");
if (datalist) {
  for (const p of MATERIAL_PROFILES) {
    const opt = document.createElement("option");
    opt.value = p.label;
    datalist.appendChild(opt);
  }
}
```

### 5.5 Glossary additions (`src/glossary/data.ts`)

Three new `GlossaryEntry` objects to append to `GLOSSARY_DATA`:

**Article** (section: "Simulation Concepts"):
- def: The physical manufactured part(s) loaded onto a basket for surface treatment. An article is distinct from the basket (the carrier): the basket moves through the line; the article is what gets treated.
- cause: Each line run processes a specific article type. The article's base metal determines the chemical recipe, dwell times, and violation tolerances.
- effect: Choosing the wrong material type produces misleading simulation results — dwell defaults, violation thresholds, and throughput estimates all derive from the article material.

**Article Material Type** (section: "Configuration"):
- def: The base metal classification of the article being processed. This is the primary configuration input: once the material is chosen, dwell time defaults and tolerance recommendations are set automatically.
- cause: Different metals require different chemical processes — mild steel phosphating differs fundamentally from aluminium chromating.
- effect: Selecting the correct material type ensures the simulation uses realistic process parameters. It is the starting point for all recipe configuration.

**Material Profile** (section: "Configuration"):
- def: The per-material bundle of configuration defaults: default dwell time, default tolerance percentage, and any material-specific notes. Profiles are defined in a static list covering common industrial materials.
- cause: Encoding material-specific defaults in a profile prevents manual lookup errors and ensures consistency across simulations.
- effect: Selecting a material from the dropdown automatically applies its profile's defaults to the entire tank table. The user only needs to override individual tanks where the recipe deviates from the material standard.

### 5.6 Spelling normalisation

The glossary entry for aluminium uses the American spelling "Aluminum" in the `term` field (`src/glossary/data.ts:210`) and throughout its `def`, `cause`, `effect`, and `example` text. The diagram uses "Aluminium" (British/international). The internal code identifier `"al"` (and the proposed `"aluminium"` key) is unaffected by spelling. All user-facing strings — glossary text, UI labels, export summaries — should be normalised to "Aluminium" to match the diagram and industrial convention in the UK/EU market.

---

## 6. Domain Redesign Perspective

The diagram signals a **conceptual inversion** in the configuration model.

### Current mental model (preset-first)

```
User opens config panel
→ Sees "Recipe Preset" dropdown (ms / al / custom)
→ Selects a preset
→ Dwell times populate (implicitly: "I've chosen a material")
→ User may not know what ms/al means without reading the glossary
```

### Redesigned mental model (material-first)

```
User opens config panel
→ Sees "Article Material Type" searchable input (first field)
→ Types or selects "Mild Steel"
→ Full recipe defaults populate from the material profile
→ User understands immediately: "I'm simulating a mild steel line"
```

This matters for three reasons:

1. **Clarity in exports:** The simulation summary (`exportSummaryText`, `src/ui/config.ts:707`) currently prints `p.preset.toUpperCase()` as the recipe label. With a named material profile, the export reads "Mild Steel, 12 tanks" instead of "MS, 12 tanks" — interpretable to a non-technical reviewer or a customer quotation reader.

2. **Extensibility without model changes:** A new material (e.g. "Zinc Die Cast") can be added to `MATERIAL_PROFILES` without touching `SimParams`, `defaultRecipe` logic, or the UI handler — the lookup table drives everything. The current `if/else` chain requires code changes for each new material.

3. **"Other" as a first-class state:** Currently, selecting "custom" in the preset dropdown means nothing except "dwell was manually changed." With a named "Other" material type, the system can distinguish "the user selected Other and set custom dwell" from "the user selected Mild Steel and then manually tuned one tank." This distinction is meaningful for export labelling and for future mixed-material support.

### UX redesign impact on the sidebar

The sidebar currently groups configuration by *parameter category* (Recipe, Transport, Simulation). The diagram proposes that **material type** becomes the lead field — the question asked before anything else. The natural sidebar order becomes:

1. **Article Material Type** (searchable dropdown — new, replaces Recipe Preset)
2. **Number of Tanks** + Tank dwell overrides table (existing, unchanged)
3. **WDO, Load/Unload times** (existing)
4. **Transport (wagons, speed)** (existing)
5. **Simulation settings** (existing)

This ordering matches how a process engineer thinks: first identify what they're treating, then configure the line around it.

---

## 7. Summary of Gaps

| Gap | File | Line | Severity |
|---|---|---|---|
| `SimParams.preset` untyped as `string` | `src/types.ts` | 77 | Medium — no compile-time validation |
| Only two materials hardcoded in `defaultRecipe` | `src/engine/layout.ts` | 83–85 | Medium — blocks extending material list |
| Tolerance hardcoded to `0.1` regardless of material | `src/engine/layout.ts` | 89 | Medium — wrong default for reactive materials |
| `recipePreset` is a plain `<select>`, not searchable | `src/ui/config.ts` | 779 + HTML | High — explicit UX requirement from diagram |
| "Other" material type has no data model representation | `src/types.ts`, `src/engine/layout.ts` | — | Medium — "custom" is not the same concept |
| No `MATERIAL_PROFILES` static list exists | anywhere | — | High — required by diagram specification |
| "Article" and "Article Material Type" absent from glossary | `src/glossary/data.ts` | — | Low — documentation gap |
| "Aluminum" vs "Aluminium" spelling inconsistency | `src/glossary/data.ts` | 210 | Low — cosmetic, worth fixing |
