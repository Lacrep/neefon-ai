import { useState, useEffect } from "react";
import { useWeather } from "@/contexts/WeatherContext";

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "00:00:00";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function AIPredictionHero() {
  const { aiPrediction, loading } = useWeather();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const countdown =
    aiPrediction && aiPrediction.timeToRainMinutes < 999
      ? formatCountdown(aiPrediction.predictedStartTimestamp.getTime(), now)
      : "--:--:--";

  if (loading && !aiPrediction) {
    return (
      <div className="col-span-12 lg:col-span-8 glass-card p-6 flex items-center justify-center min-h-[260px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent border-[#005eb2] rounded-full animate-spin" />
          <p className="text-sm text-slate-500">กำลังวิเคราะห์ข้อมูลด้วย AI...</p>
        </div>
      </div>
    );
  }

  if (!aiPrediction) {
    return (
      <div className="col-span-12 lg:col-span-8 glass-card p-6 text-center text-slate-500 min-h-[260px] flex items-center justify-center">
        <div>
          <span className="material-symbols-outlined text-4xl mb-2 block text-slate-400">smart_toy</span>
          <p className="text-sm">กรุณาตั้งค่า API Key เพื่อเริ่มใช้งาน AI Prediction</p>
        </div>
      </div>
    );
  }

  // "ฝนตกแล้ว!" only when rain is actually observed now — never just because a
  // forecast's would-be time rounded to 0 minutes (that was the false-alarm bug).
  const isRaining = aiPrediction.isRainingNow;
  const isSoon = aiPrediction.willRain && aiPrediction.timeToRainMinutes >= 0 && aiPrediction.timeToRainMinutes <= 30;
  const isWarning = aiPrediction.willRain && !isRaining;
  const isSafe = !aiPrediction.willRain && aiPrediction.timeToRainMinutes >= 999;

  const accent = isRaining
    ? "#ba1a1a"
    : isSoon
    ? "#d97706"
    : isWarning
    ? "#f59e0b"
    : isSafe
    ? "#10b981"
    : "#005eb2";

  return (
    <div className="col-span-12 lg:col-span-8 glass-card p-5 md:p-6 flex flex-col md:flex-row gap-5 md:gap-8 justify-between items-stretch relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -z-0 -mr-20 -mt-24 opacity-[0.07]"
        style={{ background: accent }}
      />

      {/* Left: prediction details */}
      <div className="flex-1 z-10 min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="material-symbols-outlined text-[#005eb2]">blur_on</span>
          <h2 className="text-xs font-semibold text-[#005eb2] uppercase tracking-wider">AI Rain Prediction</h2>
          {aiPrediction.signals.length > 1 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#005eb2]/10 text-[#005eb2] border border-[#005eb2]/20">
              {aiPrediction.signals.filter((s) => s.active).length} SIGNALS ACTIVE
            </span>
          )}
        </div>

        <div className="mb-2">
          {isRaining ? (
            <h2 className="text-4xl md:text-5xl font-bold text-[#ba1a1a] font-heading">ฝนตกแล้ว!</h2>
          ) : aiPrediction.timeToRainMinutes < 999 ? (
            <>
              <p className="text-sm text-slate-500 mb-1">
                {aiPrediction.willRain ? "ฝนจะตกตอน" : "คาดว่าฝนอาจตกตอน"}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-5xl md:text-6xl font-bold text-slate-900 font-heading tracking-tight">
                  {aiPrediction.predictedStartTime}
                </span>
                <span className="text-2xl md:text-3xl font-semibold text-slate-400">น.</span>
                <span className="text-base md:text-lg text-slate-400 font-normal">
                  ±{aiPrediction.rainWindowMinutes || 30} min
                </span>
              </div>
              {!aiPrediction.willRain && (
                <p className="text-xs text-amber-600 mt-1.5">
                  โอกาสฝนต่ำกว่าเกณฑ์เตือน · ความมั่นใจในการคาดการณ์ {aiPrediction.confidencePercent}%
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-1">ไม่พบสัญญาณฝน</p>
              <h2 className="text-3xl md:text-4xl font-bold text-emerald-600 font-heading">สภาพอากาศปลอดภัย</h2>
            </>
          )}
        </div>

        {/* Recommendation + nearby sky */}
        <div className="space-y-2 mt-4 bg-[#f1f4f7] p-3 rounded-xl border border-slate-200/60">
          <div className="flex items-start gap-2 text-sm text-slate-700">
            <span className="material-symbols-outlined text-slate-400 text-[18px] mt-0.5 shrink-0">chat_bubble</span>
            <span>{aiPrediction.recommendation}</span>
          </div>
          {aiPrediction.sky?.available && (
            <div className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
              <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">photo_camera</span>
              <span>
                ภาพรอบพื้นที่: <span className="font-medium text-slate-800">{aiPrediction.sky.label}</span>
              </span>
              {aiPrediction.sky.source === "gemini" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#005eb2]/10 text-[#005eb2] border border-[#005eb2]/20">
                  AI วิเคราะห์ภาพ
                </span>
              )}
            </div>
          )}
        </div>

        {/* Signal pills */}
        {aiPrediction.signals.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {aiPrediction.signals.map((sig) => (
              <span
                key={sig.name}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  sig.active
                    ? "bg-[#005eb2]/10 text-[#005eb2] border-[#005eb2]/20"
                    : "bg-slate-100 text-slate-400 border-slate-200"
                }`}
              >
                {sig.name}: {sig.active ? `${sig.predictedMinutes}m` : "N/A"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: countdown + confidence gauge + rain chance */}
      <div className="flex flex-col items-center justify-center shrink-0 bg-[#f1f4f7] p-5 md:p-6 rounded-2xl border border-slate-200/60 md:min-w-[244px] z-10">
        {!isRaining && aiPrediction.willRain ? (
          <>
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">นับถอยหลัง</p>
            <div className="text-3xl md:text-4xl font-mono font-bold text-slate-900 tabular-nums mb-5 tracking-tighter">
              {countdown}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500 mb-4 uppercase tracking-wider">ผลการวิเคราะห์</p>
        )}

        <div className="flex items-center gap-4 w-full">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e0e3e6"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={accent}
                strokeDasharray={`${aiPrediction.confidencePercent}, 100`}
                strokeWidth="3"
                style={{ transition: "stroke-dasharray 0.7s ease" }}
              />
            </svg>
            <div
              className="absolute inset-0 flex items-center justify-center font-bold text-sm"
              style={{ color: accent }}
            >
              {aiPrediction.confidencePercent}%
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">ความมั่นใจในคำตอบ</p>
            <p className="font-medium text-sm text-slate-800">
              {aiPrediction.confidencePercent >= 80
                ? "สูงมาก"
                : aiPrediction.confidencePercent >= 60
                ? "ปานกลาง"
                : aiPrediction.confidencePercent >= 40
                ? "ต่ำ"
                : "น้อยมาก"}
            </p>
          </div>
        </div>

        <div className="w-full mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">water_drop</span> โอกาสเกิดฝน
          </span>
          <span className="font-bold text-sm" style={{ color: accent }}>
            {aiPrediction.rainProbabilityPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}
