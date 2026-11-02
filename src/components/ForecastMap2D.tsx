import React, { useRef, useEffect, useState } from 'react';
import { CityInfo, ForecastDataset, MapLayer, StormAlert } from '../types/forecast';
import {
  REGION_BOUNDS,
  MYANMAR_BORDER_POINTS,
  getTemperatureColor,
  getWindColor,
  geoToCanvas,
  canvasToGeo,
  sampleGrid,
  getTrueRatioMapBounds,
} from '../utils/geo';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { CityWeatherPopup3D } from './CityWeatherPopup3D';
import { Layers, Wind, Eye, ZoomIn, ZoomOut, RotateCcw, Flame, Radio, Palette, Scaling, Maximize2 } from 'lucide-react';

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
}

const BURMESE_NEIGHBORS = [
  { name: 'ဘင်္ဂလားပင်လယ်အော်', lon: 93.2, lat: 14.8, type: 'sea' },
  { name: 'ကပ္ပလီပင်လယ်', lon: 96.5, lat: 11.2, type: 'sea' },
  { name: 'မုတ္တမပင်လယ်ကွေ့', lon: 97.2, lat: 16.0, type: 'sea' },
  { name: 'အိန္ဒိယ', lon: 93.0, lat: 25.5, type: 'country' },
  { name: 'ဘင်္ဂလားဒေ့ရှ်', lon: 92.4, lat: 23.0, type: 'country' },
  { name: 'တရုတ်', lon: 99.8, lat: 26.0, type: 'country' },
  { name: 'လာအို', lon: 101.2, lat: 20.5, type: 'country' },
  { name: 'ထိုင်း', lon: 99.8, lat: 17.5, type: 'country' },
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

  // High-resolution calibrated daytime satellite texture (exact geographic bounds matching 3D globe)
  const dayImgRef = useRef<HTMLImageElement | null>(null);

  // Matplotlib transparent PNG overlay support (RdYlBu_r & viridis)
  const [useMatplotlibOverlay, setUseMatplotlibOverlay] = useState<boolean>(true);
  const matplotlibImgRef = useRef<HTMLImageElement | null>(null);

  const hourStr = String(dataset.leadHours[currentStepIndex] ?? 0).padStart(2, '0');
  const overlayUrl = activeLayer === 'temperature'
    ? `/forecast_data/layers/temp_${hourStr}h.png`
    : activeLayer === 'wind'
    ? `/forecast_data/layers/wind_${hourStr}h.png`
    : null;

  useEffect(() => {
    if (!overlayUrl) {
      matplotlibImgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = overlayUrl;
    img.onload = () => {
      matplotlibImgRef.current = img;
    };
  }, [overlayUrl]);

  // Center on coordinates if requested (e.g. from CycloneWarningCard)
  useEffect(() => {
    if (focusCoords && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 20;
      const targetPos = geoToCanvas(focusCoords.lat, focusCoords.lon, rect.width, rect.height, padding);
      setPan({
        x: (rect.width / 2 - targetPos.x) * 1.5,
        y: (rect.height / 2 - targetPos.y) * 1.5,
      });
      setZoom(2.2);
    }
  }, [focusCoords]);

  useEffect(() => {
    const dayImg = new Image();
    dayImg.src = '/textures/earth_hd.jpg';
    dayImg.onload = () => {
      dayImgRef.current = dayImg;
    };
  }, []);

  const [activePopupCity, setActivePopupCity] = useState<CityInfo | null>(null);

  // Probe tooltip state
  const [probe, setProbe] = useState<{
    x: number;
    y: number;
    lat: number;
    lon: number;
    temp: number;
    wind: number;
  } | null>(null);

  // Smooth Zoom & Pan (Google Earth 2D style)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Pre-generate wind particles
  const particlesRef = useRef<WindParticle[]>([]);
  useEffect(() => {
    const particles: WindParticle[] = [];
    for (let i = 0; i < 300; i++) {
      particles.push({
        lat: REGION_BOUNDS.minLat + Math.random() * (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat),
        lon: REGION_BOUNDS.minLon + Math.random() * (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon),
        age: Math.floor(Math.random() * 80),
        maxAge: 70 + Math.floor(Math.random() * 50),
        speed: 0.04 + Math.random() * 0.05,
      });
    }
    particlesRef.current = particles;
  }, []);

  const currentTempGrid = dataset.temperatureGrid[currentStepIndex] || dataset.temperatureGrid[0];
  const currentWindGrid = dataset.windGrid[currentStepIndex] || dataset.windGrid[0];

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

    // Offscreen canvas for forecast numerical raster (41x81)
    const offscreen = document.createElement('canvas');
    offscreen.width = 41;
    offscreen.height = 81;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      const imgData = offCtx.createImageData(41, 81);
      const data = imgData.data;

      for (let r = 0; r < 81; r++) {
        for (let c = 0; c < 41; c++) {
          const idx = (r * 41 + c) * 4;
          const tempVal = currentTempGrid[r][c];
          const windVal = currentWindGrid[r][c];

          let rgb: [number, number, number];
          if (activeLayer === 'temperature') {
            rgb = getTemperatureColor(tempVal);
          } else if (activeLayer === 'wind') {
            rgb = getWindColor(windVal);
          } else {
            // Doppler satellite radar precipitation echo
            if (windVal > 16 || (tempVal > 31 && r > 20)) {
              rgb = [239, 68, 68];
            } else if (windVal > 13) {
              rgb = [245, 158, 11];
            } else if (windVal > 8) {
              rgb = [34, 197, 94];
            } else {
              rgb = [56, 189, 248];
            }
          }

          data[idx] = rgb[0];
          data[idx + 1] = rgb[1];
          data[idx + 2] = rgb[2];
          data[idx + 3] = activeLayer === 'satellite' ? 95 : 135;
        }
      }
      offCtx.putImageData(imgData, 0, 0);
    }

    const render = () => {
      pulseTime += 0.035;
      ctx.save();
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      const padding = 24;
      const mapBox = getTrueRatioMapBounds(width, height, padding);
      const { x: mapX, y: mapY, width: mapW, height: mapH } = mapBox;

      // 1. Draw Proper High-Resolution Calibrated Daytime Satellite Map Underlay in True Ratio (1:2)
      const activeSatelliteImg = dayImgRef.current;
      if (activeSatelliteImg && activeSatelliteImg.complete) {
        // Mathematically exact sub-rectangle crop for Lat 9°N-29°N, Lon 92°E-102°E
        // Exactly matches 360° x 180° equirectangular Three.js globe geometry
        const sx = ((REGION_BOUNDS.minLon + 180) / 360) * activeSatelliteImg.width;
        const sy = ((90 - REGION_BOUNDS.maxLat) / 180) * activeSatelliteImg.height;
        const sWidth = ((REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon) / 360) * activeSatelliteImg.width;
        const sHeight = ((REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat) / 180) * activeSatelliteImg.height;

        ctx.drawImage(activeSatelliteImg, sx, sy, sWidth, sHeight, mapX, mapY, mapW, mapH);
      } else {
        ctx.fillStyle = '#0a192f';
        ctx.fillRect(mapX, mapY, mapW, mapH);
      }

      // 2. Draw Numerical Forecast Radar / Heat Layer in exact True Ratio (1:2)
      // Seamlessly switches between high-res Matplotlib PNG overlay (RdYlBu_r / viridis) or native canvas grid
      const mplImg = matplotlibImgRef.current;
      if (useMatplotlibOverlay && mplImg && mplImg.complete && activeLayer !== 'satellite') {
        ctx.save();
        ctx.globalAlpha = 0.70;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(mplImg, mapX, mapY, mapW, mapH);
        ctx.restore();
      } else {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = activeLayer === 'satellite' ? 0.52 : 0.72;
        ctx.drawImage(offscreen, mapX, mapY, mapW, mapH);
        ctx.restore();
      }

      // 3. Graticule Lat/Lon Lines (Bounded strictly within True Ratio map frame)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

      for (let lat = 10; lat <= 28; lat += 2) {
        const { y } = geoToCanvas(lat, 92, width, height, padding);
        ctx.beginPath();
        ctx.moveTo(mapX, y);
        ctx.lineTo(mapX + mapW, y);
        ctx.stroke();
        ctx.fillText(`${toBurmeseNumber(lat)}°N`, mapX + 6, y - 4);
      }

      for (let lon = 94; lon <= 102; lon += 2) {
        const { x } = geoToCanvas(9, lon, width, height, padding);
        ctx.beginPath();
        ctx.moveTo(x, mapY);
        ctx.lineTo(x, mapY + mapH);
        ctx.stroke();
        ctx.fillText(`${toBurmeseNumber(lon)}°E`, x + 3, mapY + mapH - 8);
      }

      // Outer boundary frame with cyan accent glow
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mapX, mapY, mapW, mapH);

      // 4. Glowing Myanmar National Boundary Outline
      ctx.beginPath();
      MYANMAR_BORDER_POINTS.forEach(([lon, lat], i) => {
        const pos = geoToCanvas(lat, lon, width, height, padding);
        if (i === 0) ctx.moveTo(pos.x, pos.y);
        else ctx.lineTo(pos.x, pos.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 5. Regional & Sea Labels in Burmese
      BURMESE_NEIGHBORS.forEach((lbl) => {
        const p = geoToCanvas(lbl.lat, lbl.lon, width, height, padding);
        if (lbl.type === 'sea') {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.9)';
          ctx.font = 'italic 600 13px "Noto Sans Myanmar", sans-serif';
        } else {
          ctx.fillStyle = 'rgba(241, 245, 249, 0.7)';
          ctx.font = '600 12px "Noto Sans Myanmar", sans-serif';
        }
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(lbl.name, p.x, p.y);
        ctx.shadowBlur = 0;
      });

      // 5b. Animated Bay of Bengal Cyclone Warning Radar Beacon
      if (stormAlert && stormAlert.alert_active && stormAlert.coordinates) {
        const cPos = geoToCanvas(stormAlert.coordinates.lat, stormAlert.coordinates.lon, width, height, padding);
        const ringRadius = 14 + (Math.sin(pulseTime * 3) + 1) * 12;

        // Expanding outer red/amber warning ring
        ctx.beginPath();
        ctx.arc(cPos.x, cPos.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cPos.x, cPos.y, ringRadius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.85)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Inner cyclone eye
        ctx.beginPath();
        ctx.arc(cPos.x, cPos.y, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cyclone label badge
        const cycloneLabel = `🚨 ဆိုင်ကလုန်းမုန်တိုင်း ${toBurmeseNumber(stormAlert.max_sustained_wind_kmh)} km/h`;
        ctx.font = 'bold 12px "Noto Sans Myanmar", sans-serif';
        const cMetrics = ctx.measureText(cycloneLabel);
        const cW = cMetrics.width + 16;
        const cH = 24;
        const cX = cPos.x - cW / 2;
        const cY = cPos.y - 34;

        ctx.fillStyle = 'rgba(159, 18, 57, 0.95)';
        ctx.beginPath();
        ctx.roundRect(cX, cY, cW, cH, 6);
        ctx.fill();
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(cycloneLabel, cX + 8, cY + 16);
      }

      // 6. Animated Wind Streamlines
      if (showWindParticles) {
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        particlesRef.current.forEach((pt) => {
          const windVal = sampleGrid(currentWindGrid, pt.lat, pt.lon);
          const angle = Math.PI * 1.15 + (pt.lat / 29) * 0.2;
          const speed = (windVal / 25) * 0.08 + 0.02;

          const oldPos = geoToCanvas(pt.lat, pt.lon, width, height, padding);
          pt.lon += Math.cos(angle) * speed;
          pt.lat += Math.sin(angle) * speed * 0.7;
          pt.age += 1;

          const newPos = geoToCanvas(pt.lat, pt.lon, width, height, padding);

          const alpha = Math.sin((pt.age / pt.maxAge) * Math.PI) * 0.8;
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(oldPos.x, oldPos.y);
          ctx.lineTo(newPos.x, newPos.y);
          ctx.stroke();

          if (
            pt.age >= pt.maxAge ||
            pt.lat < REGION_BOUNDS.minLat ||
            pt.lat > REGION_BOUNDS.maxLat ||
            pt.lon < REGION_BOUNDS.minLon ||
            pt.lon > REGION_BOUNDS.maxLon
          ) {
            pt.lat = REGION_BOUNDS.minLat + Math.random() * (REGION_BOUNDS.maxLat - REGION_BOUNDS.minLat);
            pt.lon = REGION_BOUNDS.minLon + Math.random() * (REGION_BOUNDS.maxLon - REGION_BOUNDS.minLon);
            pt.age = 0;
            pt.maxAge = 60 + Math.floor(Math.random() * 50);
          }
        });
      }

      // 7. Interactive 3D Pulsing City Markers on the Proper Map
      dataset.cityForecasts.forEach((city, idx) => {
        const isSelected = city.name === selectedCity.name;
        const pos = geoToCanvas(city.lat, city.lon, width, height, padding);
        const cityForecast = city.forecasts[currentStepIndex] || city.forecasts[0];
        const mmCity = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;

        // Clean static halo ring (No pulsing)
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 10 : 8, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? 'rgba(52, 211, 153, 0.45)' : 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pin center marker
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#10b981' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#030712';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label pill
        const labelText = `${mmCity}  ${toBurmeseNumber(Math.round(cityForecast.temperatureC))}°C`;
        ctx.font = isSelected
          ? 'bold 13px "Noto Sans Myanmar", sans-serif'
          : '600 12px "Noto Sans Myanmar", sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const boxW = textMetrics.width + 14;
        const boxH = 22;
        const boxX = pos.x + 8;
        const boxY = pos.y - boxH / 2;

        ctx.fillStyle = isSelected ? 'rgba(16, 185, 129, 0.92)' : 'rgba(3, 7, 18, 0.85)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#6ee7b7' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, boxX + 7, boxY + 15);
      });

      // Cursor Probe Crosshair (Strictly bounded to true ratio map)
      if (probe) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(probe.x, mapY);
        ctx.lineTo(probe.x, mapY + mapH);
        ctx.moveTo(mapX, probe.y);
        ctx.lineTo(mapX + mapW, probe.y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(probe.x, probe.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [dataset, currentStepIndex, selectedCity, activeLayer, showWindParticles, zoom, pan, probe]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isPanning) {
      setPan((prev) => ({
        x: prev.x + (e.clientX - panStartRef.current.x),
        y: prev.y + (e.clientY - panStartRef.current.y),
      }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const padding = 24;
    const transX = (x - pan.x - rect.width / 2) / zoom + rect.width / 2;
    const transY = (y - pan.y - rect.height / 2) / zoom + rect.height / 2;

    const mapBox = getTrueRatioMapBounds(rect.width, rect.height, padding);
    if (
      transX < mapBox.x - 20 ||
      transX > mapBox.x + mapBox.width + 20 ||
      transY < mapBox.y - 20 ||
      transY > mapBox.y + mapBox.height + 20
    ) {
      setProbe(null);
      return;
    }

    const geo = canvasToGeo(transX, transY, rect.width, rect.height, padding);
    const temp = sampleGrid(currentTempGrid, geo.lat, geo.lon);
    const wind = sampleGrid(currentWindGrid, geo.lat, geo.lon);

    setProbe({
      x: transX,
      y: transY,
      lat: Number(geo.lat.toFixed(2)),
      lon: Number(geo.lon.toFixed(2)),
      temp,
      wind,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = 24;
    const transX = (x - pan.x - rect.width / 2) / zoom + rect.width / 2;
    const transY = (y - pan.y - rect.height / 2) / zoom + rect.height / 2;

    for (const city of dataset.cityForecasts) {
      const pos = geoToCanvas(city.lat, city.lon, rect.width, rect.height, padding);
      const dist = Math.hypot(transX - pos.x, transY - pos.y);
      if (dist < 24) {
        onSelectCity(city);
        setActivePopupCity(city);
        return;
      }
    }

    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.max(0.7, Math.min(4.0, z + delta)));
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#030712]"
    >
      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setIsPanning(false);
          setProbe(null);
        }}
        onWheel={handleWheel}
        className="h-full w-full cursor-crosshair touch-none"
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

      {/* Floating Minimal Layer Toolbar */}
      <div className="absolute top-20 left-6 z-20 flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-black/60 p-1.5 backdrop-blur-xl">
        <button
          onClick={() => onLayerChange('temperature')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeLayer === 'temperature'
              ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
              : 'text-slate-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Flame className="h-3.5 w-3.5" />
          <span>၂ မီတာ အပူချိန် (°C)</span>
        </button>

        <button
          onClick={() => onLayerChange('wind')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeLayer === 'wind'
              ? 'bg-emerald-500 text-slate-950 shadow-sm font-bold'
              : 'text-slate-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Wind className="h-3.5 w-3.5" />
          <span>၁၀ မီတာ လေတိုက်နှုန်း</span>
        </button>

        <button
          onClick={() => onLayerChange('satellite')}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            activeLayer === 'satellite'
              ? 'bg-cyan-500 text-slate-950 shadow-sm font-bold'
              : 'text-slate-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>ဂြိုဟ်တု ရေဒါ</span>
        </button>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={onToggleWindParticles}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            showWindParticles ? 'bg-white/20 text-emerald-300' : 'text-slate-400 hover:text-white'
          }`}
        >
          {BURMESE_STRINGS.streamlines} {showWindParticles ? 'ဖွင့်' : 'ပိတ်'}
        </button>

        <div className="h-4 w-px bg-white/20" />

        <button
          onClick={() => setUseMatplotlibOverlay((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            useMatplotlibOverlay
              ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title="Matplotlib RdYlBu_r / viridis Transparent PNG Overlay"
        >
          <Palette className="h-3.5 w-3.5 text-indigo-400" />
          <span>Matplotlib Overlays {useMatplotlibOverlay ? 'ဖွင့်' : 'ပိတ်'}</span>
        </button>

        <div className="h-4 w-px bg-white/20" />

        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-mono text-emerald-300">
          <Scaling className="h-3 w-3" />
          <span>True Ratio 1:2 (10°E × 20°N)</span>
        </div>
      </div>

      {/* Map Zoom Controls */}
      <div className="absolute top-20 right-6 z-20 flex flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/60 p-1 backdrop-blur-xl">
        <button
          onClick={() => setZoom((z) => Math.min(4.0, z + 0.3))}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
          title={BURMESE_STRINGS.zoomIn}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.7, z - 0.3))}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
          title={BURMESE_STRINGS.zoomOut}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
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
        <div className="pointer-events-none absolute bottom-24 left-6 z-20 flex items-center gap-4 rounded-2xl border border-white/20 bg-black/75 px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">တည်နေရာ</span>
            <span className="font-mono font-medium">
              {toBurmeseNumber(probe.lat)}°N, {toBurmeseNumber(probe.lon)}°E
            </span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400">အပူချိန်</span>
            <span className="font-mono font-bold text-amber-400">
              {toBurmeseNumber(probe.temp)}°C
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
      <div className="pointer-events-none absolute bottom-24 right-6 z-20 flex flex-col items-end gap-1 rounded-2xl border border-white/15 bg-black/60 p-3 text-[11px] text-slate-300 backdrop-blur-xl">
        <div className="font-semibold text-white">
          {activeLayer === 'temperature'
            ? '၂ မီတာ အပူချိန် (°C)'
            : activeLayer === 'wind'
            ? '၁၀ မီတာ လေတိုက်နှုန်း (km/h)'
            : 'ဂြိုဟ်တု မိုးရွာသွန်းမှု ရေဒါ'}
        </div>
        <div className="flex items-center gap-2">
          <span>{activeLayer === 'temperature' ? '၀°C' : activeLayer === 'wind' ? '၀' : 'နိမ့်'}</span>
          <div
            className="h-2.5 w-36 rounded-full shadow-inner"
            style={{
              background:
                activeLayer === 'temperature'
                  ? 'linear-gradient(to right, rgb(34, 66, 150), rgb(115, 180, 220), rgb(255, 255, 200), rgb(245, 130, 45), rgb(220, 50, 32), rgb(105, 5, 15))'
                  : activeLayer === 'wind'
                  ? 'linear-gradient(to right, rgb(68, 1, 84), rgb(49, 104, 142), rgb(33, 145, 140), rgb(94, 201, 98), rgb(253, 231, 37))'
                  : 'linear-gradient(to right, rgb(56, 189, 248), rgb(34, 197, 94), rgb(245, 158, 11), rgb(239, 68, 68))',
            }}
          />
          <span>{activeLayer === 'temperature' ? '၃၅°C' : activeLayer === 'wind' ? '၂၅+' : 'မြင့်'}</span>
        </div>
      </div>
    </div>
  );
};
