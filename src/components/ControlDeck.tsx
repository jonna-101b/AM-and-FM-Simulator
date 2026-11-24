import React from 'react';
import { HelpCircle, RotateCcw, Shuffle } from 'lucide-react';
import {
  DEFAULT_PARAMS,
  MessageBandwidthKhz,
  MessageSignalType,
  NOISE_PRESETS,
  SimulationParams,
} from '../dsp/types';

interface TooltipLabelProps {
  label: string;
  tip: string;
  valueText: string;
  unit?: string;
}

const ParamHeader: React.FC<TooltipLabelProps> = ({ label, tip, valueText, unit }) => (
  <div className="flex items-center justify-between gap-2 mb-1.5">
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-xs font-medium text-slate-700 truncate">{label}</span>
      <span className="group relative inline-flex items-center">
        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help shrink-0" />
        <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-0 bottom-full mb-1.5 z-30 w-56 rounded-md bg-slate-900 px-2.5 py-2 text-[11px] leading-relaxed text-slate-100 shadow-lg">
          {tip}
        </span>
      </span>
    </div>
    <span className="text-xs font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap shrink-0">
      {valueText}
      {unit ? <span className="text-slate-500 font-normal ml-1">{unit}</span> : null}
    </span>
  </div>
);

interface ControlDeckProps {
  params: SimulationParams;
  onChange: (next: SimulationParams) => void;
  focusGroup?: 'all' | 'signal' | 'am' | 'fm' | 'channel';
}

