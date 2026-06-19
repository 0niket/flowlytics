# Stage 2 — BDD Specs (codex-reviewed)

Translate the approved blog into BDD specifications under `specs/`. Write **one spec at a
time**, validate it with the user, then run it through the **codex review loop** until it
is `APPROVED`. Together the specs must cover **every path** described in the blog.

If `specs/` does not exist yet, create it now (it is intentionally absent until the first
run of this skill).

## Spec file format

One feature per file: `specs/NNN-<slug>.md` (e.g. `specs/001-max-time-violations.md`),
where `NNN` is a zero-padded sequence number and `<slug>` is kebab-case.

```markdown
# Feature: <short feature name>

<One sentence of intent, traceable to a line in the blog.>

## Background
Given <shared context / preconditions for all scenarios>

## Scenario: <name of the first path>
Given <initial state>
When <action / event>
Then <observable outcome>
And <additional outcome>

## Scenario: <name of the next path>
Given ...
When ...
Then ...

## Out of scope
- <explicitly excluded behavior, so reviewers and implementers know the boundary>
```

Keep scenarios behavioral and observable — describe **what** the system does, never **how**
it is coded. One scenario per distinct path (happy path, each edge, each violation/error).

## Coverage-vs-blog checklist

Before declaring Stage 2 done, verify against the blog:

- [ ] Every goal/lever named in the blog has at least one scenario exercising it.
- [ ] Every tension/edge the blog raised (e.g. over-dwell vs under-dwell, cost vs quality)
      has an explicit scenario.
- [ ] Every "objective conclusion" constraint is encoded as a `Then`.
- [ ] Anything the blog deliberately excluded is listed under **Out of scope**.
- [ ] No scenario introduces behavior the blog never justified.

## The codex review loop

Run this loop for **each** spec after the user has validated it. Never skip it.

### 1. Discover (first time in a session)

Check the tool and its current syntax before invoking — versions change:

```bash
command -v codex && codex --version
codex --help
codex exec --help
```

### 2. Construct context

The model reviews the spec **plus** the relevant blog excerpt **plus** the repo standards.
Assemble a single stdin payload: the spec file, then the blog section it derives from, then
a short note pointing at `CLAUDE.md` (GREEN-only, no `--no-verify`) and `PLAN.md`
conventions. The prompt to codex carries the **role + context + questions** and instructs it
to read the artifact from stdin.

### 3. Invoke

Pipe the spec into `codex exec`, capture stdout+stderr. Run as a **background task** so you
can keep narrating to the user; poll for completion.

```bash
cat specs/NNN-<slug>.md | codex exec \
  "You are a senior BDD reviewer for the Flowlytics pretreatment-line simulator. \
Review the spec read from stdin against these criteria: (1) does it faithfully cover the \
intent in the blog excerpt below; (2) are scenarios observable and unambiguous; (3) are \
edges and violation paths complete; (4) is anything missing or contradictory. \
Blog excerpt: <<paste the relevant blog section>>. \
Project standards: GREEN-only commits, no --no-verify (see CLAUDE.md). \
End your review with EXACTLY ONE line: 'VERDICT: APPROVED' or 'VERDICT: NEEDS_CHANGES'. \
Read the spec from stdin." 2>&1
```

- **Model selection / fallback:** if a specific model is needed, pass `-m <model>`. If an
  invocation fails due to model availability, retry without `-m` (default model) or with a
  known-good fallback, and tell the user which model produced the review.
- Always require the explicit final verdict line so the loop condition is unambiguous.

### 4. Parse the verdict, loop

- If the last line is `VERDICT: APPROVED` → the spec passes the codex gate. Stop the loop.
- If `VERDICT: NEEDS_CHANGES` → read the review, apply the fixes to the spec, **surface the
  diff/changes to the user** (what changed and why, in bullets), then re-run from step 3.
- Loop until `APPROVED`. Each round's changes are shown to the user before the next round.

## Gate

Advance to Stage 3 only when **every** spec is both user-validated and codex-`APPROVED`,
and the coverage checklist against the blog is fully ticked.
