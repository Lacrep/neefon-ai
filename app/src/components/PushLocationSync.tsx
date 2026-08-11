import { useEffect, useRef } from "react";
import { useLocation } from "@/contexts/LocationContext";
import { syncSubscription } from "@/lib/push";

// Keeps this device's push subscription in sync with the location toggle: when
// the mode or the follow-GPS changes (while the app is open), tell the server so
// notifications target the right place. Renders nothing.
export default function PushLocationSync() {
  const { mode, lat, lon } = useLocation();
  const lastKey = useRef("");

  useEffect(() => {
    const key = mode === "follow" ? `follow:${lat.toFixed(3)},${lon.toFixed(3)}` : "locked";
    if (key === lastKey.current) return;
    lastKey.current = key;
    void syncSubscription(mode, mode === "follow" ? lat : null, mode === "follow" ? lon : null);
  }, [mode, lat, lon]);

  return null;
}
