import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  CloudLightning,
  Clock,
  Terminal,
  Key,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Check,
  X,
  FileCode,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';

interface ArchitecturePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const ArchitecturePipelineModal: React.FC<ArchitecturePipelineModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'runner' | 'code'>('architecture');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pipelineOutput, setPipelineOutput] = useState<string>('');
  const [simulateCyclone, setSimulateCyclone] = useState<boolean>(false);
  const [copiedCron, setCopiedCron] = useState<boolean>(false);

  // Load pipeline status
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/pipeline/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.lastOutput) {
          setPipelineOutput(data.lastOutput);
        }
      })
      .catch((err) => console.warn('Could not fetch pipeline status:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      const res = await fetch('/api/pipeline/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setApiKeySaved(true);
        setTimeout(() => setApiKeySaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunPipeline = async () => {
    setIsRunning(true);
    setPipelineOutput('🚀 NVIDIA FourCastNet အလိုအလျောက် ပိုက်လိုင်း စတင်လည်ပတ်နေပါသည်...\n[Step 1/6] Ingesting GFS 73-channel conditions via earth2studio...');
    try {
      const res = await fetch('/api/pipeline/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulateCyclone }),
      });
      const data = await res.json();
      setPipelineOutput(data.output || 'Pipeline completed.');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setPipelineOutput(`ချို့ယွင်းချက်: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleCycloneSimulation = async (enabled: boolean) => {
    setSimulateCyclone(enabled);
    try {
      await fetch('/api/storm-alert/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableCyclone: enabled }),
      });
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error(e);
    }
  };

  const cronCommand = '30 3,9,15,21 * * * /bin/bash /app/applet/scripts/run_cron.sh >> /var/log/fourcastnet_cron.log 2>&1';

  const copyCronToClipboard = () => {
    navigator.clipboard.writeText(cronCommand);
    setCopiedCron(true);
    setTimeout(() => setCopiedCron(false), 3000);
  };

  const PIPELINE_STEPS = [
    {
      step: '1',
      title: 'Data Ingestion (earth2studio)',
      titleMm: 'GFS ကမ္ဘာ့အချက်အလက် ရယူခြင်း',
      desc: 'NOAA GFS Initial Conditions (73 Channels at 0.25° grid) ကို earth2studio ဖြင့် အလိုအလျောက် detect ပြုလုပ်ပြီး ရယူသည်။ (Open-Meteo အသုံးမပြုဘဲ AI အတွက် 73-channel ပြည့်စုံစွာ ပါရှိသည်)။',
      badge: 'NOAA GFS 0.25°',
      color: 'border-sky-500/40 bg-sky-950/20 text-sky-400',
    },
    {
      step: '2',
      title: 'NVIDIA FourCastNet Inference',
      titleMm: 'NVIDIA AI ခန့်မှန်းတွက်ချက်မှု',
      desc: 'GFS state tensor [1, 73, 721, 1440] ကို format ပြုလုပ်ပြီး NVIDIA NIM API / build.nvidia.com သို့ NGC API Key ဖြင့် ပို့ဆောင်ကာ FourCastNet multi-step rollout တွက်ချက်သည်။',
      badge: 'NIM API / NGC Key',
      color: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400',
    },
    {
      step: '3',
      title: 'Post-Processing & Crop',
      titleMm: 'မြန်မာနိုင်ငံ နယ်နိမိတ် သီးသန့် ဖြတ်ထုတ်ခြင်း',
      desc: 'AI မှ ထွက်ရှိသော global grid ကို မြန်မာ့ပထဝီဝင် bounding box (Lat: 9°N to 29°N, Lon: 92°E to 102°E, 81x41 points) အတိုင်း တိကျစွာ crop ပြုလုပ်ပြီး Celsius (°C) နှင့် km/h သို့ ပြောင်းလဲသည်။',
      badge: 'Crop 9-29°N, 92-102°E',
      color: 'border-indigo-500/40 bg-indigo-950/20 text-indigo-400',
    },
    {
      step: '4',
      title: 'Matplotlib Overlay Generation',
      titleMm: 'Matplotlib ဖြင့် PNG ရေးဆွဲခြင်း',
      desc: '၂ မီတာ အပူချိန်အတွက် RdYlBu_r နှင့် ၁၀ မီတာ လေတိုက်နှုန်းအတွက် viridis colormaps သုံး၍ transparent .png များကို margin/axes/padding အားလုံး ဖယ်ရှားကာ Leaflet bounds နှင့် ၁၀၀% အံကိုက် ထုတ်လုပ်သည်။',
      badge: 'RdYlBu_r & viridis',
      color: 'border-amber-500/40 bg-amber-950/20 text-amber-400',
    },
    {
      step: '5',
      title: 'UI Config Generation',
      titleMm: 'forecast_config.js ထုတ်လုပ်ခြင်း',
      desc: 'အချိန်မှတ်တမ်းများနှင့် image path များပါဝင်သော forecast_config.js ကို web server ၏ asset directory ထဲသို့ တိုက်ရိုက် save ပေးသဖြင့် UI က အလိုအလျောက် update ဖြစ်သွားသည်။',
      badge: 'forecast_config.js',
      color: 'border-cyan-500/40 bg-cyan-950/20 text-cyan-400',
    },
    {
      step: '6',
      title: 'Bay of Bengal Cyclone Alert',
      titleMm: 'မုန်တိုင်းသတိပေးချက် စစ်ဆေးခြင်း',
      desc: 'ဘင်္ဂလားပင်လယ်အော် (Lat 10-22, Lon 92-96) အတွင်း ခန့်မှန်းလေတိုက်နှုန်းကို စကန်ဖတ်သည်။ ၆၅ km/h ကျော်လွန်ပါက storm_alert.json ထုတ်လုပ်၍ UI တွင် Cyclone Warning Card ကို အရေးပေါ် ပြသစေသည်။',
      badge: '> 65 km/h Threshold',
      color: 'border-rose-500/40 bg-rose-950/20 text-rose-400',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-3xl border border-white/20 bg-slate-950/90 text-white shadow-2xl backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 text-emerald-400 border border-emerald-500/30">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-white">
                  NVIDIA FourCastNet အလိုအလျောက် Backend ဗိသုကာ & Cron စနစ်
                </h2>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                  Automated Pipeline
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                earth2studio GFS Ingestion · NVIDIA NIM API · Matplotlib Leaflet Overlays · Cyclone Alerting
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-2.5 bg-black/30">
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'architecture'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu className="h-4 w-4" />
            <span>အဆင့် ၆ ဆင့် ဗိသုကာပြကွက်</span>
          </button>

          <button
            onClick={() => setActiveTab('runner')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'runner'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Pipeline စမ်းသပ်မောင်းနှင်ရန် & Cron Setup</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'code'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileCode className="h-4 w-4" />
            <span>Python Script ရင်းမြစ် (Source)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              {/* Architecture Intro */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-200 leading-relaxed flex items-start gap-3">
                <Zap className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-1">
                    အပြည့်အဝ အလိုအလျောက် လည်ပတ်သော AI မိုးလေဝသ ပိုက်လိုင်း
                  </strong>
                  ဤစနစ်သည် NOAA GFS data အသစ်ထွက်တိုင်း (၆ နာရီတစ်ကြိမ်) earth2studio ဖြင့် ၇၃ လိုင်းပါ global grid ကို ဆွဲယူကာ NVIDIA FourCastNet model (NIM API) ဖြင့် မြန်မာနိုင်ငံအတွက် ရလဒ်များကို တွက်ချက်ထုတ်လုပ်ပေးပါသည်။
                </div>
              </div>

              {/* 6-Step Visual Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PIPELINE_STEPS.map((st) => (
                  <div
                    key={st.step}
                    className={`rounded-2xl border p-4.5 backdrop-blur-md flex flex-col justify-between ${st.color}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 font-mono text-xs font-bold text-white border border-white/20">
                          {st.step}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/90">
                          {st.badge}
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-bold text-white">
                        {st.title}
                      </h4>
                      <h5 className="font-burmese text-xs font-semibold text-white/80 mt-0.5">
                        {st.titleMm}
                      </h5>
                      <p className="mt-2.5 font-burmese text-xs text-slate-300 leading-relaxed">
                        {st.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Leaflet Alignment Notice */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-sky-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Leaflet Map Bounds တိကျမှု:</span>{' '}
                    Matplotlib မှ ထွက်ရှိသော <code className="text-sky-300 font-mono">temp_XXh.png</code> နှင့် <code className="text-emerald-300 font-mono">wind_XXh.png</code> တို့သည် margin/padding အားလုံး သုညဖြစ်သဖြင့် <span className="text-amber-300 font-mono">[[9.0, 92.0], [29.0, 102.0]]</span> ဘောင်နှင့် pixel အတိုင်း အံကိုက်ဖြစ်ပါသည်။
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'runner' && (
            <div className="space-y-6">
              {/* NGC API Key Configuration */}
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-emerald-400" />
                    <h4 className="font-display text-sm font-bold text-white">
                      NVIDIA NGC API Key သတ်မှတ်ရန်
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    build.nvidia.com / NVIDIA NIM
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-3 font-burmese">
                  သင်၏ NGC API Key ကို ထည့်သွင်းထားပါက backend pipeline မှ NVIDIA NIM FourCastNet microservice သို့ တိုက်ရိုက် API call ခေါ်ယူပါမည်။ (သီးသန့် API key မထည့်သွင်းသေးပါကလည်း စနစ်မှ calibrated AI cache ဖြင့် အဆင်သင့် လည်ပတ်ပါမည်)။
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="password"
                    placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 rounded-xl border border-white/20 bg-black/60 px-4 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 active:scale-95"
                  >
                    {apiKeySaved ? 'သိမ်းပြီးပါပြီ ✓' : 'Key သိမ်းဆည်းရန်'}
                  </button>
                </div>
              </div>

              {/* Manual Trigger & Cyclone Simulation Controls */}
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4.5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-display text-sm font-bold text-white">
                      Pipeline စမ်းသပ်လည်ပတ်ခြင်း & သတိပေးချက် စစ်ဆေးခြင်း
                    </h4>
                    <p className="text-xs text-slate-400">
                      အဆင့် ၆ ဆင့်စလုံးကို ယခုချက်ချင်း run ပြီး public/forecast_data/ ထဲသို့ PNG overlay များနှင့် config အသစ်များကို တိုက်ရိုက်ထုတ်လုပ်မည်။
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simulateCyclone}
                        onChange={(e) => handleToggleCycloneSimulation(e.target.checked)}
                        className="rounded text-rose-500 focus:ring-rose-500"
                      />
                      <span>မုန်တိုင်း စမ်းသပ်ချက် (&gt;65 km/h)</span>
                    </label>

                    <button
                      onClick={handleRunPipeline}
                      disabled={isRunning}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-50"
                    >
                      {isRunning ? (
                        <>
                          <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                          <span>တွက်ချက်နေပါသည်...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          <span>Run Pipeline Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time Terminal Output */}
                <div className="rounded-xl border border-white/15 bg-black/90 p-4 font-mono text-xs text-emerald-400 leading-relaxed max-h-56 overflow-y-auto whitespace-pre-wrap shadow-inner">
                  {pipelineOutput || 'စနစ် စတင်မောင်းနှင်ရန် အသင့်ရှိပါသည်...'}
                </div>
              </div>

              {/* Linux Crontab Setup */}
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sky-400" />
                    <h4 className="font-display text-sm font-bold text-white">
                      Linux Crontab ဖြင့် ၆ နာရီတစ်ကြိမ် အလိုအလျောက် သတ်မှတ်ရန်
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-sky-400">03:30, 09:30, 15:30, 21:30 UTC</span>
                </div>
                <p className="text-xs text-slate-300 font-burmese mb-3">
                  NOAA GFS cycle အသစ်များ (00z, 06z, 12z, 18z) ထွက်ပေါ်ချိန်နှင့်အညီ ၆ နာရီတစ်ကြိမ် အလိုအလျောက် run ရန် အောက်ပါ crontab command ကို အသုံးပြုနိုင်ပါသည်:
                </p>

                <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/60 p-2.5 font-mono text-xs text-slate-200">
                  <span className="flex-1 truncate text-amber-300 select-all">
                    {cronCommand}
                  </span>
                  <button
                    onClick={copyCronToClipboard}
                    className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20 active:scale-95"
                  >
                    {copiedCron ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedCron ? 'ကူးယူပြီး' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display text-sm font-bold text-white">
                    backend/fourcastnet_pipeline.py
                  </h4>
                  <p className="text-xs text-slate-400">
                    Standalone Python automated script with earth2studio, NVIDIA NIM API, and Matplotlib.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-mono text-emerald-300 border border-emerald-500/30">
                  Python 3.10+
                </span>
              </div>

              <div className="rounded-2xl border border-white/15 bg-black/90 p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[460px] leading-relaxed">
                <pre>{`#!/usr/bin/env python3
"""
NVIDIA FourCastNet Myanmar AI Weather Automated Pipeline
========================================================
Architecture:
1. Data Ingestion: Uses earth2studio to fetch 73-channel GFS initial state.
2. NVIDIA Inference: Calls NVIDIA NIM API / build.nvidia.com with NGC API key.
3. Post-Processing: Crops strictly to Myanmar bounding box [9-29°N, 92-102°E].
4. Asset Generation: Generates transparent .png with matplotlib (RdYlBu_r & viridis).
5. UI Configuration: Generates forecast_config.js directly into public/forecast_data/.
6. Extreme Weather Alerting: Scans Bay of Bengal for sustained winds > 65 km/h.
"""

import os, sys, json, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
import earth2studio.data as e2data
import matplotlib.pyplot as plt
import numpy as np

# Bounding box specifications
MYANMAR_BOUNDS = {"min_lat": 9.0, "max_lat": 29.0, "min_lon": 92.0, "max_lon": 102.0}
BAY_OF_BENGAL_BOUNDS = {"min_lat": 10.0, "max_lat": 22.0, "min_lon": 92.0, "max_lon": 96.0}
CYCLONE_THRESHOLD_KMH = 65.0

# Run via cron:
# 30 3,9,15,21 * * * /usr/bin/python3 /app/applet/backend/fourcastnet_pipeline.py`}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3.5 bg-black/40">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Automated Cron Pipeline Ready (Next scheduled run: 09:30 UTC)</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
