---
name: next
description: Start a work session on the next unchecked task from docs/PLAN.md.
disable-model-invocation: true
argument-hint: "[task id, e.g. 1.3 — optional]"
---
1. Read `docs/PROGRESS.md` (latest entry only) and, from `docs/PLAN.md`, ONLY the section of the current phase (use Grep for the heading, then Read with offset/limit). Do not read the rest.
2. Pick task `$ARGUMENTS` or the first unchecked `- [ ]` in that phase.
3. Enter plan mode: short plan (files to touch, tests to write first, how it will be verified — test-runner / visual-qa). Wait for approval.
4. Implement. Verify through the `test-runner` agent (code) and `visual-qa` agent (anything visual). Tests first for packages/data and packages/sim.
5. Commit in small steps (see CLAUDE.md §Commits). Then tick the task in PLAN.md and run `/handoff`.
