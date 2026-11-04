/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ForecastDataset, ViewMode, MapLayer, CityInfo } from './types/forecast';
import { loadCurrentDataset, loadLargeDataset, saveCustomDataset, clearCustomDataset, DEFAULT_FORECAST_DATA } from './data/defaultForecast';
import { ShowcaseHeader } from './components/ShowcaseHeader';
import { OverviewStrip } from './components/OverviewStrip';
import { ForecastMap2D } from './components/ForecastMap2D';
import { SatelliteGlobe3D } from './components/SatelliteGlobe3D';
import { CityForecastPanel } from './components/CityForecastPanel';
import { TimelineControls } from './components/TimelineControls';
import { DataIngestModal } from './components/DataIngestModal';
import { ModelInfoModal } from './components/ModelInfoModal';
import { BURMESE_STRINGS } from './utils/burmese';
import { getStepTimeWindow } from './utils/forecastTime';
import { Layers } from 'lucide-react';

export default function App() {
  // Prefer bundled zarr-converted forecast over older localStorage uploads
  const [dataset, setDataset] = useState<ForecastDataset>(() => DEFAULT_FORECAST_DATA);
  // Default to Myanmar regional satellite-radar 2D map
  const [viewMode, setViewMode] = useState<ViewMode>('satellite_radar');
  const [activeLayer, setActiveLayer] = useState<MapLayer>('temperature');
  const [showWindParticles, setShowWindParticles] = useState<boolean>(true);

  // Active timestep index
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  // Automated animation playback
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [autoLoop, setAutoLoop] = useState<boolean>(true);
  const ignoreStoredLoad = useRef(false);

  // Selected city (default Yangon)
  const [selectedCity, setSelectedCity] = useState<CityInfo>(() => {
    return dataset.cityForecasts[0] || {
      name: 'Yangon',
      mmName: 'ရန်ကုန်',
      lat: 16.8661,
      lon: 96.1951,
      elevation: '15m',
      state: 'ရန်ကုန်တိုင်းဒေသကြီး',
      forecasts: [],
    };
  });

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isModelInfoOpen, setIsModelInfoOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

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

  // Automated showcase playback: walk every forecast step for the current city,
  // then advance to the next city and start its steps again (kiosk city tour).
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.round(2600 / playbackSpeed);
    const stepCount = dataset.leadHours.length;
    const cities = dataset.cityForecasts;

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const next = prev + 1;
        if (next < stepCount) {
          return next;
        }

        // Finished all prediction windows for this city → next city + restart steps
        if (cities.length > 0) {
          setSelectedCity((city) => {
            const idx = Math.max(
              0,
              cities.findIndex((c) => c.name === city.name),
            );
            return cities[(idx + 1) % cities.length] ?? city;
          });
        }

        return autoLoop || cities.length > 0 ? 0 : prev;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, autoLoop, dataset.leadHours.length, dataset.cityForecasts]);

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
    setDataset(DEFAULT_FORECAST_DATA);
    setCurrentStepIndex(1);
    setSelectedCity(DEFAULT_FORECAST_DATA.cityForecasts[0]);
  };

  const handleSelectCity = useCallback((city: CityInfo) => {
    setSelectedCity(city);
    setCurrentStepIndex(0);
  }, []);

  const currentLeadHour = dataset.leadHours[currentStepIndex] ?? 0;
  const currentWindow =
    getStepTimeWindow(dataset.validTimesUtc, currentStepIndex)?.label ??
    dataset.csvRows[currentStepIndex]?.validMyanmar ??
    '—';

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#030712] text-white font-burmese select-none">
      {/* Seamless Floating Top Bar Header */}
      <ShowcaseHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenUpload={() => setIsUploadOpen(true)}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        leadHour={currentLeadHour}
        validMyanmarTime={currentWindow}
      />

      {/* Minimal Atmospheric Overview HUD (shown in 2D/Trends mode, keeping 3D Globe pure and uncluttered) */}
      {viewMode !== 'globe_3d' && (
        <OverviewStrip
          dataset={dataset}
          selectedCity={selectedCity}
          currentStepIndex={currentStepIndex}
          onSelectStepIndex={setCurrentStepIndex}
        />
      )}

      {/* Full-bleed Edge-to-Edge Satellite / Map Viewport (No White Boxes!) */}
      <main className="h-full w-full">
        {viewMode === 'globe_3d' && (
          <SatelliteGlobe3D
            dataset={dataset}
            currentStepIndex={currentStepIndex}
            selectedCity={selectedCity}
            onSelectCity={handleSelectCity}
            isKioskPlaying={isPlaying}
          />
        )}

        {viewMode === 'satellite_radar' && (
          <ForecastMap2D
            dataset={dataset}
            currentStepIndex={currentStepIndex}
            selectedCity={selectedCity}
            onSelectCity={handleSelectCity}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
            showWindParticles={showWindParticles}
            onToggleWindParticles={() => setShowWindParticles((v) => !v)}
          />
        )}


        {viewMode === 'city_trends' && (
          <CityForecastPanel
            dataset={dataset}
            selectedCity={selectedCity}
            onSelectCity={handleSelectCity}
            currentStepIndex={currentStepIndex}
            onSelectStepIndex={setCurrentStepIndex}
          />
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
        selectedCity={selectedCity}
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
