import { useLocation } from "@/contexts/LocationContext";
import { useSettings } from "@/contexts/SettingsContext";

export default function LocationToggle() {
  const { mode, setMode, lat, lon, following, requesting, gpsError, accuracyM } = useLocation();
  const { settings } = useSettings();

  const status = (() => {
    if (mode === "locked") {
      return {
        icon: "lock",
        color: "text-slate-500",
        text: `${settings.locationName || "ตำแหน่งที่บันทึก"} · ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      };
    }
    if (gpsError) return { icon: "location_off", color: "text-amber-600", text: gpsError };
    if (requesting) return { icon: "my_location", color: "text-[#005eb2]", text: "กำลังหาตำแหน่งจากมือถือ..." };
    if (following) return { icon: "my_location", color: "text-emerald-600", text: `ตำแหน่งปัจจุบัน · ${lat.toFixed(3)}, ${lon.toFixed(3)}${accuracyM != null ? ` (±${accuracyM} ม.)` : ""}` };
    return { icon: "my_location", color: "text-slate-500", text: "ตามตำแหน่งมือถือ" };
  })();

  return (
    <div className="col-span-12 glass-card p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`material-symbols-outlined ${status.color}`}>{status.icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium">ตำแหน่งที่แสดงผล</p>
          <p className="text-sm text-slate-800 truncate">{status.text}</p>
        </div>
      </div>

      <div className="flex items-center bg-slate-100 rounded-full p-1 shrink-0">
        <button
          onClick={() => setMode("locked")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
            mode === "locked" ? "bg-[#005eb2] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">lock</span>
          ล็อก (หุ่นยนต์)
        </button>
        <button
          onClick={() => setMode("follow")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1 ${
            mode === "follow" ? "bg-[#005eb2] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">my_location</span>
          ตามมือถือ
        </button>
      </div>
    </div>
  );
}
