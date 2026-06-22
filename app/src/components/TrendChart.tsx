import { useRef, useEffect } from "react";
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";
import { trpc } from "@/providers/trpc";

export default function TrendChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const accuracyQuery = trpc.ai.getAccuracy.useQuery({ days: 7 });

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const dailyStats = accuracyQuery.data?.dailyStats ?? [];
    const labels = dailyStats.map((d) => d.date.slice(5)); // MM-DD
    const data = dailyStats.map((d) => d.accuracy);

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Accuracy %",
          data,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: "#10b981",
        },
      ],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      layout: {
        padding: { top: 5, bottom: 5, left: 5, right: 5 },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: "#eef1f4" },
          ticks: { color: "#64748b", font: { size: 10 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#64748b", font: { size: 10 }, maxRotation: 45 },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: chartData,
      options,
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [accuracyQuery.data]);

  return (
    <div className="glass-card p-5 md:p-6">
      <h4 className="text-base md:text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2 font-heading">
        <span className="material-symbols-outlined text-slate-400">show_chart</span>
        Daily Accuracy Trend
      </h4>
      <div style={{ height: "190px", width: "100%" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
