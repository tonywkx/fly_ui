# PRODUCT — fly_ui

## Platform
web (desktop-first; mobile = simplified scenario viewer without tools)

## Stack
Vite, React 19, MobX, three.js WebGPURenderer + TSL (WebGL2 fallback), Tailwind v4 + shadcn/ui (Radix), motion/react for UI, GSAP for camera, cmdk, uPlot, custom canvas raster, Tone.js. Static deploy to GitHub Pages.

## Users
Curious technical people (devs, designers, science fans) arriving from a video/post; secondarily neuroscience students and researchers who want to poke a real connectome. Inferred: most first visits are on a laptop, 1–3 minutes long.

## Product Purpose
Make a real insect nervous system tangible: pick a stimulus, watch signals propagate through actual wiring, then break things (silence a neuron) and see behavior change. Shareable experiments ("I silenced X and the fly didn't jump").

## Positioning
A scientific instrument you want to play with — electrophysiology rig meets motion-graphics piece. Not a dashboard, not a textbook.

## Operating Context
Dark room energy: black stage, glowing neurons, timeline with spike raster (like a video editor), mini oscilloscopes. Sessions start with a cinematic intro, then hands-on tools.

## Capabilities and Constraints
- Scenarios: escape (looming shadow → Giant Fiber → jump), sugar (gustatory → proboscis extension, per Shiu et al. 2024), courtship song (male-specific → wing vibration), free mode.
- Tools: Stimulate (click / brush, optogenetics-style), Silence (neuron greys out), Electrode (≤4 probes with live voltage traces). Each has a hotkey.
- Timeline: raster by region (optic lobes, central brain, descending, VNC); scrub, pause, slow-mo.
- Inspector, ⌘K search by cell type, color modes (region / transmitter / class / male-specific), experiments encoded in URL.
- ≤15 MB before first frame; 60 fps on M-series laptop.

## Brand Commitments
Visual reference: DESIGN.md (Dala — "constellation floating on black velvet"). Adapted for an instrument below.

## Visual language (adaptation of DESIGN.md)
- Canvas is the 3D void (#000). Neurons are the "constellation"; the intro particle assembly directly echoes Dala's brain-of-particles hero.
- Transmitter colors: excitatory warm (ACh → Saffron #ffb829 family), inhibitory cold (GABA → Iris #8052ff family, Glu → cyan/teal from #15846e), modulatory (DA/5-HT/OA) → magenta/pink. Male-specific highlight: hot magenta. Final values live in `apps/web/src/ui/theme.css` + a matching TS palette for shaders.
- HUD floats on the scene: no borders, no shadows. Panels that must exist (inspector, timeline) are near-black translucent (backdrop blur), 24px radius, 6px spacing grid.
- Type: Inter Variable (PP Neue Montreal substitute) — display 400 with -0.04em tracking (intro, scenario titles), body 200–400 depending on legibility over the scene; Geist Mono for numbers/readouts (mV, ms, Hz, bodyIds).
- One violet pill primary action per view (e.g. "Run", "Share experiment"). Everything else ghost/text buttons.
- Density: intro/scenario cards spacious like Dala; instrument panels denser (instrument > marketing) but still whitespace-separated.

## Evidence on Hand
Connectome data: neuPrint (Janelia FlyEM; male-cns:v1.0, CC-BY). LIF model reference: Shiu et al., Nature 2024. None of the UI exists yet.

## Product Principles
1. The show is the loading screen — never a spinner.
2. Every interaction answers within one frame; heavy work never blocks the main thread.
3. Real data, honest labels: cell types and transmitters are the dataset's, predictions marked as predictions.
4. Breaking things is the fun part — silencing and sharing must be one click.

## Accessibility & Inclusion
prefers-reduced-motion: no camera fly-throughs, instant transitions, bloom reduced. Full keyboard for tools and ⌘K. Colour modes never rely on hue alone (inspector labels, legend with names). Text contrast ≥ 4.5:1 over the darkest possible scene.
