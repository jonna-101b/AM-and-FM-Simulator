import React from 'react';
import { AlertTriangle, BookOpen, Radio } from 'lucide-react';
import { NOISE_PRESETS, SimulationParams, SimulationResult } from '../dsp/types';
import { SpectrumChart, WaveformChart } from './Charts';
import { TimeWindowState } from './ZoomToolbar';

interface ViewProps {
  params: SimulationParams;
  result: SimulationResult;
  timeWindow: TimeWindowState;
  onChangeParams: (next: SimulationParams) => void;
  onNavigate?: (tabId: string) => void;
}

export const OverviewView: React.FC<ViewProps> = ({
  params,
  result,
  timeWindow,
  onNavigate,
}) => {
  const { amMetrics, fmMetrics } = result;

  return (
    <div className="space-y-6">
      {/* Hero Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              AM and FM Simulator: Modulation, Demodulation and Performance Comparison
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Real-time digital communications workbench feeding one normalized audio message signal
              simultaneously into conventional DSB+C Amplitude Modulation and Phase-Integral Frequency
              Modulation under identical AWGN channel conditions.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate?.('noise')}
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              Run Noise Experiments
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('threshold')}
              className="px-4 py-2 text-xs font-medium bg-white text-slate-800 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              FM Threshold Curve
            </button>
          </div>
        </div>

        {/* 4-column Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500">Shared Channel Input SNR</div>
            <div className="text-xl font-mono font-semibold text-slate-900 mt-1 tabular-nums">
              {fmMetrics.inputSnrDb.toFixed(2)}{' '}
              <span className="text-xs font-normal text-slate-500">dB</span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              Noise {params.noiseLevelDb.toFixed(1)} dB · α = {params.channelAttenuation.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-xs text-blue-700 font-medium">AM Recovered Output SNR</div>
            <div className="text-xl font-mono font-semibold text-blue-700 mt-1 tabular-nums">
              {amMetrics.demodulationValid && amMetrics.outputSnrDb !== null
                ? `${amMetrics.outputSnrDb.toFixed(2)} dB`
                : 'Failed'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              μ = {params.amModIndex.toFixed(2)} · B_AM = {amMetrics.theoreticalBandwidthKhz} kHz
            </div>
          </div>

          <div>
            <div className="text-xs text-amber-700 font-medium">FM Recovered Output SNR</div>
            <div className="text-xl font-mono font-semibold text-amber-700 mt-1 tabular-nums">
              {fmMetrics.demodulationValid && fmMetrics.outputSnrDb !== null
                ? `${fmMetrics.outputSnrDb.toFixed(2)} dB`
                : 'Threshold Collapse'}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              Δf = {params.fmDeviationKhz} kHz · Carson = {fmMetrics.theoreticalBandwidthKhz} kHz
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Sampling &amp; Carrier</div>
            <div className="text-xl font-mono font-semibold text-slate-900 mt-1 tabular-nums">
              {params.carrierFreqKhz} <span className="text-xs font-normal text-slate-500">kHz fc</span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              fs = {(params.fs / 1_000_000).toFixed(3)} MHz · fm = {params.messageBandwidthKhz} kHz
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side Live Recovery Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaveformChart
          title="AM Envelope Detector Output vs Original Message"
          subtitle={`μ = ${params.amModIndex.toFixed(2)} · RC Cutoff = ${params.amRcCutoffKhz.toFixed(1)} kHz`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'AM Recovered', data: result.amRecovered, color: '#2563eb', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.7}
          yMax={1.7}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="FM Quadrature Discriminator Output vs Original Message"
          subtitle={`Δf = ${params.fmDeviationKhz} kHz · IF CNR = ${fmMetrics.ifCnrDb.toFixed(1)} dB`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'FM Recovered', data: result.fmRecovered, color: '#d97706', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.7}
          yMax={1.7}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />
      </div>

      {/* Quick Inline How-to-Use Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
          <BookOpen className="w-4 h-4 text-slate-600" />
          How to Use This Simulator
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 leading-relaxed">
          <div>
            <span className="font-semibold text-slate-900 block mb-1">
              1. Vary Signal &amp; Modulation
            </span>
            Adjust message bandwidth (3–5 kHz), AM modulation index (0–1.2), and FM frequency
            deviation (2–75 kHz) in the left console. Zoom to 0.1 ms to inspect carrier cycles.
          </div>
          <div>
            <span className="font-semibold text-slate-900 block mb-1">
              2. Compare Noise &amp; Threshold
            </span>
            Use the three reproducible AWGN presets in Noise Experiments or sweep CNR in FM
            Threshold to observe FM&apos;s wideband gain and weak-signal threshold knee.
          </div>
          <div>
            <span className="font-semibold text-slate-900 block mb-1">
              3. Validate Calculations
            </span>
            Inspect the Comparison Table for live Input/Output SNR, MSE, RMSE, and SDR, then verify
            AM sidebands and Carson&apos;s rule in Engineering Validation.
          </div>
        </div>
      </div>
    </div>
  );
};

export const SignalGeneratorView: React.FC<ViewProps> = ({ params, result, timeWindow }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Shared Baseband Message Signal Generator
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Generates a normalized audio waveform m(t) within the selected 3, 4, or 5 kHz bandwidth.
          This exact sample array feeds both the AM and FM modulators.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Message Bandwidth (fm)</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
            {params.messageBandwidthKhz}.0 kHz
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Carrier Frequency (fc)</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
            {params.carrierFreqKhz}.0 kHz
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Sampling Frequency (fs)</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1">
            {(params.fs / 1000).toFixed(0)} kHz
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-xs text-slate-500">Normalized Peak |m(t)|</div>
          <div className="text-lg font-mono font-semibold text-emerald-700 mt-1">1.000 V</div>
        </div>
      </div>

      <WaveformChart
        title="Original Normalized Message Signal m(t)"
        subtitle={`Waveform: ${
          params.messageType === 'multi-tone'
            ? `Composite Multi-Tone (components at ${(0.25 * params.messageBandwidthKhz).toFixed(2)}, ${(0.625 * params.messageBandwidthKhz).toFixed(2)}, and ${params.messageBandwidthKhz}.00 kHz)`
            : params.messageType === 'single-tone'
            ? `Single Sinusoid at ${params.singleToneFreqKhz.toFixed(1)} kHz`
            : `Linear Frequency Chirp Sweep (0.4 kHz → ${params.messageBandwidthKhz}.0 kHz)`
        }`}
        timeMs={result.timeMs}
        series={[{ label: 'Message m(t)', data: result.message, color: '#0f172a', borderWidth: 1.8 }]}
        yLabel="Normalized Amplitude"
        yMin={-1.2}
        yMax={1.2}
        windowStartMs={timeWindow.startMs}
        windowDurationMs={timeWindow.durationMs}
        heightClass="h-64"
      />

      <SpectrumChart
        title="Baseband Message Frequency Spectrum |M(f)|"
        subtitle={`All signal energy lies within the selected ${params.messageBandwidthKhz} kHz audio bandwidth`}
        freqsKhz={result.spectrum.messageFreqsKhz}
        magDb={result.spectrum.messageDb}
        color="#0f172a"
        fillColor="rgba(15, 23, 42, 0.08)"
        xMinKhz={0}
        xMaxKhz={10}
        theoreticalLabel={`fm = ${params.messageBandwidthKhz}.0 kHz`}
      />
    </div>
  );
};

export const AmSimulatorView: React.FC<ViewProps> = ({ params, result, timeWindow }) => {
  const { amMetrics } = result;
  const maxEnv = params.carrierAmp * (1 + params.amModIndex);
  const specSpanKhz = Math.max(20, params.messageBandwidthKhz * 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-blue-700">
            AM Simulator: DSB+C Modulation &amp; Envelope Detection
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Conventional Double-Sideband AM with Carrier:{' '}
            <span className="font-mono text-slate-900">
              s_AM(t) = Ac[1 + μ·m(t)]cos(2πfct)
            </span>
            . Demodulated via {params.amRectifierMode} rectification and a 2-stage RC low-pass
            filter.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono space-y-0.5">
          <div>
            μ = <strong className="text-blue-700">{params.amModIndex.toFixed(2)}</strong> · RC fc ={' '}
            <strong>{params.amRcCutoffKhz.toFixed(1)} kHz</strong>
          </div>
          <div>
            Output SNR:{' '}
            <strong>
              {amMetrics.demodulationValid && amMetrics.outputSnrDb !== null
                ? `${amMetrics.outputSnrDb.toFixed(2)} dB`
                : 'Failed'}
            </strong>{' '}
            · SDR: <strong>{amMetrics.sdrDb?.toFixed(2) ?? 'N/A'} dB</strong>
          </div>
        </div>
      </div>

      {/* Overmodulation / RC Explanation Callout */}
      {params.amModIndex > 1.0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 leading-relaxed space-y-1">
            <div className="font-semibold text-sm">
              Overmodulation Distortion Active (μ = {params.amModIndex.toFixed(2)} &gt; 1.0)
            </div>
            <p>
              When μ &gt; 1, the envelope factor <span className="font-mono">1 + μ·m(t)</span> drops
              below zero during negative message peaks, causing a 180° carrier phase reversal. Because
              a diode envelope detector takes only the positive magnitude{' '}
              <span className="font-mono">|1 + μ·m(t)|</span>, negative excursions fold upward into
              false positive lobes, creating severe nonlinear harmonic distortion that cannot be
              removed by filtering.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
          <span className="font-semibold text-slate-900">Meaning of Modulation Index (μ):</span>{' '}
          μ controls how deeply the carrier amplitude varies relative to its unmodulated level Ac.
          At μ = 0.5, envelope amplitude swings between 0.5·Ac and 1.5·Ac. Keeping 0 &lt; μ ≤ 1.0
          ensures <span className="font-mono">1 + μ·m(t) ≥ 0</span> so the upper envelope remains a
          faithful replica of m(t).
        </div>
      )}

      {/* 4 Required AM Waveforms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaveformChart
          title="1. Original Message Signal m(t)"
          subtitle="Shared baseband input fed to the AM modulator"
          timeMs={result.timeMs}
          series={[{ label: 'm(t)', data: result.message, color: '#334155', borderWidth: 1.6 }]}
          yLabel="Amplitude (V)"
          yMin={-1.2}
          yMax={1.2}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="2. AM Transmitted Waveform s_AM(t)"
          subtitle={`Ac = ${params.carrierAmp.toFixed(2)} V · fc = ${params.carrierFreqKhz} kHz · μ = ${params.amModIndex.toFixed(2)}`}
          timeMs={result.timeMs}
          series={[
            { label: 's_AM(t)', data: result.amTransmitted, color: '#2563eb', borderWidth: 1.3 },
          ]}
          yLabel="Voltage (V)"
          yMin={-maxEnv * 1.15}
          yMax={maxEnv * 1.15}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="3. AM Received Waveform r_AM(t) (With AWGN)"
          subtitle={`Input SNR = ${amMetrics.inputSnrDb.toFixed(2)} dB · α = ${params.channelAttenuation.toFixed(2)}`}
          timeMs={result.timeMs}
          series={[
            { label: 'r_AM(t)', data: result.amReceived, color: '#1d4ed8', borderWidth: 1.2 },
          ]}
          yLabel="Voltage (V)"
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="4. AM Recovered Message (Envelope Detector)"
          subtitle={`${params.amRectifierMode} rectifier + RC LPF (${params.amRcCutoffKhz.toFixed(1)} kHz)`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'AM Recovered', data: result.amRecovered, color: '#2563eb', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.6}
          yMax={1.6}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />
      </div>

      {/* AM Frequency Spectrum */}
      <SpectrumChart
        title="AM Transmitted Frequency Spectrum |S_AM(f)|"
        subtitle={`Carrier at ${params.carrierFreqKhz} kHz with symmetric sidebands within ±${params.messageBandwidthKhz} kHz`}
        freqsKhz={result.spectrum.freqsKhz}
        magDb={result.spectrum.amDb}
        color="#2563eb"
        fillColor="rgba(37, 99, 235, 0.12)"
        xMinKhz={Math.max(0, params.carrierFreqKhz - specSpanKhz)}
        xMaxKhz={params.carrierFreqKhz + specSpanKhz}
        theoreticalLabel={`Theory B_AM = 2fm = ${amMetrics.theoreticalBandwidthKhz.toFixed(1)} kHz`}
        measuredBwKhz={amMetrics.measuredBandwidthKhz}
      />
    </div>
  );
};

