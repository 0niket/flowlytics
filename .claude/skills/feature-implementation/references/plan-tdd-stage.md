# Stages 3 & 4 — Plan mode & TDD implementation

Stage 3 produces a plan whose every step is a single TDD cycle. Stage 4 executes those
steps, committing **only at GREEN**.

## Stage 3 — Plan mode

Enter plan mode. Ground yourself by reading in this order before designing anything:

1. **Types / domain** — `src/types.ts` and the engine domain (`src/engine/`). The data
   model constrains everything else.
2. **Integration / UI** — how the feature surfaces (`src/ui/`, `src/main.ts`, `index.html`).
3. **Existing tests** — `*.test.ts` near the area, to learn the test idioms and current
   coverage (and which tests must keep passing).
4. **CSS / styling** — relevant styles, so UX work later fits the existing system.
5. **Targeted greps** — narrow searches for symbols, call sites, and patterns you'll touch.

Then produce a **step-by-step plan** where **each step is one TDD cycle** mapped to the
approved specs:

- Each step names the scenario(s) it implements, the test file + cases it will add, the
  source files it will change, and the `[task-N]` commit it will produce.
- Order steps so the tree can reach GREEN at the end of every step (no step depends on a
  future step to compile).
- Mirror `PLAN.md`'s shape where useful: Vision/Why → before/after → step flow → TDD test
  table → phased refactor → risks.

**Gate:** present the plan via `ExitPlanMode`. No code until the user approves.

## Stage 4 — Per-step TDD mechanics

For each step, in order:

1. **Negotiate the test cases.** Propose the specific cases for this step (one short list,
   tied to the scenario). Get the user's agreement before writing them. Go slow.
2. **Write tests FIRST.** Add the failing tests only.
3. **Confirm RED.** Run the targeted tests and show they fail for the right reason. This RED
   state lives **only in the working tree — never commit it.**
4. **Implement.** Write the minimum code to satisfy the tests.
5. **Confirm GREEN.** Run the targeted file, then the full gate: `npm run ci`
   (`tsc --noEmit && eslint src/ && vitest run`). All must pass.
6. **Commit at GREEN** (see git rules below), citing test counts in the message.
7. **REFACTOR (optional).** Improve structure while keeping the tree green. Re-run
   `npm run ci`. Commit again — a refactor commit is still a GREEN commit.

## Git rules (hard)

- **Commit only at GREEN.** The pre-commit hook runs `npm run ci`; a RED tree cannot be
  committed, and you must never try.
- **Never `--no-verify`** (project rule, `CLAUDE.md`).
- **Never `--amend` on hook failure.** A failed hook means the commit did NOT happen —
  amending would rewrite the *previous* (good) commit. Instead: fix the issue, re-stage,
  create a **NEW** commit.
- **Stage files by name.** Never `git add -A` or `git add .` — list each path.
- **Un-commit safely if needed.** To undo the last commit while keeping changes staged:
  `git reset --soft HEAD~1`. (Never `reset --hard` unless the user explicitly asks.)
- **Multiple commits on one green tree.** If a single green tree contains separable logical
  changes, stage and commit them in groups (each commit still passes `npm run ci` because
  the whole tree is green) — stage subset, commit, stage next subset, commit.

### Commit message format (HEREDOC + Co-Authored-By)

Cite test counts so each GREEN commit is auditable:

```bash
git add src/engine/simulation.ts src/engine/simulation.test.ts
git commit -m "$(cat <<'EOF'
[task-3] Add max-time violation detection at LOAD/UNLOAD/WDO

Extends the violation model beyond tanks. 8 new tests, full suite 114 passing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
git status
```

**Gate:** `npm run ci` passes before **every** commit. If the hook fails, fix → re-stage →
new commit. Do not advance to the next step until the current step is committed at GREEN.
