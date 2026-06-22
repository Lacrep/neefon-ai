import type { AirQuality, CurrentWeather, HourlyForecast, MinutelyData, TomorrowInterval } from "@contracts/weather";

// ── OpenWeatherMap One Call 3.0 ──

interface OWMOneCallResponse {
  current?: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    wind_deg?: number;
    wind_gust?: number;
    pressure: number;
    dew_point?: number;
    uvi?: number;
    visibility?: number;
    clouds?: number;
    rain?: { "1h"?: number; "3h"?: number };
    weather?: Array<{ main: string; description: string; icon: string }>;
  };
  hourly?: Array<{
    dt: number;
    temp: number;
    pop?: number;
    weather?: Array<{ main: string; description: string; icon: string }>;
  }>;
  minutely?: Array<{
    dt: number;
    precipitation: number;
  }>;
}

interface OWMBatchResponse {
  data?: {
    timelines?: Array<{
      intervals: Array<{
        startTime: string;
        values: {
          precipitationProbability?: number;
          precipitationIntensity?: number;
          cloudCover?: number;
          humidity?: number;
        };
      }>;
    }>;
  };
}

export async function fetchOWMOneCall(
  lat: number,
  lon: number,
  apiKey: string
): Promise<{
  current: CurrentWeather | null;
  hourly: HourlyForecast[];
  minutely: MinutelyData[];
}> {
  try {
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=alerts,daily&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      if (res.status === 401) throw new Error("OWM API Key invalid");
      throw new Error(`OWM HTTP ${res.status}`);
    }
    const data = (await res.json()) as OWMOneCallResponse;

    const current: CurrentWeather = {
      temp: data.current?.temp ?? 0,
      feels_like: data.current?.feels_like ?? 0,
      humidity: data.current?.humidity ?? 0,
      wind_speed: data.current?.wind_speed ?? 0,
      wind_deg: data.current?.wind_deg,
      wind_gust: data.current?.wind_gust,
      pressure: data.current?.pressure ?? 1013,
      dew_point: data.current?.dew_point,
      uvi: data.current?.uvi,
      visibility: data.current?.visibility,
      clouds: data.current?.clouds,
      rain1h: data.current?.rain?.["1h"] ?? data.current?.rain?.["3h"] ?? 0,
      rain3h: data.current?.rain?.["3h"] ?? 0,
      pop: data.hourly?.[0]?.pop ?? 0,
      weatherMain: data.current?.weather?.[0]?.main,
      weatherDesc: data.current?.weather?.[0]?.description,
      weatherIcon: data.current?.weather?.[0]?.icon,
    };

    const hourly: HourlyForecast[] = (data.hourly ?? []).slice(0, 24).map((h) => ({
      dt: h.dt,
      temp: h.temp,
      pop: h.pop ?? 0,
      weatherMain: h.weather?.[0]?.main,
      weatherDesc: h.weather?.[0]?.description,
      weatherIcon: h.weather?.[0]?.icon,
    }));

    const minutely: MinutelyData[] = (data.minutely ?? []).slice(0, 60).map((m) => ({
      dt: m.dt,
      precipitation: m.precipitation ?? 0,
    }));

    return { current, hourly, minutely };
  } catch (err) {
    console.error("OWM OneCall error:", err);
    return { current: null, hourly: [], minutely: [] };
  }
}

// ── OpenWeatherMap Current Weather (fallback) ──

interface OWMCurrentResponse {
  main?: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
    dew_point?: number;
  };
  wind?: {
    speed: number;
    deg?: number;
    gust?: number;
  };
  uvi?: number;
  visibility?: number;
  clouds?: { all?: number };
  rain?: { "1h"?: number; "3h"?: number };
  weather?: Array<{ main: string; description: string; icon: string }>;
}

export async function fetchOWMCurrent(
  lat: number,
  lon: number,
  apiKey: string
): Promise<CurrentWeather | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`OWM Current HTTP ${res.status}`);
    const data = (await res.json()) as OWMCurrentResponse;

    return {
      temp: data.main?.temp ?? 0,
      feels_like: data.main?.feels_like ?? 0,
      humidity: data.main?.humidity ?? 0,
      wind_speed: data.wind?.speed ?? 0,
      wind_deg: data.wind?.deg,
      wind_gust: data.wind?.gust,
      pressure: data.main?.pressure ?? 1013,
      dew_point: data.main?.dew_point,
      uvi: data.uvi,
      visibility: data.visibility,
      clouds: data.clouds?.all,
      rain1h: data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0,
      rain3h: data.rain?.["3h"] ?? 0,
      pop: 0,
      weatherMain: data.weather?.[0]?.main,
      weatherDesc: data.weather?.[0]?.description,
      weatherIcon: data.weather?.[0]?.icon,
    };
  } catch (err) {
    console.error("OWM Current error:", err);
    return null;
  }
}

