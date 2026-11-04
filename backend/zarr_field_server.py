"""
Local showcase zarr field API — reads project-root forecast.zarr.
Serves /api/meta and /api/field for the MapLibre satellite-radar page.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

import numpy as np
import zarr
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Local_NVIDIA_FourCastNet_Myanmar_AI_Weather_Showcase/
ROOT = Path(__file__).resolve().parents[1]
ZARR_PATH = Path(__file__).resolve().parent.parent / "forecast.zarr"
if not ZARR_PATH.exists():
    ZARR_PATH = ROOT / "forecast.zarr"

REGIONS = {
    "global": {
        "label": "Global",
        "north": 90.0,
        "south": -90.0,
        "west": 0.0,
        "east": 359.75,
    },
    "sea_circle": {
        "label": "Sea circle domain",
        "north": 52.75,
        "south": -36.75,
        "west": 59.5,
        "east": 150.5,
    },
    "full_store": {
        "label": "Full store (SE Asia)",
        "north": 35.0,
        "south": -12.0,
        "west": 75.0,
        "east": 140.0,
    },
    "southeast_asia": {
        "label": "Southeast Asia",
        "north": 35.0,
        "south": -12.0,
        "west": 75.0,
        "east": 140.0,
    },
    "mainland_southeast_asia": {
        "label": "Mainland Southeast Asia",
        "north": 28.0,
        "south": 5.0,
        "west": 92.0,
        "east": 110.0,
    },
    "maritime_southeast_asia": {
        "label": "Maritime Southeast Asia",
        "north": 10.0,
        "south": -12.0,
        "west": 95.0,
        "east": 140.0,
    },
    "bay_of_bengal": {
        "label": "Bay of Bengal",
        "north": 25.0,
        "south": 3.0,
        "west": 80.0,
        "east": 100.0,
    },
    "andaman_sea": {
        "label": "Andaman Sea",
        "north": 17.0,
        "south": 4.0,
        "west": 91.0,
        "east": 100.0,
    },
    "myanmar": {
        "label": "Myanmar",
        "north": 28.6,
        "south": 9.5,
        "west": 92.0,
        "east": 101.2,
    },
}

ConvertFn = Callable[[np.ndarray], np.ndarray]

EARTH2_VARS: dict[str, dict[str, Any]] = {
    "t2m": {
        "label": "Temperature 2 m",
        "unit": "°C",
        "native": "K",
        "convert": lambda a: a - 273.15,
        "cmap": "RdYlBu_r",
        "source": "t2m",
    },
    "t500": {
        "label": "Temperature 500 hPa",
        "unit": "°C",
        "native": "K",
        "convert": lambda a: a - 273.15,
        "cmap": "RdYlBu_r",
        "source": "t500",
    },
    "msl": {
        "label": "Mean sea-level pressure",
        "unit": "hPa",
        "native": "Pa",
        "convert": lambda a: a / 100.0,
        "cmap": "RdYlBu_r",
        "source": "msl",
    },
    "q850": {
        "label": "Specific humidity 850 hPa",
        "unit": "g/kg",
        "native": "kg/kg",
        "convert": lambda a: a * 1000.0,
        "cmap": "YlGnBu",
        "source": "q850",
    },
    "tcwv": {
        "label": "Total column water vapour",
        "unit": "kg/m²",
        "native": "kg/m²",
        "convert": lambda a: a,
        "cmap": "YlGnBu",
        "source": "tcwv",
    },
    "u10m": {
        "label": "U-wind 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "u10m",
    },
    "v10m": {
        "label": "V-wind 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "v10m",
    },
    "wind10m": {
        "label": "Wind speed 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "viridis",
        "source": "wind10m",
        "compute": "wind_speed_10m",
        "note": "Derived as sqrt(u10m² + v10m²)",
    },
    "u100m": {
        "label": "U-wind 100 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "u100m",
    },
    "v100m": {
        "label": "V-wind 100 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "v100m",
    },
    "z500": {
        "label": "Geopotential height 500 hPa",
        "unit": "m",
        "native": "m²/s²",
        "convert": lambda a: a / 9.80665,
        "cmap": "viridis",
        "source": "z500",
        "note": "Converted from geopotential (÷ g)",
    },
}

PANGU_VARS: dict[str, dict[str, Any]] = {
    "t2m": {
        "label": "Temperature 2 m",
        "unit": "°C",
        "native": "K",
        "convert": lambda a: a - 273.15,
        "cmap": "RdYlBu_r",
        "source": "t2m",
    },
    "t500": {
        "label": "Temperature 500 hPa",
        "unit": "°C",
        "native": "K",
        "convert": lambda a: a - 273.15,
        "cmap": "RdYlBu_r",
        "source": "t500",
    },
    "t850": {
        "label": "Temperature 850 hPa",
        "unit": "°C",
        "native": "K",
        "convert": lambda a: a - 273.15,
        "cmap": "RdYlBu_r",
        "source": "t850",
    },
    "msl": {
        "label": "Mean sea-level pressure",
        "unit": "hPa",
        "native": "Pa",
        "convert": lambda a: a / 100.0,
        "cmap": "RdYlBu_r",
        "source": "msl",
    },
    "q850": {
        "label": "Specific humidity 850 hPa",
        "unit": "g/kg",
        "native": "kg/kg",
        "convert": lambda a: a * 1000.0,
        "cmap": "YlGnBu",
        "source": "q850",
    },
    "u10m": {
        "label": "U-wind 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "u10m",
    },
    "v10m": {
        "label": "V-wind 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "RdBu_r",
        "source": "v10m",
    },
    "wind10m": {
        "label": "Wind speed 10 m",
        "unit": "m/s",
        "native": "m/s",
        "convert": lambda a: a,
        "cmap": "viridis",
        "source": "wind10m",
        "compute": "wind_speed_10m",
        "note": "Derived as sqrt(u10m² + v10m²)",
    },
    "z500": {
        "label": "Geopotential height 500 hPa",
        "unit": "m",
        "native": "m",
        "convert": lambda a: a,
        "cmap": "viridis",
        "source": "z500",
    },
}

MODELS: dict[str, dict[str, Any]] = {
    "earth2": {
        "id": "earth2",
        "label": "Earth-2 (global ensemble)",
        "short": "Earth-2",
        "path": ZARR_PATH,
        "source_relative": "forecast.zarr",
        "layout": "ens_time_lead_lat_lon",
        "ensemble_size": 4,
        "has_ensemble": True,
        "reconstruct_lat": None,
        "default_region": "global",
        "regions": ["global", "southeast_asia", "bay_of_bengal", "andaman_sea", "myanmar"],
        "variables": EARTH2_VARS,
        "absent": [],
        "notes": [
            "Global 0.25° Earth-2 ensemble from Local showcase forecast.zarr folder.",
            "MapLibre page frames SE Asia + Bay of Bengal + Andaman Sea.",
            "wind10m derived from u10m/v10m; z500 converted geopotential→height.",
        ],
    },
}

app = FastAPI(title="Local showcase zarr field API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache: dict[str, Any] = {}


def _get_model(model_id: str) -> dict[str, Any]:
    if model_id not in MODELS:
        raise HTTPException(404, f"Unknown model: {model_id}")
    model = MODELS[model_id]
    if not Path(model["path"]).exists():
        raise HTTPException(404, f"Model store missing on disk: {model['source_relative']}")
    return model


def _open_coords(model_id: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, datetime]:
    key = f"coords:{model_id}"
    if key in _cache:
        return _cache[key]

    model = _get_model(model_id)
    zpath: Path = model["path"]
    lon = np.asarray(zarr.open(str(zpath / "lon"), mode="r"), dtype=float)
    lead = np.asarray(zarr.open(str(zpath / "lead_time"), mode="r"))
    time = np.asarray(zarr.open(str(zpath / "time"), mode="r"))
    sample = zarr.open(str(zpath / "t2m"), mode="r")

    if model["reconstruct_lat"]:
        north, south = model["reconstruct_lat"]
        lat = np.linspace(north, south, int(sample.shape[-2]))
    else:
        lat = np.asarray(zarr.open(str(zpath / "lat"), mode="r"), dtype=float)

    lead_hours = lead.astype("timedelta64[h]").astype(int)
    init_utc = _decode_init_utc(time, zpath / "time")
    _cache[key] = (lat, lon, lead_hours, init_utc)
    return _cache[key]


def _decode_init_utc(time_vals: np.ndarray, time_path: Path) -> datetime:
    """Decode store time: native datetime64, or CF 'units' like 'days since …'."""
    arr = np.asarray(time_vals)
    if np.issubdtype(arr.dtype, np.datetime64):
        init_ns = int(arr.astype("datetime64[ns]").astype(np.int64).ravel()[0])
        return datetime.fromtimestamp(init_ns / 1e9, tz=timezone.utc)

    units = ""
    try:
        units = str(zarr.open(str(time_path), mode="r").attrs.get("units", "") or "")
    except Exception:
        units = ""
    # e.g. "days since 2026-11-04 00:00:00"
    if " since " in units:
        unit_name, origin = units.split(" since ", 1)
        origin = origin.strip().replace("T", " ")
        try:
            base = datetime.fromisoformat(origin[:19]).replace(tzinfo=timezone.utc)
        except ValueError:
            base = datetime(1970, 1, 1, tzinfo=timezone.utc)
        offset = float(np.asarray(arr).ravel()[0])
        unit_name = unit_name.strip().lower()
        if unit_name.startswith("day"):
            return base + timedelta(days=offset)
        if unit_name.startswith("hour"):
            return base + timedelta(hours=offset)
        if unit_name.startswith("second"):
            return base + timedelta(seconds=offset)
        return base + timedelta(days=offset)

    # Fallback: treat numeric as unix ns/s if already datetime-like failed
    init_ns = int(arr.astype("datetime64[ns]").astype(np.int64).ravel()[0])
    return datetime.fromtimestamp(init_ns / 1e9, tz=timezone.utc)


def _open_array(model_id: str, name: str):
    key = f"arr:{model_id}:{name}"
    if key not in _cache:
        path = _get_model(model_id)["path"] / name
        if not path.exists():
            raise HTTPException(404, f"Array not in {model_id}: {name}")
        if not (path / "zarr.json").exists():
            raise HTTPException(404, f"Incomplete zarr array (no metadata): {name}")
        _cache[key] = zarr.open(str(path), mode="r")
    return _cache[key]


def _array_has_data(model_id: str, name: str) -> bool:
    model = _get_model(model_id)
    path = model["path"] / name
    if not path.exists() or not (path / "zarr.json").exists():
        return False
    try:
        arr = _open_array(model_id, name)
        if model["layout"] == "ens_time_lead_lat_lon":
            sample = np.asarray(arr[0, 0, 0, :, :], dtype=np.float32)
        else:
            sample = np.asarray(arr[0, 0, :, :], dtype=np.float32)
        return bool(np.count_nonzero(sample) > 0)
    except Exception:
        return False


def _slice_2d(model_id: str, source: str, lead_idx: int, ensemble: str) -> np.ndarray:
    model = _get_model(model_id)
    arr = _open_array(model_id, source)
    layout = model["layout"]

    if layout == "time_lead_lat_lon":
        return np.asarray(arr[0, lead_idx, :, :], dtype=np.float32)

    # ens_time_lead_lat_lon
    if ensemble == "mean":
        acc = np.asarray(arr[0, 0, lead_idx, :, :], dtype=np.float64)
        n = int(arr.shape[0])
        for ei in range(1, n):
            acc += np.asarray(arr[ei, 0, lead_idx, :, :], dtype=np.float64)
        return (acc / n).astype(np.float32)

    try:
        ei = int(ensemble)
    except ValueError as exc:
        raise HTTPException(400, "ensemble must be 'mean' or an integer") from exc
    if ei < 0 or ei >= arr.shape[0]:
        raise HTTPException(400, f"ensemble index out of range 0..{arr.shape[0] - 1}")
    return np.asarray(arr[ei, 0, lead_idx, :, :], dtype=np.float32)


def _load_field(
    model_id: str, cfg: dict[str, Any], lead_idx: int, ensemble: str
) -> np.ndarray:
    compute = cfg.get("compute")
    cache_key = f"field:{model_id}:{cfg.get('source')}:{compute}:{lead_idx}:{ensemble}"
    if cache_key in _cache:
        return _cache[cache_key]

    if compute == "wind_speed_10m":
        u = _slice_2d(model_id, "u10m", lead_idx, ensemble)
        v = _slice_2d(model_id, "v10m", lead_idx, ensemble)
        out = np.sqrt(u * u + v * v).astype(np.float32)
    else:
        out = _slice_2d(model_id, cfg["source"], lead_idx, ensemble)

    _cache[cache_key] = out
    return out


def _model_regions(model: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for rid in model["regions"]:
        r = REGIONS[rid]
        out[rid] = {
            "label": r["label"],
            "north": r["north"],
            "south": r["south"],
            "west": r["west"],
            "east": r["east"],
        }
    return out


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": ZARR_PATH.exists(),
        "zarr_path": str(ZARR_PATH),
        "exists": ZARR_PATH.exists(),
    }


@app.get("/api/models")
def list_models() -> dict[str, Any]:
    items = []
    for mid, m in MODELS.items():
        items.append(
            {
                "id": mid,
                "label": m["label"],
                "short": m["short"],
                "source_relative": m["source_relative"],
                "available": Path(m["path"]).exists(),
                "has_ensemble": m["has_ensemble"],
                "default_region": m["default_region"],
            }
        )
    return {"default": "earth2", "models": items}


@app.get("/api/meta")
def meta(model: str = Query("earth2")) -> dict[str, Any]:
    m = _get_model(model)
    lat, lon, lead_hours, init_utc = _open_coords(model)
    present_dirs = sorted(d.name for d in Path(m["path"]).iterdir() if d.is_dir())

    var_status: dict[str, Any] = {}
    available: list[str] = []
    empty_placeholder: list[str] = []

    for name, cfg in m["variables"].items():
        if cfg.get("compute") == "wind_speed_10m":
            has_data = _array_has_data(model, "u10m") and _array_has_data(model, "v10m")
            exists = has_data
            has_meta = has_data
        else:
            source = cfg["source"]
            path = Path(m["path"]) / source
            exists = path.exists()
            has_meta = (path / "zarr.json").exists() if exists else False
            has_data = _array_has_data(model, source) if has_meta else False

        status = {
            "label": cfg["label"],
            "unit": cfg["unit"],
            "native": cfg["native"],
            "source_array": cfg["source"],
            "exists": exists,
            "has_metadata": has_meta,
            "has_data": has_data,
            "available": has_data,
            "cmap": cfg["cmap"],
            "note": cfg.get("note"),
        }
        var_status[name] = status
        if has_data:
            available.append(name)
        elif exists:
            empty_placeholder.append(name)

    return {
        "model": model,
        "model_label": m["label"],
        "model_short": m["short"],
        "source": str(m["path"]),
        "source_relative": m["source_relative"],
        "has_ensemble": m["has_ensemble"],
        "initialization_utc": init_utc.isoformat(),
        "lead_hours": [int(h) for h in lead_hours],
        "lat_range": [float(lat.min()), float(lat.max())],
        "lon_range": [float(lon.min()), float(lon.max())],
        "grid_shape": [int(lat.size), int(lon.size)],
        "ensemble_size": m["ensemble_size"],
        "default_region": m["default_region"],
        "regions": _model_regions(m),
        "variables": var_status,
        "available_variables": available,
        "empty_placeholder_arrays": empty_placeholder,
        "absent_from_store": m["absent"],
        "store_directories": present_dirs,
        "notes": m["notes"],
        "models": [
            {
                "id": mid,
                "label": mm["label"],
                "short": mm["short"],
                "available": Path(mm["path"]).exists(),
            }
            for mid, mm in MODELS.items()
        ],
    }


def _unwrap_lon_grid(values: np.ndarray, lon: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Reorder a lon axis from 0..360 into ascending -180..180 for MapLibre."""
    lon = np.asarray(lon, dtype=float)
    if float(np.nanmax(lon)) <= 180.0 + 1e-9:
        return values, lon.copy()
    wrapped = np.where(lon > 180.0, lon - 360.0, lon)
    order = np.argsort(wrapped)
    return values[:, order], wrapped[order]


