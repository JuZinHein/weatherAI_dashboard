import React from 'react';
import { ForecastMetadata } from '../types/forecast';
import { BURMESE_STRINGS, toBurmeseNumber } from '../utils/burmese';
import { X, Cpu, Server, Activity, Database, CheckCircle2, Clock } from 'lucide-react';

interface ModelInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: ForecastMetadata;
}

export const ModelInfoModal: React.FC<ModelInfoModalProps> = ({ isOpen, onClose, metadata }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-white font-burmese">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                {BURMESE_STRINGS.modelArchitecture}
              </h2>
              <p className="text-xs text-slate-400">
                Earth2Studio AI Global Numerical Weather Prediction Model
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

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <Server className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">{BURMESE_STRINGS.gpu}</div>
              <div className="mt-0.5 text-slate-300 font-mono">{metadata.gpu}</div>
              <div className="text-[11px] text-slate-400">{BURMESE_STRINGS.inferenceTime}: {toBurmeseNumber(metadata.end_to_end_seconds?.toFixed(2))} စက္ကန့်</div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <Database className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">ကနဦး မိုးလေဝသ အခြေအနေ</div>
              <div className="mt-0.5 text-slate-300">{metadata.initial_conditions}</div>
              <div className="text-[11px] text-slate-400">NOAA AWS GFS 0.25°</div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <Activity className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">{BURMESE_STRINGS.resolution}</div>
              <div className="mt-0.5 text-slate-300 font-mono">
                {toBurmeseNumber(81)} Lat × {toBurmeseNumber(41)} Lon (၀.၂၅ ဒီဂရီ)
              </div>
              <div className="text-[11px] text-slate-400">Bounds: 9°N–29°N, 92°E–102°E</div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <Clock className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-white">{BURMESE_STRINGS.horizon}</div>
              <div className="mt-0.5 text-slate-300 font-mono">
                {toBurmeseNumber(metadata.total_rollout_hours)} နာရီ စုစုပေါင်း
              </div>
              <div className="text-[11px] text-slate-400">ခန့်မှန်းချက် တစ်ဆင့်လျှင် ၆ နာရီ</div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
          <div className="font-semibold text-white mb-1.5 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>NVIDIA FourCastNet (AFNO) နည်းပညာ</span>
          </div>
          <p className="leading-relaxed text-slate-300">
            FourCastNet သည် Fourier Neural Operators (AFNO) အခြေခံ အဆင့်မြင့် မိုးလေဝသ AI မော်ဒယ်ဖြစ်ပြီး ကမ္ဘာ့လေထုစနစ် လှုပ်ရှားမှုများကို မြန်ဆန်တိကျစွာ တွက်ချက်ပေးပါသည်။ ဟိမဝန္တာ တောင်တန်းများမှသည် မြန်မာနိုင်ငံ အလယ်ပိုင်း အပူပိုင်းဇုန်နှင့် ဘင်္ဂလားပင်လယ်အော် ကမ်းရိုးတန်းအထိ မြေပြင်အပူချိန်နှင့် လေတိုက်နှုန်းပြောင်းလဲမှုများကို စက္ကန့်ပိုင်းအတွင်း တိုက်ရိုက်ထုတ်ပေးပါသည်။
          </p>
        </div>

        <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 px-5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {BURMESE_STRINGS.close}
          </button>
        </div>
      </div>
    </div>
  );
};
