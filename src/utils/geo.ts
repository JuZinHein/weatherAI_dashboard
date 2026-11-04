/**
 * Geographic boundaries and visualization helpers for Myanmar Regional Forecast
 * Bounds: Lat 9°N to 29°N, Lon 92°E to 102°E
 */

export const REGION_BOUNDS = {
  minLat: 9.0,
  maxLat: 29.0,
  minLon: 92.0,
  maxLon: 102.0,
};

import myanmarBorderData from '../data/myanmarBorder.json';

// Official high-precision national boundary & coastline polygon for Myanmar (498 points)
// Exactly aligns between 3D Globe equirectangular projection and 2D regional map
export const MYANMAR_BORDER_POINTS: [number, number][] = myanmarBorderData as [number, number][];

export const NEIGHBOR_LABELS = [
  { name: 'Bay of Bengal', lon: 93.0, lat: 14.5, type: 'sea' },
  { name: 'Andaman Sea', lon: 96.0, lat: 11.5, type: 'sea' },
  { name: 'Gulf of Mottama', lon: 97.0, lat: 15.8, type: 'sea' },
  { name: 'India', lon: 93.2, lat: 25.2, type: 'country' },
  { name: 'Bangladesh', lon: 92.4, lat: 22.8, type: 'country' },
  { name: 'China (Yunnan)', lon: 99.8, lat: 25.5, type: 'country' },
  { name: 'Laos', lon: 101.0, lat: 20.5, type: 'country' },
  { name: 'Thailand', lon: 99.5, lat: 17.5, type: 'country' }
];

/**
 * Maps a temperature in °C to an RGB color array [r, g, b]
 * Matches NVIDIA FCN colormap:
 * -7 to 5: Deep Blue (#224296) -> Light Blue (#6baed6)
 * 5 to 15: Cyan (#c6dbef) -> Pale Sand (#ffffbf)
 * 15 to 22: Pale Yellow -> Warm Orange (#fec44f)
 * 22 to 28: Deep Orange (#d95f0e) -> Red Orange (#bd0026)
 * 28 to 35: Crimson (#99000d) -> Wine (#67000d)
 */
export function getTemperatureColor(temp: number): [number, number, number] {
  const stops: { t: number; c: [number, number, number] }[] = [
    { t: -5, c: [34, 66, 150] },
    { t: 0, c: [60, 115, 185] },
    { t: 8, c: [115, 180, 220] },
    { t: 14, c: [198, 225, 240] },
    { t: 18, c: [255, 255, 200] },
    { t: 23, c: [254, 210, 100] },
    { t: 27, c: [245, 130, 45] },
    { t: 30, c: [220, 50, 32] },
    { t: 34, c: [160, 15, 25] },
    { t: 38, c: [105, 5, 15] },
  ];

  if (temp <= stops[0].t) return stops[0].c;
  if (temp >= stops[stops.length - 1].t) return stops[stops.length - 1].c;

  for (let i = 0; i < stops.length - 1; i++) {
    if (temp >= stops[i].t && temp <= stops[i + 1].t) {
      const factor = (temp - stops[i].t) / (stops[i + 1].t - stops[i].t);
      const c1 = stops[i].c;
      const c2 = stops[i + 1].c;
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * factor),
        Math.round(c1[1] + (c2[1] - c1[1]) * factor),
        Math.round(c1[2] + (c2[2] - c1[2]) * factor),
      ];
    }
  }
  return [240, 100, 50];
}

/**
 * Maps wind speed in km/h to RGB color array [r, g, b]
 * Matches NVIDIA FCN wind colormap (Viridis-style / Purple to Yellow)
 * 0 to 4: Deep Indigo / Violet (#440154)
 * 4 to 8: Blue / Cyan (#31688e)
 * 8 to 14: Emerald Teal (#21918c)
 * 14 to 20: Yellow-Green (#5ec962)
 * 20+: Bright Yellow (#fde725)
 */