def _parse_bbox(
    bbox: str | None, region_bounds: dict[str, float]
) -> dict[str, float]:
    if not bbox:
        return {
            "west": float(region_bounds["west"]),
            "south": float(region_bounds["south"]),
            "east": float(region_bounds["east"]),
            "north": float(region_bounds["north"]),
        }
    try:
        parts = [float(x.strip()) for x in bbox.split(",")]
    except ValueError as exc:
        raise HTTPException(400, "bbox must be west,south,east,north") from exc
    if len(parts) != 4:
        raise HTTPException(400, "bbox must be west,south,east,north")
    west, south, east, north = parts
    if south >= north:
        raise HTTPException(400, "bbox south must be < north")
    return {"west": west, "south": south, "east": east, "north": north}


def _lon_span(west: float, east: float) -> float:
    if east >= west:
        return east - west
    return (180.0 - west) + (east + 180.0)


def _geo_extent_from_axes(lats: np.ndarray, lons: np.ndarray) -> dict[str, float]:
    """Outer edges of the grid cells represented by these lat/lon *centers*.

    Latitudes are clamped to [-90, 90] — MapLibre image sources reject anything
    outside that range (half-cell padding on a global grid otherwise yields ±90.375).
    """
    dlat = float(abs(lats[0] - lats[1])) if lats.size > 1 else 0.25
    dlon = float(abs(lons[1] - lons[0])) if lons.size > 1 else 0.25
    lat_n = float(max(lats[0], lats[-1]))
    lat_s = float(min(lats[0], lats[-1]))
    lon_w = float(min(lons[0], lons[-1]))
    lon_e = float(max(lons[0], lons[-1]))
    return {
        "north": min(90.0, lat_n + dlat / 2.0),
        "south": max(-90.0, lat_s - dlat / 2.0),
        "west": max(-180.0, lon_w - dlon / 2.0),
        "east": min(180.0, lon_e + dlon / 2.0),
    }


