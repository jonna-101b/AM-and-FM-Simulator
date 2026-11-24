import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export interface WaveformSeries {
  label: string;
  data: Float64Array;
  color: string;
  dashed?: boolean;
  borderWidth?: number;
}

interface DecimatedPoint {
  x: number;
  y: number;
}

/**
 * Min-max envelope decimation when plotting dense RF carrier signals over wide time windows.
 * Preserves true signal peaks without aliasing; passes raw points directly when window <= maxPoints.
 */
function decimateTimeSeries(
  timeMs: Float64Array,
  values: Float64Array,
  startIdx: number,
  endIdx: number,
  maxPoints = 900
): DecimatedPoint[] {
  const count = Math.max(0, endIdx - startIdx);
  if (count <= maxPoints) {
    const pts: DecimatedPoint[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const idx = startIdx + i;
      pts[i] = { x: timeMs[idx], y: values[idx] };
    }
    return pts;
  }

  const buckets = Math.floor(maxPoints / 2);
  const bucketSize = count / buckets;
  const pts: DecimatedPoint[] = [];

  for (let b = 0; b < buckets; b++) {
    const bStart = startIdx + Math.floor(b * bucketSize);
    const bEnd = Math.min(endIdx, startIdx + Math.floor((b + 1) * bucketSize));
    if (bStart >= bEnd) continue;

    let minVal = Infinity;
    let maxVal = -Infinity;
    let minIdx = bStart;
    let maxIdx = bStart;

    for (let i = bStart; i < bEnd; i++) {
      const v = values[i];
      if (v < minVal) {
        minVal = v;
        minIdx = i;
      }
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }

    if (minIdx <= maxIdx) {
      pts.push({ x: timeMs[minIdx], y: minVal });
      if (maxIdx !== minIdx) pts.push({ x: timeMs[maxIdx], y: maxVal });
    } else {
      pts.push({ x: timeMs[maxIdx], y: maxVal });
      pts.push({ x: timeMs[minIdx], y: minVal });
    }
  }

  return pts;
}

interface WaveformChartProps {
  title: string;
  subtitle?: string;
  timeMs: Float64Array;
  series: WaveformSeries[];
  yLabel: string;
  yMin?: number;
  yMax?: number;
  windowStartMs?: number;
  windowDurationMs?: number;
  heightClass?: string;
}

