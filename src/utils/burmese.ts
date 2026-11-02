/**
 * Burmese (မြန်မာဘာသာ) translation dictionary and formatting helpers
 */

export function toBurmeseNumber(num: number | string): string {
  const burmeseDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
  return String(num).replace(/[0-9]/g, (d) => burmeseDigits[parseInt(d, 10)]);
}

/**
 * Converts any UTC date/timestamp string to Myanmar Standard Time (MMT, UTC+06:30)
 * Example: "၀၂ နိုဝင်ဘာ ၂၀၂၆၊ ၁၂:၃၀ MMT" or "၁၂:၃၀ MMT"
 */
export function formatMyanmarTime(utcInput: string | Date, includeDate = true): string {
  if (!utcInput) return '';
  try {
    let d: Date;
    if (typeof utcInput === 'string') {
      // Handle strings like "2026-11-02 06:00 UTC" or ISO "2026-11-02T06:00:00Z"
      const clean = utcInput.replace(' UTC', 'Z').replace(' ', 'T');
      d = new Date(clean);
      if (isNaN(d.getTime())) {
        const match = String(utcInput).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (match) {
          d = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]));
        } else {
          return String(utcInput).replace(/UTC/gi, 'MMT');
        }
      }
    } else {
      d = utcInput;
    }

    // Myanmar Standard Time is UTC + 06:30
    const mmtMillis = d.getTime() + (6.5 * 3600 * 1000);
    const mmt = new Date(mmtMillis);

    const year = mmt.getUTCFullYear();
    const month = mmt.getUTCMonth();
    const day = mmt.getUTCDate();
    const hours = String(mmt.getUTCHours()).padStart(2, '0');
    const minutes = String(mmt.getUTCMinutes()).padStart(2, '0');

    const burmeseMonths = [
      'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်',
      'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'
    ];

    const timeStr = `${toBurmeseNumber(hours)}:${toBurmeseNumber(minutes)} MMT`;
    if (!includeDate) {
      return timeStr;
    }
    const dateStr = `${toBurmeseNumber(day)} ${burmeseMonths[month]} ${toBurmeseNumber(year)}`;
    return `${dateStr}၊ ${timeStr}`;
  } catch {
    return String(utcInput).replace(/UTC/gi, 'MMT');
  }
}

