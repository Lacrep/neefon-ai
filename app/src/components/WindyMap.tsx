import { useState, useCallback } from "react";
import { useSettings } from "@/contexts/SettingsContext";

const overlays = [
  { key: "rain", label: "ฝน", icon: "water_drop" },
  { key: "radar", label: "เรดาร์", icon: "radar" },
  { key: "satellite", label: "ดาวเทียม", icon: "satellite" },
  { key: "thunder", label: "ฟ้าคะนอง", icon: "thunderstorm" },
  { key: "wind", label: "ลม", icon: "air" },
  { key: "gust", label: "ลมกระโชก", icon: "storm" },
  { key: "temp", label: "อุณหภูมิ", icon: "thermostat" },
  { key: "clouds", label: "เมฆ", icon: "cloud" },
  { key: "rh", label: "ความชื้น", icon: "humidity_percentage" },
  { key: "pressure", label: "ความกดอากาศ", icon: "compress" },
  { key: "rainAccu", label: "ฝนสะสม", icon: "rainy" },
  { key: "visibility", label: "ทัศนวิสัย", icon: "visibility" },
  { key: "dewpoint", label: "จุดน้ำค้าง", icon: "dew_point" },
  { key: "uvindex", label: "UV", icon: "wb_sunny" },
  { key: "pm2p5", label: "คุณภาพอากาศ", icon: "masks" },
];

export default function WindyMap() {
  const { settings } = useSettings();
  const [currentOverlay, setCurrentOverlay] = useState("rain");
  const [zoom, setZoom] = useState(15);

  const lat = settings.lat ?? 13.7563;
  const lon = settings.lon ?? 100.5018;

  const buildUrl = useCallback(() => {
    const ovl = currentOverlay;
    return `https://embed.windy.com/embed2.html?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=${zoom}&level=surface&overlay=${ovl}&menu=true&message=true&marker=true&calendar=true&pressure=true&type=map&location=coordinates&detail=true&detailLat=${lat.toFixed(4)}&detailLon=${lon.toFixed(4)}&metricWind=km/h&metricTemp=%C2%B0C`;
  }, [lat, lon, zoom, currentOverlay]);

  return (
    <div className="col-span-12 xl:col-span-8 glass-card p-0 flex flex-col overflow-hidden min-h-[560px]" id="windyCard">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#005eb2]">map</span>
          <h3 className="text-base md:text-lg font-semibold text-slate-900 font-heading">Live Radar Map</h3>
          <span className="px-2 py-0.5 rounded-full bg-[#005eb2]/10 text-[#005eb2] text-[10px] font-mono font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#005eb2] animate-pulse" /> WINDY LIVE
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(4, z - 1))}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="text-xs text-slate-500 px-1 tabular-nums">ซูม {zoom}</span>
          <button
            onClick={() => setZoom((z) => Math.min(19, z + 1))}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
            title="ซูมเข้า (เลื่อนเมาส์ในแผนที่เพื่อซูมต่อ)"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>

      {/* Overlay tabs */}
      <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-1.5 flex-wrap bg-slate-50">
        {overlays.map((ov) => (
          <button
            key={ov.key}
            onClick={() => setCurrentOverlay(ov.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition flex items-center gap-1 ${
              currentOverlay === ov.key
                ? "bg-[#005eb2] text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-[13px]">{ov.icon}</span>
            {ov.label}
          </button>
        ))}
      </div>

      {/* Map iframe */}
      <div id="windyContainer" className="flex-1 bg-slate-100 relative" style={{ minHeight: "480px" }}>
        <iframe
          id="windyFrame"
          src={buildUrl()}
          frameBorder={0}
          style={{ width: "100%", height: "100%", border: 0 }}
          allow="geolocation;fullscreen"
          loading="eager"
          title="Windy Weather Map"
        />
      </div>
    </div>
  );
}
