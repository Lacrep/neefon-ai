import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface LiveWebcamProps {
  streamUrl?: string; // direct HLS live stream (the real source feed)
  poster?: string; // snapshot image — base layer + live fallback
  title: string;
  controls?: boolean; // modal view: always-on + native controls
  className?: string;
}

type Status = "idle" | "loading" | "playing" | "error";

export default function LiveWebcam({ streamUrl, poster, title, controls, className }: LiveWebcamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Modal (controls=true) is always active; grid cards only load when visible.
  const [inView, setInView] = useState(!!controls);
  const [status, setStatus] = useState<Status>("idle");
  const [streamKey, setStreamKey] = useState("");
  const [imgBust, setImgBust] = useState(0);

  // Reset HLS status when the active stream changes (render-time pattern).
  const activeKey = `${streamUrl ?? ""}|${inView}`;
  if (activeKey !== streamKey) {
    setStreamKey(activeKey);
    setStatus(streamUrl && inView ? "loading" : "idle");
  }

  useEffect(() => {
    if (controls) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [controls]);

  // Play the real HLS live stream with hls.js (native HLS on Safari).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !inView) return;

    let hls: Hls | null = null;
    let settled = false;
    let recoveries = 0;
    const onPlaying = () => {
      settled = true;
      setStatus("playing");
    };
    video.addEventListener("playing", onPlaying);

    // Watchdog: these public traffic-cam streams hiccup a lot. We RECOVER from
    // transient errors (hls.js's official pattern) instead of giving up on the
    // first one — only fall back to the snapshot if it truly never plays.
    const watchdog = setTimeout(() => {
      if (!settled) {
        setStatus("error");
        if (hls) {
          hls.destroy();
          hls = null;
        }
      }
    }, 18000);

    if (Hls.isSupported() && !video.canPlayType("application/vnd.apple.mpegurl")) {
      hls = new Hls({ liveDurationInfinity: true, maxBufferLength: 12, fragLoadingMaxRetry: 6 });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal || !hls) return;
        if (recoveries < 8 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          recoveries++;
          hls.startLoad(); // recover network error (segment / playlist reload)
        } else if (recoveries < 8 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          recoveries++;
          hls.recoverMediaError();
        } else {
          setStatus("error"); // unrecoverable → snapshot fallback
          hls.destroy();
          hls = null;
        }
      });
    } else {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      clearTimeout(watchdog);
      video.removeEventListener("playing", onPlaying);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl, inView]);

  const showVideo = !!streamUrl && status !== "error";

  // No working live stream → keep the snapshot fresh from the SOURCE (re-fetch
  // the latest frame every 15s). This is the real current image, not a Windy
  // timelapse — so the camera still updates instead of freezing on one frame.
  const liveImage = !showVideo && (inView || !!controls);
  useEffect(() => {
    if (!liveImage || !poster) return;
    const id = setInterval(() => setImgBust((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [liveImage, poster]);

  const posterSrc = poster
    ? imgBust > 0
      ? poster + (poster.includes("?") ? "&" : "?") + "t=" + imgBust
      : poster
    : "";

  return (
    <div ref={containerRef} className={`relative w-full h-full bg-slate-900 overflow-hidden ${className ?? ""}`}>
      {posterSrc ? (
        <img src={posterSrc} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <span className="material-symbols-outlined text-3xl">videocam_off</span>
        </div>
      )}

      {showVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          playsInline
          controls={controls}
          poster={poster}
        />
      )}

      {showVideo && status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 pointer-events-none">
          <span className="material-symbols-outlined text-2xl animate-spin text-cyan-400">progress_activity</span>
        </div>
      )}
    </div>
  );
}
