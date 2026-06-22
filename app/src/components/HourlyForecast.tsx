import { useWeather } from "@/contexts/WeatherContext";

function getMaterialIcon(icon: string | undefined): string {
  if (!icon) return "cloud";
  const code = icon.slice(0, 2);
  const map: Record<string, string> = {
    "01": "sunny",
    "02": "partly_cloudy_day",
    "03": "cloud",
    "04": "cloud",
    "09": "rainy",
    "10": "rainy",
    "11": "thunderstorm",
    "13": "weather_snowy",
    "50": "foggy",
  };
  return map[code] || "cloud";
}

export default function HourlyForecast() {
  const { hourlyForecast } = useWeather();

  return (
    <div className="col-span-12 glass-card p-5 md:p-6">
      <h4 className="text-base md:text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 font-heading">
        <span className="material-symbols-outlined text-slate-400">schedule</span>
        Hourly Forecast (24h)
      </h4>
      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
          {hourlyForecast.length === 0 ? (
            <div className="text-center text-slate-400 py-8 px-4 w-full">ไม่มีข้อมูลรายชั่วโมง</div>
          ) : (
            hourlyForecast.map((h, i) => {
              const dt = new Date(h.dt * 1000);
              const pop = Math.round((h.pop ?? 0) * 100);
              const isRain = pop > 30;
              const isNow = i === 0;
              const cls = isNow ? "now" : isRain ? "rain" : "";
              const iconColor = isNow ? "#ffffff" : isRain ? "#ba1a1a" : "#5f6368";

              return (
                <div key={h.dt} className={`hourly-item ${cls}`}>
                  <div className={`text-[11px] mb-1 whitespace-nowrap font-medium ${isNow ? "text-white/90" : "text-slate-500"}`}>
                    {isNow ? "ตอนนี้" : `${String(dt.getHours()).padStart(2, "0")}:00`}
                  </div>
                  <div className="my-1.5">
                    <span className="material-symbols-outlined text-[24px]" style={{ color: iconColor }}>
                      {getMaterialIcon(h.weatherIcon)}
                    </span>
                  </div>
                  <div className={`text-base font-bold my-1 ${isNow ? "text-white" : "text-slate-900"}`}>
                    {Math.round(h.temp)}°
                  </div>
                  <div
                    className={`text-[11px] min-h-[16px] font-semibold ${
                      pop > 0 ? (isNow ? "text-white" : "text-[#ba1a1a]") : "text-transparent"
                    }`}
                  >
                    {pop > 0 ? `${pop}%` : ""}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
