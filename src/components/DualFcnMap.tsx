import React from 'react';
import { ForecastDataset, CityInfo } from '../types/forecast';
import { getTemperatureColor, getWindColor, geoToCanvas, getTrueRatioMapBounds, MYANMAR_BORDER_POINTS } from '../utils/geo';
import { BURMESE_STRINGS, toBurmeseNumber, BURMESE_CITIES_MAP } from '../utils/burmese';
import { Sparkles, Thermometer, Wind } from 'lucide-react';

interface DualFcnMapProps {
  dataset: ForecastDataset;
  currentStepIndex: number;
  selectedCity: CityInfo;
  onSelectCity: (city: CityInfo) => void;
}

export const DualFcnMap: React.FC<DualFcnMapProps> = ({
  dataset,
  currentStepIndex,
  selectedCity,
  onSelectCity,
}) => {
  const currentTempGrid = dataset.temperatureGrid[currentStepIndex] || dataset.temperatureGrid[0];
  const currentWindGrid = dataset.windGrid[currentStepIndex] || dataset.windGrid[0];
  const leadHour = dataset.leadHours[currentStepIndex] ?? 0;
  const validUtc = dataset.validTimesUtc[currentStepIndex] || '';

  const renderCanvas = (
    type: 'temp' | 'wind',
    canvasEl: HTMLCanvasElement | null
  ) => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const w = canvasEl.width;
    const h = canvasEl.height;

    const off = document.createElement('canvas');
    off.width = 41;
    off.height = 81;
    const offCtx = off.getContext('2d')!;
    const imgData = offCtx.createImageData(41, 81);
    const data = imgData.data;

    for (let r = 0; r < 81; r++) {
      for (let c = 0; c < 41; c++) {
        const idx = (r * 41 + c) * 4;
        const val = type === 'temp' ? currentTempGrid[r][c] : currentWindGrid[r][c];
        const rgb = type === 'temp' ? getTemperatureColor(val) : getWindColor(val);
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 235;
      }
    }
    offCtx.putImageData(imgData, 0, 0);

    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    const pad = 16;
    const mapBox = getTrueRatioMapBounds(w, h, pad);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, mapBox.x, mapBox.y, mapBox.width, mapBox.height);

    // Frame border
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mapBox.x, mapBox.y, mapBox.width, mapBox.height);

    // Myanmar national boundary line in true ratio
    ctx.beginPath();
    MYANMAR_BORDER_POINTS.forEach(([lon, lat], i) => {
      const p = geoToCanvas(lat, lon, w, h, pad);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // City markers in true ratio
    dataset.cityForecasts.forEach((city) => {
      const pos = geoToCanvas(city.lat, city.lon, w, h, pad);
      const isSelected = city.name === selectedCity.name;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, isSelected ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#10b981' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isSelected || city.name === 'Yangon' || city.name === 'Mandalay' || city.name === 'Nay Pyi Taw') {
        ctx.font = 'bold 11px "Noto Sans Myanmar", sans-serif';
        ctx.fillStyle = '#ffffff';
        const mmName = city.mmName || BURMESE_CITIES_MAP[city.name]?.mmName || city.name;
        ctx.fillText(mmName, pos.x + 6, pos.y + 3);
      }
    });
  };

  const tempCanvasRef = React.useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node) renderCanvas('temp', node);
    },
    [currentTempGrid, selectedCity]
  );

  const windCanvasRef = React.useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node) renderCanvas('wind', node);
    },
    [currentWindGrid, selectedCity]
  );

  return (
    <div className="h-full w-full overflow-y-auto p-6 pt-24 pb-28 text-white">
      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-xl">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              NVIDIA FourCastNet · အပူချိန်နှင့် လေတိုက်နှုန်း တွဲဖက်ပြကွက်
            </h2>
            <p className="text-xs text-slate-300">
              ကြိုတင်ခန့်မှန်းချက် +{toBurmeseNumber(leadHour)} နာရီ အတွက် ဒေသတွင်း မိုးလေဝသ အခြေအနေ (Numerical AI Grid Data)
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-emerald-400">
            UTC: {validUtc}
          </div>
        </div>

        {/* Side-by-side maps rendered natively from real data arrays */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Temperature Left */}
          <div className="flex flex-col rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Thermometer className="h-4 w-4" />
                <span>၂ မီတာ မြေပြင်အပူချိန် (°C)</span>
              </span>
              <span className="text-amber-400 font-mono">Range: -၇°C မှ ၃၄°C</span>
            </div>
            <div className="relative aspect-[41/81] max-h-[560px] w-full self-center flex items-center justify-center">
              <canvas
                ref={tempCanvasRef}
                width={410}
                height={810}
                className="h-full w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>

          {/* Wind Right */}
          <div className="flex flex-col rounded-2xl border border-white/15 bg-black/60 p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Wind className="h-4 w-4" />
                <span>၁၀ မီတာ လေတိုက်နှုန်း (km/h)</span>
              </span>
              <span className="text-emerald-400 font-mono">Range: ၀ မှ ၂၄ km/h</span>
            </div>
            <div className="relative aspect-[41/81] max-h-[560px] w-full self-center flex items-center justify-center">
              <canvas
                ref={windCanvasRef}
                width={410}
                height={810}
                className="h-full w-full rounded-xl object-contain shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
