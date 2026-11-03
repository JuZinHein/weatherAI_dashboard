# Local NVIDIA FourCastNet Myanmar AI Weather Showcase

Local-first React + Express showcase for NVIDIA FourCastNet regional forecasts over Myanmar.

Pre-baked assets under `public/forecast_data/` mean the UI runs **offline / without an NGC key**. Optional Python pipeline regenerates layers from GFS + NIM when you want live data. Upload a Colab/Kaggle forecast `.zip` any time.

Deep dive: [`how_this_works.md`](how_this_works.md)

## Requirements

| Need | Notes |
| --- | --- |
| Node.js **20+** | app server + Vite |
| npm | `package-lock.json` is the lockfile |
| Modern browser | WebGL for the 3D globe |
| Python **3.10+** (optional) | only for `backend/fourcastnet_pipeline.py` |
| `NGC_API_KEY` (optional) | only for live NVIDIA NIM inference |

## Quick start (local UI)

```bash
git clone https://github.com/hmtun-ai/Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase.git
cd Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase

cp .env.example .env
# optional: put NGC_API_KEY in .env for live pipeline runs

npm install
npm run dev
```

Open **http://localhost:3000**

| Script | What |
| --- | --- |
| `npm run dev` | Express + Vite on port **3000** |
| `npm run build` | production Vite build → `dist/` |
| `npm start` | same entry as `dev` (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` |

## Layout

```text
Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  server.ts                    Express API + Vite middleware (port 3000)
  backend/
    fourcastnet_pipeline.py    GFS → FCN → Myanmar crop → PNG / JSON
    requirements.txt
  scripts/
    generate_layers.ts         PNG fallback if Python/matplotlib missing
    run_cron.sh                optional 6-hourly cron wrapper
  public/
    forecast_data/             layers, forecast_config, storm_alert
    textures/                  globe / map textures
  src/
    App.tsx                    views, playback, zip drop, alert poll
    components/                globe, 2D map, dual map, city panel, modals
    data/                      bundled default forecast
    utils/                     zip / npy parsers, geo, Burmese strings
  how_this_works.md            architecture notes
  .env.example                 NGC_API_KEY
```

## What you can do in the UI

| Action | How |
| --- | --- |
| Play forecast leads | timeline dock · `Space` play/pause · `←`/`→` step · `F` fullscreen |
| Switch views | 3D globe · 2D satellite/radar · dual FCN · city trends |
| Load a forecast zip | header upload or drag-drop `.zip` (Colab/Kaggle export) |
| Cyclone HUD | driven by `storm_alert.json` (poll every 15s) |
| Trigger pipeline | Architecture modal → set NGC key → run (optional) |

## Forecast zip (Colab / Kaggle)

Export notebooks live next to this project under `Nvidia_Fourcast_Notebook/`:

- `NVIDIA_Earth2_Colab_Export_Myanmar.ipynb`
- `NVIDIA_Earth2_Kaggle_Export_Myanmar.ipynb`

Run on a **GPU** runtime → download `NVIDIA_FCN_Myanmar_*.zip` → drop into the showcase.

Expected zip contents include `regional_forecast.npz`, `metadata.json`, `storm_alert.json`, and map/trend PNGs.

## Optional: regenerate layers locally

```bash
# Python deps (once)
pip install -r backend/requirements.txt

# Demo / cache path (no key required)
python backend/fourcastnet_pipeline.py

# Live NIM path
python backend/fourcastnet_pipeline.py --api-key YOUR_NGC_KEY

# Force Bay of Bengal cyclone overlay for HUD testing
python backend/fourcastnet_pipeline.py --simulate-cyclone
```

Writes into `public/forecast_data/` (`layers/*.png`, `forecast_config.json`, `storm_alert.json`).

Cron example:

```cron
30 3,9,15,21 * * * /bin/bash /path/to/Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/scripts/run_cron.sh >> /var/log/fourcastnet_cron.log 2>&1
```

## API (`server.ts`)

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/forecast-config` | `forecast_config.json` |
| `GET` | `/api/storm-alert` | `storm_alert.json` |
| `POST` | `/api/storm-alert/simulate` | `{ enableCyclone }` demo toggle |
| `GET` | `/api/pipeline/status` | last run / key present |
| `POST` | `/api/pipeline/set-key` | `{ apiKey }` in-process NGC key |
| `POST` | `/api/pipeline/trigger` | `{ simulateCyclone }` runs Python (TS fallback) |

## Bounds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29°N**, Lon **92–102°E** (~0.25°, ~81×41) |
| Lead hours | **0, 6, 12, 18, 24, 30** |
| BoB alert box | Lat **10–22**, Lon **92–96** |
| Cyclone threshold | **> 65 km/h** |

## Env

| Name | Need | Meaning |
| --- | --- | --- |
| `NGC_API_KEY` | optional | NVIDIA NIM FourCastNet auth |
| `NIM_ENDPOINT` | optional | override default FourCastNet v2 URL |

```bash
cp .env.example .env
```

## Notes

- Demo mode uses cached / bundled forecast data when earth2studio, matplotlib, or NGC is missing.
- This is a **research / software showcase**. Local forecast skill has not been formally validated here.
- Model fields in the zip export path: **2 m temperature** + **10 m wind**.
