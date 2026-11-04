/** Client for the local forecast.zarr field API (proxied via /api/zarr). */

export type ZarrVarMeta = {
  label: string;
  unit: string;
  cmap: string;
  available?: boolean;
  note?: string;
};

export type ZarrMeta = {
  model: string;
  model_label: string;
  model_short: string;
  source_relative: string;
  has_ensemble: boolean;
  initialization_utc: string;
  lead_hours: number[];
  ensemble_size: number;
  available_variables: string[];
  variables: Record<string, ZarrVarMeta>;
  grid_shape: number[];
  lat_range: number[];
  lon_range: number[];
};

export type ZarrFieldPart = {
  id: string;
  geo_extent: { west: number; east: number; north: number; south: number };
  values: number[][];
  shape: number[];
  lats?: number[];
  lons?: number[];
};

export type ZarrField = {
  variable: string;
  label: string;
  unit: string;
  cmap: string;
  lead_hour: number;
  ensemble: string;
  valid_utc: string;
  initialization_utc: string;
  vmin: number;
  vmax: number;
  shape: number[];
  lats: number[];
  lons: number[];
  values: number[][];
  parts?: ZarrFieldPart[];
  geo_extent?: { west: number; east: number; north: number; south: number };
  dual?: boolean;
};

/**
 * Shared Burmese labels for every page (map chips, city trends, …).
 * Single source of truth — keep in sync across satellite-radar + city trends.
 */
export const ZARR_VAR_LABELS_MM: Record<string, string> = {
  t2m: 'မြေပြင်အထက် ၂ မီတာ အပူချိန်',
  t500: '၅၀၀ hPa အပူချိန်',
  msl: 'ပင်လယ်ရေမျက်နှာပြင် လေဖိအား',
  q850: '၈၅၀ hPa သီးခြားစိုထိုင်းဆ',
  tcwv: 'လေထုအတွင်း စုစုပေါင်းရေငွေ့ပမာဏ',
  u10m: '၁၀ မီတာ အရှေ့-အနောက် လေတိုက်နှုန်း',
  v10m: '၁၀ မီတာ တောင်-မြောက် လေတိုက်နှုန်း',
  wind10m: '၁၀ မီတာ လေတိုက်နှုန်း',
  u100m: '၁၀၀ မီတာ အရှေ့-အနောက် လေတိုက်နှုန်း',
  v100m: '၁၀၀ မီတာ တောင်-မြောက် လေတိုက်နှုန်း',
  z500: '၅၀၀ hPa လေထုဖိအားအမြင့်',
};

export async function fetchZarrMeta(signal?: AbortSignal): Promise<ZarrMeta> {
  const res = await fetch('/api/zarr/meta?model=earth2', { signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`zarr meta ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchZarrField(opts: {
  variable: string;
  leadHour: number;
  ensemble?: string;
  bbox?: { west: number; south: number; east: number; north: number } | null;
  signal?: AbortSignal;
}): Promise<ZarrField> {
  const params = new URLSearchParams({
    model: 'earth2',
    variable: opts.variable,
    region: 'global',
    lead_hour: String(opts.leadHour),
    ensemble: opts.ensemble ?? 'mean',
  });
  if (opts.bbox) {
    const { west, south, east, north } = opts.bbox;
    params.set('bbox', `${west},${south},${east},${north}`);
  }
  const res = await fetch(`/api/zarr/field?${params}`, { signal: opts.signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`zarr field ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export type ZarrTimeseries = {
  model: string;
  variable: string;
  label: string;
  unit: string;
  ensemble: string;
  initialization_utc: string;
  lead_hours: number[];
  points: { name: string; lat: number; lon: number; grid_lat: number; grid_lon: number }[];
  series: Record<string, number[]>;
};

/** City point timeseries for one variable across all lead hours */
export async function fetchZarrTimeseries(opts: {
  variable: string;
  points: { name: string; lat: number; lon: number }[];
  ensemble?: string;
  signal?: AbortSignal;
}): Promise<ZarrTimeseries> {
  const points = opts.points
    .map((p) => `${p.name}:${p.lat}:${p.lon}`)
    .join(';');
  const params = new URLSearchParams({
    model: 'earth2',
    variable: opts.variable,
    ensemble: opts.ensemble ?? 'mean',
    points,
  });
  const res = await fetch(`/api/zarr/timeseries?${params}`, { signal: opts.signal });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`zarr timeseries ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function sampleGrid(
  lats: number[],
  lons: number[],
  values: number[][],
  lat: number,
  lon: number
): number | null {
  if (!lats?.length || !lons?.length || !values?.length) return null;
  let ri = 0;
  let best = Infinity;
  for (let i = 0; i < lats.length; i++) {
    const d = Math.abs(lats[i] - lat);
    if (d < best) {
      best = d;
      ri = i;
    }
  }
  let ci = 0;
  best = Infinity;
  for (let i = 0; i < lons.length; i++) {
    const d = Math.abs(lons[i] - lon);
    if (d < best) {
      best = d;
      ci = i;
    }
  }
  const row = values[ri];
  if (!row || row[ci] == null || Number.isNaN(row[ci])) return null;
  return row[ci];
}

export function sampleZarrField(
  field: ZarrField,
  lat: number,
  lon: number
): number | null {
  // Prefer the hemisphere part that contains this longitude (global dual overlays)
  if (Array.isArray(field.parts) && field.parts.length) {
    for (const part of field.parts) {
      const ext = part.geo_extent;
      if (!ext || !part.lats?.length || !part.lons?.length) continue;
      const west = Math.min(ext.west, ext.east);
      const east = Math.max(ext.west, ext.east);
      const south = Math.min(ext.south, ext.north);
      const north = Math.max(ext.south, ext.north);
      if (lon >= west - 0.5 && lon <= east + 0.5 && lat >= south - 0.5 && lat <= north + 0.5) {
        const v = sampleGrid(part.lats, part.lons, part.values, lat, lon);
        if (v != null) return v;
      }
    }
  }
  return sampleGrid(field.lats, field.lons, field.values, lat, lon);
}
