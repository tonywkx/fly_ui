# apps/pipeline
- Stages: scout → fetch (cache in data/cache, resumable, p-limit) → process → bake (writes apps/web/public/data via packages/data encoders).
- Never load the 1 GB+ feathers whole: filter by bodyIds / use neuPrint API. Never read data files into chat — print summaries.
- Token from .env via src/env.ts; never log it.
- Every stage idempotent; `pnpm bake` prints a size report and fails over budget.
