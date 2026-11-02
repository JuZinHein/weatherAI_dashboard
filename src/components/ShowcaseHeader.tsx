import React from 'react';
import { ViewMode } from '../types/forecast';
import { BURMESE_STRINGS, toBurmeseNumber } from '../utils/burmese';
import { Maximize2, Minimize2, Upload, Play, Pause, Globe, Map, BarChart3, Cpu, Sparkles, Server, Radio } from 'lucide-react';

interface ShowcaseHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenUpload: () => void;
  onOpenArchitecture?: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  leadHour: number;
  validMyanmarTime: string;
  stormAlertActive?: boolean;
}

export const ShowcaseHeader: React.FC<ShowcaseHeaderProps> = ({
  viewMode,
  onViewModeChange,
  isFullscreen,
  onToggleFullscreen,
  onOpenUpload,
  onOpenArchitecture,
  isPlaying,
  onTogglePlay,
  leadHour,
  validMyanmarTime,
  stormAlertActive,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            {BURMESE_STRINGS.appTitle}
          </span>
        </div>

        {/* View Mode Nav Links in Burmese */}
        <nav className="hidden lg:flex items-center gap-6 text-xs sm:text-sm font-medium">
          <button
            onClick={() => onViewModeChange('globe_3d')}
            className={`whitespace-nowrap transition-colors flex items-center gap-2 ${
              viewMode === 'globe_3d'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>{BURMESE_STRINGS.satelliteGlobe}</span>
          </button>

          <button
            onClick={() => onViewModeChange('satellite_radar')}
            className={`whitespace-nowrap transition-colors flex items-center gap-2 ${
              viewMode === 'satellite_radar'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Map className="h-4 w-4" />
            <span>{BURMESE_STRINGS.satelliteRadar2D}</span>
          </button>

          <button
            onClick={() => onViewModeChange('dual_fcn')}
            className={`whitespace-nowrap transition-colors flex items-center gap-2 ${
              viewMode === 'dual_fcn'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>{BURMESE_STRINGS.dualComparison}</span>
          </button>

          <button
            onClick={() => onViewModeChange('city_trends')}
            className={`whitespace-nowrap transition-colors flex items-center gap-2 ${
              viewMode === 'city_trends'
                ? 'text-emerald-400 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>{BURMESE_STRINGS.cityTrends}</span>
          </button>
        </nav>

        {/* Action Zone */}
        <div className="flex items-center gap-2.5 shrink-0">
          {stormAlertActive && onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="flex items-center gap-1.5 rounded-full border border-rose-500/50 bg-rose-950/80 px-3 py-1.5 text-xs font-bold text-rose-300 shadow-lg shadow-rose-950/50 transition hover:bg-rose-900 animate-pulse whitespace-nowrap"
              title="ဘင်္ဂလားပင်လယ်အော် ဆိုင်ကလုန်းမုန်တိုင်း သတိပေးချက်"
            >
              <Radio className="h-3.5 w-3.5 text-rose-400" />
              <span>မုန်တိုင်း သတိပေးချက်</span>
            </button>
          )}

          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/50 hover:text-white"
              title="အလိုအလျောက် Backend & Cron ပိုက်လိုင်း စနစ်"
            >
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Backend & Cron</span>
            </button>
          )}

          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 hover:text-white"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
            <span className="hidden sm:inline">{isPlaying ? BURMESE_STRINGS.pauseLoop : BURMESE_STRINGS.autoPlay}</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/15 hover:text-white"
          >
            <Upload className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">{BURMESE_STRINGS.uploadZip}</span>
          </button>

          <button
            onClick={onToggleFullscreen}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 whitespace-nowrap shrink-0"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? BURMESE_STRINGS.exitFullscreen : BURMESE_STRINGS.displayKiosk}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
