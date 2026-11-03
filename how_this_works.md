# NVIDIA FourCastNet Myanmar AI Weather Showcase

Entry points: `server.ts` (Express + Vite), `backend/fourcastnet_pipeline.py` (forecast job), `src/App.tsx` (UI).

Offline / demo-ready weather showcase for Myanmar. Backend pulls (or falls back from) GFS → FourCastNet → crops to Myanmar → writes PNG overlays + JSON. Frontend plays those assets on a 3D globe / 2D map with city metrics and a cyclone alert HUD.

Run with `bun install` then `bun run dev` (or `npm` / `tsx server.ts`). App listens on port **3000**.

## Layout

```text
NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  server.ts                    Express API + Vite middleware
  backend/
    fourcastnet_pipeline.py    6-step forecast pipeline
    requirements.txt
  scripts/
    generate_layers.ts         PNG fallback if Python/matplotlib missing
    run_cron.sh                cron every 6h (03:30, 09:30, 15:30, 21:30 UTC)
  public/forecast_data/        live assets the UI reads
    layers/temp_XXh.png        temperature overlays
    layers/wind_XXh.png        wind overlays
    forecast_config.json       step list + bounds + PNG paths
    forecast_config.js         same config as window.FORECAST_CONFIG
    storm_alert.json           cyclone HUD payload
    regional_forecast.npz      optional grid cache
    npz_extracted/             lat/lon/temp/wind .npy
  src/
    App.tsx                    view mode, playback, zip drop, alert poll
    components/                globe, 2D map, dual map, city panel, modals
    data/                      defaultForecast + bundled forecastData.json
    utils/                     zip / npy parsers, geo, Burmese strings
  .env.example                 NGC_API_KEY
```

Pre-baked assets under `public/forecast_data/` mean the UI works **without** a live NGC key. Pipeline regenerates them when you trigger it or cron runs.

## Flow

```text
NOAA GFS (73 ch, 0.25°)
        │
        ▼
earth2studio ingest          [Step 1]
        │
        ▼
NVIDIA NIM FourCastNet v2    [Step 2]  tensor [1, 73, 721, 1440]
        │
        ▼
Crop Myanmar box             [Step 3]  Lat 9–29°N, Lon 92–102°E  (~81×41)
        │
        ▼
matplotlib PNG overlays      [Step 4]  temp RdYlBu_r · wind viridis
        │
        ▼
forecast_config.js/json      [Step 5]  written into public/forecast_data/
        │
        ▼
Bay of Bengal wind scan      [Step 6]  > 65 km/h → storm_alert.json
        │
        ▼
React UI (globe / map / cities) + cyclone card
```

If `earth2studio` / NGC / matplotlib is missing, the Python job falls back to cached `src/data/forecastData.json` and/or `scripts/generate_layers.ts`. Showcase still runs.

## Pipeline steps

| Step | What | Output |
| ---: | --- | --- |
| 1 | Detect latest GFS cycle (~4h lag), pull 73 channels via earth2studio | global state tensor |
| 2 | Call NIM `fourcastnet-v2` with NGC key; 6 leads × 6h → 0…30h | temp + wind grids |
| 3 | Crop to Myanmar bounds; optional `--simulate-cyclone` injects BoB vortex | 81×41 regional grids |
| 4 | Transparent PNGs, axes/margins stripped for Leaflet bounds | `layers/temp_XXh.png`, `wind_XXh.png` |
| 5 | Write step timestamps, PNG URLs, bounds | `forecast_config.json` + `.js` |
| 6 | Scan BoB (Lat 10–22, Lon 92–96); wind > 65 km/h | `storm_alert.json` |

Manual run:

```bash
python3 backend/fourcastnet_pipeline.py
python3 backend/fourcastnet_pipeline.py --simulate-cyclone
python3 backend/fourcastnet_pipeline.py --api-key YOUR_NGC_KEY
```

Cron (from `scripts/run_cron.sh`):

```cron
30 3,9,15,21 * * * /bin/bash /path/to/NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/scripts/run_cron.sh >> /var/log/fourcastnet_cron.log 2>&1
```

## Server API (`server.ts`)

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/forecast-config` | reads `forecast_config.json` |
| `GET` | `/api/storm-alert` | reads `storm_alert.json` (or safe default) |
| `POST` | `/api/storm-alert/simulate` | body `{ enableCyclone }` toggles HUD for demos |
| `GET` | `/api/pipeline/status` | running flag, last output, key present, schedule text |
| `POST` | `/api/pipeline/set-key` | body `{ apiKey }` sets NGC key in-process |
| `POST` | `/api/pipeline/trigger` | body `{ simulateCyclone }` runs Python, falls back to `generate_layers.ts` |

UI Architecture modal calls these. Storm alert is polled every **15s** from `App.tsx`.

## Frontend

Default view: **3D satellite globe**. Playback auto-advances lead hours (0, 6, 12, 18, 24, 30).

| View mode | Component | Job |
| --- | --- | --- |
| `globe_3d` | `SatelliteGlobe3D` | Earth texture + city pins / popups |
| `satellite_radar` | `ForecastMap2D` | 2D Myanmar map + temp/wind layer PNGs |
| `dual_fcn` | `DualFcnMap` | side-by-side FCN layers |
| `city_trends` | `CityForecastPanel` | per-city temp/wind series |

Other pieces:

- `TimelineControls` — play / speed / loop / step  
- `CycloneWarningCard` — when `storm_alert.alert_active`  
- `DataIngestModal` + window zip drop — load a custom forecast `.zip` via `zipForecastParser`  
- `ArchitecturePipelineModal` — show pipeline, set key, trigger run, copy cron  
- Burmese copy via `utils/burmese.ts`

Keyboard: `Space` play/pause · `←`/`→` step · `F` fullscreen.

Dataset shape is `ForecastDataset` in `src/types/forecast.ts` (grids `[step][lat][lon]`, city forecasts, metadata). Defaults load from `src/data/defaultForecast.ts`; custom zip/localStorage can override until reset.

## Bounds & thresholds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29**, Lon **92–102** |
| Leaflet bounds | `[[9, 92], [29, 102]]` |
| Grid step | **0.25°** → ~**81 × 41** |
| Lead hours | **0, 6, 12, 18, 24, 30** |
| BoB alert box | Lat **10–22**, Lon **92–96** |
| Cyclone wind | **> 65 km/h** (IMD / DMH cyclonic storm floor) |
| Temp colormap | `RdYlBu_r` (−5…38 °C scale in renderer) |
| Wind colormap | `viridis` (0…65 km/h scale in renderer) |
| NIM endpoint | `https://ai.api.nvidia.com/v1/genai/nvidia/fourcastnet-v2` |

## Env

| Name | Need | Meaning |
| --- | --- | --- |
| `NGC_API_KEY` | optional for demo | NVIDIA NIM FourCastNet auth |
| `NIM_ENDPOINT` | optional | override default FourCastNet v2 URL |

Copy `.env.example` → `.env` for local keys. Without `NGC_API_KEY`, pipeline still formats assets from cache so the showcase stays demoable.

## What to edit next (typical)

| Goal | Touch |
| --- | --- |
| UI / Burmese / views | `src/App.tsx`, `src/components/*`, `src/utils/burmese.ts` |
| Forecast math / crop / alert | `backend/fourcastnet_pipeline.py` |
| API / trigger / serve | `server.ts` |
| Layer look without Python | `scripts/generate_layers.ts` |
| Bundled offline sample | `src/data/forecastData.json`, `public/forecast_data/*` |
