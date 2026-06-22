import { trpc } from "@/providers/trpc";

export default function AccuracyMetrics() {
  const accuracyQuery = trpc.ai.getAccuracy.useQuery(
    { days: 7 },
    { refetchInterval: 3 * 60 * 1000, refetchIntervalInBackground: true }
  );
  const data = accuracyQuery.data;

  const { tp = 0, fp = 0, fn = 0, tn = 0 } = data?.confusionMatrix ?? {};
  const total = tp + fp + fn + tn;
  const acc = total > 0 ? ((tp + tn) / total) * 100 : 0;
  const pre = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const rec = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;

  const maxArc = 251.327;
  const arcValue = Math.max(0, (acc / 100) * maxArc);

  return (
    <div className="glass-card p-5 md:p-6 flex flex-col items-center">
      <h4 className="text-base md:text-lg font-semibold text-slate-900 mb-2 self-start flex items-center gap-2 font-heading">
        <span className="material-symbols-outlined text-slate-400">verified</span>
        System Accuracy
      </h4>

      <div className="relative w-56 h-32 flex items-end justify-center mt-2">
        <svg viewBox="0 0 200 120" className="w-56 h-32">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e0e3e6" strokeWidth="12" strokeLinecap="round" />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arcValue},${maxArc}`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1 pointer-events-none">
          <div className="text-3xl font-bold text-slate-900">{acc > 0 ? `${acc.toFixed(1)}%` : "--%"}</div>
        </div>
      </div>
      <span className="text-xs text-slate-400 uppercase tracking-wider mt-1 mb-5">เป้าหมาย: &ge; 85%</span>

      <div className="grid grid-cols-2 gap-4 w-full pt-4 border-t border-slate-200 text-center">
        <div>
          <p className="text-xs text-slate-500 mb-1">Precision</p>
          <p className="font-bold text-[#005eb2]">{pre > 0 ? `${pre.toFixed(1)}%` : "--"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Recall</p>
          <p className="font-bold text-purple-600">{rec > 0 ? `${rec.toFixed(1)}%` : "--"}</p>
        </div>
      </div>
    </div>
  );
}
