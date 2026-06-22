import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

interface Settings {
  owmKey: string;
  tomorrowKey: string;
  windyKey: string;
  geminiKey: string;
  lat: number;
  lon: number;
  locationName: string;
  rainThreshold: number;
  webcamRadius: number;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;
  saveSettings: () => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  loading: boolean;
}

const defaultSettings: Settings = {
  owmKey: "",
  tomorrowKey: "",
  windyKey: "",
  geminiKey: "",
  lat: 13.7563,
  lon: 100.5018,
  locationName: "กรุงเทพมหานคร",
  rainThreshold: 0.55,
  webcamRadius: 20,
};

function loadStoredSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  const stored = localStorage.getItem("weatherAppSettings");
  if (!stored) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch (e) {
    console.error("Failed to parse settings from localStorage", e);
    return defaultSettings;
  }
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadStoredSettings);
  const [isOpen, setIsOpen] = useState(false);

  const query = trpc.settings.get.useQuery();
  const mutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      query.refetch();
    },
  });

  // Persist to localStorage whenever settings change (side effect lives in an effect).
  useEffect(() => {
    localStorage.setItem("weatherAppSettings", JSON.stringify(settings));
  }, [settings]);

  // Merge DB settings into editable state when they arrive (and on refetch).
  // Done during render via previous-value tracking (a React-supported pattern)
  // so empty DB values don't overwrite API keys kept in localStorage.
  const [syncedData, setSyncedData] = useState<typeof query.data>();
  if (query.data && query.data !== syncedData) {
    const data = query.data;
    setSyncedData(data);
    setSettings((prev) => ({
      ...data,
      owmKey: data.owmKey || prev.owmKey,
      tomorrowKey: data.tomorrowKey || prev.tomorrowKey,
      windyKey: data.windyKey || prev.windyKey,
      geminiKey: data.geminiKey || prev.geminiKey,
    }));
  }

  const updateSettings = (partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const saveSettings = () => {
    // Trigger webcam refetch by invalidating the query
    query.refetch();
    mutation.mutate({
      owmKey: settings.owmKey,
      tomorrowKey: settings.tomorrowKey,
      windyKey: settings.windyKey,
      geminiKey: settings.geminiKey,
      lat: settings.lat,
      lon: settings.lon,
      locationName: settings.locationName,
      rainThreshold: settings.rainThreshold,
      webcamRadius: settings.webcamRadius,
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        saveSettings,
        isOpen,
        setIsOpen,
        loading: query.isLoading || mutation.isPending,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
