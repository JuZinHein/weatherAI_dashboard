import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard CRC32 implementation for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPng(width: number, height: number, rgbaData: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: 6 = RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // No filter
    const srcOffset = y * width * 4;
    for (let x = 0; x < width * 4; x++) {
      rawData[rowOffset + 1 + x] = rgbaData[srcOffset + x];
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type: string, data: Buffer): Buffer {
  const length = data.length;
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Colormap RdYlBu_r (Reversed Red-Yellow-Blue)
// Maps t in [0, 1] to RGBA
function colormapRdYlBu_r(t: number): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  // 5 control points: Blue -> Cyan -> Yellow -> Orange -> Red
  const stops = [
    { pos: 0.0, r: 49, g: 54, b: 149 },
    { pos: 0.25, r: 116, g: 173, b: 209 },
    { pos: 0.5, r: 254, g: 224, b: 144 },
    { pos: 0.75, r: 244, g: 109, b: 67 },
    { pos: 1.0, r: 165, g: 0, b: 38 },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clamped >= s1.pos && clamped <= s2.pos) {
      const f = (clamped - s1.pos) / (s2.pos - s1.pos);
      return [
        Math.round(s1.r + f * (s2.r - s1.r)),
        Math.round(s1.g + f * (s2.g - s1.g)),
        Math.round(s1.b + f * (s2.b - s1.b)),
        210, // Transparent overlay for Leaflet
      ];
    }
  }
  return [165, 0, 38, 210];
}

// Colormap viridis (Matplotlib default)
function colormapViridis(t: number): [number, number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const stops = [
    { pos: 0.0, r: 68, g: 1, b: 84 },
    { pos: 0.25, r: 59, g: 82, b: 139 },
    { pos: 0.5, r: 33, g: 145, b: 140 },
    { pos: 0.75, r: 94, g: 201, b: 98 },
    { pos: 1.0, r: 253, g: 231, b: 37 },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (clamped >= s1.pos && clamped <= s2.pos) {
      const f = (clamped - s1.pos) / (s2.pos - s1.pos);
      return [
        Math.round(s1.r + f * (s2.r - s1.r)),
        Math.round(s1.g + f * (s2.g - s1.g)),
        Math.round(s1.b + f * (s2.b - s1.b)),
        210,
      ];
    }
  }
  return [253, 231, 37, 210];
}

// Bilinear interpolation to upscale 41x81 grid to smooth 410x810 image
function interpolateGrid(grid: number[][], targetW: number, targetH: number): Float32Array {
  const srcH = grid.length;
  const srcW = grid[0].length;
  const result = new Float32Array(targetW * targetH);

  for (let y = 0; y < targetH; y++) {
    const gy = (y / (targetH - 1)) * (srcH - 1);
    const y0 = Math.floor(gy);
    const y1 = Math.min(y0 + 1, srcH - 1);
    const dy = gy - y0;

    for (let x = 0; x < targetW; x++) {
      const gx = (x / (targetW - 1)) * (srcW - 1);
      const x0 = Math.floor(gx);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const dx = gx - x0;

      const v00 = grid[y0][x0];
      const v10 = grid[y0][x1];
      const v01 = grid[y1][x0];
      const v11 = grid[y1][x1];

      const val = (1 - dy) * ((1 - dx) * v00 + dx * v10) + dy * ((1 - dx) * v01 + dx * v11);
      result[y * targetW + x] = val;
    }
  }
  return result;
}

