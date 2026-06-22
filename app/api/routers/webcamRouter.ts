import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { translateLocation } from "../../lib/thaiTranslations";

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

function proxyImageUrl(imageUrl: string | undefined): string {
  if (!imageUrl) return "";
  
  // If URL is already local or proxied, return as-is
  if (imageUrl.includes("localhost") || imageUrl.includes("127.0.0.1")) {
    return imageUrl;
  }
  
  // For external HTTPS URLs, use backend proxy route
  if (imageUrl.startsWith("https://")) {
    // Option 1: Use backend proxy endpoint (requires server-side fetch)
    return "/api/webcam-image-proxy?url=" + encodeURIComponent(imageUrl);
    
    // Option 2: Fallback to public image proxy (commented out, but available)
    // return "https://images.weserv.nl/?url=" + encodeURIComponent(imageUrl.replace("https://", "")) + "&w=400&h=300&fit=cover";
  }
  
  return imageUrl;
}

interface WindyWebcam {
  webcamId?: number | string;
  title?: string;
  images?: {
    current?: { icon?: string; thumbnail?: string; preview?: string };
    daylight?: { thumbnail?: string; preview?: string };
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    country_code?: string;
    latitude?: number;
    longitude?: number;
  };
  player?: { day?: string; month?: string; year?: string; lifetime?: string };
  urls?: { detail?: string; provider?: string };
}

// Derive a directly-playable HLS (.m3u8) URL from a webcam's raw stream provider.
// Many Thai traffic cams expose an RTMP-gateway ".stream" whose HLS playlist lives
// at "<url>/playlist.m3u8". Credential-embedded or non-stream URLs are skipped.
function toHlsUrl(provider: string | undefined): string {
  if (!provider) return "";
  if (provider.includes("@")) return ""; // user:pass@host — not embeddable
  if (/\.m3u8(\?|$)/i.test(provider)) return provider;
  const m = provider.match(/^(https?:\/\/[^?#\s]*?\.stream)\b/i);
  if (m) return `${m[1]}/playlist.m3u8`;
  return "";
}

// Windy day-timelapse clip for cams without a direct HLS stream. Shown in the
// expanded modal only — the player needs ≥200x110px so it can't render inside
// the small grid cards (those fall back to the static image).
function toClipUrl(webcamId: string): string {
  return `https://webcams.windy.com/webcams/public/embed/player/${webcamId}/day`;
}

interface WindyWebcamResponse {
  webcams?: WindyWebcam[];
}

// Map one Windy API v3 webcam into the shape the frontend expects.
function mapWindyWebcam(w: WindyWebcam, lat: number, lon: number) {
  const wid = String(w.webcamId ?? "");
  const loc = w.location;
  const current = w.images?.current;
  const daylight = w.images?.daylight;
  const wlat = loc?.latitude ?? 0;
  const wlon = loc?.longitude ?? 0;
  // Prefer the live "current" preview; fall back to thumbnail, then daylight.
  const thumbUrl = current?.preview ?? current?.thumbnail ?? daylight?.preview ?? "";
  const hls = toHlsUrl(w.urls?.provider);

  return {
    id: wid,
    title: translateLocation(w.title ?? "Unknown"),
    thumb: proxyImageUrl(thumbUrl),
    city: translateLocation(loc?.city ?? ""),
    country: translateLocation(loc?.country ?? loc?.country_code ?? ""),
    lat: wlat,
    lon: wlon,
    distance: wlat && wlon ? haversineKm(lat, lon, wlat, wlon) : undefined,
    playerUrl: w.player?.day ?? "",
    detailUrl: w.urls?.detail ?? ("https://www.windy.com/webcams/" + wid),
    streamUrl: hls, // live HLS video when available
    // Always provide the Windy day-timelapse player so the modal has a smooth,
    // reliable fallback even when a cam's HLS stream is dead (most of them are).
    clipUrl: toClipUrl(wid),
  };
}

export const webcamRouter = createRouter({
  getNearby: publicQuery
    .input(
      z.object({
        lat: z.number(),
        lon: z.number(),
        radius: z.number().optional().default(20),
        apiKey: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { lat, lon, radius, apiKey } = input;

      if (!apiKey) {
        return { webcams: [] };
      }

      const fields = "include=images,location,player,urls";
      const baseUrl = "https://api.windy.com/webcams/api/v3/webcams?nearby=" + lat + "," + lon + "," + radius + "&" + fields + "&limit=18&lang=en";

      // Backend fetch directly (no CORS issues server-side)
      try {
        console.log("Fetching from Windy API with backend...");
        const res = await fetch(baseUrl, {
          headers: {
            "x-windy-api-key": apiKey,
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          console.warn(`Windy API returned ${res.status}`);
          throw new Error(`Windy API HTTP ${res.status}`);
        }

        let data: WindyWebcamResponse;
        try {
          const text = await res.text();
          data = JSON.parse(text) as WindyWebcamResponse;
        } catch (e) {
          console.warn(`Failed to parse webcam response:`, e);
          throw e;
        }

        const webcamsRaw = data.webcams ?? [];
        console.log(`Successfully fetched ${webcamsRaw.length} webcams`);

        const webcams = webcamsRaw.map((w) => mapWindyWebcam(w, lat, lon));

        return { webcams };
      } catch (error) {
        console.error(`Direct Windy API fetch failed:`, error);
      }

      // Fallback: Try multiple CORS proxies if direct fetch fails
      console.log("Trying fallback CORS proxies...");
      const attempts: Array<{ url: string; headers: Record<string, string> }> = [
        {
          url: "https://corsproxy.io/?" + encodeURIComponent(baseUrl),
          headers: { "Accept": "application/json" },
        },
        {
          url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(baseUrl),
          headers: { "Accept": "application/json" },
        },
        {
          url: baseUrl,
          headers: { "x-windy-api-key": apiKey, "Accept": "application/json" },
        },
      ];

      for (const attempt of attempts) {
        try {
          const res = await fetch(attempt.url, {
            headers: attempt.headers,
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) {
            console.warn(`Webcam API attempt ${attempt.url.includes('corsproxy') ? 'corsproxy' : attempt.url.includes('allorigins') ? 'allorigins' : 'direct'} returned ${res.status}`);
            continue;
          }

          let data: WindyWebcamResponse;
          try {
            const text = await res.text();
            data = JSON.parse(text) as WindyWebcamResponse;
          } catch (e) {
            console.warn(`Failed to parse webcam response:`, e);
            continue;
          }

          const webcamsRaw = data.webcams ?? [];

          const webcams = webcamsRaw.map((w) => mapWindyWebcam(w, lat, lon));

          return { webcams };
        } catch (error) {
          const attemptType = attempt.url.includes('corsproxy') ? 'corsproxy' : attempt.url.includes('allorigins') ? 'allorigins' : 'direct';
          console.error(`Webcam API attempt ${attemptType} failed:`, error);
          continue;
        }
      }

      console.error(`All webcam API attempts failed for location: ${lat}, ${lon}`);
      return { webcams: [] };
    }),
});
