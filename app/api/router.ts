import { createRouter, publicQuery } from "./middleware";
import { weatherRouter } from "./routers/weatherRouter";
import { aiRouter } from "./routers/aiRouter";
import { settingsRouter } from "./routers/settingsRouter";
import { webcamRouter } from "./routers/webcamRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  weather: weatherRouter,
  ai: aiRouter,
  settings: settingsRouter,
  webcam: webcamRouter,
});

export type AppRouter = typeof appRouter;
