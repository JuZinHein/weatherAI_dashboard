import React, { useState } from 'react';
import { CloudRain, Info } from 'lucide-react';
import { CityInfo } from '../types/forecast';

interface PrecipitationTimelineProps {
  city: CityInfo;
  leadHour: number;
}

export const PrecipitationTimeline: React.FC<PrecipitationTimelineProps> = ({ city, leadHour }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate 60 minute intervals (like OpenWeather 60-min precipitation radar)
  // Base precipitation probability on city region, temperature, and lead hour
  const isYangonOrCoastal = city.name === 'Yangon' || city.name === 'Mawlamyine' || city.name === 'Pathein';
  
  // Minute bar intervals: 0 to 60 (total 45 visual tick segments)
  const totalTicks = 45;
  const tickData = Array.from({ length: totalTicks }, (_, i) => {
    const minute = Math.round((i / (totalTicks - 1)) * 60);
    // Tropical shower pattern variation
    const noise = Math.sin(i * 0.35 + leadHour) * 0.5 + Math.cos(i * 0.15) * 0.3;
    let rate = 0;
    if (isYangonOrCoastal) {
      if (leadHour === 6 || leadHour === 30) {
        // Afternoon convective showers
        rate = Math.max(0, noise * 2.2);
      } else if (leadHour === 12) {
        rate = Math.max(0, (noise + 0.4) * 3.8);
      } else {
        rate = Math.max(0, noise * 0.4);
      }
    } else if (city.elevation.includes('1,')) {
      // Shan hills / Pyin Oo Lwin / Taunggyi
      rate = Math.max(0, (noise + 0.2) * 1.6);
    } else {
      // Dry zone (Mandalay / Monywa)
      rate = Math.max(0, (noise - 0.3) * 0.8);
    }
    return {
      minute,
      rate: Number(rate.toFixed(2)),
    };
  });

  const getBarColor = (rate: number) => {
    if (rate <= 0.05) return 'bg-slate-200 dark:bg-slate-700/60';
    if (rate <= 0.5) return 'bg-emerald-500';
    if (rate <= 2.5) return 'bg-emerald-700';
    if (rate <= 7.5) return 'bg-amber-500';
    return 'bg-rose-600';
  };

  const currentRate = hoveredIndex !== null ? tickData[hoveredIndex].rate : tickData[0].rate;
  const currentMinute = hoveredIndex !== null ? tickData[hoveredIndex].minute : 0;

  return (
    <div className="w-full rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left title & city label */}
        <div>
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Minute forecast · Precipitation
            </h3>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              {city.name} ({city.mmName})
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            High-resolution near-surface moisture & convective shower forecast
          </p>
        </div>

        {/* Legend strip (matching the OpenWeather screenshot) */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-emerald-500" />
            <span>0–0.5 mm/h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-emerald-700" />
            <span>0.5–2.5 mm/h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-amber-500" />
            <span>2.5–7.5 mm/h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-xs bg-rose-600" />
            <span>7.5+ mm/h</span>
          </div>
        </div>
      </div>

      {/* Time checkpoints: Now, 15 min, 30 min, 45 min, 60 min */}
      <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Now</div>
          <div className="font-mono-nums text-[11px] text-slate-500">T+{leadHour}h:00m</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">15 min</div>
          <div className="font-mono-nums text-[11px] text-slate-500">T+{leadHour}h:15m</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">30 min</div>
          <div className="font-mono-nums text-[11px] text-slate-500">T+{leadHour}h:30m</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">45 min</div>
          <div className="font-mono-nums text-[11px] text-slate-500">T+{leadHour}h:45m</div>
        </div>
        <div className="rounded-lg bg-slate-50 py-1.5 dark:bg-slate-800/60">
          <div className="font-semibold text-slate-900 dark:text-slate-100">60 min</div>
          <div className="font-mono-nums text-[11px] text-slate-500">T+{leadHour + 1}h:00m</div>
        </div>
      </div>

      {/* Minute precipitation tick bar line */}
      <div className="relative mt-3 pt-2">
        <div className="flex h-12 items-end justify-between gap-[3px] rounded-lg bg-slate-100/70 p-2 dark:bg-slate-800/40">
          {tickData.map((tick, i) => {
            const heightPercent = Math.max(14, Math.min(100, (tick.rate / 6) * 100));
            const isHovered = hoveredIndex === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative flex-1 cursor-pointer transition-all hover:scale-y-110"
                style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
              >
                <div
                  className={`w-full rounded-xs transition-colors ${getBarColor(tick.rate)} ${
                    isHovered ? 'ring-2 ring-emerald-400' : ''
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Hover / Active indicator feedback */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>
              {hoveredIndex !== null
                ? `At minute +${currentMinute}: ${currentRate} mm/h precipitation intensity`
                : 'Hover bars across the hour for exact precipitation intensity rates'}
            </span>
          </div>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
            {currentRate > 0 ? `${currentRate} mm/h` : 'No rain forecasted'}
          </span>
        </div>
      </div>
    </div>
  );
};
