# apps/pipeline
- Stages: scout → fetch (cache in data/cache, resumable, p-limit) → process → bake (writes apps/web/public/data via packages/data encoders).
- Never load the 1.1 GB weights feather into memory whole: stream (polars scanIpc) + filter. Never download syn-points (12.7 GB) or syn-partners. Never read data files into chat — print summaries.
- Token from .env via src/env.ts; never log it.
- Every stage idempotent; `pnpm bake` prints a size report and fails over budget.