export const BURMESE_STRINGS = {
  appTitle: 'NVIDIA FourCastNet · မြန်မာ့မိုးလေဝသခန့်မှန်းချက်',
  satelliteGlobe: 'ဂြိုဟ်တု ကမ္ဘာလုံးပြကွက်',
  satelliteRadar2D: 'မြန်မာ့ဒေသတွင်း ဂြိုဟ်တုရေဒါ',
  dualComparison: 'အပူချိန်နှင့် လေတိုက်နှုန်း တွဲဖက်ပြကွက်',
  cityTrends: 'မြို့ကြီးများ ခန့်မှန်းချက်ဇယား',
  displayKiosk: 'မျက်နှာပြင်အပြည့် (Fullscreen)',
  exitFullscreen: 'ပုံမှန်မျက်နှာပြင်သို့ (Exit)',
  uploadZip: 'ဒေတာဖိုင် (.zip) တင်ရန်',
  autoPlay: 'အလိုအလျောက် ပြသမည်',
  pauseLoop: 'ခေတ္တရပ်မည်',
  validTime: 'ခန့်မှန်းချိန်',
  myanmarTime: 'မြန်မာစံတော်ချိန် (MMT)',
  offlineReady: 'အင်တာနက်မလိုဘဲ အသင့်သုံးနိုင်သည်',
  leadHours: 'ကြိုတင်ခန့်မှန်းချက်',
  gfsState: 'GFS ကနဦးအခြေအနေ',
  fcnForecast: 'NVIDIA AI ခန့်မှန်းချက်',
  temperature: 'အပူချိန်',
  windSpeed: 'လေတိုက်နှုန်း',
  pressure: 'လေထုဖိအား',
  uvIndex: 'ခရမ်းလွန်ရောင်ခြည် အညွှန်း',
  dewPoint: 'နှင်းရည်မှတ်',
  humidity: 'စိုထိုင်းဆ',
  precipitation: 'မိနစ်အလိုက် မိုးရွာသွန်းမှု ခန့်မှန်းချက်',
  noRain: 'မိုးရွာရန် အလားအလာမရှိပါ',
  lightRain: 'မိုးဖွဲဖွဲ',
  moderateRain: 'မိုးအသင့်အတင့်',
  heavyRain: 'မိုးသည်းထန်',
  extremeRain: 'မိုးအလွန်သည်းထန်',
  focusMyanmar: 'မြန်မာနိုင်ငံသို့ ချိန်ညှိရန်',
  toggleClouds: 'ဂြိုဟ်တု တိမ်လွှာ',
  toggleThermal: 'မိုးလေဝသ အပူလွှာ',
  autoRotate: 'ကမ္ဘာလုံးလှည့်ခြင်း',
  streamlines: 'လေစီးကြောင်း မြင်ကွင်း',
  zoomIn: 'ချဲ့ရန်',
  zoomOut: 'ချုံ့ရန်',
  resetView: 'မူလအနေအထား',
  activeStep: 'လက်ရှိခန့်မှန်းချက်အဆင့်',
  dropZipTitle: 'NVIDIA မိုးလေဝသ .zip ဖိုင်ကို ဤနေရာသို့ ဆွဲထည့်ပါ',
  dropZipDesc: 'regional_forecast.npz ၊ အချိန်မှတ်တမ်း CSV များနှင့် မော်ဒယ်အချက်အလက်များကို အလိုအလျောက် ထုတ်ယူဖတ်ရှုပေးမည်ဖြစ်ပါသည်',
  modelSpecs: 'NVIDIA AI မော်ဒယ် အချက်အလက်',
  modelArchitecture: 'NVIDIA FourCastNet နည်းပညာနှင့် ကွန်ပျူတာ အချက်အလက်များ',
  gpu: 'တွက်ချက်သည့် GPU စက်',
  inferenceTime: 'တွက်ချက်မှု ကြာချိန်',
  resolution: 'မြေပုံ အကွက်စိတ် အရွယ်အစား',
  horizon: 'ကြိုတင်ခန့်မှန်းသည့် ကာလ',
  close: 'ပိတ်မည်',
  apply: 'အသုံးပြုမည်',
  cancel: 'မလုပ်တော့ပါ',
  resetDefault: 'မူလ မိုးလေဝသဒေတာသို့ ပြန်လည်ထားရှိမည်',
  exportJson: 'JSON ဖိုင်အဖြစ် ဒေါင်းလုဒ်လုပ်မည်',
  citiesTitle: 'မြန်မာနိုင်ငံရှိ မြို့ကြီးများ',
  stationsCount: '၁၂ မြို့ ခန့်မှန်းချက်',
};

export const BURMESE_CITIES_MAP: Record<string, { mmName: string; region: string }> = {
  Yangon: { mmName: 'ရန်ကုန်', region: 'ရန်ကုန်တိုင်းဒေသကြီး' },
  Mandalay: { mmName: 'မန္တလေး', region: 'မန္တလေးတိုင်းဒေသကြီး' },
  'Nay Pyi Taw': { mmName: 'နေပြည်တော်', region: 'ပြည်ထောင်စုနယ်မြေ' },
  Taunggyi: { mmName: 'တောင်ကြီး', region: 'ရှမ်းပြည်နယ်' },
  Mawlamyine: { mmName: 'မော်လမြိုင်', region: 'မွန်ပြည်နယ်' },
  Bago: { mmName: 'ပဲခူး', region: 'ပဲခူးတိုင်းဒေသကြီး' },
  Pathein: { mmName: 'ပုသိမ်', region: 'ဧရာဝတီတိုင်းဒေသကြီး' },
  Sittwe: { mmName: 'စစ်တွေ', region: 'ရခိုင်ပြည်နယ်' },
  Monywa: { mmName: 'မုံရွာ', region: 'စစ်ကိုင်းတိုင်းဒေသကြီး' },
  Myitkyina: { mmName: 'မြစ်ကြီးနား', region: 'ကချင်ပြည်နယ်' },
  Dawei: { mmName: 'ထားဝယ်', region: 'တနင်္သာရီတိုင်းဒေသကြီး' },
  'Pyin Oo Lwin': { mmName: 'ပြင်ဦးလွင်', region: 'မန္တလေးတိုင်းဒေသကြီး' },
};
