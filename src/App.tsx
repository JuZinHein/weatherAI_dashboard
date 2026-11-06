/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ForecastDataset, ViewMode, MapLayer, CityInfo } from './types/forecast';
import { ShowcaseHeader } from './components/ShowcaseHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ForecastMap2D } from './components/ForecastMap2D';
import { SatelliteGlobe3D } from './components/SatelliteGlobe3D';
import { CityForecastPanel } from './components/CityForecastPanel';
import { TimelineControls } from './components/TimelineControls';
import { ModelInfoModal } from './components/ModelInfoModal';
import { BURMESE_STRINGS, formatMyanmarTime } from './utils/burmese';
import { getStepTimeWindow } from './utils/forecastTime';
import { fetchZarrMeta, fetchZarrModels, type ZarrMeta, type ZarrModel } from './services/zarrApi';
import { MYANMAR_CITIES } from './data/myanmarCities';

function createEmptyZarrDataset(): ForecastDataset {
  return {
    metadata: {
      model: '',
      forecast_mode: '',
      initialization_utc: '',
      total_rollout_hours: 0,
      requested_hours_ahead: 0,
      requested_at_utc: '',
      requested_target_utc: '',
      display_generated_utc: '',
      final_valid_utc: '',
      final_valid_myanmar: '',
      future_row_count: 0,
      city: '',
      initial_conditions: '',
      gfs_initial_state_url: '',
      ai_inference: false,
      synthetic_inputs: false,
      completed_utc: '',
      end_to_end_seconds: 0,
      gpu: '',
      grid_lat: 0,
      grid_lon: 0,
      earth2studio_version: '',
      torch_version: '',
      locally_validated: false,
      climate_projection: false,
    },
    leadHours: [],
    validTimesUtc: [],
    isFuture: [],
    stats: { minTemp: 0, maxTemp: 0, minWind: 0, maxWind: 0 },
    lats: [],
    lons: [],
    temperatureGrid: [],
    windGrid: [],
    csvRows: [],
    cityForecasts: [],
  };
}

function applyZarrMeta(dataset: ForecastDataset, meta: ZarrMeta): ForecastDataset {
  const init = new Date(meta.initialization_utc);
  if (!meta.lead_hours?.length || Number.isNaN(init.getTime())) return dataset;

  const validTimeForLead = (leadHour: number) =>
    new Date(init.getTime() + leadHour * 3600_000).toISOString();
  const validTimesUtc = meta.lead_hours.map(validTimeForLead);
  const finalValidUtc = validTimesUtc[validTimesUtc.length - 1];

  return {
    ...dataset,
    leadHours: meta.lead_hours,
    isFuture: meta.lead_hours.map(() => true),
    validTimesUtc,
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
  // Populate forecast steps and timestamps only after loading selected-model Zarr metadata.
  const [dataset, setDataset] = useState<ForecastDataset>(createEmptyZarrDataset);
  // Open on the 3D globe; the radar map remains available from the view switcher.
  const [viewMode, setViewMode] = useState<ViewMode>('globe_3d');
  const [hasVisitedCityTrends, setHasVisitedCityTrends] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('temperature');
  const [showWindParticles, setShowWindParticles] = useState<boolean>(true);
  const [models, setModels] = useState<ZarrModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');

  // Active timestep index
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  // Start paused so the first zarr field + basemap can paint (autoplay was aborting every fetch)
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [autoLoop, setAutoLoop] = useState<boolean>(true);

  const [selectedCity, setSelectedCity] = useState<CityInfo>(
    () => MYANMAR_CITIES[0]
  );

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
      } else if (e.key === 'ArrowRight' && dataset.leadHours.length) {
        setCurrentStepIndex((prev) => (prev + 1) % dataset.leadHours.length);
      } else if (e.key === 'ArrowLeft' && dataset.leadHours.length) {
        setCurrentStepIndex((prev) => (prev - 1 + dataset.leadHours.length) % dataset.leadHours.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, dataset.leadHours.length]);

  // Playback: step through forecast windows. City tour only on globe / city-trends —
  // satellite-radar keeps the selected city fixed while the heat map animates.
  useEffect(() => {
    if (!isPlaying || !dataset.leadHours.length) return;

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

  const handleSelectCity = useCallback((city: CityInfo) => {
    setSelectedCity(city);
    setCurrentStepIndex(0);
  }, []);

  /** Align timeline lead hours with the selected local Zarr store. */
  const handleZarrMeta = useCallback((meta: ZarrMeta) => {
    if (!meta.lead_hours?.length || Number.isNaN(new Date(meta.initialization_utc).getTime())) return;
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
          setDataset(createEmptyZarrDataset());
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
              modelId={selectedModelId}
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


      {/* Model Specs Modal */}
      <ModelInfoModal
        isOpen={isModelInfoOpen}
        onClose={() => setIsModelInfoOpen(false)}
        metadata={dataset.metadata}
      />
    </div>
  );
}
