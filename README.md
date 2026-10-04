# fly_ui

**A real fruit-fly nervous system you can poke.** The complete male *Drosophila* CNS connectome — brain and nerve cord, 176k neurons — in 3D in the browser, set up like an electrophysiology rig. Pick a stimulus, watch spikes run through the actual wiring, silence a neuron and see the behaviour change.

**[Open the live demo →](https://tonywkx.github.io/fly_ui/)** · any modern desktop browser (WebGPU, WebGL2 fallback); phones get a simplified viewer.

![Escape: a looming shadow drives the visual neurons, the Giant Fiber fires and the fly jumps](docs/media/hero.jpg)

<!-- 43 s video: drag snaps/fly_ui.web.mp4 (pnpm film) into the GitHub editor and paste the asset URL on its own line here -->

| Signal tracer | Sugar → proboscis | Courtship song |
|---|---|---|
| ![Trace tool: strongest paths LPLC2 → Giant Fiber](docs/media/trace.jpg) | ![Sugar: the gnathal ganglion lights up, the proboscis extends](docs/media/sugar.jpg) | ![Song: P1 drives the nerve-cord song circuit, the wing vibrates](docs/media/song.jpg) |

## What you can do

Three scenarios, each a 300 ms run of a spiking model over the **whole** connectome:

| Scenario | Stimulus | What propagates | Readout |
|---|---|---|---|
| **Escape** | looming shadow → LC4 / LPLC2 visual neurons | Giant Fiber (DNp01) descends to the thorax | jump motor neuron (TTMn) → takeoff |
| **Sugar** | gustatory neurons (LB3) | subesophageal zone | MN9 → proboscis extension |
| **Courtship song** | male-specific P1 (pC1) neurons | pIP10 → nerve-cord song circuit | wing motor neurons → pulse song |

Tools (each has a hotkey):

- **Select** `V` — hover / click any neuron: type, transmitter, partners, inspector; `⌘K` searches cell types.
- **Stimulate** `S` — optogenetics-style Poisson drive on a neuron or a brushed group.
- **Silence** `X` — clamp a neuron at rest; e.g. silence the Giant Fiber and the fly no longer jumps.
- **Electrode** `E` — up to 4 probes with live membrane-voltage traces.
- **Trace** `T` — strongest synaptic paths between two cell types, drawn through the brain.
- **Share** — the whole experiment (stimuli, silencing, probes) is encoded in the URL.

Timeline with a spike raster by region (optic lobes / central brain / descending / nerve cord): `Space` play, `,` `.` step, `[` `]` slow-mo. `D` director camera that follows the activity front, `C` colour mode (transmitter / region / class / male-specific), `M` sound — spike clicks and synthesized courtship song (off by default). `?sim=live` swaps the pre-baked runs for the live full-graph simulation in a Worker, so your own stimuli and silencing play out in real time.

## How it works

```
neuPrint (Cypher) + bulk Feather + SWC skeletons
        │  apps/pipeline   scout → pull → cloud / neuropil / graph → bake
        ▼
binary chunks + manifest (packages/data: zod schema, encoders/decoders)
        │  ≤ 15 MB before the first frame, the rest lazy
        ▼
apps/web   three.js WebGPURenderer + TSL (WebGL2 fallback), React 19 + MobX HUD
        ▲
packages/sim   leaky integrate-and-fire engine on typed arrays
               runs in Node (pre-baked scenarios) and in a Worker (live)
```

- **Model.** Leaky integrate-and-fire with the parameters of [Shiu et al. 2024](https://doi.org/10.1038/s41586-024-07763-9): every neuron of the connectome, ≈7 M connections (pairs with ≥ 5 synapses), sign from the predicted transmitter (ACh excitatory; GABA, glutamate, histamine inhibitory). Fixed 0.1 ms step with exact exponential integration of only the active set; deterministic given a seed. A handful of electrical synapses missing from EM data (Giant Fiber → jump motor neuron) are added as overrides.
- **Rendering.** Each scenario neuron (1–2 k) is a full skeleton drawn as instanced screen-facing ribbons; the activity wave is computed in the vertex shader from a per-neuron "last spike" texture, then bloom + AgX. 2 M dust points sampled from 5 000 random neurons give the shape of the whole CNS; neuropil meshes are the glass shells. Picking is a GPU id buffer.
- **Budgets.** ≤ 15 MB before the first frame, 60 fps on an M-series laptop at the high preset (an fps guard steps quality down elsewhere).
- **No backend.** Static site on GitHub Pages; the baked data lives on the orphan `data` branch.

## Develop

Node 22, pnpm via corepack.

```sh
corepack enable
pnpm install
git fetch origin data && git worktree add apps/web/public/data origin/data   # baked data
pnpm dev
```

| Command | |
|---|---|
| `pnpm test` / `pnpm typecheck` / `pnpm lint` | Vitest, tsc, Biome |
| `pnpm test:bio` | biology checks on the full graph (needs the pipeline cache) |
| `pnpm smoke` | Playwright smoke on a production build |
| `pnpm snap --scenario=escape --t=40` | screenshot of any app state → `snaps/` |
| `pnpm perf --quality=high` | headless fps probe |
| `pnpm film` | frame-exact demo video → `snaps/fly_ui.mp4` (needs ffmpeg) |

Rebuilding the data needs a neuPrint token (`.env`, see `.env.example`): `pnpm scout`, `pnpm pull`, `pnpm cloud`, `pnpm neuropil`, `pnpm graph`, `pnpm bake`, then `pnpm data:push` to publish it. Design notes live in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Data & attribution

Connectome: **Janelia FlyEM male CNS v1.0** (`male-cns:v1.0`, [neuPrint](https://neuprint.janelia.org/), [male-cns.janelia.org](https://male-cns.janelia.org/)) — a collaboration of FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology and Google Research — licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The app shows a downsampled, processed subset (simplified skeletons, pruned graph, sampled point cloud) and a model of activity, not recordings.

> Berg S., Beckett I.R., Costa M., Schlegel P., Januszewski M., Marin E.C., Nern A., Preibisch S., Qiu W., Takemura S. et al. *Sexual dimorphism in the complete connectome of the Drosophila male central nervous system.* bioRxiv (2025). [doi:10.1101/2025.10.09.680999](https://doi.org/10.1101/2025.10.09.680999)

Model parameters follow:

> Shiu P.K., Sterne G.R., Spiller N. et al. *A Drosophila computational brain model reveals sensorimotor processing.* Nature 634, 210–219 (2024). [doi:10.1038/s41586-024-07763-9](https://doi.org/10.1038/s41586-024-07763-9) · code: [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) (MIT)

Fonts: Inter and Geist Mono (SIL OFL 1.1).

## License

Code: [MIT](LICENSE). Connectome data and anything derived from it (`data` branch, screenshots, video): CC BY 4.0, attribution as above.
