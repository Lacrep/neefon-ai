import { z } from "zod";

// ── Weather Data Types ──

export const CurrentWeatherSchema = z.object({
  temp: z.number(),
  feels_like: z.number(),
  humidity: z.number(),
  wind_speed: z.number(),
  wind_deg: z.number().optional(),
  wind_gust: z.number().optional(),
  pressure: z.number(),
  dew_point: z.number().optional(),
  uvi: z.number().optional(),
  visibility: z.number().optional(),
  clouds: z.number().optional(),
  rain1h: z.number().optional(),
  rain3h: z.number().optional(),
  pop: z.number().optional(),
  weatherMain: z.string().optional(),
  weatherDesc: z.string().optional(),
  weatherIcon: z.string().optional(),
});

export const HourlyForecastSchema = z.object({
  dt: z.number(),
  temp: z.number(),
  pop: z.number(),
  weatherMain: z.string().optional(),
  weatherDesc: z.string().optional(),
  weatherIcon: z.string().optional(),
});

export const MinutelyDataSchema = z.object({
  dt: z.number(),
  precipitation: z.number(),
});

export const TomorrowIntervalSchema = z.object({
  startTime: z.string(),
  values: z.object({
    precipitationProbability: z.number().optional(),
    precipitationIntensity: z.number().optional(),
    cloudCover: z.number().optional(),
    humidity: z.number().optional(),
  }),
});

// ── Air Quality (Open-Meteo Air Quality API — free, no key) ──

export const AirQualitySchema = z.object({
  aqi: z.number().nullable(),   // AQI value (scale depends on aqiStandard)
  aqiStandard: z.enum(["th", "us"]).default("us"), // "th" = real Air4Thai station, "us" = Open-Meteo model
  station: z.string().default(""), // source/station label, e.g. "ม.กรุงเทพ รังสิต · 6.1 กม."
  pm25: z.number().nullable(),  // µg/m³
  pm10: z.number().nullable(),  // µg/m³
  o3: z.number().nullable(),    // µg/m³
  no2: z.number().nullable(),   // µg/m³
  so2: z.number().nullable(),   // µg/m³
  co: z.number().nullable(),    // µg/m³
});

// ── AI Prediction Types ──

export const AISignalSchema = z.object({
  name: z.string(),
  predictedMinutes: z.number(),
  confidence: z.number(),
  weight: z.number(),
  active: z.boolean(),
});

export const SkyConditionsSchema = z.object({
  available: z.boolean(),
  source: z.string(),          // "gemini" | "brightness" | "none"
  label: z.string(),           // Thai description of the sky
  isRaining: z.boolean(),      // rain actually observed in the images
  brightness: z.number(),      // 0..1 sky-region brightness (-1 if unknown)
  rainRiskBoost: z.number(),   // contribution applied to rain probability
  confidence: z.number(),
  sampleCount: z.number(),
});

export const AIPredictionSchema = z.object({
  willRain: z.boolean(),
  isRainingNow: z.boolean().default(false), // rain actually observed NOW (rain gauge / webcam), not a forecast
  predictedStartTime: z.string(), // Thai clock format "HH.MM", e.g. "18.43"
  predictedStartTimestamp: z.date(),
  timeToRainMinutes: z.number(),
  rainWindowMinutes: z.number().default(0), // ± uncertainty around the predicted time
  confidence: z.number(),
  confidencePercent: z.number(), // confidence in the verdict (rain or no-rain)
  rainProbabilityPercent: z.number(), // estimated chance of rain, 0-100
  signals: z.array(AISignalSchema),
  recommendation: z.string(),
  sky: SkyConditionsSchema.optional(), // nearby webcam sky analysis
});

export const WeatherReadingInputSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  temperature: z.number().optional(),
  feelsLike: z.number().optional(),
  humidity: z.number().optional(),
  windSpeed: z.number().optional(),
  windDeg: z.number().optional(),
  pressure: z.number().optional(),
  pressureTrend: z.number().optional(),
  dewPoint: z.number().optional(),
  uvi: z.number().optional(),
  visibility: z.number().optional(),
  clouds: z.number().optional(),
  rain1h: z.number().optional(),
  rain3h: z.number().optional(),
  pop: z.number().optional(),
  tmrPrecipProb: z.number().optional(),
  tmrPrecipIntensity: z.number().optional(),
  tmrCloudCover: z.number().optional(),
  tmrHumidity: z.number().optional(),
  weatherMain: z.string().optional(),
  weatherDesc: z.string().optional(),
  weatherIcon: z.string().optional(),
});

export const SettingsInputSchema = z.object({
  owmKey: z.string().optional(),
  tomorrowKey: z.string().optional(),
  windyKey: z.string().optional(),
  geminiKey: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  locationName: z.string().optional(),
  rainThreshold: z.number().optional(),
  webcamRadius: z.number().optional(),
});

export const WebcamSchema = z.object({
  id: z.string(),
  title: z.string(),
  thumb: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  distance: z.number().optional(),
  playerUrl: z.string().optional(),
  detailUrl: z.string().optional(),
  streamUrl: z.string().optional(),
  clipUrl: z.string().optional(),
});

export type CurrentWeather = z.infer<typeof CurrentWeatherSchema>;
export type HourlyForecast = z.infer<typeof HourlyForecastSchema>;
export type MinutelyData = z.infer<typeof MinutelyDataSchema>;
export type TomorrowInterval = z.infer<typeof TomorrowIntervalSchema>;
export type AISignal = z.infer<typeof AISignalSchema>;
export type SkyConditions = z.infer<typeof SkyConditionsSchema>;
export type AirQuality = z.infer<typeof AirQualitySchema>;
export type AIPrediction = z.infer<typeof AIPredictionSchema>;
export type WeatherReadingInput = z.infer<typeof WeatherReadingInputSchema>;
export type SettingsInput = z.infer<typeof SettingsInputSchema>;
export type WebcamData = z.infer<typeof WebcamSchema>;
