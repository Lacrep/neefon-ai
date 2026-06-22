import { useState, useEffect } from "react";
import { useWeather } from "@/contexts/WeatherContext";
import { useSettings } from "@/contexts/SettingsContext";

export default function HeaderBar() {
  const [time, setTime] = useState(new Date());
  const { lastUpdated, error } = useWeather();
  const { setIsOpen } = useSettings();

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatus = () => {
    if (error) return { text: "Offline", class: "status-offline" };
    if (!lastUpdated) return { text: "Connecting...", class: "status-warning" };
    const age = time.getTime() - lastUpdated.getTime();
    if (age > 10 * 60 * 1000) return { text: "Stale", class: "status-warning" };
    return { text: "Online", class: "status-online" };
  };

  const status = getStatus();

  return (
    <header className="sticky top-0 z-40 bg-[#f7fafd]/85 backdrop-blur-md border border-slate-200/70 rounded-2xl mb-6">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-lg md:text-xl font-semibold text-slate-900 tabular-nums font-heading">
              {time.toLocaleTimeString("th-TH")}
            </span>
            <span className="px-2.5 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full inline-block ${status.class}`} />
              {status.text}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {time.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            className="w-10 h-10 rounded-full hover:bg-slate-100 active:scale-95 transition flex items-center justify-center text-slate-500"
            aria-label="การแจ้งเตือน"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            onClick={() => setIsOpen(true)}
            className="w-10 h-10 rounded-full hover:bg-slate-100 active:scale-95 transition flex items-center justify-center text-slate-500"
            aria-label="ตั้งค่า"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="w-9 h-9 rounded-full bg-[#005eb2] text-white flex items-center justify-center ml-1">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
}
