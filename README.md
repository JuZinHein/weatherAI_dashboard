# Local NVIDIA FourCastNet Myanmar AI Weather Showcase

Private office showcase: React + Express UI for local forecast models over Myanmar and the Bay of Bengal.

Keep the repo private. All displayed forecast values and forecast timelines come from the selected local Zarr model folder. There is no bundled-sample or uploaded-forecast fallback.

**No NVIDIA API key** is required. This is a demonstration build, not a public product release.

Deep dive: [`how_this_works.md`](how_this_works.md)

## What this is

| Piece | Source |
| --- | --- |
| Default landing view | **3D globe** with a temperature field loaded from the selected local Zarr model |
| Satellite-radar map | **MapLibre** + Esri World Imagery or local offline tiles + heat overlay from selected local Zarr model via Python field API |
| Zarr variables | Available fields from the selected store, including `t2m`, `t500`, `msl`, `q850`, `tcwv`, `u10m`, `v10m`, `wind10m` (derived), `u100m`, `v100m`, `z500` |
| 3D globe and city popup | Selected local model's Zarr temperature field and Zarr city time series |
| City trends | Selected local model's Zarr time series; unavailable fields are not replaced with estimates |
| Humidity | `q850` is specific humidity at 850 hPa and `tcwv` is total column water vapour; neither is relative humidity (%) or dew point |
| Storm / cyclone JSON | Notebook can write `storm_alert.json`; **UI does not show** a cyclone card |

Internal research / software showcase. Local forecast skill has **not** been formally validated here.

## Requirements

| Need | Notes |
| --- | --- |
| Node.js **20.19+ or 22.12+** | Required by the installed Vite 8 release |
| npm | uses `package-lock.json` |
| Python **3.11+** | Install `backend/requirements.txt` for the local field API |
| Forecast stores | Put supported Zarr stores under `models/<model-id>/` (gitignored — do not commit) |
| Modern browser | WebGL / MapLibre |
| Network | Internet is used for online Esri imagery and optional tile downloads; downloaded tiles and the forecast API can be used locally |
| GPU Colab/Kaggle (optional) | Not used by the dashboard data path |

## Quick start

```bash
# From the repository root, put supported model stores under ./models/<model-id>/
#    For example: ./models/Pangu6/<forecast-run>.zarr/
#                 ./models/NvidiaFourCastNetV3/forecast.zarr/

python -m venv .venv
# Windows
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
# macOS / Linux
# .venv/bin/python -m pip install -r backend/requirements.txt
npm install
npm run dev
```

The local API uses the repository `.venv` when present.

Open **http://localhost:5180**

`npm run dev` starts Express + Vite on **5180** and spawns (or reuses) this project's Zarr API on **8767**. Proxy path: `/api/zarr/*`.

If the map says the zarr API is unavailable:

```bash
npm run zarr-api
# → http://127.0.0.1:8767
```

This repo uses port **5180** so it does not collide with the normal (non-local) showcase on **http://localhost:3000**.

### Offline map basemap

Offline imagery is optional and is **not included in a fresh checkout**. Download
it while connected to the internet, on the same computer that will run the
dashboard:

```bash
npm run basemap:download
```

Then open the **radar/map** view. The app uses online Esri
World Imagery while online and switches to local tiles when the browser reports
offline or an Esri tile request fails. To test it, keep the local app running,
disconnect from the internet, and reload or reopen the radar/map view at
`http://localhost:5180`.

The default download covers the **whole world** (all longitudes and the full
Web Mercator latitude range) at zoom levels 0–5, which is **1,365 tiles**. It
saves `public/basemap/offline/{z}/{x}/{y}.jpg` and `tiles.json`. The script
skips existing tiles, retries failed requests, and reports failures. Tiles
cover the world for offline panning, but the map keeps its previous zoom-out
limit of 3.5, so it does not fit the entire globe in one view. Imagery gets
coarser as you zoom in, and detail does not increase beyond level 5. Higher
download zooms can be requested explicitly, but the tile count grows rapidly.

The offline folder is gitignored and is not included in clones or deployments;
download tiles separately on each computer before going offline. Esri imagery
is subject to Esri's terms and attribution requirements; keep downloaded tiles
local unless your license permits redistribution.

