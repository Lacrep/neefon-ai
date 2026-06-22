import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import AccuracyMetrics from "@/components/AccuracyMetrics";
import ConfusionMatrix from "@/components/ConfusionMatrix";
import TrendChart from "@/components/TrendChart";
import PredictionLog from "@/components/PredictionLog";

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-animated">
      <Sidebar />

      <main className="md:ml-64 p-4 md:p-6 pb-24 md:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 font-heading">Prediction History</h1>
          <p className="text-sm text-slate-500">ดูประวัติการทำนายและวิเคราะห์ความแม่นยำย้อนหลัง</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <AccuracyMetrics />
          <ConfusionMatrix />
        </div>

        <div className="space-y-4">
          <TrendChart />
          <PredictionLog />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
