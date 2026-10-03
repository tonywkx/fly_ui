import { uniform } from 'three/tsl';

/** Camera → orbit target distance (world µm), written by the engine every frame; layers dim depth around it. */
export const orbitDistance = uniform(1);
