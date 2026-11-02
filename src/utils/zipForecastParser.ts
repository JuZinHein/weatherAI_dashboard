import JSZip from 'jszip';
import { ForecastDataset, CityInfo, CsvStepRow } from '../types/forecast';
import { parseNpyBuffer } from './npyParser';
import { sampleGrid } from './geo';
import { DEFAULT_FORECAST_DATA } from '../data/defaultForecast';

export async function parseForecastZip(file: File): Promise<ForecastDataset> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // 1. Read metadata.json
  let metadata = DEFAULT_FORECAST_DATA.metadata;
  const metaEntry = Object.values(loadedZip.files).find((f) => f.name.endsWith('metadata.json'));
  if (metaEntry) {
    try {
      const metaText = await metaEntry.async('text');
      metadata = JSON.parse(metaText);
    } catch (e) {
      console.warn('Failed to parse metadata.json in zip', e);
    }
  }

  // 2. Read CSV rows
  let csvRows: CsvStepRow[] = DEFAULT_FORECAST_DATA.csvRows;
  const csvEntry = Object.values(loadedZip.files).find((f) => f.name.endsWith('all_steps_with_future_flags.csv') || (f.name.endsWith('.csv') && !f.name.includes('future_city')));
  if (csvEntry) {
    try {
      const csvText = await csvEntry.async('text');
      const lines = csvText.trim().split('\n').slice(1);
      csvRows = lines.map((line) => {
        const parts = line.split(',');
        return {
          leadHours: Number(parts[0]) || 0,
          validUtc: parts[1] || '',
          validMyanmar: parts[2] || '',
          city: parts[3] || 'Yangon',
          forecastMode: parts[4] || 'future',
          temperatureC: Number(parts[5]) || 0,
          windKmh: Number(parts[6]) || 0,
          isFuture: parts[7] === 'True',
          hoursAhead: Number(parts[8]) || 0,
          type: parts[9] || 'FCN forecast',
        };
      });
    } catch (e) {
      console.warn('Failed to parse CSV in zip', e);
    }
  }

  // 3. Benchmark Images
  let benchmarkMyanmarMapUrl: string | undefined = undefined;
  const mapImgEntry = Object.values(loadedZip.files).find((f) => f.name.includes('myanmar_forecast') && (f.name.endsWith('.png') || f.name.endsWith('.jpg')));
  if (mapImgEntry) {
    const blob = await mapImgEntry.async('blob');
    benchmarkMyanmarMapUrl = URL.createObjectURL(blob);
  }

  let benchmarkCityTrendUrl: string | undefined = undefined;
  const trendImgEntry = Object.values(loadedZip.files).find((f) => f.name.includes('city_trend') && (f.name.endsWith('.png') || f.name.endsWith('.jpg')));
  if (trendImgEntry) {
    const blob = await trendImgEntry.async('blob');
    benchmarkCityTrendUrl = URL.createObjectURL(blob);
  }

  // 4. Regional Forecast NPZ
  let leadHours = DEFAULT_FORECAST_DATA.leadHours;
  let validTimesUtc = DEFAULT_FORECAST_DATA.validTimesUtc;
  let isFuture = DEFAULT_FORECAST_DATA.isFuture;
  let lats = DEFAULT_FORECAST_DATA.lats;
  let lons = DEFAULT_FORECAST_DATA.lons;
  let temperatureGrid = DEFAULT_FORECAST_DATA.temperatureGrid;
  let windGrid = DEFAULT_FORECAST_DATA.windGrid;

  let minTemp = 999;
  let maxTemp = -999;
  let minWind = 999;
  let maxWind = -999;

  const npzEntry = Object.values(loadedZip.files).find((f) => f.name.endsWith('regional_forecast.npz') || f.name.endsWith('.npz'));
  if (npzEntry) {
    try {
      const npzBuffer = await npzEntry.async('arraybuffer');
      const innerZip = new JSZip();
      const loadedNpz = await innerZip.loadAsync(npzBuffer);

      // Temperature grid
      const tempEntry = Object.values(loadedNpz.files).find((f) => f.name.endsWith('temperature_c.npy'));
      const windEntry = Object.values(loadedNpz.files).find((f) => f.name.endsWith('wind_kmh.npy'));
      const leadEntry = Object.values(loadedNpz.files).find((f) => f.name.endsWith('lead_hours.npy'));
      const validEntry = Object.values(loadedNpz.files).find((f) => f.name.endsWith('valid_time_utc.npy'));
      const futureEntry = Object.values(loadedNpz.files).find((f) => f.name.endsWith('is_future_at_display.npy'));

      if (leadEntry) {
        const leadBuf = await leadEntry.async('arraybuffer');
        const parsed = parseNpyBuffer(leadBuf);
        if (parsed.data instanceof BigInt64Array || parsed.data instanceof Float32Array || parsed.data instanceof Float64Array) {
          leadHours = Array.from(parsed.data as any).map(Number);
        }
      }

      if (validEntry) {
        const validBuf = await validEntry.async('arraybuffer');
        const parsed = parseNpyBuffer(validBuf);
        if (Array.isArray(parsed.data)) {
          validTimesUtc = parsed.data;
        }
      }

      if (futureEntry) {
        const futBuf = await futureEntry.async('arraybuffer');
        const parsed = parseNpyBuffer(futBuf);
        if (parsed.data instanceof Uint8Array) {
          isFuture = Array.from(parsed.data).map(Boolean);
        }
      }

      if (tempEntry && windEntry) {
        const tempBuf = await tempEntry.async('arraybuffer');
        const windBuf = await windEntry.async('arraybuffer');
        const pTemp = parseNpyBuffer(tempBuf);
        const pWind = parseNpyBuffer(windBuf);

        // Shape expected: [steps, 81, 41]
        const steps = pTemp.shape[0] || leadHours.length || 6;
        const numLats = pTemp.shape[1] || 81;
        const numLons = pTemp.shape[2] || 41;

        const fTemps = pTemp.data as Float32Array;
        const fWinds = pWind.data as Float32Array;

        const newTempGrid: number[][][] = [];
        const newWindGrid: number[][][] = [];

        let offset = 0;
        for (let t = 0; t < steps; t++) {
          const stepTemp: number[][] = [];
          const stepWind: number[][] = [];
          for (let r = 0; r < numLats; r++) {
            const rowTemp: number[] = [];
            const rowWind: number[] = [];
            for (let c = 0; c < numLons; c++) {
              const tv = Number(fTemps[offset].toFixed(2));
              const wv = Number(fWinds[offset].toFixed(2));
              offset++;
              rowTemp.push(tv);
              rowWind.push(wv);
              if (tv < minTemp) minTemp = tv;
              if (tv > maxTemp) maxTemp = tv;
              if (wv < minWind) minWind = wv;
              if (wv > maxWind) maxWind = wv;
            }
            stepTemp.push(rowTemp);
            stepWind.push(rowWind);
          }
          newTempGrid.push(stepTemp);
          newWindGrid.push(stepWind);
        }

        temperatureGrid = newTempGrid;
        windGrid = newWindGrid;
      }
    } catch (err) {
      console.warn('Failed to parse inner regional_forecast.npz', err);
    }
  }

  if (minTemp === 999) {
    minTemp = DEFAULT_FORECAST_DATA.stats.minTemp;
    maxTemp = DEFAULT_FORECAST_DATA.stats.maxTemp;
    minWind = DEFAULT_FORECAST_DATA.stats.minWind;
    maxWind = DEFAULT_FORECAST_DATA.stats.maxWind;
  }

  // 5. Compute city forecasts across all lead times using the grid
  const cityForecasts = DEFAULT_FORECAST_DATA.cityForecasts.map((city) => {
    const forecasts = leadHours.map((lh, t) => {
      const stepGrid = temperatureGrid[t] || temperatureGrid[0];
      const windStepGrid = windGrid[t] || windGrid[0];
      const temp = sampleGrid(stepGrid, city.lat, city.lon);
      const wind = sampleGrid(windStepGrid, city.lat, city.lon);
      return {
        leadHours: lh,
        validUtc: validTimesUtc[t] || '',
        temperatureC: temp,
        windKmh: wind,
        isFuture: isFuture[t] ?? true,
      };
    });
    return {
      ...city,
      forecasts,
    };
  });

  return {
    metadata,
    leadHours,
    validTimesUtc,
    isFuture,
    stats: {
      minTemp,
      maxTemp,
      minWind,
      maxWind,
    },
    lats,
    lons,
    temperatureGrid,
    windGrid,
    csvRows,
    cityForecasts,
    benchmarkMyanmarMapUrl,
    benchmarkCityTrendUrl,
  };
}
