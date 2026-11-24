export type MessageBandwidthKhz = 3 | 4 | 5;
export type MessageSignalType = 'multi-tone' | 'single-tone' | 'sweep';
export type RectifierMode = 'full-wave' | 'half-wave';

export interface SimulationParams {
  // Sampling & Message
  fs: number; // Sampling frequency in Hz (default 1,024,000 Hz)
  numSamples: number; // Power of 2 (default 8192 -> 8.0 ms)
  messageBandwidthKhz: MessageBandwidthKhz; // 3, 4, or 5 kHz
  messageType: MessageSignalType;
  singleToneFreqKhz: number; // Used when messageType === 'single-tone', clamped to <= messageBandwidthKhz

  // Shared Carrier & Channel
  carrierAmp: number; // Ac in Volts (0.2 to 2.0 V)
  carrierFreqKhz: number; // fc in kHz (50 to 200 kHz)
  channelAttenuation: number; // Linear gain alpha in (0.05 to 1.0)
  noiseLevelDb: number; // Wideband AWGN power level in dB (-45 to +5 dB)
  noiseSeed: number; // Deterministic seed for reproducible AWGN

  // AM Specific
  amModIndex: number; // mu (0.0 to 1.2)
  amRcCutoffKhz: number; // Envelope detector RC LPF cutoff frequency in kHz (1.5 to 40 kHz)
  amRectifierMode: RectifierMode;
  amIfFilterEnabled: boolean; // Bandpass filter before envelope detector

  // FM Specific
  fmDeviationKhz: number; // Peak frequency deviation Δf in kHz (1 to 75 kHz)
  fmAudioCutoffKhz: number; // Post-discriminator audio LPF cutoff in kHz (3 to 15 kHz)
  fmIfMarginFactor: number; // Multiplier on Carson bandwidth for IF filter (e.g., 1.1)
}

export type WarningCode =
  | 'AM_OVERMODULATION'
  | 'AM_RC_RIPPLE'
  | 'AM_DIAGONAL_CLIPPING'
  | 'FM_THRESHOLD_REGION'
  | 'DEMODULATION_FAILED'
  | 'SPECTRUM_ALIASING_RISK';

export interface SystemWarning {
  code: WarningCode;
  branch: 'AM' | 'FM' | 'CHANNEL';
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
}

export interface BranchMetrics {
  inputSnrDb: number;
  ifCnrDb: number; // Carrier-to-Noise Ratio inside receiver IF passband
  outputSnrDb: number | null; // Null when demodulation has completely failed
  mse: number | null;
  rmse: number | null;
  sdrDb: number | null; // Signal-to-Distortion Ratio (nonlinear/filter distortion + residual error)
  correlation: number; // Pearson correlation with original message after lag alignment
  optimalLagSamples: number;
  theoreticalBandwidthKhz: number;
  measuredBandwidthKhz: number; // 99% occupied power bandwidth from simulated spectrum
  demodulationValid: boolean;
  invalidReason?: string;
}

export interface SpectrumData {
  freqsKhz: Float64Array;
  amDb: Float64Array; // Normalized magnitude in dB relative to Ac (dBc / dBV)
  fmDb: Float64Array;
  messageFreqsKhz: Float64Array;
  messageDb: Float64Array;
}

export interface SimulationResult {
  params: SimulationParams;
  timeMs: Float64Array; // Time axis in milliseconds
  message: Float64Array; // Normalized m(t), max|m(t)| = 1

  // AM signals
  amTransmitted: Float64Array;
  amReceived: Float64Array;
  amRecovered: Float64Array; // Aligned, DC-removed, scaled recovered signal for display comparison
  amRecoveredRaw: Float64Array; // Direct output of envelope detector + DC block before amplitude matching

  // FM signals
  fmTransmitted: Float64Array;
  fmReceived: Float64Array;
  fmRecovered: Float64Array;
  fmRecoveredRaw: Float64Array;
  fmInstantaneousFreqKhz: Float64Array; // Theoretical fi(t) = fc + Δf*m(t)
  fmDemodInstantaneousFreqKhz: Float64Array; // Actual discriminator instantaneous frequency estimate

  // Spectra & Metrics
  spectrum: SpectrumData;
  amMetrics: BranchMetrics;
  fmMetrics: BranchMetrics;
  warnings: SystemWarning[];
}

export interface ThresholdSweepPoint {
  noiseLevelDb: number;
  inputSnrDb: number;
  ifCnrDb: number;
  fmOutputSnrDb: number;
  amOutputSnrDb: number;
  fmRmse: number;
  amRmse: number;
  fmCorrelation: number;
  clickEventsDetected: number; // Count of 2π phase-wrap click spikes in discriminator
}

export interface ThresholdInvestigationResult {
  points: ThresholdSweepPoint[];
  estimatedThresholdInputSnrDb: number | null;
  estimatedThresholdIfCnrDb: number | null;
  carsonBandwidthKhz: number;
  modulationIndexBeta: number;
}

