import jpeg from "jpeg-js";
import type { SkyConditions } from "@contracts/weather";

// ─────────────────────────────────────────
//  Sky vision: analyze nearby webcam images to read the actual
//  sky (sun / clouds / dark / rain) as an extra prediction signal.
//
//  Two tiers:
//   1. Free brightness analysis (jpeg-js) — always available, no key.
//   2. Google Gemini Vision (free tier) — used when a Gemini API key is set.
//  Results are cached per location for 10 minutes.
// ─────────────────────────────────────────

const EMPTY_SKY: SkyConditions = {
  available: false,
  source: "none",
  label: "",
  isRaining: false,
  brightness: -1,
  rainRiskBoost: 0,
  confidence: 0,
  sampleCount: 0,
};

// Bangkok is UTC+7 — derive the local hour without relying on the server timezone.
function isDaytime(): boolean {
  const h = (new Date().getUTCHours() + 7) % 24;
  return h >= 6 && h < 18;
}

// ── Tier 1: brightness analysis (free) ──

interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

async function fetchAndDecode(url: string): Promise<DecodedImage | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 128 });
  } catch {
    return null;
  }
}

// Average luminance (0..1) of the sky region — the top 40% of the frame.
function skyBrightness(img: DecodedImage): number {
  const { data, width, height } = img;
  const skyRows = Math.max(1, Math.floor(height * 0.4));
  let sum = 0;
  let count = 0;
  for (let y = 0; y < skyRows; y++) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
  }
  return count ? sum / count / 255 : 0;
}

async function analyzeBrightness(urls: string[]): Promise<SkyConditions> {
  const samples: number[] = [];
  for (const url of urls.slice(0, 4)) {
    const img = await fetchAndDecode(url);
    if (img) samples.push(skyBrightness(img));
  }
  if (!samples.length) return EMPTY_SKY;

  const brightness = samples.reduce((a, b) => a + b, 0) / samples.length;
  const day = isDaytime();

  let label: string;
  let rainRiskBoost: number;
  if (!day) {
    label = "กลางคืน";
    rainRiskBoost = 0; // brightness is uninformative at night
  } else if (brightness >= 0.55) {
    label = "ท้องฟ้าสว่าง/แดดออก";
    rainRiskBoost = -0.05;
  } else if (brightness >= 0.38) {
    label = "มีเมฆบางส่วน";
    rainRiskBoost = 0.03;
  } else if (brightness >= 0.25) {
    label = "เมฆมาก";
    rainRiskBoost = 0.12;
  } else {
    label = "ท้องฟ้ามืดครึ้ม";
    rainRiskBoost = 0.2;
  }

  return {
    available: true,
    source: "brightness",
    label,
    isRaining: false,
    brightness: Math.round(brightness * 100) / 100,
    rainRiskBoost,
    confidence: day ? 0.5 : 0.2,
    sampleCount: samples.length,
  };
}

// ── Tier 2: Google Gemini Vision (free tier — needs a Gemini API key) ──

