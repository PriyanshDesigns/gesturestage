import { useState } from "react";
import { useHandTracking } from "../hooks/useHandTracking";
import { useCameraDevices } from "../hooks/useCameraDevices";
import { HandSkeleton } from "./HandSkeleton";
import { DEFAULT_GESTURE_SETTINGS } from "../gesture/types";

const MIN_BRIGHTNESS = 0.22;

export function Calibration({ onContinue }: { onContinue: (deviceId?: string) => void }) {
  const devices = useCameraDevices();
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const { videoRef, status, error, landmarks, brightness } = useHandTracking({
    deviceId,
    active: true,
    settings: DEFAULT_GESTURE_SETTINGS,
    onEvent: () => {},
  });

  const handDetected = landmarks !== null;
  const lightOk = brightness === null ? null : brightness >= MIN_BRIGHTNESS;

  return (
    <div className="screen calibration">
      <div className="cam-preview">
        <video ref={videoRef} muted playsInline />
        <HandSkeleton landmarks={landmarks} />
      </div>

      <div className="checklist card">
        <h3 style={{ marginTop: 0 }}>Calibration</h3>

        {devices.length > 1 && (
          <div className="setting-row">
            <label>Camera</label>
            <select value={deviceId ?? ""} onChange={(e) => setDeviceId(e.target.value || undefined)}>
              <option value="">Default camera</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          </div>
        )}

        <CheckRow
          ok={status === "ready" || status === "loading-model"}
          label={
            status === "error"
              ? error ?? "Camera error"
              : status === "requesting-camera"
              ? "Requesting camera access…"
              : status === "loading-model"
              ? "Loading hand-tracking model…"
              : "Camera connected"
          }
        />
        <CheckRow ok={lightOk} label={lightOk === false ? "Room is a little dim — add light if you can" : "Lighting looks good"} />
        <CheckRow ok={handDetected} label={handDetected ? "Hand detected" : "Hold your hand up so the camera can see it"} />

        <p className="muted" style={{ fontSize: 12.5 }}>
          Low light measurably lowers gesture accuracy. It's fine to continue anyway —
          the keyboard always works as a fallback.
        </p>

        <button className="btn btn-primary" onClick={() => onContinue(deviceId)} style={{ width: "100%", marginTop: 8 }}>
          Start presenting
        </button>
      </div>
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? "var(--text-dim)" : ok ? "var(--good)" : "var(--warn)";
  return (
    <div className="check-row">
      <span className="dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
