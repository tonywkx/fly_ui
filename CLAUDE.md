# fly_ui — interactive Drosophila CNS simulator

Web app: the real fly connectome (neuPrint) rendered in 3D as an electrophysiology rig. Stimulate, silence, probe neurons; watch spikes propagate (escape / sugar / courtship song scenarios). Static site, no backend. TypeScript everywhere, no Python.

## Layout
```
apps/pipeline   Node 22 scripts: scout (neuPrint Cypher) → fetch → process → bake → apps/web/public/data
apps/web        Vite + React 19 + MobX + three.js (WebGPURenderer/TSL) + Tailwind v4/shadcn
packages/data   binary format, zod manifest schema, encoders/decoders (shared by pipeline + web)
packages/sim    event-driven LIF engine on typed arrays; runs in Node (pre-baked scenarios) and in a Worker (live)
scripts/snap.ts Playwright screenshot of any app state → snaps/*.png
docs/           PLAN.md (phases, tasks), PROGRESS.md (session log), DECISIONS.md (settled choices)
```

## Commands
`pnpm dev` · `pnpm test [path]` · `pnpm typecheck` · `pnpm lint` / `pnpm fix` · `pnpm bake` · `pnpm scout` · `pnpm pull [--scenario=x]` (skeletons → data/cache)
`pnpm snap --scenario=escape --t=40 [--debug=<mode>] [--ui=<state>] [--lang=ru]` (en by default) → PNG paths.
pnpm runs via corepack (`corepack pnpm ...` if `pnpm` is not on PATH).

## Invariants (do not break)
- Data format changes only in `packages/data` (schema + encoder + decoder + test together). Web never parses raw sources.
- No React state in the frame loop; scene subscribes to MobX via `reaction`. Heavy compute only in Workers (comlink).
- `packages/sim` is pure: no DOM, no Node APIs, deterministic given a seed.
- Budgets: ≤15 MB before first frame (rest lazy), 60 fps at "high" on M-series.
- Secrets only in `.env` (NEUPRINT_TOKEN). Never print or commit it.

## Working rules (token economy)
- One session = one task from docs/PLAN.md. Start with `/next`, end with `/handoff`, then `/clear`.
- Don't read docs/PLAN.md whole — only the current phase section. Don't open DESIGN.md unless doing UI.
- Delegate: tests/typecheck → `test-runner` agent; screenshots/shaders → `visual-qa`; neuPrint queries → `neuprint-scout`; UI review → `ui-critic`. Broad code search → Explore agent.
- Never read data files (`data/`, `*.bin`, `*.feather`, `*.swc`) — write/run a tiny inspect script that prints a summary.
- Prefer Grep + targeted Read (offset/limit) over whole-file reads. Keep replies short; no recap of the diff.
- TDD for packages/data and packages/sim (Vitest). Shaders/visuals are verified by screenshots + debug modes, not by reasoning.

## Commits
Small and frequent. Conventional style, English, lowercase, ≤50 chars, no body unless essential, no co-author/attribution trailer.
e.g. `feat(sim): lif neuron step`, `fix(web): bloom threshold`, `chore: bump three`.

## Design
DESIGN.md = visual reference (Dala style); PRODUCT.md = product brief + how that style maps to this instrument (wins on conflict). UI skills: `impeccable` (primary: shape/critique/polish), `animate`/`emil-design-eng`/`review-animations` (motion). `design-taste-frontend` and `high-end-visual-design` are manual-only (intro/landing), they are large.
