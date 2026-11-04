# How this works

Entry points: `server.ts` (Express + Vite), `src/App.tsx` (UI), `notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb` (GPU export → zip).

Local **offline / zip-first** showcase. The browser never calls NVIDIA NIM, Open-Meteo, or any remote weather API. Forecasts and storm flags are either:

1. Bundled under `public/forecast_data/` + `src/data/`, or  
2. Loaded from a Colab/Kaggle `.zip` (drag-drop / upload).

**UI shows only what the zip has:** **2 m temperature** and **10 m wind**. Extra parameter catalogs / live API augmentation were removed so office demos stay honest and offline-capable. Default view is the **2D Myanmar map**; bundled sample is a **72 h** local-zarr rollout.

```bash
npm install
npm run dev
# → http://localhost:5180   (normal non-local app stays on :3000)
```

Deep start guide for newcomers: [`README.md`](README.md).

## Private office use

Keep this repository private. It is an internal demonstration UI — run locally, no NVIDIA API key needed for the website, and no internet required once Node deps and a forecast zip (or bundled sample) are on disk.  
NVIDIA FourCastNet / Earth2Studio / GFS stay under their own upstream terms.

## Layout

```text
Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  server.ts                    Express + Vite on port 5180
  notebook/
    NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb   GPU forecast factory → zip
  public/forecast_data/        layer PNGs, configs, optional storm_alert.json
  public/textures/             globe / map imagery (offline)
  src/
    App.tsx                    city tour playback, zip drop (boots from DEFAULT_FORECAST_DATA)
    components/
      SatelliteGlobe3D.tsx     3D Earth, city popup, rotate speed
      ForecastMap2D.tsx        2D map — Myanmar border; smooth temp / wind overlays
      CityForecastPanel.tsx    city trends / table (temp + wind only)
      CityWeatherPopup3D.tsx   auto city card
      TimelineControls.tsx     time-window scrubber
    data/                      defaultForecast + forecastData.json (72 h grids)
    services/
      weatherVariables.ts      two real FCN export fields
      weatherApi.ts            offline stub (no remote fetch)
    utils/
      zipForecastParser.ts     parse zip (+ optional storm_alert.json)
      forecastTime.ts          Burmese date windows
      burmese.ts               digits / copy
      geo.ts                   Myanmar border, colormaps, sampling
  backend/                     optional pipeline sketch (not used by npm run dev)
  README.md
  how_this_works.md
```

## End-to-end flow

```text
NOAA GFS / local zarr IC
        │
        ▼
Earth2Studio + NVIDIA FourCastNet (FCN)   [GPU notebook, or pre-bundled sample]
        │
        ▼
Crop Myanmar  9–29°N, 92–102°E
        │
        ├─ temp / wind grids → regional_forecast.npz (or forecastData.json)
        ├─ optional BoB wind scan ≥ 65 km/h → storm_alert.json
        └─ CSV / PNG / metadata
        │
        ▼
ZIP (or bundled sample)  →  office PC / drop into showcase
        │
        ▼
React UI (2D map default / globe / cities) — temp + wind only
        │
        └── offline: no NIM / Open-Meteo / remote map tiles
```

## Predictions vs storm alert

| Output | From |
| --- | --- |
| 2 m temperature, 10 m wind | **NVIDIA FourCastNet** via Earth2Studio `FCN` (or bundled local-zarr sample) |
| `storm_alert.json` | Notebook **rule** on FCN wind in Lat 10–22 / Lon 92–96; active if peak ≥ **65 km/h** |
| Showcase UI | **Does not show** a cyclone card in this build — temp + wind maps/charts only |
| Humidity / rain / pressure / clouds | **Not in this product** (not exported by the notebook zip) |

Honest line for demos: *“Forecast fields from NVIDIA FourCastNet (temperature + 10 m wind). Offline zip / bundled 72 h sample. Optional storm_alert.json may be in the zip but is not shown in the UI.”*

