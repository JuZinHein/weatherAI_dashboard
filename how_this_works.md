# How this works

Entry points:

- `server.ts` — Express + Vite on **5180**, proxies `/api/zarr/*` to the Python field API  
- `backend/zarr_field_server.py` — discovers local Zarr models and serves them on **8767**
- `src/App.tsx` — UI shell  
- `src/components/ForecastMap2D.tsx` — MapLibre **မြန်မာ့ဒေသတွင်း ဂြိုဟ်တုရေဒါ** page  
- `src/components/CityWeatherPopup3D.tsx` — Zarr-only city metrics

```bash
python -m venv .venv
# Windows
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
# macOS / Linux
# .venv/bin/python -m pip install -r backend/requirements.txt
npm install
npm run dev
# → http://localhost:5180
# Zarr API auto-started (or reused) on :8767

# if needed alone:
npm run zarr-api
```

For the optional GFS forecast-generation pipeline, install `backend/requirements-pipeline.txt` into `.venv`; it adds Earth2Studio and Matplotlib. The dashboard does not use this pipeline or its generated assets.

Deep start guide: [`README.md`](README.md).

## Private office use

Keep this repository private. Put every forecast store under `models/<model-id>/`; nested `.zarr` stores are discovered recursively. Model stores stay local and are gitignored. The API discovers supported Zarr stores and reads forecast metadata and arrays directly from those stores. No NVIDIA API key is required for the website. Basemap tiles can be stored locally for offline use; forecast grids stay on disk. Download the optional tiles before disconnecting from the internet; they are not included in a fresh checkout.

## Layout

```text
weatherAI_dashboard/
  models/<model-id>/             local forecast stores (including nested .zarr stores)
  server.ts                      Express + Vite; /api/zarr proxy
  backend/zarr_field_server.py   FastAPI /api/meta + /api/field
  notebook/…ipynb                optional research / export notebook (not read by the UI)
  public/basemap/offline/{z}/{x}/{y}.jpg optional worldwide offline imagery tiles
  public/textures/               globe imagery
  src/
    App.tsx                      playback (no city tour on radar page)
    components/ForecastMap2D.tsx MapLibre heat + city pins
    components/SatelliteGlobe3D.tsx
    components/CityForecastPanel.tsx
    components/TimelineControls.tsx   0.5x … 10x
    services/zarrApi.ts          fetch meta/field
  README.md
  how_this_works.md
```

## End-to-end flow

```text
models/<model-id>/ (local model stores on disk)
        │
        ▼
Python field API :8767
  GET /api/models → discover local models
  GET /api/meta   → selected model's leads, variables, init time
  GET /api/field  → selected model's cropped grid (+ units / cmap)
  GET /api/timeseries → selected model's city values
        │
        ▼
Express /api/zarr/*  (port 5180)
        │
        ▼
React globe, map, city trends, and city popup
  · forecast fields, values, and timeline all come from the selected local Zarr model
  · city names, borders, and coordinates are geographic reference data
  · no bundled forecast or uploaded zip fallback
```

## MapLibre satellite-radar page

| Behaviour | Detail |
| --- | --- |
| Default view | `globe_3d` |
| Basemap | Esri World Imagery online; switches to local `public/basemap/offline/{z}/{x}/{y}.jpg` tiles when the browser goes offline or Esri tile requests fail |
| Missing offline tiles | A neutral background remains beneath the weather overlay and city pins; satellite imagery cannot appear until tiles have been downloaded |
| Heat | Built client-side from the selected model at `/api/zarr/field`; fetches the map viewport and refreshes after pan/zoom |
| Zoom / pan | `minZoom = 3.5`, `maxZoom = 12`; global panning |
| Variables | Available variables from the selected store + derived `wind10m` |
| Ensemble | Mean of members (API `ensemble=mean`) |
| Cities | 15 state/region capitals (`src/data/myanmarCities.ts`); HTML pins with °C from selected-model zarr `t2m` |
| Playback | Advances **lead hours only** on this page (no auto city tour) |
| Speeds | `0.5 / 1 / 2 / 5 / 10` |

### Preparing the basemap for offline use

While internet is available, run this from the repository root on the computer
that will use the offline map:

```bash
npm run basemap:download
```

