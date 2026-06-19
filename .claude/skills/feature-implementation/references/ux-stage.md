# Stage 5 — UX

With behavior implemented and green, polish the interface to production quality. Every UX
decision must anchor to the product thesis from the blog — for Flowlytics, **"the goal is to
make money"** (`blogs/what-is-the-goal.md`). UX is not decoration; it should make the
money-relevant signals (throughput, violations, cost) legible and actionable.

## Load the frontend-design skill

Use the Skill tool to load the `frontend-design` plugin skill before doing UX work:

- Invoke it as `frontend-design:frontend-design` (or `frontend-design`).
- It produces distinctive, production-grade frontend code and avoids generic AI aesthetics.
- Follow its guidance for the actual visual/interaction implementation; this stage governs
  *how you validate and gate* that work.

## Validate with screenshots + AskUserQuestion

Go slow here too — validate increments, not a finished redesign dumped at once.

1. Implement a coherent UX increment (one view, one panel, one flow).
2. **Capture a screenshot** of the result and show it to the user (Read the image so you can
   see what they see and critique it honestly).
3. Use **`AskUserQuestion`** to drive concrete decisions, framing genuine alternatives with
   their trade-offs, e.g.:
   - *"Which layout for the per-station parameters?"* → Collapsible per station / Flat list /
     Tabbed — each option's description states the trade-off (scannability vs density).
   - *"How prominent should violations be?"* → Inline badge / Dedicated panel / Toast — tie
     each back to the money thesis (violations = money going out, so they must be visible).
   Put your recommendation first, marked `(Recommended)`, with reasoning in its description.
4. Iterate on the user's choice; re-screenshot; re-validate.

## Anchor to the product thesis

For each significant UX choice, state in one bullet how it serves the thesis:

- Surfacing over-/under-dwell **violations** prominently → less money going out.
- Making **throughput** and **articles/hr** primary metrics → more money coming in.
- Keeping **cost levers** (wagons, baskets, operators) editable and their effect immediate →
  lets the user find the worth-it tradeoff (the blog's third question).

If a UX choice can't be tied to the thesis, question whether it belongs.

## Finish

- If still in plan mode, `ExitPlanMode` to carry out any remaining implementation.
- Keep the GREEN discipline: any code change in this stage still goes through `npm run ci`
  before committing (see `plan-tdd-stage.md`).

## Gate

The user signs off on the UX against the product thesis. That sign-off completes the
feature-implementation flow.
