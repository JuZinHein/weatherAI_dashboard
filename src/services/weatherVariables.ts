/**
 * Display catalog for forecast.zarr variables (city trends + shared labels).
 * Burmese copy: keep in sync with `ZARR_VAR_LABELS_MM` in zarrApi.ts
 * (that map is the single source used on every page).
 */
import { ZARR_VAR_LABELS_MM } from './zarrApi';

export type WeatherCategoryId =
  | 'temperature'
  | 'pressure'
  | 'humidity'
  | 'wind'
  | 'height';

export interface WeatherCategory {
  id: WeatherCategoryId;
  labelEn: string;
  labelMm: string;
  descriptionMm: string;
}

export const WEATHER_CATEGORIES: WeatherCategory[] = [
  {
    id: 'temperature',
    labelEn: 'Temperature',
    labelMm: 'အပူချိန်',
    descriptionMm: 'forecast.zarr အပူချိန် အလွှာများ',
  },
  {
    id: 'pressure',
    labelEn: 'Pressure',
    labelMm: 'လေဖိအား',
    descriptionMm: 'forecast.zarr လေဖိအား',
  },
  {
    id: 'humidity',
    labelEn: 'Humidity / moisture',
    labelMm: 'စိုထိုင်းဆ',
    descriptionMm: 'forecast.zarr စိုထိုင်းဆ / ရေငွေ့',
  },
  {
    id: 'wind',
    labelEn: 'Wind',
    labelMm: 'လေ',
    descriptionMm: 'forecast.zarr လေတိုက်နှုန်း / လေအစိတ်အပိုင်း',
  },
  {
    id: 'height',
    labelEn: 'Height',
    labelMm: 'လေထုဖိအားအမြင့်',
    descriptionMm: 'forecast.zarr ၅၀၀ hPa လေထုဖိအားအမြင့်',
  },
];

export interface WeatherVariableDef {
  /** Same id as forecast.zarr / MapLibre chips (t2m, wind10m, …) */
  id: string;
  categoryId: WeatherCategoryId;
  labelEn: string;
  /** From ZARR_VAR_LABELS_MM — shared across every page */
  labelMm: string;
  unit: string;
  min: number;
  max: number;
  color: string;
  colorSecondary?: string;
  descriptionEn: string;
  descriptionMm: string;
}

/** All Earth-2 variables available from local forecast.zarr */
export const WEATHER_VARIABLES: WeatherVariableDef[] = [
  {
    id: 't2m',
    categoryId: 'temperature',
    labelEn: 'Temperature 2 m',
    labelMm: ZARR_VAR_LABELS_MM.t2m,
    unit: '°C',
    min: 0,
    max: 45,
    color: '#f59e0b',
    descriptionEn: '2 m air temperature',
    descriptionMm: ZARR_VAR_LABELS_MM.t2m,
  },
  {
    id: 't500',
    categoryId: 'temperature',
    labelEn: 'Temperature 500 hPa',
    labelMm: ZARR_VAR_LABELS_MM.t500,
    unit: '°C',
    min: -40,
    max: 10,
    color: '#fb923c',
    descriptionEn: 'Air temperature at 500 hPa',
    descriptionMm: ZARR_VAR_LABELS_MM.t500,
  },
  {
    id: 'msl',
    categoryId: 'pressure',
    labelEn: 'Mean sea-level pressure',
    labelMm: ZARR_VAR_LABELS_MM.msl,
    unit: 'hPa',
    min: 980,
    max: 1040,
    color: '#38bdf8',
    descriptionEn: 'Mean sea-level pressure',
    descriptionMm: ZARR_VAR_LABELS_MM.msl,
  },
  {
    id: 'q850',
    categoryId: 'humidity',
    labelEn: 'Specific humidity 850 hPa',
    labelMm: ZARR_VAR_LABELS_MM.q850,
    unit: 'g/kg',
    min: 0,
    max: 20,
    color: '#22d3ee',
    descriptionEn: 'Specific humidity at 850 hPa',
    descriptionMm: ZARR_VAR_LABELS_MM.q850,
  },
  {
    id: 'tcwv',
    categoryId: 'humidity',
    labelEn: 'Total column water vapour',
    labelMm: ZARR_VAR_LABELS_MM.tcwv,
    unit: 'kg/m²',
    min: 0,
    max: 70,
    color: '#2dd4bf',
    descriptionEn: 'Total column water vapour',
    descriptionMm: ZARR_VAR_LABELS_MM.tcwv,
  },
  {
    id: 'u10m',
    categoryId: 'wind',
    labelEn: 'U-wind 10 m',
    labelMm: ZARR_VAR_LABELS_MM.u10m,
    unit: 'm/s',
    min: -30,
    max: 30,
    color: '#a78bfa',
    descriptionEn: 'Zonal wind at 10 m',
    descriptionMm: ZARR_VAR_LABELS_MM.u10m,
  },
  {
    id: 'v10m',
    categoryId: 'wind',
    labelEn: 'V-wind 10 m',
    labelMm: ZARR_VAR_LABELS_MM.v10m,
    unit: 'm/s',
    min: -30,
    max: 30,
    color: '#c084fc',
    descriptionEn: 'Meridional wind at 10 m',
    descriptionMm: ZARR_VAR_LABELS_MM.v10m,
  },
  {
    id: 'wind10m',
    categoryId: 'wind',
    labelEn: 'Wind speed 10 m',
    labelMm: ZARR_VAR_LABELS_MM.wind10m,
    unit: 'm/s',
    min: 0,
    max: 40,
    color: '#14b8a6',
    descriptionEn: '10 m wind speed (from u10m & v10m)',
    descriptionMm: ZARR_VAR_LABELS_MM.wind10m,
  },
  {
    id: 'u100m',
    categoryId: 'wind',
    labelEn: 'U-wind 100 m',
    labelMm: ZARR_VAR_LABELS_MM.u100m,
    unit: 'm/s',
    min: -40,
    max: 40,
    color: '#818cf8',
    descriptionEn: 'Zonal wind at 100 m',
    descriptionMm: ZARR_VAR_LABELS_MM.u100m,
  },
  {
    id: 'v100m',
    categoryId: 'wind',
    labelEn: 'V-wind 100 m',
    labelMm: ZARR_VAR_LABELS_MM.v100m,
    unit: 'm/s',
    min: -40,
    max: 40,
    color: '#6366f1',
    descriptionEn: 'Meridional wind at 100 m',
    descriptionMm: ZARR_VAR_LABELS_MM.v100m,
  },
  {
    id: 'z500',
    categoryId: 'height',
    labelEn: 'Geopotential height 500 hPa',
    labelMm: ZARR_VAR_LABELS_MM.z500,
    unit: 'm',
    min: 5000,
    max: 6000,
    color: '#34d399',
    descriptionEn: '500 hPa geopotential height',
    descriptionMm: ZARR_VAR_LABELS_MM.z500,
  },
];

export const WEATHER_VARIABLES_BY_ID: Record<string, WeatherVariableDef> = Object.fromEntries(
  WEATHER_VARIABLES.map((v) => [v.id, v])
);

/** Legacy zip metric ids → zarr ids (bundled cityForecasts still use these) */
export const LEGACY_METRIC_TO_ZARR: Record<string, string> = {
  temperature_2m: 't2m',
  wind_speed_10m: 'wind10m',
};
