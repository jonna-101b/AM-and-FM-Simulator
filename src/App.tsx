import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calculator,
  Radio,
  Sliders,
  TrendingDown,
  Waves,
} from 'lucide-react';
import { ComparisonSection } from './components/ComparisonSection';
import { ControlDeck } from './components/ControlDeck';
import { GuideModal } from './components/GuideModal';
import {
  AmSimulatorView,
  FmSimulatorView,
  NoiseExperimentsView,
  OverviewView,
  SignalGeneratorView,
} from './components/SimulatorViews';
import { ThresholdSection } from './components/ThresholdSection';
import { ValidationSection } from './components/ValidationSection';
import { TimeWindowState, ZoomToolbar } from './components/ZoomToolbar';
import { runSimulation } from './dsp/simulator';
import { DEFAULT_PARAMS, SimulationParams } from './dsp/types';

type SectionId =
  | 'overview'
  | 'signal'
  | 'am'
  | 'fm'
  | 'noise'
  | 'threshold'
  | 'comparison'
  | 'validation';

const LAB_SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: '1. Overview', icon: Activity },
  { id: 'signal', label: '2. Signal Generator', icon: Waves },
  { id: 'am', label: '3. AM Simulator', icon: Radio },
  { id: 'fm', label: '4. FM Simulator', icon: Sliders },
  { id: 'noise', label: '5. Noise Experiments', icon: Waves },
  { id: 'threshold', label: '6. FM Threshold', icon: TrendingDown },
  { id: 'comparison', label: '7. Performance Comparison', icon: BarChart3 },
  { id: 'validation', label: '8. Engineering Validation', icon: Calculator },
];

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [timeWindow, setTimeWindow] = useState<TimeWindowState>({
    durationMs: 8.0,
    startMs: 0,
  });
  const [guideOpen, setGuideOpen] = useState(false);

  const simResult = useMemo(() => runSimulation(params), [params]);

  const totalDurationMs =
    simResult.timeMs.length > 1 ? simResult.timeMs[simResult.timeMs.length - 1] : 8.0;

  const focusGroup =
    activeSection === 'signal'
      ? 'signal'
      : activeSection === 'am'
      ? 'am'
      : activeSection === 'fm'
      ? 'fm'
      : activeSection === 'noise'
      ? 'channel'
      : 'all';

  const showZoomBar =
    activeSection === 'overview' ||
    activeSection === 'signal' ||
    activeSection === 'am' ||
    activeSection === 'fm' ||
    activeSection === 'noise';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className="text-base font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            AM &amp; FM Modulation Lab
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveSection('overview')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'overview' ? 'text-slate-900 underline underline-offset-4' : ''
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('am')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'am' ? 'text-blue-700 underline underline-offset-4' : ''
              }`}
            >
              AM Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('fm')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'fm' ? 'text-amber-700 underline underline-offset-4' : ''
              }`}
            >
              FM Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('comparison')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'comparison' ? 'text-slate-900 underline underline-offset-4' : ''
              }`}
            >
              Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('validation')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'validation' ? 'text-slate-900 underline underline-offset-4' : ''
              }`}
            >
              Validation
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              How to Use
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Engineering Console */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Navigation & Parameter Column */}
        <aside className="w-full lg:w-80 shrink-0 space-y-5">
          {/* 8-Section Lab Navigation */}
          <nav
            aria-label="Simulator Sections"
            className="bg-white border border-slate-200 rounded-lg p-2 space-y-0.5"
          >
            {LAB_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Live Parameter Controls */}
          <ControlDeck params={params} onChange={setParams} focusGroup={focusGroup} />
        </aside>

        {/* Main Viewport Stage */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Active Warnings Banner (non-hue-only text + icon) */}
          {simResult.warnings.length > 0 && (
            <div className="space-y-2">
              {simResult.warnings.map((w) => (
                <div
                  key={w.code}
                  className={`rounded-lg border px-4 py-2.5 flex items-start gap-2.5 text-xs ${
                    w.severity === 'critical'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{w.title}: </span>
                    <span>{w.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Waveform Time-Window Zoom Bar */}
          {showZoomBar && (
            <ZoomToolbar
              totalDurationMs={totalDurationMs}
              windowState={timeWindow}
              onChange={setTimeWindow}
              carrierFreqKhz={params.carrierFreqKhz}
            />
          )}

          {/* Section Content */}
          {activeSection === 'overview' && (
            <OverviewView
              params={params}
              result={simResult}
              timeWindow={timeWindow}
              onChangeParams={setParams}
              onNavigate={(id) => setActiveSection(id as SectionId)}
            />
          )}

          {activeSection === 'signal' && (
            <SignalGeneratorView
              params={params}
              result={simResult}
              timeWindow={timeWindow}
              onChangeParams={setParams}
            />
          )}

          {activeSection === 'am' && (
            <AmSimulatorView
              params={params}
              result={simResult}
              timeWindow={timeWindow}
              onChangeParams={setParams}
            />
          )}

          {activeSection === 'fm' && (
            <FmSimulatorView
              params={params}
              result={simResult}
              timeWindow={timeWindow}
              onChangeParams={setParams}
            />
          )}

          {activeSection === 'noise' && (
            <NoiseExperimentsView
              params={params}
              result={simResult}
              timeWindow={timeWindow}
              onChangeParams={setParams}
            />
          )}

          {activeSection === 'threshold' && (
            <ThresholdSection
              params={params}
              simResult={simResult}
              onChangeParams={setParams}
            />
          )}

          {activeSection === 'comparison' && <ComparisonSection result={simResult} />}

          {activeSection === 'validation' && (
            <ValidationSection
              liveParams={params}
              liveResult={simResult}
              onLoadIntoSimulator={(next) => {
                setParams(next);
                setActiveSection('am');
              }}
            />
          )}
        </main>
      </div>

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
