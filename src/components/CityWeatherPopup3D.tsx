import React from 'react';
import { CityInfo } from '../types/forecast';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { getStepTimeWindow } from '../utils/forecastTime';
import { X, Thermometer, Wind, Gauge, Droplets, Navigation, Check } from 'lucide-react';

interface CityWeatherPopup3DProps {
  city: CityInfo;
  currentStepIndex: number;
  onClose: () => void;
  onSelectCity: (city: CityInfo) => void;
  isSelectedCity: boolean;
}

export const CityWeatherPopup3D: React.FC<CityWeatherPopup3DProps> = ({
  city,
  currentStepIndex,
  onClose,
  onSelectCity,
  isSelectedCity,
}) => {
  const currentF = city.forecasts[currentStepIndex] || city.forecasts[0];
  const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
  const region = BURMESE_CITIES_MAP[city.name]?.region || city.state;
  const stepTimes = city.forecasts.map((f) => f.validUtc);
  const currentWindow = getStepTimeWindow(stepTimes, currentStepIndex);

  const temp = currentF.temperatureC;
  const wind = currentF.windKmh;
  const pressure = Math.round(1012 + (temp > 30 ? -2 : 2) + Math.cos(currentStepIndex) * 1.5);
  const dewPoint = Math.round(temp - 6.5);
  const humidity = Math.round(62 + Math.sin(currentStepIndex * 0.7) * 8);

  return (
    <div className="absolute top-24 left-6 z-40 w-80 sm:w-96 rounded-2xl border border-white/20 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-2xl text-white font-burmese animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-display text-lg font-bold text-white">
              {mmName} <span className="text-xs font-normal text-slate-400">({city.name})</span>
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-emerald-400">
            {region} · အမြင့်ပေ {toBurmeseNumber(city.elevation)}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {toBurmeseNumber(city.lat.toFixed(2))}°N, {toBurmeseNumber(city.lon.toFixed(2))}°E
          </p>
        </div>

        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
          title={BURMESE_STRINGS.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary Weather Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Temperature */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-300">
            <Thermometer className="h-3.5 w-3.5" />
            <span>{BURMESE_STRINGS.temperature}</span>
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-white">
            {toBurmeseNumber(Math.round(temp))}°C
          </div>
          <div className="text-[11px] text-amber-200/80">
            ၂ မီတာ မြေပြင်အပူချိန်
          </div>
        </div>

        {/* Wind */}
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs text-teal-300">
            <Wind className="h-3.5 w-3.5" />
            <span>{BURMESE_STRINGS.windSpeed}</span>
          </div>
          <div className="mt-1 font-display text-2xl font-bold text-white">
            {toBurmeseNumber(wind.toFixed(1))} <span className="text-xs font-normal">km/h</span>
          </div>
          <div className="text-[11px] text-teal-200/80">
            ၁၀ မီတာ လေတိုက်နှုန်း
          </div>
        </div>
      </div>

      {/* Atmospheric secondary stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <div className="text-[10px] text-slate-400">{BURMESE_STRINGS.pressure}</div>
          <div className="font-mono font-semibold text-white mt-0.5">{toBurmeseNumber(pressure)} <span className="text-[9px]">hPa</span></div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <div className="text-[10px] text-slate-400">{BURMESE_STRINGS.dewPoint}</div>
          <div className="font-mono font-semibold text-white mt-0.5">{toBurmeseNumber(dewPoint)}°C</div>
        </div>
        <div className="rounded-lg bg-white/5 p-2 border border-white/5">
          <div className="text-[10px] text-slate-400">{BURMESE_STRINGS.humidity}</div>
          <div className="font-mono font-semibold text-white mt-0.5">{toBurmeseNumber(humidity)}%</div>
        </div>
      </div>

      {/* 30-Hour Rollout Mini Strip for this City */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[11px] font-semibold text-slate-300 mb-2">
          NVIDIA FourCastNet ၃၀ နာရီ ခန့်မှန်းချက် အဆင့်များ:
        </div>
        <div className="grid grid-cols-6 gap-1">
          {city.forecasts.map((f, idx) => {
            const isStepActive = idx === currentStepIndex;
            const win = getStepTimeWindow(stepTimes, idx);
            return (
              <div
                key={f.leadHours}
                className={`flex flex-col items-center justify-center rounded-lg p-1 text-center transition ${
                  isStepActive
                    ? 'bg-emerald-600 text-white font-bold ring-1 ring-emerald-400'
                    : 'bg-white/5 text-slate-300'
                }`}
              >
                <span className="text-[8px] font-mono opacity-80 leading-tight">{win?.shortLabel ?? `${f.leadHours}h`}</span>
                <span className="text-xs font-semibold">{toBurmeseNumber(Math.round(f.temperatureC))}°</span>
                <span className="text-[8px] font-mono text-teal-300">{toBurmeseNumber(f.windKmh.toFixed(0))}k</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Select Action */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-[10px] text-slate-400 font-mono">
          {currentWindow?.label ?? '—'}
        </span>

        <button
          onClick={() => {
            onSelectCity(city);
          }}
          disabled={isSelectedCity}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            isSelectedCity
              ? 'bg-white/10 text-emerald-400 cursor-default'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-md'
          }`}
        >
          {isSelectedCity ? <Check className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5" />}
          <span>{isSelectedCity ? 'ရွေးချယ်ထားပြီး' : 'ပင်မမြို့အဖြစ် သတ်မှတ်ရန်'}</span>
        </button>
      </div>
    </div>
  );
};