// Tried in order; on a 429 (quota exhausted) we fall back to the next model.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const VISION_PROMPT = `These are live webcam photos taken right now from areas near a user in Thailand who wants to know if rain is coming.
Look at the SKY and overall scene. Respond with ONLY a JSON object (no markdown, no extra text) in this exact shape:
{"condition":"clear|partly_cloudy|overcast|raining|stormy|night","isRaining":true,"brightness":"bright|dim|dark","confidence":0.0,"summaryTh":"<short Thai phrase>"}
- Set isRaining true (or condition "raining") only if you can actually see rain: streaks, downpour, or clearly wet/rained-on ground.
- "stormy" = very dark, threatening storm clouds.
- summaryTh: a short Thai description such as "ฟ้าโปร่งแดดออก" or "เมฆฝนมืดครึ้ม".`;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface SkyJson {
  condition?: string;
  isRaining?: boolean;
  brightness?: string;
  confidence?: number;
  summaryTh?: string;
}

async function analyzeWithGemini(urls: string[], apiKey: string): Promise<SkyConditions | null> {
  try {
    // Fetch the webcam snapshots in PARALLEL with a generous timeout — the
    // Windy imgproxy previews are often slow (>8s), and a too-tight sequential
    // fetch was leaving Gemini with no images so it silently fell back to the
    // crude brightness tier.
    const imgs = await Promise.all(
      urls.slice(0, 3).map(async (url) => {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!res.ok) return null;
          return Buffer.from(await res.arrayBuffer()).toString("base64");
        } catch {
          return null;
        }
      })
    );
    const parts: Array<{ inline_data?: { mime_type: string; data: string }; text?: string }> = imgs
      .filter((b): b is string => b !== null)
      .map((b64) => ({ inline_data: { mime_type: "image/jpeg", data: b64 } }));
    if (!parts.length) return null;
    parts.push({ text: VISION_PROMPT });

    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        // gemini-2.5-flash's "thinking" silently ate the whole 300-token budget
        // → finishReason MAX_TOKENS with no text → we got null and fell back to
        // brightness. Disable thinking and give the JSON output ample room.
        maxOutputTokens: 800,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
      },
    });

    // Try each model in order; fall back to the next one on a 429 (quota).
    let text: string | undefined;
    for (const model of GEMINI_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body,
      });
      if (res.status === 429) {
        console.warn(`Gemini ${model}: quota exceeded (429), trying fallback model`);
        continue;
      }
      if (!res.ok) {
        console.error("Gemini vision HTTP", res.status, (await res.text()).slice(0, 200));
        return null;
      }
      const data = (await res.json()) as GeminiResponse;
      text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      break;
    }
    const match = text?.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as SkyJson;

    const cond = parsed.condition ?? "";
    const isRaining = parsed.isRaining === true || cond === "raining";

    let rainRiskBoost: number;
    if (isRaining) rainRiskBoost = 0.35;
    else if (cond === "stormy") rainRiskBoost = 0.3;
    else if (cond === "overcast") rainRiskBoost = 0.18;
    else if (cond === "partly_cloudy") rainRiskBoost = 0.03;
    else if (cond === "clear") rainRiskBoost = -0.06;
    else rainRiskBoost = 0;

    const label =
      parsed.summaryTh?.trim() ||
      (isRaining
        ? "ฝนตก (จากภาพ)"
        : cond === "stormy"
        ? "เมฆฝนมืดครึ้ม"
        : cond === "overcast"
        ? "ท้องฟ้ามืดครึ้ม"
        : cond === "clear"
        ? "ฟ้าโปร่งแดดออก"
        : cond === "night"
        ? "กลางคืน"
        : "มีเมฆ");

    const brightness =
      parsed.brightness === "bright" ? 0.8 : parsed.brightness === "dark" ? 0.2 : 0.5;

    return {
      available: true,
      source: "gemini",
      label,
      isRaining,
      brightness,
      rainRiskBoost,
      confidence:
        typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
      sampleCount: parts.length - 1,
    };
  } catch (err) {
    console.error("Gemini vision error:", err);
    return null;
  }
}

// ── Public API (cached per location) ──
// 30-min cache: the collector runs every 3 min 24/7, so a short TTL would burn
// the free Gemini quota (~144 calls/day). At 30 min it's ~48/day — well within
// the free tier — and the UI + collector share this cache. Sky is a supporting
// signal (the forecast's minutely/hourly data drives timing), so 30-min-old
// sky is fine; when the quota resets the next cache miss retries Gemini.
const cache = new Map<string, { at: number; result: SkyConditions }>();
const TTL_MS = 30 * 60 * 1000;

export async function analyzeSky(opts: {
  lat: number;
  lon: number;
  geminiKey?: string;
  getUrls: () => Promise<string[]>;
}): Promise<SkyConditions> {
  const useGemini = !!opts.geminiKey;
  const key = `${opts.lat.toFixed(2)},${opts.lon.toFixed(2)}:${useGemini ? "g" : "b"}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.result;

  const urls = await opts.getUrls();
  if (!urls.length) return EMPTY_SKY;

  let result: SkyConditions | null = null;
  // Gemini Vision is the enhanced tier; brightness is the always-on fallback.
  if (useGemini) {
    result = await analyzeWithGemini(urls, opts.geminiKey!);
  }
  if (!result || !result.available) {
    result = await analyzeBrightness(urls);
  }

  cache.set(key, { at: Date.now(), result });
  return result;
}
