import React, { useRef, useEffect, useState, useMemo } from 'react';
import { CityInfo, ForecastDataset, MapLayer } from '../types/forecast';
import {
  REGION_BOUNDS,
  MYANMAR_BORDER_POINTS,
  getTemperatureColor,
  getWindColor,
  sampleGrid,
  drawSmoothHeatOverlay,
  TEMPERATURE_LEGEND_GRADIENT,
  WIND_LEGEND_GRADIENT,
  TEMPERATURE_LEGEND_RANGE,
  WIND_LEGEND_RANGE,
} from '../utils/geo';
import {
  WEATHER_VARIABLES,
  WEATHER_VARIABLES_BY_ID,
} from '../services/weatherVariables';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { CityWeatherPopup3D } from './CityWeatherPopup3D';
import {
  Wind,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ChevronDown,
  Layers,
  Thermometer,
} from 'lucide-react';

/** Zip exports only these two forecast fields. */
const ZIP_FORECAST_FIELDS = WEATHER_VARIABLES;

interface ForecastMap2DProps {
  dataset: ForecastDataset;
  currentStepIndex: number;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
  activeLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  showWindParticles: boolean;
  onToggleWindParticles: () => void;
}

interface WindParticle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  speed: number;
  flowAngle: number;
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Zip has only 2 forecast fields — smooth heatmaps, one-by-one or together
  const [showTempLayer, setShowTempLayer] = useState(true);
  const [showWindLayer, setShowWindLayer] = useState(false);
  const [probeFocusId, setProbeFocusId] = useState<string>('temperature_2m');
  const [isVariableMenuOpen, setIsVariableMenuOpen] = useState(false);

  const bothZipLayersOn = showTempLayer && showWindLayer;
  const anyZipLayerOn = showTempLayer || showWindLayer;
  const everythingOn = showTempLayer && showWindLayer && showWindParticles;

  const selectProbeFocus = (id: string) => {
    setProbeFocusId(id);
    onLayerChange(id.startsWith('wind') ? 'wind' : 'temperature');
  };

  const toggleTempLayer = () => {
    setShowTempLayer((on) => {
      const next = !on;
      if (next) selectProbeFocus('temperature_2m');
      else if (showWindLayer) selectProbeFocus('wind_speed_10m');
      return next;
    });
  };

  const toggleWindLayer = () => {
    setShowWindLayer((on) => {
      const next = !on;
      if (next) {
        selectProbeFocus('wind_speed_10m');
        if (!showWindParticles) onToggleWindParticles();
      } else if (showTempLayer) {
        selectProbeFocus('temperature_2m');
      }
      return next;
    });
  };

  const enableEverything = () => {
    setShowTempLayer(true);
    setShowWindLayer(true);
    selectProbeFocus('temperature_2m');
    if (!showWindParticles) onToggleWindParticles();
  };

  const disableEverything = () => {
    setShowTempLayer(true);
    setShowWindLayer(false);
    selectProbeFocus('temperature_2m');
    if (showWindParticles) onToggleWindParticles();
  };

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

  const currentTempGrid = dataset.temperatureGrid[currentStepIndex] || dataset.temperatureGrid[0];
  const currentWindGrid = dataset.windGrid[currentStepIndex] || dataset.windGrid[0];
  const currentVarDef =
    WEATHER_VARIABLES_BY_ID[probeFocusId] || WEATHER_VARIABLES[0];

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
              // Offline mode: do not fetch remote Esri tiles. Local earth texture only.
              pendingTilesRef.current.delete(key);
            }
          }
        }
        ctx.restore();
      }

      // 3. Soft interpolated forecast overlays (no block pixels, no Matplotlib PNGs)
      // Temp = filled smooth heat · Wind alone = smooth heat · Both = temp heat + streamlines
      if (showTempLayer && currentTempGrid) {
        drawSmoothHeatOverlay(
          ctx,
          currentTempGrid,
          getTemperatureColor,
          toScreen,
          bothZipLayersOn ? 0.5 : 0.58,
          MYANMAR_BORDER_POINTS
        );
      } else if (showWindLayer && currentWindGrid) {
        drawSmoothHeatOverlay(
          ctx,
          currentWindGrid,
          getWindColor,
          toScreen,
          0.55,
          MYANMAR_BORDER_POINTS
        );
      }

      // 4. Wind streamlines (used when wind layer / streamlines toggle is on)
      if (showWindParticles || showWindLayer) {
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

      // 8. City Meteorological Stations
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
    probeFocusId,
    activeLayer,
    showWindParticles,
    showTempLayer,
    showWindLayer,
    anyZipLayerOn,
    bothZipLayersOn,
    zoom,
    pan,
    probe,
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

      const val = probeFocusId.startsWith('wind') ? wind : temp;

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

      {/* Top Left — one-by-one zip layers + Everything */}
      <div className="absolute top-20 left-12 z-20 flex max-w-[min(980px,calc(100vw-6rem))] flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsVariableMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-black/80 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-xl transition hover:bg-black/90 cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span className="max-w-[220px] truncate">
              {bothZipLayersOn
                ? 'အပူချိန် + လေ (၂ မျိုး)'
                : `${currentVarDef.labelMm} (${currentVarDef.unit})`}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${isVariableMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isVariableMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close"
                onClick={() => setIsVariableMenuOpen(false)}
              />
              <div className="absolute left-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/20 bg-black/95 shadow-2xl backdrop-blur-2xl">
                <div className="border-b border-white/10 px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Zip ညွှန်းကိန်း — တစ်ခုချင်း / အားလုံး
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    ၂ မျိုးသာ · timeline ဖြင့် animate လုပ်သည်
                  </div>
                </div>
                <div className="p-1.5 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (everythingOn) disableEverything();
                      else enableEverything();
                      setIsVariableMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                      everythingOn
                        ? 'bg-emerald-500/25 text-emerald-100 font-bold border border-emerald-400/40'
                        : 'text-slate-200 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <span>အားလုံး ဖွင့် (temp + wind + streamlines)</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {everythingOn ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {ZIP_FORECAST_FIELDS.map((v) => {
                    const isTemp = v.id === 'temperature_2m';
                    const enabled = isTemp ? showTempLayer : showWindLayer;
                    const isFocus = probeFocusId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (isTemp) toggleTempLayer();
                          else toggleWindLayer();
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition cursor-pointer ${
                          enabled
                            ? 'bg-white/15 text-white font-semibold'
                            : 'text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isTemp ? (
                            <Thermometer className="h-3.5 w-3.5 shrink-0" style={{ color: v.color }} />
                          ) : (
                            <Wind className="h-3.5 w-3.5 shrink-0" style={{ color: v.color }} />
                          )}
                          <span className="truncate">{v.labelMm}</span>
                          {enabled && isFocus && (
                            <span className="text-[9px] text-emerald-400">focus</span>
                          )}
                        </div>
                        <span className="ml-2 shrink-0 font-mono text-[10px]">
                          {enabled ? 'ဖွင့်' : 'ပိတ်'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleTempLayer}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            showTempLayer
              ? 'border-amber-500/40 bg-amber-500/25 text-amber-200'
              : 'border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Thermometer className="h-3.5 w-3.5" />
          အပူချိန် {showTempLayer ? 'ဖွင့်' : 'ပိတ်'}
        </button>

        <button
          type="button"
          onClick={toggleWindLayer}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            showWindLayer
              ? 'border-teal-500/40 bg-teal-500/25 text-teal-200'
              : 'border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          လေ {showWindLayer ? 'ဖွင့်' : 'ပိတ်'}
        </button>

        <button
          type="button"
          onClick={() => (everythingOn ? disableEverything() : enableEverything())}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            everythingOn
              ? 'border-emerald-500/50 bg-emerald-500/30 text-emerald-100'
              : 'border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
          title="Smooth temp heat + wind streamlines"
        >
          <Layers className="h-3.5 w-3.5" />
          အားလုံး {everythingOn ? 'ဖွင့်' : 'ပိတ်'}
        </button>

        <button
          type="button"
          onClick={onToggleWindParticles}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold backdrop-blur-xl transition cursor-pointer ${
            showWindParticles
              ? 'border-emerald-500/40 bg-emerald-500/25 text-emerald-300'
              : 'border-white/20 bg-black/75 text-slate-300 hover:text-white'
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          {BURMESE_STRINGS.streamlines} {showWindParticles ? 'ဖွင့်' : 'ပိတ်'}
        </button>
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
      {probe && anyZipLayerOn && (
        <div className="pointer-events-none absolute bottom-24 left-14 z-20 flex items-center gap-4 rounded-2xl border border-white/20 bg-black/85 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">တည်နေရာ</span>
            <span className="font-mono font-medium">
              {toBurmeseNumber(probe.lat)}°N, {toBurmeseNumber(probe.lon)}°E
            </span>
          </div>
          {showTempLayer && (
            <>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">အပူချိန်</span>
                <span className="font-mono font-bold text-amber-300">
                  {toBurmeseNumber(probe.temp)} °C
                </span>
              </div>
            </>
          )}
          {showWindLayer && (
            <>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400">လေတိုက်နှုန်း</span>
                <span className="font-mono font-bold text-teal-300">
                  {toBurmeseNumber(probe.wind)} km/h
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Color Scale Legend — for the active smooth heat field */}
      {anyZipLayerOn && (
        <div className="pointer-events-none absolute bottom-24 right-6 z-20 flex flex-col items-end gap-2">
          {(showTempLayer
            ? ['temperature_2m']
            : showWindLayer
              ? ['wind_speed_10m']
              : []
          ).map((id) => {
            const isWind = id.startsWith('wind');
            const def = WEATHER_VARIABLES_BY_ID[id] || WEATHER_VARIABLES[0];
            const range = isWind ? WIND_LEGEND_RANGE : TEMPERATURE_LEGEND_RANGE;
            const gradient = isWind ? WIND_LEGEND_GRADIENT : TEMPERATURE_LEGEND_GRADIENT;
            return (
              <div
                key={id}
                className="flex flex-col items-end gap-1 rounded-2xl border border-white/20 bg-black/80 p-3 text-[11px] text-slate-300 backdrop-blur-xl shadow-2xl"
              >
                <div className="font-bold text-white">
                  {def.labelMm} ({def.unit})
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {toBurmeseNumber(range.min)}
                    {range.unit}
                  </span>
                  <div
                    className="h-2.5 w-36 rounded-full shadow-inner"
                    style={{ background: gradient }}
                  />
                  <span>
                    {toBurmeseNumber(range.max)}
                    {isWind ? '+' : ''}
                    {range.unit}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {bothZipLayersOn
                    ? 'smooth heat + wind streamlines'
                    : 'smooth interpolated heat'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
