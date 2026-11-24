import { simulateAmBranch } from './amModulator';
import { computeMagnitudeSpectrumDb } from './fft';
import { simulateFmBranch } from './fmModulator';
import { evaluateBranchMetrics } from './metrics';
import { generateAwgn } from './random';
import { generateMessageSignal } from './signalGenerator';
import {
  SimulationParams,
  SimulationResult,
  SystemWarning,
  ThresholdInvestigationResult,
  ThresholdSweepPoint,
  sanitizeParams,
} from './types';

/**
 * Runs the complete AM and FM end-to-end simulation using identical message samples
 * and identical channel noise statistics.
 */
export function runSimulation(rawParams: SimulationParams): SimulationResult {
  const params = sanitizeParams(rawParams);

  // 1. Shared Message Signal m(t)
  const { timeMs, message, highestFreqKhz } = generateMessageSignal(
    params.fs,
    params.numSamples,
    params.messageBandwidthKhz,
    params.messageType,
    params.singleToneFreqKhz
  );

  // 2. Shared AWGN Realization (seeded for exact reproducibility)
  const noise = generateAwgn(params.numSamples, params.noiseLevelDb, params.noiseSeed);

  // 3. AM Branch: Modulation -> Channel -> Envelope Detection
  const amBranch = simulateAmBranch({
    message,
    noise,
    fs: params.fs,
    carrierAmp: params.carrierAmp,
    carrierFreqKhz: params.carrierFreqKhz,
    modIndex: params.amModIndex,
    channelAttenuation: params.channelAttenuation,
    rcCutoffKhz: params.amRcCutoffKhz,
    rectifierMode: params.amRectifierMode,
    ifFilterEnabled: params.amIfFilterEnabled,
    messageBandwidthKhz: highestFreqKhz,
  });

  // 4. FM Branch: Modulation -> Channel -> Hilbert Quadrature Discriminator
  const fmBranch = simulateFmBranch({
    message,
    noise,
    fs: params.fs,
    carrierAmp: params.carrierAmp,
    carrierFreqKhz: params.carrierFreqKhz,
    deviationKhz: params.fmDeviationKhz,
    channelAttenuation: params.channelAttenuation,
    audioCutoffKhz: params.fmAudioCutoffKhz,
    messageBandwidthKhz: highestFreqKhz,
    ifMarginFactor: params.fmIfMarginFactor,
  });

  // 5. Performance Metrics
  const amTheoreticalBwKhz = 2 * highestFreqKhz;
  const fmTheoreticalBwKhz = 2 * (params.fmDeviationKhz + highestFreqKhz);

  const amEval = evaluateBranchMetrics({
    referenceMessage: message,
    attenuatedSignal: amBranch.attenuatedSignal,
    noise,
    ifFilteredSignal: amBranch.ifFilteredSignal,
    ifFilteredNoise: amBranch.ifFilteredNoise,
    recoveredRaw: amBranch.recoveredRaw,
    noiselessRecoveredRaw: amBranch.noiselessRecoveredRaw,
    transmitted: amBranch.transmitted,
    fs: params.fs,
    carrierFreqKhz: params.carrierFreqKhz,
    theoreticalBandwidthKhz: amTheoreticalBwKhz,
    isOvermodulated: params.amModIndex > 1.0,
  });

  const fmEval = evaluateBranchMetrics({
    referenceMessage: message,
    attenuatedSignal: fmBranch.attenuatedSignal,
    noise,
    ifFilteredSignal: fmBranch.ifFilteredSignal,
    ifFilteredNoise: fmBranch.ifFilteredNoise,
    recoveredRaw: fmBranch.recoveredRaw,
    noiselessRecoveredRaw: fmBranch.noiselessRecoveredRaw,
    transmitted: fmBranch.transmitted,
    fs: params.fs,
    carrierFreqKhz: params.carrierFreqKhz,
    theoreticalBandwidthKhz: fmTheoreticalBwKhz,
    isOvermodulated: false,
  });

  // 6. Spectra (Message baseband + RF spectra around carrier)
  const maxRfFreqKhz = Math.min(params.fs / 2000, params.carrierFreqKhz + Math.max(120, fmTheoreticalBwKhz * 0.75));
  const amSpec = computeMagnitudeSpectrumDb(amBranch.transmitted, params.fs, maxRfFreqKhz);
  const fmSpec = computeMagnitudeSpectrumDb(fmBranch.transmitted, params.fs, maxRfFreqKhz);
  const msgSpec = computeMagnitudeSpectrumDb(message, params.fs, 12);

  // 7. Engineering Warnings
  const warnings: SystemWarning[] = [];

  if (params.amModIndex > 1.0) {
    warnings.push({
      code: 'AM_OVERMODULATION',
      branch: 'AM',
      severity: 'critical',
      title: 'AM Overmodulation Detected (μ > 1.0)',
      detail: `Modulation index μ = ${params.amModIndex.toFixed(2)} causes 1 + μm(t) < 0, inverting carrier phase. Rectification folds the negative envelope upward, causing severe harmonic distortion (SDR = ${amEval.metrics.sdrDb?.toFixed(1) ?? 'N/A'} dB).`,
    });
  }

  if (params.amRcCutoffKhz > params.carrierFreqKhz * 0.2) {
    warnings.push({
      code: 'AM_RC_RIPPLE',
      branch: 'AM',
      severity: 'warning',
      title: 'High RC Cutoff: Carrier Ripple Leakage',
      detail: `RC cutoff (${params.amRcCutoffKhz.toFixed(1)} kHz) is too close to the ${params.carrierFreqKhz} kHz carrier, allowing carrier ripple into the recovered output.`,
    });
  } else if (params.amRcCutoffKhz < highestFreqKhz * 0.85) {
    warnings.push({
      code: 'AM_DIAGONAL_CLIPPING',
      branch: 'AM',
      severity: 'warning',
      title: 'Low RC Cutoff: Diagonal Clipping Risk',
      detail: `RC cutoff (${params.amRcCutoffKhz.toFixed(1)} kHz) is below message bandwidth (${highestFreqKhz} kHz), slowing capacitor discharge and attenuating high-frequency components.`,
    });
  }

  if (!amEval.metrics.demodulationValid) {
    warnings.push({
      code: 'DEMODULATION_FAILED',
      branch: 'AM',
      severity: 'critical',
      title: 'AM Envelope Recovery Failed',
      detail: 'Recovered AM output correlation dropped below usable threshold due to severe channel noise.',
    });
  }

  if (fmBranch.clickEventsDetected > 3 || fmEval.metrics.ifCnrDb < 11.5) {
    warnings.push({
      code: 'FM_THRESHOLD_REGION',
      branch: 'FM',
      severity: fmEval.metrics.demodulationValid ? 'warning' : 'critical',
      title: 'FM Threshold Effect Active',
      detail: `IF CNR is ${fmEval.metrics.ifCnrDb.toFixed(1)} dB with ${fmBranch.clickEventsDetected} phase-wrap click events. Below ~11–13 dB IF CNR, noise encircles the origin and output SNR drops rapidly.`,
    });
  }

  if (params.carrierFreqKhz - params.fmDeviationKhz - highestFreqKhz < 5) {
    warnings.push({
      code: 'SPECTRUM_ALIASING_RISK',
      branch: 'FM',
      severity: 'warning',
      title: 'Low Carrier-to-Deviation Ratio',
      detail: `Lower FM sideband extends near DC (${(params.carrierFreqKhz - params.fmDeviationKhz - highestFreqKhz).toFixed(1)} kHz). Increase fc or lower Δf to avoid baseband overlap.`,
    });
  }

  return {
    params,
    timeMs,
    message,
    amTransmitted: amBranch.transmitted,
    amReceived: amBranch.received,
    amRecovered: amEval.alignedRecovered,
    amRecoveredRaw: amBranch.recoveredRaw,
    fmTransmitted: fmBranch.transmitted,
    fmReceived: fmBranch.received,
    fmRecovered: fmEval.alignedRecovered,
    fmRecoveredRaw: fmBranch.recoveredRaw,
    fmInstantaneousFreqKhz: fmBranch.theoreticalInstFreqKhz,
    fmDemodInstantaneousFreqKhz: fmBranch.demodInstFreqKhz,
    spectrum: {
      freqsKhz: amSpec.freqsKhz,
      amDb: amSpec.magDb,
      fmDb: fmSpec.magDb,
      messageFreqsKhz: msgSpec.freqsKhz,
      messageDb: msgSpec.magDb,
    },
    amMetrics: amEval.metrics,
    fmMetrics: fmEval.metrics,
    warnings,
  };
}

