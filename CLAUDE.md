# Flowlytics Project Rules

## Git Commit Policy

- **NEVER use `--no-verify` when committing.** Every commit must pass the pre-commit hook (tsc + eslint + vitest).
- This means every commit must be in a GREEN state: TypeScript compiles, lints pass, tests pass.
- If doing red-green-refactor, only commit at GREEN stages. Do not commit broken intermediate states.
