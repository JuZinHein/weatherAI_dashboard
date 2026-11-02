import React, { useState } from 'react';
import { CityInfo, ForecastDataset } from '../types/forecast';
import { MapPin, Wind, Thermometer, TrendingUp, Compass, Calendar } from 'lucide-react';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP, formatMyanmarTime } from '../utils/burmese';

interface CityForecastPanelProps {
  dataset: ForecastDataset;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
}

export const CityForecastPanel: React.FC<CityForecastPanelProps> = ({
  dataset,
  selectedCity,
  onSelectCity,
  currentStepIndex,
  onSelectStepIndex,
}) => {
  const forecasts = selectedCity.forecasts;
  const currentF = forecasts[currentStepIndex] || forecasts[0];
  const mmCityName = selectedCity.mmName || BURMESE_CITIES_MAP[selectedCity.name]?.mmName || selectedCity.name;

  // Chart dimensions
  const width = 640;
  const height = 240;
  const pad = { top: 30, right: 45, bottom: 40, left: 45 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const minT = 24;
  const maxT = 34;
  const minW = 0;
  const maxW = 10;

  const getX = (idx: number) => pad.left + (idx / (forecasts.length - 1)) * innerW;
  const getYTemp = (temp: number) => pad.top + innerH - ((temp - minT) / (maxT - minT)) * innerH;
  const getYWind = (wind: number) => pad.top + innerH - ((wind - minW) / (maxW - minW)) * innerH;

  const tempPath = forecasts
    .map((f, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYTemp(f.temperatureC)}`)
    .join(' ');

  const windPath = forecasts
    .map((f, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getYWind(f.windKmh)}`)
    .join(' ');

  return (
    <div className="h-full w-full overflow-y-auto p-6 pt-24 pb-28 text-white">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* City Selector List in Burmese */}
          <div className="rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-sm font-bold text-white">
                {BURMESE_STRINGS.citiesTitle}
              </h3>
              <span className="text-[11px] text-emerald-400 font-mono">{BURMESE_STRINGS.stationsCount}</span>
            </div>

            <div className="flex max-h-[380px] flex-col gap-1.5 overflow-y-auto pr-1">
              {dataset.cityForecasts.map((city) => {
                const isSelected = city.name === selectedCity.name;
                const f = city.forecasts[currentStepIndex] || city.forecasts[0];
                const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
                const region = BURMESE_CITIES_MAP[city.name]?.region || city.state;
                return (
                  <button
                    key={city.name}
                    onClick={() => onSelectCity(city)}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className={`h-4 w-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-semibold text-xs leading-tight">
                          {mmName}
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {region}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-xs">{toBurmeseNumber(Math.round(f.temperatureC))}°C</div>
                      <div className={`font-mono text-[10px] ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {toBurmeseNumber(f.windKmh.toFixed(1))} km/h
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual Axis Time Series Chart in Burmese */}
          <div className="rounded-2xl border border-white/15 bg-black/60 p-5 backdrop-blur-xl lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-base font-bold text-white">
                    {mmCityName} · အပူချိန်နှင့် လေတိုက်နှုန်း ခန့်မှန်းချက်ဇယား
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  NVIDIA FourCastNet မှ ၃၀ နာရီအတွင်း အနာဂတ် ရာသီဥတု ခန့်မှန်းချက်
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span>{BURMESE_STRINGS.temperature} (°C)</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-teal-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                  <span>{BURMESE_STRINGS.windSpeed} (km/h)</span>
                </div>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="relative w-full overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[260px] overflow-visible">
                {[26, 28, 30, 32, 34].map((t) => (
                  <g key={t}>
                    <line
                      x1={pad.left}
                      y1={getYTemp(t)}
                      x2={width - pad.right}
                      y2={getYTemp(t)}
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={pad.left - 8}
                      y={getYTemp(t) + 3}
                      textAnchor="end"
                      className="text-[10px] font-mono fill-amber-400 font-semibold"
                    >
                      {toBurmeseNumber(t)}°
                    </text>
                  </g>
                ))}

                {[2, 4, 6, 8].map((w) => (
                  <text
                    key={w}
                    x={width - pad.right + 8}
                    y={getYWind(w) + 3}
                    textAnchor="start"
                    className="text-[10px] font-mono fill-teal-400 font-semibold"
                  >
                    {toBurmeseNumber(w)}k
                  </text>
                ))}

                <path d={tempPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={windPath} fill="none" stroke="#14b8a6" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />

                {forecasts.map((f, i) => {
                  const cx = getX(i);
                  const cyTemp = getYTemp(f.temperatureC);
                  const cyWind = getYWind(f.windKmh);
                  const isStepActive = i === currentStepIndex;

                  return (
                    <g key={i}>
                      <text
                        x={cx}
                        y={height - 10}
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${
                          isStepActive ? 'font-bold fill-emerald-400' : 'fill-slate-400'
                        }`}
                      >
                        +{toBurmeseNumber(f.leadHours)}h
                      </text>

                      <circle
                        cx={cx}
                        cy={cyTemp}
                        r={isStepActive ? 6 : 4.5}
                        fill="#f59e0b"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-pointer"
                        onClick={() => onSelectStepIndex(i)}
                      />

                      <rect
                        x={cx - (isStepActive ? 5 : 3.5)}
                        y={cyWind - (isStepActive ? 5 : 3.5)}
                        width={isStepActive ? 10 : 7}
                        height={isStepActive ? 10 : 7}
                        fill="#14b8a6"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-pointer"
                        onClick={() => onSelectStepIndex(i)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{BURMESE_STRINGS.activeStep}:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  +{toBurmeseNumber(currentF.leadHours)} နာရီ ({currentF.isFuture ? BURMESE_STRINGS.fcnForecast : BURMESE_STRINGS.gfsState})
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono">
                  {BURMESE_STRINGS.temperature}: <strong className="text-amber-400">{toBurmeseNumber(currentF.temperatureC)}°C</strong>
                </span>
                <span className="font-mono">
                  {BURMESE_STRINGS.windSpeed}: <strong className="text-teal-400">{toBurmeseNumber(currentF.windKmh)} km/h</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed 30-Hour Station Table */}
        <div className="rounded-2xl border border-white/15 bg-black/60 p-5 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="font-display text-sm font-bold text-white">
              {mmCityName} · ၃၀ နာရီ ခန့်မှန်းချက် အသေးစိတ်ဇယား (Numerical Rollout)
            </h4>
            <span className="text-xs text-emerald-400 font-mono">NVIDIA FourCastNet Rollout</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-burmese">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2">ကြိုတင်ခန့်မှန်းချိန်</th>
                  <th className="py-2">အပူချိန် (°C)</th>
                  <th className="py-2">လေတိုက်နှုန်း (km/h)</th>
                  <th className="py-2">မိုးရွာသွန်းနိုင်ခြေ</th>
                  <th className="py-2">အမျိုးအစား</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {forecasts.map((f, i) => (
                  <tr key={i} className={`hover:bg-white/5 ${i === currentStepIndex ? 'bg-emerald-500/10 text-emerald-300 font-semibold' : 'text-slate-200'}`}>
                    <td className="py-2 font-burmese">
                      +{toBurmeseNumber(f.leadHours)} နာရီ ({f.validUtc ? formatMyanmarTime(f.validUtc, false) : ''})
                    </td>
                    <td className="py-2 text-amber-400 font-bold">{toBurmeseNumber(f.temperatureC)}°C</td>
                    <td className="py-2 text-teal-400">{toBurmeseNumber(f.windKmh.toFixed(1))} km/h</td>
                    <td className="py-2 font-burmese">{f.windKmh > 12 ? 'မိုးရွာရန် အလားအလာရှိ' : 'မိုးနည်းပါး'}</td>
                    <td className="py-2 font-burmese text-[11px] text-slate-400">{f.isFuture ? 'NVIDIA AI Forecast' : 'GFS Initial State'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
