import React, { useState, useMemo, useEffect } from 'react';
import { CityInfo, ForecastDataset } from '../types/forecast';
import {
  WEATHER_CATEGORIES,
  WEATHER_VARIABLES,
  WEATHER_VARIABLES_BY_ID,
  WeatherCategoryId,
  WeatherVariableDef,
  synthesizeCityMetrics,
  getWmoWeatherInfo,
} from '../services/weatherVariables';
import { fetchLiveCityForecast } from '../services/weatherApi';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP, formatMyanmarTime } from '../utils/burmese';
import {
  MapPin,
  Wind,
  Thermometer,
  CloudRain,
  Gauge,
  Eye,
  ArrowUpDown,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  Check,
  Calendar,
} from 'lucide-react';

interface CityForecastPanelProps {
  dataset: ForecastDataset;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
}

type SortField = 'name' | 'primary' | 'temperature' | 'wind' | 'rain' | 'pressure';
type SortOrder = 'desc' | 'asc';

export const CityForecastPanel: React.FC<CityForecastPanelProps> = ({
  dataset,
  selectedCity,
  onSelectCity,
  currentStepIndex,
  onSelectStepIndex,
}) => {
  // Category tab filter
  const [activeCategory, setActiveCategory] = useState<WeatherCategoryId | 'all'>('all');

  // Dual-Axis Pairing: Primary Variable & Secondary Variable
  const [primaryVarId, setPrimaryVarId] = useState<string>('temperature_2m');
  const [secondaryVarId, setSecondaryVarId] = useState<string>('precipitation_probability');

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('primary');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Live API status
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);
  const [liveSuccessCity, setLiveSuccessCity] = useState<string | null>(null);
  const [augmentedForecasts, setAugmentedForecasts] = useState<Record<string, Record<string, number>[]>>({});

  const primaryVar = WEATHER_VARIABLES_BY_ID[primaryVarId] || WEATHER_VARIABLES[0];
  const secondaryVar = WEATHER_VARIABLES_BY_ID[secondaryVarId] || WEATHER_VARIABLES[8];

  // Filter variables by active category
  const filteredVariables = useMemo(() => {
    if (activeCategory === 'all') return WEATHER_VARIABLES;
    return WEATHER_VARIABLES.filter((v) => v.categoryId === activeCategory);
  }, [activeCategory]);

  // Helper to extract or synthesize metric value for a city at a given step index
  const getCityStepMetric = (city: CityInfo, stepIdx: number, varId: string): number => {
    // Check if live augmented data exists
    const cityAug = augmentedForecasts[city.name];
    if (cityAug && cityAug[stepIdx] && cityAug[stepIdx][varId] !== undefined) {
      return cityAug[stepIdx][varId];
    }

    const f = city.forecasts[stepIdx] || city.forecasts[0];
    if (f?.metrics && f.metrics[varId] !== undefined) {
      return f.metrics[varId];
    }

    // Direct fallbacks for core fields
    if (varId === 'temperature_2m') return f?.temperatureC ?? 28;
    if (varId === 'wind_speed_10m') return f?.windKmh ?? 10;

    // Synthesize physical value
    const leadH = f?.leadHours ?? stepIdx * 6;
    const baseT = f?.temperatureC ?? 28;
    const baseW = f?.windKmh ?? 10;
    const synth = synthesizeCityMetrics(leadH, baseT, baseW, city.lat, city.lon);
    return synth[varId] ?? 0;
  };

  // Sort and filter cities
  const sortedCities = useMemo(() => {
    return [...dataset.cityForecasts]
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const mm = (c.mmName || BURMESE_CITIES_MAP[c.name]?.mmName || '').toLowerCase();
        const en = c.name.toLowerCase();
        const region = (BURMESE_CITIES_MAP[c.name]?.region || c.state).toLowerCase();
        return en.includes(q) || mm.includes(q) || region.includes(q);
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (sortField === 'name') {
          return sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else if (sortField === 'primary') {
          valA = getCityStepMetric(a, currentStepIndex, primaryVarId);
          valB = getCityStepMetric(b, currentStepIndex, primaryVarId);
        } else if (sortField === 'temperature') {
          valA = getCityStepMetric(a, currentStepIndex, 'temperature_2m');
          valB = getCityStepMetric(b, currentStepIndex, 'temperature_2m');
        } else if (sortField === 'wind') {
          valA = getCityStepMetric(a, currentStepIndex, 'wind_speed_10m');
          valB = getCityStepMetric(b, currentStepIndex, 'wind_speed_10m');
        } else if (sortField === 'rain') {
          valA = getCityStepMetric(a, currentStepIndex, 'precipitation_probability');
          valB = getCityStepMetric(b, currentStepIndex, 'precipitation_probability');
        } else if (sortField === 'pressure') {
          valA = getCityStepMetric(a, currentStepIndex, 'pressure_msl');
          valB = getCityStepMetric(b, currentStepIndex, 'pressure_msl');
        }

        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [dataset.cityForecasts, searchQuery, sortField, sortOrder, currentStepIndex, primaryVarId, augmentedForecasts]);

  // Live Auto Fetch trigger (built-in Open-Meteo GFS client, no keys needed)
  const handleLiveFetch = async (city: CityInfo) => {
    setIsLiveFetching(true);
    try {
      const steps = await fetchLiveCityForecast(city, dataset.leadHours);
      const metricsList = steps.map((s) => s.metrics || {});
      setAugmentedForecasts((prev) => ({
        ...prev,
        [city.name]: metricsList,
      }));
      setLiveSuccessCity(city.name);
      setTimeout(() => setLiveSuccessCity(null), 3500);
    } catch (e) {
      console.warn('Live fetch error:', e);
    } finally {
      setIsLiveFetching(false);
    }
  };

  const mmCityName = selectedCity.mmName || BURMESE_CITIES_MAP[selectedCity.name]?.mmName || selectedCity.name;
  const numSteps = dataset.leadHours.length || 6;

  // Compute time series values for selected city
  const primarySeries = useMemo(() => {
    return dataset.leadHours.map((_, i) => getCityStepMetric(selectedCity, i, primaryVarId));
  }, [selectedCity, primaryVarId, dataset.leadHours, augmentedForecasts]);

  const secondarySeries = useMemo(() => {
    return dataset.leadHours.map((_, i) => getCityStepMetric(selectedCity, i, secondaryVarId));
  }, [selectedCity, secondaryVarId, dataset.leadHours, augmentedForecasts]);

  // Dual Axis Chart scaling calculations
  const chartW = 740;
  const chartH = 260;
  const pad = { top: 30, right: 55, bottom: 42, left: 55 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  const minP = Math.min(...primarySeries, primaryVar.min);
  const maxP = Math.max(...primarySeries, primaryVar.max * 0.4, minP + 1);
  const pRange = maxP - minP || 1;

  const minS = Math.min(...secondarySeries, secondaryVar.min);
  const maxS = Math.max(...secondarySeries, secondaryVar.max * 0.4, minS + 1);
  const sRange = maxS - minS || 1;

  const getX = (idx: number) => pad.left + (idx / Math.max(1, numSteps - 1)) * innerW;
  const getPrimaryY = (v: number) => pad.top + innerH - ((v - minP) / pRange) * innerH;
  const getSecondaryY = (v: number) => pad.top + innerH - ((v - minS) / sRange) * innerH;

  const primaryPath = primarySeries
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getPrimaryY(v)}`)
    .join(' ');

  const secondaryPath = secondarySeries
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getSecondaryY(v)}`)
    .join(' ');

  // Current step values for quick cards
  const curPrimaryVal = primarySeries[currentStepIndex] ?? primarySeries[0];
  const curSecondaryVal = secondarySeries[currentStepIndex] ?? secondarySeries[0];
  const curWeatherCode = Math.round(getCityStepMetric(selectedCity, currentStepIndex, 'weather_code'));
  const wmoInfo = getWmoWeatherInfo(curWeatherCode);

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pt-36 sm:pt-40 pb-32 text-white">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">

        {/* Category Filter Pills */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              ကဏ္ဍအလိုက် ရာသီဥတုညွှန်းကိန်းများ (Categories)
            </span>
            <span className="text-xs font-mono text-emerald-400">
              ၃၂ မျိုး ပါဝင်သော ဘက်စုံ မိုးလေဝသ အချက်အလက်
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
              }`}
            >
              အားလုံး (All 32)
            </button>
            {WEATHER_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
                }`}
              >
                <span>{cat.labelMm}</span>
                <span className="text-[10px] opacity-75">({cat.labelEn})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid: Left City Browser | Right Multi-Variable Dual Chart */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* City Browser & Sorting (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl border border-white/15 bg-black/65 p-4 backdrop-blur-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-white">
                  {BURMESE_STRINGS.citiesTitle}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {primaryVar.labelMm} တန်ဖိုးအလိုက် စီစဉ်ကြည့်ရှုရန်
                </p>
              </div>

              {/* Sorting Mode Dropdown */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                  className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/15 transition cursor-pointer"
                  title={sortOrder === 'desc' ? 'ကြီးစဉ်ငယ်လိုက် (High to Low)' : 'ငယ်စဉ်ကြီးလိုက် (Low to High)'}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="မြို့အမည် သို့မဟုတ် တိုင်းဒေသကြီး ရှာဖွေရန်..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Quick Sort Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1">
              <button
                onClick={() => setSortField('primary')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'primary' ? 'bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                {primaryVar.labelMm}
              </button>
              <button
                onClick={() => setSortField('temperature')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'temperature' ? 'bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                အပူချိန်
              </button>
              <button
                onClick={() => setSortField('wind')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'wind' ? 'bg-teal-500/30 text-teal-300 font-semibold border border-teal-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                လေတိုက်နှုန်း
              </button>
              <button
                onClick={() => setSortField('rain')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'rain' ? 'bg-sky-500/30 text-sky-300 font-semibold border border-sky-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                မိုးရွာနိုင်ခြေ
              </button>
              <button
                onClick={() => setSortField('name')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'name' ? 'bg-white/20 text-white font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                အမည် (A-Z)
              </button>
            </div>

            {/* City Cards List */}
            <div className="flex max-h-[460px] flex-col gap-2 overflow-y-auto pr-1">
              {sortedCities.map((city) => {
                const isSelected = city.name === selectedCity.name;
                const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
                const region = BURMESE_CITIES_MAP[city.name]?.region || city.state;
                const pVal = getCityStepMetric(city, currentStepIndex, primaryVarId);
                const sVal = getCityStepMetric(city, currentStepIndex, secondaryVarId);

                return (
                  <button
                    key={city.name}
                    onClick={() => onSelectCity(city)}
                    className={`flex items-center justify-between rounded-xl p-3 text-left transition border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600/35 border-emerald-500/70 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isSelected ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-white/10 text-slate-300'}`}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs leading-tight">
                          {mmName}
                        </div>
                        <div className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                          {region} · {city.elevation}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-xs" style={{ color: primaryVar.color }}>
                        {toBurmeseNumber(pVal)} {primaryVar.unit}
                      </div>
                      <div className="font-mono text-[10px]" style={{ color: secondaryVar.color }}>
                        {toBurmeseNumber(sVal)} {secondaryVar.unit}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dual-Axis Interactive Time Series Chart & Pairing Controls (8 cols) */}
          <div className="lg:col-span-8 rounded-2xl border border-white/15 bg-black/65 p-5 backdrop-blur-2xl flex flex-col gap-4">

            {/* Header: City Title & Live Zero-Config Refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-white">
                    {mmCityName} · ဘက်စုံ ရာသီဥတု နှိုင်းယှဉ်ချက်ဇယား
                  </h3>
                  {liveSuccessCity === selectedCity.name && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                      <Check className="h-3 w-3" /> Live GFS Updated
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedCity.state} · တည်နေရာ: {toBurmeseNumber(selectedCity.lat)}°N, {toBurmeseNumber(selectedCity.lon)}°E · ပင်လယ်ရေမျက်နှာပြင်: {selectedCity.elevation}
                </p>
              </div>

              {/* Zero-Config Live Refresh Button */}
              <button
                onClick={() => handleLiveFetch(selectedCity)}
                disabled={isLiveFetching}
                className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow transition hover:bg-emerald-900/70 hover:text-white cursor-pointer disabled:opacity-50"
                title="Open-Meteo GFS တိုက်ရိုက် မိုးလေဝသ အချက်အလက်များ အလိုအလျောက် ရယူရန်"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLiveFetching ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isLiveFetching ? 'ရယူနေပါသည်...' : 'Live GFS အချက်အလက်ရယူရန်'}</span>
              </button>
            </div>

            {/* Variable Pairing Selectors (Dual Axis: Primary vs Secondary) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
              {/* Primary Axis Selector */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5" style={{ color: primaryVar.color }}>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryVar.color }} />
                    <span>ပထမ ညွှန်းကိန်း (ဘယ်ဘက် ဝင်ရိုး)</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-80">{primaryVar.unit}</span>
                </div>
                <div className="relative">
                  <select
                    value={primaryVarId}
                    onChange={(e) => setPrimaryVarId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/20 bg-black/80 px-3 py-2 pr-8 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {filteredVariables.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                        {v.labelMm} ({v.labelEn}) - {v.unit}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{primaryVar.descriptionMm}</p>
              </div>

              {/* Secondary Axis Selector */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1.5" style={{ color: secondaryVar.color }}>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: secondaryVar.color }} />
                    <span>ဒုတိယ ညွှန်းကိန်း (ညာဘက် ဝင်ရိုး)</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-80">{secondaryVar.unit}</span>
                </div>
                <div className="relative">
                  <select
                    value={secondaryVarId}
                    onChange={(e) => setSecondaryVarId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-white/20 bg-black/80 px-3 py-2 pr-8 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    {filteredVariables.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                        {v.labelMm} ({v.labelEn}) - {v.unit}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{secondaryVar.descriptionMm}</p>
              </div>
            </div>

            {/* SVG Dual-Axis Chart */}
            <div className="relative w-full overflow-hidden rounded-xl bg-black/40 border border-white/10 p-2">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto overflow-visible">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = pad.top + innerH * (1 - ratio);
                  const pTick = (minP + ratio * pRange).toFixed(1);
                  const sTick = (minS + ratio * sRange).toFixed(1);

                  return (
                    <g key={ratio}>
                      <line
                        x1={pad.left}
                        y1={y}
                        x2={chartW - pad.right}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeDasharray="4 4"
                      />
                      {/* Left Axis: Primary Var */}
                      <text
                        x={pad.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] font-mono font-semibold"
                        fill={primaryVar.color}
                      >
                        {toBurmeseNumber(pTick)}
                      </text>
                      {/* Right Axis: Secondary Var */}
                      <text
                        x={chartW - pad.right + 8}
                        y={y + 3}
                        textAnchor="start"
                        className="text-[10px] font-mono font-semibold"
                        fill={secondaryVar.color}
                      >
                        {toBurmeseNumber(sTick)}
                      </text>
                    </g>
                  );
                })}

                {/* Primary Curve (Solid Line) */}
                <path
                  d={primaryPath}
                  fill="none"
                  stroke={primaryVar.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Secondary Curve (Dashed Line) */}
                <path
                  d={secondaryPath}
                  fill="none"
                  stroke={secondaryVar.color}
                  strokeWidth="2.2"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Time Step Data Points */}
                {dataset.leadHours.map((hour, i) => {
                  const cx = getX(i);
                  const pVal = primarySeries[i];
                  const sVal = secondarySeries[i];
                  const cyP = getPrimaryY(pVal);
                  const cyS = getSecondaryY(sVal);
                  const isCurrent = i === currentStepIndex;

                  return (
                    <g key={i}>
                      {/* Active Lead Hour Column Highlight */}
                      {isCurrent && (
                        <line
                          x1={cx}
                          y1={pad.top}
                          x2={cx}
                          y2={pad.top + innerH}
                          stroke="rgba(52, 211, 153, 0.45)"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* X-Axis Time Label */}
                      <text
                        x={cx}
                        y={chartH - 12}
                        textAnchor="middle"
                        className={`text-[10px] font-mono ${
                          isCurrent ? 'font-bold fill-emerald-400' : 'fill-slate-400'
                        }`}
                      >
                        +{toBurmeseNumber(hour)}h
                      </text>

                      {/* Primary Node (Circle) */}
                      <circle
                        cx={cx}
                        cy={cyP}
                        r={isCurrent ? 6.5 : 4.5}
                        fill={primaryVar.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-transform hover:scale-125"
                        onClick={() => onSelectStepIndex(i)}
                      />

                      {/* Secondary Node (Diamond/Square) */}
                      <rect
                        x={cx - (isCurrent ? 5.5 : 4)}
                        y={cyS - (isCurrent ? 5.5 : 4)}
                        width={isCurrent ? 11 : 8}
                        height={isCurrent ? 11 : 8}
                        fill={secondaryVar.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-transform hover:scale-125"
                        onClick={() => onSelectStepIndex(i)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Summary Strip for Selected Timestep */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="text-[10px] text-slate-400 block line-clamp-1">{primaryVar.labelMm}</span>
                <span className="font-mono text-base font-black" style={{ color: primaryVar.color }}>
                  {toBurmeseNumber(curPrimaryVal)} {primaryVar.unit}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="text-[10px] text-slate-400 block line-clamp-1">{secondaryVar.labelMm}</span>
                <span className="font-mono text-base font-black" style={{ color: secondaryVar.color }}>
                  {toBurmeseNumber(curSecondaryVal)} {secondaryVar.unit}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="text-[10px] text-slate-400 block">ရာသီဥတု အခြေအနေ</span>
                <span className="font-display text-xs font-bold text-amber-300 flex items-center gap-1 mt-0.5">
                  <span>{wmoInfo.icon}</span>
                  <span className="line-clamp-1">{wmoInfo.labelMm}</span>
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <span className="text-[10px] text-slate-400 block">ခန့်မှန်းချိန်ကာလ</span>
                <span className="font-mono text-xs font-bold text-emerald-400 block mt-0.5">
                  +{toBurmeseNumber(dataset.leadHours[currentStepIndex])} နာရီအဆင့်
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Comprehensive Multi-Variable Rollout Table */}
        <div className="rounded-2xl border border-white/15 bg-black/65 p-5 backdrop-blur-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h4 className="font-display text-sm font-bold text-white">
                {mmCityName} · ၃၀ နာရီ ခန့်မှန်းချက် အသေးစိတ်ဇယား (Detailed Atmospheric Rollout)
              </h4>
              <p className="text-xs text-slate-400">
                ရွေးချယ်ထားသော ကဏ္ဍအလိုက် အနာဂတ် ရာသီဥတု ညွှန်းကိန်းများအားလုံး ပြသထားပါသည်
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono">
              NVIDIA FourCastNet + GFS 73-Channel Rollout
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">အချိန်အဆင့်</th>
                  <th className="py-2.5 px-3">အခြေအနေ</th>
                  {filteredVariables.slice(0, 7).map((v) => (
                    <th key={v.id} className="py-2.5 px-3 whitespace-nowrap font-medium" style={{ color: v.color }}>
                      {v.labelMm} ({v.unit})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {dataset.leadHours.map((hour, i) => {
                  const isCurrent = i === currentStepIndex;
                  const stepTimeUtc = selectedCity.forecasts[i]?.validUtc || new Date().toISOString();
                  const wCode = Math.round(getCityStepMetric(selectedCity, i, 'weather_code'));
                  const wInfo = getWmoWeatherInfo(wCode);

                  return (
                    <tr
                      key={i}
                      onClick={() => onSelectStepIndex(i)}
                      className={`cursor-pointer transition hover:bg-white/10 ${
                        isCurrent ? 'bg-emerald-500/15 text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-burmese whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isCurrent && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                          <span>+{toBurmeseNumber(hour)} နာရီ</span>
                          <span className="text-[10px] text-slate-400 font-mono">({formatMyanmarTime(stepTimeUtc, false)})</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-burmese whitespace-nowrap">
                        <span className="flex items-center gap-1 text-[11px] text-amber-300">
                          <span>{wInfo.icon}</span>
                          <span>{wInfo.labelMm}</span>
                        </span>
                      </td>

                      {filteredVariables.slice(0, 7).map((v) => {
                        const val = getCityStepMetric(selectedCity, i, v.id);
                        return (
                          <td key={v.id} className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold" style={{ color: v.color }}>
                              {toBurmeseNumber(val)}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">{v.unit}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