// ── Tomorrow.io Timeline API ──

export async function fetchTomorrowIO(
  lat: number,
  lon: number,
  apiKey: string
): Promise<{
  intervals: TomorrowInterval[];
}> {
  try {
    const fields = "precipitationProbability,precipitationIntensity,cloudCover,humidity";
    const url = `https://api.tomorrow.io/v4/timelines?location=${lat},${lon}&fields=${fields}&timesteps=1m&units=metric&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Tomorrow.io rate limited");
      throw new Error(`Tomorrow.io HTTP ${res.status}`);
    }
    const data = (await res.json()) as OWMBatchResponse;

    const intervals: TomorrowInterval[] = (data.data?.timelines?.[0]?.intervals ?? [])
      .slice(0, 60)
      .map((i) => ({
        startTime: i.startTime,
        values: {
          precipitationProbability: i.values.precipitationProbability ?? 0,
          precipitationIntensity: i.values.precipitationIntensity ?? 0,
          cloudCover: i.values.cloudCover ?? 0,
          humidity: i.values.humidity ?? 0,
        },
      }));

    return { intervals };
  } catch (err) {
    console.error("Tomorrow.io error:", err);
    return { intervals: [] };
  }
}

// ── Open-Meteo (free, no API key) — second forecast source ──

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
    cloud_cover?: number;
    precipitation?: number;
  };
  minutely_15?: {
    time?: number[];
    precipitation?: number[];
  };
  hourly?: {
    time?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weathercode?: number[];
    temperature_2m?: number[];
    uv_index?: number[];
    visibility?: number[];
  };
}

// Map WMO weather codes to the same "main" buckets OWM uses.
function wmoCodeToMain(code: number | undefined): string | undefined {
  if (code == null) return undefined;
  if (code >= 95) return "Thunderstorm";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 1 && code <= 3) return "Clouds";
  if (code === 0) return "Clear";
  return undefined;
}

// Map WMO codes to OWM-style icon codes so the UI's icon mapper works.
function wmoCodeToIcon(code: number | undefined): string | undefined {
  if (code == null) return undefined;
  if (code >= 95) return "11d"; // thunderstorm
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "10d"; // rain
  if (code >= 71 && code <= 77) return "13d"; // snow
  if (code === 2) return "02d"; // partly cloudy
  if (code === 3) return "03d"; // overcast
  if (code <= 1) return "01d"; // clear
  return "03d";
}

// Map WMO codes to a short Thai description for the current-weather card.
function wmoCodeToDesc(code: number | undefined): string | undefined {
  if (code == null) return undefined;
  if (code === 0) return "ท้องฟ้าแจ่มใส";
  if (code <= 2) return "มีเมฆบางส่วน";
  if (code === 3) return "เมฆมาก";
  if (code >= 45 && code <= 48) return "หมอก";
  if (code >= 95) return "พายุฝนฟ้าคะนอง";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "ฝนตก";
  if (code >= 71 && code <= 77) return "หิมะ";
  return "มีเมฆ";
}

export async function fetchOpenMeteo(
  lat: number,
  lon: number
): Promise<{ current: CurrentWeather | null; minutely: MinutelyData[]; hourly: HourlyForecast[]; uvi: number | null }> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,precipitation` +
      `&minutely_15=precipitation&hourly=precipitation_probability,precipitation,weathercode,temperature_2m,uv_index,visibility` +
      `&wind_speed_unit=ms&forecast_days=2&timeformat=unixtime&timezone=GMT`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;

    const now = Date.now();

    // minutely_15 covers the whole day — keep only the near-term future (~2h)
    const m15Time = data.minutely_15?.time ?? [];
    const m15Precip = data.minutely_15?.precipitation ?? [];
    const minutely: MinutelyData[] = m15Time
      .map((t, i) => ({ dt: t, precipitation: m15Precip[i] ?? 0 }))
      .filter((m) => m.dt * 1000 >= now - 15 * 60 * 1000)
      .slice(0, 8);

    // hourly — keep the next 24 future hours (also a fallback for the UI when
    // OWM One Call is unavailable). Nowcast only reads the first 6.
    const hTime = data.hourly?.time ?? [];
    const hPop = data.hourly?.precipitation_probability ?? [];
    const hCode = data.hourly?.weathercode ?? [];
    const hTemp = data.hourly?.temperature_2m ?? [];
    const hUv = data.hourly?.uv_index ?? [];
    const hVis = data.hourly?.visibility ?? [];
    const hourly: HourlyForecast[] = hTime
      .map((t, i) => ({
        dt: t,
        temp: Math.round((hTemp[i] ?? 0) * 10) / 10,
        pop: (hPop[i] ?? 0) / 100,
        weatherMain: wmoCodeToMain(hCode[i]),
        weatherIcon: wmoCodeToIcon(hCode[i]),
      }))
      .filter((h) => h.dt * 1000 >= now - 60 * 60 * 1000)
      .slice(0, 24);

    // current-hour UV index + visibility
    let uvi: number | null = null;
    let visibility: number | undefined;
    for (let i = 0; i < hTime.length; i++) {
      if (hTime[i] * 1000 >= now - 60 * 60 * 1000) {
        uvi = Math.round((hUv[i] ?? 0) * 100) / 100;
        if (hVis[i] != null) visibility = Math.round(hVis[i]);
        break;
      }
    }

    // Build a current-weather object so the app keeps working when OWM is down.
    const cw = data.current;
    const current: CurrentWeather | null =
      cw && cw.temperature_2m != null
        ? {
            temp: cw.temperature_2m,
            feels_like: cw.apparent_temperature ?? cw.temperature_2m,
            humidity: cw.relative_humidity_2m ?? 0,
            wind_speed: cw.wind_speed_10m ?? 0,
            wind_deg: cw.wind_direction_10m,
            pressure: Math.round(cw.surface_pressure ?? 1013),
            uvi: uvi ?? undefined,
            visibility,
            clouds: cw.cloud_cover,
            rain1h: cw.precipitation ?? 0,
            pop: hourly[0]?.pop ?? 0,
            weatherMain: wmoCodeToMain(cw.weather_code),
            weatherDesc: wmoCodeToDesc(cw.weather_code),
            weatherIcon: wmoCodeToIcon(cw.weather_code),
          }
        : null;

    return { current, minutely, hourly, uvi };
  } catch (err) {
    console.error("Open-Meteo error:", err);
    return { current: null, minutely: [], hourly: [], uvi: null };
  }
}

