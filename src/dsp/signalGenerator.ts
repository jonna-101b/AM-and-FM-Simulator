import { MessageBandwidthKhz, MessageSignalType } from './types';

export interface GeneratedMessage {
  timeMs: Float64Array;
  message: Float64Array;
  highestFreqKhz: MessageBandwidthKhz;
}

/**
 * Generates the normalized audio baseband message signal m(t) within [0, fm].
 * Peak amplitude is normalized so max|m(t)| = 1.0, ensuring exact AM modulation index
 * and exact FM peak frequency deviation Δf.
 */
export function generateMessageSignal(
  fs: number,
  numSamples: number,
  bandwidthKhz: MessageBandwidthKhz,
  type: MessageSignalType,
  singleToneFreqKhz: number
): GeneratedMessage {
  const timeMs = new Float64Array(numSamples);
  const raw = new Float64Array(numSamples);
  const fmHz = bandwidthKhz * 1000;
  const durationSec = numSamples / fs;

  for (let n = 0; n < numSamples; n++) {
    const t = n / fs;
    timeMs[n] = t * 1000;

    if (type === 'single-tone') {
      const fTone = Math.min(fmHz, Math.max(500, singleToneFreqKhz * 1000));
      raw[n] = Math.sin(2 * Math.PI * fTone * t);
    } else if (type === 'sweep') {
      const fStart = 400; // 400 Hz start
      const fEnd = fmHz;
      const chirpRate = (fEnd - fStart) / durationSec;
      const phase = 2 * Math.PI * (fStart * t + 0.5 * chirpRate * t * t);
      raw[n] = Math.sin(phase);
    } else {
      // Realistic composite multi-tone audio signal spanning [0.25*fm, fm]
      // Zero phase offset ensures m(-t) = -m(t) so negative peaks reach -1.0 equally for AM overmodulation tests
      const f1 = 0.25 * fmHz;
      const f2 = 0.625 * fmHz;
      const f3 = 1.0 * fmHz;
      raw[n] =
        0.52 * Math.sin(2 * Math.PI * f1 * t) +
        0.30 * Math.sin(2 * Math.PI * f2 * t) +
        0.24 * Math.sin(2 * Math.PI * f3 * t);
    }
  }

  // Remove residual DC offset if non-negligible and peak-normalize to [-1, 1]
  let sum = 0;
  for (let n = 0; n < numSamples; n++) sum += raw[n];
  const mean = sum / numSamples;

  let maxAbs = 0;
  for (let n = 0; n < numSamples; n++) {
    const centered = type === 'single-tone' ? raw[n] : raw[n] - mean;
    raw[n] = centered;
    const abs = Math.abs(centered);
    if (abs > maxAbs) maxAbs = abs;
  }

  const normFactor = maxAbs > 1e-12 ? 1.0 / maxAbs : 1.0;
  const message = new Float64Array(numSamples);
  for (let n = 0; n < numSamples; n++) {
    message[n] = raw[n] * normFactor;
  }

  return {
    timeMs,
    message,
    highestFreqKhz: bandwidthKhz,
  };
}
