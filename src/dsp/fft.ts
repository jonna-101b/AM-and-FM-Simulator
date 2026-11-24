/**
 * Radix-2 Cooley-Tukey FFT, IFFT, Hilbert Analytic Signal, Zero-Phase Spectral Filters,
 * and Occupied Bandwidth Estimator.
 */

export interface ComplexArrays {
  re: Float64Array;
  im: Float64Array;
}

/**
 * In-place radix-2 Cooley-Tukey FFT (or inverse FFT when inverse = true).
 * Length n must be a power of 2.
 */
export function fftInPlace(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of 2, received ${n}`);
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (sign * 2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < halfLen; k++) {
        const evenIdx = i + k;
        const oddIdx = evenIdx + halfLen;

        const oddRe = re[oddIdx] * wRe - im[oddIdx] * wIm;
        const oddIm = re[oddIdx] * wIm + im[oddIdx] * wRe;

        re[oddIdx] = re[evenIdx] - oddRe;
        im[oddIdx] = im[evenIdx] - oddIm;
        re[evenIdx] += oddRe;
        im[evenIdx] += oddIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
      }
    }
  }

  if (inverse) {
    const invN = 1.0 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= invN;
      im[i] *= invN;
    }
  }
}

/**
 * Computes the analytic signal z(t) = x(t) + j * H{x(t)} via FFT Hilbert transform.
 */
export function analyticSignal(signal: Float64Array): ComplexArrays {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fftInPlace(re, im, false);

  // Zero out negative frequencies, double positive frequencies (keep DC and Nyquist x1)
  for (let k = 1; k < n / 2; k++) {
    re[k] *= 2.0;
    im[k] *= 2.0;
  }
  for (let k = n / 2 + 1; k < n; k++) {
    re[k] = 0.0;
    im[k] = 0.0;
  }

  fftInPlace(re, im, true);
  return { re, im };
}

/**
 * Zero-phase raised-cosine tapered bandpass filter in the frequency domain.
 * Models a linear-phase IF bandpass filter centered at centerFreqHz with total passband bandwidthHz.
 */
export function bandpassFilter(
  signal: Float64Array,
  fs: number,
  centerFreqHz: number,
  bandwidthHz: number
): Float64Array {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fftInPlace(re, im, false);

  const halfBw = Math.max(1000, bandwidthHz / 2);
  const transitionHz = Math.max(1000, Math.min(8000, halfBw * 0.2));
  const fLowPass = Math.max(500, centerFreqHz - halfBw);
  const fHighPass = Math.min(fs / 2 - 500, centerFreqHz + halfBw);
  const fLowStop = Math.max(0, fLowPass - transitionHz);
  const fHighStop = Math.min(fs / 2, fHighPass + transitionHz);

  const df = fs / n;

  for (let k = 0; k < n; k++) {
    const binFreq = k <= n / 2 ? k * df : (n - k) * df;
    let gain = 0.0;

    if (binFreq >= fLowPass && binFreq <= fHighPass) {
      gain = 1.0;
    } else if (binFreq >= fLowStop && binFreq < fLowPass) {
      const ratio = (binFreq - fLowStop) / Math.max(1, fLowPass - fLowStop);
      gain = 0.5 * (1 - Math.cos(Math.PI * ratio));
    } else if (binFreq > fHighPass && binFreq <= fHighStop) {
      const ratio = (fHighStop - binFreq) / Math.max(1, fHighStop - fHighPass);
      gain = 0.5 * (1 - Math.cos(Math.PI * ratio));
    }

    re[k] *= gain;
    im[k] *= gain;
  }

  fftInPlace(re, im, true);
  return re;
}

/**
 * Zero-phase raised-cosine low-pass audio filter in the frequency domain.
 * Used as the post-discriminator audio filter in the FM receiver.
 */
export function lowpassFilter(signal: Float64Array, fs: number, cutoffHz: number): Float64Array {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  re.set(signal);

  fftInPlace(re, im, false);

  const fPass = Math.max(500, cutoffHz);
  const transition = Math.max(500, cutoffHz * 0.25);
  const fStop = Math.min(fs / 2, fPass + transition);
  const df = fs / n;

  for (let k = 0; k < n; k++) {
    const binFreq = k <= n / 2 ? k * df : (n - k) * df;
    let gain = 0.0;
    if (binFreq <= fPass) {
      gain = 1.0;
    } else if (binFreq < fStop) {
      const ratio = (fStop - binFreq) / Math.max(1, fStop - fPass);
      gain = 0.5 * (1 - Math.cos(Math.PI * ratio));
    }
    re[k] *= gain;
    im[k] *= gain;
  }

  fftInPlace(re, im, true);
  return re;
}

/**
 * Computes single-sided magnitude spectrum in dB (relative to 1 V peak) using a Hann window
 * when needed, or unwindowed when coherent; using Hann window gives clean sidelobe suppression
 * across arbitrary sweep/multi-tone signals while preserving accurate peak heights.
 */
export function computeMagnitudeSpectrumDb(
  signal: Float64Array,
  fs: number,
  maxFreqKhz: number
): { freqsKhz: Float64Array; magDb: Float64Array; powerLinear: Float64Array } {
  const n = signal.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);

  // Apply Hann window with coherent gain correction (factor 2.0)
  let windowSum = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    re[i] = signal[i] * w;
    windowSum += w;
  }

  fftInPlace(re, im, false);

  const dfKhz = fs / n / 1000;
  const maxBin = Math.min(n / 2, Math.floor(maxFreqKhz / dfKhz));
  const freqsKhz = new Float64Array(maxBin + 1);
  const magDb = new Float64Array(maxBin + 1);
  const powerLinear = new Float64Array(maxBin + 1);

  const scale = 2.0 / windowSum;

  for (let k = 0; k <= maxBin; k++) {
    freqsKhz[k] = k * dfKhz;
    const binScale = k === 0 || k === n / 2 ? scale * 0.5 : scale;
    const mag = Math.hypot(re[k], im[k]) * binScale;
    powerLinear[k] = mag * mag;
    magDb[k] = 20 * Math.log10(Math.max(mag, 1e-6));
  }

  return { freqsKhz, magDb, powerLinear };
}

/**
 * Numerically measures the 99% occupied power bandwidth (in kHz) centered around the carrier frequency
 * from the unwindowed/windowed transmitted spectrum (noise-free transmitted signal).
 */
export function measureOccupiedBandwidthKhz(
  transmittedSignal: Float64Array,
  fs: number,
  carrierFreqKhz: number
): number {
  const n = transmittedSignal.length;
  const { freqsKhz, powerLinear } = computeMagnitudeSpectrumDb(transmittedSignal, fs, fs / 2000);

  // Restrict search window around carrier to avoid DC leakage, up to Nyquist
  const minSearchKhz = Math.max(0.5, carrierFreqKhz - 160);
  const maxSearchKhz = Math.min(fs / 2000 - 1, carrierFreqKhz + 160);

  let totalPower = 0;
  for (let k = 0; k < freqsKhz.length; k++) {
    if (freqsKhz[k] >= minSearchKhz && freqsKhz[k] <= maxSearchKhz) {
      totalPower += powerLinear[k];
    }
  }

  if (totalPower <= 1e-12) return 0;

  let cumPower = 0;
  let fLow = carrierFreqKhz;
  let fHigh = carrierFreqKhz;
  let foundLow = false;

  for (let k = 0; k < freqsKhz.length; k++) {
    if (freqsKhz[k] < minSearchKhz || freqsKhz[k] > maxSearchKhz) continue;
    cumPower += powerLinear[k];
    const frac = cumPower / totalPower;
    if (!foundLow && frac >= 0.005) {
      fLow = freqsKhz[k];
      foundLow = true;
    }
    if (frac >= 0.995) {
      fHigh = freqsKhz[k];
      break;
    }
  }

  return Math.max(0, fHigh - fLow);
}
