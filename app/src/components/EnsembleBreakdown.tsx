import { useWeather } from "@/contexts/WeatherContext";

export default function EnsembleBreakdown() {
  const { aiPrediction } = useWeather();

  const signals = aiPrediction?.signals ?? [];

  const getBarColor = (name: string): string => {
    switch (name) {
      case "Nowcast": return "bg-[#005eb2]";
      case "Trend Analysis": return "bg-blue-500";
      case "Pattern Matching": return "bg-purple-500";
      case "Rate of Change": return "bg-cyan-500";
      case "Climate Signal": return "bg-emerald-500";
      case "Webcam Sky": return "bg-amber-500";
      default: return "bg-slate-400";
    }
  };

  return (
    <div className="glass-card p-5 md:p-6">
      <h4 className="text-base md:text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2 font-heading">
        <span className="material-symbols-outlined text-slate-400">analytics</span>
        Ensemble Model
      </h4>
      <div className="space-y-4">
        {signals.map((sig) => (
          <div key={sig.name}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className={sig.active ? "font-medium text-slate-800" : "text-slate-500"}>{sig.name}</span>
              <span className={sig.active ? "text-[#005eb2] font-bold" : "text-slate-400 font-mono text-xs"}>
                {sig.active ? `${sig.predictedMinutes}m (${Math.round(sig.confidence * 100)}%)` : "N/A"}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`${getBarColor(sig.name)} h-2 rounded-full transition-all duration-500`}
                style={{ width: sig.active ? `${Math.min(100, sig.confidence * 100)}%` : "4%" }}
              />
            </div>
          </div>
        ))}

        {signals.length === 0 && (
          <div className="text-center text-slate-400 py-4">
            <p className="text-sm">Waiting for AI prediction data...</p>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
          <div className="flex items-start gap-2 text-sm">
            <span className="material-symbols-outlined text-slate-400 text-[18px] mt-0.5 shrink-0">smart_toy</span>
            <span className="text-slate-700">
              <span className="text-slate-500">AI Recommendation: </span>
              <span className="font-medium text-slate-800">{aiPrediction?.recommendation || "Waiting for data..."}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
