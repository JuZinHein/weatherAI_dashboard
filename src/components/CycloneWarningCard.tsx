import React, { useState } from 'react';
import { StormAlert } from '../types/forecast';
import { toBurmeseNumber } from '../utils/burmese';
import { formatTimeWindow, parseForecastUtc } from '../utils/forecastTime';
import { AlertTriangle, Wind, Compass, ShieldAlert, X, ChevronRight, MapPin, Radio, Activity } from 'lucide-react';

interface CycloneWarningCardProps {
  alert: StormAlert;
  onFocusStorm?: (lat: number, lon: number) => void;
  onClose?: () => void;
}

export const CycloneWarningCard: React.FC<CycloneWarningCardProps> = ({
  alert,
  onFocusStorm,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(true);

  if (!alert.alert_active) return null;

  const knots = Math.round(alert.max_sustained_wind_kmh * 0.539957);
  const latStr = toBurmeseNumber(alert.coordinates.lat);
  const lonStr = toBurmeseNumber(alert.coordinates.lon);
  const windStr = toBurmeseNumber(alert.max_sustained_wind_kmh);

  if (isMinimized) {
    return (
      <div className="fixed bottom-40 right-6 sm:bottom-44 sm:right-8 z-40 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 rounded-full border border-rose-500/60 bg-rose-950/95 px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-xl transition hover:bg-rose-900/95 hover:border-rose-400 cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <span className="text-rose-200">🚨 မုန်တိုင်း သတိပေးချက်: {windStr} km/h</span>
          <ChevronRight className="h-3.5 w-3.5 text-rose-300" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-40 right-6 sm:bottom-44 sm:right-8 z-40 w-[92vw] sm:w-[410px] max-w-[calc(100vw-2rem)] rounded-2xl border border-rose-500/40 bg-black/90 p-4 text-white shadow-[0_0_35px_rgba(244,63,94,0.32)] backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header with pulsing radar beacon */}
      <div className="flex items-start justify-between gap-3 border-b border-rose-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-inner">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-500/30 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-rose-300 border border-rose-500/40">
                CYCLONE ALERT
              </span>
              <span className="text-[10px] font-mono text-rose-300/80">
                {(() => {
                  const start = parseForecastUtc(alert.timestamp);
                  if (!start) return alert.timestamp;
                  const end = new Date(start.getTime() + 6 * 3600 * 1000);
                  return formatTimeWindow(start, end);
                })()}
              </span>
            </div>
            <h3 className="font-display text-xs sm:text-sm font-bold text-white mt-0.5">
              ဆိုင်ကလုန်းမုန်တိုင်း အရေးပေါ် သတိပေးချက်
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
            title="အကျဉ်းချုံ့ရန်"
          >
            <ChevronRight className="h-4 w-4 rotate-90" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title="ပိတ်ရန်"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Critical Metrics Grid */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {/* Wind Speed */}
        <div className="rounded-xl border border-rose-500/25 bg-rose-950/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
            <Wind className="h-3.5 w-3.5" />
            <span>အမြင့်ဆုံး လေတိုက်နှုန်း</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl sm:text-2xl font-black text-rose-400">
              {windStr}
            </span>
            <span className="text-xs font-semibold text-rose-200">km/h</span>
            <span className="text-[10px] font-mono text-slate-400">({knots} kts)</span>
          </div>
          <div className="mt-0.5 text-[10px] text-rose-300/80">
            စံသတ်မှတ်ချက် {toBurmeseNumber(alert.threshold_kmh)} km/h ကျော်လွန်
          </div>
        </div>

        {/* Eye Coordinates */}
        <div className="rounded-xl border border-rose-500/25 bg-rose-950/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
            <Compass className="h-3.5 w-3.5" />
            <span>မုန်တိုင်းဗဟို တည်နေရာ</span>
          </div>
          <div className="mt-1 font-mono text-xs sm:text-sm font-bold text-amber-300">
            {latStr}°N, {lonStr}°E
          </div>
          <div className="mt-1 text-[10px] text-slate-300 truncate">
            {alert.region_mm}
          </div>
        </div>
      </div>

      {/* Meteorological Advisory in Burmese */}
      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-200">
        <p className="font-burmese text-[11px] sm:text-xs">
          {alert.advisory_mm}
        </p>
        <p className="mt-1.5 font-sans text-[10px] text-slate-400 italic">
          {alert.advisory_en}
        </p>
      </div>

      {/* Affected Coastal Areas */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="text-slate-400 font-medium">သတိပေးဒေသများ:</span>
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
          ရခိုင်ကမ်းရိုးတန်း
        </span>
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
          ဧရာဝတီမြစ်ဝကျွန်းပေါ်
        </span>
        <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
          မုတ္တမပင်လယ်ကွေ့
        </span>
      </div>

      {/* Action Buttons */}
      <div className="mt-3.5 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        {onFocusStorm && (
          <button
            onClick={() => onFocusStorm(alert.coordinates.lat, alert.coordinates.lon)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 px-3 py-2 text-xs font-bold text-white shadow-lg transition hover:from-rose-500 hover:to-amber-500 active:scale-95"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>မြေပုံတွင် မုန်တိုင်းဗဟိုသို့ ချိန်ညှိရန်</span>
          </button>
        )}
        <button
          onClick={() => setIsMinimized(true)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white"
        >
          အကျဉ်းချုံ့မည်
        </button>
      </div>
    </div>
  );
};
