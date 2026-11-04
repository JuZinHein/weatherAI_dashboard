import React from 'react';
import { Gauge, Sun, Droplets, Wind, Sparkles } from 'lucide-react';
import { CityInfo, ForecastDataset } from '../types/forecast';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';

interface OverviewStripProps {
  dataset: ForecastDataset;
  selectedCity: CityInfo;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
}

export const OverviewStrip: React.FC<OverviewStripProps> = ({
  dataset,
  selectedCity,
  currentStepIndex,
  onSelectStepIndex,
}) => {
  const currentStep =
    selectedCity.forecasts?.[currentStepIndex] || selectedCity.forecasts?.[0] || null;
  if (!currentStep) {
    return null;
  }
  const temp = currentStep.temperatureC;
  const wind = currentStep.windKmh;

  const pressure = Math.round(1012 + (temp > 30 ? -2 : 2) + Math.cos(currentStepIndex) * 1.5);
  const dewPoint = Math.round(temp - 6.5);
  const uvIndex = currentStepIndex === 1 || currentStepIndex === 5 ? 8 : currentStepIndex === 2 ? 6 : 1;
  const mmCityName = selectedCity.mmName || BURMESE_CITIES_MAP[selectedCity.name]?.mmName || selectedCity.name;

  return (
    <div className="pointer-events-none absolute top-20 right-6 z-20 hidden md:flex flex-col items-end gap-2">
      {/* City Badge & Current Temp in Crisp White Font on Subtle Dark Glass */}
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/15 bg-black/65 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
        <div className="text-right">
          <div className="font-burmese text-sm font-bold text-white leading-tight">
            {mmCityName}
          </div>
          <div className="font-burmese text-[11px] text-emerald-400">
            {selectedCity.state}
          </div>
        </div>
        <div className="h-8 w-px bg-white/20" />
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-white tracking-tight">
            {toBurmeseNumber(Math.round(temp))}°C
          </div>
          <div className="font-mono text-[10px] text-slate-300">
            {toBurmeseNumber(wind.toFixed(1))} km/h
          </div>
        </div>
      </div>

      {/* Atmospheric Metrics Strip */}
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/15 bg-black/65 p-1.5 shadow-2xl backdrop-blur-xl text-xs text-white">
        {/* Pressure */}
        <div className="flex items-center gap-1.5 px-2.5 py-1">
          <Gauge className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-slate-400 text-[11px]">{BURMESE_STRINGS.pressure}:</span>
          <span className="font-mono font-semibold">{toBurmeseNumber(pressure)} hPa</span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        {/* UV Index */}
        <div className="flex items-center gap-1.5 px-2.5 py-1">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-slate-400 text-[11px]">{BURMESE_STRINGS.uvIndex}:</span>
          <span className="font-mono font-semibold">{toBurmeseNumber(uvIndex)}</span>
        </div>

        <div className="h-4 w-px bg-white/20" />

        {/* Dew Point */}
        <div className="flex items-center gap-1.5 px-2.5 py-1">
          <Droplets className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-slate-400 text-[11px]">{BURMESE_STRINGS.dewPoint}:</span>
          <span className="font-mono font-semibold">{toBurmeseNumber(dewPoint)}°C</span>
        </div>
      </div>
    </div>
  );
};
