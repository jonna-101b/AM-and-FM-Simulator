import React from 'react';
import { X } from 'lucide-react';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h2 id="guide-modal-title" className="text-lg font-semibold text-slate-900">
              How to Use This Simulator
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Step-by-step demonstration workflow for communications engineering labs
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-3 text-sm text-slate-700 list-decimal pl-5 leading-relaxed">
          <li>
            <strong>Configure the Shared Message Signal:</strong> Open <em>Signal Generator</em> or
            use the left parameter panel to choose a 3, 4, or 5 kHz bandwidth and select Multi-Tone,
            Single Tone, or Frequency Sweep. Both AM and FM use this exact normalized waveform.
          </li>
          <li>
            <strong>Inspect AM Modulation &amp; Overmodulation:</strong> In <em>AM Simulator</em>,
            set the modulation index μ between 0.5 and 0.9 for clean envelope detection. Increase μ
            above 1.0 (up to 1.2) to observe carrier phase reversal and envelope folding distortion,
            or adjust the RC cutoff to see ripple vs diagonal clipping.
          </li>
          <li>
            <strong>Explore FM Deviation &amp; Carson&apos;s Bandwidth:</strong> In{' '}
            <em>FM Simulator</em>, sweep frequency deviation Δf from 5 kHz to 75 kHz. Zoom the time
            window to 0.1 ms to inspect carrier frequency compression and expansion, and compare
            instantaneous frequency with the spectrum.
          </li>
          <li>
            <strong>Run Controlled Noise Experiments:</strong> Open <em>Noise Experiments</em> and
            click <strong>Experiment 1 (Clean)</strong>, <strong>Experiment 2 (Moderate)</strong>,
            and <strong>Experiment 3 (Weak-Signal)</strong> to apply identical AWGN to both systems.
          </li>
          <li>
            <strong>Verify the FM Threshold &amp; Hand Calculations:</strong> Use{' '}
            <em>FM Threshold</em> to locate the IF carrier-to-noise knee where phase-wrap clicks
            degrade FM rapidly, then check <em>Engineering Validation</em> to compare live spectra
            against hand-calculated AM sidebands and Carson&apos;s rule.
          </li>
        </ol>

        <div className="pt-2 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
          >
            Return to Simulator
          </button>
        </div>
      </div>
    </div>
  );
};
