/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ForecastDataset, ViewMode, MapLayer, CityInfo } from './types/forecast';
import { loadCurrentDataset, loadLargeDataset, saveCustomDataset, clearCustomDataset, DEFAULT_FORECAST_DATA } from './data/defaultForecast';
import { ShowcaseHeader } from './components/ShowcaseHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ForecastMap2D } from './components/ForecastMap2D';
import { SatelliteGlobe3D } from './components/SatelliteGlobe3D';
import { CityForecastPanel } from './components/CityForecastPanel';
import { TimelineControls } from './components/TimelineControls';
import { DataIngestModal } from './components/DataIngestModal';
import { ModelInfoModal } from './components/ModelInfoModal';
import { BURMESE_STRINGS, formatMyanmarTime } from './utils/burmese';
import { getStepTimeWindow } from './utils/forecastTime';
import { Layers } from 'lucide-react';
import { fetchZarrMeta, fetchZarrModels, type ZarrMeta, type ZarrModel } from './services/zarrApi';
import { MYANMAR_CITIES } from './data/myanmarCities';

function createDefaultDataset(): ForecastDataset {
  return {
    ...DEFAULT_FORECAST_DATA,
    validTimesUtc: [],
    metadata: {
      ...DEFAULT_FORECAST_DATA.metadata,
      initialization_utc: '',
      requested_at_utc: '',
      requested_target_utc: '',
      display_generated_utc: '',
      final_valid_utc: '',
      final_valid_myanmar: '',
      completed_utc: '',
    },
  };
}

function applyZarrMeta(dataset: ForecastDataset, meta: ZarrMeta): ForecastDataset {
  const init = new Date(meta.initialization_utc);
  if (!meta.lead_hours?.length || Number.isNaN(init.getTime())) return dataset;

  const validTimeForLead = (leadHour: number) =>
    new Date(init.getTime() + leadHour * 3600_000).toISOString();
  const validTimesUtc = meta.lead_hours.map(validTimeForLead);
  const finalValidUtc = validTimesUtc[validTimesUtc.length - 1];

  const sameLeads =
    dataset.leadHours.length === meta.lead_hours.length &&
    dataset.leadHours.every((hour, index) => hour === meta.lead_hours[index]);

  return {
    ...dataset,
    ...(sameLeads
      ? {}
      : {
          leadHours: meta.lead_hours,
          isFuture: meta.lead_hours.map(() => true),
        }),
    validTimesUtc,
    csvRows: dataset.csvRows.map((row) => {
      const validUtc = validTimeForLead(row.leadHours);
      return { ...row, validUtc, validMyanmar: formatMyanmarTime(validUtc) };
    }),
    cityForecasts: dataset.cityForecasts.map((city) => ({
      ...city,
      forecasts: city.forecasts.map((forecast) => ({
        ...forecast,
        validUtc: validTimeForLead(forecast.leadHours),
      })),
    })),
    metadata: {
      ...dataset.metadata,
      model: meta.model_label || dataset.metadata.model,
      initialization_utc: meta.initialization_utc,
      final_valid_utc: finalValidUtc,
      final_valid_myanmar: formatMyanmarTime(finalValidUtc),
      total_rollout_hours:
        meta.lead_hours[meta.lead_hours.length - 1] ?? dataset.metadata.total_rollout_hours,
    },
  };
}