export const FmSimulatorView: React.FC<ViewProps> = ({ params, result, timeWindow }) => {
  const { fmMetrics } = result;
  const beta = params.fmDeviationKhz / params.messageBandwidthKhz;
  const specSpanKhz = Math.max(40, params.fmDeviationKhz + params.messageBandwidthKhz * 3 + 15);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-amber-700">
            FM Simulator: Phase-Integral Modulation &amp; Quadrature Discriminator
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Instantaneous phase model:{' '}
            <span className="font-mono text-slate-900">
              s_FM(t) = Ac·cos(2πfct + 2πkf∫m(τ)dτ)
            </span>
            . Demodulated via IF bandpass filter, Hilbert analytic signal, amplitude limiter, and
            phase-difference differentiation.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono space-y-0.5">
          <div>
            Δf = <strong className="text-amber-700">{params.fmDeviationKhz} kHz</strong> · β ={' '}
            <strong>{beta.toFixed(2)}</strong> · Carson ={' '}
            <strong>{fmMetrics.theoreticalBandwidthKhz} kHz</strong>
          </div>
          <div>
            IF CNR: <strong>{fmMetrics.ifCnrDb.toFixed(2)} dB</strong> · Output SNR:{' '}
            <strong>
              {fmMetrics.demodulationValid && fmMetrics.outputSnrDb !== null
                ? `${fmMetrics.outputSnrDb.toFixed(2)} dB`
                : 'Failed'}
            </strong>
          </div>
        </div>
      </div>

      {/* 4 Required FM Waveforms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaveformChart
          title="1. Original Message Signal m(t)"
          subtitle="Shared baseband input controlling instantaneous frequency"
          timeMs={result.timeMs}
          series={[{ label: 'm(t)', data: result.message, color: '#334155', borderWidth: 1.6 }]}
          yLabel="Amplitude (V)"
          yMin={-1.2}
          yMax={1.2}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="2. FM Transmitted Waveform s_FM(t)"
          subtitle={`Constant envelope Ac = ${params.carrierAmp.toFixed(2)} V · Zoom to 0.1 ms to view frequency compression/expansion`}
          timeMs={result.timeMs}
          series={[
            { label: 's_FM(t)', data: result.fmTransmitted, color: '#d97706', borderWidth: 1.3 },
          ]}
          yLabel="Voltage (V)"
          yMin={-params.carrierAmp * 1.25}
          yMax={params.carrierAmp * 1.25}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="3. FM Received Waveform r_FM(t) (With AWGN)"
          subtitle={`Input SNR = ${fmMetrics.inputSnrDb.toFixed(2)} dB · IF CNR = ${fmMetrics.ifCnrDb.toFixed(2)} dB`}
          timeMs={result.timeMs}
          series={[
            { label: 'r_FM(t)', data: result.fmReceived, color: '#b45309', borderWidth: 1.2 },
          ]}
          yLabel="Voltage (V)"
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title="4. FM Recovered Message (Quadrature Discriminator)"
          subtitle={`Audio LPF = ${params.fmAudioCutoffKhz.toFixed(1)} kHz · Hard-limited phase differentiation`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'FM Recovered', data: result.fmRecovered, color: '#d97706', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.6}
          yMax={1.6}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />
      </div>

      {/* Instantaneous Frequency & FM Spectrum */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaveformChart
          title="Instantaneous Carrier Frequency fi(t) = fc + Δf·m(t)"
          subtitle={`Swings between ${(params.carrierFreqKhz - params.fmDeviationKhz).toFixed(1)} kHz and ${(params.carrierFreqKhz + params.fmDeviationKhz).toFixed(1)} kHz`}
          timeMs={result.timeMs}
          series={[
            {
              label: 'Theoretical fi(t)',
              data: result.fmInstantaneousFreqKhz,
              color: '#0f172a',
              dashed: true,
              borderWidth: 1.5,
            },
            {
              label: 'Discriminator fi(t)',
              data: result.fmDemodInstantaneousFreqKhz,
              color: '#d97706',
              borderWidth: 1.3,
            },
          ]}
          yLabel="Frequency (kHz)"
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
          heightClass="h-60"
        />

        <SpectrumChart
          title="FM Transmitted Frequency Spectrum |S_FM(f)|"
          subtitle={`Bessel sidebands spaced by message components around fc = ${params.carrierFreqKhz} kHz`}
          freqsKhz={result.spectrum.freqsKhz}
          magDb={result.spectrum.fmDb}
          color="#d97706"
          fillColor="rgba(217, 119, 6, 0.14)"
          xMinKhz={Math.max(0, params.carrierFreqKhz - specSpanKhz)}
          xMaxKhz={Math.min(params.fs / 2000, params.carrierFreqKhz + specSpanKhz)}
          theoreticalLabel={`Carson B_FM ≈ ${fmMetrics.theoreticalBandwidthKhz.toFixed(1)} kHz`}
          measuredBwKhz={fmMetrics.measuredBandwidthKhz}
          heightClass="h-60"
        />
      </div>
    </div>
  );
};

