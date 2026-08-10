import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSettings } from "@/contexts/SettingsContext";

export type LocationMode = "locked" | "follow";

interface LocationValue {
  mode: LocationMode;
  setMode: (m: LocationMode) => void;
  lat: number;
  lon: number;
  following: boolean; // follow mode AND we have a live GPS fix
  requesting: boolean; // follow mode, waiting for the first fix
  gpsError: string | null;
  accuracyM: number | null;
}

const LocationContext = createContext<LocationValue | null>(null);

// Decides which coordinates the DASHBOARD uses:
//  - "locked"  → the saved factory location (also what the server-side
//    collector / push / robot alert always use — that never changes here).
//  - "follow"  → the phone's live GPS, for general "is it raining where I am".
export function LocationProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [mode, setModeState] = useState<LocationMode>(() =>
    (typeof window !== "undefined" && localStorage.getItem("neefonLocationMode")) === "follow" ? "follow" : "locked"
  );
  const [gps, setGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const setMode = useCallback((m: LocationMode) => {
    localStorage.setItem("neefonLocationMode", m);
    setModeState(m);
    if (m === "locked") {
      setGps(null);
      setGpsError(null);
    }
  }, []);

  useEffect(() => {
    if (mode !== "follow" || !("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy });
        setGpsError(null);
      },
      (err) => setGpsError(err.code === 1 ? "ยังไม่ได้อนุญาตตำแหน่ง" : "หาตำแหน่งไม่สำเร็จ"),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode]);

  const following = mode === "follow" && !!gps;
  const unsupported = mode === "follow" && !("geolocation" in navigator);
  const lat = following ? gps!.lat : settings.lat;
  const lon = following ? gps!.lon : settings.lon;

  return (
    <LocationContext.Provider
      value={{
        mode,
        setMode,
        lat,
        lon,
        following,
        requesting: mode === "follow" && !gps && !gpsError && !unsupported,
        gpsError: unsupported ? "อุปกรณ์นี้ไม่รองรับ GPS" : gpsError,
        accuracyM: following ? Math.round(gps!.acc) : null,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
