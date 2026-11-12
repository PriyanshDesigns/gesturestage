import { useEffect, useRef, useState } from "react";
import { useHandTracking } from "../hooks/useHandTracking";
import { HandSkeleton } from "./HandSkeleton";
import { Settings } from "./Settings";
import { slides } from "../data/slides";
import type { GestureEvent, GestureSettings } from "../gesture/types";
import type { SessionStats } from "./SessionSummary";

interface Props {
  settings: GestureSettings;
  onSettingsChange: (s: GestureSettings) => void;
  deviceId?: string;
  onDeviceChange: (id?: string) => void;
  onEnd: (stats: SessionStats) => void;
}

interface Toast {
  id: number;
  text: string;
}

const TOAST_TEXT: Record<string, string> = {
  "next-slide": "Next →",
  "prev-slide": "← Previous",
  "blank-toggle": "Screen blanked",
};

export function LiveControl({ settings, onSettingsChange, deviceId, onDeviceChange, onEnd }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [blanked, setBlanked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const statsRef = useRef<SessionStats>({
    nextCount: 0,
    prevCount: 0,
    pointerCount: 0,
    zoomCount: 0,
    blankCount: 0,
    durationMs: 0,
  });
  const startedAt = useRef(performance.now());
  const toastId = useRef(0);
  const wasPointingRef = useRef(false);

  function pushToast(text: string) {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 1400);
  }

  function handleEvent(e: GestureEvent) {
    switch (e.type) {
      case "next-slide":
        setSlideIndex((i) => Math.min(i + 1, slides.length - 1));
        setZoom(1);
        statsRef.current.nextCount += 1;
        pushToast(TOAST_TEXT["next-slide"]);
        break;
      case "prev-slide":
        setSlideIndex((i) => Math.max(i - 1, 0));
        setZoom(1);
        statsRef.current.prevCount += 1;
        pushToast(TOAST_TEXT["prev-slide"]);
        break;
      case "pointer-move":
        setPointer({ x: e.x ?? 0.5, y: e.y ?? 0.5 });
        if (!wasPointingRef.current) {
          statsRef.current.pointerCount += 1;
          wasPointingRef.current = true;
        }
        break;
      case "pointer-off":
        setPointer(null);
        wasPointingRef.current = false;
        break;
      case "zoom":
        setZoom((z) => Math.min(3, Math.max(1, z + (e.delta ?? 0))));
        statsRef.current.zoomCount += 1;
        break;
      case "blank-toggle":
        setBlanked((b) => !b);
        statsRef.current.blankCount += 1;
        pushToast(TOAST_TEXT["blank-toggle"]);
        break;
    }
  }

  const { videoRef, landmarks, pose } = useHandTracking({
    deviceId,
    active: true,
    settings,
    onEvent: handleEvent,
  });

  // Keyboard fallback — always available, gestures are an addition.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") handleEvent({ type: "next-slide", at: performance.now() });
      if (e.key === "ArrowLeft") handleEvent({ type: "prev-slide", at: performance.now() });
      if (e.key === "b" || e.key === "B") handleEvent({ type: "blank-toggle", at: performance.now() });
      if (e.key === "Escape") setSettingsOpen((s) => !s);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = slides[slideIndex];

  return (
    <div className="screen live-control">
      <div className="slide-viewer" style={{ transform: `scale(${zoom})` }}>
        <div className="slide" style={{ background: slide.accent }}>
          <h2>{slide.title}</h2>
          {slide.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {slide.id === "point-target" && <div className="target-dot" />}
          {slide.chart && (
            <div className="fake-chart">
              {[40, 70, 55, 90, 65].map((h, i) => (
                <div key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {pointer && (
        <div className="pointer-dot" style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }} />
      )}

      {blanked && <div className="blank-overlay">Screen blanked — hold a fist again to resume</div>}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>

      <div className="tracking-widget">
        <video ref={videoRef} muted playsInline />
        <HandSkeleton landmarks={landmarks} />
        <div className="pose-label">{pose}</div>
      </div>

      <div className="control-bar">
        <button className="btn" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
        <button
          className="btn"
          onClick={() =>
            onEnd({ ...statsRef.current, durationMs: performance.now() - startedAt.current })
          }
        >
          End session
        </button>
      </div>

      {settingsOpen && (
        <Settings
          settings={settings}
          onChange={onSettingsChange}
          deviceId={deviceId}
          onDeviceChange={onDeviceChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
