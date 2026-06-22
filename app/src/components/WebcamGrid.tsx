import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useSettings } from "@/contexts/SettingsContext";
import LiveWebcam from "@/components/LiveWebcam";

interface Webcam {
  id: string;
  title: string;
  thumb?: string;
  city?: string;
  country?: string;
  distance?: number;
  playerUrl?: string;
  detailUrl?: string;
  streamUrl?: string;
  clipUrl?: string;
}

export default function WebcamGrid() {
  const { settings } = useSettings();
  const [selectedWebcam, setSelectedWebcam] = useState<Webcam | null>(null);

  const webcamQuery = trpc.webcam.getNearby.useQuery(
    {
      lat: settings.lat ?? 13.7563,
      lon: settings.lon ?? 100.5018,
      radius: settings.webcamRadius ?? 20,
      apiKey: settings.windyKey ?? "",
    },
    { enabled: !!settings.windyKey, staleTime: 1000 * 60 * 5 }
  );

  const webcams = webcamQuery.data?.webcams ?? [];
  const liveCount = webcams.filter((w) => w.streamUrl).length;

  return (
    <div className="col-span-12 glass-card p-5 md:p-6 relative">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ba1a1a]">fiber_manual_record</span>
          <h3 className="text-base md:text-lg font-semibold text-slate-900 font-heading">Live Cameras (Nearby)</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {webcams.length} cameras
            {liveCount > 0 && <span className="font-bold text-[#ba1a1a]"> · {liveCount} live</span>}
          </span>
          <button
            onClick={() => webcamQuery.refetch()}
            className="px-3 py-1.5 rounded-full bg-[#005eb2] hover:bg-[#004788] text-white text-xs font-medium transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reload
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {webcamQuery.isLoading ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl animate-spin text-[#005eb2] mb-3 block">cameraswitch</span>
            <p className="text-sm text-slate-500">กำลังค้นหาเว็บแคม...</p>
          </div>
        ) : webcamQuery.error ? (
          <div className="col-span-full text-center py-12">
            <span className="material-symbols-outlined text-4xl mb-3 block text-red-500">error_outline</span>
            <p className="text-sm text-red-600 mb-2">เกิดข้อผิดพลาดในการโหลด</p>
            <p className="text-xs text-slate-400">{webcamQuery.error.message}</p>
          </div>
        ) : webcams.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-4xl mb-3 block text-slate-300">videocam_off</span>
            <p className="text-sm text-slate-500">
              {settings.windyKey ? "ไม่พบเว็บแคมในบริเวณนี้ ลองเพิ่มรัศมีการค้นหา" : "ใส่ Windy API Key ในการตั้งค่า"}
            </p>
          </div>
        ) : (
          webcams.map((w) => {
            const isLive = !!w.streamUrl;
            return (
              <div key={w.id} className="webcam-card cursor-pointer" onClick={() => setSelectedWebcam(w as Webcam)}>
                <div className="relative w-full aspect-video bg-slate-200 overflow-hidden rounded-t-xl">
                  <LiveWebcam streamUrl={w.streamUrl} poster={w.thumb} title={w.title} />
                  <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-1">
                    {isLive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5a] animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-white">LIVE</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-white/85">ภาพสด</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-slate-800 truncate">{w.title}</div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-slate-500 truncate">{w.city || w.country || "--"}</span>
                    {w.distance != null && (
                      <span className="text-[10px] font-semibold text-[#005eb2] shrink-0">{w.distance.toFixed(1)} km</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {selectedWebcam && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedWebcam(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 font-heading">{selectedWebcam.title}</h4>
                <p className="text-xs flex items-center gap-1.5">
                  {selectedWebcam.streamUrl ? (
                    <span className="text-[#ba1a1a] font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a] animate-pulse" /> สด (เรียลไทม์)
                    </span>
                  ) : (
                    <span className="text-slate-500">ภาพสด (อัปเดตอัตโนมัติทุก 15 วิ)</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSelectedWebcam(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 rounded-xl overflow-hidden bg-slate-900 min-h-[400px]">
              <LiveWebcam
                streamUrl={selectedWebcam.streamUrl}
                poster={selectedWebcam.thumb}
                title={selectedWebcam.title}
                controls
                className="min-h-[400px]"
              />
            </div>

            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {selectedWebcam.city || selectedWebcam.country || "ไม่ระบุ"}
              </span>
              <a
                href={selectedWebcam.detailUrl || `https://www.windy.com/webcams/${selectedWebcam.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#005eb2] hover:text-[#004788] transition flex items-center gap-1"
              >
                ดูบน Windy <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
