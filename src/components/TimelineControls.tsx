import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, Repeat, CloudRain, ChevronUp, ChevronDown } from 'lucide-react';
import { ForecastDataset, CityInfo } from '../types/forecast';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';

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
  const currentUtc = dataset.validTimesUtc[currentStepIndex] || '';

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
              {[0.5, 1, 2].map((s) => (
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

          {/* Lead Step Scrubber in Burmese Numbers */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {steps.map((lead, idx) => {
              const isSelected = idx === currentStepIndex;
              const isInit = lead === 0;
              return (
                <button
                  key={lead}
                  onClick={() => onSelectStepIndex(idx)}
                  className={`flex flex-col items-center justify-center rounded-xl px-2.5 py-1 transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/15 text-slate-300'
                  }`}
                >
                  <span className="font-mono text-xs font-bold leading-tight">
                    +{toBurmeseNumber(lead)}h
                  </span>
                  <span className={`text-[9px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {isInit ? 'GFS' : 'AI'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Valid Time in Burmese */}
          <div className="hidden sm:flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-400 block leading-tight">ခန့်မှန်းချက်အဆင့်</span>
              <span className="font-semibold text-white">+{toBurmeseNumber(currentLead)} နာရီ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
