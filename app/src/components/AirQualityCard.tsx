import { useWeather } from "@/contexts/WeatherContext";
import { trpc } from "@/providers/trpc";

// AQI → color + Thai label + advice. Thai AQI (กรมควบคุมมลพิษ) and US AQI use
// different breakpoints, so pick the scale that matches the data source.
function aqiInfo(aqi: number | null, standard: "th" | "us"): { color: string; label: string; advice: string } {
  if (aqi == null) return { color: "#94a3b8", label: "ไม่มีข้อมูล", advice: "" };
  if (standard === "th") {
    if (aqi <= 25) return { color: "#0ea5e9", label: "ดีมาก", advice: "อากาศดีมาก ทำกิจกรรมกลางแจ้งได้เต็มที่" };
    if (aqi <= 50) return { color: "#10b981", label: "ดี", advice: "คุณภาพอากาศดี ทำกิจกรรมกลางแจ้งได้ตามปกติ" };
    if (aqi <= 100) return { color: "#eab308", label: "ปานกลาง", advice: "กลุ่มเสี่ยงควรสังเกตอาการผิดปกติ" };
    if (aqi <= 200) return { color: "#f97316", label: "เริ่มมีผลต่อสุขภาพ", advice: "กลุ่มเสี่ยงควรลดกิจกรรมกลางแจ้ง สวมหน้ากาก" };
    return { color: "#ef4444", label: "มีผลต่อสุขภาพ", advice: "ทุกคนควรหลีกเลี่ยงกิจกรรมกลางแจ้ง" };
  }
  if (aqi <= 50) return { color: "#10b981", label: "ดี", advice: "อากาศบริสุทธิ์ ออกกำลังกายกลางแจ้งได้" };
  if (aqi <= 100) return { color: "#eab308", label: "ปานกลาง", advice: "กลุ่มเสี่ยงควรสังเกตอาการ" };
  if (aqi <= 150) return { color: "#f97316", label: "มีผลต่อกลุ่มเสี่ยง", advice: "กลุ่มเสี่ยงควรลดกิจกรรมกลางแจ้ง" };
  if (aqi <= 200) return { color: "#ef4444", label: "มีผลต่อสุขภาพ", advice: "ควรสวมหน้ากากเมื่อออกนอกอาคาร" };
  if (aqi <= 300) return { color: "#a855f7", label: "แย่มาก", advice: "หลีกเลี่ยงกิจกรรมกลางแจ้ง" };
  return { color: "#7f1d1d", label: "อันตราย", advice: "อยู่ในอาคาร ปิดประตูหน้าต่าง" };
}

// PM2.5 severity tint (Thai AQI cares most about PM2.5, µg/m³).
function pm25Color(v: number | null): string {
  if (v == null) return "#94a3b8";
  if (v <= 25) return "#10b981";
  if (v <= 37) return "#eab308";
  if (v <= 50) return "#f97316";
  if (v <= 90) return "#ef4444";
  return "#a855f7";
}

// Build an SVG polyline path from a series of values, normalised to the box.
function sparkPath(values: number[], w: number, h: number, pad = 3): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AirQualityCard() {
  const { airQuality } = useWeather();
  const aqi = airQuality?.aqi ?? null;

  const historyQuery = trpc.ai.getAirQualityHistory.useQuery(
    { limit: 96 },
    { refetchInterval: 3 * 60 * 1000, refetchIntervalInBackground: true }
  );
  const pm25Series = (historyQuery.data ?? [])
    .map((r) => r.pm25)
    .filter((v): v is number => v != null);
  const standard = airQuality?.aqiStandard ?? "us";
  const { color, label, advice } = aqiInfo(aqi, standard);
  const ringPct = aqi != null ? Math.min(100, (aqi / (standard === "th" ? 200 : 300)) * 100) : 0;

  const pollutants = [
    { key: "pm25", label: "PM2.5", unit: "µg/m³", value: airQuality?.pm25, accent: pm25Color(airQuality?.pm25 ?? null), highlight: true },
    { key: "pm10", label: "PM10", unit: "µg/m³", value: airQuality?.pm10, accent: "#005eb2" },
    { key: "o3", label: "O₃", unit: "µg/m³", value: airQuality?.o3, accent: "#005eb2" },
    { key: "no2", label: "NO₂", unit: "µg/m³", value: airQuality?.no2, accent: "#005eb2" },
    { key: "so2", label: "SO₂", unit: "µg/m³", value: airQuality?.so2, accent: "#005eb2" },
    { key: "co", label: "CO", unit: "µg/m³", value: airQuality?.co, accent: "#005eb2" },
  ];

  return (
    <div className="col-span-12 glass-card p-5 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[#005eb2]">masks</span>
        <h3 className="text-base md:text-lg font-semibold text-slate-900 font-heading">คุณภาพอากาศ · Air Quality</h3>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 md:gap-8 items-stretch">
        {/* AQI gauge */}
        <div className="flex items-center gap-4 shrink-0 bg-[#f1f4f7] rounded-2xl border border-slate-200/60 p-5 lg:min-w-[260px]">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="#e0e3e6" strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke={color} strokeDasharray={`${ringPct}, 100`} strokeWidth="3"
                strokeLinecap="round" style={{ transition: "stroke-dasharray 0.7s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-xl font-bold" style={{ color }}>{aqi ?? "--"}</span>
              <span className="text-[9px] text-slate-400 font-semibold mt-0.5">AQI</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              {standard === "th" ? "AQI (มาตรฐานไทย)" : "US AQI"}
            </p>
            <p className="text-lg font-bold leading-tight" style={{ color }}>{label}</p>
            {advice && <p className="text-xs text-slate-500 mt-1">{advice}</p>}
            {airQuality?.station && (
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">
                  {standard === "th" ? "sensors" : "cloud"}
                </span>
                {standard === "th" ? "สถานีจริง: " : "ที่มา: "}{airQuality.station}
              </p>
            )}
          </div>
        </div>

        {/* Pollutant grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6 gap-3 flex-1">
          {pollutants.map((p) => (
            <div
              key={p.key}
              className={`flex flex-col items-center justify-center text-center rounded-xl border p-3 ${
                p.highlight ? "border-2" : "bg-[#f7fafd] border-slate-200/70"
              }`}
              style={p.highlight ? { borderColor: p.accent, background: `${p.accent}0d` } : undefined}
            >
              <span className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: p.accent }}>
                {p.label}
              </span>
              <span className="text-xl font-bold text-slate-900">
                {p.value != null ? p.value : "--"}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5">{p.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PM2.5 trend (accumulates as readings are logged) */}
      <div className="mt-4 pt-4 border-t border-slate-200/70">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#005eb2]">show_chart</span>
            แนวโน้ม PM2.5
          </span>
          {pm25Series.length >= 2 && (
            <span className="text-[10px] text-slate-400">
              ต่ำสุด {Math.min(...pm25Series).toFixed(0)} · สูงสุด {Math.max(...pm25Series).toFixed(0)} µg/m³
            </span>
          )}
        </div>
        {pm25Series.length >= 2 ? (
          <svg viewBox="0 0 600 56" preserveAspectRatio="none" className="w-full h-12">
            <polyline
              points={sparkPath(pm25Series, 600, 56).replace(/[ML]/g, " ").trim()}
              fill="none"
              stroke={pm25Color(pm25Series[pm25Series.length - 1])}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <p className="text-xs text-slate-400 py-3 text-center">
            กำลังเก็บข้อมูล… กราฟจะแสดงเมื่อมีค่าหลายช่วงเวลา
          </p>
        )}
      </div>
    </div>
  );
}