export default function App() {
  // Prefer bundled zarr-converted forecast over older localStorage uploads
  const [dataset, setDataset] = useState<ForecastDataset>(createDefaultDataset);
  // Open on the 3D globe; the radar map remains available from the view switcher.
  const [viewMode, setViewMode] = useState<ViewMode>('globe_3d');
  const [hasVisitedCityTrends, setHasVisitedCityTrends] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('temperature');
  const [showWindParticles, setShowWindParticles] = useState<boolean>(true);
  const [models, setModels] = useState<ZarrModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('earth2');
  const [activeModelMeta, setActiveModelMeta] = useState<ZarrMeta | null>(null);

  // Active timestep index
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  // Start paused so the first zarr field + basemap can paint (autoplay was aborting every fetch)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [autoLoop, setAutoLoop] = useState<boolean>(true);
  const ignoreStoredLoad = useRef(false);

  // City names and coordinates are geography; city-trends forecast values come from the selected Zarr model.
  const [selectedCity, setSelectedCity] = useState<CityInfo>(
    () => DEFAULT_FORECAST_DATA.cityForecasts[0] || MYANMAR_CITIES[0]
  );

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isModelInfoOpen, setIsModelInfoOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    if (viewMode === 'city_trends') setHasVisitedCityTrends(true);
  }, [viewMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchZarrModels(controller.signal)
      .then(({ default: defaultModel, models: discovered }) => {
        setModels(discovered);
        const preferred = discovered.find((model) => model.id === defaultModel && model.available)
          ?? discovered.find((model) => model.available);
        if (preferred) setSelectedModelId(preferred.id);
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error('Failed to load local forecast models', err);
        }
      });
    return () => controller.abort();
  }, []);

  // Sync fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.warn('Exit fullscreen failed:', err);
      });
    }
  }, []);

  // Skip restoring older IndexedDB uploads so the fresh zarr-converted forecast stays visible.
  useEffect(() => {
    ignoreStoredLoad.current = true;
  }, []);

  useEffect(() => {
    setCurrentStepIndex((prev) => {
      const last = Math.max(0, dataset.leadHours.length - 1);
      return Math.min(prev, last);
    });
  }, [dataset.leadHours.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentStepIndex((prev) => (prev + 1) % dataset.leadHours.length);
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIndex((prev) => (prev - 1 + dataset.leadHours.length) % dataset.leadHours.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, dataset.leadHours.length]);

  // Playback: step through forecast windows. City tour only on globe / city-trends —
  // satellite-radar keeps the selected city fixed while the heat map animates.
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.round(2600 / playbackSpeed);
    const stepCount = dataset.leadHours.length;
    const cities = dataset.cityForecasts;
    const tourCities = viewMode !== 'satellite_radar';

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next < stepCount) {
          return next;
        }

        if (tourCities && cities.length > 0) {
          setSelectedCity((city) => {
            const idx = Math.max(
              0,
              cities.findIndex((c) => c.name === city.name),
            );
            return cities[(idx + 1) % cities.length] ?? city;
          });
        }

        return autoLoop || (tourCities && cities.length > 0) ? 0 : prev;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, autoLoop, dataset.leadHours.length, dataset.cityForecasts, viewMode]);

  // Global Drag and Drop for zip files
  const [isWindowDragging, setIsWindowDragging] = useState<boolean>(false);
  const [zipLoadingMessage, setZipLoadingMessage] = useState<string>('');

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        setIsWindowDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsWindowDragging(false);

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.zip')) {
          setZipLoadingMessage('NVIDIA မိုးလေဝသ .zip ဖိုင်ကို ဖတ်ရှုနေပါသည်...');
          try {
            const { parseForecastZip } = await import('./utils/zipForecastParser');
            const updated = await parseForecastZip(file);
            handleApplyDataset(updated);
            setZipLoadingMessage(`မိုးလေဝသ ဒေတာဖိုင် ${file.name} ကို အောင်မြင်စွာ တင်ပြီးပါပြီ`);
            setTimeout(() => setZipLoadingMessage(''), 4000);
          } catch (err: any) {
            console.error('Failed to parse dropped zip', err);
            setZipLoadingMessage(`ချို့ယွင်းချက်: ${err?.message || 'ဖိုင်ဖတ်မရပါ'}`);
            setTimeout(() => setZipLoadingMessage(''), 5000);
          }
        } else {
          setIsUploadOpen(true);
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleApplyDataset = (newDataset: ForecastDataset) => {
    ignoreStoredLoad.current = true;
    setDataset(newDataset);
    saveCustomDataset(newDataset);
    setCurrentStepIndex(0);
    if (newDataset.cityForecasts && newDataset.cityForecasts.length > 0) {
      setSelectedCity(newDataset.cityForecasts[0]);
    }
  };

  const handleResetDefault = () => {
    ignoreStoredLoad.current = true;
    clearCustomDataset();
    setDataset(
      activeModelMeta?.model === selectedModelId
        ? applyZarrMeta(createDefaultDataset(), activeModelMeta)
        : createDefaultDataset(),
    );
    setCurrentStepIndex(1);
    setSelectedCity(MYANMAR_CITIES[0]);
  };

  const handleSelectCity = useCallback((city: CityInfo) => {
    setSelectedCity((prev) => {
      // Keep pin coords from map cities, but attach strip forecasts when available
      const matched = dataset.cityForecasts.find((c) => c.name === city.name);
      if (matched?.forecasts?.length) {
        return {
          ...city,
          forecasts: matched.forecasts,
          elevation: matched.elevation || city.elevation,
          state: matched.state || city.state,
          mmName: city.mmName || matched.mmName,
        };
      }
      if (city.forecasts?.length) return city;
      return prev.name === city.name ? prev : city;
    });
    setCurrentStepIndex(0);
  }, [dataset.cityForecasts]);

  /** When local forecast.zarr is available, align timeline lead hours with the store. */
  const handleZarrMeta = useCallback((meta: ZarrMeta) => {
    if (!meta.lead_hours?.length || Number.isNaN(new Date(meta.initialization_utc).getTime())) return;
    setActiveModelMeta(meta);
    setDataset((prev) => applyZarrMeta(prev, meta));
  }, []);

  useEffect(() => {
    if (!models.some((model) => model.id === selectedModelId && model.available)) return;
    const controller = new AbortController();
    fetchZarrMeta(selectedModelId, controller.signal)
      .then(handleZarrMeta)
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error(`Failed to load metadata for model "${selectedModelId}"`, err);
        }
      });
    return () => controller.abort();
  }, [models, selectedModelId, handleZarrMeta]);

  const currentLeadHour = dataset.leadHours[currentStepIndex] ?? 0;
  const currentWindow =
    getStepTimeWindow(dataset.validTimesUtc, currentStepIndex)?.label ??
    '—';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#030712] text-white font-burmese select-none">
      {/* Seamless Floating Top Bar Header */}
      <ShowcaseHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        models={models}
        selectedModelId={selectedModelId}
        onSelectModel={(modelId) => {
          setSelectedModelId(modelId);
          setCurrentStepIndex(0);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        leadHour={currentLeadHour}
        validMyanmarTime={currentWindow}
      />

      {/* Full-bleed Edge-to-Edge Satellite / Map Viewport (No White Boxes!) */}
      <main className="h-full w-full">
        {viewMode === 'globe_3d' && (
          <ErrorBoundary>
            <SatelliteGlobe3D
              dataset={dataset}
              currentStepIndex={currentStepIndex}
              selectedCity={selectedCity}
              onSelectCity={handleSelectCity}
              isKioskPlaying={isPlaying}
            />
          </ErrorBoundary>
        )}

        {viewMode === 'satellite_radar' && (
          <ErrorBoundary>
            <ForecastMap2D
              dataset={dataset}
              modelId={selectedModelId}
              currentStepIndex={currentStepIndex}
              selectedCity={selectedCity}
              onSelectCity={handleSelectCity}
              activeLayer={activeLayer}
              onLayerChange={setActiveLayer}
              showWindParticles={showWindParticles}
              onToggleWindParticles={() => setShowWindParticles((v) => !v)}
            />
          </ErrorBoundary>
        )}

        {(viewMode === 'city_trends' || hasVisitedCityTrends) && (
          <div
            aria-hidden={viewMode !== 'city_trends'}
            className={`absolute inset-0 transition-opacity duration-200 ease-out ${
              viewMode === 'city_trends' ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            style={{ visibility: viewMode === 'city_trends' ? 'visible' : 'hidden' }}
          >
          <ErrorBoundary>
            <CityForecastPanel
              modelId={selectedModelId}
              selectedCity={selectedCity}
              onSelectCity={handleSelectCity}
              currentStepIndex={currentStepIndex}
              onSelectStepIndex={setCurrentStepIndex}
            />
          </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Floating Minimal Glass Timeline Player Dock */}
      <TimelineControls
        dataset={dataset}
        currentStepIndex={currentStepIndex}
        onSelectStepIndex={setCurrentStepIndex}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        autoLoop={autoLoop}
        onToggleAutoLoop={() => setAutoLoop((v) => !v)}
      />


      {/* Global Drag & Drop Overlay */}
      {isWindowDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-8 backdrop-blur-2xl border-4 border-dashed border-emerald-500 animate-in fade-in duration-150 pointer-events-none">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 mb-4 animate-bounce">
            <Layers className="h-10 w-10" />
          </div>
          <h2 className="font-display text-2xl font-bold text-white text-center">
            {BURMESE_STRINGS.dropZipTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-300 text-center max-w-lg">
            {BURMESE_STRINGS.dropZipDesc}
          </p>
        </div>
      )}

      {/* Toast Notification Banner */}
      {zipLoadingMessage && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-black/85 px-6 py-2.5 text-xs font-semibold text-emerald-300 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-200">
          {zipLoadingMessage}
        </div>
      )}

      {/* Data Ingest Modal */}
      <DataIngestModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentDataset={dataset}
        onApplyDataset={handleApplyDataset}
        onResetDefault={handleResetDefault}
      />

      {/* Model Specs Modal */}
      <ModelInfoModal
        isOpen={isModelInfoOpen}
        onClose={() => setIsModelInfoOpen(false)}
        metadata={dataset.metadata}
      />
    </div>
  );
}
