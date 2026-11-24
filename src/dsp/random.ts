/**
 * Seeded pseudo-random number generator (Mulberry32) and Box-Muller AWGN generator.
 * Guarantees deterministic, reproducible noise realizations for identical channel parameters.
 */

export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates an array of zero-mean Additive White Gaussian Noise (AWGN) samples
 * with exact target variance sigma^2 = 10^(noiseLevelDb / 10).
 * Uses Box-Muller transform from a seeded uniform PRNG.
 */
export function generateAwgn(numSamples: number, noiseLevelDb: number, seed: number): Float64Array {
  const rng = createMulberry32(seed);
  const sigma = Math.pow(10, noiseLevelDb / 20);
  const noise = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i += 2) {
    // Clamp u1 away from 0 to prevent log(0) -> -Infinity
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const mag = sigma * Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2.0 * Math.PI * u2);
    const z1 = mag * Math.sin(2.0 * Math.PI * u2);
    noise[i] = z0;
    if (i + 1 < numSamples) {
      noise[i + 1] = z1;
    }
  }

  return noise;
}