def _downsample_grid(
    crop: np.ndarray, lats: np.ndarray, lons: np.ndarray, max_side: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, list[int]]:
    stride_y = max(1, int(np.ceil(crop.shape[0] / max_side)))
    stride_x = max(1, int(np.ceil(crop.shape[1] / max_side)))
    return (
        crop[::stride_y, ::stride_x],
        lats[::stride_y],
        lons[::stride_x],
        [stride_y, stride_x],
    )


def _pack_part(
    part_id: str, crop: np.ndarray, lats: np.ndarray, lons: np.ndarray, max_side: int
) -> dict[str, Any] | None:
    if crop.size == 0 or lats.size < 2 or lons.size < 2:
        return None
    # Downsample first, then georeference from the *kept* cell centers.
    # Using full-res outer edges with a strided image stretches content north.
    crop, lats, lons, stride = _downsample_grid(crop, lats, lons, max_side)
    if lats.size < 2 or lons.size < 2:
        return None
    # MapLibre image row 0 is the north edge — flip if the crop is south→north.
    if float(lats[0]) < float(lats[-1]):
        crop = crop[::-1]
        lats = lats[::-1]
    if float(lons[0]) > float(lons[-1]):
        crop = crop[:, ::-1]
        lons = lons[::-1]
    extent = _geo_extent_from_axes(lats, lons)
    return {
        "id": part_id,
        "geo_extent": extent,
        "lats": [round(float(x), 4) for x in lats],
        "lons": [round(float(x), 4) for x in lons],
        "values": np.round(crop, 2).tolist(),
        "shape": [int(crop.shape[0]), int(crop.shape[1])],
        "stride": stride,
    }


