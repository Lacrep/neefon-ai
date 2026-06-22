import { Routes, Route } from "react-router";
import { WeatherProvider } from "./contexts/WeatherContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import Dashboard from "./pages/Dashboard";
import HistoryPage from "./pages/History";
import SettingsPage from "./pages/Settings";

export default function App() {
  return (
    <SettingsProvider>
      <WeatherProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </WeatherProvider>
    </SettingsProvider>
  );
}
