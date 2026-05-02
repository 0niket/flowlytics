# Plan: Suggestions Drawer (Theory of Constraints advisor)

## Overview

A right-side drawer triggered by a "Suggestions" button in the top bar (between Glossary and theme toggle). Analyzes the current simulation results and generates actionable improvement suggestions grounded in Goldratt's Theory of Constraints ("The Goal").

## UX Flow

1. User runs a simulation (auto-run or manual)
2. Clicks "Suggestions" button in top-right
3. A drawer slides in from the right (~420px wide)
4. Drawer shows a prioritized list of suggestions
5. Each suggestion is a card with:
   - **Problem** — what the data shows
   - **Theory** — the TOC principle that applies (from "The Goal")
   - **Solution** — step-by-step fix with specific parameter changes
   - **Expected impact** — what will improve
   - **Apply button** — one click to apply the suggested parameter changes
6. Clicking "Apply" updates sidebar inputs, re-runs simulation, and shows updated results
7. Drawer stays open so user can see the impact and try the next suggestion
8. Close via X button or clicking "Suggestions" again

## Suggestion Priority Order

**Priority 1: Zero violations first** (quality before throughput)
- If violations > 0, the first suggestion always addresses this

**Priority 2: Bottleneck resolution** (Goldratt's 5 Focusing Steps)
- Identify the constraint
- Exploit it (use it better without adding resources)
- Subordinate everything else to it
- Elevate it (add capacity)

**Priority 3: Throughput improvement**
- Only after violations are zero and bottleneck is addressed

**Priority 4: Inventory optimization**
- Reduce overfeeding / excess WIP

## Suggestion Engine Logic

Each suggestion is generated from simulation results. Here's the full set:

### S1: Reduce violations by adding wagons
- **When:** violations > 0 AND bottleneck = "wagon_busy"
- **Problem:** Wagon can't pick up baskets on time → over-dwell in chemical tanks
- **Theory:** "A bottleneck hour lost is a system hour lost" — every violation is a quality defect
- **Solution:** Add 1 wagon (wagonCount + 1)
- **Apply:** `wagonCount = current + 1`

### S2: Reduce violations by increasing wagon speed
- **When:** violations > 0 AND bottleneck = "wagon_busy" AND wagonCount >= 2
- **Problem:** Multiple wagons still can't keep up
- **Theory:** Exploit the constraint before elevating — make existing resources faster
- **Solution:** Increase wagon speed by 25%
- **Apply:** `wagonSpeedMPerMin = current * 1.25`

### S3: Reduce violations by widening tolerance
- **When:** violations > 0 AND tolerance < 20%
- **Problem:** Tight tolerance creates violations even with adequate wagon capacity
- **Theory:** Not all constraints are physical — policy constraints (tolerance) can also limit the system
- **Solution:** Widen tolerance from X% to X+5%
- **Apply:** `tolerancePct = current + 5`

### S4: Resolve tank-occupied bottleneck
- **When:** bottleneck = "dest_full"
- **Problem:** Tanks are full when baskets need to enter — single-capacity tanks can't handle the throughput
- **Theory:** "Identify the constraint" — it's not the wagon, it's the tank capacity
- **Solution:** Reduce dwell time by 15% (if chemistry allows) to free tanks faster
- **Apply:** `dwellPreset = current * 0.85`, apply to all tanks

### S5: Resolve loading bottleneck
- **When:** bottleneck = "load_busy" OR loading util > 90%
- **Problem:** Loading station can't keep up with demand — it's the hidden constraint
- **Theory:** "A constraint anywhere in the system limits the entire system"
- **Solution:** Reduce load time by 25% (offline basket preparation)
- **Apply:** `loadTimeMin = current * 0.75`

### S6: Match arrival rate to bottleneck (Drum-Buffer-Rope)
- **When:** inventory.isOverfeeding = true
- **Problem:** Pushing baskets faster than the system can process creates excess WIP
- **Theory:** "The Rope" — control work release to match the Drum (bottleneck) pace
- **Solution:** Reduce target throughput to match achieved rate
- **Apply:** `targetBph = inventory.recommendedBph`

### S7: Reduce excess WIP
- **When:** inventory.excessWip > 1.0
- **Problem:** More baskets in system than optimal — wasted staging space and capital
- **Theory:** "Inventory is a liability, not an asset" — excess WIP hides problems
- **Solution:** Match release rate + solve the constraint
- **Apply:** combined — reduce target + address bottleneck

### S8: Improve throughput via wagon speed
- **When:** throughput < target AND violations = 0 AND wagon util > 70%
- **Problem:** System is violation-free but not meeting target
- **Theory:** "Elevate the constraint" — add capacity to the bottleneck
- **Solution:** Increase wagon speed by 20%
- **Apply:** `wagonSpeedMPerMin = current * 1.2`

### S9: Reduce handling overhead
- **When:** plan.buckets.handling > plan.buckets.dwell * 0.5
- **Problem:** Mechanical handling (lift/lower/pick/drop) takes more than half of dwell time
- **Theory:** Non-constraint optimization — reduce waste in transfer operations
- **Solution:** Reduce lift+lower by 5s and pick+drop by 3s
- **Apply:** `liftLowerSec = current - 5`, `pickDropSec = current - 3`

### S10: Extend simulation for reliability
- **When:** simHours < 2 OR completedCount < 4
- **Problem:** Too few baskets completed — statistics unreliable
- **Theory:** (Practical) — need steady-state data for valid conclusions
- **Solution:** Increase simulation to 4 hours
- **Apply:** `simHours = 4`

## Visual Design

- Drawer: 420px wide, slides from right, dark background
- Each suggestion card: bordered, with colored left accent
  - Red accent = violations (quality)
  - Orange accent = bottleneck
  - Blue accent = throughput
  - Green accent = optimization
- "Apply" button: primary blue, changes to "Applied ✓" for 1.5s after click
- Close button (×) top-right of drawer
- Header shows count: "3 suggestions based on current simulation"

## Files Changed

- `web/index.html` — add drawer HTML structure + Suggestions button
- `web/styles.css` — drawer styles, suggestion cards, slide animation
- `web/app.js` — suggestion engine (generateSuggestions function), drawer open/close, apply logic
