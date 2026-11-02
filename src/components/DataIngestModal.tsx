import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { ForecastDataset, CityInfo } from '../types/forecast';
import { parseForecastZip } from '../utils/zipForecastParser';
import { BURMESE_STRINGS, toBurmeseNumber } from '../utils/burmese';
import { X, Upload, CheckCircle2, AlertCircle, FileArchive, RefreshCw, Download } from 'lucide-react';
import { DEFAULT_FORECAST_DATA } from '../data/defaultForecast';

interface DataIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDataset: ForecastDataset;
  onApplyDataset: (dataset: ForecastDataset) => void;
  onResetDefault: () => void;
}

export const DataIngestModal: React.FC<DataIngestModalProps> = ({
  isOpen,
  onClose,
  currentDataset,
  onApplyDataset,
  onResetDefault,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'idle' | 'success' | 'error'; text: string }>({
    type: 'idle',
    text: '',
  });
  const [parsedPreview, setParsedPreview] = useState<ForecastDataset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setStatusMessage({ type: 'idle', text: 'ဖိုင်ကို စစ်ဆေးဖတ်ရှုနေပါသည်...' });
    setParsedPreview(null);

    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.zip')) {
        const updatedDataset = await parseForecastZip(file);
        setParsedPreview(updatedDataset);
        setStatusMessage({
          type: 'success',
          text: `NVIDIA မိုးလေဝသ .zip ဖိုင်ကို အောင်မြင်စွာ ဖတ်ရှုပြီးပါပြီ - ${updatedDataset.metadata.model} (ခန့်မှန်းချက် ${toBurmeseNumber(updatedDataset.leadHours.length)} ဆင့်)`,
        });
      } else if (fileName.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        if (!json.temperatureGrid || !json.leadHours) {
          throw new Error('ဖိုင်ပုံစံ မမှန်ကန်ပါ: temperatureGrid သို့မဟုတ် leadHours မပါဝင်ပါ');
        }
        setParsedPreview(json as ForecastDataset);
        setStatusMessage({
          type: 'success',
          text: `JSON ဒေတာဖိုင် အောင်မြင်စွာ ဖတ်ရှုပြီးပါပြီ - ${json.metadata?.model || 'Custom Model'}`,
        });
      } else {
        throw new Error('.zip သို့မဟုတ် .json ဖိုင်များကိုသာ အသုံးပြုနိုင်ပါသည်');
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'ဖိုင်ဖတ်ရှုရာတွင် ချို့ယွင်းချက်ရှိပါသည်',
      });
    }
  };

  const handleApply = () => {
    if (!parsedPreview) return;
    onApplyDataset(parsedPreview);
    onClose();
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentDataset, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `nvidia_fcn_myanmar_forecast_${Date.now()}.json`);
    dlAnchor.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {BURMESE_STRINGS.uploadZip}
              </h2>
              <p className="text-xs text-slate-400">
                NVIDIA FourCastNet .zip ဖိုင်အသစ်များ သို့မဟုတ် JSON ဖိုင်များကို ထည့်သွင်းနိုင်ပါသည်
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragging
              ? 'border-emerald-500 bg-emerald-950/40'
              : 'border-white/20 bg-white/5 hover:bg-white/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
          />

          <FileArchive className="h-10 w-10 text-emerald-400" />
          <p className="mt-3 text-sm font-semibold text-white">
            NVIDIA မိုးလေဝသ .zip ဖိုင်ကို ဤနေရာသို့ ဆွဲထည့်ပါ သို့မဟုတ် နှိပ်၍ ရွေးချယ်ပါ
          </p>
          <p className="mt-1 text-xs text-slate-400">
            NVIDIA FCN zip archive (regional_forecast.npz, metadata.json ပါဝင်သော ဖိုင်)
          </p>
        </div>

        {/* Status Message */}
        {statusMessage.text && (
          <div
            className={`mt-4 flex items-center gap-2.5 rounded-xl p-3 text-xs font-medium ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                : 'bg-white/10 text-slate-300'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Preview Summary */}
        {parsedPreview && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
            <div className="font-semibold text-white mb-2">ဖတ်ရှုရရှိသော အချက်အလက်များ:</div>
            <div className="grid grid-cols-2 gap-2 text-slate-300">
              <div>မော်ဒယ်: <strong className="text-emerald-400">{parsedPreview.metadata?.model || 'NVIDIA FCN'}</strong></div>
              <div>GPU စက်: <strong>{parsedPreview.metadata?.gpu || 'NVIDIA A100'}</strong></div>
              <div>ခန့်မှန်းချက်အဆင့်များ: <strong>{toBurmeseNumber(parsedPreview.leadHours?.length || 6)} ဆင့်</strong></div>
              <div>အချိန်: <strong>{parsedPreview.metadata?.final_valid_myanmar || '2026-11-03'}</strong></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onResetDefault();
                setStatusMessage({ type: 'success', text: 'မူလ မိုးလေဝသဒေတာသို့ ပြန်လည်ထားရှိပြီးပါပြီ' });
              }}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white"
            >
              <RefreshCw className="h-3 w-3" />
              <span>{BURMESE_STRINGS.resetDefault}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/15 hover:text-white"
            >
              <Download className="h-3 w-3" />
              <span>{BURMESE_STRINGS.exportJson}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-white"
            >
              {BURMESE_STRINGS.cancel}
            </button>
            <button
              disabled={!parsedPreview}
              onClick={handleApply}
              className="rounded-full bg-emerald-600 px-5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-40"
            >
              {BURMESE_STRINGS.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