// ── Air quality (Open-Meteo Air Quality API — free, no key, no limit) ──

interface OpenMeteoAirResponse {
  current?: {
    pm10?: number;
    pm2_5?: number;
    carbon_monoxide?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    ozone?: number;
    us_aqi?: number;
  };
}

// Open-Meteo CAMS model — global, but a MODEL (over-reads PM in Thailand by ~2x).
// Used for the gas pollutants and as a fallback when no real station is nearby.
async function fetchAirQualityOpenMeteo(lat: number, lon: number): Promise<AirQuality> {
  const empty: AirQuality = { aqi: null, aqiStandard: "us", station: "แบบจำลอง CAMS", pm25: null, pm10: null, o3: null, no2: null, so2: null, co: null };
  try {
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&timezone=GMT`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`Open-Meteo AQ HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoAirResponse;
    const c = data.current;
    if (!c) return empty;
    const r = (n: number | undefined) => (n == null ? null : Math.round(n * 10) / 10);
    return {
      aqi: c.us_aqi != null ? Math.round(c.us_aqi) : null,
      aqiStandard: "us",
      station: "แบบจำลอง CAMS (Open-Meteo)",
      pm25: r(c.pm2_5),
      pm10: r(c.pm10),
      o3: r(c.ozone),
      no2: r(c.nitrogen_dioxide),
      so2: r(c.sulphur_dioxide),
      co: r(c.carbon_monoxide),
    };
  } catch (err) {
    console.error("Open-Meteo air-quality error:", err);
    return empty;
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const p = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * p) / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ── Air4Thai: real ground stations from the Thai Pollution Control Dept ──
// Far more accurate for Thailand than the model. Free, no key. The full
// station list updates hourly, so cache it for 10 min.

interface Air4ThaiStation {
  nameTH?: string;
  lat?: string;
  long?: string;
  AQILast?: {
    PM25?: { value?: string; aqi?: string };
    PM10?: { value?: string };
    O3?: { value?: string };
    CO?: { value?: string };
    NO2?: { value?: string };
    SO2?: { value?: string };
    AQI?: { aqi?: string };
  };
}

interface Air4ThaiNearest {
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  station: string; // "<name> · <dist> กม."
}

let air4thaiCache: { at: number; stations: Air4ThaiStation[] } | null = null;
const AIR4THAI_TTL = 10 * 60 * 1000;

// "-1" / missing means the station has no reading for that pollutant.
function a4tNum(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
}

async function fetchAir4ThaiNearest(lat: number, lon: number): Promise<Air4ThaiNearest | null> {
  try {
    if (!air4thaiCache || Date.now() - air4thaiCache.at > AIR4THAI_TTL) {
      // Air4Thai only serves over plain HTTP (no valid TLS). This is a
      // server-side fetch, so there's no browser mixed-content issue.
      const res = await fetch("http://air4thai.pcd.go.th/services/getNewAQI_JSON.php", {
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`Air4Thai HTTP ${res.status}`);
      const data = (await res.json()) as { stations?: Air4ThaiStation[] };
      air4thaiCache = { at: Date.now(), stations: data.stations ?? [] };
    }

    let best: { st: Air4ThaiStation; d: number } | null = null;
    for (const st of air4thaiCache.stations) {
      const slat = Number(st.lat);
      const slon = Number(st.long);
      if (!Number.isFinite(slat) || !Number.isFinite(slon)) continue;
      if (a4tNum(st.AQILast?.PM25?.value) == null) continue; // skip stations with no PM2.5
      const d = haversineKm(lat, lon, slat, slon);
      if (!best || d < best.d) best = { st, d };
    }
    // Only trust a station that's reasonably close (PM2.5 is fairly local).
    if (!best || best.d > 40) return null;

    const a = best.st.AQILast;
    return {
      aqi: a?.AQI?.aqi != null && Number(a.AQI.aqi) >= 0 ? Math.round(Number(a.AQI.aqi)) : null,
      pm25: a4tNum(a?.PM25?.value),
      pm10: a4tNum(a?.PM10?.value),
      station: `${(best.st.nameTH ?? "สถานีตรวจวัด").trim()} · ${best.d.toFixed(1)} กม.`,
    };
  } catch (err) {
    console.error("Air4Thai error:", err);
    return null;
  }
}

// Public: real Thai station PM2.5/PM10/AQI when available, with Open-Meteo's
// model used for the gas pollutants and as a full fallback outside Thailand.
export async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality> {
  const [om, a4t] = await Promise.all([
    fetchAirQualityOpenMeteo(lat, lon),
    fetchAir4ThaiNearest(lat, lon),
  ]);

  if (a4t && a4t.pm25 != null) {
    // Trust the real station for the dust + headline AQI; gases (often not
    // measured at the station, and in different units) come from the model.
    return {
      aqi: a4t.aqi,
      aqiStandard: "th",
      station: a4t.station,
      pm25: a4t.pm25,
      pm10: a4t.pm10 ?? om.pm10,
      o3: om.o3,
      no2: om.no2,
      so2: om.so2,
      co: om.co,
    };
  }
  return om;
}

// ── Nearby webcam preview images (for sky vision analysis) ──

interface WindyPreviewResponse {
  webcams?: Array<{
    images?: { current?: { preview?: string; thumbnail?: string } };
  }>;
}

export async function fetchNearbyWebcamPreviews(
  lat: number,
  lon: number,
  windyKey: string,
  limit = 3
): Promise<string[]> {
  if (!windyKey) return [];
  try {
    const url =
      `https://api.windy.com/webcams/api/v3/webcams?nearby=${lat},${lon},30` +
      `&include=images&limit=${limit}&lang=en`;
    const res = await fetch(url, {
      headers: { "x-windy-api-key": windyKey, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as WindyPreviewResponse;
    return (data.webcams ?? [])
      .map((w) => w.images?.current?.preview ?? w.images?.current?.thumbnail ?? "")
      .filter((u) => u.length > 0)
      .slice(0, limit);
  } catch (err) {
    console.error("Windy preview fetch error:", err);
    return [];
  }
}

// ── Reverse geocoding ──

interface NominatimResponse {
  display_name?: string;
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=th`;
    const res = await fetch(url, {
      headers: { "User-Agent": "NeeFon-AI/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResponse;
    return data?.display_name ?? null;
  } catch {
    return null;
  }
}