export function generateAllAssets(dataJsonPath: string, outDir: string) {
  const raw = fs.readFileSync(dataJsonPath, 'utf-8');
  const dataset = JSON.parse(raw);

  const layersDir = path.join(outDir, 'layers');
  if (!fs.existsSync(layersDir)) {
    fs.mkdirSync(layersDir, { recursive: true });
  }

  const stepsConfig: any[] = [];
  const W = 410;
  const H = 810;

  // Track max wind across all steps in Bay of Bengal region
  // Bay of Bengal: Lat 10 to 22 (approx row indices 28 to 76), Lon 92 to 96 (col indices 0 to 16)
  let peakBobWind = 0;
  let peakBobCoord = { lat: 15.5, lon: 93.5 };
  let peakBobStep = 0;
  let peakBobTimestamp = '';

  dataset.leadHours.forEach((hour: number, idx: number) => {
    const hourStr = String(hour).padStart(2, '0');
    const tempGrid = dataset.temperatureGrid[idx];
    const windGrid = dataset.windGrid[idx];

    // Scan Bay of Bengal in windGrid
    // Grid rows 0 is lat 29 down to row 80 which is lat 9
    // Lat 22 is row (29 - 22)/0.25 = 28
    // Lat 10 is row (29 - 10)/0.25 = 76
    // Lon 92 is col 0, Lon 96 is col (96 - 92)/0.25 = 16
    for (let r = 28; r <= 76; r++) {
      for (let c = 0; c <= 16; c++) {
        const wVal = windGrid[r]?.[c] ?? 0;
        if (wVal > peakBobWind) {
          peakBobWind = wVal;
          peakBobCoord = {
            lat: 29 - r * 0.25,
            lon: 92 + c * 0.25,
          };
          peakBobStep = hour;
          peakBobTimestamp = dataset.validTimesUtc[idx] || '';
        }
      }
    }

    // Upscale for smooth matplotlib-quality raster
    const smoothTemp = interpolateGrid(tempGrid, W, H);
    const smoothWind = interpolateGrid(windGrid, W, H);

    // Temperature bounds: normalize between -5°C and 38°C
    const tempRgba = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const val = smoothTemp[i];
      const norm = (val - (-5)) / (38 - (-5));
      const [r, g, b, a] = colormapRdYlBu_r(norm);
      tempRgba[i * 4] = r;
      tempRgba[i * 4 + 1] = g;
      tempRgba[i * 4 + 2] = b;
      tempRgba[i * 4 + 3] = a;
    }
    const tempPng = createPng(W, H, tempRgba);
    const tempFileName = `temp_${hourStr}h.png`;
    fs.writeFileSync(path.join(layersDir, tempFileName), tempPng);

    // Wind bounds: normalize between 0 and 70 km/h
    const windRgba = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      const val = smoothWind[i];
      const norm = Math.max(0, Math.min(1, val / 65));
      const [r, g, b, a] = colormapViridis(norm);
      windRgba[i * 4] = r;
      windRgba[i * 4 + 1] = g;
      windRgba[i * 4 + 2] = b;
      windRgba[i * 4 + 3] = a;
    }
    const windPng = createPng(W, H, windRgba);
    const windFileName = `wind_${hourStr}h.png`;
    fs.writeFileSync(path.join(layersDir, windFileName), windPng);

    const validUtc = dataset.validTimesUtc[idx] || '';
    const csvRow = dataset.csvRows?.[idx];
    const validMyanmar = csvRow?.validMyanmar || dataset.metadata.final_valid_myanmar;

    // Grid stats
    let minT = 999, maxT = -999, maxW = 0;
    for (const r of tempGrid) {
      for (const v of r) {
        if (v < minT) minT = v;
        if (v > maxT) maxT = v;
      }
    }
    for (const r of windGrid) {
      for (const v of r) {
        if (v > maxW) maxW = v;
      }
    }

    stepsConfig.push({
      lead_hour: hour,
      valid_time_utc: validUtc,
      valid_time_myanmar: validMyanmar,
      temperature_png: `/forecast_data/layers/${tempFileName}`,
      wind_png: `/forecast_data/layers/${windFileName}`,
      min_temp_c: Number(minT.toFixed(2)),
      max_temp_c: Number(maxT.toFixed(2)),
      max_wind_kmh: Number(maxW.toFixed(2)),
    });
  });

  // Step 5: forecast_config.js & forecast_config.json
  const forecastConfig = {
    model: 'NVIDIA FourCastNet v2 (NIM API)',
    pipeline_mode: 'automated_cron',
    initialization_utc: dataset.metadata.initialization_utc || '2026-11-02T00:00:00Z',
    updated_at: new Date().toISOString(),
    bounds: {
      min_lat: 9.0,
      max_lat: 29.0,
      min_lon: 92.0,
      max_lon: 102.0,
      leaflet_bounds: [
        [9.0, 92.0],
        [29.0, 102.0],
      ],
    },
    colormaps: {
      temperature: 'RdYlBu_r',
      wind: 'viridis',
    },
    steps: stepsConfig,
  };

  const jsContent = `/**
 * NVIDIA FourCastNet Myanmar AI Weather Showcase
 * Auto-generated by automated backend forecast pipeline
 * Aligned with Leaflet bounds [[9.0, 92.0], [29.0, 102.0]]
 */
window.FORECAST_CONFIG = ${JSON.stringify(forecastConfig, null, 2)};
`;
  fs.writeFileSync(path.join(outDir, 'forecast_config.js'), jsContent, 'utf-8');
  fs.writeFileSync(path.join(outDir, 'forecast_config.json'), JSON.stringify(forecastConfig, null, 2), 'utf-8');

  // Step 6: Extreme Weather Alerting in Bay of Bengal
  // Check if sustained winds exceed 65 km/h
  // Notice: to allow testing and demo, we can also inject/read simulated cyclonic activity if requested
  const isAlertActive = peakBobWind >= 65.0;

  const stormAlert = {
    alert_active: isAlertActive,
    severity: isAlertActive ? 'CYCLONIC_STORM' : 'NORMAL_MONSOON',
    region: 'Bay of Bengal & Rakhine / Ayeyarwady Coastal Waters',
    region_mm: 'ဘင်္ဂလားပင်လယ်အော်နှင့် မြန်မာ့ကမ်းရိုးတန်း ရေပြင်',
    max_sustained_wind_kmh: Number(peakBobWind.toFixed(1)),
    threshold_kmh: 65.0,
    coordinates: peakBobCoord,
    timestamp: peakBobTimestamp || new Date().toISOString(),
    lead_hour: peakBobStep,
    advisory_en: isAlertActive
      ? 'Cyclone Warning: Sustained winds in the Bay of Bengal exceed 65 km/h. Coastal vessels and marine activities should seek shelter.'
      : 'Bay of Bengal wind conditions are within normal limits (below 65 km/h threshold).',
    advisory_mm: isAlertActive
      ? 'ဆိုင်ကလုန်းမုန်တိုင်း သတိပေးချက် - ဘင်္ဂလားပင်လယ်အော်တွင် လေတိုက်နှုန်း ၆၅ ကီလိုမီတာ/နာရီကျော် မုန်တိုင်းငယ်ဖြစ်ပေါ်နေသဖြင့် ကမ်းနီးကမ်းဝေး ရေယာဉ်များ သတိပြုကြပါရန်။'
      : 'ဘင်္ဂလားပင်လယ်အော် လေတိုက်နှုန်းမှာ ပုံမှန်အခြေအနေတွင် ရှိပါသည် (၆၅ ကီလိုမီတာ/နာရီအောက်)။',
    generated_at: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(outDir, 'storm_alert.json'), JSON.stringify(stormAlert, null, 2), 'utf-8');
  console.log(`Successfully generated forecast config, storm alert (active=${isAlertActive}), and ${stepsConfig.length} layer pairs in ${layersDir}`);
}

// Run if called directly
const rootDir = path.resolve(__dirname, '..');
const dataJson = path.join(rootDir, 'src/data/forecastData.json');
const publicForecastData = path.join(rootDir, 'public/forecast_data');

generateAllAssets(dataJson, publicForecastData);
