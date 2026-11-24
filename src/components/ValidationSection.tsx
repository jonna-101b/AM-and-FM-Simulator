import React, { useMemo } from 'react';
import { ArrowRight, Calculator } from 'lucide-react';
import { runSimulation } from '../dsp/simulator';
import { DEFAULT_PARAMS, SimulationParams, SimulationResult } from '../dsp/types';

interface ValidationSectionProps {
  liveParams: SimulationParams;
  liveResult: SimulationResult;
  onLoadIntoSimulator: (next: SimulationParams) => void;
}

export const ValidationSection: React.FC<ValidationSectionProps> = ({
  liveParams,
  liveResult,
  onLoadIntoSimulator,
}) => {
  // Fixed independent verification simulation for Validation 1 & Validation 2
  // Never altered by live simulator slider changes.
  const referenceValidationRun = useMemo(() => {
    return runSimulation({
      ...DEFAULT_PARAMS,
      messageBandwidthKhz: 4,
      messageType: 'single-tone',
      singleToneFreqKhz: 4,
      carrierFreqKhz: 100,
      carrierAmp: 1.0,
      amModIndex: 0.5,
      fmDeviationKhz: 25,
      noiseLevelDb: -45,
      channelAttenuation: 1.0,
    });
  }, []);

  // Extract simulated AM sideband amplitudes/frequencies from reference run FFT
  const amSidebandInspect = useMemo(() => {
    const { freqsKhz, amDb } = referenceValidationRun.spectrum;
    const findPeakNear = (targetKhz: number) => {
      let bestDb = -99;
      let bestFreq = targetKhz;
      for (let i = 0; i < freqsKhz.length; i++) {
        if (Math.abs(freqsKhz[i] - targetKhz) <= 0.6) {
          if (amDb[i] > bestDb) {
            bestDb = amDb[i];
            bestFreq = freqsKhz[i];
          }
        }
      }
      return { freqKhz: bestFreq, magDb: bestDb };
    };
    return {
      lsb: findPeakNear(96),
      carrier: findPeakNear(100),
      usb: findPeakNear(104),
    };
  }, [referenceValidationRun]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Engineering Validation</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Independent hand-calculation proofs verified against dedicated numerical simulator runs.
          These fixed benchmark problems remain locked even as you adjust the live simulator
          controls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validation 1: AM Modulation Index & Sideband Bandwidth */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="text-xs font-mono text-blue-700 font-semibold">
                Validation 1 · Fixed Benchmark
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                AM Modulation Index &amp; Sideband Bandwidth
              </h3>
            </div>
            <Calculator className="w-5 h-5 text-blue-600 shrink-0" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs font-mono text-slate-800 space-y-1">
            <div>Given Parameters:</div>
            <div>• Message frequency: fm = 4.0 kHz (single-tone sinusoid)</div>
            <div>• Carrier frequency: fc = 100.0 kHz (Ac = 1.00 V)</div>
            <div>• Modulation index: μ = 0.50 (50% modulation)</div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <h4 className="font-semibold text-slate-900">Step-by-Step Hand Calculation</h4>
            <div className="font-mono bg-white border border-slate-200 rounded p-3 space-y-1.5 text-[11px] text-slate-800">
              <div>s_AM(t) = Ac[1 + μ·cos(2πfmt)]·cos(2πfct)</div>
              <div>
                = Ac·cos(2πfct) + (μAc/2)·cos(2π(fc + fm)t) + (μAc/2)·cos(2π(fc − fm)t)
              </div>
              <div className="pt-1 border-t border-slate-100">
                1. Carrier frequency = <strong>100.00 kHz</strong> (Peak = 1.00 V → 0.00 dBV)
              </div>
              <div>
                2. Upper Sideband (USB) = fc + fm = 100 + 4 = <strong>104.00 kHz</strong>
              </div>
              <div>
                3. Lower Sideband (LSB) = fc − fm = 100 − 4 = <strong>96.00 kHz</strong>
              </div>
              <div>
                4. Sideband amplitude = μAc/2 = 0.50 × 1.0 / 2 = <strong>0.25 V (−12.04 dBV)</strong>
              </div>
              <div>
                5. Theoretical AM Bandwidth: B_AM = 2·fm = 2 × 4 = <strong>8.00 kHz</strong>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Theoretical vs Simulator Comparison
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-blue-50/60 border border-blue-100 rounded p-2.5">
                <div className="text-slate-500 text-[11px] font-sans">Fixed Benchmark FFT</div>
                <div className="text-slate-900 mt-1">
                  LSB: {amSidebandInspect.lsb.freqKhz.toFixed(2)} kHz (
                  {amSidebandInspect.lsb.magDb.toFixed(2)} dB)
                </div>
                <div className="text-slate-900">
                  fc: {amSidebandInspect.carrier.freqKhz.toFixed(2)} kHz (
                  {amSidebandInspect.carrier.magDb.toFixed(2)} dB)
                </div>
                <div className="text-slate-900">
                  USB: {amSidebandInspect.usb.freqKhz.toFixed(2)} kHz (
                  {amSidebandInspect.usb.magDb.toFixed(2)} dB)
                </div>
                <div className="text-blue-700 font-semibold mt-1">
                  99% BW: {referenceValidationRun.amMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                <div className="text-slate-500 text-[11px] font-sans">Your Live Simulator</div>
                <div className="text-slate-900 mt-1">
                  fm = {liveParams.messageBandwidthKhz} kHz, μ = {liveParams.amModIndex.toFixed(2)}
                </div>
                <div className="text-slate-900">
                  Theory B_AM: {liveResult.amMetrics.theoreticalBandwidthKhz.toFixed(2)} kHz
                </div>
                <div className="text-slate-900">
                  Measured 99%: {liveResult.amMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onLoadIntoSimulator({
                  ...liveParams,
                  messageBandwidthKhz: 4,
                  messageType: 'single-tone',
                  singleToneFreqKhz: 4,
                  carrierFreqKhz: 100,
                  carrierAmp: 1.0,
                  amModIndex: 0.5,
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer pt-1"
            >
              Load Validation 1 settings into live simulator
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Validation 2: FM Bandwidth using Carson's Rule */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="text-xs font-mono text-amber-700 font-semibold">
                Validation 2 · Fixed Benchmark
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                FM Bandwidth via Carson&apos;s Rule
              </h3>
            </div>
            <Calculator className="w-5 h-5 text-amber-600 shrink-0" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs font-mono text-slate-800 space-y-1">
            <div>Given Parameters:</div>
            <div>• Maximum message frequency: fm = 4.0 kHz</div>
            <div>• Peak frequency deviation: Δf = 25.0 kHz</div>
            <div>• Carrier frequency: fc = 100.0 kHz (Ac = 1.00 V)</div>
          </div>

          <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
            <h4 className="font-semibold text-slate-900">Step-by-Step Hand Calculation</h4>
            <div className="font-mono bg-white border border-slate-200 rounded p-3 space-y-1.5 text-[11px] text-slate-800">
              <div>1. FM Modulation Index: β = Δf / fm = 25 / 4 = <strong>6.25</strong> (Wideband FM)</div>
              <div>2. Carson&apos;s Rule Formula: B_FM ≈ 2(Δf + fm)</div>
              <div>
                3. Substitute values: B_FM ≈ 2(25.0 + 4.0) = 2 × 29.0 = <strong>58.00 kHz</strong>
              </div>
              <div>
                4. Expected spectral span: [fc − 29, fc + 29] = <strong>[71.0 kHz, 129.0 kHz]</strong>
              </div>
              <div>
                5. Sideband spacing: spaced at integer multiples k·fm = <strong>4.0 kHz</strong>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <div className="text-xs font-semibold text-slate-900">
              Theoretical vs Simulator Comparison
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-amber-50/60 border border-amber-100 rounded p-2.5">
                <div className="text-slate-500 text-[11px] font-sans">Fixed Benchmark FFT</div>
                <div className="text-slate-900 mt-1">
                  Carson&apos;s B_FM: {referenceValidationRun.fmMetrics.theoreticalBandwidthKhz.toFixed(2)} kHz
                </div>
                <div className="text-amber-700 font-semibold mt-1">
                  Measured 99% BW: {referenceValidationRun.fmMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </div>
                <div className="text-slate-600 mt-1">
                  Output SNR: {referenceValidationRun.fmMetrics.outputSnrDb?.toFixed(2)} dB
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                <div className="text-slate-500 text-[11px] font-sans">Your Live Simulator</div>
                <div className="text-slate-900 mt-1">
                  Δf = {liveParams.fmDeviationKhz} kHz, fm = {liveParams.messageBandwidthKhz} kHz
                </div>
                <div className="text-slate-900">
                  Carson B_FM: {liveResult.fmMetrics.theoreticalBandwidthKhz.toFixed(2)} kHz
                </div>
                <div className="text-slate-900">
                  Measured 99%: {liveResult.fmMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onLoadIntoSimulator({
                  ...liveParams,
                  messageBandwidthKhz: 4,
                  messageType: 'single-tone',
                  singleToneFreqKhz: 4,
                  carrierFreqKhz: 100,
                  fmDeviationKhz: 25,
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 cursor-pointer pt-1"
            >
              Load Validation 2 settings into live simulator
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed space-y-1.5">
        <h4 className="text-sm font-semibold text-slate-900">
          Why Theoretical Bandwidth Differs from Numerically Measured 99% Bandwidth
        </h4>
        <p>
          <strong>1. Finite-Window FFT Spectral Leakage:</strong> Because the simulator uses a
          finite 8.0 ms time record with a Hann window, each discrete spectral line has a main-lobe
          width of roughly 0.25–0.38 kHz, slightly broadening sharp AM lines (e.g., 7.75–8.25 kHz
          measured vs 8.00 kHz exact).
        </p>
        <p>
          <strong>2. Carson&apos;s Rule vs. 99% Bessel Power Bandwidth:</strong> Strictly speaking, an
          FM spectrum extends to infinite Bessel sidebands <span className="font-mono">Jn(β)</span>.
          Carson&apos;s rule <span className="font-mono">2(Δf + fm) = 58.0 kHz</span> estimates the
          span containing roughly 98% of total power for a full-amplitude tone at{' '}
          <span className="font-mono">fm</span>. For a 99% power threshold on a single-tone
          sinusoid (Validation 2), one extra pair of Bessel sidebands contributes slightly wider
          measured 99% power (~64 kHz), whereas multi-tone or chirp waveforms with lower RMS
          deviation concentrate 99% of their power slightly inside Carson&apos;s bound.
        </p>
      </div>
    </div>
  );
};
