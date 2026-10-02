/** Shiu et al. 2024 LIF defaults (mV, ms, Hz). Tuned values live in scenario configs. */
export const LIF_DEFAULTS = {
  vRest: -52,
  vReset: -52,
  vThreshold: -45,
  tauMembrane: 20,
  tauSyn: 5,
  refractory: 2.2,
  delay: 1.8,
  wSyn: 0.275,
  poissonRate: 150,
  poissonScale: 250,
  dt: 0.1,
} as const;
