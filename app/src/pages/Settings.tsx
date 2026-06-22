import { useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { trpc } from "@/providers/trpc";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { owmKeyWarning } from "@/lib/owmKey";

const inputCls =
  "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-[#005eb2] focus:ring-1 focus:ring-[#005eb2]/30 focus:outline-none transition";
const labelCls = "block text-sm font-medium mb-1 text-slate-700";
const sectionTitle = "text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 font-heading";

export default function SettingsPage() {
  const { settings, updateSettings, saveSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const geocodeQuery = trpc.settings.geocode.useQuery({ lat: settings.lat, lon: settings.lon }, { enabled: false });
  const owmWarn = owmKeyWarning(settings);

  const handleSave = async () => {
    setSaving(true);
    saveSettings();
    setMessage("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    setTimeout(() => setMessage(""), 3000);
    setSaving(false);
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์ไม่รองรับ Geolocation");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateSettings({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        geocodeQuery.refetch().then((res) => {
          if (res.data?.locationName) {
            updateSettings({ locationName: res.data.locationName });
          }
        });
        setMessage("ระบุตำแหน่งสำเร็จ");
      },
      () => {
        setMessage("ไม่สามารถระบุตำแหน่งได้");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="min-h-screen bg-animated">
      <Sidebar />

      <main className="md:ml-64 p-4 md:p-6 pb-24 md:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 font-heading">Settings</h1>
          <p className="text-sm text-slate-500">ตั้งค่า API Keys, ตำแหน่ง, และพารามิเตอร์ AI</p>
        </div>

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            {message}
          </div>
        )}

        <div className="glass-card p-6 max-w-3xl">
          <h2 className={sectionTitle}>
            <span className="material-symbols-outlined text-[#005eb2]">key</span>
            API Keys
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              <p className="text-xs text-slate-400 mt-1">tomorrow.io</p>
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
          </div>

          <h2 className={sectionTitle}>
            <span className="material-symbols-outlined text-[#005eb2]">location_on</span>
            Location
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className={labelCls}>Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={settings.lat}
                onChange={(e) => updateSettings({ lat: parseFloat(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={settings.lon}
                onChange={(e) => updateSettings({ lon: parseFloat(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={handleGeolocation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition flex items-center gap-2 text-white"
              >
                <span className="material-symbols-outlined text-sm">my_location</span>
                ใช้ตำแหน่งปัจจุบัน
              </button>
              {settings.locationName && <p className="text-xs text-slate-500 mt-2">{settings.locationName}</p>}
            </div>
          </div>

          <h2 className={sectionTitle}>
            <span className="material-symbols-outlined text-[#005eb2]">psychology</span>
            AI Parameters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className={labelCls}>Rain Threshold (0.5 - 0.99)</label>
              <input
                type="range"
                min="0.5"
                max="0.99"
                step="0.01"
                value={settings.rainThreshold}
                onChange={(e) => updateSettings({ rainThreshold: parseFloat(e.target.value) })}
                className="w-full accent-[#005eb2]"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>0.5 (เตือนไว)</span>
                <span className="text-slate-900 font-medium">{settings.rainThreshold}</span>
                <span>0.99 (เตือนช้า)</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Webcam Radius (km)</label>
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

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#005eb2] hover:bg-[#004788] disabled:opacity-50 rounded-lg text-sm font-medium transition flex items-center gap-2 text-white"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
