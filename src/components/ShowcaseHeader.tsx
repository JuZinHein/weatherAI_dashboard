import React from 'react';
import { ViewMode } from '../types/forecast';
import { BURMESE_STRINGS } from '../utils/burmese';
import { Maximize2, Minimize2, Play, Pause, Globe, Map, BarChart3, Cpu, Clock } from 'lucide-react';
import type { ZarrModel } from '../services/zarrApi';

interface ShowcaseHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  leadHour?: number;
  validMyanmarTime: string;
  models: ZarrModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export const ShowcaseHeader: React.FC<ShowcaseHeaderProps> = ({
  viewMode,
  onViewModeChange,
  isFullscreen,
  onToggleFullscreen,
  isPlaying,
  onTogglePlay,
  validMyanmarTime,
  models,
  selectedModelId,
  onSelectModel,
}) => {
  const navBtn = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => onViewModeChange(mode)}
      className={`whitespace-nowrap transition-colors flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
        viewMode === mode
          ? 'text-emerald-400 font-semibold bg-emerald-500/10'
          : 'text-slate-300 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );

  return (
    <header className="absolute top-0 left-0 right-0 z-30 border-b border-white/10 bg-black/50 backdrop-blur-xl">
      <div className="flex h-14 sm:h-16 w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-5">
        {/* Brand — truncates so it cannot cover actions */}
        <div className="flex min-w-0 max-w-[34%] sm:max-w-[28%] items-center gap-2 shrink">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Cpu className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>

        {/* View modes — centered, can shrink / hide labels */}
        <nav className="hidden md:flex flex-1 min-w-0 items-center justify-center gap-1 text-xs sm:text-sm font-medium overflow-hidden">
          {navBtn('globe_3d', <Globe className="h-4 w-4 shrink-0" />, BURMESE_STRINGS.satelliteGlobe)}
          {navBtn('satellite_radar', <Map className="h-4 w-4 shrink-0" />, BURMESE_STRINGS.satelliteRadar2D)}
          {navBtn('city_trends', <BarChart3 className="h-4 w-4 shrink-0" />, BURMESE_STRINGS.cityTrends)}
        </nav>

        {/* Mobile view switcher */}
        <div className="flex md:hidden flex-1 min-w-0 items-center justify-center gap-1">
          {navBtn('globe_3d', <Globe className="h-4 w-4" />, '')}
          {navBtn('satellite_radar', <Map className="h-4 w-4" />, '')}
          {navBtn('city_trends', <BarChart3 className="h-4 w-4" />, '')}
        </div>

        {/* Actions — always visible on the right, never overlapped */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 sm:gap-2 ml-auto">
          <label
            className="flex min-w-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-[11px] text-slate-300 sm:gap-1.5 sm:px-2.5"
            title="Select the local forecast model"
          >
            <Cpu className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="hidden sm:inline">Model</span>
            <select
              aria-label="Forecast model"
              value={selectedModelId}
              onChange={(event) => onSelectModel(event.target.value)}
              disabled={!models.length}
              className="max-w-[5.5rem] bg-transparent text-[11px] font-semibold text-white outline-none disabled:opacity-50 sm:max-w-28 sm:text-xs"
            >
              {models.length === 0 && <option value={selectedModelId}>Loading…</option>}
              {models.map((model) => (
                <option key={model.id} value={model.id} disabled={!model.available} className="bg-slate-900">
                  {model.label}{model.available ? '' : ' (missing)'}
                </option>
              ))}
            </select>
          </label>

          {validMyanmarTime && (
            <div
              className="hidden 2xl:flex w-64 shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] text-emerald-300"
              title={validMyanmarTime}
            >
              <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="min-w-0 flex-1 font-mono truncate">{validMyanmarTime}</span>
            </div>
          )}

          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 hover:text-white"
            title={isPlaying ? BURMESE_STRINGS.pauseLoop : BURMESE_STRINGS.autoPlay}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            <span className="hidden xl:inline">{isPlaying ? BURMESE_STRINGS.pauseLoop : BURMESE_STRINGS.autoPlay}</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            title="မျက်နှာပြင်အပြည့်ဖွင့်ရန် (Shortcut: [F])"
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/50 transition hover:from-emerald-500 hover:to-teal-500 active:scale-95 whitespace-nowrap"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            <kbd className="hidden lg:inline-block rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-emerald-200 font-bold border border-emerald-400/40">
              F
            </kbd>
          </button>
        </div>
      </div>
    </header>
  );
};