export const WaveformChart: React.FC<WaveformChartProps> = ({
  title,
  subtitle,
  timeMs,
  series,
  yLabel,
  yMin,
  yMax,
  windowStartMs = 0,
  windowDurationMs,
  heightClass = 'h-56',
}) => {
  const totalDurationMs = timeMs.length > 1 ? timeMs[timeMs.length - 1] : 8;
  const effectiveDuration = windowDurationMs ?? totalDurationMs;
  const startMs = Math.max(0, Math.min(totalDurationMs - effectiveDuration, windowStartMs));
  const endMs = Math.min(totalDurationMs, startMs + effectiveDuration);

  const { startIdx, endIdx } = useMemo(() => {
    const n = timeMs.length;
    if (n === 0) return { startIdx: 0, endIdx: 0 };
    const dtMs = totalDurationMs / (n - 1);
    const s = Math.max(0, Math.floor(startMs / dtMs));
    const e = Math.min(n, Math.ceil(endMs / dtMs) + 1);
    return { startIdx: s, endIdx: e };
  }, [timeMs, totalDurationMs, startMs, endMs]);

  const chartData: ChartData<'line', DecimatedPoint[]> = useMemo(() => {
    return {
      datasets: series.map((s) => ({
        label: s.label,
        data: decimateTimeSeries(timeMs, s.data, startIdx, endIdx, 900),
        borderColor: s.color,
        backgroundColor: s.color,
        borderWidth: s.borderWidth ?? 1.6,
        borderDash: s.dashed ? [5, 4] : undefined,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0,
        parsing: false as const,
      })),
    };
  }, [series, timeMs, startIdx, endIdx]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      plugins: {
        legend: {
          display: series.length > 1,
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 14,
            boxHeight: 2,
            usePointStyle: false,
            color: '#475569',
            font: {
              family: "'DM Sans', sans-serif",
              size: 11,
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          callbacks: {
            title: (items) => {
              if (!items.length) return '';
              const xVal = items[0].parsed.x ?? 0;
              return effectiveDuration <= 0.5
                ? `t = ${(xVal * 1000).toFixed(1)} µs`
                : `t = ${xVal.toFixed(3)} ms`;
            },
            label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(3)}`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: startMs,
          max: endMs,
          title: {
            display: true,
            text: effectiveDuration <= 0.5 ? 'Time (ms · zoomed µs scale)' : 'Time (ms)',
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 7,
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
            callback: (val) => Number(val).toFixed(effectiveDuration <= 0.5 ? 2 : 1),
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.85)',
          },
        },
        y: {
          min: yMin,
          max: yMax,
          title: {
            display: true,
            text: yLabel,
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 6,
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.85)',
          },
        },
      },
    }),
    [series.length, effectiveDuration, startMs, endMs, yMin, yMax, yLabel]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="text-xs font-mono text-slate-500">
          Window: {startMs.toFixed(2)}–{endMs.toFixed(2)} ms
        </span>
      </div>
      <div className={`${heightClass} w-full`}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

interface SpectrumChartProps {
  title: string;
  subtitle?: string;
  freqsKhz: Float64Array;
  magDb: Float64Array;
  color: string;
  fillColor: string;
  xMinKhz?: number;
  xMaxKhz?: number;
  theoreticalLabel?: string;
  measuredBwKhz?: number;
  heightClass?: string;
}

export const SpectrumChart: React.FC<SpectrumChartProps> = ({
  title,
  subtitle,
  freqsKhz,
  magDb,
  color,
  fillColor,
  xMinKhz = 0,
  xMaxKhz,
  theoreticalLabel,
  measuredBwKhz,
  heightClass = 'h-60',
}) => {
  const maxFreq = xMaxKhz ?? (freqsKhz.length > 0 ? freqsKhz[freqsKhz.length - 1] : 200);

  const chartData: ChartData<'line', DecimatedPoint[]> = useMemo(() => {
    const pts: DecimatedPoint[] = [];
    for (let i = 0; i < freqsKhz.length; i++) {
      const f = freqsKhz[i];
      if (f >= xMinKhz && f <= maxFreq) {
        pts.push({ x: f, y: Math.max(-90, magDb[i]) });
      }
    }
    return {
      datasets: [
        {
          label: 'Magnitude (dB)',
          data: pts,
          borderColor: color,
          backgroundColor: fillColor,
          borderWidth: 1.5,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0,
          parsing: false as const,
        },
      ],
    };
  }, [freqsKhz, magDb, xMinKhz, maxFreq, color, fillColor]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          callbacks: {
            title: (items) => `f = ${(items[0]?.parsed.x ?? 0).toFixed(2)} kHz`,
            label: (item) => `Level: ${(item.parsed.y ?? 0).toFixed(1)} dB`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: xMinKhz,
          max: maxFreq,
          title: {
            display: true,
            text: 'Frequency (kHz)',
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          ticks: {
            color: '#64748b',
            maxTicksLimit: 8,
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.85)',
          },
        },
        y: {
          min: -90,
          max: 5,
          title: {
            display: true,
            text: 'Magnitude (dB)',
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          ticks: {
            color: '#64748b',
            stepSize: 20,
            font: { family: "'IBM Plex Mono', monospace", size: 10 },
          },
          grid: {
            color: 'rgba(226, 232, 240, 0.85)',
          },
        },
      },
    }),
    [xMinKhz, maxFreq]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
          {theoreticalLabel && <span>{theoreticalLabel}</span>}
          {measuredBwKhz !== undefined && (
            <>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>99% Power BW: {measuredBwKhz.toFixed(2)} kHz</span>
            </>
          )}
        </div>
      </div>
      <div className={`${heightClass} w-full`}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

interface ThresholdCurveChartProps {
  points: {
    inputSnrDb: number;
    ifCnrDb: number;
    fmOutputSnrDb: number;
    amOutputSnrDb: number;
    clickEventsDetected: number;
  }[];
  useIfCnrAxis: boolean;
  currentPoint?: { x: number; fmY: number | null; amY: number | null };
}

export const ThresholdCurveChart: React.FC<ThresholdCurveChartProps> = ({
  points,
  useIfCnrAxis,
  currentPoint,
}) => {
  const sorted = useMemo(() => {
    return [...points].sort((a, b) =>
      useIfCnrAxis ? a.ifCnrDb - b.ifCnrDb : a.inputSnrDb - b.inputSnrDb
    );
  }, [points, useIfCnrAxis]);

  const chartData: ChartData<'line', DecimatedPoint[]> = useMemo(() => {
    const fmPts = sorted.map((p) => ({
      x: useIfCnrAxis ? p.ifCnrDb : p.inputSnrDb,
      y: p.fmOutputSnrDb,
    }));
    const amPts = sorted.map((p) => ({
      x: useIfCnrAxis ? p.ifCnrDb : p.inputSnrDb,
      y: p.amOutputSnrDb,
    }));

    const datasets: ChartData<'line', DecimatedPoint[]>['datasets'] = [
      {
        label: 'FM Output SNR (dB)',
        data: fmPts,
        borderColor: '#d97706',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        borderWidth: 2.2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.15,
        parsing: false as const,
      },
      {
        label: 'AM Output SNR (dB)',
        data: amPts,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.10)',
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 2.5,
        pointHoverRadius: 4,
        tension: 0.15,
        parsing: false as const,
      },
    ];

    if (currentPoint && currentPoint.fmY !== null) {
      datasets.push({
        label: 'Current Operating Point (FM)',
        data: [{ x: currentPoint.x, y: currentPoint.fmY }],
        borderColor: '#0f172a',
        backgroundColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 7,
        showLine: false,
        parsing: false as const,
      });
    }

    return { datasets };
  }, [sorted, useIfCnrAxis, currentPoint]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: '#334155',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          bodyFont: { family: "'IBM Plex Mono', monospace", size: 11 },
          callbacks: {
            title: (items) => {
              const x = items[0]?.parsed.x ?? 0;
              return useIfCnrAxis
                ? `FM IF Carrier-to-Noise Ratio: ${x.toFixed(1)} dB`
                : `Wideband Receiver Input SNR: ${x.toFixed(1)} dB`;
            },
            label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)} dB`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: useIfCnrAxis
              ? 'FM Receiver IF Carrier-to-Noise Ratio (CNR, dB)'
              : 'Receiver Input SNR (Wideband, dB)',
            color: '#475569',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
          },
          ticks: {
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
          },
          grid: { color: 'rgba(226, 232, 240, 0.9)' },
        },
        y: {
          min: -18,
          max: 45,
          title: {
            display: true,
            text: 'Demodulated Output SNR (dB)',
            color: '#475569',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
          },
          ticks: {
            color: '#64748b',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
          },
          grid: { color: 'rgba(226, 232, 240, 0.9)' },
        },
      },
    }),
    [useIfCnrAxis]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="h-72 w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};