export interface NoisePreset {
  id: 'clean' | 'moderate' | 'weak';
  label: string;
  subtitle: string;
  noiseLevelDb: number;
  channelAttenuation: number;
  description: string;
}

export const NOISE_PRESETS: NoisePreset[] = [
  {
    id: 'clean',
    label: 'Experiment 1: Clean Channel',
    subtitle: 'Low noise · Strong received signal',
    noiseLevelDb: -38,
    channelAttenuation: 1.0,
    description:
      'Near-ideal channel (Noise = -38 dB, Attenuation α = 1.00 / 0 dB loss). Both AM and FM achieve clean message recovery.',
  },
  {
    id: 'moderate',
    label: 'Experiment 2: Moderate Noise',
    subtitle: 'Moderate AWGN · Normal signal strength',
    noiseLevelDb: -11,
    channelAttenuation: 0.7,
    description:
      'Noticeable AWGN (Noise = -11 dB, Attenuation α = 0.70 / 3.1 dB loss). FM limiter suppresses amplitude noise while AM envelope degrades.',
  },
  {
    id: 'weak',
    label: 'Experiment 3: Weak-Signal Condition',
    subtitle: 'High noise · Attenuated carrier (FM threshold)',
    noiseLevelDb: -5,
    channelAttenuation: 0.26,
    description:
      'Weak received carrier (Noise = -5 dB, Attenuation α = 0.26 / 11.7 dB loss). Carrier-to-noise ratio enters the FM threshold region with click noise.',
  },
];

export const DEFAULT_PARAMS: SimulationParams = {
  fs: 1_024_000, // 1.024 MHz (exact bin alignment at 125 Hz spacing for N=8192)
  numSamples: 8192, // 8.0 ms window
  messageBandwidthKhz: 4,
  messageType: 'multi-tone',
  singleToneFreqKhz: 4,

  carrierAmp: 1.0,
  carrierFreqKhz: 100,
  channelAttenuation: 1.0,
  noiseLevelDb: -38,
  noiseSeed: 4217,

  amModIndex: 0.7,
  amRcCutoffKhz: 16.0,
  amRectifierMode: 'full-wave',
  amIfFilterEnabled: true,

  fmDeviationKhz: 25,
  fmAudioCutoffKhz: 5.0,
  fmIfMarginFactor: 1.1,
};

/**
 * Validates and clamps simulation parameters to prevent numerical instability or aliasing.
 */
export function sanitizeParams(raw: SimulationParams): SimulationParams {
  const fs = 1_024_000;
  const numSamples = 8192;
  const messageBandwidthKhz: MessageBandwidthKhz =
    raw.messageBandwidthKhz === 3 || raw.messageBandwidthKhz === 4 || raw.messageBandwidthKhz === 5
      ? raw.messageBandwidthKhz
      : 4;

  const singleToneFreqKhz = Math.min(
    messageBandwidthKhz,
    Math.max(0.5, Number.isFinite(raw.singleToneFreqKhz) ? raw.singleToneFreqKhz : messageBandwidthKhz)
  );

  const carrierAmp = Math.min(2.0, Math.max(0.2, Number.isFinite(raw.carrierAmp) ? raw.carrierAmp : 1.0));
  const carrierFreqKhz = Math.min(
    220,
    Math.max(40, Number.isFinite(raw.carrierFreqKhz) ? raw.carrierFreqKhz : 100)
  );
  const channelAttenuation = Math.min(
    1.0,
    Math.max(0.05, Number.isFinite(raw.channelAttenuation) ? raw.channelAttenuation : 1.0)
  );
  const noiseLevelDb = Math.min(10, Math.max(-50, Number.isFinite(raw.noiseLevelDb) ? raw.noiseLevelDb : -38));
  const amModIndex = Math.min(1.2, Math.max(0, Number.isFinite(raw.amModIndex) ? raw.amModIndex : 0.7));
  const amRcCutoffKhz = Math.min(40, Math.max(1.0, Number.isFinite(raw.amRcCutoffKhz) ? raw.amRcCutoffKhz : 8.0));
  const fmDeviationKhz = Math.min(75, Math.max(1, Number.isFinite(raw.fmDeviationKhz) ? raw.fmDeviationKhz : 25));
  const fmAudioCutoffKhz = Math.min(
    20,
    Math.max(2.0, Number.isFinite(raw.fmAudioCutoffKhz) ? raw.fmAudioCutoffKhz : 5.0)
  );

  return {
    ...raw,
    fs,
    numSamples,
    messageBandwidthKhz,
    singleToneFreqKhz,
    carrierAmp,
    carrierFreqKhz,
    channelAttenuation,
    noiseLevelDb,
    amModIndex,
    amRcCutoffKhz,
    fmDeviationKhz,
    fmAudioCutoffKhz,
    fmIfMarginFactor: Math.min(1.5, Math.max(1.0, raw.fmIfMarginFactor || 1.1)),
  };
}