/**
 * Performs a real empirical sweep of channel noise across the FM threshold region
 * using the user's current message, carrier, modulation index, and deviation settings.
 * Uses 4096 samples per point for sub-50ms interactive sweep updates.
 */
export function runFmThresholdSweep(rawParams: SimulationParams): ThresholdInvestigationResult {
  const base = sanitizeParams(rawParams);
  const sweepSamples = 4096;

  const { message, highestFreqKhz } = generateMessageSignal(
    base.fs,
    sweepSamples,
    base.messageBandwidthKhz,
    base.messageType,
    base.singleToneFreqKhz
  );

  // Sweep noiseLevelDb from -30 dB (high CNR) up to +6 dB (deep threshold collapse)
  const noiseLevelsDb: number[] = [];
  for (let nDb = -30; nDb <= 6; nDb += 2) {
    noiseLevelsDb.push(nDb);
  }

  const points: ThresholdSweepPoint[] = [];

  for (const noiseLevelDb of noiseLevelsDb) {
    const noise = generateAwgn(sweepSamples, noiseLevelDb, base.noiseSeed + 101);

    const amBranch = simulateAmBranch({
      message,
      noise,
      fs: base.fs,
      carrierAmp: base.carrierAmp,
      carrierFreqKhz: base.carrierFreqKhz,
      modIndex: Math.min(1.0, base.amModIndex), // Use clean non-overmodulated reference if mu>1 or current mu
      channelAttenuation: base.channelAttenuation,
      rcCutoffKhz: base.amRcCutoffKhz,
      rectifierMode: base.amRectifierMode,
      ifFilterEnabled: base.amIfFilterEnabled,
      messageBandwidthKhz: highestFreqKhz,
    });

    const fmBranch = simulateFmBranch({
      message,
      noise,
      fs: base.fs,
      carrierAmp: base.carrierAmp,
      carrierFreqKhz: base.carrierFreqKhz,
      deviationKhz: base.fmDeviationKhz,
      channelAttenuation: base.channelAttenuation,
      audioCutoffKhz: base.fmAudioCutoffKhz,
      messageBandwidthKhz: highestFreqKhz,
      ifMarginFactor: base.fmIfMarginFactor,
    });

    const amEval = evaluateBranchMetrics({
      referenceMessage: message,
      attenuatedSignal: amBranch.attenuatedSignal,
      noise,
      ifFilteredSignal: amBranch.ifFilteredSignal,
      ifFilteredNoise: amBranch.ifFilteredNoise,
      recoveredRaw: amBranch.recoveredRaw,
      noiselessRecoveredRaw: amBranch.noiselessRecoveredRaw,
      transmitted: amBranch.transmitted,
      fs: base.fs,
      carrierFreqKhz: base.carrierFreqKhz,
      theoreticalBandwidthKhz: 2 * highestFreqKhz,
    });

    const fmEval = evaluateBranchMetrics({
      referenceMessage: message,
      attenuatedSignal: fmBranch.attenuatedSignal,
      noise,
      ifFilteredSignal: fmBranch.ifFilteredSignal,
      ifFilteredNoise: fmBranch.ifFilteredNoise,
      recoveredRaw: fmBranch.recoveredRaw,
      noiselessRecoveredRaw: fmBranch.noiselessRecoveredRaw,
      transmitted: fmBranch.transmitted,
      fs: base.fs,
      carrierFreqKhz: base.carrierFreqKhz,
      theoreticalBandwidthKhz: 2 * (base.fmDeviationKhz + highestFreqKhz),
    });

    // Clamp failed SNR to -18 dB for continuous curve plotting
    const fmOutDb = fmEval.metrics.outputSnrDb !== null ? Math.max(-18, fmEval.metrics.outputSnrDb) : -18;
    const amOutDb = amEval.metrics.outputSnrDb !== null ? Math.max(-18, amEval.metrics.outputSnrDb) : -18;

    points.push({
      noiseLevelDb,
      inputSnrDb: fmEval.metrics.inputSnrDb,
      ifCnrDb: fmEval.metrics.ifCnrDb,
      fmOutputSnrDb: fmOutDb,
      amOutputSnrDb: amOutDb,
      fmRmse: fmEval.metrics.rmse ?? 1.0,
      amRmse: amEval.metrics.rmse ?? 1.0,
      fmCorrelation: fmEval.metrics.correlation,
      clickEventsDetected: fmBranch.clickEventsDetected,
    });
  }

  // Empirically detect threshold knee from the simulated sweep:
  // Identify the highest-noise transition where FM Output SNR begins dropping sharply (> 5 dB drop per 2 dB step)
  // or where click events exceed 3 and output SNR falls at least 6 dB below its clean plateau.
  const plateauSnr = points[0]?.fmOutputSnrDb ?? 30;
  let estimatedThresholdInputSnrDb: number | null = null;
  let estimatedThresholdIfCnrDb: number | null = null;

  for (let i = 1; i < points.length; i++) {
    const dropFromPrev = points[i - 1].fmOutputSnrDb - points[i].fmOutputSnrDb;
    const dropFromPlateau = plateauSnr - points[i].fmOutputSnrDb;
    if (
      (dropFromPrev >= 4.5 && dropFromPlateau >= 6.0) ||
      (points[i].clickEventsDetected >= 3 && dropFromPlateau >= 8.0)
    ) {
      estimatedThresholdInputSnrDb = points[i].inputSnrDb;
      estimatedThresholdIfCnrDb = points[i].ifCnrDb;
      break;
    }
  }

  return {
    points,
    estimatedThresholdInputSnrDb,
    estimatedThresholdIfCnrDb,
    carsonBandwidthKhz: 2 * (base.fmDeviationKhz + highestFreqKhz),
    modulationIndexBeta: base.fmDeviationKhz / highestFreqKhz,
  };
}