export function getWindColor(speed: number): [number, number, number] {
  const stops: { s: number; c: [number, number, number] }[] = [
    { s: 0, c: [68, 1, 84] },
    { s: 3, c: [70, 35, 110] },
    { s: 6, c: [49, 104, 142] },
    { s: 10, c: [33, 145, 140] },
    { s: 15, c: [94, 201, 98] },
    { s: 20, c: [200, 220, 40] },
    { s: 25, c: [253, 231, 37] },
  ];

  if (speed <= stops[0].s) return stops[0].c;
  if (speed >= stops[stops.length - 1].s) return stops[stops.length - 1].c;

  for (let i = 0; i < stops.length - 1; i++) {
    if (speed >= stops[i].s && speed <= stops[i + 1].s) {
      const factor = (speed - stops[i].s) / (stops[i + 1].s - stops[i].s);
      const c1 = stops[i].c;
      const c2 = stops[i + 1].c;
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * factor),
        Math.round(c1[1] + (c2[1] - c1[1]) * factor),
        Math.round(c1[2] + (c2[2] - c1[2]) * factor),
      ];
    }
  }
  return [253, 231, 37];
}

/** CSS legend bars — must match getTemperatureColor / getWindColor stops. */
export const TEMPERATURE_LEGEND_GRADIENT =
  'linear-gradient(to right, rgb(34,66,150), rgb(60,115,185), rgb(115,180,220), rgb(198,225,240), rgb(255,255,200), rgb(254,210,100), rgb(245,130,45), rgb(220,50,32), rgb(160,15,25), rgb(105,5,15))';

export const WIND_LEGEND_GRADIENT =
  'linear-gradient(to right, rgb(68,1,84), rgb(70,35,110), rgb(49,104,142), rgb(33,145,140), rgb(94,201,98), rgb(200,220,40), rgb(253,231,37))';

export const TEMPERATURE_LEGEND_RANGE = { min: -5, max: 38, unit: '°C' };
/** Viridis wind scale tops out around 25 km/h; stronger winds stay bright yellow. */
export const WIND_LEGEND_RANGE = { min: 0, max: 25, unit: 'km/h' };

/**
 * Draw a soft, interpolated heatmap (no blocky pixels).
 * Builds a tiny offscreen grid image then stretches it with high-quality smoothing.
 */