The **65 km/h** floor is this project’s round number for the North Indian Ocean **cyclonic storm** class, which starts at **34 knots (62–88 km/h)** in the IMD / WMO–ESCAP Panel tables. Myanmar’s national row in that plan uses the same 34-knot floor. This app does not track a cyclone eye or issue an official warning.

## Colab export (zip factory)

Notebook: [`notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb`](notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb)

This is the GPU export the UI is built to load. It does **not** run inside `npm run dev`. Generating a **new** zip needs Colab/CUDA + internet; **displaying** that zip on the showcase does not.

1. Upload to [Google Colab](https://colab.research.google.com/) → **Runtime → Change runtime type → GPU**.
2. Run **Installation — FCN dependencies only** once. On failure, read `/content/earth2_fcn_install.log`.
3. **Restart the session**, then continue from **Imports and GPU check**.
4. Run through the Gradio dashboard.
5. On **Run NVIDIA AI forecast**, keep **30 hours** (default) so lead times are `0, 6, 12, 18, 24, 30` and the timeline stays one button per window. **Predict future weather** accepts **1–14 days** (up to 336 hours). More than 8 steps switches the player to a slider and a scrolling strip; city charts label days instead of every 6-hour tick. A 14-day GPU run is slower and needs a large GPU.
6. Download `NVIDIA_FCN_Myanmar_*_Forecast.zip` and drop it on the local UI header.

| Notebook output | What the UI reads |
| --- | --- |
| `t2m` → `temperature_c` (°C) | temperature maps, city °C |
| `u10m` + `v10m` → `wind_kmh` | wind maps, city km/h |
| Lat **29°N → 9°N**, Lon **92°E → 102°E**, step **0.25°** (81 × 41) | `sampleGrid` in `src/utils/geo.ts` (row 0 is north) |
| 12 cities below | `src/data/forecastData.json` + `src/utils/burmese.ts` |
| BoB scan Lat **10–22**, Lon **92–96**, peak **≥ 65 km/h** | optional `storm_alert.json` (parsed, **not shown** in UI) |

The notebook forces that grid orientation before saving. The parser flips a north/south or east/west axis if a zip arrives reversed.

City ping points (same in notebook `CITIES` and the UI):

| City | Lat | Lon |
| --- | --- | --- |
| Yangon | 16.8661 | 96.1951 |
| Mandalay | 21.9750 | 96.0833 |
| Nay Pyi Taw | 19.7633 | 96.0785 |
| Taunggyi | 20.7833 | 97.0333 |
| Mawlamyine | 16.4905 | 97.6283 |
| Bago | 17.3221 | 96.4660 |
| Pathein | 16.7797 | 94.7324 |
| Sittwe | 20.1462 | 92.8983 |
| Monywa | 22.1086 | 95.1378 |
| Myitkyina | 25.3833 | 97.4000 |
| Dawei | 14.0833 | 98.2000 |
| Pyin Oo Lwin | 22.0333 | 96.4667 |

The zip’s CSV is the city you picked in Colab. After upload, the UI **re-samples all 12 cities** from the temperature and wind grids at these coordinates.

## Zip contract

| File | Role |
| --- | --- |
| `regional_forecast.npz` | `temperature_c`, `wind_kmh`, lat/lon, lead hours |
| `metadata.json` | run provenance |
| `storm_alert.json` | optional notebook payload (parsed; UI does not render it) |
| `all_steps_with_future_flags.csv` | city/time table |
| `myanmar_forecast.png` / `city_trend.png` | optional benchmarks |

Parser: `src/utils/zipForecastParser.ts`. The browser will **not** invent an alert from the wind grid alone. Express no longer serves `/api/storm-alert`.

## Showcase behaviour

| Feature | Behaviour |
| --- | --- |
| Boot | Always starts from bundled `DEFAULT_FORECAST_DATA` (skips older IndexedDB uploads) |
| Default view | **2D Myanmar map**; header switches to 3D globe or city trends |
| Time UI | Windows like `၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)` via `forecastTime.ts` |
| Playback | Steps through windows; after last step → **next city** + reopen popup |
| City popup | Opens on start / city change; close with X until city changes again |
| 2D map | Myanmar border + smooth temp / wind heat overlays (independent toggles) |
| City panel | Temp + wind only — no synthesized multi-variable catalog |
| Globe | Auto-rotate with speed slider; slower default |
| Storm | Not shown in UI |
| Network | No remote weather or map-tile calls from the UI |

Keyboard: `Space` play/pause · `←`/`→` step · `F` fullscreen.

## Bounds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29°N**, Lon **92–102°E** (~0.25°) |
| Bundled lead hours | **0 … 72** every 6 h (13 steps); longer Colab zips supported |
| BoB alert box (notebook) | Lat **10–22**, Lon **92–96** |
| Cyclone wind (notebook) | **≥ 65 km/h** |
| Model fields in zip / UI | **2 m temperature**, **10 m wind** only |

## References

Sources this showcase and the Colab notebook are built from. The local UI does not call them at runtime.

### Model and article

| What we run | Link |
| --- | --- |
| **FourCastNet** paper (Pathak et al., 2022) — AFNO global model, 0.25°, 6-hour steps | https://arxiv.org/abs/2202.11214 |
| Earth2Studio `FCN` class (weights this notebook loads, **not** FourCastNet 3) | https://github.com/NVIDIA/earth2studio/blob/main/earth2studio/models/px/fcn.py |
| Prognostic model list (`FCN`, and `StormScope*` further down) | https://nvidia.github.io/earth2studio/main/modules/models_px/ |
| Earth2Studio docs | https://nvidia.github.io/earth2studio/main/ |
| Earth2Studio repository | https://github.com/NVIDIA/earth2studio |
| NVIDIA Earth-2 | https://www.nvidia.com/en-us/high-performance-computing/earth-2/ |

Installed pin in the notebook: `earth2studio[fcn]==0.20.0`. Inference **exports** `t2m`, `u10m`, and `v10m` only. Other FCN input channels stay inside the model and are not shown in the UI.

### Initial conditions

| What | Link |
| --- | --- |
| NOAA GFS on AWS (`noaa-gfs-bdp-pds`, 0.25° `pgrb2`) | https://registry.opendata.aws/noaa-gfs-bdp-pds/ |
| GFS product description | https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast |
| Example object the notebook checks | `https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{YYYYMMDD}/{HH}/atmos/gfs.t{HH}z.pgrb2.0p25.f000` |

### Storm scan vs StormScope

**In this project.** After FCN finishes, the notebook can scan 10 m wind on Lat **10–22°N**, Lon **92–96°E** and write `storm_alert.json` when peak ≥ **65 km/h**. The zip parser may keep that JSON; the **current UI does not display** it.

**Not in this project.** [StormScope](https://nvidia.github.io/earth2studio/main/examples/04_nowcasting/03_stormscope_goes_example/) is a different Earth2Studio model (GOES satellite and MRMS radar nowcasting). The notebook does not install StormScope, Earth2Grid, or NATTEN.

| Threshold source | What it says |
| --- | --- |
| [IMD terminology (RSMC New Delhi)](https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf) | Cyclonic storm: **34–47 knots (62–88 km/h)** |
| [WMO/ESCAP Panel TCP-21 (2021)](https://mausam.imd.gov.in/ptc/TCP/TCP2021.pdf) | Same 34-knot floor; **Myanmar** national table matches it |
| [DMH Myanmar](https://www.moezala.gov.mm/) | National meteorological service. This repo does not scrape or replace DMH warnings |

### Attribution

Private office showcase code. FourCastNet, Earth2Studio, GFS, and the IMD/WMO documents stay under their own upstream licenses and terms. Keep those credits when presenting this work.

## What to edit

| Goal | Touch |
| --- | --- |
| UI / Burmese / views | `src/App.tsx`, `src/components/*`, `src/utils/burmese.ts` |
| Time window labels | `src/utils/forecastTime.ts` |
| Zip ingest | `src/utils/zipForecastParser.ts` |
| Real variable list (temp + wind) | `src/services/weatherVariables.ts` |
| Export / FCN / alert scan | `notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb` |
| Bundled sample | `public/forecast_data/*`, `src/data/forecastData.json` |
