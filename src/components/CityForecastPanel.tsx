import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CityInfo, ForecastDataset } from '../types/forecast';
import {
  WEATHER_VARIABLES,
  WEATHER_VARIABLES_BY_ID,
  LEGACY_METRIC_TO_ZARR,
} from '../services/weatherVariables';
import { ZARR_VAR_LABELS_MM, fetchZarrTimeseries } from '../services/zarrApi';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { getStepTimeWindow } from '../utils/forecastTime';
import {
  MapPin,
  ArrowUpDown,
  Search,
  ChevronDown,
} from 'lucide-react';

interface CityForecastPanelProps {
  dataset: ForecastDataset;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
}

type SortField = 'name' | 'primary' | 'temperature' | 'wind';
type SortOrder = 'desc' | 'asc';

function resolveVarId(id: string): string {
  return LEGACY_METRIC_TO_ZARR[id] || id;
}

export const CityForecastPanel: React.FC<CityForecastPanelProps> = ({
  dataset,
  selectedCity,
  onSelectCity,
  currentStepIndex,
  onSelectStepIndex,
}) => {
  const [primaryVarId, setPrimaryVarId] = useState<string>('t2m');
  const [secondaryVarId, setSecondaryVarId] = useState<string>('wind10m');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('primary');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  /** cityName → values[leadIndex] from forecast.zarr */
  const [primarySeriesByCity, setPrimarySeriesByCity] = useState<Record<string, number[]>>({});
  const [secondarySeriesByCity, setSecondarySeriesByCity] = useState<Record<string, number[]>>({});
  const [zarrStatus, setZarrStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const abortRef = useRef<AbortController | null>(null);

  const primaryVar = WEATHER_VARIABLES_BY_ID[resolveVarId(primaryVarId)] || WEATHER_VARIABLES[0];
  const secondaryVar = WEATHER_VARIABLES_BY_ID[resolveVarId(secondaryVarId)] || WEATHER_VARIABLES[7];

  const cityPoints = useMemo(
    () =>
      dataset.cityForecasts.map((c) => ({
        name: c.name,
        lat: c.lat,
        lon: c.lon,
      })),
    [dataset.cityForecasts]
  );

  useEffect(() => {
    if (!cityPoints.length) return;
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setZarrStatus('loading');

    const pId = resolveVarId(primaryVarId);
    const sId = resolveVarId(secondaryVarId);

    Promise.all([
      fetchZarrTimeseries({ variable: pId, points: cityPoints, signal: ac.signal }),
      pId === sId
        ? Promise.resolve(null)
        : fetchZarrTimeseries({ variable: sId, points: cityPoints, signal: ac.signal }),
    ])
      .then(([primary, secondary]) => {
        if (ac.signal.aborted) return;
        setPrimarySeriesByCity(primary.series);
        setSecondarySeriesByCity(secondary?.series ?? primary.series);
        setZarrStatus('ready');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('zarr city timeseries failed — using bundled zip metrics', err);
        setPrimarySeriesByCity({});
        setSecondarySeriesByCity({});
        setZarrStatus('fallback');
      });

    return () => ac.abort();
  }, [cityPoints, primaryVarId, secondaryVarId]);

  const getCityStepMetric = (city: CityInfo, stepIdx: number, varId: string): number => {
    const zarrId = resolveVarId(varId);
    const fromZarr =
      zarrId === resolveVarId(primaryVarId)
        ? primarySeriesByCity[city.name]
        : zarrId === resolveVarId(secondaryVarId)
          ? secondarySeriesByCity[city.name]
          : undefined;
    if (fromZarr && fromZarr[stepIdx] != null && Number.isFinite(fromZarr[stepIdx])) {
      return fromZarr[stepIdx];
    }

    // Bundled zip / CSV fallback (legacy metric keys)
    const f = city.forecasts?.[stepIdx] || city.forecasts?.[0];
    if (f?.metrics && f.metrics[varId] !== undefined) return f.metrics[varId];
    if (f?.metrics && f.metrics[zarrId] !== undefined) return f.metrics[zarrId];
    if (zarrId === 't2m' || varId === 'temperature_2m') return f?.temperatureC ?? 0;
    if (zarrId === 'wind10m' || varId === 'wind_speed_10m') {
      // zip stored km/h; zarr uses m/s — only hit this path in fallback
      return f?.windKmh ?? 0;
    }
    return 0;
  };

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
        if (sortField === 'name') {
          return sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }

        let valA = 0;
        let valB = 0;
        if (sortField === 'primary') {
          valA = getCityStepMetric(a, currentStepIndex, primaryVarId);
          valB = getCityStepMetric(b, currentStepIndex, primaryVarId);
        } else if (sortField === 'temperature') {
          valA = getCityStepMetric(a, currentStepIndex, 't2m');
          valB = getCityStepMetric(b, currentStepIndex, 't2m');
        } else {
          valA = getCityStepMetric(a, currentStepIndex, 'wind10m');
          valB = getCityStepMetric(b, currentStepIndex, 'wind10m');
        }

        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
  }, [
    dataset.cityForecasts,
    searchQuery,
    sortField,
    sortOrder,
    currentStepIndex,
    primaryVarId,
    secondaryVarId,
    primarySeriesByCity,
    secondarySeriesByCity,
  ]);

  const mmCityName = selectedCity.mmName || BURMESE_CITIES_MAP[selectedCity.name]?.mmName || selectedCity.name;
  const numSteps = Math.max(
    dataset.leadHours.length || 0,
    primarySeriesByCity[selectedCity.name]?.length || 0,
    6
  );

  const primarySeries = useMemo(() => {
    const fromZarr = primarySeriesByCity[selectedCity.name];
    if (fromZarr?.length) return fromZarr;
    return dataset.leadHours.map((_, i) => getCityStepMetric(selectedCity, i, primaryVarId));
  }, [selectedCity, primaryVarId, dataset.leadHours, primarySeriesByCity]);

  const secondarySeries = useMemo(() => {
    const fromZarr = secondarySeriesByCity[selectedCity.name];
    if (fromZarr?.length) return fromZarr;
    return dataset.leadHours.map((_, i) => getCityStepMetric(selectedCity, i, secondaryVarId));
  }, [selectedCity, secondaryVarId, dataset.leadHours, secondarySeriesByCity]);

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

  const curPrimaryVal = primarySeries[currentStepIndex] ?? primarySeries[0];
  const curSecondaryVal = secondarySeries[currentStepIndex] ?? secondarySeries[0];

  return (
    <div className="h-full w-full overflow-y-auto p-4 sm:p-6 pt-36 sm:pt-40 pb-32 text-white">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            forecast.zarr · မြို့ကြီးများ ခန့်မှန်းချက်
          </span>
          <span className="text-xs font-mono text-emerald-400">
            {zarrStatus === 'ready' && `${WEATHER_VARIABLES.length} မျိုး · zarr live`}
            {zarrStatus === 'loading' && 'zarr ဖတ်နေသည်…'}
            {zarrStatus === 'fallback' && 'zip fallback (t2m / wind)'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
              <button
                onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/15 transition cursor-pointer"
                title={sortOrder === 'desc' ? 'ကြီးစဉ်ငယ်လိုက် (High to Low)' : 'ငယ်စဉ်ကြီးလိုက် (Low to High)'}
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>

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

            <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-1">
              <button
                onClick={() => setSortField('primary')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'primary' ? 'bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ZARR_VAR_LABELS_MM[primaryVar.id] || primaryVar.labelMm}
              </button>
              <button
                onClick={() => setSortField('wind')}
                className={`rounded-lg px-2.5 py-1 whitespace-nowrap transition cursor-pointer ${
                  sortField === 'wind' ? 'bg-teal-500/30 text-teal-300 font-semibold border border-teal-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ZARR_VAR_LABELS_MM.wind10m}
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
                        <div className="font-semibold text-xs leading-tight">{mmName}</div>
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

          <div className="lg:col-span-8 rounded-2xl border border-white/15 bg-black/65 p-5 backdrop-blur-2xl flex flex-col gap-4">
            <div className="border-b border-white/10 pb-4">
              <h3 className="font-display text-lg font-bold text-white">
                {mmCityName} · {ZARR_VAR_LABELS_MM[primaryVar.id] || primaryVar.labelMm}
                {' · '}
                {ZARR_VAR_LABELS_MM[secondaryVar.id] || secondaryVar.labelMm}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedCity.state} · တည်နေရာ: {toBurmeseNumber(selectedCity.lat)}°N, {toBurmeseNumber(selectedCity.lon)}°E · ပင်လယ်ရေမျက်နှာပြင်: {selectedCity.elevation}
              </p>
              <p className="text-[11px] text-emerald-400/90 mt-1">
                {zarrStatus === 'ready'
                  ? 'forecast.zarr မှ မြို့ lat/lon နမူနာ (ensemble mean)'
                  : zarrStatus === 'loading'
                    ? 'forecast.zarr ဖတ်နေသည်…'
                    : 'zip / bundled forecast fallback'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
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
                    {WEATHER_VARIABLES.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                        {ZARR_VAR_LABELS_MM[v.id] || v.labelMm} ({v.labelEn}) — {v.unit}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>

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
                    {WEATHER_VARIABLES.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                        {ZARR_VAR_LABELS_MM[v.id] || v.labelMm} ({v.labelEn}) — {v.unit}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="relative w-full overflow-hidden rounded-xl bg-black/40 border border-white/10 p-2">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto overflow-visible">
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
                      <text
                        x={pad.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[10px] font-mono font-semibold"
                        fill={primaryVar.color}
                      >
                        {toBurmeseNumber(pTick)}
                      </text>
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

                <path
                  d={primaryPath}
                  fill="none"
                  stroke={primaryVar.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={secondaryPath}
                  fill="none"
                  stroke={secondaryVar.color}
                  strokeWidth="2.2"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {dataset.leadHours.map((hour, i) => {
                  const cx = getX(i);
                  const pVal = primarySeries[i];
                  const sVal = secondarySeries[i];
                  const cyP = getPrimaryY(pVal);
                  const cyS = getSecondaryY(sVal);
                  const isCurrent = i === currentStepIndex;

                  return (
                    <g key={i}>
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
                      {(numSteps <= 8 || i % Math.ceil(numSteps / 8) === 0 || isCurrent) && (
                        <text
                          x={cx}
                          y={chartH - 12}
                          textAnchor="middle"
                          className={`text-[9px] font-mono ${
                            isCurrent ? 'font-bold fill-emerald-400' : 'fill-slate-400'
                          }`}
                        >
                          {(numSteps <= 8
                            ? getStepTimeWindow(dataset.validTimesUtc, i)?.shortLabel
                            : getStepTimeWindow(dataset.validTimesUtc, i)?.dateLabel) ?? `${hour}h`}
                        </text>
                      )}
                      <circle
                        cx={cx}
                        cy={cyP}
                        r={isCurrent ? 6.5 : numSteps > 8 ? 2.5 : 4.5}
                        fill={primaryVar.color}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-pointer transition-transform hover:scale-125"
                        onClick={() => onSelectStepIndex(i)}
                      />
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
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
                <span className="text-[10px] text-slate-400 block">ခန့်မှန်းချိန်ကာလ</span>
                <span className="font-mono text-[11px] font-bold text-emerald-400 block mt-0.5 leading-snug">
                  {getStepTimeWindow(dataset.validTimesUtc, currentStepIndex)?.label ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/65 p-5 backdrop-blur-2xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h4 className="font-display text-sm font-bold text-white">
                {mmCityName} · {toBurmeseNumber(dataset.leadHours[dataset.leadHours.length - 1] ?? 0)} နာရီ ခန့်မှန်းချက် ဇယား
              </h4>
              <p className="text-xs text-slate-400">
                Zip ထဲမှ ၂ မီတာ အပူချိန် နှင့် ၁၀ မီတာ လေတိုက်နှုန်းသာ
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono">
              Local FCN · offline
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">အချိန်အဆင့်</th>
                  {WEATHER_VARIABLES.map((v) => (
                    <th key={v.id} className="py-2.5 px-3 whitespace-nowrap font-medium" style={{ color: v.color }}>
                      {v.labelMm} ({v.unit})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {dataset.leadHours.map((hour, i) => {
                  const isCurrent = i === currentStepIndex;
                  const win = getStepTimeWindow(dataset.validTimesUtc, i);

                  return (
                    <tr
                      key={i}
                      onClick={() => onSelectStepIndex(i)}
                      className={`cursor-pointer transition hover:bg-white/10 ${
                        isCurrent ? 'bg-emerald-500/15 text-white font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isCurrent && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                          <span className="font-mono text-[11px]">{win?.label ?? `+${hour}h`}</span>
                        </div>
                      </td>
                      {WEATHER_VARIABLES.map((v) => {
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
