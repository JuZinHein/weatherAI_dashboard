/**
 * Variables that actually exist in the local FCN zip / bundled forecast grids.
 * FourCastNet exports t2m + 10 m wind only in this showcase — do not invent extras.
 */

export type WeatherCategoryId = 'temperature' | 'wind';

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
    descriptionMm: 'NVIDIA FourCastNet မှ တိုက်ရိုက်ထုတ်သော ၂ မီတာ အပူချိန်',
  },
  {
    id: 'wind',
    labelEn: 'Wind',
    labelMm: 'လေတိုက်နှုန်း',
    descriptionMm: 'NVIDIA FourCastNet မှ တိုက်ရိုက်ထုတ်သော ၁၀ မီတာ လေတိုက်နှုန်း',
  },
];

export interface WeatherVariableDef {
  id: string;
  categoryId: WeatherCategoryId;
  labelEn: string;
  labelMm: string;
  unit: string;
  min: number;
  max: number;
  color: string;
  colorSecondary?: string;
  descriptionEn: string;
  descriptionMm: string;
}

/** Real local forecast fields only (zip / regional_forecast.npz). */
export const WEATHER_VARIABLES: WeatherVariableDef[] = [
  {
    id: 'temperature_2m',
    categoryId: 'temperature',
    labelEn: 'Temperature (2 m)',
    labelMm: '၂ မီတာ အပူချိန်',
    unit: '°C',
    min: 0,
    max: 45,
    color: '#f59e0b',
    descriptionEn: '2 m air temperature from local NVIDIA FourCastNet export',
    descriptionMm: 'ဒေသတွင်း NVIDIA FourCastNet zip မှ ၂ မီတာ အပူချိန်',
  },
  {
    id: 'wind_speed_10m',
    categoryId: 'wind',
    labelEn: 'Wind Speed (10 m)',
    labelMm: '၁၀ မီတာ လေတိုက်နှုန်း',
    unit: 'km/h',
    min: 0,
    max: 120,
    color: '#14b8a6',
    descriptionEn: '10 m wind speed from local NVIDIA FourCastNet export',
    descriptionMm: 'ဒေသတွင်း NVIDIA FourCastNet zip မှ ၁၀ မီတာ လေတိုက်နှုန်း',
  },
];

export const WEATHER_VARIABLES_BY_ID: Record<string, WeatherVariableDef> = Object.fromEntries(
  WEATHER_VARIABLES.map((v) => [v.id, v])
);