export const NoiseExperimentsView: React.FC<ViewProps> = ({
  params,
  result,
  timeWindow,
  onChangeParams,
}) => {
  const { amMetrics, fmMetrics } = result;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Controlled AWGN Channel Experiments
        </h2>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl">
          Apply identical additive white Gaussian noise and signal attenuation to both AM and FM
          branches simultaneously. Select any reproducible preset below or tune noise and attenuation
          manually.
        </p>
      </div>

      {/* 3 Preset Experiment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {NOISE_PRESETS.map((preset) => {
          const isActive =
            Math.abs(params.noiseLevelDb - preset.noiseLevelDb) < 0.05 &&
            Math.abs(params.channelAttenuation - preset.channelAttenuation) < 0.005;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChangeParams({
                  ...params,
                  noiseLevelDb: preset.noiseLevelDb,
                  channelAttenuation: preset.channelAttenuation,
                })
              }
              className={`text-left rounded-lg border p-4 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{preset.label}</span>
                <Radio className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
              </div>
              <div className={`text-xs mt-1 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                {preset.subtitle}
              </div>
              <div
                className={`mt-3 pt-2 border-t text-[11px] font-mono ${
                  isActive ? 'border-slate-700 text-slate-200' : 'border-slate-100 text-slate-700'
                }`}
              >
                Noise = {preset.noiseLevelDb} dB · α = {preset.channelAttenuation.toFixed(2)} (
                {(20 * Math.log10(preset.channelAttenuation)).toFixed(1)} dB)
              </div>
              <p className={`text-xs mt-2 leading-relaxed ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Side-by-side Received & Recovered Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WaveformChart
          title={`AM Received Signal · Input SNR = ${amMetrics.inputSnrDb.toFixed(2)} dB`}
          subtitle="Amplitude fluctuations directly corrupt the AM envelope"
          timeMs={result.timeMs}
          series={[{ label: 'AM Received', data: result.amReceived, color: '#2563eb', borderWidth: 1.2 }]}
          yLabel="Voltage (V)"
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title={`FM Received Signal · Input SNR = ${fmMetrics.inputSnrDb.toFixed(2)} dB`}
          subtitle={`IF CNR = ${fmMetrics.ifCnrDb.toFixed(2)} dB inside Carson bandwidth`}
          timeMs={result.timeMs}
          series={[{ label: 'FM Received', data: result.fmReceived, color: '#d97706', borderWidth: 1.2 }]}
          yLabel="Voltage (V)"
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title={`AM Recovered Message · Output SNR = ${
            amMetrics.demodulationValid && amMetrics.outputSnrDb !== null
              ? `${amMetrics.outputSnrDb.toFixed(2)} dB`
              : 'Failed'
          }`}
          subtitle={`RMSE = ${amMetrics.rmse?.toFixed(4) ?? 'N/A'}`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'AM Recovered', data: result.amRecovered, color: '#2563eb', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.8}
          yMax={1.8}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />

        <WaveformChart
          title={`FM Recovered Message · Output SNR = ${
            fmMetrics.demodulationValid && fmMetrics.outputSnrDb !== null
              ? `${fmMetrics.outputSnrDb.toFixed(2)} dB`
              : 'Failed'
          }`}
          subtitle={`RMSE = ${fmMetrics.rmse?.toFixed(4) ?? 'N/A'}`}
          timeMs={result.timeMs}
          series={[
            { label: 'Original m(t)', data: result.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
            { label: 'FM Recovered', data: result.fmRecovered, color: '#d97706', borderWidth: 1.7 },
          ]}
          yLabel="Amplitude (norm)"
          yMin={-1.8}
          yMax={1.8}
          windowStartMs={timeWindow.startMs}
          windowDurationMs={timeWindow.durationMs}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed">
        <span className="font-semibold text-slate-900">Engineering Interpretation:</span> FM is
        more resistant to moderate amplitude noise because a hard amplitude limiter strips envelope
        fluctuations before frequency discrimination, and wider deviation Δf spreads signal power
        across a larger modulation index β. However, FM is <strong>not</strong> completely immune to
        noise: when the carrier-to-noise ratio drops too low (Experiment 3), noise vectors exceed
        the carrier and trigger severe phase-wrap clicks (the FM threshold effect).
      </div>
    </div>
  );
};
