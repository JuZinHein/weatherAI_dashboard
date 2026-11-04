# How this works

Entry points:

- `server.ts` — Express + Vite on **5180**, proxies `/api/zarr/*` to the Python field API  
- `backend/zarr_field_server.py` — reads project-root `forecast.zarr/` on **8766**  
- `src/App.tsx` — UI shell  
- `src/components/ForecastMap2D.tsx` — MapLibre **မြန်မာ့ဒေသတွင်း ဂြိုဟ်တုရေဒါ** page  
- `notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb` — optional Colab zip factory (globe / city)

```bash
npm install
npm run dev
# → http://localhost:5180
# zarr API auto-started (or reused) on :8766

# if needed alone:
npm run zarr-api
```

Deep start guide: [`README.md`](README.md).

## Private office use

Keep this repository private. Put `forecast.zarr/` in the project root (gitignored). No NVIDIA API key for the website. The **satellite-radar** page needs internet for Esri basemap tiles; forecast grids stay on disk.

## Layout

```text
Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  forecast.zarr/                 Earth-2 global store (local only)
  server.ts                      Express + Vite; /api/zarr proxy
  backend/zarr_field_server.py   FastAPI /api/meta + /api/field
  notebook/…ipynb                Colab zip factory
  public/forecast_data/          sea-borders.json, sample layers
  public/textures/               globe imagery
  src/
    App.tsx                      playback (no city tour on radar page)
    components/ForecastMap2D.tsx MapLibre heat + city pins
    components/SatelliteGlobe3D.tsx
    components/CityForecastPanel.tsx
    components/TimelineControls.tsx   0.5x … 10x
    services/zarrApi.ts          fetch meta/field
    data/forecastData.json       bundled globe/city sample
  README.md
  how_this_works.md
```

## End-to-end flow

```text
forecast.zarr/ (global Earth-2 ensemble on disk)
        │
        ▼
Python field API :8766
  GET /api/meta   → leads, variables, init time
  GET /api/field  → cropped grid JSON (+ units / cmap)
        │
        ▼
Express /api/zarr/*  (port 5180)
        │
        ▼
ForecastMap2D (MapLibre)
  · Esri satellite tiles
  · JPEG heat overlay (fixed SE Asia / BoB crop)
  · borders + city pins
  · all variables including derived wind10m

Parallel path (globe / city-trends):
  bundled forecastData.json  or  Colab regional_forecast.npz zip
        → temp (°C) + wind (km/h) only
```

## MapLibre satellite-radar page

| Behaviour | Detail |
| --- | --- |
| Default view | `satellite_radar` |
| Basemap | Esri World Imagery (needs network) |
| Heat | Built client-side from `/api/zarr/field`; fixed `HEAT_BBOX` so zoom/play do not blank it |
| Zoom | `minZoom ≈ 4.15`, `maxZoom = 10`, tight `maxBounds` around the storm basin |
| Variables | Full Earth-2 set from the store + derived `wind10m` |
| Ensemble | Mean of members (API `ensemble=mean`) |
| Cities | 15 state/region capitals (`src/data/myanmarCities.ts`); HTML pins with °C from zarr `t2m` |
| Playback | Advances **lead hours only** on this page (no auto city tour) |
| Speeds | `0.5 / 1 / 2 / 5 / 10` |

Globe and city-trends keep the older canvas / chart UI and the Colab temp+wind contract.

## Predictions vs storm alert

| Output | From |
| --- | --- |
| MapLibre fields | Local `forecast.zarr` (Earth-2) via Python API |
| Globe / city temp + wind | Bundled JSON or Colab FCN zip |
| `storm_alert.json` | Optional notebook rule; **not shown** in UI |
| Humidity / rain as Colab zip products | Not in the Colab zip path (MapLibre can show `q850` / `tcwv` from zarr) |

Honest demo line: *“Satellite-radar page reads local Earth-2 forecast.zarr through a field API onto MapLibre. Globe/city views use the bundled or Colab temp+wind sample. No cyclone HUD.”*

## Colab export (zip factory for globe / city)

Notebook: [`notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb`](notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb)

1. Colab + GPU → install FCN → restart → Gradio forecast.  
2. Download zip → drop on UI header.  
3. Updates globe / city grids; does not replace `forecast.zarr` for MapLibre.

| Notebook output | Globe / city |
| --- | --- |
| `t2m` → °C | temperature |
| `u10m`/`v10m` → km/h | wind |
| Myanmar crop 9–29°N, 92–102°E | `geo.ts` sampling |

## Zip contract (Colab path)

| File | Role |
| --- | --- |
| `regional_forecast.npz` | `temperature_c`, `wind_kmh`, coords, leads |
| `metadata.json` | provenance |
| `storm_alert.json` | optional (UI unused) |
| `all_steps_with_future_flags.csv` | city/time table |

Parser: `src/utils/zipForecastParser.ts`.

## Showcase behaviour

| Feature | Behaviour |
| --- | --- |
| Boot | Bundled `DEFAULT_FORECAST_DATA` for globe/city; MapLibre loads zarr meta when API is up |
| Radar playback | Steps leads; **selected city stays fixed** |
| Globe / trends playback | Can city-tour after last step |
| Network | Esri tiles on radar page only; no NVIDIA NIM / Open-Meteo forecast calls |

Keyboard: `Space` play/pause · `←`/`→` step · `F` fullscreen.

## Bounds

| Name | Value |
| --- | --- |
| MapLibre frame | ~78–112°E, 2–28.5°N |
| Heat API crop | ~74–116°E, 0.5–30.5°N |
| Colab Myanmar crop | 9–29°N, 92–102°E |
| Typical zarr leads | 0…168 h / 6 h |

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
| Colab zip ingest | `src/utils/zipForecastParser.ts` |
| Bundled globe sample | `src/data/forecastData.json` |
| Docs | `README.md`, `how_this_works.md` |
