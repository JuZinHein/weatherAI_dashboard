import React, { useRef, useEffect, useState, useMemo } from 'react';
import { CityInfo, ForecastDataset, MapLayer, StormAlert } from '../types/forecast';
import {
  REGION_BOUNDS,
  MYANMAR_BORDER_POINTS,
  getTemperatureColor,
  getWindColor,
  sampleGrid,
} from '../utils/geo';
import {
  WEATHER_CATEGORIES,
  WEATHER_VARIABLES,
  WEATHER_VARIABLES_BY_ID,
  WeatherVariableDef,
} from '../services/weatherVariables';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { CityWeatherPopup3D } from './CityWeatherPopup3D';
import {
  Wind,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Maximize2,
  ChevronDown,
  Radio,
} from 'lucide-react';

interface ForecastMap2DProps {
  dataset: ForecastDataset;
  currentStepIndex: number;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  showWindParticles: boolean;
  onToggleWindParticles: () => void;
  stormAlert?: StormAlert | null;
  focusCoords?: { lat: number; lon: number } | null;
}

interface WindParticle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  speed: number;
  flowAngle: number;
}

interface RainParticle {
  lat: number;
  lon: number;
  length: number;
  speed: number;
}

const REGION_LABELS = [
  { name: 'ဘင်္ဂလားပင်လယ်အော်', lon: 92.5, lat: 14.8, type: 'sea' },
  { name: 'ကပ္ပလီပင်လယ်', lon: 95.8, lat: 10.8, type: 'sea' },
  { name: 'မုတ္တမပင်လယ်ကွေ့', lon: 97.2, lat: 16.2, type: 'sea' },
];