export const ControlDeck: React.FC<ControlDeckProps> = ({
  params,
  onChange,
  focusGroup = 'all',
}) => {
  const update = (patch: Partial<SimulationParams>) => {
    onChange({ ...params, ...patch });
  };

  const activePreset = NOISE_PRESETS.find(
    (p) =>
      Math.abs(p.noiseLevelDb - params.noiseLevelDb) < 0.05 &&
      Math.abs(p.channelAttenuation - params.channelAttenuation) < 0.005
  );

  const beta = params.fmDeviationKhz / params.messageBandwidthKhz;
  const carsonBw = 2 * (params.fmDeviationKhz + params.messageBandwidthKhz);

  const showSignal = focusGroup === 'all' || focusGroup === 'signal';
  const showAm = focusGroup === 'all' || focusGroup === 'am';
  const showFm = focusGroup === 'all' || focusGroup === 'fm';
  const showChannel = focusGroup === 'all' || focusGroup === 'channel';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Simulator Parameters</h3>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_PARAMS)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Reset All
        </button>
      </div>

      {/* 1. Baseband Message & Carrier */}
      {showSignal && (
        <section className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Message &amp; Carrier
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              fs = {(params.fs / 1_000_000).toFixed(3)} MHz
            </span>
          </div>

          <div>
            <ParamHeader
              label="Message Bandwidth (fm)"
              tip="Highest audio frequency component in the normalized message m(t). Sets AM bandwidth (2fm) and contributes to Carson's FM bandwidth."
              valueText={`${params.messageBandwidthKhz}`}
              unit="kHz"
            />
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
              {([3, 4, 5] as MessageBandwidthKhz[]).map((bw) => (
                <button
                  key={bw}
                  type="button"
                  onClick={() =>
                    update({
                      messageBandwidthKhz: bw,
                      singleToneFreqKhz: Math.min(params.singleToneFreqKhz, bw),
                    })
                  }
                  className={`py-1.5 text-xs font-mono font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    params.messageBandwidthKhz === bw
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {bw} kHz
                </button>
              ))}
            </div>
          </div>

          <div>
            <ParamHeader
              label="Test Signal Waveform"
              tip="Identical normalized message signal m(t) fed simultaneously to both AM and FM modulators."
              valueText={
                params.messageType === 'multi-tone'
                  ? 'Multi-Tone'
                  : params.messageType === 'single-tone'
                  ? 'Single Tone'
                  : 'Chirp Sweep'
              }
            />
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-md">
              {(
                [
                  { id: 'multi-tone', label: 'Multi-Tone' },
                  { id: 'single-tone', label: 'Single Tone' },
                  { id: 'sweep', label: 'Sweep' },
                ] as { id: MessageSignalType; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ messageType: opt.id })}
                  className={`py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    params.messageType === opt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {params.messageType === 'single-tone' && (
            <div>
              <ParamHeader
                label="Tone Frequency"
                tip="Single sinusoid frequency (up to selected message bandwidth fm)."
                valueText={params.singleToneFreqKhz.toFixed(1)}
                unit="kHz"
              />
              <input
                type="range"
                min={0.5}
                max={params.messageBandwidthKhz}
                step={0.5}
                value={params.singleToneFreqKhz}
                onChange={(e) => update({ singleToneFreqKhz: parseFloat(e.target.value) })}
                className="lab-slider"
                aria-label="Single tone frequency in kHz"
              />
            </div>
          )}

          <div>
            <ParamHeader
              label="Carrier Frequency (fc)"
              tip="Shared RF carrier center frequency for both AM and FM transmitters."
              valueText={params.carrierFreqKhz.toFixed(0)}
              unit="kHz"
            />
            <input
              type="range"
              min={60}
              max={180}
              step={5}
              value={params.carrierFreqKhz}
              onChange={(e) => update({ carrierFreqKhz: parseFloat(e.target.value) })}
              className="lab-slider"
              aria-label="Carrier frequency in kHz"
            />
          </div>

          <div>
            <ParamHeader
              label="Carrier Amplitude (Ac)"
              tip="Unmodulated peak carrier voltage shared by both AM and FM waveforms."
              valueText={params.carrierAmp.toFixed(2)}
              unit="V"
            />
            <input
              type="range"
              min={0.4}
              max={2.0}
              step={0.1}
              value={params.carrierAmp}
              onChange={(e) => update({ carrierAmp: parseFloat(e.target.value) })}
              className="lab-slider"
              aria-label="Carrier amplitude in Volts"
            />
          </div>
        </section>
      )}

      {/* 2. AM Branch Controls */}
      {showAm && (
        <section className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              AM Modulation &amp; Envelope Rx
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              B_AM = {2 * params.messageBandwidthKhz} kHz
            </span>
          </div>

          <div>
            <ParamHeader
              label="Modulation Index (μ)"
              tip="Ratio of peak envelope variation to carrier amplitude. μ ≤ 1 preserves the envelope; μ > 1 causes phase inversion and overmodulation distortion."
              valueText={params.amModIndex.toFixed(2)}
            />
            <input
              type="range"
              min={0.0}
              max={1.2}
              step={0.02}
              value={params.amModIndex}
              onChange={(e) => update({ amModIndex: parseFloat(e.target.value) })}
              className="lab-slider lab-slider-am"
              aria-label="AM modulation index"
            />
            <div className="flex justify-between text-[11px] font-mono mt-1">
              <span className="text-slate-500">0.00</span>
              <span
                className={
                  params.amModIndex > 1.0
                    ? 'text-rose-700 font-semibold'
                    : params.amModIndex === 1.0
                    ? 'text-amber-700 font-semibold'
                    : 'text-blue-700'
                }
              >
                {params.amModIndex > 1.0
                  ? '▲ Overmodulated (μ > 1)'
                  : params.amModIndex === 1.0
                  ? '100% Modulation'
                  : 'Linear Envelope (μ < 1)'}
              </span>
              <span className="text-slate-500">1.20</span>
            </div>
          </div>

          <div>
            <ParamHeader
              label="Envelope RC Cutoff (1/2πRC)"
              tip="Low-pass RC filter cutoff after rectification. Must satisfy fm ≪ f_RC ≪ fc to avoid diagonal clipping (too low) or carrier ripple (too high)."
              valueText={params.amRcCutoffKhz.toFixed(1)}
              unit="kHz"
            />
            <input
              type="range"
              min={2.0}
              max={35.0}
              step={0.5}
              value={params.amRcCutoffKhz}
              onChange={(e) => update({ amRcCutoffKhz: parseFloat(e.target.value) })}
              className="lab-slider lab-slider-am"
              aria-label="AM envelope detector RC cutoff frequency in kHz"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="block text-[11px] font-medium text-slate-600 mb-1">Rectifier</span>
              <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded">
                <button
                  type="button"
                  onClick={() => update({ amRectifierMode: 'full-wave' })}
                  className={`py-1 text-[11px] font-medium rounded cursor-pointer whitespace-nowrap ${
                    params.amRectifierMode === 'full-wave'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => update({ amRectifierMode: 'half-wave' })}
                  className={`py-1 text-[11px] font-medium rounded cursor-pointer whitespace-nowrap ${
                    params.amRectifierMode === 'half-wave'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Half
                </button>
              </div>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-slate-600 mb-1">IF Pre-Filter</span>
              <button
                type="button"
                onClick={() => update({ amIfFilterEnabled: !params.amIfFilterEnabled })}
                className={`w-full py-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                  params.amIfFilterEnabled
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {params.amIfFilterEnabled ? 'IF Bandpass: On' : 'IF Bandpass: Off'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. FM Branch Controls */}
      {showFm && (
        <section className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              FM Modulation &amp; Discriminator
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              β = {beta.toFixed(2)}
            </span>
          </div>

          <div>
            <ParamHeader
              label="Peak Frequency Deviation (Δf)"
              tip="Maximum carrier frequency shift Δf = kf·max|m(t)|. Larger Δf improves above-threshold Output SNR at the expense of Carson bandwidth 2(Δf + fm)."
              valueText={params.fmDeviationKhz.toFixed(0)}
              unit="kHz"
            />
            <input
              type="range"
              min={2}
              max={75}
              step={1}
              value={params.fmDeviationKhz}
              onChange={(e) => update({ fmDeviationKhz: parseFloat(e.target.value) })}
              className="lab-slider lab-slider-fm"
              aria-label="FM peak frequency deviation in kHz"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1">
              <span>2 kHz</span>
              <span className="text-amber-700 font-medium">
                Carson BW ≈ {carsonBw.toFixed(0)} kHz
              </span>
              <span>75 kHz</span>
            </div>
          </div>

          <div>
            <ParamHeader
              label="Audio Post-Filter Cutoff"
              tip="Low-pass filter after quadrature phase differentiation that suppresses out-of-band FM parabolic noise above fm."
              valueText={params.fmAudioCutoffKhz.toFixed(1)}
              unit="kHz"
            />
            <input
              type="range"
              min={3.0}
              max={15.0}
              step={0.5}
              value={params.fmAudioCutoffKhz}
              onChange={(e) => update({ fmAudioCutoffKhz: parseFloat(e.target.value) })}
              className="lab-slider lab-slider-fm"
              aria-label="FM audio post-filter cutoff in kHz"
            />
          </div>
        </section>
      )}

      {/* 4. Shared Channel & Noise Experiments */}
      {showChannel && (
        <section className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Shared AWGN Channel
            </h4>
            <button
              type="button"
              onClick={() => update({ noiseSeed: Math.floor(Math.random() * 90000) + 1000 })}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900 cursor-pointer"
              title="Generate a fresh reproducible AWGN seed"
            >
              <Shuffle className="w-3 h-3" />
              Seed #{params.noiseSeed}
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-slate-600">
              Reproducible Experiment Presets
            </span>
            <div className="grid grid-cols-1 gap-1.5">
              {NOISE_PRESETS.map((preset) => {
                const isSelected = activePreset?.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      update({
                        noiseLevelDb: preset.noiseLevelDb,
                        channelAttenuation: preset.channelAttenuation,
                      })
                    }
                    className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-medium truncate">{preset.label}</div>
                    <div
                      className={`text-[11px] font-mono mt-0.5 ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Noise: {preset.noiseLevelDb} dB · α = {preset.channelAttenuation.toFixed(2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <ParamHeader
              label="AWGN Noise Level"
              tip="Wideband Gaussian noise power 10·log10(σ²) applied identically to both AM and FM receiver inputs."
              valueText={params.noiseLevelDb.toFixed(1)}
              unit="dB"
            />
            <input
              type="range"
              min={-45}
              max={5}
              step={0.5}
              value={params.noiseLevelDb}
              onChange={(e) => update({ noiseLevelDb: parseFloat(e.target.value) })}
              className="lab-slider"
              aria-label="Channel AWGN noise level in dB"
            />
          </div>

          <div>
            <ParamHeader
              label="Rx Signal Amplitude (α)"
              tip="Channel path gain (1.00 = 0 dB path loss; 0.25 = -12 dB attenuation). Reduces received carrier strength prior to noise addition."
              valueText={`${params.channelAttenuation.toFixed(2)} (${(
                20 * Math.log10(params.channelAttenuation)
              ).toFixed(1)} dB)`}
            />
            <input
              type="range"
              min={0.05}
              max={1.0}
              step={0.01}
              value={params.channelAttenuation}
              onChange={(e) => update({ channelAttenuation: parseFloat(e.target.value) })}
              className="lab-slider"
              aria-label="Received signal amplitude factor"
            />
          </div>
        </section>
      )}
    </div>
  );
};
