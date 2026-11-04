import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, Repeat, CloudRain, ChevronUp, ChevronDown, Maximize2 } from 'lucide-react';
import { ForecastDataset, CityInfo } from '../types/forecast';
import { BURMESE_STRINGS, BURMESE_CITIES_MAP } from '../utils/burmese';
import { getStepTimeWindow } from '../utils/forecastTime';

interface TimelineControlsProps {
  dataset: ForecastDataset;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  autoLoop: boolean;
  onToggleAutoLoop: () => void;
  selectedCity: CityInfo;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  dataset,
  currentStepIndex,
  onSelectStepIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  autoLoop,
  onToggleAutoLoop,
  selectedCity,
}) => {
  const [showPrecipitation, setShowPrecipitation] = useState(false);
  const steps = dataset.leadHours;
  const currentLead = steps[currentStepIndex] ?? 0;
  const currentWindow = getStepTimeWindow(dataset.validTimesUtc, currentStepIndex);
  const longForecast = steps.length > 8;
  const scrubberRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrubberRef.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>('[data-step-selected="true"]');
    selected?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [currentStepIndex, steps.length]);

  const handlePrev = () => {
    onSelectStepIndex((currentStepIndex - 1 + steps.length) % steps.length);
  };

  const handleNext = () => {
    onSelectStepIndex((currentStepIndex + 1) % steps.length);
  };

  // Generate 45 minute ticks for precipitation
  const isYangonOrCoastal = selectedCity.name === 'Yangon' || selectedCity.name === 'Mawlamyine' || selectedCity.name === 'Pathein';
  const totalTicks = 45;
  const tickData = Array.from({ length: totalTicks }, (_, i) => {
    const minute = Math.round((i / (totalTicks - 1)) * 60);
    const noise = Math.sin(i * 0.35 + currentLead) * 0.5 + Math.cos(i * 0.15) * 0.3;
    let rate = 0;
    if (isYangonOrCoastal) {
      if (currentLead === 6 || currentLead === 30) {
        rate = Math.max(0, noise * 2.2);
      } else if (currentLead === 12) {
        rate = Math.max(0, (noise + 0.4) * 3.8);
      } else {
        rate = Math.max(0, noise * 0.4);
      }
    } else {
      rate = Math.max(0, (noise - 0.2) * 1.2);
    }
    return { minute, rate: Number(rate.toFixed(2)) };
  });

  const getBarColor = (rate: number) => {
    if (rate <= 0.05) return 'bg-slate-700/50';
    if (rate <= 0.5) return 'bg-emerald-400';
    if (rate <= 2.5) return 'bg-emerald-500';
    if (rate <= 7.5) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 w-[94%] max-w-4xl transition-all">
      {/* Expandable Minute Precipitation Bar */}
      {showPrecipitation && (
        <div className="mb-2 rounded-2xl border border-white/15 bg-black/75 p-3.5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between text-xs text-white mb-2">
            <div className="flex items-center gap-2">
              <CloudRain className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold">{BURMESE_STRINGS.precipitation}</span>
              <span className="text-slate-400">· {selectedCity.mmName || BURMESE_CITIES_MAP[selectedCity.name]?.mmName || selectedCity.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-300">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" /> {BURMESE_STRINGS.lightRain}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {BURMESE_STRINGS.moderateRain}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> {BURMESE_STRINGS.heavyRain}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> {BURMESE_STRINGS.extremeRain}</span>
            </div>
          </div>

          <div className="flex h-8 items-end gap-[2px] rounded-lg bg-white/5 p-1.5">
            {tickData.map((tick, i) => (
              <div
                key={i}
                className="flex-1 rounded-xs transition-all hover:scale-y-125"
                style={{
                  height: `${Math.max(15, Math.min(100, (tick.rate / 5) * 100))}%`,
                }}
              >
                <div className={`w-full h-full rounded-xs ${getBarColor(tick.rate)}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Floating Glass Player Dock */}
      <div className="rounded-2xl border border-white/15 bg-black/70 p-3 shadow-2xl backdrop-blur-xl text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Transport buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              title="ရှေ့သို့"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/15 hover:text-white"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={onTogglePlay}
              title={isPlaying ? BURMESE_STRINGS.pauseLoop : BURMESE_STRINGS.autoPlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 active:scale-95"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              title="နောက်သို့"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-200 transition hover:bg-white/15 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Speed */}
            <div className="ml-1 flex items-center rounded-full border border-white/15 bg-white/5 p-0.5 text-xs font-mono">
              {[0.5, 1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => onChangeSpeed(s)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                    playbackSpeed === s
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPrecipitation((v) => !v)}
              className={`ml-1 flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium transition ${
                showPrecipitation ? 'bg-emerald-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/15'
              }`}
            >
              <CloudRain className="h-3.5 w-3.5" />
              <span>မိုးရွာသွန်းမှု</span>
              {showPrecipitation ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          </div>

          {/* Short runs (≤30 h, 6 steps) keep one button per window.
              Longer runs (up to 14 days) use a slider plus a scrolling strip. */}
          {longForecast ? (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <input
                type="range"
                min={0}
                max={Math.max(0, steps.length - 1)}
                value={Math.min(currentStepIndex, Math.max(0, steps.length - 1))}
                onChange={(e) => onSelectStepIndex(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-emerald-500"
                aria-label="ခန့်မှန်းချက် အဆင့်"
              />
              <div ref={scrubberRef} className="flex items-center gap-1 overflow-x-auto max-w-[min(100%,42rem)]">
                {steps.map((lead, idx) => {
                  const isSelected = idx === currentStepIndex;
                  const win = getStepTimeWindow(dataset.validTimesUtc, idx);
                  const prev = idx > 0 ? getStepTimeWindow(dataset.validTimesUtc, idx - 1) : null;
                  const showDate = !prev || prev.dateLabel !== win?.dateLabel;
                  return (
                    <button
                      key={`${lead}-${idx}`}
                      data-step-selected={isSelected ? 'true' : 'false'}
                      onClick={() => onSelectStepIndex(idx)}
                      title={win?.label}
                      className={`flex shrink-0 flex-col items-center justify-center rounded-lg px-1.5 py-0.5 transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-white/5 hover:bg-white/15 text-slate-300'
                      }`}
                    >
                      <span className={`text-[8px] leading-tight ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {showDate ? win?.dateLabel ?? '' : ''}
                      </span>
                      <span className="font-mono text-[10px] font-bold leading-tight whitespace-nowrap">
                        {win?.shortLabel ?? `${lead}h`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <div ref={scrubberRef} className="flex items-center gap-1.5 overflow-x-auto max-w-[min(100%,42rem)]">
            {steps.map((lead, idx) => {
              const isSelected = idx === currentStepIndex;
              const win = getStepTimeWindow(dataset.validTimesUtc, idx);
              return (
                <button
                  key={`${lead}-${idx}`}
                  data-step-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectStepIndex(idx)}
                  title={win?.label}
                  className={`flex flex-col items-center justify-center rounded-xl px-2.5 py-1 transition-all min-w-[4.5rem] ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/15 text-slate-300'
                  }`}
                >
                  <span className={`text-[9px] leading-tight ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {win?.dateLabel ?? `T${idx}`}
                  </span>
                  <span className="font-mono text-[10px] font-bold leading-tight whitespace-nowrap">
                    {win?.shortLabel ?? `${lead}h`}
                  </span>
                </button>
              );
            })}
          </div>
          )}

          {/* Full selected window */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <div className="text-right">
              <span className="text-[10px] text-emerald-300 block leading-tight">ခန့်မှန်းချိန်ကာလ</span>
              <span className="font-semibold text-white font-mono text-[11px] whitespace-nowrap">
                {currentWindow?.label ?? '—'}
              </span>
            </div>
          </div>

          {/* Quick Fullscreen Button for mobile/tablet */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="flex sm:hidden h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/80 text-white transition hover:bg-emerald-500"
            title="မျက်နှာပြင်အပြည့် (Fullscreen)"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