If offline imagery does not appear, check that:

1. `public/basemap/offline/0/` through `public/basemap/offline/5/` contain
   `.jpg` tile files (not just `tiles.json`).
2. The dashboard is still served locally and the map view is the radar/map
   view, not the 3D globe.
3. Tiles were downloaded into this checkout's `public/basemap/offline/` folder
   before internet access was disconnected.

| Script | What |
| --- | --- |
| `npm run dev` | Express + Vite on **5180** + auto-start Zarr API on **8767** |
| `npm run zarr-api` | Python field server only (`backend/zarr_field_server.py`) |
| `npm run basemap:download` | Download worldwide Esri imagery (zoom 0–5; 1,365 tiles) |
| `npm run build` | production build → `dist/` |
| `npm start` | same entry as `dev` (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` |

## Layout

```text
weatherAI_dashboard/
  models/
    Pangu6/                 local Zarr stores (gitignored, may be multi-GB)
    NvidiaFourCastNetV3/
  server.ts                 Express + Vite; proxies /api/zarr → :8767
  backend/
    zarr_field_server.py    FastAPI model discovery + metadata/field crops
    fourcastnet_pipeline.py optional automation sketch
  notebook/                 optional research notebook; not used by the dashboard
  public/
    basemap/offline/{z}/{x}/{y}.jpg  worldwide offline Esri tiles (zoom 0–5 by default)
    textures/               globe textures (offline)
  src/
    App.tsx                 views, Zarr model selection, playback
    components/
      ForecastMap2D.tsx     MapLibre satellite-radar page
      SatelliteGlobe3D.tsx  3D globe
      CityForecastPanel.tsx city trends
      TimelineControls.tsx  0.5x … 10x scrubber
    services/
      zarrApi.ts            client for /api/zarr/meta + /api/zarr/field
      weatherVariables.ts   supported local Zarr fields
    data/                   geography and display metadata
  how_this_works.md
  README.md
```

## Data flow

```text
models/*/  ──►  Python :8767  ──►  /api/zarr/*  ──►  Globe, map, city trends
                                                                      (selected model)
```

| Mode | What the UI uses |
| --- | --- |
| Satellite-radar | Selected local Zarr model via field API — cropped heat field on MapLibre |
| Globe | Selected local Zarr model via field API |
| City trends and popup | Selected local model's Zarr time series |
| Model selector | Discovers available stores; selection updates all weather fields and the Zarr forecast timeline |
| Missing fields or stores | Shown as unavailable/errors; no synthetic or bundled forecast fallback |

## UI features

| Action | How |
| --- | --- |
| Default view | **3D satellite globe** |
| MapLibre layers | All zarr variables + derived `wind10m`; Burmese chips |
| Heat overlay | Loads the selected model's current map viewport; refreshes after pan and zoom |
| Zoom | Min **3.5**, max **12**; panning is not restricted to the storm-basin box |
| City pins | MapLibre dots + labels; click to select (no auto city-tour on this page) |
| Playback | Timeline · `Space` · `←`/`→` · speeds **0.5x … 10x** · `F` fullscreen |
| Time labels | Burmese windows, e.g. `၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)` |
| City selection | Selects a geographic location; displayed forecast values load from the selected Zarr model |
| Humidity data | Zarr `q850` and `tcwv` only; no estimated relative humidity or dew point |
| Storm HUD | **not wired** |

## Local model stores

1. Put supported stores under `models/<model-id>/`, including nested stores such as `models/Pangu6/<store>.zarr/`.
2. The API discovers supported stores recursively, validates their Zarr metadata, and lists each store in the model selector. Pangu6 stores use root `model`, `initialization_utc`, and `forecast_lead_hours` attributes with global `[time, lead, lat, lon]` arrays.
3. Keep these large local folders uncommitted; `models/` is listed in `.gitignore`.
4. The field API serves **viewport/region crops** as JSON; the browser never loads the whole store.

Health check: `http://127.0.0.1:8767/api/health`

The optional GFS forecast-generation pipeline has additional, much larger dependencies. Install them only if you use `backend/fourcastnet_pipeline.py`:

```bash
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-pipeline.txt
```

The optional Colab notebook is not connected to the dashboard. Forecast uploads are not displayed; put data in a supported local Zarr folder instead.

MapLibre city pins (15 state/region capitals) — coords in `src/data/myanmarCities.ts`; °C sampled from the selected model's `t2m`:

| # | State / Region | City | Lat | Lon |
| --- | --- | --- | --- | --- |
| 1 | Yangon Region | Yangon | 16.8053 | 96.1561 |
| 2 | Mandalay Region | Mandalay | 21.9747 | 96.0836 |
| 3 | Sagaing Region | Sagaing | 21.8822 | 95.9786 |
| 4 | Magway Region | Magway | 20.1500 | 94.9500 |
| 5 | Bago Region | Bago | 17.3433 | 96.4981 |
| 6 | Ayeyarwady Region | Pathein | 16.7667 | 94.7333 |
| 7 | Tanintharyi Region | Dawei | 14.0800 | 98.1900 |
| 8 | Kachin State | Myitkyina | 25.3867 | 97.3936 |
| 9 | Shan State | Taunggyi | 20.7806 | 97.0372 |
| 10 | Chin State | Hakha | 22.6510 | 93.6166 |
| 11 | Kayah State | Loikaw | 19.6830 | 97.2170 |
| 12 | Kayin State | Hpa-An | 16.8906 | 97.6333 |
| 13 | Mon State | Mawlamyine | 16.4847 | 97.6258 |
| 14 | Rakhine State | Sittwe | 20.1444 | 92.8969 |
| 15 | Naypyidaw Territory | Naypyidaw | 19.7475 | 96.1150 |

## Storm alert (honest summary)

The optional notebook can write `storm_alert.json` (BoB peak wind ≥ **65 km/h**), but the dashboard does not read or render it. Express does **not** expose `/api/storm-alert`.

## Bounds

| Name | Value |
| --- | --- |
| MapLibre initial view | SE Asia + Bay of Bengal, fitted to ~78–130°E and 5°S–35°N |
| MapLibre zoom / pan | zoom **3.5–12**; global panning |
| Heat crop (API) | Follows the current viewport; refetched after map movement |
| Globe temperature crop | Lat **9–29°N**, Lon **92–102°E** from selected Zarr store |
| Zarr leads | Read from the selected store's metadata; each model may have different lead hours |
| Model fields | Available fields in the selected Zarr store |

## References

### Model and article

| What we run | Link |
| --- | --- |
| **FourCastNet** paper (Pathak et al., 2022) | https://arxiv.org/abs/2202.11214 |
| Earth2Studio `FCN` class | https://github.com/NVIDIA/earth2studio/blob/main/earth2studio/models/px/fcn.py |
| Earth2Studio docs | https://nvidia.github.io/earth2studio/main/ |
| NVIDIA Earth-2 | https://www.nvidia.com/en-us/high-performance-computing/earth-2/ |
| MapLibre GL JS | https://maplibre.org/ |

Installed pin in the Colab notebook: `earth2studio[fcn]==0.20.0`.

### Initial conditions

| What | Link |
| --- | --- |
| NOAA GFS on AWS (`noaa-gfs-bdp-pds`) | https://registry.opendata.aws/noaa-gfs-bdp-pds/ |

### Storm scan vs StormScope

Notebook BoB wind threshold → optional `storm_alert.json` (UI unused). [StormScope](https://nvidia.github.io/earth2studio/main/examples/04_nowcasting/03_stormscope_goes_example/) is a different nowcasting product and is **out of scope**.

| Threshold source | What it says |
| --- | --- |
| [IMD terminology](https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf) | Cyclonic storm: **34–47 knots (62–88 km/h)** |
| [WMO/ESCAP Panel TCP-21 (2021)](https://mausam.imd.gov.in/ptc/TCP/TCP2021.pdf) | Same 34-knot floor; Myanmar national table matches |
| [DMH Myanmar](https://www.moezala.gov.mm/) | National service — this repo does not replace DMH warnings |

### Attribution

Private office showcase code. FourCastNet, Earth2Studio, GFS, Esri tiles, and IMD/WMO documents stay under their own upstream licenses and terms.
