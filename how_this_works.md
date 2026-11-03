# How this works

Entry points: `server.ts` (Express + Vite), `src/App.tsx` (UI), `notebook/` (GPU export → zip).

Local **zip-first** showcase. The browser never calls NVIDIA NIM. Forecasts and storm flags are either:

1. Bundled under `public/forecast_data/` + `src/data/`, or  
2. Loaded from a Colab/Kaggle `.zip` (drag-drop / upload).

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Open use

Public repo, MIT for this showcase code. Anyone can clone and run without API keys.  
NVIDIA FourCastNet / Earth2Studio / GFS stay under their own terms.

## Layout

```text
Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  server.ts                    Express + Vite; GET /api/storm-alert
  notebook/                    GPU notebooks that build the forecast zip
  public/forecast_data/        sample storm_alert.json, layers, configs
  public/textures/             globe / map imagery
  src/
    App.tsx                    city tour playback, zip drop, storm state
    components/
      SatelliteGlobe3D.tsx     3D Earth, city popup, rotate speed
      ForecastMap2D.tsx        2D radar — Myanmar border only
      CityForecastPanel.tsx    city trends / table
      CityWeatherPopup3D.tsx   auto city card
      CycloneWarningCard.tsx   storm HUD
      TimelineControls.tsx     time-window scrubber
    data/                      defaultForecast + forecastData.json
    utils/
      zipForecastParser.ts     parse zip (+ storm_alert.json)
      forecastTime.ts          Burmese date windows
      burmese.ts               digits / copy
      geo.ts                   Myanmar border, sampling
```

## End-to-end flow

```text
NOAA GFS (73 ch, 0.25°)
        │
        ▼
Earth2Studio + NVIDIA FourCastNet   [GPU notebook]
        │
        ▼
Crop Myanmar  9–29°N, 92–102°E
        │
        ├─ temp / wind grids → regional_forecast.npz
        ├─ BoB wind scan ≥ 65 km/h → storm_alert.json
        └─ CSV / PNG / metadata
        │
        ▼
ZIP  →  drop into showcase
        │
        ▼
React UI (globe / 2D map / cities) + cyclone card
```

## Predictions vs storm alert

| Output | From |
| --- | --- |
| 2 m temperature, 10 m wind | **NVIDIA FourCastNet** (GFS IC) |
| `storm_alert.json` | Notebook **rule** on FCN wind in Lat 10–22 / Lon 92–96; active if peak ≥ **65 km/h** |
| Showcase HUD | Reads JSON only — **no** live re-scan of grids in the browser |

Honest line for demos: *“Forecast fields from NVIDIA FourCastNet; cyclone banner is a Bay of Bengal wind threshold on that forecast.”*

## Zip contract

| File | Role |
| --- | --- |
| `regional_forecast.npz` | `temperature_c`, `wind_kmh`, lat/lon, lead hours |
| `metadata.json` | run provenance |
| `storm_alert.json` | cyclone HUD payload (optional) |
| `all_steps_with_future_flags.csv` | city/time table |
| `myanmar_forecast.png` / `city_trend.png` | optional benchmarks |

Parser: `src/utils/zipForecastParser.ts`. Missing `storm_alert.json` → no override from that zip.

## Showcase behaviour

| Feature | Behaviour |
| --- | --- |
| Time UI | Windows like `၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)` via `forecastTime.ts` |
| Playback | Steps through windows; after last step → **next city** + reopen popup |
| City popup | Opens on start / city change; close with X until city changes again |
| 2D map | Myanmar national border only (no neighbor border overlays) |
| Globe | Auto-rotate with speed slider; slower default |
| Storm | Bundled `GET /api/storm-alert` on load; zip can replace in-memory |

Keyboard: `Space` play/pause · `←`/`→` step · `F` fullscreen.

## Server

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/storm-alert` | `public/forecast_data/storm_alert.json` |

## Bounds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29**, Lon **92–102** |
| Lead hours | **0, 6, 12, 18, 24, 30** (shown as date windows) |
| BoB alert box | Lat **10–22**, Lon **92–96** |
| Cyclone wind | **≥ 65 km/h** |

## What to edit

| Goal | Touch |
| --- | --- |
| UI / Burmese / views | `src/App.tsx`, `src/components/*`, `src/utils/burmese.ts` |
| Time window labels | `src/utils/forecastTime.ts` |
| Zip ingest / storm from zip | `src/utils/zipForecastParser.ts` |
| Export / FCN / alert scan | `notebook/*` |
| Bundled sample | `public/forecast_data/*`, `src/data/forecastData.json` |
