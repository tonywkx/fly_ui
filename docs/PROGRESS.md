# Progress (newest first, keep ≤5 entries)

## 2026-10-02 — 2.3 background cloud + neuropil shells
Done: `scene/layers/shells.ts` (one merged geometry, client normals, `MeshBasicNodeMaterial` additive fresnel rim + faint fill, DoubleSide, no depth write); `scene/layers/cloud.ts` `CloudLayer` (one instanced `Sprite` batch per LOD tier, soft disc, depth dim, shared gain uniform = base·N0/Ntotal so adding tiers keeps brightness); `scene/frame.ts` `frameDistance` (+test) — aspect-aware fit, margin 1.0. `smoke.ts` removed; `?debug=cloud|shells` isolate a layer.
State: snaps OK (webgpu + webgl2), CNS ≈73% of frame height. lod0 first frame, lod1 lazy-added after `frame` ready; lod2 not loaded (→ 2.8 presets). Known: optic-lobe shells show hard vertical "slabs" at far left/right (mesh geometry, not shader — check pipeline simplification/ROI source if it bothers); VNC end-on rings look busy; webgl2 dust looks crisper/sparser than webgpu; depth dim barely visible.
Next: 2.4 hero neurons as instanced quads/ribbons from escape skeletons (join meta by bodyId), drawn over the background layers.
Gotchas: `SpriteNodeMaterial.scaleNode` is multiplied by the object's world-matrix scale → pass size in source units (µm / (unitNm/1000)). WGSL `smoothstep` needs low < high — use `oneMinus(smoothstep(a,b,x))` for falloff. `/handoff` cannot be invoked by the model (user runs it). node_modules reads are denied — check three APIs by snapping, not source.

## 2026-10-02 — 2.2 renderer + loader
Done: `data/{decode,plan,store,decode.worker}.ts` (+tests): manifest fetch → `firstFrameChunks` → comlink Worker pool (2–4) fetches+decodes, typed arrays transferred; `DataStore` (`data.get(id, kind)`, `ready`, bytes progress). `scene/engine.ts` (WebGPURenderer, `?gl=webgl2` forces WebGL2 backend, OrbitControls, ResizeObserver, `onFrame` hooks, `setFrame(manifest)`), `scene/Stage.tsx`, `scene/frameStats.ts` → `ui/Stats.tsx` (fps, render-CPU ms, backend label).
State: snaps OK on webgpu and webgl2: `scene/smoke.ts` (cloud lod0 as 1-px Points + bbox Box3Helper) is a TEMP placeholder — replace in 2.3. View = upright anterior/posterior: brain on top, VNC below seen end-on (body axis ≈ camera z). Framing is loose (bounding-sphere fit, cloud ≈ 40% of width).
Next: 2.3 background cloud + neuropil shells (TSL materials), drop smoke.ts; tighten camera framing.
Gotchas: MobX 7 has no `observable.ref` — use `observableRef` (exported from 'mobx'); anything posted to a Worker must not be a MobX proxy (manifest is `observableRef`). Worker fetch URLs must be absolute (relative resolves against the worker script). `world` group = bbox centre→0, ×unitNm/1000 (µm), rotated 180° about x (y,z negated). Snap fires 2 frames after content, before the first 500 ms Stats window → fps "—" in snaps. Bash: never `cat > f 2>/dev/null ||` without heredoc (hangs on stdin).

## 2026-10-02 — 2.1 web shell
Done: shadcn base (`@/` alias, `components.json`, `lib/utils.ts` cn, shadcn vars mapped onto tokens in `ui/theme.css`, `components/ui/button.tsx` primary/ghost); `ui/palette.ts` NT_COLORS (Record<Nt>, hex + linear rgb) mirrored as `--color-nt-*` + test; `state/params.ts` parseParams + test, `state/app.ts` AppStore (MobX, readiness flags); `App.tsx` `#stage` + HUD, `ui/Stats.tsx`.
State: `pnpm snap` works with `?scenario/debug/stats`; `__snapReady` set by `when(app.ready)` in `main.tsx` (only `fonts` flag now). HUD = wordmark "fly_ui" bottom-left (open question: user was offered removing it — empty scene until intro 2.7, big title only inside the intro; not answered yet), CC BY link bottom-right, debug/stats top-right.
Next: 2.2 renderer: mount WebGPURenderer into `#stage`, `app.waitFor('data'|'frame')` before snapReady, Worker decode of manifest chunks; hook Stats to the renderer loop.
Gotchas: web tsconfig has `types: [vite/client, node]` (vite.config uses node:url). Stats shows "—" in snaps (first sample after 500 ms). `@fly/data` is now a web dependency.

## 2026-10-02 — 1.8 bake orchestrator
Done: `packages/data`: manifest v2 (`unitNm`), `pruneTypeGraph`, `bboxUnion` + tests; `apps/pipeline/src/process/{skeletons,bake}.ts` (`buildSkeletons`, `buildManifest`, `checkBudget`) + tests; `fetch/graph.ts` `loadGraphCache` (shared with `pnpm graph`); CLI `src/bake.ts`.
State: `pnpm bake` (~70 s, no token) → `apps/web/public/data/` 17 chunks + `manifest.json`; first-frame 11.20 MB raw / 7.19 MB br (escape skeletons 8.88 MB of it), lazy 80.8 MB raw / 39.3 MB br. All chunks decode via the manifest bbox. Phase 1 done.
Next: 2.1 web shell (Vite/React/MobX/Tailwind v4/shadcn, theme tokens, `?debug=`/`?stats=`, `window.__snapReady`).
Gotchas: skeleton chunk order is scout bodyId order, meta/graph order is (type, bodyId) — join by bodyId on the client. Skeleton bytes ≈ 11.5 B/node (pos 6 + radius 2 + parent 4); implicit parent (i−1) would cut ~30% if budget gets tight. Radius is u16 whole source units (8 nm steps). Default scenario = `--default` (escape), first in `manifest.scenarios`.

## 2026-10-02 — 1.7b cell-type graph
Done: `packages/data/src/typegraph.ts` (`collapseByType`, `encodeTypeGraph`/`decodeTypeGraph`; node k = `meta.strings.types[k]`, weight u32 + signed i32 Σ sign[pre]·w, count per type, untyped skipped, self-loops kept) + tests; `pnpm graph` also writes `data/build/typegraph-full.bin`.
State: 11751 types / 934k edges, unpruned: 10.89 MB raw / 2.43 MB br. Not yet in a manifest.
Next: 1.8 `pnpm bake` orchestrator + manifest + size report (first-frame ≤15 MB); decide typegraph tier/prune there.
Gotchas: type-edge prune tradeoff (edges / br / synapse mass): w≥10 633k/1.65 MB/98% · w≥20 443k/1.24 MB/95% · w≥50 241k/0.76 MB/88% · w≥100 132k/0.48 MB/79%. Prune after `collapseByType` (filter rows), codec is threshold-agnostic.
