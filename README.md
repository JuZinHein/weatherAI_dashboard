# Local NVIDIA FourCastNet Myanmar AI Weather Showcase

Private office showcase: **offline-first** React + Express UI for **NVIDIA FourCastNet (FCN)** regional forecasts over Myanmar.

Keep the repo private. Run with the bundled sample, or drop in a Colab/Kaggle forecast `.zip`. **No NVIDIA API key, no Open-Meteo, and no remote weather calls** are required to run the UI. This is a demonstration build, not a public product release.

Deep dive: [`how_this_works.md`](how_this_works.md)

## What this is

| Piece | Source |
| --- | --- |
| Temperature + 10 m wind | **NVIDIA FourCastNet (`FCN`)** via Earth2Studio, started from **NOAA GFS** — exported as a zip |
| Storm / cyclone HUD | **Not a separate NVIDIA cyclone model** — a notebook post-process on FCN wind in the Bay of Bengal (≥ **65 km/h**) written into `storm_alert.json` |
| Web app | Displays **bundled sample** or a dropped **zip only** — **does not** call NVIDIA NIM, Open-Meteo, or invent extra variables |

**Honest variable list.** The zip (and this UI) expose **two** forecast fields only:

1. **2 m temperature** (`t2m` → °C)  
2. **10 m wind speed** (`u10m` + `v10m` → km/h)

There is no humidity / rain / pressure / cloud product in this showcase. Older UI drafts that listed ~32 parameters or called a live weather API have been removed.

Internal research / software showcase. Local forecast skill has **not** been formally validated here.

## Requirements

| Need | Notes |
| --- | --- |
| Node.js **20+** | app server + Vite |
| npm | uses `package-lock.json` |
| Modern browser | WebGL for the 3D globe |
| GPU Colab/Kaggle (optional) | only if you want to **export a new zip** — needs internet + CUDA while generating |

Once you have a zip (or use the bundled sample), the showcase PC can stay **offline**.

## Quick start

```bash
cd Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase

npm install
npm run dev
```

Open **http://localhost:3000**

Bundled data under `public/forecast_data/` and `src/data/` loads immediately. Upload a newer zip any time.

| Script | What |
| --- | --- |
| `npm run dev` | Express + Vite on port **3000** |
| `npm run build` | production build → `dist/` |
| `npm start` | same entry as `dev` (`tsx server.ts`) |
| `npm run lint` | `tsc --noEmit` |

## Layout

```text
Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
  server.ts                 Express + Vite (serves UI + local storm_alert.json)
  notebook/                 Colab / Kaggle GPU export → forecast .zip
  public/
    forecast_data/          bundled sample layers, configs, storm_alert.json
    textures/               globe / map textures (offline)
  src/
    App.tsx                 views, city tour playback, zip drop
    components/             globe, 2D map, city panel, cyclone card
    data/                   defaultForecast + forecastData.json
    services/               local variable defs only (no remote weather API)
    utils/                  zip / npy parsers, Burmese time windows, geo
  backend/                  optional automation sketch (not used by npm run dev)
  how_this_works.md
  README.md
```

## Offline / zip-first contract

```text
Bundled sample  ──┐
                  ├──►  React UI  (temp + wind + optional storm_alert.json)
Colab FCN zip  ───┘
```

| Mode | What the UI uses |
| --- | --- |
| First load | Bundled `public/forecast_data/` + `src/data/` |
| After zip drop | **That zip only** for grids, city samples, metadata, and (if present) storm alert |

The browser does **not** call NVIDIA NIM, Open-Meteo, Esri tiles, or any live forecast API. Map basemap uses local textures under `public/textures/`.

## UI features

| Action | How |
| --- | --- |
| Play forecast windows | timeline · `Space` play/pause · `←`/`→` step · `F` fullscreen |
| Time labels | Burmese digits, e.g. `၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)` (not `+6h`) |
| Views | 3D globe · 2D Myanmar map · city trends (temp + wind) |
| City tour | while playing: finish all time windows for a city → next city + popup |
| City popup | auto-opens on load / city change; shows that city’s step strip |
| Load forecast | header upload or drag-drop `.zip` |
| Storm HUD | `storm_alert.json` (`alert_active`) → cyclone card + map marker |
| Globe spin | slower default + speed slider (နှေး ↔ မြန်) |

