import { eq, and, gte, lte, desc, isNotNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { weatherReadings, rainPatterns, dailyStats, userSettings } from "@db/schema";
import type { CurrentWeather, HourlyForecast, MinutelyData, TomorrowInterval, SkyConditions, AIPrediction, AISignal, AirQuality, PrecipNowcast, PrecipPoint, Intensity } from "@contracts/weather";

// ─────────────────────────────────────────
//  Types
// ─────────────────────────────────────────

interface SignalResult {
  predictedMinutes: number;
  confidence: number;
}

// ─────────────────────────────────────────
//  Utility: Wind direction
// ─────────────────────────────────────────

export function getWindDirection(deg: number | null | undefined): string {
  if (deg == null) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// ─────────────────────────────────────────
//  Utility: Haversine distance
// ─────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// ─────────────────────────────────────────
//  Utility: Thai-style clock time, e.g. "18.43"
// ─────────────────────────────────────────

// The app targets Thailand (UTC+7). Derive wall-clock parts in that zone no
// matter the server's timezone — the production VM runs in UTC, which would
// otherwise push every predicted time (and the hour-of-day logic) 7 hours off.
function thaiParts(d: Date): { hour: number; minute: number; month: number } {
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return { hour: t.getUTCHours(), minute: t.getUTCMinutes(), month: t.getUTCMonth() + 1 };
}

// Calendar date (YYYY-MM-DD) in Thailand time, for daily-stats bucketing.
function thaiDateStr(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function formatClockTime(d: Date): string {
  const { hour, minute } = thaiParts(d);
  return `${String(hour).padStart(2, "0")}.${String(minute).padStart(2, "0")}`;
}

// ─────────────────────────────────────────
//  Minute-level precipitation nowcast (Rainbow-style 2h timeline)
// ─────────────────────────────────────────

const INTENSITY_ORDER: Intensity[] = ["none", "light", "moderate", "heavy", "violent"];
const INTENSITY_TH: Record<Intensity, string> = {
  none: "ไม่มีฝน",
  light: "ฝนเบา",
  moderate: "ฝนปานกลาง",
  heavy: "ฝนหนัก",
  violent: "ฝนหนักมาก",
};

// Standard meteorological rain rates (mm/h).
function rateToIntensity(mmPerHr: number): Intensity {
  if (mmPerHr < 0.1) return "none";
  if (mmPerHr < 2.5) return "light";
  if (mmPerHr < 7.6) return "moderate";
  if (mmPerHr < 50) return "heavy";
  return "violent";
}

// Build a 2h minute-level rain timeline (onset / duration / stop / intensity)
// from whatever minute-level precip feed we have (Open-Meteo's 15-min steps).
function buildPrecipNowcast(minutely: MinutelyData[], currentRainMm: number, now: number): PrecipNowcast {
  const empty: PrecipNowcast = {
    available: false, stepMinutes: 15, horizonMinutes: 0, isRainingNow: false,
    startsInMin: -1, stopsInMin: -1, durationMin: 0,
    currentIntensity: "none", peakIntensity: "none", headline: "", points: [], source: "none",
  };
  if (!minutely.length) return empty;

  const sorted = [...minutely].sort((a, b) => a.dt - b.dt);
  const stepMin = sorted.length > 1 ? Math.max(1, Math.round((sorted[1].dt - sorted[0].dt) / 60)) : 15;
  const perHr = 60 / stepMin;

  const points: PrecipPoint[] = sorted
    .map((m) => {
      const t = Math.round((m.dt * 1000 - now) / 60000);
      const mm = Math.max(0, m.precipitation ?? 0);
      const mmPerHr = Math.round(mm * perHr * 10) / 10;
      return { t, mm: Math.round(mm * 100) / 100, mmPerHr, intensity: rateToIntensity(mmPerHr) };
    })
    .filter((p) => p.t >= -stepMin); // keep the current step + everything ahead
  if (!points.length) return empty;

  const horizonMinutes = points[points.length - 1].t + stepMin;
  const isRainingNow = currentRainMm > 0.1 || (points[0].t <= 0 && points[0].intensity !== "none");

  let startsInMin = -1;
  if (isRainingNow) startsInMin = 0;
  else {
    const first = points.find((p) => p.t >= 0 && p.intensity !== "none");
    if (first) startsInMin = first.t;
  }

  let stopsInMin = -1;
  let peakIntensity: Intensity = "none";
  if (startsInMin >= 0) {
    let inRain = false;
    for (const p of points) {
      if (p.t < startsInMin && !isRainingNow) continue;
      if (p.intensity !== "none") {
        inRain = true;
        if (INTENSITY_ORDER.indexOf(p.intensity) > INTENSITY_ORDER.indexOf(peakIntensity)) peakIntensity = p.intensity;
      } else if (inRain) {
        stopsInMin = p.t; // first dry step after rain began
        break;
      }
    }
  }
  const startAnchor = Math.max(0, startsInMin);
  const durationMin = startsInMin < 0 ? 0 : stopsInMin >= 0 ? stopsInMin - startAnchor : horizonMinutes - startAnchor;
  const currentIntensity: Intensity = isRainingNow ? (points[0].intensity === "none" ? "light" : points[0].intensity) : "none";

  // ── Ready-to-show Thai headline ──
  const horizonPhrase =
    horizonMinutes >= 120 ? "2 ชั่วโมงข้างหน้า" : horizonMinutes >= 60 ? "1 ชั่วโมงข้างหน้า" : `${horizonMinutes} นาทีข้างหน้า`;
  let headline: string;
  if (startsInMin < 0) {
    headline = `ไม่มีฝนใน ${horizonPhrase} ☀️`;
  } else if (isRainingNow) {
    const lvl = INTENSITY_TH[currentIntensity];
    headline =
      stopsInMin >= 0
        ? `🌧️ ${lvl}กำลังตก · จะหยุดในอีก ~${stopsInMin} นาที`
        : `🌧️ ${lvl}กำลังตก · ตกต่อเนื่องเกิน ${horizonMinutes} นาที`;
  } else {
    const lvl = INTENSITY_TH[peakIntensity];
    const dur = stopsInMin >= 0 ? ` · ตกประมาณ ${durationMin} นาที` : ` · ตกยาวเกิน ${horizonMinutes - startsInMin} นาที`;
    headline = `🌧️ ${lvl}จะเริ่มในอีก ~${startsInMin} นาที${dur}`;
  }

  return {
    available: true,
    stepMinutes: stepMin,
    horizonMinutes,
    isRainingNow,
    startsInMin,
    stopsInMin,
    durationMin,
    currentIntensity,
    peakIntensity,
    headline,
    points,
    source: stepMin <= 5 ? "OWM" : "Open-Meteo",
  };
}

// ─────────────────────────────────────────
//  Signal 1: Trend Analysis (weight: 35%)
//  Analyzes hourly POP trend using linear regression
//  to extrapolate when rain starts
// ─────────────────────────────────────────

function calculateTrendSignal(
  hourly: HourlyForecast[],
  current: CurrentWeather,
  threshold: number
): SignalResult {
  if (!hourly.length) {
    return { predictedMinutes: 999, confidence: 0.1 };
  }

  // Get POP values for next 12 hours
  const popData = hourly.slice(0, 12).map((h, i) => ({
    hour: i,
    pop: h.pop ?? 0,
  }));

  // If no POP data, return low confidence
  const maxPop = Math.max(...popData.map(d => d.pop));
  if (maxPop < 0.05) {
    return { predictedMinutes: 999, confidence: 0.15 };
  }

  // Linear regression on POP trend
  const n = popData.length;
  const sumX = popData.reduce((s, d) => s + d.hour, 0);
  const sumY = popData.reduce((s, d) => s + d.pop, 0);
  const sumXY = popData.reduce((s, d) => s + d.hour * d.pop, 0);
  const sumXX = popData.reduce((s, d) => s + d.hour * d.hour, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // If slope is positive (POP increasing), estimate when it crosses threshold
  if (slope > 0) {
    // When will POP cross the rain threshold?
    const hoursToThreshold = Math.max(0, (threshold - intercept) / slope);
    const minutes = Math.round(hoursToThreshold * 60);

    // Confidence based on slope steepness and data quality
    const steepnessConfidence = Math.min(slope * 3, 0.7);
    const currentPop = current.pop ?? 0;
    const currentBoost = currentPop > 0.3 ? 0.2 : 0;
    const confidence = Math.min(0.85, 0.2 + steepnessConfidence + currentBoost);

    return {
      predictedMinutes: Math.min(minutes, 720), // cap at 12 hours
      confidence,
    };
  }

  // POP is flat or decreasing
  // Check if current conditions already suggest rain
  if ((current.pop ?? 0) > threshold) {
    return {
      // Higher current POP → rain sooner. Deterministic (5–25 min).
      predictedMinutes: Math.max(5, Math.round((1 - (current.pop ?? 0)) * 25)),
      confidence: (current.pop ?? 0) * 0.8,
    };
  }

  return { predictedMinutes: 999, confidence: 0.1 };
}

// ─────────────────────────────────────────
//  Signal 2: Pattern Matching (weight: 30%)
//  Queries historical rain patterns from DB
//  to find similar conditions and their outcomes
// ─────────────────────────────────────────

async function calculatePatternSignal(
  current: CurrentWeather,
  location: { lat: number; lon: number }
): Promise<SignalResult> {
  const db = getDb();
  const now = new Date();
  const { hour: hourOfDay, month } = thaiParts(now);

  try {
    // Find similar patterns within tolerance
    const humidityMin = Math.max(0, (current.humidity ?? 50) - 15);
    const humidityMax = Math.min(100, (current.humidity ?? 50) + 15);
    const pressureMin = (current.pressure ?? 1013) - 8;
    const pressureMax = (current.pressure ?? 1013) + 8;
    const cloudsMin = Math.max(0, (current.clouds ?? 50) - 25);
    const cloudsMax = Math.min(100, (current.clouds ?? 50) + 25);

    const patterns = await db
      .select()
      .from(rainPatterns)
      .where(
        and(
          gte(rainPatterns.humidity, humidityMin),
          lte(rainPatterns.humidity, humidityMax),
          gte(rainPatterns.pressure, pressureMin),
          lte(rainPatterns.pressure, pressureMax),
          gte(rainPatterns.clouds, cloudsMin),
          lte(rainPatterns.clouds, cloudsMax),
          gte(rainPatterns.hourOfDay, hourOfDay - 2),
          lte(rainPatterns.hourOfDay, hourOfDay + 2),
          gte(rainPatterns.month, month - 1),
          lte(rainPatterns.month, month + 1),
          // Within 50km
          gte(rainPatterns.lat, String(location.lat - 0.5)),
          lte(rainPatterns.lat, String(location.lat + 0.5)),
          gte(rainPatterns.lon, String(location.lon - 0.5)),
          lte(rainPatterns.lon, String(location.lon + 0.5))
        )
      )
      .limit(20);

    if (!patterns.length) {
      return { predictedMinutes: 999, confidence: 0.05 };
    }

    // Weighted average: more recent patterns and closer locations get higher weight
    let totalWeight = 0;
    let weightedSum = 0;

    for (const p of patterns) {
      const dist = haversineKm(
        location.lat,
        location.lon,
        Number(p.lat),
        Number(p.lon)
      );
      const locationWeight = Math.max(0.3, 1 - dist / 100); // closer = higher weight
      const w = locationWeight;
      totalWeight += w;
      weightedSum += p.timeToRain * w;
    }

    const avgMinutes = Math.round(weightedSum / totalWeight);
    // Confidence based on number of matching patterns
    const confidence = Math.min(0.8, 0.15 + patterns.length * 0.03);

    return {
      predictedMinutes: Math.min(avgMinutes, 720),
      confidence,
    };
  } catch {
    return { predictedMinutes: 999, confidence: 0.05 };
  }
}

// ─────────────────────────────────────────
//  Signal 3: Rate of Change (weight: 20%)
//  Calculates how fast weather parameters
//  are changing to estimate time to rain
// ─────────────────────────────────────────

async function calculateRateOfChangeSignal(
  current: CurrentWeather,
  location: { lat: number; lon: number }
): Promise<SignalResult> {
  const db = getDb();

  try {
    // Get last 3 readings for rate calculation
    const previous = await db
      .select()
      .from(weatherReadings)
      .where(
        and(
          gte(weatherReadings.lat, String(location.lat - 0.01)),
          lte(weatherReadings.lat, String(location.lat + 0.01)),
          gte(weatherReadings.lon, String(location.lon - 0.01)),
          lte(weatherReadings.lon, String(location.lon + 0.01))
        )
      )
      .orderBy(desc(weatherReadings.timestamp))
      .limit(3);

    if (previous.length < 2) {
      return { predictedMinutes: 999, confidence: 0.1 };
    }

    // Calculate rates (per hour)
    const hrsBetween = 0.05; // ~3 min intervals ≈ 0.05 hours
    const latest = previous[0];
    const earliest = previous[previous.length - 1];

    const pressureDropRate =
      ((earliest.pressure ?? 1013) - (latest.pressure ?? 1013)) /
      (previous.length - 1) /
      hrsBetween;

    const humidityRiseRate =
      ((latest.humidity ?? 50) - (earliest.humidity ?? 50)) /
      (previous.length - 1) /
      hrsBetween;

    const cloudRiseRate =
      ((latest.clouds ?? 0) - (earliest.clouds ?? 0)) /
      (previous.length - 1) /
      hrsBetween;

    // Estimate time to rain based on rates
    const rates: Array<{ name: string; minutes: number; weight: number }> = [];

    // Pressure drop: 1 hPa/hour ≈ rain in 4-6 hours
    // 3 hPa/hour ≈ rain in 1-2 hours
    // 5+ hPa/hour ≈ rain very soon
    if (pressureDropRate > 0.5) {
      const pressureMins = Math.max(15, Math.round(360 / (pressureDropRate + 0.5)));
      rates.push({ name: "pressure", minutes: pressureMins, weight: 0.4 });
    }

    // Humidity rise: 5%/hour with high base humidity ≈ rain soon
    if (humidityRiseRate > 1 && (current.humidity ?? 0) > 65) {
      const humMins = Math.max(20, Math.round((100 - (current.humidity ?? 80)) / humidityRiseRate * 60));
      rates.push({ name: "humidity", minutes: humMins, weight: 0.35 });
    }

    // Cloud increase: 10%/hour ≈ rain in 2-3 hours
    if (cloudRiseRate > 3) {
      const cloudMins = Math.max(30, Math.round((100 - (current.clouds ?? 50)) / cloudRiseRate * 60));
      rates.push({ name: "clouds", minutes: cloudMins, weight: 0.25 });
    }

    if (rates.length === 0) {
      return { predictedMinutes: 999, confidence: 0.1 };
    }

    // Weighted average of rate-based estimates
    const totalW = rates.reduce((s, r) => s + r.weight, 0);
    const estimatedMinutes = Math.round(
      rates.reduce((s, r) => s + r.minutes * r.weight, 0) / totalW
    );

    // Confidence based on how many rate signals we have
    const confidence = Math.min(0.75, 0.2 + rates.length * 0.18);

    return {
      predictedMinutes: Math.min(estimatedMinutes, 720),
      confidence,
    };
  } catch {
    return { predictedMinutes: 999, confidence: 0.05 };
  }
}

// ─────────────────────────────────────────
//  Signal 4: Climate/Seasonal (weight: 15%)
//  Uses local climate patterns and
//  seasonal factors
// ─────────────────────────────────────────

function calculateClimateSignal(current: CurrentWeather): SignalResult {
  const now = new Date();
  const { hour, month } = thaiParts(now); // Thailand wall-clock (UTC+7)
  const humidity = current.humidity ?? 0;
  const clouds = current.clouds ?? 0;

  // Bangkok/Thailand patterns:
  // - Monsoon season: May-Oct (months 5-10)
  // - Peak convection: 14:00-18:00
  // - High humidity + clouds in afternoon = rain likely

  const isMonsoon = month >= 5 && month <= 10;
  const isPeakConvection = hour >= 13 && hour <= 18;

  let estimatedMinutes = 999;
  let confidence = 0.1;

  // Peak convection period with high humidity
  if (isPeakConvection && humidity > 70) {
    // Estimate based on how far into the window we are
    const hoursRemaining = 18 - hour;
    // Drier air → a bit longer until rain. Deterministic (+0–30 min).
    estimatedMinutes = Math.round(hoursRemaining * 60 * 0.6 + Math.max(0, 100 - humidity) * 0.3);
    confidence = isMonsoon ? 0.5 : 0.3;

    // Boost if very humid
    if (humidity > 85) {
      estimatedMinutes = Math.round(estimatedMinutes * 0.6);
      confidence += 0.15;
    }
    if (clouds > 80) {
      estimatedMinutes = Math.round(estimatedMinutes * 0.7);
      confidence += 0.1;
    }
  }

  // Late evening (after 18:00) with high humidity = possible overnight rain
  if (hour > 18 && humidity > 80 && clouds > 70) {
    estimatedMinutes = Math.round((24 - hour + 6) * 30); // sometime overnight
    confidence = isMonsoon ? 0.35 : 0.2;
  }

  // Morning (before noon) with high humidity and clouds = afternoon rain likely
  if (hour >= 6 && hour < 13 && humidity > 75 && clouds > 60) {
    // Drier air → afternoon rain a bit later. Deterministic (+0–60 min).
    estimatedMinutes = (13 - hour) * 60 + Math.round(Math.max(0, 100 - humidity) * 0.6);
    confidence = isMonsoon ? 0.4 : 0.25;
  }

  // Dry season (Nov-Apr) — lower confidence overall
  if (!isMonsoon) {
    confidence *= 0.6;
    estimatedMinutes = Math.round(estimatedMinutes * 1.5);
  }

  if (estimatedMinutes >= 999) {
    return { predictedMinutes: 999, confidence: 0.1 };
  }

  return {
    predictedMinutes: Math.min(estimatedMinutes, 720),
    confidence: Math.min(confidence, 0.7),
  };
}

// ─────────────────────────────────────────
//  Nowcast: professional precipitation forecasts
//  (OWM minutely + hourly POP, Tomorrow.io) — the
//  calibrated, primary driver of the prediction.
// ─────────────────────────────────────────

interface NowcastResult {
  hasData: boolean;       // any professional forecast available?
  rainProb: number;       // 0..1 best estimate of rain probability
  minutesToRain: number;  // when rain starts (999 = none seen)
  sources: number;        // how many independent sources indicate rain
  sourcesAvailable: number; // how many independent sources returned data
  hasMinutely: boolean;   // minute-level precip available (tighter timing)
  clear: boolean;         // forecasts confidently show NO rain
  peakMinutes: number;    // timing of the highest-POP hour (999 = none)
}

// Scan one {minutely, hourly} forecast source for near-term rain.
function scanForecastSource(
  minutely: MinutelyData[],
  hourly: HourlyForecast[],
  now: number
): { rain: boolean; minutesToRain: number; maxPop: number; maxPopHour: number; peakAtMs: number; intensityProb: number; hasMinutely: boolean } {
  let rain = false;
  let minutesToRain = 999;
  let maxPop = 0;
  let maxPopHour = -1;
  let peakAtMs = 0;
  let intensityProb = 0;

  // minutely precipitation (mm) — exact near-term timing
  for (const m of minutely) {
    if ((m.precipitation ?? 0) > 0.1) {
      rain = true;
      minutesToRain = Math.min(minutesToRain, Math.max(0, Math.round((m.dt * 1000 - now) / 60000)));
      intensityProb = Math.max(intensityProb, Math.min(0.97, 0.8 + (m.precipitation ?? 0) * 0.05));
      break;
    }
  }

  // hourly probability of precipitation (next 6 h)
  let firstRainHour = -1;
  for (let i = 0; i < Math.min(hourly.length, 6); i++) {
    const pop = hourly[i].pop ?? 0;
    if (pop > maxPop) {
      maxPop = pop;
      maxPopHour = i;
      peakAtMs = hourly[i].dt * 1000; // anchor to the forecast hour's real clock time
    }
    const rainHour = pop >= 0.5 || hourly[i].weatherMain === "Rain" || hourly[i].weatherMain === "Thunderstorm";
    if (rainHour && firstRainHour === -1) firstRainHour = i;
  }
  if (firstRainHour >= 0) {
    rain = true;
    // Use the hour's ABSOLUTE timestamp, not index×60 — otherwise the relative
    // estimate (and thus the predicted clock time) creeps forward every cycle.
    const hourMs = hourly[firstRainHour].dt * 1000;
    minutesToRain = Math.min(minutesToRain, Math.max(0, Math.round((hourMs - now) / 60000)));
  }

  return { rain, minutesToRain, maxPop, maxPopHour, peakAtMs, intensityProb, hasMinutely: minutely.length > 0 };
}

function computeNowcast(
  owmHourly: HourlyForecast[],
  owmMinutely: MinutelyData[],
  tmrIntervals: TomorrowInterval[],
  openMeteo?: { minutely: MinutelyData[]; hourly: HourlyForecast[] }
): NowcastResult {
  const now = Date.now();
  let rainProb = 0;
  let minutesToRain = 999;
  let sources = 0;
  let sourcesAvailable = 0;

  // 1) OpenWeatherMap (minutely + hourly POP)
  const owm = scanForecastSource(owmMinutely, owmHourly, now);
  rainProb = Math.max(rainProb, owm.maxPop, owm.intensityProb);
  if (owm.hasMinutely || owmHourly.length > 0) sourcesAvailable++;
  if (owm.rain) {
    sources++;
    minutesToRain = Math.min(minutesToRain, owm.minutesToRain);
  }

  // 2) Open-Meteo (15-min precip + hourly POP) — independent second source
  const om = openMeteo ? scanForecastSource(openMeteo.minutely, openMeteo.hourly, now) : null;
  if (om) {
    rainProb = Math.max(rainProb, om.maxPop, om.intensityProb);
    if (openMeteo!.minutely.length > 0 || openMeteo!.hourly.length > 0) sourcesAvailable++;
    if (om.rain) {
      sources++;
      minutesToRain = Math.min(minutesToRain, om.minutesToRain);
    }
  }

  // "Would-be" timing: the highest-POP hour among sources (even below the
  // warning threshold) so a borderline estimate lines up with the forecast.
  let peakProb = -1;
  let peakMinutes = 999;
  const considerPeak = (scan: { maxPop: number; maxPopHour: number; peakAtMs: number }) => {
    if (scan.maxPopHour >= 0 && scan.peakAtMs > 0 && scan.maxPop > peakProb) {
      peakProb = scan.maxPop;
      // Anchor to the forecast hour's clock time so the estimate stays stable.
      peakMinutes = Math.max(0, Math.round((scan.peakAtMs - now) / 60000));
    }
  };
  considerPeak(owm);
  if (om) considerPeak(om);

  // 3) Tomorrow.io per-minute probability / intensity (when not rate-limited)
  let maxTmrProb = 0;
  let tmrRain = false;
  if (tmrIntervals.length > 0) sourcesAvailable++;
  for (const iv of tmrIntervals) {
    const prob = (iv.values.precipitationProbability ?? 0) / 100;
    const intensity = iv.values.precipitationIntensity ?? 0;
    maxTmrProb = Math.max(maxTmrProb, prob);
    if ((prob >= 0.5 || intensity > 0.1) && !tmrRain) {
      tmrRain = true;
      sources++;
      minutesToRain = Math.min(minutesToRain, Math.max(0, Math.round((new Date(iv.startTime).getTime() - now) / 60000)));
    }
  }
  rainProb = Math.max(rainProb, maxTmrProb);

  // ── Minute-level veto on the ONSET time ──────────────────────────────────
  // Hourly POP is whole-hour and coarse: a 56%-POP current hour makes the
  // hourly scan report "rain in 0 min" even when the precise minute-level
  // precipitation shows the next hour is still bone dry. Trust the minutely
  // data for *when* rain starts so we never scream "กลับอาคารด่วน" while it's
  // still dry. (The minutely feed here is Open-Meteo's 15-min precipitation.)
  let mRainAt = Infinity; // minutes to the first minute-level precip
  let mHorizon = 0; // how far ahead the minute-level data reaches
  let hasMin = false;
  for (const arr of [owmMinutely, openMeteo?.minutely ?? []]) {
    if (arr.length > 0) hasMin = true;
    for (const m of arr) {
      const mins = (m.dt * 1000 - now) / 60000;
      if (mins > mHorizon) mHorizon = mins;
      if ((m.precipitation ?? 0) > 0.1 && mins < mRainAt) mRainAt = Math.max(0, mins);
    }
  }
  if (hasMin && minutesToRain < 999) {
    if (mRainAt < Infinity) {
      // Minutely actually sees rain → use its precise onset.
      minutesToRain = Math.round(mRainAt);
    } else {
      // Minutely is dry through its whole window → rain (if any) can't be
      // sooner than the end of that confirmed-dry window.
      minutesToRain = Math.max(minutesToRain, Math.round(mHorizon));
    }
  }

  // Confident clear: every available source shows little/no near-term rain.
  // Previously gated on OWM's own minutely, which is empty when the user has no
  // One Call 3.0 subscription — so "clear" never fired. Use whichever minute-
  // level feed exists (Open-Meteo's) so a genuinely dry forecast reads as safe.
  const owmClear = !owm.rain && owm.maxPop < 0.2;
  const omClear = !om || (!om.rain && om.maxPop < 0.2);
  const tmrClear = tmrIntervals.length === 0 || (!tmrRain && maxTmrProb < 0.2);
  const clear = hasMin && mRainAt === Infinity && owmClear && omClear && tmrClear;

  const hasData =
    owmHourly.length > 0 ||
    owm.hasMinutely ||
    (openMeteo ? openMeteo.hourly.length > 0 || openMeteo.minutely.length > 0 : false) ||
    tmrIntervals.length > 0;

  return {
    hasData,
    rainProb: Math.min(1, rainProb),
    // keep 999 ("no rain seen") rather than collapsing to the 720 cap
    minutesToRain: minutesToRain < 999 ? Math.min(minutesToRain, 720) : 999,
    sources,
    sourcesAvailable,
    hasMinutely: owm.hasMinutely || (om?.hasMinutely ?? false),
    clear,
    peakMinutes,
  };
}

// ─────────────────────────────────────────
//  Ensemble Fusion
//  Nowcast-led, with the 4 heuristic signals as support
// ─────────────────────────────────────────

export async function runAIPrediction(
  current: CurrentWeather,
  hourly: HourlyForecast[],
  location: { lat: number; lon: number },
  opts?: {
    minutely?: MinutelyData[];
    tmrIntervals?: TomorrowInterval[];
    openMeteo?: { minutely: MinutelyData[]; hourly: HourlyForecast[] };
    sky?: SkyConditions;
    customWeights?: { trend: number; pattern: number; rateOfChange: number; climate: number };
  }
): Promise<AIPrediction> {
  const db = getDb();
  const minutely = opts?.minutely ?? [];
  const tmrIntervals = opts?.tmrIntervals ?? [];

  // Minute-level precip timeline — prefer the feed that actually has data
  // (OWM minutely is empty without One Call 3.0, so this is usually Open-Meteo).
  const precipMinutely = minutely.length > 0 ? minutely : opts?.openMeteo?.minutely ?? [];
  const precipNowcast = buildPrecipNowcast(precipMinutely, current.rain1h ?? 0, Date.now());

  // Get settings for threshold
  let threshold = 0.55;
  let weights = opts?.customWeights;

  if (!weights) {
    try {
      const settings = await db.select().from(userSettings).limit(1);
      if (settings[0]) {
        threshold = Number(settings[0].rainThreshold) || 0.55;
        weights = {
          trend: Number(settings[0].weightTrend) || 0.35,
          pattern: Number(settings[0].weightPattern) || 0.30,
          rateOfChange: Number(settings[0].weightRateOfChange) || 0.20,
          climate: Number(settings[0].weightClimate) || 0.15,
        };
      }
    } catch {
      // use defaults
    }
  }

  weights = weights ?? { trend: 0.35, pattern: 0.30, rateOfChange: 0.20, climate: 0.15 };

  // Check if it's already raining
  const currentRain = current.rain1h ?? 0;
  if (currentRain > 0.5) {
    const now = new Date();
    return {
      willRain: true,
      isRainingNow: true,
      predictedStartTime: formatClockTime(now),
      predictedStartTimestamp: now,
      timeToRainMinutes: 0,
      rainWindowMinutes: 0,
      confidence: 0.95,
      confidencePercent: 95,
      rainProbabilityPercent: 100,
      signals: [
        { name: "Current Rain Detected", predictedMinutes: 0, confidence: 0.95, weight: 1, active: true },
      ],
      recommendation: "🌧️ ฝนกำลังตกอยู่แล้ว! กลับอาคารด่วน!",
      precipNowcast: precipNowcast.available ? precipNowcast : undefined,
    };
  }

  // ── Signal 0: Nowcast from professional forecasts (primary driver) ──
  const nowcast = computeNowcast(hourly, minutely, tmrIntervals, opts?.openMeteo);

  // ── Heuristic signals (supporting) ──
  const trendResult = calculateTrendSignal(hourly, current, threshold);
  const patternResult = await calculatePatternSignal(current, location);
  const rateResult = await calculateRateOfChangeSignal(current, location);
  const climateResult = calculateClimateSignal(current);

  // When the forecasts confidently show clear skies, damp the heuristic guesses
  // so humidity/pressure heuristics can't manufacture false rain alarms.
  const heuristicDamp = nowcast.clear ? 0.25 : 1;

  const signals: AISignal[] = [
    {
      name: "Nowcast",
      predictedMinutes: nowcast.minutesToRain,
      confidence: nowcast.rainProb,
      weight: 1.0,
      active: nowcast.minutesToRain < 999,
    },
    {
      name: "Trend Analysis",
      predictedMinutes: trendResult.predictedMinutes,
      confidence: trendResult.confidence * heuristicDamp,
      weight: weights.trend,
      active: trendResult.predictedMinutes < 999,
    },
    {
      name: "Pattern Matching",
      predictedMinutes: patternResult.predictedMinutes,
      confidence: patternResult.confidence * heuristicDamp,
      weight: weights.pattern,
      active: patternResult.predictedMinutes < 999,
    },
    {
      name: "Rate of Change",
      predictedMinutes: rateResult.predictedMinutes,
      confidence: rateResult.confidence * heuristicDamp,
      weight: weights.rateOfChange,
      active: rateResult.predictedMinutes < 999,
    },
    {
      name: "Climate Signal",
      predictedMinutes: climateResult.predictedMinutes,
      confidence: climateResult.confidence * heuristicDamp,
      weight: weights.climate,
      active: climateResult.predictedMinutes < 999,
    },
  ];

  // Weighted blend of the heuristic signals (used when no forecast data exists)
  const activeHeuristics = signals.slice(1).filter((s) => s.active);
  const heuristicWeight = activeHeuristics.reduce((s, sig) => s + sig.weight, 0);
  const heuristicMinutes =
    heuristicWeight > 0
      ? activeHeuristics.reduce((s, sig) => s + sig.predictedMinutes * sig.weight, 0) / heuristicWeight
      : 999;
  const heuristicConfidence =
    heuristicWeight > 0
      ? activeHeuristics.reduce((s, sig) => s + sig.confidence * sig.weight, 0) / heuristicWeight
      : 0;

  // ── Rain probability + timing ──
  // The nowcast drives the verdict whenever forecast data is available;
  // heuristics only fill in when there is none.
  let rainProb: number;
  let timeToRain: number;
  // Uncertainty window (± minutes) around the predicted clock time. Tighter
  // when we have minute-level precip data, wider for hourly-POP resolution.
  // Capped at 30 min — we never show a vaguer window than that.
  let windowMinutes = 30;

  // Only commit to a clock time when rain is genuinely plausible. Below this we
  // show "no rain signal" rather than inventing a time the user can't trust.
  const TIME_FLOOR = 0.3;

  if (nowcast.clear) {
    rainProb = Math.min(nowcast.rainProb, 0.1);
    timeToRain = 999;
  } else if (nowcast.hasData) {
    // Trust the professional forecast more; heuristic guesses contribute little,
    // which keeps humidity/pressure noise from manufacturing false alarms.
    rainProb = Math.min(1, nowcast.rainProb * 0.92 + heuristicConfidence * 0.08);
    if (nowcast.minutesToRain < 999) {
      timeToRain = nowcast.minutesToRain;
      windowMinutes = nowcast.hasMinutely ? 15 : 30; // minute-level data → tighter
    } else if (rainProb >= TIME_FLOOR && nowcast.peakMinutes < 999) {
      // Borderline: show the most-likely (peak-POP) hour, hourly resolution.
      timeToRain = nowcast.peakMinutes;
      windowMinutes = 30;
    } else {
      timeToRain = 999; // real rain chance too low — don't guess a time
    }
  } else {
    rainProb = heuristicConfidence;
    timeToRain =
      rainProb >= TIME_FLOOR && activeHeuristics.length > 0 ? Math.round(heuristicMinutes) : 999;
  }

  // ── Webcam sky vision: nudge the probability using the actual sky nearby ──
  const sky = opts?.sky;
  if (sky?.available) {
    if (sky.isRaining) {
      // Rain is literally visible in nearby webcams → imminent.
      rainProb = Math.max(rainProb, 0.8);
      timeToRain = Math.min(timeToRain < 999 ? timeToRain : 20, 20);
      windowMinutes = 10; // seen directly → tight window
    } else {
      rainProb = Math.min(1, Math.max(0, rainProb + sky.rainRiskBoost));
    }
    signals.push({
      name: "Webcam Sky",
      predictedMinutes: sky.isRaining ? 0 : rainProb >= threshold ? timeToRain : 999,
      confidence: sky.confidence,
      weight: 0.5,
      active: sky.isRaining || sky.rainRiskBoost > 0.05,
    });
  }

  // Precision guard: most false alarms come from a single forecast source's
  // hourly POP for convective rain still hours away (one model over-states
  // afternoon storms). Require a higher bar there — but keep the normal
  // threshold for imminent rain (minute-level data), corroborated rain
  // (≥2 sources agree), or rain actually seen on the webcams, so recall
  // (catching real rain) is unaffected.
  let effectiveThreshold = threshold;
  if (!nowcast.hasMinutely && timeToRain > 60 && nowcast.sources <= 1 && !(sky?.isRaining)) {
    effectiveThreshold = Math.max(threshold, 0.65);
  }
  const willRain = rainProb >= effectiveThreshold;

  // ── Verdict confidence: how sure we are of the rain / no-rain call ──
  let confidence: number;
  if (willRain) {
    confidence = rainProb;
    // Rain that is still hours away is far less certain than imminent rain —
    // a forecast's reliability decays with lead time. Don't show "มั่นใจมาก"
    // for a high POP that's 5 hours out while the sky is currently clear.
    if (timeToRain > 60) {
      const leadFactor = Math.max(0.45, 1 - (timeToRain - 60) / 360);
      confidence *= leadFactor;
    }
    // Source disagreement: rainProb takes the MAX across sources (so we never
    // miss rain one model catches) — but when several sources have data and
    // only one actually flags rain, we're much less sure. Don't claim high
    // confidence off a single outlier forecast.
    if (nowcast.sourcesAvailable >= 2 && nowcast.sources <= 1) {
      confidence *= 0.7;
    }
    // Only one forecast source available (the others are down / rate-limited) —
    // a single model with no cross-validation can't justify very high
    // verdict confidence, no matter how high its POP.
    if (nowcast.sourcesAvailable <= 1) {
      confidence = Math.min(confidence, 0.8);
    }
    // A clear/sunny sky seen on the nearby webcams right now directly
    // contradicts a near-term rain call — pull confidence down when the
    // vision tier strongly disagrees.
    if (sky?.available && sky.rainRiskBoost < 0 && sky.confidence >= 0.6 && timeToRain > 30) {
      confidence *= 0.8;
    }
  } else if (nowcast.clear) {
    confidence = 0.9; // forecasts clearly show no rain
  } else if (nowcast.hasData) {
    confidence = 0.55 + (1 - rainProb) * 0.3;
  } else {
    confidence = 0.4; // no forecast data — genuinely uncertain
  }
  // Independent sources agreeing → more confident in the verdict
  if (nowcast.sources >= 2) confidence += 0.06;
  confidence = Math.min(0.97, Math.max(0.05, confidence));
  const confidencePercent = Math.round(confidence * 100);

  // ── Predicted clock time ──
  const now = new Date();
  const predictedStart =
    timeToRain < 999 ? new Date(now.getTime() + timeToRain * 60000) : now;
  const predictedStartTime = timeToRain < 999 ? formatClockTime(predictedStart) : "--.--";

  // ── Recommendation ──
  let recommendation: string;
  if (timeToRain >= 999) {
    recommendation = `✅ สภาพอากาศปลอดภัย ไม่มีสัญญาณฝน (มั่นใจ ${confidencePercent}%)`;
  } else if (!willRain) {
    recommendation = `🌤️ โอกาสฝนยังไม่ถึงเกณฑ์เตือน — หากตกคาดว่าราว ${predictedStartTime} น.`;
  } else if (timeToRain <= 10) {
    recommendation = `🚨 ฝนใกล้มาก! คาดว่าตกตอน ${predictedStartTime} น. — กลับอาคารด่วน!`;
  } else if (timeToRain <= 30) {
    recommendation = `⚠️ ฝนจะตกตอน ${predictedStartTime} น. (อีก ~${timeToRain} นาที) รีบหาที่หลบ`;
  } else if (timeToRain <= 60) {
    recommendation = `⏰ ฝนจะตกตอน ${predictedStartTime} น. (อีก ~${timeToRain} นาที)`;
  } else {
    recommendation = `🌧️ คาดว่าฝนจะตกตอน ${predictedStartTime} น. (อีก ~${Math.round(timeToRain / 60)} ชั่วโมง)`;
  }

  return {
    willRain,
    // "Raining now" requires real observation (webcam sky vision actually sees
    // rain) — NOT just a forecast whose would-be time rounded to 0 minutes.
    isRainingNow: sky?.isRaining === true,
    predictedStartTime,
    predictedStartTimestamp: predictedStart,
    timeToRainMinutes: timeToRain,
    rainWindowMinutes: timeToRain < 999 ? windowMinutes : 0,
    confidence,
    confidencePercent,
    rainProbabilityPercent: Math.round(rainProb * 100),
    signals,
    recommendation,
    sky: sky?.available ? sky : undefined,
    precipNowcast: precipNowcast.available ? precipNowcast : undefined,
  };
}

// ─────────────────────────────────────────
//  Store weather reading + AI prediction
// ─────────────────────────────────────────

export async function storeWeatherReading(
  data: {
    lat: number;
    lon: number;
    current: CurrentWeather;
    aiPrediction: AIPrediction;
    airQuality?: AirQuality;
    tmrData?: {
      precipProb: number;
      precipIntensity: number;
      cloudCover: number;
      humidity: number;
    };
  }
) {
  const db = getDb();

  try {
    await db.insert(weatherReadings).values({
      lat: String(data.lat),
      lon: String(data.lon),
      temperature: String(data.current.temp),
      feelsLike: String(data.current.feels_like),
      humidity: data.current.humidity,
      windSpeed: String(data.current.wind_speed),
      windDeg: data.current.wind_deg,
      pressure: data.current.pressure,
      dewPoint: data.current.dew_point != null ? String(data.current.dew_point) : null,
      uvi: data.current.uvi != null ? String(data.current.uvi) : null,
      visibility: data.current.visibility,
      clouds: data.current.clouds,
      rain1h: data.current.rain1h != null ? String(data.current.rain1h) : null,
      rain3h: data.current.rain3h != null ? String(data.current.rain3h) : null,
      pop: data.current.pop != null ? String(data.current.pop) : null,
      aqi: data.airQuality?.aqi ?? null,
      pm25: data.airQuality?.pm25 != null ? String(data.airQuality.pm25) : null,
      pm10: data.airQuality?.pm10 != null ? String(data.airQuality.pm10) : null,
      tmrPrecipProb: data.tmrData?.precipProb != null ? String(data.tmrData.precipProb) : null,
      tmrPrecipIntensity: data.tmrData?.precipIntensity != null ? String(data.tmrData.precipIntensity) : null,
      tmrCloudCover: data.tmrData?.cloudCover != null ? String(data.tmrData.cloudCover) : null,
      tmrHumidity: data.tmrData?.humidity != null ? String(data.tmrData.humidity) : null,
      weatherMain: data.current.weatherMain,
      weatherDesc: data.current.weatherDesc,
      weatherIcon: data.current.weatherIcon,
      aiPredictedRain: data.aiPrediction.willRain,
      aiPredictedStartTime: data.aiPrediction.predictedStartTimestamp,
      aiConfidence: String(data.aiPrediction.confidence),
      aiTimeToRain: data.aiPrediction.timeToRainMinutes,
    });
  } catch (err) {
    console.error("Failed to store weather reading:", err);
  }
}

// ─────────────────────────────────────────
//  Validation: Compare predictions vs actual
// ─────────────────────────────────────────

export async function validatePredictions(location: { lat: number; lon: number }) {
  const db = getDb();

  try {
    // Get unvalidated predictions from the last 4 hours (oldest first, so the
    // ones whose window has already elapsed are processed first).
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // ดึงทั้งการทำนายว่า "ฝน" และ "ไม่ฝน" เพื่อให้นับ FN/TN ได้ครบ
    const pending = await db
      .select()
      .from(weatherReadings)
      .where(
        and(
          gte(weatherReadings.timestamp, fourHoursAgo),
          eq(weatherReadings.validated, false)
        )
      )
      .orderBy(weatherReadings.timestamp)
      .limit(30);

    if (!pending.length) return { validated: 0, accuracy: 0 };

    // Fetch recent local readings once, then check whether it actually rained
    // within each prediction's own window — far more accurate than comparing
    // every prediction against a single "is it raining right now" snapshot.
    const recent = await db
      .select()
      .from(weatherReadings)
      .where(
        and(
          gte(weatherReadings.lat, String(location.lat - 0.01)),
          lte(weatherReadings.lat, String(location.lat + 0.01)),
          gte(weatherReadings.lon, String(location.lon - 0.01)),
          lte(weatherReadings.lon, String(location.lon + 0.01)),
          gte(weatherReadings.timestamp, new Date(Date.now() - 4 * 60 * 60 * 1000))
        )
      )
      .orderBy(weatherReadings.timestamp);

    if (!recent.length) return { validated: 0, accuracy: 0 };

    const readingIsRain = (r: typeof weatherReadings.$inferSelect): boolean =>
      (r.rain1h != null && Number(r.rain1h) > 0.3) ||
      r.weatherMain === "Rain" ||
      r.weatherMain === "Thunderstorm";

    const rainedBetween = (startMs: number, endMs: number): boolean =>
      recent.some((r) => {
        const t = r.timestamp.getTime();
        return t >= startMs && t <= endMs && readingIsRain(r);
      });

    const graceMs = 15 * 60 * 1000;
    let tp = 0, fp = 0, fn = 0, tn = 0, evaluated = 0;

    for (const pred of pending) {
      const predTime = pred.timestamp.getTime();
      const predictedRain = pred.aiPredictedRain ?? false;

      // Validation window: a rain prediction is checked up to its predicted time
      // (+15 min grace); a no-rain prediction is checked over a 2-hour horizon.
      const windowEnd = predictedRain
        ? (pred.aiPredictedStartTime ?? new Date(predTime)).getTime() + graceMs
        : predTime + 2 * 60 * 60 * 1000;
      if (windowEnd > Date.now()) continue; // not enough time has elapsed yet

      const actualRain = rainedBetween(predTime, windowEnd);
      evaluated++;

      if (predictedRain && actualRain) {
        tp++;
        const rainReading = recent.find(
          (r) => r.timestamp.getTime() >= predTime && r.timestamp.getTime() <= windowEnd && readingIsRain(r)
        );
        await storeRainPattern(rainReading ?? pred, pred, location);
      } else if (predictedRain && !actualRain) {
        fp++;
      } else if (!predictedRain && actualRain) {
        fn++;
      } else {
        tn++;
      }

      await db
        .update(weatherReadings)
        .set({ validated: true, actualRain })
        .where(eq(weatherReadings.id, pred.id));
    }

    // ยังไม่มีรายการไหนถึงเวลาตรวจสอบ → ยังไม่อัปเดตสถิติ
    if (evaluated === 0) return { validated: 0, accuracy: 0 };

    // Update daily stats
    const today = thaiDateStr(new Date());
    const existing = await db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.date, today))
      .limit(1);

    if (existing[0]) {
      const existingRow = existing[0];
      await db
        .update(dailyStats)
        .set({
          tp: (existingRow.tp ?? 0) + tp,
          fp: (existingRow.fp ?? 0) + fp,
          fn: (existingRow.fn ?? 0) + fn,
          tn: (existingRow.tn ?? 0) + tn,
          total: (existingRow.total ?? 0) + evaluated,
        })
        .where(eq(dailyStats.id, existingRow.id));
    } else {
      await db.insert(dailyStats).values({
        date: today,
        tp,
        fp,
        fn,
        tn,
        total: evaluated,
      });
    }

    const accuracy = evaluated > 0 ? (tp + tn) / evaluated : 0;

    return { validated: evaluated, accuracy };
  } catch (err) {
    console.error("Validation error:", err);
    return { validated: 0, accuracy: 0 };
  }
}

// ─────────────────────────────────────────
//  Store rain pattern for learning
// ─────────────────────────────────────────

async function storeRainPattern(
  current: typeof weatherReadings.$inferSelect,
  prediction: typeof weatherReadings.$inferSelect,
  location: { lat: number; lon: number }
) {
  const db = getDb();
  const now = new Date();

  try {
    // Only store if we have enough data
    if (!current.humidity || !current.pressure) return;

    await db.insert(rainPatterns).values({
      humidity: current.humidity,
      pressure: current.pressure,
      pressureTrend3h: current.pressureTrend != null ? String(current.pressureTrend) : null,
      clouds: current.clouds ?? 50,
      dewPointDelta: current.dewPoint != null && current.temperature != null
        ? String(Number(current.temperature) - Number(current.dewPoint))
        : null,
      windSpeed: current.windSpeed != null ? String(current.windSpeed) : null,
      windDeg: current.windDeg,
      pop: current.pop != null ? String(current.pop) : null,
      hourOfDay: thaiParts(now).hour,
      month: thaiParts(now).month,
      timeToRain: prediction.aiTimeToRain ?? 30,
      rainIntensity: current.rain1h != null ? String(current.rain1h) : "0",
      lat: String(location.lat),
      lon: String(location.lon),
      locationName: null,
    });
  } catch (err) {
    console.error("Failed to store rain pattern:", err);
  }
}

// ─────────────────────────────────────────
//  Get accuracy stats
// ─────────────────────────────────────────

export async function getAccuracyStats(days: number = 7) {
  const db = getDb();

  try {
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(thaiDateStr(d));
    }

    const stats = await db
      .select()
      .from(dailyStats)
      .where(gte(dailyStats.date, dates[0]))
      .orderBy(dailyStats.date);

    // Aggregate
    let tp = 0, fp = 0, fn = 0, tn = 0, total = 0;
    for (const s of stats) {
      tp += s.tp ?? 0;
      fp += s.fp ?? 0;
      fn += s.fn ?? 0;
      tn += s.tn ?? 0;
      total += s.total ?? 0;
    }

    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const csi = (tp + fp + fn) > 0 ? tp / (tp + fp + fn) : 0;

    return {
      accuracy: Math.round(accuracy * 1000) / 10,
      precision: Math.round(precision * 1000) / 10,
      recall: Math.round(recall * 1000) / 10,
      csi: Math.round(csi * 1000) / 10,
      confusionMatrix: { tp, fp, fn, tn },
      dailyStats: stats.map(s => ({
        date: s.date ?? "",
        accuracy: s.total && s.total > 0
          ? Math.round(((s.tp ?? 0) + (s.tn ?? 0)) / s.total * 1000) / 10
          : 0,
        total: s.total ?? 0,
      })),
    };
  } catch (err) {
    console.error("Accuracy stats error:", err);
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      csi: 0,
      confusionMatrix: { tp: 0, fp: 0, fn: 0, tn: 0 },
      dailyStats: [],
    };
  }
}

