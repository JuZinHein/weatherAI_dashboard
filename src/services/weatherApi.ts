/**
 * Offline-only helper. This showcase does not call Open-Meteo, NIM, or any remote weather API.
 * City values come from the local zip / bundled forecast grids (temperatureC + windKmh).
 */

import { CityForecastStep, CityInfo } from '../types/forecast';

/** Returns the city's already-loaded local forecast steps (no network). */
export async function fetchLiveCityForecast(
  city: CityInfo,
  leadHours: number[] = [0, 6, 12, 18, 24, 30]
): Promise<CityForecastStep[]> {
  return leadHours.map((h, i) => {
    const existing = city.forecasts?.[i];
    return {
      leadHours: h,
      validUtc: existing?.validUtc ?? new Date().toISOString(),
      temperatureC: existing?.temperatureC ?? 0,
      windKmh: existing?.windKmh ?? 0,
      isFuture: h > 0,
      metrics: {
        temperature_2m: existing?.temperatureC ?? 0,
        wind_speed_10m: existing?.windKmh ?? 0,
      },
    };
  });
}
