import { measureOccupiedBandwidthKhz } from './fft';
import { BranchMetrics } from './types';

function meanPower(arr: Float64Array, start = 0, end = arr.length): number {
  let sum = 0;
  const count = Math.max(1, end - start);
  for (let i = start; i < end; i++) {
    sum += arr[i] * arr[i];
  }
  return sum / count;
}

/**
 * Aligns recovered signal to reference message over causal lag [0, maxLagSamples],
 * removes DC offset, computes correlation and optimal linear projection scale,
 * and evaluates Output SNR, MSE, RMSE, and SDR.
 */
export function evaluateBranchMetrics(params: {
  referenceMessage: Float64Array;
  attenuatedSignal: Float64Array;
  noise: Float64Array;
  ifFilteredSignal: Float64Array;
  ifFilteredNoise: Float64Array;
  recoveredRaw: Float64Array;
  noiselessRecoveredRaw: Float64Array;
  transmitted: Float64Array;
  fs: number;
  carrierFreqKhz: number;
  theoreticalBandwidthKhz: number;
  maxLagSamples?: number;
  isOvermodulated?: boolean;
}): { metrics: BranchMetrics; alignedRecovered: Float64Array } {
  const {
    referenceMessage,
    attenuatedSignal,
    noise,
    ifFilteredSignal,
    ifFilteredNoise,
    recoveredRaw,
    noiselessRecoveredRaw,
    transmitted,
    fs,
    carrierFreqKhz,
    theoreticalBandwidthKhz,
    maxLagSamples = 96,
    isOvermodulated = false,
  } = params;

  const n = referenceMessage.length;
  const trim = Math.min(256, Math.floor(n * 0.04));
  const evalEnd = n - trim - maxLagSamples;

  // 1. Input SNR before demodulation (at receiver input)
  const pRxSig = meanPower(attenuatedSignal);
  const pNoise = Math.max(1e-15, meanPower(noise));
  const inputSnrDb = 10 * Math.log10(pRxSig / pNoise);

  // 2. Receiver IF Carrier-to-Noise Ratio (CNR inside IF passband)
  const pIfSig = meanPower(ifFilteredSignal);
  const pIfNoise = Math.max(1e-15, meanPower(ifFilteredNoise));
  const ifCnrDb = 10 * Math.log10(pIfSig / pIfNoise);

  // 3. Center reference message in evaluation window
  let refMean = 0;
  const evalLen = Math.max(1, evalEnd - trim);
  for (let i = trim; i < evalEnd; i++) refMean += referenceMessage[i];
  refMean /= evalLen;

  let refPower = 0;
  for (let i = trim; i < evalEnd; i++) {
    const d = referenceMessage[i] - refMean;
    refPower += d * d;
  }
  refPower /= evalLen;

  // 4. Find causal lag (0 .. maxLagSamples) that maximizes positive correlation
  // Use noiseless recovered signal to find true deterministic group delay if noisy is weak,
  // or directly use recoveredRaw (actually checking recoveredRaw with fallback check).
  let bestLag = 0;
  let bestCorr = -Infinity;
  let bestAlpha = 1.0;

  // Measure group delay primarily from noiseless path (represents physical filter latency),
  // then evaluate noisy correlation at that physical receiver delay.
  let bestNoiselessLag = 0;
  let bestNoiselessCorr = -Infinity;

  for (let lag = 0; lag <= maxLagSamples; lag++) {
    let recMean = 0;
    for (let i = trim; i < evalEnd; i++) recMean += noiselessRecoveredRaw[i + lag];
    recMean /= evalLen;

    let dot = 0;
    let recPow = 0;
    for (let i = trim; i < evalEnd; i++) {
      const r = referenceMessage[i] - refMean;
      const y = noiselessRecoveredRaw[i + lag] - recMean;
      dot += r * y;
      recPow += y * y;
    }

    const denom = Math.sqrt(refPower * evalLen * recPow);
    const corr = denom > 1e-12 ? dot / denom : 0;
    if (corr > bestNoiselessCorr) {
      bestNoiselessCorr = corr;
      bestNoiselessLag = lag;
    }
  }

  bestLag = bestNoiselessLag;

  // Evaluate noisy output at the physical receiver lag
  let recMean = 0;
  for (let i = trim; i < evalEnd; i++) recMean += recoveredRaw[i + bestLag];
  recMean /= evalLen;

  let dot = 0;
  let recPow = 0;
  for (let i = trim; i < evalEnd; i++) {
    const r = referenceMessage[i] - refMean;
    const y = recoveredRaw[i + bestLag] - recMean;
    dot += r * y;
    recPow += y * y;
  }
  recPow /= evalLen;

  const denom = Math.sqrt(refPower * recPow);
  bestCorr = denom > 1e-12 ? dot / (denom * evalLen) : 0;
  // Projection scale alpha: y ≈ alpha * m + err
  bestAlpha = refPower > 1e-12 ? dot / (refPower * evalLen) : 0;

  // Construct aligned, DC-removed, scaled recovered waveform for display & error computation
  const alignedRecovered = new Float64Array(n);
  const safeScale = Math.abs(bestAlpha) > 0.05 ? 1.0 / bestAlpha : 1.0;

  // Compute full-length DC mean of recoveredRaw for display alignment
  let fullRecMean = 0;
  for (let i = trim; i < n - trim; i++) fullRecMean += recoveredRaw[i];
  fullRecMean /= Math.max(1, n - 2 * trim);

  for (let i = 0; i < n; i++) {
    const srcIdx = Math.min(n - 1, i + bestLag);
    alignedRecovered[i] = (recoveredRaw[srcIdx] - fullRecMean) * safeScale;
  }

  // Evaluate MSE, RMSE, Output SNR
  const demodulationValid = bestCorr > 0.2 && bestAlpha > 0.05;

  let outputSnrDb: number | null = null;
  let mse: number | null = null;
  let rmse: number | null = null;
  let invalidReason: string | undefined;

  if (!demodulationValid) {
    invalidReason = 'Demodulation failed: recovered signal lost correlation below noise floor.';
  } else {
    let errSqSum = 0;
    for (let i = trim; i < evalEnd; i++) {
      const err = alignedRecovered[i] - (referenceMessage[i] - refMean);
      errSqSum += err * err;
    }
    mse = errSqSum / evalLen;
    rmse = Math.sqrt(mse);
    outputSnrDb = 10 * Math.log10(refPower / Math.max(mse, 1e-12));

    if (isOvermodulated) {
      invalidReason = 'Severe envelope distortion due to AM overmodulation (μ > 1.0).';
    }
  }

  // Evaluate Signal-to-Distortion Ratio (SDR) on the noiseless demodulation path
  let nlMean = 0;
  for (let i = trim; i < evalEnd; i++) nlMean += noiselessRecoveredRaw[i + bestLag];
  nlMean /= evalLen;

  let nlDot = 0;
  for (let i = trim; i < evalEnd; i++) {
    const r = referenceMessage[i] - refMean;
    const y = noiselessRecoveredRaw[i + bestLag] - nlMean;
    nlDot += r * y;
  }
  const nlAlpha = refPower > 1e-12 ? nlDot / (refPower * evalLen) : 0;

  let sdrDb: number | null = null;
  if (nlAlpha > 0.05) {
    let distSqSum = 0;
    for (let i = trim; i < evalEnd; i++) {
      const yScaled = (noiselessRecoveredRaw[i + bestLag] - nlMean) / nlAlpha;
      const err = yScaled - (referenceMessage[i] - refMean);
      distSqSum += err * err;
    }
    const distPow = distSqSum / evalLen;
    sdrDb = 10 * Math.log10(refPower / Math.max(distPow, 1e-12));
  }

  const measuredBandwidthKhz = measureOccupiedBandwidthKhz(transmitted, fs, carrierFreqKhz);

  return {
    metrics: {
      inputSnrDb,
      ifCnrDb,
      outputSnrDb,
      mse,
      rmse,
      sdrDb,
      correlation: bestCorr,
      optimalLagSamples: bestLag,
      theoreticalBandwidthKhz,
      measuredBandwidthKhz,
      demodulationValid,
      invalidReason,
    },
    alignedRecovered,
  };
}
