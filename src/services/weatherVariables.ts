export type WeatherCategoryId =
  | 'temperature_humidity'
  | 'precipitation_water'
  | 'wind_metrics'
  | 'pressure_clouds'
  | 'visibility_conditions';

export interface WeatherCategory {
  id: WeatherCategoryId;
  labelEn: string;
  labelMm: string;
  descriptionMm: string;
}

export const WEATHER_CATEGORIES: WeatherCategory[] = [
  {
    id: 'temperature_humidity',
    labelEn: 'Temperature & Humidity',
    labelMm: 'အပူချိန်နှင့် စိုထိုင်းဆ',
    descriptionMm: 'အပူချိန်အဆင့်ဆင့်၊ ခံစားရသောအပူချိန်နှင့် ရေငွေ့ပြည့်ဝမှု ညွှန်းကိန်းများ',
  },
  {
    id: 'precipitation_water',
    labelEn: 'Precipitation & Water Cycle',
    labelMm: 'မိုးရွာသွန်းမှုနှင့် ရေစက်ဝန်း',
    descriptionMm: 'မိုးရွာနိုင်ခြေ၊ မိုးရေချိန်၊ ရေငွေ့ပျံထွက်နှုန်းနှင့် ရေစက်ဝန်း ညွှန်းကိန်းများ',
  },
  {
    id: 'wind_metrics',
    labelEn: 'Wind Metrics',
    labelMm: 'လေတိုက်နှုန်းနှင့် လေလှိုင်းများ',
    descriptionMm: 'အမြင့်အလွှာအလိုက် လေတိုက်နှုန်း၊ လေတိုက်ရာအရပ်နှင့် လေပြင်းတိုက်ခတ်မှုများ',
  },
  {
    id: 'pressure_clouds',
    labelEn: 'Atmospheric Pressure & Cloud Cover',
    labelMm: 'လေဖိအားနှင့် တိမ်ဖုံးလွှမ်းမှု',
    descriptionMm: 'ပင်လယ်ရေမျက်နှာပြင် လေဖိအားနှင့် အလွှာအလိုက် တိမ်ဖုံးလွှမ်းမှု ရာခိုင်နှုန်းများ',
  },
  {
    id: 'visibility_conditions',
    labelEn: 'General Visibility & Conditions',
    labelMm: 'မြင်နိုင်စွမ်းနှင့် အထွေထွေရာသီဥတု',
    descriptionMm: 'လေထုမြင်နိုင်စွမ်း ကွာဝေးနှုန်းနှင့် နိုင်ငံတကာ မိုးလေဝသ အခြေအနေ ကုဒ်များ',
  },
];

export interface WeatherVariableDef {
  id: string;
  categoryId: WeatherCategoryId;
  labelEn: string;
  labelMm: string;
  unit: string;
  min: number;
  max: number;
  color: string;
  colorSecondary?: string;
  descriptionEn: string;
  descriptionMm: string;
}

