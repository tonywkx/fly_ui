# packages/sim
- Pure TS, no DOM/Node imports; runs in Node and Worker. Deterministic: all randomness via seeded RNG passed in.
- State in typed arrays (Float64Array v/g — f32 stalls decay near −52 mV; Uint32Array CSR), no per-neuron objects, no allocation in the step loop.
- Event-driven: spikes scheduled with synaptic delay; neurons integrate analytically between events where possible.
- TDD: toy nets first (chain, inhibition, threshold, refractory), then bio checks (PLAN 3.6). Tests assert spike times with tolerance.
- Units: mV, ms, Hz (see LIF_DEFAULTS).
