import { useState } from "react";
import { enablePush, isIos, isStandalone, pushStatus, pushSupported, type PushStatus } from "@/lib/push";

export default function PushToggle() {
  const [status, setStatus] = useState<PushStatus>(() => pushStatus());
  const [standalone] = useState(() => isStandalone());
  const [busy, setBusy] = useState(false);

  // Already subscribed → nothing to show.
  if (status === "granted") return null;

  // iOS needs the PWA installed to the home screen before notifications work.
  if (isIos() && !standalone) {
    return (
      <div className="col-span-12 glass-card p-4 flex items-start gap-3 border-l-4 border-[#005eb2]">
        <span className="material-symbols-outlined text-[#005eb2] mt-0.5">ios_share</span>
        <div className="text-sm text-slate-700">
          <p className="font-semibold text-slate-900">เพิ่มลงหน้าจอโฮมเพื่อรับแจ้งเตือนฝน</p>
          <p className="text-xs text-slate-500 mt-0.5">
            แตะปุ่ม <b>แชร์</b> <span className="material-symbols-outlined text-[13px] align-middle">ios_share</span> ในซาฟารี →
            เลือก <b>“เพิ่มลงในหน้าจอโฮม”</b> → เปิดแอปจากไอคอน แล้วกดเปิดแจ้งเตือน
          </p>
        </div>
      </div>
    );
  }

  if (!pushSupported() || status === "denied") {
    if (status !== "denied") return null; // silently hide when just unsupported
    return (
      <div className="col-span-12 glass-card p-4 flex items-center gap-3 border-l-4 border-amber-400">
        <span className="material-symbols-outlined text-amber-500">notifications_off</span>
        <p className="text-sm text-slate-700">
          การแจ้งเตือนถูกปิดอยู่ — เปิดได้ที่ <b>ตั้งค่า → การแจ้งเตือน</b> ของเบราว์เซอร์/แอป
        </p>
      </div>
    );
  }

  return (
    <div className="col-span-12 glass-card p-4 flex items-center justify-between gap-3 flex-wrap border-l-4 border-[#005eb2]">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[#005eb2]">notifications_active</span>
        <div className="text-sm">
          <p className="font-semibold text-slate-900">รับแจ้งเตือนก่อนฝนตก</p>
          <p className="text-xs text-slate-500">เด้งเตือนเมื่อฝนกำลังจะมา · ฝนเริ่มตก · และเมื่อหยุด</p>
        </div>
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await enablePush();
          setStatus(pushStatus());
          setBusy(false);
          if (!r.ok && r.reason === "denied") alert("กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์");
        }}
        className="px-4 py-2 rounded-full bg-[#005eb2] hover:bg-[#004788] disabled:opacity-50 text-white text-sm font-medium transition flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined text-[18px]">notifications</span>
        {busy ? "กำลังเปิด..." : "เปิดแจ้งเตือน"}
      </button>
    </div>
  );
}