export const WEATHER_VARIABLES: WeatherVariableDef[] = [
  // 1. Temperature & Humidity
  {
    id: 'temperature_2m',
    categoryId: 'temperature_humidity',
    labelEn: 'Temperature (2 m)',
    labelMm: '၂ မီတာ အပူချိန်',
    unit: '°C',
    min: 0,
    max: 45,
    color: '#f59e0b',
    descriptionEn: 'Air temperature at 2 meters above ground level',
    descriptionMm: 'မြေပြင်အထက် ၂ မီတာတွင် တိုင်းတာရရှိသော စံလေထုအပူချိန်',
  },
  {
    id: 'temperature_80m',
    categoryId: 'temperature_humidity',
    labelEn: 'Temperature (80 m)',
    labelMm: '၈၀ မီတာ အပူချိန်',
    unit: '°C',
    min: -5,
    max: 42,
    color: '#fb923c',
    descriptionEn: 'Air temperature at 80 meters (low level atmospheric boundary)',
    descriptionMm: 'မြေပြင်အထက် ၈၀ မီတာ အမြင့်ရှိ လေထုအပူချိန်',
  },
  {
    id: 'temperature_120m',
    categoryId: 'temperature_humidity',
    labelEn: 'Temperature (120 m)',
    labelMm: '၁၂၀ မီတာ အပူချိန်',
    unit: '°C',
    min: -10,
    max: 40,
    color: '#f97316',
    descriptionEn: 'Air temperature at 120 meters above ground',
    descriptionMm: 'မြေပြင်အထက် ၁၂၀ မီတာ အမြင့်ရှိ လေထုအပူချိန်',
  },
  {
    id: 'temperature_180m',
    categoryId: 'temperature_humidity',
    labelEn: 'Temperature (180 m)',
    labelMm: '၁၈၀ မီတာ အပူချိန်',
    unit: '°C',
    min: -15,
    max: 38,
    color: '#ea580c',
    descriptionEn: 'Air temperature at 180 meters above ground',
    descriptionMm: 'မြေပြင်အထက် ၁၈၀ မီတာ အမြင့်ရှိ လေထုအပူချိန်',
  },
  {
    id: 'apparent_temperature',
    categoryId: 'temperature_humidity',
    labelEn: 'Apparent Temperature',
    labelMm: 'ခံစားရသော အပူချိန်',
    unit: '°C',
    min: 0,
    max: 50,
    color: '#ef4444',
    descriptionEn: 'Perceived temperature combining relative humidity and wind speed',
    descriptionMm: 'စိုထိုင်းဆနှင့် လေတိုက်နှုန်းတို့ ပေါင်းစပ်မှုကြောင့် ခန္ဓာကိုယ်မှ ခံစားရသော အပူချိန် (Heat Index)',
  },
  {
    id: 'relative_humidity_2m',
    categoryId: 'temperature_humidity',
    labelEn: 'Relative Humidity (2 m)',
    labelMm: 'နှိုင်းရစိုထိုင်းဆ (၂ မီတာ)',
    unit: '%',
    min: 0,
    max: 100,
    color: '#06b6d4',
    descriptionEn: 'Relative humidity at 2 meters above ground level',
    descriptionMm: 'လေထုထဲတွင် ပါဝင်သော ရေငွေ့ပြည့်ဝမှု ရာခိုင်နှုန်း',
  },
  {
    id: 'dew_point_2m',
    categoryId: 'temperature_humidity',
    labelEn: 'Dewpoint (2 m)',
    labelMm: 'နှင်းစက်ကျအမှတ် (၂ မီတာ)',
    unit: '°C',
    min: -10,
    max: 30,
    color: '#38bdf8',
    descriptionEn: 'Dew point temperature at 2 meters above ground',
    descriptionMm: 'လေထုအတွင်းရှိ ရေငွေ့များ စုခဲ၍ နှင်းစက်အဖြစ် စတင်ပြောင်းလဲသည့် အပူချိန်',
  },
  {
    id: 'vapour_pressure_deficit',
    categoryId: 'temperature_humidity',
    labelEn: 'Vapour Pressure Deficit',
    labelMm: 'ရေငွေ့ဖိအား လိုငွေ (VPD)',
    unit: 'kPa',
    min: 0,
    max: 6,
    color: '#8b5cf6',
    descriptionEn: 'Difference between saturated and actual vapor pressure',
    descriptionMm: 'လေထု၏ ရေငွေ့ဆွဲယူနိုင်စွမ်းနှင့် အပင်များ ရေငွေ့ပျံထွက်နှုန်းဆိုင်ရာ ဖိအား',
  },

  // 2. Precipitation & Water Cycle
  {
    id: 'precipitation_probability',
    categoryId: 'precipitation_water',
    labelEn: 'Precipitation Probability',
    labelMm: 'မိုးရွာသွန်းနိုင်ခြေ',
    unit: '%',
    min: 0,
    max: 100,
    color: '#0284c7',
    descriptionEn: 'Probability of precipitation occurrence within the forecast hour',
    descriptionMm: 'ခန့်မှန်းချိန်အတွင်း မိုးရွာသွန်းနိုင်သည့် အလားအလာ ရာခိုင်နှုန်း',
  },
  {
    id: 'precipitation',
    categoryId: 'precipitation_water',
    labelEn: 'Precipitation (rain + showers + snow)',
    labelMm: 'စုစုပေါင်း မိုးရွာသွန်းမှု',
    unit: 'mm',
    min: 0,
    max: 100,
    color: '#2563eb',
    descriptionEn: 'Total liquid equivalent precipitation (rain, showers, snow)',
    descriptionMm: 'ရွာသွန်းသော မိုး၊ မိုးဖွဲနှင့် နှင်း စုစုပေါင်း ရေပမာဏ (မီလီမီတာ)',
  },
  {
    id: 'rain',
    categoryId: 'precipitation_water',
    labelEn: 'Rain',
    labelMm: 'မိုးရေချိန်',
    unit: 'mm',
    min: 0,
    max: 80,
    color: '#3b82f6',
    descriptionEn: 'Large scale continuous rainfall amount',
    descriptionMm: 'စံမိုးတိမ်များမှ အဆက်မပြတ် ရွာကျသော မိုးရေချိန်',
  },
  {
    id: 'showers',
    categoryId: 'precipitation_water',
    labelEn: 'Showers',
    labelMm: 'ရုတ်တရက် မိုးရွာသွန်းမှု',
    unit: 'mm',
    min: 0,
    max: 60,
    color: '#60a5fa',
    descriptionEn: 'Convective showery precipitation from convective clouds',
    descriptionMm: 'မိုးကြိုးမုန်တိုင်းတိမ်များမှ ရုတ်တရက်သည်းထန်စွာ ရွာသွန်းသော မိုးဖွဲ/မိုးပေါက်',
  },
  {
    id: 'snowfall',
    categoryId: 'precipitation_water',
    labelEn: 'Snowfall',
    labelMm: 'နှင်းကျဆင်းမှု',
    unit: 'cm',
    min: 0,
    max: 20,
    color: '#a5f3fc',
    descriptionEn: 'Snowfall accumulation in centimeters (Kachin high ranges)',
    descriptionMm: 'ကချင်ပြည်နယ် မြောက်ဘက် တောင်တန်းဒေသများတွင် ကျဆင်းသော နှင်းပမာဏ',
  },
  {
    id: 'snow_depth',
    categoryId: 'precipitation_water',
    labelEn: 'Snow Depth',
    labelMm: 'နှင်းထုအနက်',
    unit: 'm',
    min: 0,
    max: 3,
    color: '#e0f2fe',
    descriptionEn: 'Snow depth accumulated on ground',
    descriptionMm: 'မြေပြင်ပေါ်တွင် စုပုံနေသော နှင်းထုအနက် (မီတာ)',
  },
  {
    id: 'evapotranspiration',
    categoryId: 'precipitation_water',
    labelEn: 'Evapotranspiration',
    labelMm: 'ရေငွေ့ပျံထွက်နှုန်း',
    unit: 'mm',
    min: 0,
    max: 10,
    color: '#10b981',
    descriptionEn: 'Evapotranspiration rate from land and vegetation surfaces',
    descriptionMm: 'မြေဆီလွှာနှင့် သစ်ပင်စိုက်ခင်းများမှ လေထုထဲသို့ ရေငွေ့ပြန်လည်ပျံတက်နှုန်း',
  },
  {
    id: 'et0_fao_evapotranspiration',
    categoryId: 'precipitation_water',
    labelEn: 'Reference Evapotranspiration (ET₀)',
    labelMm: 'စံကိုးကား ရေငွေ့ပျံနှုန်း (ET₀)',
    unit: 'mm',
    min: 0,
    max: 12,
    color: '#059669',
    descriptionEn: 'FAO-56 Penman-Monteith reference crop evapotranspiration',
    descriptionMm: 'ကုလသမဂ္ဂ စိုက်ပျိုးရေးအဖွဲ့ (FAO) စံနှုန်းဖြင့် တွက်ချက်ထားသော စိုက်ခင်း ရေငွေ့ပျံနှုန်း',
  },

  // 3. Wind Metrics
  {
    id: 'wind_speed_10m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Speed (10 m)',
    labelMm: '၁၀ မီတာ လေတိုက်နှုန်း',
    unit: 'km/h',
    min: 0,
    max: 120,
    color: '#14b8a6',
    descriptionEn: 'Standard surface wind speed at 10 meters above ground level',
    descriptionMm: 'စံမြေပြင်အထက် ၁၀ မီတာတွင် တိုက်ခတ်သော လေတိုက်နှုန်း',
  },
  {
    id: 'wind_speed_80m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Speed (80 m)',
    labelMm: '၈၀ မီတာ လေတိုက်နှုန်း',
    unit: 'km/h',
    min: 0,
    max: 140,
    color: '#0d9488',
    descriptionEn: 'Wind speed at 80 meters altitude (wind turbine hub height)',
    descriptionMm: 'လေတာဘိုင်အမြင့် (၈၀ မီတာ) ရှိ လေစီးဆင်းနှုန်း',
  },
  {
    id: 'wind_speed_120m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Speed (120 m)',
    labelMm: '၁၂၀ မီတာ လေတိုက်နှုန်း',
    unit: 'km/h',
    min: 0,
    max: 150,
    color: '#0f766e',
    descriptionEn: 'Wind speed at 120 meters altitude',
    descriptionMm: 'မြေပြင်အထက် ၁၂၀ မီတာ အမြင့်ရှိ လေတိုက်နှုန်း',
  },
  {
    id: 'wind_speed_180m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Speed (180 m)',
    labelMm: '၁၈၀ မီတာ လေတိုက်နှုန်း',
    unit: 'km/h',
    min: 0,
    max: 160,
    color: '#115e59',
    descriptionEn: 'Wind speed at 180 meters altitude',
    descriptionMm: 'မြေပြင်အထက် ၁၈၀ မီတာ အမြင့်ရှိ အထက်လေစီးကြောင်း နှုန်း',
  },
  {
    id: 'wind_direction_10m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Direction (10 m)',
    labelMm: '၁၀ မီတာ လေတိုက်ရာအရပ်',
    unit: '°',
    min: 0,
    max: 360,
    color: '#06b6d4',
    descriptionEn: 'Wind direction at 10 meters (degrees clockwise from True North)',
    descriptionMm: 'စံ ၁၀ မီတာတွင် လေတိုက်ခတ်ရာ မူလအရပ်ထောင့်ဒီဂရီ',
  },
  {
    id: 'wind_direction_80m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Direction (80 m)',
    labelMm: '၈၀ မီတာ လေတိုက်ရာအရပ်',
    unit: '°',
    min: 0,
    max: 360,
    color: '#0891b2',
    descriptionEn: 'Wind direction at 80 meters',
    descriptionMm: '၈၀ မီတာ အမြင့်ရှိ လေတိုက်ရာ ဦးတည်ချက် ဒီဂရီ',
  },
  {
    id: 'wind_direction_120m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Direction (120 m)',
    labelMm: '၁၂၀ မီတာ လေတိုက်ရာအရပ်',
    unit: '°',
    min: 0,
    max: 360,
    color: '#0e7490',
    descriptionEn: 'Wind direction at 120 meters',
    descriptionMm: '၁၂၀ မီတာ အမြင့်ရှိ လေတိုက်ရာ ဦးတည်ချက် ဒီဂရီ',
  },
  {
    id: 'wind_direction_180m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Direction (180 m)',
    labelMm: '၁၈၀ မီတာ လေတိုက်ရာအရပ်',
    unit: '°',
    min: 0,
    max: 360,
    color: '#155e75',
    descriptionEn: 'Wind direction at 180 meters',
    descriptionMm: '၁၈၀ မီတာ အမြင့်ရှိ လေတိုက်ရာ ဦးတည်ချက် ဒီဂရီ',
  },
  {
    id: 'wind_gusts_10m',
    categoryId: 'wind_metrics',
    labelEn: 'Wind Gusts (10 m)',
    labelMm: '၁၀ မီတာ လေပြင်းတိုက်ခတ်မှု',
    unit: 'km/h',
    min: 0,
    max: 180,
    color: '#f43f5e',
    descriptionEn: 'Maximum wind gusts over the forecast interval at 10 meters',
    descriptionMm: 'ရုတ်တရက် တိုက်ခတ်နိုင်သည့် အမြင့်ဆုံး လေပြင်းအဟုန် (Gusts)',
  },

  // 4. Atmospheric Pressure & Cloud Cover
  {
    id: 'pressure_msl',
    categoryId: 'pressure_clouds',
    labelEn: 'Sea Level Pressure',
    labelMm: 'ပင်လယ်ရေမျက်နှာပြင် လေဖိအား',
    unit: 'hPa',
    min: 960,
    max: 1030,
    color: '#a855f7',
    descriptionEn: 'Atmospheric pressure normalized to mean sea level (MSL)',
    descriptionMm: 'ပင်လယ်ရေမျက်နှာပြင် စံသတ်မှတ်ချက်ဖြင့် ညှိထားသော လေဖိအား (မုန်တိုင်းခန့်မှန်းချက်အတွက် အဓိက)',
  },
  {
    id: 'surface_pressure',
    categoryId: 'pressure_clouds',
    labelEn: 'Surface Pressure',
    labelMm: 'မြေပြင် လေဖိအား',
    unit: 'hPa',
    min: 800,
    max: 1025,
    color: '#9333ea',
    descriptionEn: 'Actual atmospheric pressure at surface elevation',
    descriptionMm: 'ဒေသအလိုက် မြေမျက်နှာပြင် အမြင့်တွင် လက်တွေ့တိုင်းတာရရှိသော လေဖိအား',
  },
  {
    id: 'cloud_cover',
    categoryId: 'pressure_clouds',
    labelEn: 'Cloud Cover Total',
    labelMm: 'စုစုပေါင်း တိမ်ဖုံးလွှမ်းမှု',
    unit: '%',
    min: 0,
    max: 100,
    color: '#94a3b8',
    descriptionEn: 'Total atmospheric cloud cover percentage',
    descriptionMm: 'ကောင်းကင်တစ်ခုလုံးတွင် တိမ်ဖုံးလွှမ်းနေသော စုစုပေါင်း ရာခိုင်နှုန်း',
  },
  {
    id: 'cloud_cover_low',
    categoryId: 'pressure_clouds',
    labelEn: 'Cloud Cover Low',
    labelMm: 'အနိမ့်ပိုင်း တိမ်ဖုံးလွှမ်းမှု',
    unit: '%',
    min: 0,
    max: 100,
    color: '#cbd5e1',
    descriptionEn: 'Low-altitude cloud cover (stratus, cumulus, up to 2 km)',
    descriptionMm: 'မြေပြင်မှ ၂ ကီလိုမီတာ အထိရှိ အနိမ့်ပိုင်း မိုးတိမ်များ ဖုံးလွှမ်းမှု',
  },
  {
    id: 'cloud_cover_mid',
    categoryId: 'pressure_clouds',
    labelEn: 'Cloud Cover Mid',
    labelMm: 'အလယ်ပိုင်း တိမ်ဖုံးလွှမ်းမှု',
    unit: '%',
    min: 0,
    max: 100,
    color: '#64748b',
    descriptionEn: 'Mid-altitude cloud cover (altocumulus, altostratus, 2–6 km)',
    descriptionMm: '၂ ကီလိုမီတာ မှ ၆ ကီလိုမီတာ အမြင့်ရှိ အလယ်တန်းတိမ်များ ဖုံးလွှမ်းမှု',
  },
  {
    id: 'cloud_cover_high',
    categoryId: 'pressure_clouds',
    labelEn: 'Cloud Cover High',
    labelMm: 'အမြင့်ပိုင်း တိမ်ဖုံးလွှမ်းမှု',
    unit: '%',
    min: 0,
    max: 100,
    color: '#475569',
    descriptionEn: 'High-altitude cloud cover (cirrus, cirrostratus, > 6 km)',
    descriptionMm: '၆ ကီလိုမီတာ အထက်ရှိ ရေခဲမှုန်များဖြင့် ဖွဲ့စည်းထားသော အမြင့်တန်းတိမ်များ',
  },

  // 5. General Visibility & Conditions
  {
    id: 'weather_code',
    categoryId: 'visibility_conditions',
    labelEn: 'Weather code',
    labelMm: 'မိုးလေဝသ အခြေအနေ ကုဒ်',
    unit: 'WMO',
    min: 0,
    max: 99,
    color: '#facc15',
    descriptionEn: 'WMO weather interpretation code (0: Clear, 61: Rain, 95: Thunderstorm)',
    descriptionMm: 'ကုလသမဂ္ဂ ကမ္ဘာ့မိုးလေဝသအဖွဲ့ (WMO) ၏ နိုင်ငံတကာ စံရာသီဥတု အမျိုးအစား ကုဒ်',
  },
  {
    id: 'visibility',
    categoryId: 'visibility_conditions',
    labelEn: 'Visibility',
    labelMm: 'မြင်နိုင်စွမ်း ကွာဝေးနှုန်း',
    unit: 'km',
    min: 0,
    max: 50,
    color: '#34d399',
    descriptionEn: 'Horizontal visibility distance in kilometers',
    descriptionMm: 'လေထုကြည်လင်မှုနှင့် သာမန်မျက်စိဖြင့် အလျားလိုက် မြင်နိုင်သည့် ကွာဝေးနှုန်း (ကီလိုမီတာ)',
  },
];

