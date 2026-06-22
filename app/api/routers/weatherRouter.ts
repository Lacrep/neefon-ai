import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { fetchOWMOneCall } from "../lib/weatherApi";
import { gatherWeather, type GetCurrentResult } from "../lib/collector";

// Server-side response cache. The real client polls every 3 min, but rapid
// bursts (multiple tabs, refetch-on-focus, manual reloads) would otherwise
// hammer the weather APIs and help trip OWM's daily rate-limit block.
const CACHE_TTL_MS = 90 * 1000;
const responseCache = new Map<string, { at: number; data: GetCurrentResult }>();

export const weatherRouter = createRouter({
  getCurrent: publicQuery
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
        owmKey: z.string(),
        tomorrowKey: z.string().optional(),
        windyKey: z.string().optional(),
        geminiKey: z.string().optional(),
      })
    )
    .query(async ({ input }): Promise<GetCurrentResult> => {
      const cacheKey = `${input.lat.toFixed(3)},${input.lon.toFixed(3)}`;
      const cached = responseCache.get(cacheKey);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
      }

      // Read-only for the UI — the 24/7 background collector (api/lib/collector)
      // is the single writer, so data keeps accumulating even with no tab open.
      const result = await gatherWeather(input, false);
      if (result.current) {
        responseCache.set(cacheKey, { at: Date.now(), data: result });
      }
      return result;
    }),

  getHourly: publicQuery
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
        owmKey: z.string(),
        hours: z.number().optional().default(24),
      })
    )
    .query(async ({ input }) => {
      const { lat, lon, owmKey, hours } = input;
      const data = await fetchOWMOneCall(lat, lon, owmKey);
      return data.hourly.slice(0, hours);
    }),
});
