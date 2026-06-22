import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import HeaderBar from "@/components/HeaderBar";
import AIPredictionHero from "@/components/AIPredictionHero";
import WeatherHero from "@/components/WeatherHero";
import QuickMetrics from "@/components/QuickMetrics";
import AirQualityCard from "@/components/AirQualityCard";
import HourlyForecast from "@/components/HourlyForecast";
import WindyMap from "@/components/WindyMap";
import WebcamGrid from "@/components/WebcamGrid";
import EnsembleBreakdown from "@/components/EnsembleBreakdown";
import AccuracyMetrics from "@/components/AccuracyMetrics";
import ConfusionMatrix from "@/components/ConfusionMatrix";
import TrendChart from "@/components/TrendChart";
import PredictionLog from "@/components/PredictionLog";
import SettingsPanel from "@/components/SettingsPanel";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-animated">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-6 pb-24 md:pb-6">
        <HeaderBar />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* AI Prediction Hero + Current Temperature */}
          <AIPredictionHero />
          <WeatherHero />

          {/* Weather metrics */}
          <QuickMetrics />

          {/* Air quality / dust (PM2.5, PM10, …) */}
          <AirQualityCard />

          {/* Hourly forecast */}
          <HourlyForecast />

          {/* Map + analytics sidebar */}
          <WindyMap />
          <div className="col-span-12 xl:col-span-4 space-y-4">
            <EnsembleBreakdown />
            <AccuracyMetrics />
          </div>

          {/* Live cameras */}
          <WebcamGrid />

          {/* Confusion matrix + accuracy trend */}
          <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConfusionMatrix />
            <TrendChart />
          </div>

          {/* Prediction logs */}
          <PredictionLog />
        </div>

        {/* Footer */}
        <footer className="mt-6 flex flex-wrap gap-3 justify-between items-center px-5 py-4 bg-white rounded-2xl border border-slate-200/70">
          <span className="text-xs font-bold text-[#005eb2]">หนีฝน AI v3.0</span>
          <div className="flex gap-4">
            <a
              className="text-xs text-slate-400 hover:text-[#005eb2] transition"
              href="https://openweathermap.org/api/one-call-3"
              target="_blank"
              rel="noopener noreferrer"
            >
              OWM Docs
            </a>
            <a
              className="text-xs text-slate-400 hover:text-[#005eb2] transition"
              href="https://api.windy.com/keys"
              target="_blank"
              rel="noopener noreferrer"
            >
              Windy API Keys
            </a>
          </div>
        </footer>
      </main>

      {/* Settings Panel Modal */}
      <SettingsPanel />

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
