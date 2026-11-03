export interface ForecastMetadata {
  model: string;
  forecast_mode: string;
  initialization_utc: string;
  total_rollout_hours: number;
  requested_hours_ahead: number;
  requested_at_utc: string;
  requested_target_utc: string;
  display_generated_utc: string;
  final_valid_utc: string;
  final_valid_myanmar: string;
  future_row_count: number;
  city: string;
  initial_conditions: string;
  gfs_initial_state_url: string;
  ai_inference: boolean;
  synthetic_inputs: boolean;
  completed_utc: string;
  end_to_end_seconds: number;
  gpu: string;
  grid_lat: number;
  grid_lon: number;
  earth2studio_version: string;
  torch_version: string;
  locally_validated: boolean;
  climate_projection: boolean;
}

export interface CityForecastStep {
  leadHours: number;
  validUtc: string;
  temperatureC: number;
  windKmh: number;
  isFuture: boolean;
  metrics?: Record<string, number>;
}

export interface CityInfo {
  name: string;
  mmName: string;
  lat: number;
  lon: number;
  elevation: string;
  state: string;
  forecasts: CityForecastStep[];
}

export interface CsvStepRow {
  leadHours: number;
  validUtc: string;
  validMyanmar: string;
  city: string;
  forecastMode: string;
  temperatureC: number;
  windKmh: number;
  isFuture: boolean;
  hoursAhead: number;
  type: string;
}

export interface ForecastDataset {
  metadata: ForecastMetadata;
  leadHours: number[];
  validTimesUtc: string[];
  isFuture: boolean[];
  stats: {
    minTemp: number;
    maxTemp: number;
    minWind: number;
    maxWind: number;
  };
  lats: number[];
  lons: number[];
  temperatureGrid: number[][][]; // [step][latRow][lonCol]
  windGrid: number[][][];
  csvRows: CsvStepRow[];
  cityForecasts: CityInfo[];
  benchmarkMyanmarMapUrl?: string;
  benchmarkCityTrendUrl?: string;
  stormAlert?: StormAlert | null;
}

export type ViewMode = 'satellite_radar' | 'globe_3d' | 'city_trends';
export type MapLayer = 'temperature' | 'wind' | 'satellite' | string;

export interface StormAlert {
  alert_active: boolean;
  severity: string;
  region: string;
  region_mm: string;
  max_sustained_wind_kmh: number;
  threshold_kmh: number;
  coordinates: {
    lat: number;
    lon: number;
  };
  timestamp: string;
  lead_hour: number;
  advisory_en: string;
  advisory_mm: string;
  generated_at: string;
}

export interface ForecastConfigStep {
  lead_hour: number;
  valid_time_utc: string;
  valid_time_myanmar: string;
  temperature_png: string;
  wind_png: string;
  min_temp_c: number;
  max_temp_c: number;
  max_wind_kmh: number;
}

export interface ForecastConfig {
  model: string;
  initialization_utc: string;
  updated_at: string;
  bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    leaflet_bounds: [[number, number], [number, number]];
  };
  colormaps: {
    temperature: string;
    wind: string;
  };
  steps: ForecastConfigStep[];
}
