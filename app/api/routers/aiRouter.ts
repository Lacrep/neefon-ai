import { z } from "zod";
import { createRouter, publicQuery, publicMutation } from "../middleware";
import { runAIPrediction, validatePredictions, getAccuracyStats, getPredictionHistory, getAirQualityHistory } from "../lib/aiEngine";
import { fetchOWMOneCall, fetchOWMCurrent, fetchOpenMeteo } from "../lib/weatherApi";

export const aiRouter = createRouter({
  predictRainTiming: publicQuery
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
        owmKey: z.string(),
        tomorrowKey: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { lat, lon, owmKey } = input;

      // Fetch fresh data
      const [owmData, owmCurrent, omData] = await Promise.all([
        fetchOWMOneCall(lat, lon, owmKey),
        fetchOWMCurrent(lat, lon, owmKey),
        fetchOpenMeteo(lat, lon),
      ]);

      const current = owmData.current ?? owmCurrent;
      if (!current) {
        return {
          willRain: false,
          predictedStartTime: "--.--",
          predictedStartTimestamp: new Date(),
          timeToRainMinutes: 999,
          confidence: 0,
          confidencePercent: 0,
          rainProbabilityPercent: 0,
          signals: [],
          recommendation: "ไม่สามารถดึงข้อมูลได้",
        };
      }

      const hourly = owmData.hourly.length > 0 ? owmData.hourly : [];

      return await runAIPrediction(current, hourly, { lat, lon }, { minutely: owmData.minutely, openMeteo: omData });
    }),

  validatePredictions: publicMutation
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
      })
    )
    .mutation(async ({ input }: { input: { lat: number; lon: number } }) => {
      return await validatePredictions({ lat: input.lat, lon: input.lon });
    }),

  getAccuracy: publicQuery
    .input(
      z.object({
        days: z.number().optional().default(7),
      })
    )
    .query(async ({ input }) => {
      return await getAccuracyStats(input.days);
    }),

  getHistory: publicQuery
    .input(
      z.object({
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      return await getPredictionHistory(input.limit);
    }),

  getAirQualityHistory: publicQuery
    .input(
      z.object({
        limit: z.number().optional().default(96),
      })
    )
    .query(async ({ input }) => {
      return await getAirQualityHistory(input.limit);
    }),
});
