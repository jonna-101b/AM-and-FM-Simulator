import { analyticSignal, bandpassFilter, lowpassFilter } from './fft';

export interface FmModulationOutput {
  transmitted: Float64Array;
  attenuatedSignal: Float64Array;
  received: Float64Array;
  ifFilteredSignal: Float64Array;
  ifFilteredNoise: Float64Array;
  recoveredRaw: Float64Array;
  noiselessRecoveredRaw: Float64Array;
  theoreticalInstFreqKhz: Float64Array;
  demodInstFreqKhz: Float64Array;
  clickEventsDetected: number;
}

/**
 * Quadrature / Phase-Difference FM Discriminator:
 * 1) Computes analytic signal z(t) = y(t) + j * H{y(t)} via Hilbert transform
 * 2) Hard amplitude limiter (inherent in phase normalization via atan2 on z[n] * conj(z[n-1]))
 * 3) Differentiates instantaneous phase: dTheta[n] = arg(z[n] * conj(z[n-1]))
 * 4) Converts phase difference to frequency deviation: fi[n] = dTheta[n] / (2 * pi * dt)
 * 5) Applies post-detection audio low-pass filter and DC removal
 */
export function runFmDiscriminator(
  ifSignal: Float64Array,
  fs: number,
  carrierFreqKhz: number,
  deviationKhz: number,
  audioCutoffKhz: number
): { recovered: Float64Array; instFreqKhz: Float64Array; clickEvents: number } {
  const n = ifSignal.length;
  const z = analyticSignal(ifSignal);
  const fcHz = carrierFreqKhz * 1000;
  const devHz = Math.max(100, deviationKhz * 1000);

  const instFreqKhz = new Float64Array(n);
  const rawDeviation = new Float64Array(n);

  const scaleToHz = fs / (2 * Math.PI);
  const clickThresholdHz = Math.max(2.2 * devHz, 40_000);
  let clickEvents = 0;

  instFreqKhz[0] = carrierFreqKhz;
  rawDeviation[0] = 0;

  for (let i = 1; i < n; i++) {
    const re0 = z.re[i - 1];
    const im0 = z.im[i - 1];
    const re1 = z.re[i];
    const im1 = z.im[i];

    // z[i] * conj(z[i-1]) -> phase difference invariant to amplitude fluctuations (hard limiting)
    const prodRe = re1 * re0 + im1 * im0;
    const prodIm = im1 * re0 - re1 * im0;

    // Guard against exact origin crossing
    const dTheta = prodRe === 0 && prodIm === 0 ? 0 : Math.atan2(prodIm, prodRe);
    const fiHz = dTheta * scaleToHz;
    const fDevHz = fiHz - fcHz;

    if (Math.abs(fDevHz) > clickThresholdHz) {
      clickEvents++;
    }

    instFreqKhz[i] = fiHz / 1000;
    rawDeviation[i] = fDevHz / devHz;
  }

  // Smooth startup sample
  instFreqKhz[0] = instFreqKhz[1];
  rawDeviation[0] = rawDeviation[1];

  // Post-discriminator audio low-pass filter
  const filtered = lowpassFilter(rawDeviation, fs, audioCutoffKhz * 1000);

  // Remove any tiny residual DC offset (from interior steady region)
  const trim = Math.min(128, Math.floor(n * 0.05));
  let sum = 0;
  let count = 0;
  for (let i = trim; i < n - trim; i++) {
    sum += filtered[i];
    count++;
  }
  const mean = count > 0 ? sum / count : 0;

  const recovered = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    recovered[i] = filtered[i] - mean;
  }

  return { recovered, instFreqKhz, clickEvents };
}

/**
 * Simulates FM modulation using the instantaneous phase integral model:
 * s_FM(t) = Ac * cos(2 * pi * fc * t + 2 * pi * kf * integral(m(tau) dtau))
 */
export function simulateFmBranch(params: {
  message: Float64Array;
  noise: Float64Array;
  fs: number;
  carrierAmp: number;
  carrierFreqKhz: number;
  deviationKhz: number;
  channelAttenuation: number;
  audioCutoffKhz: number;
  messageBandwidthKhz: number;
  ifMarginFactor: number;
}): FmModulationOutput {
  const {
    message,
    noise,
    fs,
    carrierAmp,
    carrierFreqKhz,
    deviationKhz,
    channelAttenuation,
    audioCutoffKhz,
    messageBandwidthKhz,
    ifMarginFactor,
  } = params;

  const n = message.length;
  const fcHz = carrierFreqKhz * 1000;
  const devHz = deviationKhz * 1000;
  const dt = 1.0 / fs;

  const transmitted = new Float64Array(n);
  const attenuatedSignal = new Float64Array(n);
  const received = new Float64Array(n);
  const theoreticalInstFreqKhz = new Float64Array(n);

  // Cumulative trapezoidal integration of message phase deviation
  let phaseDeviationRad = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      phaseDeviationRad += 2 * Math.PI * devHz * 0.5 * (message[i] + message[i - 1]) * dt;
    }
    const t = i * dt;
    const totalPhase = 2 * Math.PI * fcHz * t + phaseDeviationRad;
    const s = carrierAmp * Math.cos(totalPhase);

    transmitted[i] = s;
    const rxSig = channelAttenuation * s;
    attenuatedSignal[i] = rxSig;
    received[i] = rxSig + noise[i];
    theoreticalInstFreqKhz[i] = carrierFreqKhz + deviationKhz * message[i];
  }

  // Carson's rule bandwidth for receiver IF bandpass filter: B_FM ≈ 2 * (Δf + fm)
  const carsonBwHz = 2 * (deviationKhz + messageBandwidthKhz) * 1000;
  const ifBwHz = Math.min(fs * 0.44, Math.max(12_000, carsonBwHz * ifMarginFactor));

  const ifFilteredSignal = bandpassFilter(attenuatedSignal, fs, fcHz, ifBwHz);
  const ifFilteredNoise = bandpassFilter(noise, fs, fcHz, ifBwHz);

  const receiverIfInput = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    receiverIfInput[i] = ifFilteredSignal[i] + ifFilteredNoise[i];
  }

  const noisyDemod = runFmDiscriminator(
    receiverIfInput,
    fs,
    carrierFreqKhz,
    deviationKhz,
    audioCutoffKhz
  );
  const noiselessDemod = runFmDiscriminator(
    ifFilteredSignal,
    fs,
    carrierFreqKhz,
    deviationKhz,
    audioCutoffKhz
  );

  return {
    transmitted,
    attenuatedSignal,
    received,
    ifFilteredSignal,
    ifFilteredNoise,
    recoveredRaw: noisyDemod.recovered,
    noiselessRecoveredRaw: noiselessDemod.recovered,
    theoreticalInstFreqKhz,
    demodInstFreqKhz: noisyDemod.instFreqKhz,
    clickEventsDetected: noisyDemod.clickEvents,
  };
}
