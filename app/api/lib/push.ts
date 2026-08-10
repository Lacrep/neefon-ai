import webpush from "web-push";
import { getRawDb } from "../queries/connection";
import type { RainAlert } from "./collector";

// ── Web Push: install-to-home-screen PWA notifications (iOS 16.4+ / Android) ──
// Tables are created ad-hoc (CREATE TABLE IF NOT EXISTS) so no migration is
// needed on the VM. VAPID keys are generated once and stored in the DB.

interface SubRow { endpoint: string; p256dh: string; auth: string }

let initialized = false;
let vapidPublic = "";

function init(): void {
  if (initialized) return;
  const db = getRawDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_config (id INTEGER PRIMARY KEY CHECK (id = 1), vapid_public TEXT, vapid_private TEXT);
    CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, created_at INTEGER);
    CREATE TABLE IF NOT EXISTS push_state (id INTEGER PRIMARY KEY CHECK (id = 1), stage TEXT, candidate TEXT, candidate_count INTEGER, updated_at INTEGER);
  `);
  // Add debounce columns to a push_state created by an older build.
  try { db.exec("ALTER TABLE push_state ADD COLUMN candidate TEXT"); } catch { /* exists */ }
  try { db.exec("ALTER TABLE push_state ADD COLUMN candidate_count INTEGER"); } catch { /* exists */ }

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

export function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): void {
  init();
  getRawDb()
    .prepare("INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)")
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, Date.now());
}

export function subscriptionCount(): number {
  init();
  return (getRawDb().prepare("SELECT COUNT(*) AS c FROM push_subscriptions").get() as { c: number }).c;
}

async function sendToAll(payload: Record<string, unknown>): Promise<void> {
  const db = getRawDb();
  const subs = db.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions").all() as SubRow[];
  if (!subs.length) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(s.endpoint); // expired
        } else {
          console.error("[push] send failed:", code ?? err);
        }
      }
    })
  );
}

function setState(stage: string, candidate: string | null, count: number): void {
  getRawDb()
    .prepare(
      "INSERT INTO push_state (id, stage, candidate, candidate_count, updated_at) VALUES (1, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET stage = excluded.stage, candidate = excluded.candidate, candidate_count = excluded.candidate_count, updated_at = excluded.updated_at"
    )
    .run(stage, candidate, count, Date.now());
}

// Fired by the collector each cycle. Only notifies on CONFIRMED stage
// transitions. Because the free Open-Meteo model flip-flops between cycles
// ("rain at +50min" one cycle, "clear" the next), a forecast-based "incoming"
// must PERSIST for 2 consecutive cycles (~6 min) before we buzz the phone —
// this kills the repeated false alarms. Live-confirmed "raining"/"clear" fire
// immediately.
export async function pushRainAlert(alert: RainAlert): Promise<void> {
  init();
  const db = getRawDb();
  if (subscriptionCount() === 0) return;

  const stage = alert.isRainingNow ? "raining" : alert.goInside ? "incoming" : "clear";
  const row = db.prepare("SELECT stage, candidate, candidate_count FROM push_state WHERE id = 1").get() as
    | { stage: string; candidate: string | null; candidate_count: number | null }
    | undefined;
  const confirmed = row?.stage ?? "clear";

  if (stage === confirmed) {
    if (row?.candidate) setState(confirmed, null, 0); // clear any pending flip
    return;
  }

  // Debounce: a forecast-only "incoming" must repeat before it counts.
  const required = stage === "incoming" ? 2 : 1;
  const count = (row?.candidate === stage ? row?.candidate_count ?? 0 : 0) + 1;
  if (count < required) {
    setState(confirmed, stage, count); // pending confirmation
    return;
  }

  // Confirmed transition → build the message and notify.
  const th: Record<string, string> = { light: "ฝนเบา", moderate: "ฝนปานกลาง", heavy: "ฝนหนัก", violent: "ฝนหนักมาก", none: "ฝน" };
  const lvl = th[alert.intensity] ?? "ฝน";
  let title = "";
  let bodyText = "";
  if (stage === "incoming") {
    title = `🌧️ ${lvl}กำลังจะมา`;
    bodyText = `จะเริ่มตกในอีก ~${alert.rainInMinutes} นาที${alert.durationMin > 0 ? ` · คาดว่าตก ~${alert.durationMin} นาที` : ""} — หาที่ร่ม/กลับเข้าอาคาร`;
  } else if (stage === "raining") {
    title = `☔ ฝนเริ่มตกแล้ว (${lvl})`;
    bodyText = alert.stopsInMin >= 0 ? `คาดว่าจะหยุดในอีก ~${alert.stopsInMin} นาที` : "ตกต่อเนื่อง";
  } else {
    // → clear. Only announce "stopped" if we were actually raining.
    setState(stage, null, 0);
    if (confirmed !== "raining") return;
    title = "🌤️ ฝนหยุดแล้ว";
    bodyText = "สภาพอากาศปลอดภัย ออกทำงานต่อได้";
  }

  setState(stage, null, 0);
  await sendToAll({ title, body: bodyText, tag: "neefon-rain", ...alert });
}
