import { useWeather } from "@/contexts/WeatherContext";

const cardBase =
  "col-span-12 lg:col-span-4 rounded-2xl p-6 flex flex-col text-white bg-gradient-to-br from-[#001a38] to-[#001f3f] shadow-[0_4px_20px_rgba(0,31,63,0.12)] min-h-[200px]";

export default function WeatherHero() {
  const { currentWeather, loading } = useWeather();

  if (loading && !currentWeather) {
    return (
      <div className={`${cardBase} items-center justify-center`}>
        <div className="w-6 h-6 border-2 border-t-transparent border-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentWeather) {
    return (
      <div className={`${cardBase} items-center justify-center text-center text-white/60`}>
        <span className="material-symbols-outlined text-3xl mb-2">cloud_off</span>
        <p className="text-sm">ไม่มีข้อมูลสภาพอากาศ</p>
      </div>
    );
  }

  return (
    <div className={`${cardBase} justify-between`}>
      <div>
        <h3 className="text-xs text-white/60 uppercase tracking-wider mb-2 font-medium">Current Temperature</h3>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-baseline">
              <span className="text-[64px] font-bold leading-none tracking-tighter font-heading">
                {Math.round(currentWeather.temp)}
              </span>
              <span className="text-2xl font-medium text-[#a7c8ff]">°C</span>
            </div>
            <div className="flex items-center gap-1 text-white/80 mt-2">
              <span className="material-symbols-outlined text-[16px]">cloud</span>
              <span className="text-sm">{currentWeather.weatherDesc || "--"}</span>
            </div>
          </div>
          {currentWeather.weatherIcon && (
            <img
              src={`https://openweathermap.org/img/wn/${currentWeather.weatherIcon}@4x.png`}
              alt={currentWeather.weatherDesc || ""}
              className="w-20 h-20 -mt-2 -mr-2"
            />
          )}
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center text-xs text-white/70 mb-2">
          <span>ความชื้น (Humidity)</span>
          <span>{currentWeather.humidity}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#a7c8ff] rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, currentWeather.humidity ?? 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
