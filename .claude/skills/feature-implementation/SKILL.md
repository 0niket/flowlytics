---
name: feature-implementation
description: End-to-end Flowlytics feature workflow — Blog (intent) → BDD specs (codex-reviewed) → Plan mode → TDD implementation → GREEN commits → UX. Use when the user wants to "implement a feature", makes a "new feature request", says "build X feature", or invokes "/feature-implementation". A process orchestrator with hard gates so no stage is skipped.
---

# Feature Implementation

This skill orchestrates the full lifecycle of a Flowlytics feature. It is a **process
orchestrator**: it tells you exactly how to behave at each stage, with strict gates that
must pass before you advance. The mechanical detail for each stage lives in `references/`
and is read on demand (progressive disclosure) — this file is the spine and the gates.

The destination of the whole flow:

> **Blog (intent) → BDD specs (codex-reviewed) → Plan mode → TDD implementation → GREEN commits → UX.**

## Core principles (always on)

These apply at every stage. They are not optional.

- **Be Socratic.** Draw the intent out through questions before proposing anything. The
  blog `blogs/what-is-the-goal.md` is the model: it reasons toward an objective conclusion
  by interrogating each candidate answer until only one survives.
- **Never assume — surface assumptions.** When you must assume something, state it out loud
  as an explicit assumption and ask the user to confirm before relying on it.
- **Go slow.** One paragraph, one spec, one test case, one step at a time. Never dump a
  whole blog, a whole spec suite, or a whole implementation in one go. Present a unit, get
  agreement, advance.
- **Explain reasoning in bullets.** Whenever you propose something, show the reasoning that
  led there as short bullets so the user can challenge any individual link.
- **Validate at every gate.** Each stage below has a hard gate. Do not cross it without the
  required approval (user validation, `codex` `APPROVED`, or a GREEN `npm run ci`).
- **Never skip codex.** Every BDD spec goes through the `codex exec` review loop until it
  is `APPROVED`. No exceptions.
- **Never skip commit verification.** Every commit must pass `npm run ci`
  (`tsc --noEmit && eslint src/ && vitest run`). Commit only at GREEN.

## The 6 stages

Each stage has an **objective**, a **hard gate** that must pass before advancing, and a
pointer to its reference file. Work the stages in order. Do not look ahead or pre-build.

### Stage 0 — Context & Intent

- **Objective:** understand the lay of the land and the user's true intent before any
  artifact exists.
- **Do:** read existing `blogs/` first (start with `blogs/what-is-the-goal.md` for product
  thesis and tone). If a blog relevant to the feature doesn't exist, read the repo to ground
  yourself (`PLAN.md`, `src/types.ts`, relevant domain/engine files). Then ask Socratic
  clarifying questions about **intent** — what problem, for whom, why now, what does "done"
  mean. Use `AskUserQuestion` to frame option-style questions.
- **Hard gate:** the user confirms you have correctly stated the intent. Do not start the
  blog until intent is agreed.

### Stage 1 — Blog (intent narrative)

→ Detailed protocol: `references/blog-stage.md`

- **Objective:** a blog under `blogs/` that captures the feature's intent as a Socratic
  narrative reaching an **objective conclusion** (no ambiguity left).
- **Do:** present the **title + one-paragraph summary** first. On approval, write
  **paragraph by paragraph**, each accompanied by bullet reasoning. End with an objective
  conclusion and a glossary appendix with anchor links (the `what-is-the-goal.md` style).
- **Hard gate:** the user approves the full blog and agrees its conclusion is unambiguous.

### Stage 2 — BDD Specs

→ Detailed protocol + exact codex commands: `references/spec-stage.md`

- **Objective:** BDD specs under `specs/` (`specs/NNN-<slug>.md`) covering **every path**
  described in the blog, each reviewed by `codex` until `APPROVED`.
- **Do:** write **one spec at a time** (Feature / Background / Scenarios in
  Given-When-Then / out-of-scope). Validate it with the user first, then run the
  **codex review loop**: pipe the spec + the relevant blog section into `codex exec`,
  require a final `VERDICT: APPROVED | NEEDS_CHANGES` line, apply fixes, surface each
  round's changes to the user, and loop until `APPROVED`.
- **Hard gate:** every spec is user-validated AND `codex`-`APPROVED`, and together they
  cover every path in the blog (coverage checklist in the reference).

### Stage 3 — Plan mode

→ Read order + step structure: `references/plan-tdd-stage.md`

- **Objective:** a step-by-step implementation plan where **each step is a single TDD
  cycle**, derived from the approved specs.
- **Do:** enter plan mode. Read in this order: types/domain → integration/UI →
  existing tests → CSS → targeted greps. Produce a plan whose steps each map to a
  red→green→refactor cycle and a `[task-N]` commit.
- **Hard gate:** the user approves the plan (via `ExitPlanMode`) before any code is written.

### Stage 4 — TDD implementation

→ Per-step mechanics + exact git rules: `references/plan-tdd-stage.md`

- **Objective:** implement the plan one step at a time, committing **only at GREEN**.
- **Do, per step:** negotiate the test cases with the user → write tests FIRST → run to
  confirm **RED** (in the working tree, never committed) → implement → confirm **GREEN** →
  `npm run ci` → commit `[task-N]` citing test counts (HEREDOC + `Co-Authored-By`,
  staging files by name) → optional REFACTOR (stays green) → commit again.
- **Hard gate:** `npm run ci` passes before **every** commit. Never `--no-verify`. Never a
  literal RED commit. On hook failure, fix and make a NEW commit (never `--amend`); use
  `git reset --soft HEAD~1` to un-commit if needed.

### Stage 5 — UX

→ frontend-design usage + validation: `references/ux-stage.md`

- **Objective:** polish the interface to production quality, anchored to the product thesis.
- **Do:** load the `frontend-design` skill via the Skill tool. Implement the UX, validate
  with the user via screenshots + `AskUserQuestion`, anchor every decision to the product
  thesis ("the goal is to make money"). Then `ExitPlanMode` if still in plan mode and finish.
- **Hard gate:** the user signs off on the UX against the thesis.

## Async research

When external knowledge is needed (industry practice, library APIs, domain facts), use
**Exa** per `AGENTS.md` — but run it inside a **sub-agent (Task tool) with its own context
window** so search noise never pollutes the main thread. Have the sub-agent return only the
synthesized finding + citations.

## Hard "never" list

- **Never** `--no-verify` (project rule in `CLAUDE.md`).
- **Never** commit a literal RED state — commit only at GREEN (and after a refactor that
  stays green).
- **Never** `--amend` on a pre-commit hook failure — the commit didn't happen; fix and
  create a NEW commit.
- **Never** assume — surface assumptions and confirm.
- **Never** skip the codex review loop on a spec.
- **Never** move past a gate without the required approval.
- **Never** `git add -A` / `git add .` — stage files by name.
