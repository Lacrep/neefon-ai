import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Weather readings (collected every 3 minutes) ──
export const weatherReadings = sqliteTable("weather_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lat: text("lat").notNull(),
  lon: text("lon").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),

  temperature: text("temperature"),
  feelsLike: text("feels_like"),
  humidity: integer("humidity"),
  windSpeed: text("wind_speed"),
  windDeg: integer("wind_deg"),
  pressure: integer("pressure"),
  pressureTrend: text("pressure_trend"),
  dewPoint: text("dew_point"),
  uvi: text("uvi"),
  visibility: integer("visibility"),
  clouds: integer("clouds"),

  rain1h: text("rain_1h"),
  rain3h: text("rain_3h"),
  pop: text("pop"),

  aqi: integer("aqi"),
  pm25: text("pm25"),
  pm10: text("pm10"),

  tmrPrecipProb: text("tmr_precip_prob"),
  tmrPrecipIntensity: text("tmr_precip_intensity"),
  tmrCloudCover: text("tmr_cloud_cover"),
  tmrHumidity: text("tmr_humidity"),

  weatherMain: text("weather_main"),
  weatherDesc: text("weather_desc"),
  weatherIcon: text("weather_icon"),

  aiPredictedRain: integer("ai_predicted_rain", { mode: "boolean" }).default(false),
  aiPredictedStartTime: integer("ai_predicted_start_time", { mode: "timestamp_ms" }),
  aiConfidence: text("ai_confidence"),
  aiTimeToRain: integer("ai_time_to_rain"),

  actualRain: integer("actual_rain", { mode: "boolean" }).default(false),
  actualRainStart: integer("actual_rain_start", { mode: "timestamp_ms" }),
  validated: integer("validated", { mode: "boolean" }).default(false),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

// ── Rain patterns (learned from historical data) ──
export const rainPatterns = sqliteTable("rain_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  humidity: integer("humidity").notNull(),
  pressure: integer("pressure").notNull(),
  pressureTrend3h: text("pressure_trend_3h"),
  clouds: integer("clouds").notNull(),
  cloudTrend1h: integer("cloud_trend_1h"),
  dewPointDelta: text("dew_point_delta"),
  windSpeed: text("wind_speed"),
  windDeg: integer("wind_deg"),
  pop: text("pop"),

  hourOfDay: integer("hour_of_day").notNull(),
  month: integer("month").notNull(),

  timeToRain: integer("time_to_rain").notNull(),
  rainIntensity: text("rain_intensity"),

  lat: text("lat").notNull(),
  lon: text("lon").notNull(),
  locationName: text("location_name"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

// ── Daily statistics ──
export const dailyStats = sqliteTable("daily_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  locationName: text("location_name"),

  tp: integer("tp").default(0),
  fp: integer("fp").default(0),
  fn: integer("fn").default(0),
  tn: integer("tn").default(0),
  total: integer("total").default(0),

  avgTimeError: text("avg_time_error"),
  predictionsWithin15min: integer("predictions_within_15min").default(0),
  predictionsWithin30min: integer("predictions_within_30min").default(0),

  createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

// ── User settings ──
export const userSettings = sqliteTable("user_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  owmKey: text("owm_key"),
  tomorrowKey: text("tomorrow_key"),
  windyKey: text("windy_key"),
  geminiKey: text("gemini_key"),

  lat: text("lat").default("13.7563"),
  lon: text("lon").default("100.5018"),
  locationName: text("location_name").default("กรุงเทพมหานคร"),

  rainThreshold: text("rain_threshold").default("0.55"),
  webcamRadius: integer("webcam_radius").default(20),

  weightTrend: text("weight_trend").default("0.35"),
  weightPattern: text("weight_pattern").default("0.30"),
  weightRateOfChange: text("weight_rate_of_change").default("0.20"),
  weightClimate: text("weight_climate").default("0.15"),

  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});
