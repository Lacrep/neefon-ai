import { useWeather } from "@/contexts/WeatherContext";

const metrics = [
  { id: "humidity", label: "Humidity", icon: "humidity_percentage", color: "text-[#005eb2]", unit: "%" },
  { id: "windSpeed", label: "Wind", icon: "air", color: "text-[#005eb2]", unit: "km/h" },
  { id: "windDeg", label: "Direction", icon: "explore", color: "text-[#005eb2]", unit: "" },
  { id: "pressure", label: "Pressure", icon: "compress", color: "text-[#005eb2]", unit: "hPa" },
  { id: "uvi", label: "UV Index", icon: "wb_sunny", color: "text-amber-500", unit: "" },
  { id: "visibility", label: "Visibility", icon: "visibility", color: "text-[#005eb2]", unit: "km" },
  { id: "feels_like", label: "Feels Like", icon: "device_thermostat", color: "text-[#005eb2]", unit: "°C" },
  { id: "radar", label: "Radar", icon: "radar", color: "text-[#005eb2]", unit: "" },
];

function getWindDirection(deg: number | undefined): string {
  if (deg == null) return "--";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function QuickMetrics() {
  const { currentWeather } = useWeather();

  const getValue = (id: string): string => {
    if (id === "radar") return "Active";
    if (!currentWeather) return "--";
    switch (id) {
      case "humidity": return `${currentWeather.humidity ?? "--"}`;
      case "windSpeed": return `${Math.round((currentWeather.wind_speed ?? 0) * 3.6)}`;
      case "windDeg": return getWindDirection(currentWeather.wind_deg);
      case "pressure": return `${currentWeather.pressure ?? "--"}`;
      case "uvi": return currentWeather.uvi != null ? `${currentWeather.uvi}` : "--";
      case "visibility": return currentWeather.visibility ? `${(currentWeather.visibility / 1000).toFixed(1)}` : "--";
      case "feels_like": return `${Math.round(currentWeather.feels_like ?? 0)}`;
      default: return "--";
    }
  };

  return (
    <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {metrics.map((m) => {
        const isRadar = m.id === "radar";
        return (
          <div
            key={m.id}
            className={`glass-card p-4 flex flex-col items-center justify-center text-center ${
              isRadar ? "!bg-[#005eb2]/5 !border-[#005eb2]/15" : ""
            }`}
          >
            <span className={`material-symbols-outlined ${m.color} text-2xl mb-2`}>{m.icon}</span>
            <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">{m.label}</span>
            {isRadar ? (
              <span className="text-base font-bold text-[#005eb2]">Active</span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{getValue(m.id)}</span>
                {m.unit && <span className="text-xs text-slate-500">{m.unit}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
