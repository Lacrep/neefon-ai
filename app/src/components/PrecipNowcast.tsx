import { useWeather } from "@/contexts/WeatherContext";
import type { Intensity } from "@contracts/weather";

// Blue→purple ramp: heavier rain = deeper colour.
const INTENSITY_COLOR: Record<Intensity, string> = {
  none: "#dbeafe",
  light: "#93c5fd",
  moderate: "#3b82f6",
  heavy: "#6366f1",
  violent: "#7c3aed",
};
const INTENSITY_TH: Record<Intensity, string> = {
  none: "ไม่มีฝน",
  light: "ฝนเบา",
  moderate: "ฝนปานกลาง",
  heavy: "ฝนหนัก",
  violent: "ฝนหนักมาก",
};

function clockFromNow(minFromNow: number): string {
  const d = new Date(Date.now() + minFromNow * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function PrecipNowcast() {
  const { aiPrediction } = useWeather();
  const pn = aiPrediction?.precipNowcast;

  if (!pn || !pn.available) return null;

  const points = pn.points.filter((p) => p.t >= -pn.stepMinutes);
  const maxRate = Math.max(2, ...points.map((p) => p.mmPerHr));
  // Label the time axis roughly every 15 min regardless of step (1-min vs 15-min).
  const labelEvery = Math.max(1, Math.round(15 / pn.stepMinutes));
  const denseGap = points.length > 20; // 1-min feed → many thin bars
  const noRain = pn.startsInMin < 0;
  const accent = noRain
    ? "#10b981"
    : INTENSITY_COLOR[pn.isRainingNow ? pn.currentIntensity : pn.peakIntensity] ?? "#3b82f6";

  return (
    <div className="col-span-12 glass-card p-5 md:p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#005eb2]">radar</span>
          <h3 className="text-base md:text-lg font-semibold text-slate-900 font-heading">
            เรดาร์ฝน · {Math.round(pn.horizonMinutes / 60)} ชั่วโมงข้างหน้า
          </h3>
        </div>
        <span className="text-[10px] text-slate-400">ทุก {pn.stepMinutes} นาที · Open-Meteo</span>
      </div>

      {/* Headline */}
      <p className="text-lg md:text-xl font-bold mb-1 font-heading" style={{ color: accent }}>
        {pn.headline}
      </p>

      {/* Quick facts */}
      {!noRain && (
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          {!pn.isRainingNow && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              เริ่ม <b>~{pn.startsInMin}</b> นาที
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            ระดับสูงสุด <b>{INTENSITY_TH[pn.peakIntensity]}</b>
          </span>
          {pn.stopsInMin >= 0 ? (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              {pn.isRainingNow ? "หยุดใน" : "ตกนาน"} <b>~{pn.isRainingNow ? pn.stopsInMin : pn.durationMin}</b> นาที
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">ตกต่อเนื่องเกิน {pn.horizonMinutes} นาที</span>
          )}
        </div>
      )}

      {/* Bar timeline */}
      <div className={`flex items-end h-24 mt-2 ${denseGap ? "gap-px" : "gap-1"}`}>
        {points.map((p) => {
          const h = Math.max(3, Math.round((p.mmPerHr / maxRate) * 92));
          return (
            <div
              key={p.t}
              className="flex-1 rounded-t transition-all"
              style={{ height: `${h}px`, background: INTENSITY_COLOR[p.intensity], minHeight: 3 }}
              title={`${p.t <= 0 ? "ตอนนี้" : clockFromNow(p.t)} · ${p.mmPerHr} mm/h`}
            />
          );
        })}
      </div>

      {/* Time axis (~every 15 min) */}
      <div className={`flex mt-1 ${denseGap ? "gap-px" : "gap-1"}`}>
        {points.map((p, i) => (
          <div key={p.t} className="flex-1 text-center text-[9px] text-slate-400 tabular-nums whitespace-nowrap overflow-visible">
            {i % labelEvery === 0 ? (p.t <= 0 ? "ตอนนี้" : clockFromNow(p.t)) : ""}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-200/70">
        {(["light", "moderate", "heavy", "violent"] as Intensity[]).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: INTENSITY_COLOR[lvl] }} />
            {INTENSITY_TH[lvl]}
          </span>
        ))}
      </div>
    </div>
  );
}
