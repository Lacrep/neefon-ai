import { trpc } from "@/providers/trpc";

export default function PredictionLog() {
  const historyQuery = trpc.ai.getHistory.useQuery(
    { limit: 50 },
    { refetchInterval: 3 * 60 * 1000, refetchIntervalInBackground: true }
  );
  const history = historyQuery.data ?? [];

  return (
    <div className="col-span-12 glass-card overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-base md:text-lg font-semibold text-slate-900 font-heading">Prediction Logs</h3>
        {/* Downloads the FULL history from the server (not just the ~50 rows
            shown here) — the route streams every stored reading as CSV. */}
        <a
          href="/api/export/readings.csv"
          download
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition flex items-center gap-1 border border-slate-200"
        >
          <span className="material-symbols-outlined text-[16px]">download</span> Export ทั้งหมด (CSV)
        </a>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-5 font-medium">Timestamp</th>
              <th className="py-3.5 px-5 font-medium">Prediction</th>
              <th className="py-3.5 px-5 font-medium">เวลาที่ทำนาย</th>
              <th className="py-3.5 px-5 font-medium">Confidence</th>
              <th className="py-3.5 px-5 font-medium">Time to Rain</th>
              <th className="py-3.5 px-5 font-medium">Actual</th>
              <th className="py-3.5 px-5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  ยังไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              history.map((row) => {
                const t = row.timestamp
                  ? new Date(row.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
                  : "--";
                const pCls = row.predictedRain ? "text-[#ba1a1a]" : "text-emerald-600";
                const pTxt = row.predictedRain ? "ฝนตก" : "ไม่มีฝน";

                let predTime = "--";
                if (row.predictedRain && row.timeToRain != null && row.timeToRain < 999 && row.predictedStartTime) {
                  const d = new Date(row.predictedStartTime);
                  predTime = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")} น.`;
                }

                let aText = "--";
                let rCls = "text-slate-400";
                let rTxt = "รอผล";

                if (row.validated) {
                  if (row.predictedRain && row.actualRain) {
                    aText = "ฝนตก";
                    rTxt = "✓ เตือนถูก";
                    rCls = "text-emerald-600";
                  } else if (row.predictedRain && !row.actualRain) {
                    aText = "ไม่มีฝน";
                    rTxt = "✗ เตือนเกิน";
                    rCls = "text-red-600";
                  } else if (!row.predictedRain && !row.actualRain) {
                    aText = "ไม่มีฝน";
                    rTxt = "✓ ไม่เตือนถูก";
                    rCls = "text-emerald-600";
                  } else {
                    aText = "ฝนตก";
                    rTxt = "✗ เตือนไม่ทัน";
                    rCls = "text-red-600";
                  }
                }

                return (
                  <tr key={row.id} className="log-row transition-colors">
                    <td className="px-5 py-3 text-slate-700">{t}</td>
                    <td className={`px-5 py-3 font-medium ${pCls}`}>{pTxt}</td>
                    <td className="px-5 py-3 font-medium text-[#005eb2]">{predTime}</td>
                    <td className="px-5 py-3 text-slate-700 font-mono">{row.confidence}%</td>
                    <td className="px-5 py-3 text-slate-700">{row.timeToRain != null ? `${row.timeToRain} min` : "--"}</td>
                    <td className="px-5 py-3 text-slate-700">{aText}</td>
                    <td className={`px-5 py-3 font-medium ${rCls}`}>{rTxt}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
