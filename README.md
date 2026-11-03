# Local NVIDIA FourCastNet Myanmar AI Weather Showcase

Open, local-first React + Express showcase for **NVIDIA FourCastNet** regional forecasts over Myanmar.

This repo is **public and free to use**. Clone it, run it offline with the bundled sample, or drop in a Colab/Kaggle forecast `.zip`. No NVIDIA API key is required to run the UI.

Deep dive: [`how_this_works.md`](how_this_works.md)

## What this is

| Piece | Source |
| --- | --- |
| Temperature + 10 m wind forecasts | **NVIDIA FourCastNet (FCN)** via Earth2Studio, started from **NOAA GFS** |
| Storm / cyclone HUD | **Not a separate NVIDIA cyclone model** — a post-process rule on FCN wind in the Bay of Bengal (≥ **65 km/h**) written into `storm_alert.json` |
| Web app | Displays precomputed zip / bundled assets only — **does not call NVIDIA NIM** in this local build |

Research / software showcase. Local forecast skill has **not** been formally validated here.

## Open for everyone

- Repo: https://github.com/hmtun-ai/Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase  
- License: [MIT](LICENSE) for this showcase code  
- NVIDIA FourCastNet / Earth2Studio remain under their own upstream licenses and terms  
- No account or paid API needed to **view** the demo UI locally  

## Requirements

| Need | Notes |
| --- | --- |
| Node.js **20+** | app server + Vite |
| npm | uses `package-lock.json` |
| Modern browser | WebGL for the 3D globe |
| GPU Colab/Kaggle (optional) | only if you want to **export a new zip** |

## Quick start

```bash
git clone https://github.com/hmtun-ai/Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase.git
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
  server.ts                 Express + Vite (serves UI; GET /api/storm-alert)
  notebook/                 Colab / Kaggle GPU export notebooks → forecast .zip
  public/
    forecast_data/          bundled sample layers, configs, storm_alert.json
    textures/               globe / map textures
  src/
    App.tsx                 views, city tour playback, zip drop
    components/             globe, 2D radar map, city panel, cyclone card
    data/                   defaultForecast + forecastData.json
    utils/                  zip / npy parsers, Burmese time windows, geo
  how_this_works.md
  README.md
  LICENSE
```

## UI features

| Action | How |
| --- | --- |
| Play forecast windows | timeline · `Space` play/pause · `←`/`→` step · `F` fullscreen |
| Time labels | Burmese digits, e.g. `၃-၁၁-၂၀၂၆ (၀၀:၀၀ မှ ၀၆:၀၀)` (not `+6h`) |
| Views | 3D globe · 2D Myanmar radar (Myanmar border only) · city trends |
| City tour | while playing: finish all time windows for a city → next city + popup |
| City popup | auto-opens on load / city change; shows that city’s step strip |
| Load forecast | header upload or drag-drop `.zip` |
| Storm HUD | `storm_alert.json` (`alert_active`) → cyclone card + map marker |
| Globe spin | slower default + speed slider (နှေး ↔ မြန်) |

## Forecast zip (how new predictions are made)

Notebooks in `notebook/` (and sibling Colab/Kaggle export notebooks):

1. Ingest latest **GFS** via Earth2Studio  
2. Run **NVIDIA FourCastNet** on GPU  
3. Crop to Myanmar (Lat 9–29°N, Lon 92–102°E)  
4. Scan Bay of Bengal wind (Lat 10–22, Lon 92–96); if ≥ 65 km/h → `storm_alert.json`  
5. Pack `regional_forecast.npz`, CSVs, PNGs, `metadata.json`, `storm_alert.json` into a zip  

Drop that zip into the showcase. The browser **does not** re-run FCN or the storm scan — it only displays what the zip (or bundled sample) already contains.

Expected zip files:

- `regional_forecast.npz` (temp + wind grids)  
- `metadata.json`  
- `storm_alert.json` (optional but needed for cyclone HUD from that run)  
- `all_steps_with_future_flags.csv` / map & trend PNGs  

If a zip has **no** `storm_alert.json`, the app keeps the bundled alert (or none after reset) — it will **not** invent an alert from the wind grid alone.

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

- **Wind values** = NVIDIA FourCastNet  
- **Alert on/off** = threshold rule on those winds (IMD/DMH-style 65 km/h floor), not a dedicated cyclone tracker  

## Server API

| Method | Path | What |
| --- | --- | --- |
| `GET` | `/api/storm-alert` | reads bundled `public/forecast_data/storm_alert.json` |

Zip uploads override the alert in the browser only (no server write).

## Bounds

| Name | Value |
| --- | --- |
| Myanmar crop | Lat **9–29°N**, Lon **92–102°E** (~0.25°) |
| Lead steps | **0, 6, 12, 18, 24, 30** hours (shown as date windows) |
| BoB alert box | Lat **10–22**, Lon **92–96** |
| Cyclone threshold | **≥ 65 km/h** |
| Model fields in zip | **2 m temperature**, **10 m wind** |

## Attribution

- Showcase UI & docs: this repository (MIT)  
- **NVIDIA FourCastNet** / **Earth2Studio**: NVIDIA / upstream projects  
- Initial conditions: **NOAA GFS**  

Please keep upstream credits when you fork or present this work.
