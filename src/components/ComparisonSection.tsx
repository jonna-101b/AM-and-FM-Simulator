import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SimulationResult } from '../dsp/types';

interface ComparisonSectionProps {
  result: SimulationResult;
}

function formatMetric(value: number | null, decimals: number, suffix = ''): string {
  if (value === null || !Number.isFinite(value)) return 'Invalid';
  return `${value.toFixed(decimals)}${suffix}`;
}

export const ComparisonSection: React.FC<ComparisonSectionProps> = ({ result }) => {
  const { amMetrics, fmMetrics, params } = result;
  const amOvermod = params.amModIndex > 1.0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          AM and FM Performance Comparison
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Quantitative measurements computed directly from the live simulated waveforms and spectra
          under identical message samples and channel conditions.
        </p>
      </div>

      {/* Quantitative Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Measured Receiver &amp; Channel Metrics
          </h3>
          <span className="text-xs font-mono text-slate-500">
            fm = {params.messageBandwidthKhz} kHz · fc = {params.carrierFreqKhz} kHz · μ ={' '}
            {params.amModIndex.toFixed(2)} · Δf = {params.fmDeviationKhz} kHz
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Measurement</th>
                <th className="py-3 px-4 font-semibold text-blue-700">AM (Envelope Detection)</th>
                <th className="py-3 px-4 font-semibold text-amber-700">
                  FM (Quadrature Discriminator)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Input SNR (Receiver Input)</div>
                  <div className="text-xs text-slate-500">
                    10·log₁₀(P_signal / P_noise) before IF filtering
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {amMetrics.inputSnrDb.toFixed(2)} dB
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {fmMetrics.inputSnrDb.toFixed(2)} dB
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">IF Carrier-to-Noise Ratio (CNR)</div>
                  <div className="text-xs text-slate-500">
                    Signal-to-noise ratio inside receiver IF passband
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {amMetrics.ifCnrDb.toFixed(2)} dB
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {fmMetrics.ifCnrDb.toFixed(2)} dB
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Output SNR</div>
                  <div className="text-xs text-slate-500">
                    Aligned, DC-removed, amplitude-matched recovered signal vs m(t)
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums">
                  {!amMetrics.demodulationValid ? (
                    <span className="inline-flex items-center gap-1.5 text-rose-700 font-sans text-xs font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Invalid (Demodulation failed)
                    </span>
                  ) : amOvermod ? (
                    <div>
                      <span className="text-amber-700 font-semibold">
                        {formatMetric(amMetrics.outputSnrDb, 2, ' dB')}
                      </span>
                      <div className="text-[11px] font-sans text-rose-700 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        Overmodulated (μ &gt; 1.0 distortion)
                      </div>
                    </div>
                  ) : (
                    <span className="text-blue-700 font-semibold">
                      {formatMetric(amMetrics.outputSnrDb, 2, ' dB')}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums">
                  {!fmMetrics.demodulationValid ? (
                    <span className="inline-flex items-center gap-1.5 text-rose-700 font-sans text-xs font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Invalid (Threshold collapse)
                    </span>
                  ) : (
                    <span className="text-amber-700 font-semibold">
                      {formatMetric(fmMetrics.outputSnrDb, 2, ' dB')}
                    </span>
                  )}
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Mean Squared Error (MSE)</div>
                  <div className="text-xs text-slate-500">
                    Mean of [m̂_aligned(t) − m(t)]²
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {amMetrics.demodulationValid
                    ? formatMetric(amMetrics.mse, 5)
                    : 'Invalid (Failed)'}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {fmMetrics.demodulationValid
                    ? formatMetric(fmMetrics.mse, 5)
                    : 'Invalid (Failed)'}
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Root Mean Squared Error (RMSE)</div>
                  <div className="text-xs text-slate-500">√MSE in normalized message units</div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {amMetrics.demodulationValid
                    ? formatMetric(amMetrics.rmse, 4)
                    : 'Invalid (Failed)'}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {fmMetrics.demodulationValid
                    ? formatMetric(fmMetrics.rmse, 4)
                    : 'Invalid (Failed)'}
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Signal-to-Distortion Ratio (SDR)</div>
                  <div className="text-xs text-slate-500">
                    Demodulator linearity &amp; filter fidelity (noise-free pass)
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {formatMetric(amMetrics.sdrDb, 2, ' dB')}
                  {amOvermod && (
                    <span className="block text-[11px] font-sans text-rose-700">
                      Reduced by envelope folding
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {formatMetric(fmMetrics.sdrDb, 2, ' dB')}
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Modulation Parameter</div>
                  <div className="text-xs text-slate-500">
                    AM modulation index μ vs FM peak deviation Δf (β = Δf/fm)
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  μ = {params.amModIndex.toFixed(2)}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  Δf = {params.fmDeviationKhz} kHz (β ={' '}
                  {(params.fmDeviationKhz / params.messageBandwidthKhz).toFixed(2)})
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Theoretical Bandwidth</div>
                  <div className="text-xs text-slate-500">
                    AM: 2·fm · FM: Carson&apos;s rule 2(Δf + fm)
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-blue-700 font-semibold">
                  {amMetrics.theoreticalBandwidthKhz.toFixed(2)} kHz
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-amber-700 font-semibold">
                  {fmMetrics.theoreticalBandwidthKhz.toFixed(2)} kHz
                </td>
              </tr>

              <tr>
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-900">Measured Occupied Bandwidth (99%)</div>
                  <div className="text-xs text-slate-500">
                    Numerically integrated from simulated FFT power spectrum
                  </div>
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {amMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-slate-900">
                  {fmMetrics.measuredBandwidthKhz.toFixed(2)} kHz
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Qualitative Engineering Comparison Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">
            Engineering Trade-Off Summary: AM vs FM
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold w-48">Criterion</th>
                <th className="py-2.5 px-4 font-semibold text-blue-700">Amplitude Modulation (AM)</th>
                <th className="py-2.5 px-4 font-semibold text-amber-700">Frequency Modulation (FM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs leading-relaxed text-slate-700">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Modulation Principle</td>
                <td className="py-3 px-4">
                  Message varies the instantaneous carrier amplitude around Ac while frequency fc
                  stays fixed.
                </td>
                <td className="py-3 px-4">
                  Message varies the instantaneous carrier frequency fc + kf·m(t) while amplitude Ac
                  stays constant.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Noise Performance</td>
                <td className="py-3 px-4">
                  Additive noise directly perturbs the amplitude envelope and passes straight to the
                  recovered audio.
                </td>
                <td className="py-3 px-4">
                  Constant-envelope limiting removes amplitude fluctuations; wideband deviation (β &gt;
                  1) improves SNR above threshold.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Output SNR</td>
                <td className="py-3 px-4">
                  Limited by carrier power inefficiency; scales linearly with input CNR and μ².
                </td>
                <td className="py-3 px-4">
                  Substantially higher than AM above threshold (scales with β²), exchanging bandwidth
                  for noise immunity.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Distortion</td>
                <td className="py-3 px-4">
                  Susceptible to envelope folding when μ &gt; 1.0 and diagonal clipping / ripple if
                  RC time constant is mis-tuned.
                </td>
                <td className="py-3 px-4">
                  Linear across wide deviation when IF passband covers Carson&apos;s bandwidth; nonlinear
                  click distortion appears below threshold.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Bandwidth</td>
                <td className="py-3 px-4">
                  Spectrally compact: strictly 2·fm (e.g., 8 kHz for a 4 kHz audio signal).
                </td>
                <td className="py-3 px-4">
                  Requires significantly wider spectrum: B_FM ≈ 2(Δf + fm) (e.g., 58 kHz for Δf = 25
                  kHz, fm = 4 kHz).
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Receiver Complexity</td>
                <td className="py-3 px-4">
                  Very simple: diode rectifier + RC low-pass filter + DC-blocking capacitor.
                </td>
                <td className="py-3 px-4">
                  Higher complexity: IF filter + amplitude limiter + frequency discriminator /
                  quadrature phase detector + audio LPF.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Weak-Signal Sensitivity</td>
                <td className="py-3 px-4">
                  Degrades gradually as noise increases without a sudden abrupt cliff (at moderate
                  SNR, linear envelope degrades smoothly).
                </td>
                <td className="py-3 px-4">
                  Exhibits the FM threshold effect: once IF CNR drops below ~8–13 dB, click noise
                  causes rapid quality collapse.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Explicit AM vs FM Takeaways */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <CheckCircle2 className="w-4 h-4" />
            AM Engineering Summary
          </div>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>Information is carried through changes in carrier amplitude.</li>
            <li>Conventional AM envelope detection is relatively simple.</li>
            <li>Amplitude noise directly affects the information-bearing envelope.</li>
            <li>Conventional AM is susceptible to overmodulation when μ &gt; 1.0.</li>
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <CheckCircle2 className="w-4 h-4" />
            FM Engineering Summary
          </div>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>Information is carried through changes in instantaneous carrier frequency.</li>
            <li>FM demodulation requires a frequency discriminator or equivalent receiver.</li>
            <li>Amplitude limiting can reduce the effect of amplitude variations.</li>
            <li>
              FM generally offers better noise performance under suitable received-signal
              conditions, but suffers from a threshold effect at low carrier-to-noise ratios.
            </li>
            <li>FM generally requires more bandwidth.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