def _slice_lat_lon(
    values: np.ndarray,
    lat: np.ndarray,
    lon: np.ndarray,
    north: float,
    south: float,
    west: float,
    east: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    lat_mask = (lat <= north + 1e-9) & (lat >= south - 1e-9)
    if east >= west:
        lon_mask = (lon >= west - 1e-9) & (lon <= east + 1e-9)
    else:
        # antimeridian-crossing request: keep both side ranges
        lon_mask = (lon >= west - 1e-9) | (lon <= east + 1e-9)
    if not lat_mask.any() or not lon_mask.any():
        return (
            np.empty((0, 0), dtype=np.float32),
            lat[lat_mask],
            lon[lon_mask],
        )
    return values[np.ix_(lat_mask, lon_mask)], lat[lat_mask], lon[lon_mask]


def _nearest_index(axis: np.ndarray, value: float) -> int:
    return int(np.argmin(np.abs(axis.astype(float) - float(value))))


@app.get("/api/timeseries")
def timeseries(
    model: str = Query("earth2"),
    variable: str = Query("t2m"),
    ensemble: str = Query("mean"),
    points: str = Query(
        ...,
        description="Semicolon-separated name:lat:lon (e.g. Yangon:16.8:96.15;Mandalay:21.97:96.08)",
    ),
) -> dict[str, Any]:
    """Nearest-grid timeseries for city charts (all lead hours × many points)."""
    m = _get_model(model)
    variables: dict[str, dict[str, Any]] = m["variables"]
    if variable not in variables:
        raise HTTPException(404, f"Unknown variable for {model}: {variable}")
    cfg = variables[variable]
    if cfg.get("compute") == "wind_speed_10m":
        ok = _array_has_data(model, "u10m") and _array_has_data(model, "v10m")
    else:
        ok = _array_has_data(model, cfg["source"])
    if not ok:
        raise HTTPException(404, f"{variable} has no usable data in {model}")

    if not m["has_ensemble"]:
        ensemble = "0"

    parsed: list[tuple[str, float, float]] = []
    for chunk in points.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = chunk.split(":")
        if len(parts) != 3:
            raise HTTPException(400, "points must be name:lat:lon;name:lat:lon;...")
        name, lat_s, lon_s = parts
        try:
            parsed.append((name.strip(), float(lat_s), float(lon_s)))
        except ValueError as exc:
            raise HTTPException(400, f"bad point '{chunk}'") from exc
    if not parsed:
        raise HTTPException(400, "no points provided")

    lat, lon, lead_hours, init_utc = _open_coords(model)
    values0 = cfg["convert"](_load_field(model, cfg, 0, ensemble))
    values0, lon_disp = _unwrap_lon_grid(values0, lon)

    # Precompute nearest indices on the display lon axis
    point_idx: list[tuple[str, int, int]] = []
    for name, plat, plon in parsed:
        ri = _nearest_index(lat, plat)
        ci = _nearest_index(lon_disp, plon)
        point_idx.append((name, ri, ci))

    series: dict[str, list[float]] = {name: [] for name, _, _ in point_idx}
    for li, lead in enumerate(lead_hours.tolist()):
        if li == 0:
            field2d = values0
        else:
            raw = _load_field(model, cfg, int(li), ensemble)
            field2d = cfg["convert"](raw)
            field2d, _ = _unwrap_lon_grid(field2d, lon)
        for name, ri, ci in point_idx:
            series[name].append(round(float(field2d[ri, ci]), 2))

    return {
        "model": model,
        "variable": variable,
        "label": cfg["label"],
        "unit": cfg["unit"],
        "ensemble": ensemble if m["has_ensemble"] else "deterministic",
        "initialization_utc": init_utc.isoformat(),
        "lead_hours": [int(x) for x in lead_hours.tolist()],
        "points": [
            {
                "name": name,
                "lat": plat,
                "lon": plon,
                "grid_lat": round(float(lat[_nearest_index(lat, plat)]), 4),
                "grid_lon": round(float(lon_disp[_nearest_index(lon_disp, plon)]), 4),
            }
            for name, plat, plon in parsed
        ],
        "series": series,
    }


@app.get("/api/field")
def field(
    model: str = Query("earth2"),
    variable: str = Query("t2m"),
    region: str = Query("southeast_asia"),
    lead_hour: int = Query(0),
    ensemble: str = Query("mean"),
    bbox: str | None = Query(
        None, description="Optional west,south,east,north in degrees (-180..180)"
    ),
) -> dict[str, Any]:
    m = _get_model(model)
    if region not in m["regions"] or region not in REGIONS:
        raise HTTPException(400, f"Unknown region for {model}: {region}")
    variables: dict[str, dict[str, Any]] = m["variables"]
    if variable not in variables:
        raise HTTPException(404, f"Unknown variable for {model}: {variable}")

    cfg = variables[variable]
    if cfg.get("compute") == "wind_speed_10m":
        ok = _array_has_data(model, "u10m") and _array_has_data(model, "v10m")
    else:
        ok = _array_has_data(model, cfg["source"])
    if not ok:
        raise HTTPException(
            404,
            f"{variable} has no usable data in {model} "
            f"(source '{cfg['source']}' missing or all zeros)",
        )

    if not m["has_ensemble"]:
        ensemble = "0"

    lat, lon, lead_hours, init_utc = _open_coords(model)
    region_bounds = REGIONS[region]
    bounds = _parse_bbox(bbox, region_bounds)

    # Normalize global region stored as 0..359.75 into display -180..180
    if region == "global" and not bbox:
        bounds = {"west": -180.0, "south": -90.0, "east": 180.0, "north": 90.0}

    lead_idxs = np.where(lead_hours == lead_hour)[0]
    if lead_idxs.size == 0:
        raise HTTPException(400, f"lead_hour {lead_hour} not in {model}")
    li = int(lead_idxs[0])

    raw = _load_field(model, cfg, li, ensemble)
    values = cfg["convert"](raw)
    values, lon_disp = _unwrap_lon_grid(values, lon)

    span = _lon_span(bounds["west"], bounds["east"])
    # Dual hemisphere when covering (almost) the whole world
    use_dual = span >= 180.0 - 1e-6 or (
        region == "global" and bbox is None
    )
    # Higher resolution so zoom-in still shows the full field, georeferenced
    max_side = 360 if use_dual else 720
    sample_side = 256 if use_dual else 384

    parts: list[dict[str, Any]] = []
    if use_dual:
        west_crop, west_lats, west_lons = _slice_lat_lon(
            values,
            lat,
            lon_disp,
            bounds["north"],
            bounds["south"],
            -180.0,
            -1e-9,
        )
        east_crop, east_lats, east_lons = _slice_lat_lon(
            values,
            lat,
            lon_disp,
            bounds["north"],
            bounds["south"],
            0.0,
            180.0,
        )
        for pid, c, la, lo in (
            ("a", west_crop, west_lats, west_lons),
            ("b", east_crop, east_lats, east_lons),
        ):
            packed = _pack_part(pid, c, la, lo, max_side)
            if packed:
                parts.append(packed)
        # Sampling grid: stitch both hemispheres in lon order
        sample_crop, sample_lats, sample_lons = _slice_lat_lon(
            values,
            lat,
            lon_disp,
            bounds["north"],
            bounds["south"],
            -180.0,
            180.0,
        )
    else:
        crop, lats, lons = _slice_lat_lon(
            values,
            lat,
            lon_disp,
            bounds["north"],
            bounds["south"],
            bounds["west"],
            bounds["east"],
        )
        if crop.size == 0:
            raise HTTPException(400, "Region/bbox does not intersect store grid")
        packed = _pack_part("a", crop, lats, lons, max_side)
        if not packed:
            raise HTTPException(400, "Region/bbox too small after crop")
        parts = [packed]
        sample_crop, sample_lats, sample_lons = crop, lats, lons

    if not parts:
        raise HTTPException(400, "No drawable field parts for request")

    # Coarse sample grid for probes/cities only (overlays use parts)
    sample_crop, sample_lats, sample_lons, sample_stride = _downsample_grid(
        sample_crop, sample_lats, sample_lons, max_side=sample_side
    )
    sample_extent = _geo_extent_from_axes(
        np.asarray(sample_lats, dtype=float), np.asarray(sample_lons, dtype=float)
    )

    valid = sample_crop[np.isfinite(sample_crop)]
    vmin = float(np.min(valid)) if valid.size else 0.0
    vmax = float(np.max(valid)) if valid.size else 1.0
    # Shared color scale across parts
    for p in parts:
        flat = np.asarray(p["values"], dtype=float).ravel()
        flat = flat[np.isfinite(flat)]
        if flat.size:
            vmin = min(vmin, float(flat.min()))
            vmax = max(vmax, float(flat.max()))

    valid_time = init_utc + timedelta(hours=int(lead_hour))
    display_bounds = {
        "north": bounds["north"],
        "south": bounds["south"],
        "west": bounds["west"] if not use_dual else -180.0,
        "east": bounds["east"] if not use_dual else 180.0,
    }

    return {
        "model": model,
        "model_label": m["label"],
        "source": m["source_relative"],
        "variable": variable,
        "label": cfg["label"],
        "unit": cfg["unit"],
        "cmap": cfg["cmap"],
        "note": cfg.get("note"),
        "region": region,
        "region_label": region_bounds["label"],
        "bounds": display_bounds,
        "geo_extent": sample_extent if len(parts) == 1 else {
            "north": parts[0]["geo_extent"]["north"],
            "south": parts[0]["geo_extent"]["south"],
            "west": -180.0,
            "east": 180.0,
        },
        "parts": parts,
        "lead_hour": lead_hour,
        "ensemble": ensemble if m["has_ensemble"] else "deterministic",
        "initialization_utc": init_utc.isoformat(),
        "valid_utc": valid_time.isoformat(),
        "lats": [round(float(x), 4) for x in sample_lats],
        "lons": [round(float(x), 4) for x in sample_lons],
        "values": np.round(sample_crop, 2).tolist(),
        "vmin": round(vmin, 2),
        "vmax": round(vmax, 2),
        "shape": [int(sample_crop.shape[0]), int(sample_crop.shape[1])],
        "stride": sample_stride,
        "dual": use_dual,
        "bbox": display_bounds,
    }


if __name__ == "__main__":
    import uvicorn

    import os

    port = int(os.environ.get("ZARR_API_PORT", "8766"))
    print(f"[zarr-api] Serving {ZARR_PATH} (exists={ZARR_PATH.exists()}) on :{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, reload=False)
