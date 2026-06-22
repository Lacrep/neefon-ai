import { fetchOWMOneCall, fetchOWMCurrent, fetchTomorrowIO, fetchOpenMeteo, fetchAirQuality, fetchNearbyWebcamPreviews } from "./weatherApi";
import { runAIPrediction, storeWeatherReading, validatePredictions } from "./aiEngine";
import { analyzeSky } from "./skyVision";
import { getDb } from "../queries/connection";
import { userSettings } from "@db/schema";
import type { AIPrediction, AirQuality, CurrentWeather, HourlyForecast } from "@contracts/weather";

export interface GatherInput {
  lat: number;
  lon: number;
  owmKey: string;
  tomorrowKey?: string;
  windyKey?: string;
  geminiKey?: string;
}

export interface GetCurrentResult {
  current: CurrentWeather | null;
  hourly: HourlyForecast[];
  aiPrediction: AIPrediction | null;
  airQuality: AirQuality;
  lastUpdated: Date;
}

// Fetch every source, run the AI prediction, and (when `store` is true) persist
// the reading + validate past predictions. Shared by the read-only API
// (`weather.getCurrent`, store=false) and the 24/7 background collector
// (store=true) so storage happens exactly once per cycle regardless of whether
// a browser tab is open.
export async function gatherWeather(input: GatherInput, store: boolean): Promise<GetCurrentResult> {
  const { lat, lon, owmKey, tomorrowKey, windyKey, geminiKey } = input;

  const [owmData, owmCurrent, tmrData, omData, airQuality] = await Promise.all([
    fetchOWMOneCall(lat, lon, owmKey),
    fetchOWMCurrent(lat, lon, owmKey),
    tomorrowKey ? fetchTomorrowIO(lat, lon, tomorrowKey) : Promise.resolve({ intervals: [] }),
    fetchOpenMeteo(lat, lon),
    fetchAirQuality(lat, lon),
  ]);

  const current = owmData.current ?? owmCurrent ?? omData.current;

  if (!current) {
    return { current: null, hourly: [], aiPrediction: null, airQuality, lastUpdated: new Date() };
  }

  if (current.uvi == null && omData.uvi != null) current.uvi = omData.uvi;
  if (current.visibility == null && omData.current?.visibility != null) current.visibility = omData.current.visibility;

  const hourly = owmData.hourly.length > 0 ? owmData.hourly : omData.hourly;

  const sky = windyKey
    ? await analyzeSky({ lat, lon, geminiKey, getUrls: () => fetchNearbyWebcamPreviews(lat, lon, windyKey, 3) })
    : undefined;

  const aiPrediction = await runAIPrediction(
    current,
    hourly,
    { lat, lon },
    { minutely: owmData.minutely, tmrIntervals: tmrData.intervals, openMeteo: omData, sky }
  );

  if (store) {
    const tmrAvg = tmrData.intervals.length > 0
      ? {
          precipProb: tmrData.intervals.reduce((s, i) => s + (i.values.precipitationProbability ?? 0), 0) / tmrData.intervals.length / 100,
          precipIntensity: tmrData.intervals.reduce((s, i) => s + (i.values.precipitationIntensity ?? 0), 0) / tmrData.intervals.length,
          cloudCover: tmrData.intervals.reduce((s, i) => s + (i.values.cloudCover ?? 0), 0) / tmrData.intervals.length,
          humidity: tmrData.intervals.reduce((s, i) => s + (i.values.humidity ?? 0), 0) / tmrData.intervals.length,
        }
      : undefined;

    await storeWeatherReading({ lat, lon, current, aiPrediction, airQuality, tmrData: tmrAvg });
    await validatePredictions({ lat, lon });
  }

  return { current, hourly, aiPrediction, airQuality, lastUpdated: new Date() };
}

// ── 24/7 background collector ──
// Runs a collection cycle on an interval using the saved settings, so data
// keeps accumulating even when no browser tab is open. Guarded on globalThis
// so Vite HMR re-imports don't spawn duplicate intervals.
const COLLECT_INTERVAL_MS = 3 * 60 * 1000;

async function runCycle(): Promise<void> {
  try {
    const db = getDb();
    const rows = await db.select().from(userSettings).limit(1);
    const s = rows[0];
    if (!s || !s.owmKey) return; // not configured yet — nothing to collect
    await gatherWeather(
      {
        lat: Number(s.lat),
        lon: Number(s.lon),
        owmKey: s.owmKey,
        tomorrowKey: s.tomorrowKey ?? undefined,
        windyKey: s.windyKey ?? undefined,
        geminiKey: s.geminiKey ?? undefined,
      },
      true
    );
    console.log(`[collector] reading stored @ ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[collector] cycle failed:", err);
  }
}

export function startCollector(): void {
  const g = globalThis as unknown as { __neefonCollector?: ReturnType<typeof setInterval> };
  if (g.__neefonCollector) return; // already running (survives HMR re-imports)
  setTimeout(() => void runCycle(), 15_000); // first cycle shortly after boot
  g.__neefonCollector = setInterval(() => void runCycle(), COLLECT_INTERVAL_MS);
  console.log(`[collector] started — collecting every ${COLLECT_INTERVAL_MS / 60000} min`);
}