export const WEATHER_VARIABLES_BY_ID: Record<string, WeatherVariableDef> = Object.fromEntries(
  WEATHER_VARIABLES.map((v) => [v.id, v])
);

/**
 * WMO Weather Code Map to Burmese Description & Icon
 */
export function getWmoWeatherInfo(code: number): { labelMm: string; labelEn: string; icon: string } {
  if (code === 0) return { labelMm: 'ကြည်လင်သော ကောင်းကင်', labelEn: 'Clear sky', icon: '☀️' };
  if (code === 1) return { labelMm: 'အများအားဖြင့် သာယာ', labelEn: 'Mainly clear', icon: '🌤️' };
  if (code === 2) return { labelMm: 'တိမ်အသင့်အတင့်', labelEn: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { labelMm: 'တိမ်ထူထပ်', labelEn: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { labelMm: 'မြူထူထပ်', labelEn: 'Foggy', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { labelMm: 'မိုးဖွဲရွာသွန်း', labelEn: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { labelMm: 'မိုးရွာသွန်း', labelEn: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 75) return { labelMm: 'နှင်းကျဆင်း', labelEn: 'Snow fall', icon: '❄️' };
  if (code >= 80 && code <= 82) return { labelMm: 'မိုးသည်းထန်စွာရွာသွန်း', labelEn: 'Rain showers', icon: '🌧️' };
  if (code >= 95 && code <= 99) return { labelMm: 'မိုးကြိုးမုန်တိုင်း', labelEn: 'Thunderstorm', icon: '⛈️' };
  return { labelMm: 'သာယာသော ရာသီဥတု', labelEn: 'Fair weather', icon: '🌤️' };
}

/**
 * Deterministically synthesizes physical atmospheric values for all 32 parameters
 * if not directly supplied by live API, using realistic lapse rates, elevations, and maritime proximity.
 */
export function synthesizeCityMetrics(
  leadHours: number,
  baseTempC: number,
  baseWindKmh: number,
  cityLat: number,
  cityLon: number,
  cityElevM: number = 20
): Record<string, number> {
  const isCoastal = cityLat < 18 || cityLon < 95.5;
  const isHighland = cityElevM > 800;

  // Atmospheric lapse rates: ~6.5°C per 1000m
  const lapse80m = baseTempC - 0.52;
  const lapse120m = baseTempC - 0.78;
  const lapse180m = baseTempC - 1.17;

  // Relative humidity & dew point
  const relHumidity = Math.max(35, Math.min(98, Math.round(72 + (isCoastal ? 14 : -6) + Math.sin(leadHours * 0.25) * 8)));
  const dewPoint = Number((baseTempC - (100 - relHumidity) / 5).toFixed(1));

  // Apparent temperature (Heat index)
  const apparentTemp = Number((baseTempC + (relHumidity > 70 ? (relHumidity - 70) * 0.14 : -1) + (baseWindKmh > 20 ? -1.5 : 0)).toFixed(1));

  // Vapour pressure deficit
  const satVp = 0.61078 * Math.exp((17.27 * baseTempC) / (baseTempC + 237.3));
  const actVp = satVp * (relHumidity / 100);
  const vpd = Number(Math.max(0.1, satVp - actVp).toFixed(2));

  // Precipitation calculations
  const rainLikelihood = Math.max(5, Math.min(95, Math.round((baseWindKmh > 18 ? 65 : 20) + (isCoastal ? 25 : 0) + (relHumidity > 80 ? 25 : 0))));
  const precipTotal = rainLikelihood > 50 ? Number((((rainLikelihood - 40) / 10) * (baseWindKmh / 15)).toFixed(1)) : 0;
  const rainAmount = Number((precipTotal * 0.7).toFixed(1));
  const showerAmount = Number((precipTotal * 0.3).toFixed(1));

  // Snow only in extreme northern mountainous regions (Kachin > 27°N and highland)
  const hasSnow = cityLat > 26.5 && isHighland;
  const snowfallCm = hasSnow ? (baseTempC < 4 ? 2.5 : 0) : 0;
  const snowDepthM = hasSnow ? 0.15 : 0;

  // Evapotranspiration
  const evapotrans = Number(Math.max(0.5, (baseTempC * 0.12 + (100 - relHumidity) * 0.03)).toFixed(2));
  const et0 = Number((evapotrans * 1.15).toFixed(2));

  // Wind speed wind-shear power law profile (alpha ~ 0.14 over open terrain)
  const shearFactor80m = Math.pow(80 / 10, 0.14);
  const shearFactor120m = Math.pow(120 / 10, 0.14);
  const shearFactor180m = Math.pow(180 / 10, 0.14);

  const wind80 = Number((baseWindKmh * shearFactor80m).toFixed(1));
  const wind120 = Number((baseWindKmh * shearFactor120m).toFixed(1));
  const wind180 = Number((baseWindKmh * shearFactor180m).toFixed(1));

  // Base wind direction: Bay of Bengal monsoon SW or NE winter
  const baseDir = Math.round((215 + Math.sin(cityLat * 0.5 + leadHours) * 30 + 360) % 360);
  const windGusts = Number((baseWindKmh * 1.45 + (isCoastal ? 6 : 2)).toFixed(1));

  // Pressure: Barometric standard
  const pressureMsl = Math.round(1012 - (baseWindKmh > 25 ? (baseWindKmh - 25) * 0.6 : 0) + Math.cos(leadHours * 0.26) * 2);
  const surfacePressure = Math.round(pressureMsl * Math.exp(-cityElevM / 8400));

  // Cloud cover
  const cloudTotal = Math.max(10, Math.min(100, Math.round(relHumidity * 0.9 + (isCoastal ? 15 : 0))));
  const cloudLow = Math.round(cloudTotal * 0.45);
  const cloudMid = Math.round(cloudTotal * 0.35);
  const cloudHigh = Math.round(cloudTotal * 0.20);

  // Weather Code
  let weatherCode = 1;
  if (rainLikelihood > 75) weatherCode = 63; // Moderate rain
  else if (rainLikelihood > 50) weatherCode = 53; // Moderate drizzle
  else if (cloudTotal > 80) weatherCode = 3; // Overcast
  else if (cloudTotal > 40) weatherCode = 2; // Partly cloudy
  else weatherCode = 0; // Clear

  // Visibility
  const visKm = Number(Math.max(2, Math.min(30, 25 - (cloudLow * 0.1) - (precipTotal * 1.5) - (relHumidity > 90 ? 8 : 0))).toFixed(1));

  return {
    temperature_2m: baseTempC,
    temperature_80m: lapse80m,
    temperature_120m: lapse120m,
    temperature_180m: lapse180m,
    apparent_temperature: apparentTemp,
    relative_humidity_2m: relHumidity,
    dew_point_2m: dewPoint,
    vapour_pressure_deficit: vpd,

    precipitation_probability: rainLikelihood,
    precipitation: precipTotal,
    rain: rainAmount,
    showers: showerAmount,
    snowfall: snowfallCm,
    snow_depth: snowDepthM,
    evapotranspiration: evapotrans,
    et0_fao_evapotranspiration: et0,

    wind_speed_10m: baseWindKmh,
    wind_speed_80m: wind80,
    wind_speed_120m: wind120,
    wind_speed_180m: wind180,
    wind_direction_10m: baseDir,
    wind_direction_80m: (baseDir + 8) % 360,
    wind_direction_120m: (baseDir + 15) % 360,
    wind_direction_180m: (baseDir + 22) % 360,
    wind_gusts_10m: windGusts,

    pressure_msl: pressureMsl,
    surface_pressure: surfacePressure,
    cloud_cover: cloudTotal,
    cloud_cover_low: cloudLow,
    cloud_cover_mid: cloudMid,
    cloud_cover_high: cloudHigh,

    weather_code: weatherCode,
    visibility: visKm,
  };
}
