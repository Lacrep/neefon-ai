import webpush from "web-push";
import { getRawDb } from "../queries/connection";
import type { RainAlert } from "./collector";

// ── Web Push: install-to-home-screen PWA notifications (iOS 16.4+ / Android) ──
// Tables are created ad-hoc (CREATE TABLE IF NOT EXISTS + ALTER) so no drizzle
// migration is needed on the VM. Each subscription carries its own mode
// ("locked" = factory / "follow" = the phone's last-known location) and its own
// debounce state, so different phones get alerts for different places.

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  mode: string;
  lat: number | null;
  lon: number | null;
  stage: string | null;
  candidate: string | null;
  candidate_count: number | null;
}

let initialized = false;
let vapidPublic = "";

function init(): void {
  if (initialized) return;
  const db = getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_config (id INTEGER PRIMARY KEY CHECK (id = 1), vapid_public TEXT, vapid_private TEXT);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT,
      mode TEXT DEFAULT 'locked', lat REAL, lon REAL,
      stage TEXT, candidate TEXT, candidate_count INTEGER,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  // Add per-subscription columns to a table created by an older build.
  for (const col of [
    "mode TEXT DEFAULT 'locked'", "lat REAL", "lon REAL",
    "stage TEXT", "candidate TEXT", "candidate_count INTEGER", "updated_at INTEGER",
  ]) {
    try { db.exec(`ALTER TABLE push_subscriptions ADD COLUMN ${col}`); } catch { /* exists */ }
  }

  let cfg = db.prepare("SELECT vapid_public AS pub, vapid_private AS priv FROM push_config WHERE id = 1").get() as
    | { pub: string; priv: string }
    | undefined;
  if (!cfg) {
    const keys = webpush.generateVAPIDKeys();
    db.prepare("INSERT INTO push_config (id, vapid_public, vapid_private) VALUES (1, ?, ?)").run(keys.publicKey, keys.privateKey);
    cfg = { pub: keys.publicKey, priv: keys.privateKey };
  }
  vapidPublic = cfg.pub;
  webpush.setVapidDetails("mailto:neefon@example.com", cfg.pub, cfg.priv);
  initialized = true;
}

export function getVapidPublicKey(): string {
  init();
  return vapidPublic;
}

// Upsert a subscription with its notification mode + last-known location.
export function saveSubscription(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  mode: "locked" | "follow",
  lat: number | null,
  lon: number | null
): void {
  init();
  getRawDb()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, mode, lat, lon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         p256dh = excluded.p256dh, auth = excluded.auth, mode = excluded.mode,
         lat = excluded.lat, lon = excluded.lon, updated_at = excluded.updated_at`
    )
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, mode, lat, lon, Date.now(), Date.now());
}

export function subscriptionCount(): number {
  init();
  return (getRawDb().prepare("SELECT COUNT(*) AS c FROM push_subscriptions").get() as { c: number }).c;
}

function setSubState(endpoint: string, stage: string, candidate: string | null, count: number): void {
  getRawDb()
    .prepare("UPDATE push_subscriptions SET stage = ?, candidate = ?, candidate_count = ?, updated_at = ? WHERE endpoint = ?")
    .run(stage, candidate, count, Date.now(), endpoint);
}

const TH_LEVEL: Record<string, string> = { light: "ฝนเบา", moderate: "ฝนปานกลาง", heavy: "ฝนหนัก", violent: "ฝนหนักมาก", none: "ฝน" };

function buildMessage(stage: string, prevConfirmed: string, alert: RainAlert): { title: string; body: string } | null {
  const lvl = TH_LEVEL[alert.intensity] ?? "ฝน";
  if (stage === "incoming") {
    return {
      title: `🌧️ ${lvl}กำลังจะมา`,
      body: `จะเริ่มตกในอีก ~${alert.rainInMinutes} นาที${alert.durationMin > 0 ? ` · คาดว่าตก ~${alert.durationMin} นาที` : ""} — หาที่ร่ม/กลับเข้าอาคาร`,
    };
  }
  if (stage === "raining") {
    return {
      title: `☔ ฝนเริ่มตกแล้ว (${lvl})`,
      body: alert.stopsInMin >= 0 ? `คาดว่าจะหยุดในอีก ~${alert.stopsInMin} นาที` : "ตกต่อเนื่อง",
    };
  }
  // → clear: only announce "stopped" if we were actually raining.
  if (prevConfirmed !== "raining") return null;
  return { title: "🌤️ ฝนหยุดแล้ว", body: "สภาพอากาศปลอดภัย ออกทำงานต่อได้" };
}

async function sendOne(sub: SubRow, payload: Record<string, unknown>): Promise<void> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) {
      getRawDb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint); // expired
    } else {
      console.error("[push] send failed:", code ?? err);
    }
  }
}

// Per-subscription debounce + send. A forecast "incoming" must persist for 2
// consecutive cycles (~6 min) before buzzing; live "raining"/"clear" fire once.
async function evaluate(sub: SubRow, alert: RainAlert): Promise<void> {
  const stage = alert.isRainingNow ? "raining" : alert.goInside ? "incoming" : "clear";
  const confirmed = sub.stage ?? "clear";

  if (stage === confirmed) {
    if (sub.candidate) setSubState(sub.endpoint, confirmed, null, 0);
    return;
  }
  const required = stage === "incoming" ? 2 : 1;
  const count = (sub.candidate === stage ? sub.candidate_count ?? 0 : 0) + 1;
  if (count < required) {
    setSubState(sub.endpoint, confirmed, stage, count);
    return;
  }
  const msg = buildMessage(stage, confirmed, alert);
  setSubState(sub.endpoint, stage, null, 0);
  if (msg) await sendOne(sub, { ...msg, tag: "neefon-rain", ...alert });
}

// Fired by the collector each cycle. "locked" subs get the factory alert;
// "follow" subs get an alert computed for their own last-known location
// (memoised per rounded location to limit weather-API calls).
export async function pushToAllSubscribers(
  factoryAlert: RainAlert,
  computeForLoc: (lat: number, lon: number) => Promise<RainAlert>
): Promise<void> {
  init();
  const subs = getRawDb().prepare("SELECT * FROM push_subscriptions").all() as SubRow[];
  if (!subs.length) return;

  const locCache = new Map<string, RainAlert>();
  for (const sub of subs) {
    let alert = factoryAlert;
    if (sub.mode === "follow" && sub.lat != null && sub.lon != null) {
      const key = `${sub.lat.toFixed(2)},${sub.lon.toFixed(2)}`;
      let a = locCache.get(key);
      if (!a) {
        try { a = await computeForLoc(sub.lat, sub.lon); }
        catch { a = factoryAlert; }
        locCache.set(key, a);
      }
      alert = a;
    }
    await evaluate(sub, alert);
  }
}
