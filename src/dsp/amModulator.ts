import { bandpassFilter } from './fft';
import { RectifierMode } from './types';

export interface AmModulationOutput {
  transmitted: Float64Array;
  attenuatedSignal: Float64Array;
  received: Float64Array;
  ifFilteredSignal: Float64Array;
  ifFilteredNoise: Float64Array;
  recoveredRaw: Float64Array;
  noiselessRecoveredRaw: Float64Array;
}

/**
 * Real AM envelope detector:
 * 1) Optional IF bandpass pre-filter centered at fc (models receiver tuned RF/IF stage)
 * 2) Diode rectification (full-wave |y| or half-wave max(0, y))
 * 3) Cascaded 2-stage RC low-pass filter with cutoff fc_RC = 1 / (2*pi*RC)
 * 4) DC blocking capacitor (zero-mean extraction)
 */
export function runEnvelopeDetector(
  signal: Float64Array,
  fs: number,
  rcCutoffKhz: number,
  rectifierMode: RectifierMode
): Float64Array {
  const n = signal.length;
  const rectified = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const v = signal[i];
    rectified[i] = rectifierMode === 'full-wave' ? Math.abs(v) : v > 0 ? v : 0;
  }

  // 2-stage RC low-pass filter difference equation: y[n] = y[n-1] + alpha * (x[n] - y[n-1])
  const dt = 1.0 / fs;
  const rc = 1.0 / (2 * Math.PI * Math.max(500, rcCutoffKhz * 1000));
  const alpha = dt / (rc + dt);

  // Estimate initial steady-state envelope over the first carrier cycle to avoid huge t=0 charging transient
  const initSamples = Math.min(n, 32);
  let initMean = 0;
  for (let i = 0; i < initSamples; i++) initMean += rectified[i];
  initMean /= initSamples;

  const stage1 = new Float64Array(n);
  const stage2 = new Float64Array(n);
  stage1[0] = initMean;
  stage2[0] = initMean;

  for (let i = 1; i < n; i++) {
    stage1[i] = stage1[i - 1] + alpha * (rectified[i] - stage1[i - 1]);
    stage2[i] = stage2[i - 1] + alpha * (stage1[i] - stage2[i - 1]);
  }

  // DC blocking (ignore first 64 samples of startup when computing DC average)
  const startTrim = Math.min(64, Math.floor(n * 0.05));
  let dcSum = 0;
  let count = 0;
  for (let i = startTrim; i < n; i++) {
    dcSum += stage2[i];
    count++;
  }
  const dcMean = count > 0 ? dcSum / count : 0;

  const output = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    output[i] = stage2[i] - dcMean;
  }

  return output;
}

/**
 * Simulates conventional DSB+C AM modulation, AWGN channel, and envelope detection.
 * Mathematical model: s_AM(t) = Ac * [1 + mu * m(t)] * cos(2 * pi * fc * t)
 */
export function simulateAmBranch(params: {
  message: Float64Array;
  noise: Float64Array;
  fs: number;
  carrierAmp: number;
  carrierFreqKhz: number;
  modIndex: number;
  channelAttenuation: number;
  rcCutoffKhz: number;
  rectifierMode: RectifierMode;
  ifFilterEnabled: boolean;
  messageBandwidthKhz: number;
}): AmModulationOutput {
  const {
    message,
    noise,
    fs,
    carrierAmp,
    carrierFreqKhz,
    modIndex,
    channelAttenuation,
    rcCutoffKhz,
    rectifierMode,
    ifFilterEnabled,
    messageBandwidthKhz,
  } = params;

  const n = message.length;
  const fcHz = carrierFreqKhz * 1000;
  const transmitted = new Float64Array(n);
  const attenuatedSignal = new Float64Array(n);
  const received = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const s = carrierAmp * (1.0 + modIndex * message[i]) * Math.cos(2 * Math.PI * fcHz * t);
    transmitted[i] = s;
    const rxSig = channelAttenuation * s;
    attenuatedSignal[i] = rxSig;
    received[i] = rxSig + noise[i];
  }

  // Receiver IF bandpass pre-filter (bandwidth ~ 2.4 * fm, min 12 kHz)
  const ifBwHz = Math.max(12_000, 2.4 * messageBandwidthKhz * 1000);
  const ifFilteredSignal = ifFilterEnabled
    ? bandpassFilter(attenuatedSignal, fs, fcHz, ifBwHz)
    : attenuatedSignal;
  const ifFilteredNoise = ifFilterEnabled
    ? bandpassFilter(noise, fs, fcHz, ifBwHz)
    : noise;

  const receiverInput = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    receiverInput[i] = ifFilteredSignal[i] + ifFilteredNoise[i];
  }

  const recoveredRaw = runEnvelopeDetector(receiverInput, fs, rcCutoffKhz, rectifierMode);
  const noiselessRecoveredRaw = runEnvelopeDetector(ifFilteredSignal, fs, rcCutoffKhz, rectifierMode);

  return {
    transmitted,
    attenuatedSignal,
    received,
    ifFilteredSignal,
    ifFilteredNoise,
    recoveredRaw,
    noiselessRecoveredRaw,
  };
}
