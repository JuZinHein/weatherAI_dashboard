import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WORLD = { west: -180, south: -85.05112878, east: 180, north: 85.05112878 };
const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DEFAULT_OUTPUT = 'public/basemap/offline';
const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 5;
const CONCURRENCY = 6;

function parseArgs(args) {
  const options = {
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    output: DEFAULT_OUTPUT,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/download-offline-basemap.mjs [--min-zoom 0] [--max-zoom 5] [--output public/basemap/offline]'
      );
      process.exit(0);
    }
    if (arg === '--min-zoom' || arg === '--max-zoom' || arg === '--output') {
      const value = args[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      if (arg === '--output') options.output = value;
      else options[arg === '--min-zoom' ? 'minZoom' : 'maxZoom'] = Number(value);
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (
    !Number.isInteger(options.minZoom) ||
    !Number.isInteger(options.maxZoom) ||
    options.minZoom < 0 ||
    options.maxZoom > 12 ||
    options.minZoom > options.maxZoom
  ) {
    throw new Error('Zooms must be integers with 0 <= min-zoom <= max-zoom <= 12');
  }
  return options;
}

function longitudeToTileX(lon, zoom) {
  const count = 2 ** zoom;
  return Math.max(0, Math.min(count - 1, Math.floor(((lon + 180) / 360) * count)));
}

function latitudeToTileY(lat, zoom) {
  const count = 2 ** zoom;
  const radians = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  const mercator = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
  return Math.max(0, Math.min(count - 1, Math.floor(mercator * count)));
}

function listTiles(minZoom, maxZoom) {
  const tiles = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = longitudeToTileX(WORLD.west, z);
    const maxX = longitudeToTileX(WORLD.east, z);
    const minY = latitudeToTileY(WORLD.north, z);
    const maxY = latitudeToTileY(WORLD.south, z);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) tiles.push({ z, x, y });
    }
  }
  return tiles;
}

async function downloadTile(tile, outputDir) {
  const relativePath = path.join(String(tile.z), String(tile.x), `${tile.y}.jpg`);
  const filePath = path.join(outputDir, relativePath);
  try {
    await access(filePath);
    return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const url = TILE_URL.replace('{z}', tile.z).replace('{y}', tile.y).replace('{x}', tile.x);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'image/jpeg,*/*',
          'user-agent': 'weatherAI-dashboard-offline-basemap/1.0',
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const image = Buffer.from(await response.arrayBuffer());
      if (!image.length) throw new Error('Empty tile response');
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, image);
      return true;
    } catch (error) {
      if (attempt === 3) throw new Error(`${tile.z}/${tile.x}/${tile.y}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  return false;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(options.output);
  const tiles = listTiles(options.minZoom, options.maxZoom);
  let nextIndex = 0;
  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  console.log(
    `Downloading ${tiles.length} Esri World Imagery tiles worldwide (zoom ${options.minZoom}–${options.maxZoom})`
  );
  console.log(`Output: ${outputDir}`);

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (nextIndex < tiles.length) {
      const tile = tiles[nextIndex++];
      try {
        if (await downloadTile(tile, outputDir)) downloaded++;
        else skipped++;
      } catch (error) {
        failures.push(error.message);
      }
      const completed = downloaded + skipped + failures.length;
      if (completed % 100 === 0 || completed === tiles.length) {
        console.log(`${completed}/${tiles.length} tiles processed`);
      }
    }
  });
  await Promise.all(workers);

  if (failures.length) {
    console.error(`Failed to download ${failures.length} tile(s):`);
    for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
    if (failures.length > 20) console.error(`- and ${failures.length - 20} more`);
    process.exitCode = 1;
    return;
  }

  await writeFile(
    path.join(outputDir, 'tiles.json'),
    `${JSON.stringify(
      {
        source: 'Esri World Imagery',
        attribution: 'Tiles © Esri',
        bounds: WORLD,
        minzoom: options.minZoom,
        maxzoom: options.maxZoom,
        tileTemplate: './{z}/{x}/{y}.jpg',
        downloadedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
  console.log(`Done: ${downloaded} downloaded, ${skipped} already present.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
