import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { runFmThresholdSweep } from '../dsp/simulator';
import { SimulationParams, SimulationResult } from '../dsp/types';
import { ThresholdCurveChart, WaveformChart } from './Charts';

interface ThresholdSectionProps {
  params: SimulationParams;
  simResult: SimulationResult;
  onChangeParams: (next: SimulationParams) => void;
}

export const ThresholdSection: React.FC<ThresholdSectionProps> = ({
  params,
  simResult,
  onChangeParams,
}) => {
  const [useIfCnrAxis, setUseIfCnrAxis] = useState<boolean>(true);

  // Empirical sweep computed from the real DSP modulator/demodulator across noise levels
  const sweep = useMemo(() => runFmThresholdSweep(params), [
    params.messageBandwidthKhz,
    params.messageType,
    params.singleToneFreqKhz,
    params.carrierAmp,
    params.carrierFreqKhz,
    params.channelAttenuation,
    params.amModIndex,
    params.amRcCutoffKhz,
    params.amRectifierMode,
    params.amIfFilterEnabled,
    params.fmDeviationKhz,
    params.fmAudioCutoffKhz,
    params.fmIfMarginFactor,
    params.noiseSeed,
  ]);

  const currentX = useIfCnrAxis
    ? simResult.fmMetrics.ifCnrDb
    : simResult.fmMetrics.inputSnrDb;

  const isInThreshold =
    sweep.estimatedThresholdIfCnrDb !== null &&
    simResult.fmMetrics.ifCnrDb <= sweep.estimatedThresholdIfCnrDb + 1.5;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">FM Threshold Investigation</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Gradually reduce the received carrier-to-noise ratio to observe the FM threshold knee,
            where phase-wrap encirclements generate impulse clicks and output SNR drops faster than
            input SNR.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          <button
            type="button"
            onClick={() => setUseIfCnrAxis(true)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              useIfCnrAxis ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Plot vs IF CNR (dB)
          </button>
          <button
            type="button"
            onClick={() => setUseIfCnrAxis(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              !useIfCnrAxis ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Plot vs Wideband Input SNR (dB)
          </button>
        </div>
      </div>

      {/* Interactive CNR / Attenuation Scrubber */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="thresh-noise-slider" className="text-xs font-medium text-slate-700">
              Channel AWGN Noise Level
            </label>
            <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
              {params.noiseLevelDb.toFixed(1)} dB
            </span>
          </div>
          <input
            id="thresh-noise-slider"
            type="range"
            min={-30}
            max={6}
            step={0.5}
            value={params.noiseLevelDb}
            onChange={(e) =>
              onChangeParams({ ...params, noiseLevelDb: parseFloat(e.target.value) })
            }
            className="lab-slider lab-slider-fm"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
            <span>-30 dB (Strong CNR)</span>
            <span>+6 dB (Deep Threshold)</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="thresh-atten-slider" className="text-xs font-medium text-slate-700">
              Received Signal Amplitude (α)
            </label>
            <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums">
              {params.channelAttenuation.toFixed(2)} ({(20 * Math.log10(params.channelAttenuation)).toFixed(1)} dB)
            </span>
          </div>
          <input
            id="thresh-atten-slider"
            type="range"
            min={0.1}
            max={1.0}
            step={0.02}
            value={params.channelAttenuation}
            onChange={(e) =>
              onChangeParams({ ...params, channelAttenuation: parseFloat(e.target.value) })
            }
            className="lab-slider"
          />
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
            <span>0.10 (-20 dB weak)</span>
            <span>1.00 (0 dB strong)</span>
          </div>
        </div>
      </div>

      {/* Live Threshold Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Received Signal Condition</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1 tabular-nums">
            {simResult.fmMetrics.ifCnrDb.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">dB IF CNR</span>
          </div>
          <div className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
            Input SNR: {simResult.fmMetrics.inputSnrDb.toFixed(1)} dB
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">FM Output SNR</div>
          <div className="text-lg font-mono font-semibold text-amber-700 mt-1 tabular-nums">
            {simResult.fmMetrics.outputSnrDb !== null
              ? `${simResult.fmMetrics.outputSnrDb.toFixed(1)} dB`
              : 'Failed'}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
            RMSE: {simResult.fmMetrics.rmse !== null ? simResult.fmMetrics.rmse.toFixed(4) : 'N/A'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Detected FM Distortion / Clicks</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1 tabular-nums">
            {simResult.fmMetrics.correlation.toFixed(3)}{' '}
            <span className="text-xs font-normal text-slate-500">corr</span>
          </div>
          <div className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
            SDR (noiseless): {simResult.fmMetrics.sdrDb?.toFixed(1) ?? 'N/A'} dB
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">Empirical Threshold Knee</div>
          <div className="text-lg font-mono font-semibold text-slate-900 mt-1 tabular-nums">
            {sweep.estimatedThresholdIfCnrDb !== null
              ? `${sweep.estimatedThresholdIfCnrDb.toFixed(1)} dB`
              : 'Above Sweep'}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
            β = {sweep.modulationIndexBeta.toFixed(2)} · B_FM = {sweep.carsonBandwidthKhz} kHz
          </div>
        </div>
      </div>

      {isInThreshold && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold">Operating inside or below the FM threshold region:</span>{' '}
            At IF CNR = {simResult.fmMetrics.ifCnrDb.toFixed(1)} dB, additive noise vectors frequently
            exceed the carrier phasor amplitude, causing 2π phase jumps in the quadrature
            discriminator. Notice how FM Output SNR drops steeply and can fall below AM under
            extreme weak-signal conditions.
          </div>
        </div>
      )}

      {/* Main Output SNR vs Input SNR / CNR Curve */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Simulated Output SNR vs {useIfCnrAxis ? 'FM IF Carrier-to-Noise Ratio' : 'Input SNR'}
          </h3>
          <span className="text-xs text-slate-500">
            Empirical curve generated across 19 AWGN steps with current Δf = {params.fmDeviationKhz} kHz and fm ={' '}
            {params.messageBandwidthKhz} kHz
          </span>
        </div>
        <ThresholdCurveChart
          points={sweep.points}
          useIfCnrAxis={useIfCnrAxis}
          currentPoint={{
            x: currentX,
            fmY: simResult.fmMetrics.outputSnrDb ?? -18,
            amY: simResult.amMetrics.outputSnrDb ?? -18,
          }}
        />
      </div>

      {/* Live FM Recovered Waveform under current threshold setting */}
      <WaveformChart
        title="Live FM Recovered Waveform vs Original Message"
        subtitle="Watch impulse click distortion appear on the recovered audio as IF CNR drops into the threshold knee"
        timeMs={simResult.timeMs}
        series={[
          { label: 'Original m(t)', data: simResult.message, color: '#64748b', dashed: true, borderWidth: 1.4 },
          { label: 'FM Recovered', data: simResult.fmRecovered, color: '#d97706', borderWidth: 1.7 },
        ]}
        yLabel="Normalized Amplitude"
        yMin={-1.8}
        yMax={1.8}
        windowStartMs={0}
        windowDurationMs={8.0}
      />

      <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 leading-relaxed space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">
          Why the FM Threshold Depends on Parameters &amp; Implementation
        </h4>
        <p>
          Unlike a linear envelope detector, an FM frequency discriminator relies on tracking the
          instantaneous phase angle of the received analytic signal. When the IF carrier-to-noise
          ratio falls near or below approximately 8–13 dB (determined empirically here at{' '}
          <span className="font-mono text-slate-900">
            {sweep.estimatedThresholdIfCnrDb !== null
              ? `${sweep.estimatedThresholdIfCnrDb.toFixed(1)} dB IF CNR`
              : 'low CNR'}
          </span>
          ), noise causes the resultant phasor to encircle the origin, creating sharp 2π phase-step
          clicks that broaden into audible pops after audio filtering.
        </p>
        <p>
          Increasing Δf raises above-threshold Output SNR through wider modulation index (β = Δf/fm),
          but also widens Carson&apos;s IF filter bandwidth{' '}
          <span className="font-mono text-slate-900">2(Δf + fm)</span>, admitting more IF noise
          power and shifting the threshold Input SNR requirement. Thus, FM is not immune to noise;
          its noise-suppression advantage holds only above threshold.
        </p>
      </div>
    </div>
  );
};