## Make a new forecast zip (Colab notebook)

Notebook: [`notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb`](notebook/NVIDIA_Earth2_GPU_Colab_Myanmar.ipynb)

This is the **zip factory** the showcase is built to load. It does **not** run inside `npm run dev`. Run it on Google Colab (or a CUDA machine with internet), download the zip, then drop that zip on the local UI — including on an offline office PC.

1. Upload the notebook to [Google Colab](https://colab.research.google.com/) and set **Runtime → Change runtime type → GPU** (A100 / ~40 GB class preferred; a free T4 may not fit).
2. Run **Installation — FCN dependencies only** once. If it fails, read `/content/earth2_fcn_install.log`.
3. **Restart the session**, then continue from **Imports and GPU check**.
4. Run the cells through the Gradio dashboard.
5. On **Run NVIDIA AI forecast**, keep **30 hours** (default). That writes lead times **0, 6, 12, 18, 24, 30** and the timeline stays a row of window buttons. For a longer run, open **Predict future weather** and choose up to **Next 14 days — 336 hours**. More than 8 steps switches the player to a slider plus a scrolling strip.
6. Download `NVIDIA_FCN_Myanmar_*_Forecast.zip`.
7. In the local app (`npm run dev` → http://localhost:3000), upload or drag that zip onto the header.

The notebook does the model run. The website only displays the zip (or the bundled sample).

| Notebook output | What the UI reads |
| --- | --- |
| `t2m` → `temperature_c` (°C) | temperature maps, city °C |
| `u10m` + `v10m` → `wind_kmh` | wind maps, city km/h |
| Lat **29°N → 9°N**, Lon **92°E → 102°E**, step **0.25°** (81 × 41) | `sampleGrid` in `src/utils/geo.ts` (row 0 is north) |
| 12 cities below | `src/data/forecastData.json` + `src/utils/burmese.ts` |
| BoB scan Lat **10–22**, Lon **92–96**, peak **≥ 65 km/h** | `storm_alert.json` → cyclone card |
| `regional_forecast.npz`, `metadata.json`, `storm_alert.json`, `all_steps_with_future_flags.csv`, PNGs | `src/utils/zipForecastParser.ts` |

City ping points (lat, lon), same in the notebook `CITIES` dict and the UI:

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

The zip’s CSV is the city you picked in Colab. After upload, the UI **re-samples all 12 cities** from the temperature and wind grids at these coordinates, so every city on the globe updates from that run.

If a zip has **no** `storm_alert.json`, the app keeps the bundled alert (or none after reset). It does not invent an alert from the wind grid in the browser.

## Storm alert (honest summary)

```text
NVIDIA FCN 10 m wind grids
        │
        ▼
Notebook scan: BoB box, peak wind ≥ 65 km/h?
        │
        ▼
storm_alert.json  →  showcase HUD / map marker
```

- **Wind values** = NVIDIA FourCastNet (`u10m`, `v10m` → km/h)  
- **Alert on/off** = a showcase rule on those winds inside the Bay of Bengal box, not NVIDIA StormScope and not a DMH bulletin  

The **65 km/h** floor is the code’s round number for the North Indian Ocean **cyclonic storm** class, which starts at **34 knots (62–88 km/h)** in the IMD / WMO–ESCAP Panel tables. Myanmar’s national row in that same plan uses the same 34-knot floor. This app does not track a cyclone eye or issue an official warning.

## Local storm alert file

On startup the local Express server reads `public/forecast_data/storm_alert.json` and the UI loads that bundled cyclone card. There is **no NVIDIA cloud call** for this.

Zip uploads replace the alert **in the browser only** — nothing is written back to disk.

## Bounds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29°N**, Lon **92–102°E** (~0.25°) |
| Lead steps | **0, 6, 12, 18, 24, 30** hours (shown as date windows); longer zips supported |
| BoB alert box | Lat **10–22**, Lon **92–96** |
| Cyclone threshold | **≥ 65 km/h** |
| Model fields in zip / UI | **2 m temperature**, **10 m wind** only |

## References

These are the sources this showcase and the Colab notebook are built from. The local UI does not call them at runtime.

### Model and article

| What we run | Link |
| --- | --- |
| **FourCastNet** paper (Pathak et al., 2022) — AFNO global model, 0.25°, 6-hour steps | https://arxiv.org/abs/2202.11214 |
| Earth2Studio `FCN` class (the weights this notebook loads, not FourCastNet 3) | https://github.com/NVIDIA/earth2studio/blob/main/earth2studio/models/px/fcn.py |
| Prognostic model list (`FCN`, and `StormScope*` further down) | https://nvidia.github.io/earth2studio/main/modules/models_px/ |
| Earth2Studio docs | https://nvidia.github.io/earth2studio/main/ |
| Earth2Studio repository | https://github.com/NVIDIA/earth2studio |
| NVIDIA Earth-2 | https://www.nvidia.com/en-us/high-performance-computing/earth-2/ |

Installed pin in the notebook: `earth2studio[fcn]==0.20.0`. Inference **exports** `t2m`, `u10m`, and `v10m` only. The other FCN input channels stay inside the model and are **not** shown in the UI.

### Initial conditions

| What | Link |
| --- | --- |
| NOAA GFS on AWS (`noaa-gfs-bdp-pds`, 0.25° `pgrb2`) | https://registry.opendata.aws/noaa-gfs-bdp-pds/ |
| GFS product description | https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast |
| Example object the notebook checks | `https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.{YYYYMMDD}/{HH}/atmos/gfs.t{HH}z.pgrb2.0p25.f000` |

### Storm scan vs StormScope

**In this project.** After FCN finishes, the notebook scans 10 m wind on Lat **10–22°N**, Lon **92–96°E** (Bay of Bengal, west of the Myanmar coast). If the peak is **≥ 65 km/h**, it writes `storm_alert.json`. The website only displays that file.

**Why StormScope is out of scope.** [StormScope](https://nvidia.github.io/earth2studio/main/examples/04_nowcasting/03_stormscope_goes_example/) is a different Earth2Studio family (`StormScopeGOES` / `StormScopeMRMS`). It does short-range **satellite and radar nowcasting**, not the same job as this showcase.

| | This showcase (FourCastNet) | StormScope |
| --- | --- | --- |
| Job | Medium-range **weather rollout** from GFS (hours → ~day) | Minutes-scale **nowcast** of satellite / radar fields |
| Inputs | NOAA **GFS** initial state | **GOES** imagery + **MRMS** radar (and related conditioning) |
| Extra packages | `earth2studio[fcn]` only | Needs StormScope stacks such as **Earth2Grid** / **NATTEN** |
| Geography in examples | Myanmar crop + Bay of Bengal wind box | Official example is CONUS-style GOES/MRMS nowcasting |
| Cyclone HUD here | Peak FCN 10 m wind ≥ 65 km/h → JSON | Not used |

So StormScope is out of scope on purpose: this repo is a **zip-first FourCastNet Myanmar temperature/wind demo**. Pulling StormScope in would mean a second model, different data pipelines, heavier installs, and a different product (nowcasting), not a better version of the same cyclone card. The notebook install cell explicitly skips StormScope extras so a failed StormScope environment does not break the FCN run. The cyclone banner remains the wind-threshold JSON above — not a StormScope nowcast and not a DMH warning.

| Threshold source | What it says |
| --- | --- |
| [IMD terminology (RSMC New Delhi)](https://rsmcnewdelhi.imd.gov.in/images/pdf/terminology.pdf) | Cyclonic storm: **34–47 knots (62–88 km/h)** |
| [WMO/ESCAP Panel TCP-21 (2021)](https://mausam.imd.gov.in/ptc/TCP/TCP2021.pdf) | Same 34-knot floor; **Myanmar** national table matches it |
| [DMH Myanmar](https://www.moezala.gov.mm/) | National meteorological service. This repo does not scrape or replace DMH warnings |

### Attribution

Private office showcase code. FourCastNet, Earth2Studio, GFS, and the IMD/WMO documents stay under their own upstream licenses and terms. Keep those credits when presenting this work.
