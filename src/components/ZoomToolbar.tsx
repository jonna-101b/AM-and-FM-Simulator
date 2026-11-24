import React from 'react';
import { ZoomIn } from 'lucide-react';

export interface TimeWindowState {
  durationMs: number;
  startMs: number;
}

interface ZoomToolbarProps {
  totalDurationMs: number;
  windowState: TimeWindowState;
  onChange: (next: TimeWindowState) => void;
  carrierFreqKhz: number;
}

const ZOOM_DURATIONS = [
  { label: 'Full (8.0 ms)', durationMs: 8.0 },
  { label: '2.0 ms', durationMs: 2.0 },
  { label: '0.5 ms', durationMs: 0.5 },
  { label: 'Carrier Cycle (0.1 ms)', durationMs: 0.1 },
];

export const ZoomToolbar: React.FC<ZoomToolbarProps> = ({
  totalDurationMs,
  windowState,
  onChange,
  carrierFreqKhz,
}) => {
  const maxStart = Math.max(0, totalDurationMs - windowState.durationMs);

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 mr-1">
          <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
          Time Window:
        </span>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
          {ZOOM_DURATIONS.map((z) => {
            const active = Math.abs(windowState.durationMs - z.durationMs) < 0.01;
            return (
              <button
                key={z.durationMs}
                type="button"
                onClick={() =>
                  onChange({
                    durationMs: Math.min(totalDurationMs, z.durationMs),
                    startMs: Math.min(windowState.startMs, Math.max(0, totalDurationMs - z.durationMs)),
                  })
                }
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {z.label}
              </button>
            );
          })}
        </div>
      </div>

      {maxStart > 0.01 ? (
        <div className="flex items-center gap-3 min-w-[220px] flex-1 max-w-xs">
          <span className="text-xs font-medium text-slate-600 whitespace-nowrap">Pan Offset:</span>
          <input
            type="range"
            min={0}
            max={maxStart}
            step={Math.max(0.01, windowState.durationMs / 20)}
            value={windowState.startMs}
            onChange={(e) =>
              onChange({ ...windowState, startMs: parseFloat(e.target.value) })
            }
            className="lab-slider"
            aria-label="Waveform pan offset in milliseconds"
          />
          <span className="text-xs font-mono text-slate-600 tabular-nums whitespace-nowrap">
            {windowState.startMs.toFixed(2)} ms
          </span>
        </div>
      ) : (
        <span className="text-xs font-mono text-slate-500">
          Carrier Period Tc = {(1000 / carrierFreqKhz).toFixed(1)} µs · Zoom to 0.1 ms to inspect individual cycles
        </span>
      )}
    </div>
  );
};
