import { trpc } from "@/providers/trpc";

export default function ConfusionMatrix() {
  const accuracyQuery = trpc.ai.getAccuracy.useQuery(
    { days: 7 },
    { refetchInterval: 3 * 60 * 1000, refetchIntervalInBackground: true }
  );

  const { tp = 0, fp = 0, fn = 0, tn = 0 } = accuracyQuery.data?.confusionMatrix ?? {};
  const csi = tp + fp + fn > 0 ? (tp / (tp + fp + fn)) * 100 : 0;

  return (
    <div className="glass-card p-5 md:p-6">
      <h4 className="text-base md:text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 font-heading">
        <span className="material-symbols-outlined text-slate-400">grid_on</span>
        Confusion Matrix
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-emerald-600 font-medium mb-1">True Positive</span>
          <span className="text-3xl font-bold text-emerald-700">{tp}</span>
          <span className="text-[10px] text-emerald-600/70 mt-1">เตือนถูก</span>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-red-600 font-medium mb-1">False Positive</span>
          <span className="text-3xl font-bold text-red-600">{fp}</span>
          <span className="text-[10px] text-red-600/70 mt-1">เตือนเกิน</span>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-amber-600 font-medium mb-1">False Negative</span>
          <span className="text-3xl font-bold text-amber-600">{fn}</span>
          <span className="text-[10px] text-amber-600/70 mt-1">เตือนไม่ทัน</span>
        </div>
        <div className="bg-[#005eb2]/5 border border-[#005eb2]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-[#005eb2] font-medium mb-1">True Negative</span>
          <span className="text-3xl font-bold text-[#005eb2]">{tn}</span>
          <span className="text-[10px] text-[#005eb2]/70 mt-1">ไม่เตือนถูก</span>
        </div>
      </div>
      <div className="text-center mt-4 text-xs text-slate-500">
        CSI (Critical Success Index){" "}
        <span className="font-bold text-slate-900">{csi > 0 ? `${csi.toFixed(1)}%` : "--%"}</span>
      </div>
    </div>
  );
}