// ─────────────────────────────────────────
//  Get prediction history
// ─────────────────────────────────────────

// Recent air-quality samples (oldest → newest) for the PM2.5 trend sparkline.
export async function getAirQualityHistory(limit: number = 96) {
  const db = getDb();
  try {
    const rows = await db
      .select({
        timestamp: weatherReadings.timestamp,
        aqi: weatherReadings.aqi,
        pm25: weatherReadings.pm25,
        pm10: weatherReadings.pm10,
      })
      .from(weatherReadings)
      .where(isNotNull(weatherReadings.pm25))
      .orderBy(desc(weatherReadings.timestamp))
      .limit(limit);

    return rows
      .reverse()
      .map((r) => ({
        timestamp: r.timestamp,
        aqi: r.aqi,
        pm25: r.pm25 != null ? Number(r.pm25) : null,
        pm10: r.pm10 != null ? Number(r.pm10) : null,
      }));
  } catch (err) {
    console.error("Air-quality history error:", err);
    return [];
  }
}

export async function getPredictionHistory(limit: number = 50) {
  const db = getDb();

  try {
    const readings = await db
      .select()
      .from(weatherReadings)
      .orderBy(desc(weatherReadings.timestamp))
      .limit(limit);

    return readings.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      predictedRain: r.aiPredictedRain,
      confidence: r.aiConfidence != null ? Math.round(Number(r.aiConfidence) * 100) : 0,
      predictedStartTime: r.aiPredictedStartTime,
      timeToRain: r.aiTimeToRain,
      actualRain: r.actualRain,
      validated: r.validated,
      temperature: r.temperature,
      humidity: r.humidity,
      weatherMain: r.weatherMain,
    }));
  } catch (err) {
    console.error("History error:", err);
    return [];
  }
}
