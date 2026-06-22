import { useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { trpc } from "@/providers/trpc";
import { owmKeyWarning } from "@/lib/owmKey";

const inputCls =
  "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-[#005eb2] focus:ring-1 focus:ring-[#005eb2]/30 focus:outline-none transition";
const labelCls = "block text-sm font-medium mb-1 text-slate-700";

export default function SettingsPanel() {
  const { settings, updateSettings, saveSettings, isOpen, setIsOpen, loading } = useSettings();
  const [saving, setSaving] = useState(false);
  const owmWarn = owmKeyWarning(settings);

  const geocodeQuery = trpc.settings.geocode.useQuery({ lat: settings.lat, lon: settings.lon }, { enabled: false });

  const handleSave = async () => {
    setSaving(true);
    saveSettings();
    setTimeout(() => {
      setSaving(false);
      setIsOpen(false);
    }, 500);
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateSettings({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        geocodeQuery.refetch().then((res) => {
          if (res.data?.locationName) {
            updateSettings({ locationName: res.data.locationName });
          }
        });
      },
      () => {
        alert("ไม่สามารถระบุตำแหน่งได้");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-16 px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl max-h-[82vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2 font-heading">
            <span className="material-symbols-outlined text-[#005eb2]">tune</span>
            ตั้งค่าระบบ
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>OpenWeatherMap API Key</label>
            <input
              type="password"
              value={settings.owmKey}
              onChange={(e) => updateSettings({ owmKey: e.target.value })}
              className={`${inputCls} ${owmWarn ? "!border-red-400 !ring-red-200" : ""}`}
              placeholder="ใส่ OWM API Key"
            />
            {owmWarn ? (
              <p className="text-xs text-red-600 mt-1 flex items-start gap-1">
                <span className="material-symbols-outlined text-[14px] mt-px">warning</span>
                {owmWarn}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">openweathermap.org (ใช้สำหรับอุณหภูมิจริง)</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Tomorrow.io API Key</label>
            <input
              type="password"
              value={settings.tomorrowKey}
              onChange={(e) => updateSettings({ tomorrowKey: e.target.value })}
              className={inputCls}
              placeholder="ใส่ Tomorrow.io API Key"
            />
            <p className="text-xs text-slate-400 mt-1">tomorrow.io (500 calls/day)</p>
          </div>

          <div>
            <label className={labelCls}>Windy API Key</label>
            <input
              type="password"
              value={settings.windyKey}
              onChange={(e) => updateSettings({ windyKey: e.target.value })}
              className={inputCls}
              placeholder="ใส่ Windy API Key"
            />
            <p className="text-xs text-slate-400 mt-1">api.windy.com/keys</p>
          </div>

          <div>
            <label className={labelCls}>Gemini API Key (ฟรี)</label>
            <input
              type="password"
              value={settings.geminiKey}
              onChange={(e) => updateSettings({ geminiKey: e.target.value })}
              className={inputCls}
              placeholder="ใส่ Gemini API Key (ฟรี — เปิด AI วิเคราะห์ภาพ)"
            />
            <p className="text-xs text-slate-400 mt-1">aistudio.google.com — ฟรี ให้ AI ดูภาพเว็บแคมจริง</p>
          </div>

          <div>
            <label className={labelCls}>ตำแหน่ง (Lat, Lon)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.0001"
                value={settings.lat}
                onChange={(e) => updateSettings({ lat: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} w-1/2`}
                placeholder="Lat"
              />
              <input
                type="number"
                step="0.0001"
                value={settings.lon}
                onChange={(e) => updateSettings({ lon: parseFloat(e.target.value) || 0 })}
                className={`${inputCls} w-1/2`}
                placeholder="Lon"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Rain Threshold (0.5 - 0.99)</label>
            <input
              type="number"
              step="0.01"
              min="0.5"
              max="0.99"
              value={settings.rainThreshold}
              onChange={(e) => updateSettings({ rainThreshold: parseFloat(e.target.value) || 0.55 })}
              className={inputCls}
            />
            <p className="text-xs text-slate-400 mt-1">0.55 = เตือนไว | 0.85 = เตือนช้าแต่แม่นยำ</p>
          </div>

          <div>
            <label className={labelCls}>Webcam Search Radius (km)</label>
            <input
              type="number"
              min="5"
              max="100"
              value={settings.webcamRadius}
              onChange={(e) => updateSettings({ webcamRadius: parseInt(e.target.value) || 20 })}
              className={inputCls}
            />
          </div>
        </div>

        {settings.locationName && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600">location_on</span>
            <div>
              <div className="text-sm font-medium text-emerald-700">ตำแหน่งปัจจุบัน</div>
              <div className="text-xs text-emerald-600/80">{settings.locationName}</div>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={handleGeolocation}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition flex items-center gap-2 text-white"
          >
            <span className="material-symbols-outlined text-sm">my_location</span>
            ใช้ตำแหน่งปัจจุบัน
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2 bg-[#005eb2] hover:bg-[#004788] disabled:opacity-50 rounded-lg text-sm font-medium transition flex items-center gap-2 text-white"
          >
            <span className="material-symbols-outlined text-sm">save</span>
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