export function drawSmoothHeatOverlay(
  ctx: CanvasRenderingContext2D,
  grid: number[][],
  colorFn: (v: number) => [number, number, number],
  toScreen: (lat: number, lon: number) => { x: number; y: number },
  alpha = 0.55,
  clipPath?: [number, number][]
): void {
  const rows = grid?.length ?? 0;
  const cols = grid?.[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return;

  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const octx = off.getContext('2d');
  if (!octx) return;

  const img = octx.createImageData(cols, rows);
  const data = img.data;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [cr, cg, cb] = colorFn(grid[r][c]);
      const i = (r * cols + c) * 4;
      data[i] = cr;
      data[i + 1] = cg;
      data[i + 2] = cb;
      data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);

  const topLeft = toScreen(REGION_BOUNDS.maxLat, REGION_BOUNDS.minLon);
  const botRight = toScreen(REGION_BOUNDS.minLat, REGION_BOUNDS.maxLon);
  const w = botRight.x - topLeft.x;
  const h = botRight.y - topLeft.y;
  if (w <= 1 || h <= 1) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (clipPath && clipPath.length > 2) {
    ctx.beginPath();
    clipPath.forEach(([lon, lat], idx) => {
      const p = toScreen(lat, lon);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(off, topLeft.x, topLeft.y, w, h);
  ctx.restore();
}

export interface MapBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the exact pixel bounding box for the Myanmar forecast region
 * (Lat: 9°N to 29°N, Lon: 92°E to 102°E) preserving the true geographic aspect ratio (1 : 2).
 * ΔLon = 10°, ΔLat = 20° -> Aspect Ratio = 10 / 20 = 0.50 (Width : Height = 1 : 2).
 * Centers the box within the given viewport (width x height) with padding.
 */
export function getTrueRatioMapBounds(
  viewportWidth: number,
  viewportHeight: number,
  padding = 30
): MapBox {
  const availW = Math.max(10, viewportWidth - padding * 2);
  const availH = Math.max(10, viewportHeight - padding * 2);

  // Exact geographic aspect ratio (Δlon / Δlat = 10 / 20 = 0.50)
  const MAP_ASPECT = (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon) / (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat); // 0.50

  let mapW = availH * MAP_ASPECT;
  let mapH = availH;

  if (mapW > availW) {
    mapW = availW;
    mapH = mapW / MAP_ASPECT;
  }

  const mapX = (viewportWidth - mapW) / 2;
  const mapY = (viewportHeight - mapH) / 2;

  return { x: mapX, y: mapY, width: mapW, height: mapH };
}

/**
 * Converts lat/lon to canvas x/y within viewport maintaining TRUE GEOGRAPHIC RATIO (1 : 2)
 */
export function geoToCanvas(
  lat: number,
  lon: number,
  width: number,
  height: number,
  padding = 30,
  preserveAspect = true
): { x: number; y: number } {
  if (preserveAspect) {
    const box = getTrueRatioMapBounds(width, height, padding);
    const x = box.x + ((lon - REGION_BOUNDS.minLon) / (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon)) * box.width;
    const y = box.y + ((REGION_BOUNDS.maxLat - lat) / (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat)) * box.height;
    return { x, y };
  }

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const x = padding + ((lon - REGION_BOUNDS.minLon) / (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon)) * usableWidth;
  const y = padding + ((REGION_BOUNDS.maxLat - lat) / (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat)) * usableHeight;
  return { x, y };
}

/**
 * Converts canvas x/y back to lat/lon maintaining TRUE GEOGRAPHIC RATIO (1 : 2)
 */
export function canvasToGeo(
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 30,
  preserveAspect = true
): { lat: number; lon: number } {
  if (preserveAspect) {
    const box = getTrueRatioMapBounds(width, height, padding);
    const lon = REGION_BOUNDS.minLon + ((x - box.x) / box.width) * (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon);
    const lat = REGION_BOUNDS.maxLat - ((y - box.y) / box.height) * (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat);
    return {
      lat: Math.max(REGION_BOUNDS.minLat, Math.min(REGION_BOUNDS.maxLat, lat)),
      lon: Math.max(REGION_BOUNDS.minLon, Math.min(REGION_BOUNDS.maxLon, lon)),
    };
  }

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const lon = REGION_BOUNDS.minLon + ((x - padding) / usableWidth) * (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon);
  const lat = REGION_BOUNDS.maxLat - ((y - padding) / usableHeight) * (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat);

  return {
    lat: Math.max(REGION_BOUNDS.minLat, Math.min(REGION_BOUNDS.maxLat, lat)),
    lon: Math.max(REGION_BOUNDS.minLon, Math.min(REGION_BOUNDS.maxLon, lon)),
  };
}

/**
 * Bilinear interpolation on an 81x41 grid
 */
export function sampleGrid(grid: number[][], lat: number, lon: number): number {
  if (!grid || grid.length === 0) return 0;
  const latIdx = (29.0 - lat) / 0.25;
  const lonIdx = (lon - 92.0) / 0.25;

  const r0 = Math.max(0, Math.min(80, Math.floor(latIdx)));
  const r1 = Math.max(0, Math.min(80, Math.ceil(latIdx)));
  const c0 = Math.max(0, Math.min(40, Math.floor(lonIdx)));
  const c1 = Math.max(0, Math.min(40, Math.ceil(lonIdx)));

  const rf = latIdx - r0;
  const cf = lonIdx - c0;

  const v00 = grid[r0][c0];
  const v01 = grid[r0][c1];
  const v10 = grid[r1][c0];
  const v11 = grid[r1][c1];

  const top = v00 * (1 - cf) + v01 * cf;
  const bot = v10 * (1 - cf) + v11 * cf;
  return Number((top * (1 - rf) + bot * rf).toFixed(1));
}
