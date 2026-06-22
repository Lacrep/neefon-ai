import { createContext, useContext, useCallback, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { useSettings } from "@/contexts/SettingsContext";
import type { AIPrediction, AirQuality, CurrentWeather, HourlyForecast } from "@contracts/weather";

interface WeatherContextValue {
  currentWeather: CurrentWeather | null;
  hourlyForecast: HourlyForecast[];
  aiPrediction: AIPrediction | null;
  airQuality: AirQuality | null;
  lastUpdated: Date | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const utils = trpc.useUtils();

  const weatherQuery = trpc.weather.getCurrent.useQuery(
    {
      lat: settings.lat,
      lon: settings.lon,
      owmKey: settings.owmKey,
      tomorrowKey: settings.tomorrowKey,
      windyKey: settings.windyKey,
      geminiKey: settings.geminiKey,
    },
    {
      enabled: !!settings.owmKey,
      refetchInterval: 3 * 60 * 1000,
      refetchIntervalInBackground: true,
    }
  );

  const refetch = useCallback(() => {
    if (settings.owmKey) {
      utils.weather.getCurrent.invalidate();
    }
  }, [utils, settings.owmKey]);

  // React Query keeps the last successful `data` during background refetches,
  // so we can derive context values directly instead of mirroring into state.
  const data = weatherQuery.data;

  return (
    <WeatherContext.Provider
      value={{
        currentWeather: data?.current ?? null,
        hourlyForecast: data?.hourly ?? [],
        aiPrediction: data?.aiPrediction ?? null,
        airQuality: data?.airQuality ?? null,
        lastUpdated: data?.lastUpdated ?? null,
        loading: weatherQuery.isLoading,
        error: weatherQuery.error?.message ?? null,
        refetch,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeather must be used within WeatherProvider");
  return ctx;
}