export const ForecastMap2D: React.FC<ForecastMap2DProps> = ({
  dataset,
  currentStepIndex,
  selectedCity,
  onSelectCity,
  activeLayer,
  onLayerChange,
  showWindParticles,
  onToggleWindParticles,
  stormAlert,
  focusCoords,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Selected weather variable for the 2D layer
  const [selectedVariableId, setSelectedVariableId] = useState<string>('temperature_2m');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Matplotlib overlay toggle
  const [useMatplotlibOverlay, setUseMatplotlibOverlay] = useState<boolean>(false);
  const matplotlibImgRef = useRef<HTMLImageElement | null>(null);

  // High-Resolution Satellite Base Image
  const satelliteImgRef = useRef<HTMLImageElement | null>(null);
  const [satelliteLoaded, setSatelliteLoaded] = useState(false);

  // Esri Satellite Tile Cache for high-res zooming
  const tileCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const pendingTilesRef = useRef<Set<string>>(new Set());

  // Load NASA/Blue Marble Global Satellite Base Map
  useEffect(() => {
    const img = new Image();
    img.src = '/textures/earth_4k.jpg';
    img.onload = () => {
      satelliteImgRef.current = img;
      setSatelliteLoaded(true);
    };
  }, []);

  // Lead hour string for Matplotlib overlays
  const hourStr = String(dataset.leadHours[currentStepIndex] ?? 0).padStart(2, '0');
  const overlayUrl =
    selectedVariableId.startsWith('wind') || activeLayer === 'wind'
      ? `/forecast_data/layers/wind_${hourStr}h.png`
      : `/forecast_data/layers/temp_${hourStr}h.png`;

  useEffect(() => {
    if (!useMatplotlibOverlay) {
      matplotlibImgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = overlayUrl;
    img.onload = () => {
      matplotlibImgRef.current = img;
    };
  }, [overlayUrl, useMatplotlibOverlay]);

  const [activePopupCity, setActivePopupCity] = useState<CityInfo | null>(null);

  // Probe tooltip state
  const [probe, setProbe] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
    value: number;
    temp: number;
    wind: number;
  } | null>(null);

  // Smooth Zoom & Pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Direct 1:1 dragging refs (avoids React state latency and lost pointer captures)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragDistRef = useRef(0);

  // Focus coordinates effect
  useEffect(() => {
    if (focusCoords && containerRef.current) {
      setZoom(1.9);
      setPan({ x: 70, y: 50 });
    }
  }, [focusCoords]);

  // Pre-generate wind streamlines
  const particlesRef = useRef<WindParticle[]>([]);
  useEffect(() => {
    const particles: WindParticle[] = [];
    for (let i = 0; i < 480; i++) {
      particles.push({
        lat: 8.5 + Math.random() * 21.5,
        lon: 88.0 + Math.random() * 16.0,
        age: Math.floor(Math.random() * 100),
        maxAge: 70 + Math.floor(Math.random() * 60),
        speed: 0.035 + Math.random() * 0.045,
        flowAngle: 0.75 + (Math.random() - 0.5) * 0.4, // SW to NE prevailing airflow
      });
    }
    particlesRef.current = particles;
  }, []);

  // Pre-generate rain particles for precipitation layers
  const rainParticlesRef = useRef<RainParticle[]>([]);
  useEffect(() => {
    const rain: RainParticle[] = [];
    for (let i = 0; i < 180; i++) {
      rain.push({
        lat: 13.0 + Math.random() * 14.0,
        lon: 92.0 + Math.random() * 9.0,
        length: 8 + Math.random() * 12,
        speed: 0.12 + Math.random() * 0.16,
      });
    }
    rainParticlesRef.current = rain;
  }, []);

  const currentTempGrid = dataset.temperatureGrid[currentStepIndex] || dataset.temperatureGrid[0];
  const currentWindGrid = dataset.windGrid[currentStepIndex] || dataset.windGrid[0];
  const currentVarDef: WeatherVariableDef =
    WEATHER_VARIABLES_BY_ID[selectedVariableId] || WEATHER_VARIABLES[0];

  // Canvas render loop
  useEffect(() => {
    let animId: number;
    let pulseTime = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const width = rect.width;
    const height = rect.height;

    // Viewport Geographic Mapping centered on Myanmar
    const baseCenterLat = 19.5;
    const baseCenterLon = 96.5;
    const baseLatSpan = 20.0;

    const latSpan = baseLatSpan / zoom;
    const lonSpan = latSpan * (width / height);

    // Pan translation: directly proportional to drag delta
    const centerLon = baseCenterLon - (pan.x / width) * lonSpan;
    const centerLat = baseCenterLat + (pan.y / height) * latSpan;

    const minLon = centerLon - lonSpan / 2;
    const maxLon = centerLon + lonSpan / 2;
    const minLat = centerLat - latSpan / 2;
    const maxLat = centerLat + latSpan / 2;

    // Coordinate conversion helpers
    const toScreen = (lat: number, lon: number) => {
      const x = ((lon - minLon) / lonSpan) * width;
      const y = ((maxLat - lat) / latSpan) * height;
      return { x, y };
    };

    const render = () => {
      pulseTime += 0.035;
      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Deep Space/Ocean Base
      ctx.fillStyle = '#030816';
      ctx.fillRect(0, 0, width, height);

      // 2. High-Quality Satellite Photographic Base Map
      const satImg = satelliteImgRef.current;
      if (satImg && satImg.complete && satImg.naturalWidth > 0) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Equirectangular mapping: satImg covers [-180, 180] lon and [90, -90] lat
        const srcX = ((minLon + 180) / 360) * satImg.naturalWidth;
        const srcY = ((90 - maxLat) / 180) * satImg.naturalHeight;
        const srcW = ((maxLon - minLon) / 360) * satImg.naturalWidth;
        const srcH = ((maxLat - minLat) / 180) * satImg.naturalHeight;

        ctx.drawImage(satImg, srcX, srcY, srcW, srcH, 0, 0, width, height);

        // Subtle topographic contrast enhancement
        ctx.fillStyle = 'rgba(2, 6, 23, 0.20)';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // 2b. High-Resolution Esri World Imagery Tile Overlay (for crisp terrain upon zooming)
      if (zoom >= 1.2) {
        const z = Math.min(7, Math.max(4, Math.floor(3.8 + Math.log2(zoom))));
        const numTiles = 1 << z;
        const minTx = Math.max(0, Math.floor(((minLon + 180) / 360) * numTiles));
        const maxTx = Math.min(numTiles - 1, Math.floor(((maxLon + 180) / 360) * numTiles));

        // Mercator Y bounds
        const radMax = (Math.min(85, maxLat) * Math.PI) / 180;
        const radMin = (Math.max(-85, minLat) * Math.PI) / 180;
        const minTy = Math.max(0, Math.floor(((1 - Math.log(Math.tan(radMax) + 1 / Math.cos(radMax)) / Math.PI) / 2) * numTiles));
        const maxTy = Math.min(numTiles - 1, Math.floor(((1 - Math.log(Math.tan(radMin) + 1 / Math.cos(radMin)) / Math.PI) / 2) * numTiles));

        ctx.save();
        ctx.globalAlpha = 0.88;
        for (let tx = minTx; tx <= maxTx; tx++) {
          for (let ty = minTy; ty <= maxTy; ty++) {
            const key = `${z}/${ty}/${tx}`;
            const tileImg = tileCacheRef.current.get(key);

            // Tile geo bounds
            const tileMinLon = (tx / numTiles) * 360 - 180;
            const tileMaxLon = ((tx + 1) / numTiles) * 360 - 180;
            const n1 = Math.PI - (2 * Math.PI * ty) / numTiles;
            const tileMaxLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n1) - Math.exp(-n1)));
            const n2 = Math.PI - (2 * Math.PI * (ty + 1)) / numTiles;
            const tileMinLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));

            const p1 = toScreen(tileMaxLat, tileMinLon);
            const p2 = toScreen(tileMinLat, tileMaxLon);

            if (tileImg && tileImg.complete) {
              ctx.drawImage(tileImg, p1.x, p1.y, p2.x - p1.x + 0.5, p2.y - p1.y + 0.5);
            } else if (!pendingTilesRef.current.has(key)) {
              pendingTilesRef.current.add(key);
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`;
              img.onload = () => {
                tileCacheRef.current.set(key, img);
                pendingTilesRef.current.delete(key);
              };
              img.onerror = () => {
                pendingTilesRef.current.delete(key);
              };
            }
          }
        }
        ctx.restore();
      }

      // 3. Matplotlib Raw Overlay (If explicitly toggled)
      if (useMatplotlibOverlay && matplotlibImgRef.current && matplotlibImgRef.current.complete) {
        const pTopLeft = toScreen(REGION_BOUNDS.maxLat, REGION_BOUNDS.minLon);
        const pBotRight = toScreen(REGION_BOUNDS.minLat, REGION_BOUNDS.maxLon);
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.drawImage(matplotlibImgRef.current, pTopLeft.x, pTopLeft.y, pBotRight.x - pTopLeft.x, pBotRight.y - pTopLeft.y);
        ctx.restore();
      }

      // ==========================================================
      // 4. ANIMATED GRAPHICS & DYNAMIC WEATHER OVERLAYS PER VARIABLE
      // ==========================================================

      // (A) HEAT & TEMPERATURE ANIMATION (Thermal Radiance + Heat Shimmer Waves)
      if (
        selectedVariableId.startsWith('temperature') ||
        selectedVariableId === 'apparent_temperature' ||
        selectedVariableId === 'vapour_pressure_deficit'
      ) {
        ctx.save();
        // Central Myanmar Thermal Radiance Bloom (Chauk / Mandalay / Magway high heat zone)
        const heatCenters = [
          { lat: 21.3, lon: 95.0, r: 160, temp: 37, label: '၃၇°C' },
          { lat: 21.9, lon: 96.1, r: 140, temp: 35, label: '၃၅°C' },
          { lat: 16.8, lon: 96.1, r: 120, temp: 33, label: '၃၃°C' },
          { lat: 20.1, lon: 92.9, r: 110, temp: 31, label: '၃၁°C' },
        ];

        heatCenters.forEach((hc) => {
          const pt = toScreen(hc.lat, hc.lon);
          const rad = hc.r * (zoom * 0.85);
          const pulse = Math.sin(pulseTime * 2 + hc.lat) * 8;

          // Glowing thermal radiance radial gradient
          const grad = ctx.createRadialGradient(pt.x, pt.y, 10, pt.x, pt.y, rad + pulse);
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
          grad.addColorStop(0.35, 'rgba(245, 158, 11, 0.30)');
          grad.addColorStop(0.7, 'rgba(251, 191, 36, 0.15)');
          grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, rad + pulse, 0, Math.PI * 2);
          ctx.fill();

          // Isothermal Contour Line
          ctx.strokeStyle = 'rgba(254, 215, 170, 0.50)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (rad + pulse) * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // Atmospheric Heat Haze Shimmer Waves (Animated Undulations)
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.22)';
        ctx.lineWidth = 1.4;
        const p1 = toScreen(23.5, 93.5);
        const p2 = toScreen(19.0, 97.5);
        const startY = Math.min(p1.y, p2.y);
        const endY = Math.max(p1.y, p2.y);

        for (let y = startY; y <= endY; y += 32) {
          ctx.beginPath();
          for (let x = p1.x - 40; x <= p2.x + 40; x += 12) {
            const waveY = y + Math.sin(pulseTime * 2.8 + x * 0.035 + y * 0.05) * 4;
            if (x === p1.x - 40) ctx.moveTo(x, waveY);
            else ctx.lineTo(x, waveY);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // (B) PRECIPITATION / RAIN / DOPPLER RADAR ANIMATION
      else if (
        selectedVariableId === 'radar_reflectivity' ||
        selectedVariableId.startsWith('precipitation') ||
        selectedVariableId === 'rain' ||
        selectedVariableId === 'showers'
      ) {
        ctx.save();
        // Radar Sweep Radar Station (Yangon / Naypyitaw Radar)
        const radarCenter = toScreen(18.5, 96.0);
        const radarRadius = 240 * zoom;
        const sweepAngle = (pulseTime * 1.8) % (Math.PI * 2);

        // Circular range rings
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1;
        [0.35, 0.7, 1.0].forEach((ratio) => {
          ctx.beginPath();
          ctx.arc(radarCenter.x, radarCenter.y, radarRadius * ratio, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Rotating Doppler Sweep Beam with Phosphor Persistence
        const sweepGrad = ctx.createRadialGradient(
          radarCenter.x,
          radarCenter.y,
          0,
          radarCenter.x,
          radarCenter.y,
          radarRadius
        );
        sweepGrad.addColorStop(0, 'rgba(52, 211, 153, 0.5)');
        sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(radarCenter.x, radarCenter.y);
        ctx.arc(radarCenter.x, radarCenter.y, radarRadius, sweepAngle - 0.45, sweepAngle);
        ctx.closePath();
        ctx.fill();

        // Doppler Reflectivity Rain Cells
        const rainCells = [
          { lat: 17.2, lon: 95.8, r: 45, intensity: 'heavy' },
          { lat: 19.8, lon: 93.6, r: 55, intensity: 'moderate' },
          { lat: 15.2, lon: 97.8, r: 40, intensity: 'light' },
          { lat: 24.2, lon: 96.5, r: 35, intensity: 'moderate' },
        ];

        rainCells.forEach((c) => {
          const pt = toScreen(c.lat, c.lon);
          const r = c.r * zoom;
          const p = Math.sin(pulseTime * 3 + c.lat) * 4;

          const cellGrad = ctx.createRadialGradient(pt.x, pt.y, 5, pt.x, pt.y, r + p);
          if (c.intensity === 'heavy') {
            cellGrad.addColorStop(0, 'rgba(239, 68, 68, 0.75)');
            cellGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.55)');
            cellGrad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
          } else if (c.intensity === 'moderate') {
            cellGrad.addColorStop(0, 'rgba(245, 158, 11, 0.70)');
            cellGrad.addColorStop(0.6, 'rgba(34, 197, 94, 0.45)');
            cellGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          } else {
            cellGrad.addColorStop(0, 'rgba(34, 197, 94, 0.65)');
            cellGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.35)');
            cellGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
          }

          ctx.fillStyle = cellGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r + p, 0, Math.PI * 2);
          ctx.fill();
        });

        // Falling Rain Particle Streaks
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.65)';
        ctx.lineWidth = 1.2;
        rainParticlesRef.current.forEach((rp) => {
          rp.lat -= rp.speed * 0.08;
          if (rp.lat < 11.0) rp.lat = 26.5;

          const pos = toScreen(rp.lat, rp.lon);
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(pos.x - 3, pos.y + rp.length);
          ctx.stroke();
        });
        ctx.restore();
      }

      // (C) CLOUD COVER ANIMATION
      else if (selectedVariableId.startsWith('cloud_cover')) {
        ctx.save();
        // Drifting translucent atmospheric cloud banks
        const cloudPuffs = [
          { lat: 22.0, lon: 94.0, size: 140 },
          { lat: 18.5, lon: 97.0, size: 160 },
          { lat: 14.0, lon: 95.0, size: 190 },
          { lat: 25.0, lon: 98.0, size: 120 },
        ];

        cloudPuffs.forEach((puff, idx) => {
          const driftLon = puff.lon + Math.sin(pulseTime * 0.4 + idx) * 0.35;
          const pt = toScreen(puff.lat, driftLon);
          const r = puff.size * zoom;

          const grad = ctx.createRadialGradient(pt.x, pt.y, 20, pt.x, pt.y, r);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
          grad.addColorStop(0.5, 'rgba(241, 245, 249, 0.25)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }

      // (D) ATMOSPHERIC PRESSURE & ISOBARIC CONTOURS
      else if (selectedVariableId.startsWith('pressure')) {
        ctx.save();
        ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = 'rgba(191, 219, 254, 0.9)';

        // Concentric isobar curves
        const isobars = [
          { lat: 16.0, lon: 93.0, r: 80, hPa: 1004 },
          { lat: 16.0, lon: 93.0, r: 150, hPa: 1008 },
          { lat: 16.0, lon: 93.0, r: 230, hPa: 1012 },
          { lat: 16.0, lon: 93.0, r: 310, hPa: 1016 },
        ];

        isobars.forEach((ib) => {
          const pt = toScreen(ib.lat, ib.lon);
          const r = ib.r * zoom;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillText(`${ib.hPa} hPa`, pt.x + r * 0.7, pt.y - r * 0.7);
        });
        ctx.restore();
      }

      // (E) DYNAMIC WIND STREAMLINES (When Wind Layer or Particle Streamlines Active)
      if (showWindParticles || selectedVariableId.startsWith('wind') || activeLayer === 'wind') {
        ctx.save();
        ctx.lineWidth = 1.8;

        particlesRef.current.forEach((p) => {
          p.age += 1;
          if (p.age >= p.maxAge) {
            p.age = 0;
            p.lat = 8.5 + Math.random() * 21.5;
            p.lon = 88.0 + Math.random() * 16.0;
          }

          let windSpeed = 14;
          if (
            p.lat >= REGION_BOUNDS.minLat &&
            p.lat <= REGION_BOUNDS.maxLat &&
            p.lon >= REGION_BOUNDS.minLon &&
            p.lon <= REGION_BOUNDS.maxLon
          ) {
            windSpeed = sampleGrid(currentWindGrid, p.lat, p.lon);
          }

          const flowFactor = (windSpeed / 12) * p.speed;
          // Curve trajectories naturally around the Bay of Bengal into Myanmar
          p.lat += flowFactor * 0.42;
          p.lon += flowFactor * 0.32;

          const pPos = toScreen(p.lat, p.lon);
          const trailPos = toScreen(p.lat - flowFactor * 0.55, p.lon - flowFactor * 0.42);

          const alpha = Math.sin((p.age / p.maxAge) * Math.PI) * 0.85;

          // Velocity-based streamline coloring
          let strokeColor = `rgba(56, 189, 248, ${alpha.toFixed(2)})`; // Cyan for calm
          if (windSpeed > 35) {
            strokeColor = `rgba(244, 63, 94, ${alpha.toFixed(2)})`; // Crimson for gale
          } else if (windSpeed > 22) {
            strokeColor = `rgba(245, 158, 11, ${alpha.toFixed(2)})`; // Amber for strong
          } else if (windSpeed > 14) {
            strokeColor = `rgba(52, 211, 153, ${alpha.toFixed(2)})`; // Emerald for moderate
          }

          ctx.strokeStyle = strokeColor;
          ctx.beginPath();
          ctx.moveTo(trailPos.x, trailPos.y);
          ctx.lineTo(pPos.x, pPos.y);
          ctx.stroke();

          // Particle Comet Head
          if (p.age > p.maxAge * 0.3 && p.age < p.maxAge * 0.85) {
            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.arc(pPos.x, pPos.y, 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.restore();
      }

      // 5. Myanmar national boundary only (no neighbor / coastline overlays)
      // Note: In MYANMAR_BORDER_POINTS, pt[0] is LON, pt[1] is LAT!
      if (MYANMAR_BORDER_POINTS && MYANMAR_BORDER_POINTS.length > 0) {
        ctx.save();
        ctx.beginPath();
        const start = toScreen(MYANMAR_BORDER_POINTS[0][1], MYANMAR_BORDER_POINTS[0][0]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < MYANMAR_BORDER_POINTS.length; i++) {
          const pt = toScreen(MYANMAR_BORDER_POINTS[i][1], MYANMAR_BORDER_POINTS[i][0]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();

        // Crisp white border stroke with drop shadow
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 5;
        ctx.stroke();

        // Glowing emerald neon accent stroke
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.7)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      }

      // 6. Regional Geographic Names (Burmese Typography - Stable & Crisp Legibility)
      REGION_LABELS.forEach((place) => {
        const pos = toScreen(place.lat, place.lon);
        if (pos.x < 45 || pos.x > width + 150 || pos.y < 30 || pos.y > height + 50) return;

        ctx.save();
        ctx.font =
          place.type === 'sea'
            ? 'italic bold 12px "Noto Sans Myanmar", sans-serif'
            : 'bold 11px "Noto Sans Myanmar", sans-serif';
        ctx.fillStyle = place.type === 'sea' ? 'rgba(224, 242, 254, 0.88)' : 'rgba(255, 255, 255, 0.85)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 4;
        ctx.fillText(place.name, pos.x, pos.y);
        ctx.restore();
      });

      // 8. Cyclone Storm Alert Beacon
      if (stormAlert && stormAlert.alert_active && stormAlert.coordinates) {
        const stormPos = toScreen(stormAlert.coordinates.lat, stormAlert.coordinates.lon);
        ctx.save();
        const pulseR = 14 + Math.sin(pulseTime * 3) * 6;

        ctx.beginPath();
        ctx.arc(stormPos.x, stormPos.y, pulseR * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(stormPos.x, stormPos.y, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.font = 'bold 11px "Noto Sans Myanmar", sans-serif';
        ctx.fillStyle = '#fecdd3';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 4;
        ctx.fillText(
          `🚨 ဆိုင်ကလုန်း (${toBurmeseNumber(stormAlert.max_sustained_wind_kmh)} km/h)`,
          stormPos.x + 18,
          stormPos.y + 4
        );
        ctx.restore();
      }

      // 9. City Meteorological Stations (Google Maps Style: High-Legibility, Readable Font in All Situations + Non-Overlapping Placement)
      const cityFontSize = 11.5;
      const badgeH = 22;
      const badgePadX = 7;
      const pinR = 4.5;
      const pinSelectedR = 7;

      // Track placed label bounding boxes to prevent overlapping just like Google Maps
      const placedLabelBoxes: { x1: number; y1: number; x2: number; y2: number }[] = [];

      // Sort order: Selected city first, then major hubs, then secondary towns
      const MAJOR_PRIORITY_CITIES = new Set([
        'Yangon',
        'Mandalay',
        'Nay Pyi Taw',
        'Sittwe',
        'Taunggyi',
        'Myitkyina',
        'Mawlamyine',
        'Dawei',
      ]);

      const sortedCities = [...dataset.cityForecasts].sort((a, b) => {
        if (a.name === selectedCity.name) return -1;
        if (b.name === selectedCity.name) return 1;
        const aMajor = MAJOR_PRIORITY_CITIES.has(a.name) ? 1 : 0;
        const bMajor = MAJOR_PRIORITY_CITIES.has(b.name) ? 1 : 0;
        return bMajor - aMajor;
      });

      sortedCities.forEach((city) => {
        const pos = toScreen(city.lat, city.lon);
        if (pos.x < 45 || pos.x > width + 30 || pos.y < 30 || pos.y > height + 30) return;

        const isSelected = city.name === selectedCity.name;
        const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
        const f = city.forecasts[currentStepIndex] || city.forecasts[0];
        const temp = Math.round(f?.temperatureC ?? 28);

        ctx.save();
        // 1. Draw Clean Pin Marker (Always visible and clickable)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? pinSelectedR : pinR, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#10b981' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();

        // 2. Google Maps Style Label Placement
        const labelText = `${mmName} ${toBurmeseNumber(temp)}°C`;
        ctx.font = `bold ${cityFontSize}px "Noto Sans Myanmar", sans-serif`;
        const textWidth = ctx.measureText(labelText).width;
        const boxW = textWidth + badgePadX * 2;

        // Try candidate positions: Right (preferred), Left, Top, Bottom
        const candidates = [
          { x: pos.x + pinR + 4, y: pos.y - badgeH / 2 },
          { x: pos.x - pinR - 4 - boxW, y: pos.y - badgeH / 2 },
          { x: pos.x - boxW / 2, y: pos.y - pinR - 4 - badgeH },
          { x: pos.x - boxW / 2, y: pos.y + pinR + 4 },
        ];

        let chosenBox: { x: number; y: number } | null = null;

        for (const cand of candidates) {
          // Check bounds
          if (cand.x < 46 || cand.x + boxW > width - 8) continue;
          if (cand.y < 26 || cand.y + badgeH > height - 8) continue;

          // Check collision with already placed labels (2px margin)
          const boxX1 = cand.x - 2;
          const boxY1 = cand.y - 2;
          const boxX2 = cand.x + boxW + 2;
          const boxY2 = cand.y + badgeH + 2;

          const collides = placedLabelBoxes.some(
            (b) => boxX1 < b.x2 && boxX2 > b.x1 && boxY1 < b.y2 && boxY2 > b.y1
          );

          if (!collides) {
            chosenBox = cand;
            placedLabelBoxes.push({ x1: cand.x, y1: cand.y, x2: cand.x + boxW, y2: cand.y + badgeH });
            break;
          }
        }

        // If selected city collides, force placement anyway so user's active choice is always visible!
        if (!chosenBox && isSelected) {
          chosenBox = candidates[0];
          placedLabelBoxes.push({
            x1: chosenBox.x,
            y1: chosenBox.y,
            x2: chosenBox.x + boxW,
            y2: chosenBox.y + badgeH,
          });
        }

        // Render Label Badge if space exists
        if (chosenBox) {
          ctx.fillStyle = isSelected ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.92)';
          ctx.beginPath();
          ctx.roundRect(chosenBox.x, chosenBox.y, boxW, badgeH, 6);
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#34d399' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 2;
          ctx.fillText(labelText, chosenBox.x + badgePadX, chosenBox.y + 15.5);
        }
        ctx.restore();
      });

      // 10. Cursor Probe Crosshair
      if (probe) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(probe.x, 24);
        ctx.lineTo(probe.x, height);
        ctx.moveTo(42, probe.y);
        ctx.lineTo(width, probe.y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(probe.x, probe.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================================
      // 11. FAR-LEFT & FAR-TOP CLEAN RULERS (ZERO MAP CLUTTER!)
      // Pinned strictly to the edges, not inside the center!
      // ==========================================================

      // (A) Top Longitude Ruler Bar
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(0, 0, width, 24);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 24);
      ctx.lineTo(width, 24);
      ctx.stroke();

      ctx.font = 'bold 10px "Noto Sans Myanmar", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';

      for (let lon = 86; lon <= 108; lon += 2) {
        const pt = toScreen(centerLat, lon);
        if (pt.x >= 48 && pt.x <= width - 10) {
          ctx.beginPath();
          ctx.moveTo(pt.x, 16);
          ctx.lineTo(pt.x, 24);
          ctx.stroke();
          ctx.fillText(`${toBurmeseNumber(lon)}°E`, pt.x, 12);
        }
      }
      ctx.restore();

      // (B) Left Latitude Ruler Bar
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.fillRect(0, 0, 42, height);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(42, height);
      ctx.stroke();

      ctx.font = 'bold 10px "Noto Sans Myanmar", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'left';

      for (let lat = 8; lat <= 32; lat += 2) {
        const pt = toScreen(lat, centerLon);
        if (pt.y >= 32 && pt.y <= height - 8) {
          ctx.beginPath();
          ctx.moveTo(35, pt.y);
          ctx.lineTo(42, pt.y);
          ctx.stroke();
          ctx.fillText(`${toBurmeseNumber(lat)}°N`, 6, pt.y + 3.5);
        }
      }
      ctx.restore();

      // (C) Top-Left Intersection Box
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, 42, 24);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.strokeRect(0, 0, 42, 24);
      ctx.font = 'bold 9px "Noto Sans Myanmar", sans-serif';
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'center';
      ctx.fillText('N / E', 21, 15);
      ctx.restore();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    dataset,
    currentStepIndex,
    selectedCity,
    selectedVariableId,
    activeLayer,
    showWindParticles,
    useMatplotlibOverlay,
    zoom,
    pan,
    probe,
    stormAlert,
    satelliteLoaded,
  ]);

  // Pointer move inspection & direct pan handling
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragDistRef.current += Math.hypot(dx, dy);
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // Direct pan translation update
      setPan((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      return;
    }

    // Map screen x/y to lat/lon for probe inspection
    const width = rect.width;
    const height = rect.height;
    const baseCenterLat = 19.5;
    const baseCenterLon = 96.5;
    const baseLatSpan = 20.0;

    const latSpan = baseLatSpan / zoom;
    const lonSpan = latSpan * (width / height);

    const centerLon = baseCenterLon - (pan.x / width) * lonSpan;
    const centerLat = baseCenterLat + (pan.y / height) * latSpan;

    const minLon = centerLon - lonSpan / 2;
    const maxLat = centerLat + latSpan / 2;

    const lat = maxLat - (y / height) * latSpan;
    const lon = minLon + (x / width) * lonSpan;

    if (
      lat >= REGION_BOUNDS.minLat &&
      lat <= REGION_BOUNDS.maxLat &&
      lon >= REGION_BOUNDS.minLon &&
      lon <= REGION_BOUNDS.maxLon
    ) {
      const temp = sampleGrid(currentTempGrid, lat, lon);
      const wind = sampleGrid(currentWindGrid, lat, lon);

      let val = temp;
      if (selectedVariableId.startsWith('wind')) val = wind;
      else if (selectedVariableId === 'apparent_temperature') val = temp + 1.2;
      else if (selectedVariableId === 'relative_humidity_2m')
        val = Math.min(95, Math.max(40, 75 - (temp - 25) * 2));
      else if (selectedVariableId === 'precipitation_probability') val = wind > 15 ? 70 : 25;
      else if (selectedVariableId.startsWith('pressure')) val = 1012;
      else if (selectedVariableId === 'visibility') val = 20;

      setProbe({
        x,
        y,
        lat: Number(lat.toFixed(2)),
        lon: Number(lon.toFixed(2)),
        value: val,
        temp,
        wind,
      });
    } else {
      setProbe(null);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only main click / primary touch
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    dragDistRef.current = 0;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isDraggingRef.current = false;
    }

    // Only handle city click if this was a stationary tap (< 6px movement)
    if (dragDistRef.current < 6) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const width = rect.width;
      const height = rect.height;
      const baseCenterLat = 19.5;
      const baseCenterLon = 96.5;
      const baseLatSpan = 20.0;
      const latSpan = baseLatSpan / zoom;
      const lonSpan = latSpan * (width / height);
      const centerLon = baseCenterLon - (pan.x / width) * lonSpan;
      const centerLat = baseCenterLat + (pan.y / height) * latSpan;
      const minLon = centerLon - lonSpan / 2;
      const maxLat = centerLat + latSpan / 2;

      for (const city of dataset.cityForecasts) {
        const cityX = ((city.lon - minLon) / lonSpan) * width;
        const cityY = ((maxLat - city.lat) / latSpan) * height;
        const dist = Math.hypot(cityX - x, cityY - y);
        if (dist < 22) {
          onSelectCity(city);
          setActivePopupCity(city);
          break;
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.max(0.65, Math.min(5.5, z * factor)));
  };


  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#020617] select-none"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          isDraggingRef.current = false;
          setProbe(null);
        }}
        onWheel={handleWheel}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none block"
      />

      {/* Localized City Weather Popup */}
      {activePopupCity && (
        <CityWeatherPopup3D
          city={activePopupCity}
          currentStepIndex={currentStepIndex}
          onClose={() => setActivePopupCity(null)}
          onSelectCity={(c) => {
            onSelectCity(c);
            setActivePopupCity(null);
          }}
          isSelectedCity={activePopupCity.name === selectedCity.name}
        />
      )}

      {/* Top Left Toolbar (Burmese Buttons) */}
      <div className="absolute top-20 left-12 z-20 flex flex-wrap items-center gap-2">
        {/* Button 1: 2m Temperature */}
        <button
          onClick={() => {
            setSelectedVariableId('temperature_2m');
            onLayerChange('temperature');
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer shadow-lg backdrop-blur-xl ${
            selectedVariableId === 'temperature_2m'
              ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
              : 'border border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <span>၂ မီတာ အပူချိန် (°C)</span>
        </button>

        {/* Button 2: 10m Wind Speed */}
        <button
          onClick={() => {
            setSelectedVariableId('wind_speed_10m');
            onLayerChange('wind');
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer shadow-lg backdrop-blur-xl ${
            selectedVariableId.startsWith('wind')
              ? 'bg-teal-500 text-slate-950 shadow-teal-500/20'
              : 'border border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          <span>၁၀ မီတာ လေတိုက်နှုန်း</span>
        </button>

        {/* Button 3: Doppler Satellite Radar */}
        <button
          onClick={() => {
            setSelectedVariableId('radar_reflectivity');
            onLayerChange('radar');
          }}
          className={`hidden sm:flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer shadow-lg backdrop-blur-xl ${
            selectedVariableId === 'radar_reflectivity'
              ? 'bg-sky-500 text-slate-950 shadow-sky-500/20'
              : 'border border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>ဂြိုဟ်တု ရေဒါ</span>
        </button>

        {/* Button 4: Wind Particles Toggle */}
        <button
          onClick={onToggleWindParticles}
          className={`flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            showWindParticles
              ? 'bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
              : 'bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <span>
            {BURMESE_STRINGS.streamlines} {showWindParticles ? 'ဖွင့်' : 'ပိတ်'}
          </span>
        </button>

        {/* Button 5: Matplotlib Overlays Toggle */}
        <button
          onClick={() => setUseMatplotlibOverlay((v) => !v)}
          className={`hidden md:flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            useMatplotlibOverlay
              ? 'bg-indigo-500/25 border-indigo-500/40 text-indigo-300'
              : 'bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Palette className="h-3.5 w-3.5 text-indigo-400" />
          <span>Matplotlib Overlays {useMatplotlibOverlay ? 'ဖွင့်' : 'ပိတ်'}</span>
        </button>

        {/* Button 6: 32 Variables Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-black/75 px-3.5 py-2 text-xs font-semibold text-slate-300 backdrop-blur-xl transition hover:bg-black/90 hover:text-white cursor-pointer"
          >
            <span>ညွှန်းကိန်း ၃၂ မျိုး</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 top-12 z-50 w-72 max-h-[380px] overflow-y-auto rounded-2xl border border-white/20 bg-black/95 p-2 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 mb-1">
                ရာသီဥတု ညွှန်းကိန်း ရွေးချယ်ရန် (32 Variables)
              </div>

              {WEATHER_CATEGORIES.map((cat) => {
                const varsInCat = WEATHER_VARIABLES.filter((v) => v.categoryId === cat.id);
                return (
                  <div key={cat.id} className="mb-2">
                    <div className="px-2 py-1 text-[10px] font-semibold text-emerald-400">
                      {cat.labelMm}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {varsInCat.map((v) => {
                        const isSelected = selectedVariableId === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVariableId(v.id);
                              if (v.id.startsWith('wind')) onLayerChange('wind');
                              else onLayerChange('temperature');
                              setIsDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition cursor-pointer ${
                              isSelected
                                ? 'bg-white/20 text-white font-bold'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                              <span>{v.labelMm}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{v.unit}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {/* Map Zoom Controls & Fullscreen */}
      <div className="absolute top-20 right-6 z-20 flex flex-col gap-1.5 rounded-2xl border border-white/20 bg-black/75 p-1 backdrop-blur-xl">
        <button
          onClick={() => setZoom((z) => Math.min(5.5, z + 0.35))}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white cursor-pointer"
          title={BURMESE_STRINGS.zoomIn}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.65, z - 0.35))}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white cursor-pointer"
          title={BURMESE_STRINGS.zoomOut}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white cursor-pointer"
          title={BURMESE_STRINGS.resetView}
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <div className="mx-1 h-px bg-white/20" />

        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="rounded-xl p-2 text-emerald-400 hover:bg-emerald-500/20 hover:text-white transition cursor-pointer"
          title="မျက်နှာပြင်အပြည့်ဖွင့်ရန် (Shortcut: [F])"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Live Probe Hover Inspection Glass */}
      {probe && (
        <div className="pointer-events-none absolute bottom-24 left-14 z-20 flex items-center gap-4 rounded-2xl border border-white/20 bg-black/85 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">တည်နေရာ</span>
            <span className="font-mono font-medium">
              {toBurmeseNumber(probe.lat)}°N, {toBurmeseNumber(probe.lon)}°E
            </span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">{currentVarDef.labelMm}</span>
            <span className="font-mono font-bold" style={{ color: currentVarDef.color }}>
              {toBurmeseNumber(probe.value)} {currentVarDef.unit}
            </span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">လေတိုက်နှုန်း</span>
            <span className="font-mono font-bold text-emerald-400">
              {toBurmeseNumber(probe.wind)} km/h
            </span>
          </div>
        </div>
      )}

      {/* Color Scale Legend */}
      <div className="pointer-events-none absolute bottom-24 right-6 z-20 flex flex-col items-end gap-1 rounded-2xl border border-white/20 bg-black/80 p-3 text-[11px] text-slate-300 backdrop-blur-xl shadow-2xl">
        <div className="font-bold text-white">
          {currentVarDef.labelMm} ({currentVarDef.unit})
        </div>
        <div className="flex items-center gap-2">
          <span>
            {toBurmeseNumber(currentVarDef.min)}
            {currentVarDef.unit}
          </span>
          <div
            className="h-2.5 w-36 rounded-full shadow-inner"
            style={{
              background: selectedVariableId.startsWith('wind')
                ? 'linear-gradient(to right, rgb(56, 189, 248), rgb(52, 211, 153), rgb(245, 158, 11), rgb(244, 63, 94))'
                : selectedVariableId.startsWith('temperature')
                ? 'linear-gradient(to right, rgb(56, 189, 248), rgb(251, 191, 36), rgb(245, 158, 11), rgb(239, 68, 68))'
                : 'linear-gradient(to right, rgb(56, 189, 248), rgb(34, 197, 94), rgb(245, 158, 11), rgb(239, 68, 68))',
            }}
          />
          <span>
            {toBurmeseNumber(currentVarDef.max)}
            {currentVarDef.unit}
          </span>
        </div>
      </div>
    </div>
  );
};