By default, the script downloads Esri XYZ tiles for the **whole world** (all
longitudes and the full Web Mercator latitude range) at zoom levels 0–5, a
total of **1,365 tiles**. Tiles are saved in
`public/basemap/offline/{z}/{x}/{y}.jpg`, with metadata in `tiles.json`. It
skips existing tiles, retries requests, and reports failures. The folder is
gitignored, so downloading on another machine or cloning the repository does
not transfer the tiles. Tiles cover the world for offline panning, but the map
keeps its previous zoom-out limit of 3.5, so the entire globe does not fit in
one view. Imagery gets coarser as you zoom in and has no additional detail
beyond level 5; higher download zoom levels can be requested explicitly, but
the tile count grows rapidly.

For an offline check, keep the dashboard server running, open the radar/map
view, disconnect internet access, and reload/reopen that view at the local app
URL. Check that the offline folder contains JPEGs under zoom directories
`0` through `5`; `tiles.json` alone is not a basemap. If no local tile is
available for the current area/zoom, the neutral background remains visible.
Esri licensing, terms, and attribution apply to downloaded imagery. Do not
redistribute the tiles unless your license permits it.

The globe renders the selected Zarr temperature field. The popup and city trends use selected-model Zarr time series. If a field is missing or the API fails, the UI shows an unavailable/error state instead of inventing or substituting weather values. `q850` is specific humidity at 850 hPa, and `tcwv` is total column water vapour; neither represents surface relative humidity or dew point.

## Predictions vs storm alert

| Output | From |
| --- | --- |
| MapLibre fields | Selected local Zarr model via Python API |
| City trends | Selected local Zarr model via timeseries API |
| Globe temperature field | Selected local Zarr model via field API |
| City popup metrics | Only available fields in selected model's Zarr store |
| `storm_alert.json` | Optional notebook rule; **not shown** in UI |
| Humidity | Zarr `q850` / `tcwv`; no estimated relative-humidity or dew-point display |

Honest demo line: *“All forecast values and times shown in the UI come from the selected local Zarr model. Unavailable fields are not estimated. No cyclone HUD.”*

## Optional Colab export (not loaded by the UI)

Notebook: [`notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb`](notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb)

The notebook can produce an export for separate experiments, but the dashboard no longer accepts or displays these zip/JSON forecasts. To display data, place the forecast store in one of the supported local Zarr folders and select that model in the dashboard.

| Notebook output | Globe / city |
| --- | --- |
| `t2m` → °C | temperature |
| `u10m`/`v10m` → km/h | wind |
| Myanmar crop 9–29°N, 92–102°E | `geo.ts` sampling |

## Showcase behaviour

| Feature | Behaviour |
| --- | --- |
| Boot | Waits for the selected local model's Zarr metadata before enabling forecast playback |
| Radar playback | Steps leads; **selected city stays fixed** |
| Globe / trends playback | Advances only through the selected Zarr model's leads |
| Network | Esri tiles on the radar page when online; downloaded local tiles / fallback background offline; local weather API and model data; no NVIDIA NIM / Open-Meteo forecast calls |

Keyboard: `Space` play/pause · `←`/`→` step · `F` fullscreen.

## Bounds

| Name | Value |
| --- | --- |
| MapLibre initial view | SE Asia + Bay of Bengal; panning is global |
| Heat API crop | Current viewport, refreshed after pan/zoom |
| Offline basemap coverage | Worldwide, zoom levels 0–5 by default |
| Globe temperature crop | 9–29°N, 92–102°E from selected Zarr model |
| Zarr leads | Read from the selected model store; lead intervals and ranges can vary by model |

## References

| What | Link |
| --- | --- |
| FourCastNet paper | https://arxiv.org/abs/2202.11214 |
| Earth2Studio | https://nvidia.github.io/earth2studio/main/ |
| MapLibre | https://maplibre.org/ |
| NOAA GFS open data | https://registry.opendata.aws/noaa-gfs-bdp-pds/ |

StormScope is out of scope (different nowcasting stack). Optional notebook `storm_alert.json` is not displayed.

## What to edit

| Goal | Touch |
| --- | --- |
| MapLibre map / heat / pins / zoom | `src/components/ForecastMap2D.tsx` |
| Zarr client | `src/services/zarrApi.ts` |
| Field API / store path | `backend/zarr_field_server.py` |
| Proxy / sidecar spawn | `server.ts` |
| Playback / city tour rules | `src/App.tsx` |
| Timeline speeds | `src/components/TimelineControls.tsx` |
| Globe / popup Zarr display | `src/components/SatelliteGlobe3D.tsx`, `src/components/CityWeatherPopup3D.tsx` |
| Docs | `README.md`, `how_this_works.md` |
