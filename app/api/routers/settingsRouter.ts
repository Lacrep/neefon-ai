import { z } from "zod";
import { createRouter, publicQuery, publicMutation } from "../middleware";
import { getDb } from "../queries/connection";
import { userSettings } from "@db/schema";
import { eq } from "drizzle-orm";
import { reverseGeocode } from "../lib/weatherApi";

const defaultSettings = {
  id: 1,
  owmKey: "",
  tomorrowKey: "",
  windyKey: "",
  geminiKey: "",
  lat: 13.7563,
  lon: 100.5018,
  locationName: "กรุงเทพมหานคร",
  rainThreshold: 0.55,
  webcamRadius: 20,
  weightTrend: 0.35,
  weightPattern: 0.30,
  weightRateOfChange: 0.20,
  weightClimate: 0.15,
};

export const settingsRouter = createRouter({
  get: publicQuery.query(async () => {
    try {
      const db = getDb();
      const rows = await db.select().from(userSettings).limit(1);
    if (rows[0]) {
      return {
        id: rows[0].id,
        owmKey: rows[0].owmKey ?? "",
        tomorrowKey: rows[0].tomorrowKey ?? "",
        windyKey: rows[0].windyKey ?? "",
        geminiKey: rows[0].geminiKey ?? "",
        lat: Number(rows[0].lat) || 13.7563,
        lon: Number(rows[0].lon) || 100.5018,
        locationName: rows[0].locationName ?? "กรุงเทพมหานคร",
        rainThreshold: Number(rows[0].rainThreshold) || 0.55,
        webcamRadius: rows[0].webcamRadius ?? 20,
        weightTrend: Number(rows[0].weightTrend) || 0.35,
        weightPattern: Number(rows[0].weightPattern) || 0.30,
        weightRateOfChange: Number(rows[0].weightRateOfChange) || 0.20,
        weightClimate: Number(rows[0].weightClimate) || 0.15,
      };
    }

      return defaultSettings;
    } catch (err) {
      console.error("Settings get error:", err);
      return defaultSettings;
    }
  }),

  update: publicMutation
    .input(
      z.object({
        owmKey: z.string().optional(),
        tomorrowKey: z.string().optional(),
        windyKey: z.string().optional(),
        geminiKey: z.string().optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        locationName: z.string().optional(),
        rainThreshold: z.number().optional(),
        webcamRadius: z.number().optional(),
      })
    )
    .mutation(async ({ input }: { input: Record<string, unknown> }) => {
      try {
      const db = getDb();

      // If lat/lon changed but no locationName, reverse geocode
      let locationName = input.locationName as string | undefined;
      if (input.lat != null && input.lon != null && !locationName) {
        const geo = await reverseGeocode(input.lat as number, input.lon as number);
        if (geo) locationName = geo;
      }

      const existing = await db.select().from(userSettings).limit(1);

      const values: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.owmKey !== undefined) values.owmKey = input.owmKey || null;
      if (input.tomorrowKey !== undefined) values.tomorrowKey = input.tomorrowKey || null;
      if (input.windyKey !== undefined) values.windyKey = input.windyKey || null;
      if (input.geminiKey !== undefined) values.geminiKey = input.geminiKey || null;
      if (input.lat !== undefined) values.lat = String(input.lat);
      if (input.lon !== undefined) values.lon = String(input.lon);
      if (locationName !== undefined) values.locationName = locationName;
      if (input.rainThreshold !== undefined) values.rainThreshold = String(input.rainThreshold);
      if (input.webcamRadius !== undefined) values.webcamRadius = input.webcamRadius;

      if (existing[0]) {
        await db
          .update(userSettings)
          .set(values)
          .where(eq(userSettings.id, existing[0].id));
      } else {
        await db.insert(userSettings).values({
          owmKey: input.owmKey ? String(input.owmKey) : null,
          tomorrowKey: input.tomorrowKey ? String(input.tomorrowKey) : null,
          windyKey: input.windyKey ? String(input.windyKey) : null,
          geminiKey: input.geminiKey ? String(input.geminiKey) : null,
          lat: input.lat != null ? String(input.lat) : "13.7563",
          lon: input.lon != null ? String(input.lon) : "100.5018",
          locationName: locationName ?? "กรุงเทพมหานคร",
          rainThreshold: input.rainThreshold != null ? String(input.rainThreshold) : "0.55",
          webcamRadius: input.webcamRadius != null ? Number(input.webcamRadius) : 20,
        });
      }

      return { success: true };
      } catch (err) {
        console.error("Settings update error:", err);
        throw new Error("ไม่สามารถบันทึกการตั้งค่าได้ กรุณาลองใหม่อีกครั้ง");
      }
    }),

  geocode: publicQuery
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
      })
    )
    .query(async ({ input }) => {
      const name = await reverseGeocode(input.lat, input.lon);
      return { locationName: name ?? `${input.lat.toFixed(4)}, ${input.lon.toFixed(4)}` };
    }),
});
