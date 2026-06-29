import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { startCollector } from "./lib/collector";
import { exportReadingsCsv } from "./lib/aiEngine";

// Collect weather + predictions 24/7 (server-side), independent of any open
// browser tab — so data keeps accumulating as long as the server is running.
startCollector();

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

// Image proxy endpoint - fetch images server-side to bypass CORS
app.get("/api/webcam-image-proxy", async (c) => {
  try {
    const url = c.req.query("url");
    if (!url || !url.startsWith("https://")) {
      return c.json({ error: "Invalid URL" }, 400);
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return c.json({ error: `HTTP ${response.status}` }, response.status as ContentfulStatusCode);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return c.json({ error: "Failed to fetch image" }, 500);
  }
});

// Full data export (CSV) for offline accuracy analysis. ?days=30 limits the
// range; no param = all history. Content-Disposition makes the browser download.
app.get("/api/export/readings.csv", async (c) => {
  try {
    const daysParam = c.req.query("days");
    const days = daysParam ? Number(daysParam) : undefined;
    const csv = await exportReadingsCsv(Number.isFinite(days) ? days : undefined);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="neefon-readings-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("CSV export error:", err);
    return c.json({ error: "export failed" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
