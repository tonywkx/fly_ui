---
paths:
  - "apps/web/src/scene/**"
---
Scene/render code:
- No React state in the frame loop. Scene reads MobX stores via `reaction`/`autorun` set up once; per-frame data lives in typed arrays / GPU buffers.
- WebGPU lines are 1px: thick glowing neurites = instanced quads (or Line2). Keep a WebGL2 fallback path working.
- Every visual feature gets a debug mode (`?debug=<name>`) so `visual-qa` can verify it. Verify shaders with `visual-qa`, not by reasoning.
- Budget: 60 fps on M-series laptop at "high"; check `?stats=1`.
