import React, { useEffect, useMemo, useState } from 'react';
import { CityInfo } from '../types/forecast';
import {
  fetchZarrMeta,
  fetchZarrTimeseries,
  type ZarrMeta,
} from '../services/zarrApi';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { X, Thermometer, Wind } from 'lucide-react';

interface CityWeatherPopup3DProps {
  city: CityInfo;
  modelId: string;
  leadHour: number;
  onClose: () => void;
  onSelectCity?: (city: CityInfo) => void;
  isSelectedCity?: boolean;
}

const DISPLAY_VARIABLES = ['t2m', 't1000', 'wind10m', 'msl', 'q850', 'tcwv'];

export const CityWeatherPopup3D: React.FC<CityWeatherPopup3DProps> = ({
  city,
  modelId,
  leadHour,
  onClose,
}) => {
  const [meta, setMeta] = useState<ZarrMeta | null>(null);
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
  const region = BURMESE_CITIES_MAP[city.name]?.region || city.state;

  useEffect(() => {
    const controller = new AbortController();
    setMeta(null);
    setSeries({});
    setLoadError('');
    setIsLoading(true);
    if (!modelId) {
      setIsLoading(false);
      return () => controller.abort();
    }

    fetchZarrMeta(modelId, controller.signal)
      .then(async (result) => {
        const variables = DISPLAY_VARIABLES.filter((id) =>
          result.available_variables.includes(id)
        );
        if (!variables.length) {
          throw new Error(`No supported weather fields are available in ${modelId} Zarr.`);
        }
        const results = await Promise.all(
          variables.map((variable) =>
            fetchZarrTimeseries({
              modelId,
              variable,
              points: [{ name: city.name, lat: city.lat, lon: city.lon }],
              signal: controller.signal,
            })
          )
        );
        if (controller.signal.aborted) return;
        setMeta(result);
        setSeries(Object.fromEntries(results.map((item) => [item.variable, item.series[city.name] ?? []])));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [city.lat, city.lon, city.name, modelId]);

  const stepIndex = useMemo(() => {
    if (!meta?.lead_hours.length) return -1;
    return meta.lead_hours.reduce((bestIndex, hour, index) =>
      Math.abs(hour - leadHour) < Math.abs(meta.lead_hours[bestIndex] - leadHour)
        ? index
        : bestIndex,
    0);
  }, [leadHour, meta]);

  const variables = useMemo(() => {
    if (!meta) return [];
    return DISPLAY_VARIABLES
      .filter((id) => meta.available_variables.includes(id) && series[id]?.length)
      .map((id) => ({
        id,
        label: id === 'q850'
          ? '၈၅၀ hPa သီးခြားစိုထိုင်းဆ'
          : id === 'tcwv'
            ? 'လေထုအတွင်း စုစုပေါင်းရေငွေ့ပမာဏ'
            : id === 'msl'
              ? BURMESE_STRINGS.pressure
            : meta.variables[id]?.label ?? id,
        value: series[id][stepIndex],
        unit: meta.variables[id]?.unit ?? '',
      }))
      .filter((item) => item.value != null && Number.isFinite(item.value));
  }, [meta, series, stepIndex]);

  const temperatureVariable = series.t2m?.length ? 't2m' : series.t1000?.length ? 't1000' : null;
  const temperatureSeries = temperatureVariable ? series[temperatureVariable] : [];
  const windMetric = variables.find((item) => item.id === 'wind10m');
  const validTime = meta?.initialization_utc && stepIndex >= 0
    ? new Date(new Date(meta.initialization_utc).getTime() + (meta.lead_hours[stepIndex] ?? 0) * 3600_000)
    : null;
  const temperatureLabel = temperatureVariable === 't1000'
    ? '၁၀၀၀ hPa အပူချိန်'
    : BURMESE_STRINGS.temperature;

  return (
    <div className="absolute top-24 left-6 z-40 w-80 sm:w-96 rounded-2xl border border-white/20 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-2xl text-white font-burmese animate-in fade-in duration-150">
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-display text-lg font-bold text-white">
              {mmName} <span className="text-xs font-normal text-slate-400">({city.name})</span>
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-emerald-400">{region}</p>
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

      <div className="mt-3 text-[11px] text-emerald-300">
        {meta?.model_label ?? modelId} · Zarr forecast
      </div>

      {isLoading ? (
        <div role="status" className="mt-4 text-xs text-slate-300">
          Zarr ဒေတာကို ဖတ်ရှုနေပါသည်…
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-4 rounded-lg border border-amber-400/25 bg-amber-950/40 p-3 text-xs text-amber-100">
          Zarr ဒေတာကို ဖတ်မရပါ: {loadError}
        </div>
      ) : (
        <>
          {temperatureVariable && temperatureSeries[stepIndex] != null && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-300">
                <Thermometer className="h-3.5 w-3.5" />
                <span>{temperatureLabel}</span>
              </div>
              <div className="mt-1 font-display text-2xl font-bold text-white">
                {toBurmeseNumber(temperatureSeries[stepIndex].toFixed(1))}°C
              </div>
              {temperatureVariable === 't2m' && (
                <div className="text-[11px] text-amber-200/80">Zarr · မြေပြင်အထက် ၂ မီတာ</div>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            {variables.filter((item) => item.id !== temperatureVariable && item.id !== 'wind10m').map((item) => (
              <div key={item.id} className="rounded-lg border border-white/5 bg-white/5 p-2">
                <div className="text-[10px] text-slate-400">{item.label}</div>
                <div className="mt-0.5 font-mono font-semibold text-white">
                  {toBurmeseNumber(item.value.toFixed(2))} <span className="text-[9px]">{item.unit}</span>
                </div>
              </div>
            ))}
            {windMetric && (
              <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <Wind className="h-3 w-3" />
                  {BURMESE_STRINGS.windSpeed}
                </div>
                <div className="mt-0.5 font-mono font-semibold text-white">
                  {toBurmeseNumber(windMetric.value.toFixed(2))} m/s
                </div>
              </div>
            )}
          </div>

          {!variables.length && !temperatureVariable && (
            <div className="mt-4 text-xs text-slate-300">ဤမြို့အတွက် ပြသနိုင်သော Zarr field မရှိပါ။</div>
          )}

          {temperatureVariable && temperatureSeries.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="mb-2 text-[11px] font-semibold text-slate-300">
                {meta?.variables[temperatureVariable]?.label ?? temperatureVariable} · Zarr
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {meta?.lead_hours.map((hour, index) => (
                  <div
                    key={`${hour}-${index}`}
                    className={`flex min-w-[3.6rem] shrink-0 flex-col items-center rounded-lg px-1 py-1.5 text-center ${
                      index === stepIndex ? 'bg-emerald-600 text-white ring-1 ring-emerald-400' : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    <span className="text-[8px] font-mono">{hour}h</span>
                    <span className="mt-0.5 text-xs font-semibold">
                      {Number.isFinite(temperatureSeries[index])
                        ? `${toBurmeseNumber(temperatureSeries[index].toFixed(1))}°`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-[10px] text-slate-400">Zarr forecast အချိန်</div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-emerald-300">
              {validTime && !Number.isNaN(validTime.getTime()) ? validTime.toISOString() : '—'}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
