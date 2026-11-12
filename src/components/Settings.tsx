import type { GestureSettings } from "../gesture/types";
import { useCameraDevices } from "../hooks/useCameraDevices";

interface Props {
  settings: GestureSettings;
  onChange: (s: GestureSettings) => void;
  deviceId?: string;
  onDeviceChange: (id?: string) => void;
  onClose: () => void;
}

export function Settings({ settings, onChange, deviceId, onDeviceChange, onClose }: Props) {
  const devices = useCameraDevices();

  function set<K extends keyof GestureSettings>(key: K, value: number) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="settings-panel" onClick={onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>

        {devices.length > 1 && (
          <div className="setting-row">
            <label>Camera</label>
            <select value={deviceId ?? ""} onChange={(e) => onDeviceChange(e.target.value || undefined)}>
              <option value="">Default camera</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Camera"}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="setting-row">
          <label>
            <span>Swipe sensitivity</span>
            <span>{settings.swipeThreshold.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.1}
            max={0.4}
            step={0.01}
            value={settings.swipeThreshold}
            onChange={(e) => set("swipeThreshold", Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label>
            <span>Pinch sensitivity</span>
            <span>{settings.pinchThreshold.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0.2}
            max={0.55}
            step={0.01}
            value={settings.pinchThreshold}
            onChange={(e) => set("pinchThreshold", Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label>
            <span>Zoom speed</span>
            <span>{settings.zoomSensitivity.toFixed(1)}</span>
          </label>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={settings.zoomSensitivity}
            onChange={(e) => set("zoomSensitivity", Number(e.target.value))}
          />
        </div>

        <div className="setting-row">
          <label>
            <span>Fist hold to blank (ms)</span>
            <span>{settings.fistHoldMs}</span>
          </label>
          <input
            type="range"
            min={300}
            max={1500}
            step={50}
            value={settings.fistHoldMs}
            onChange={(e) => set("fistHoldMs", Number(e.target.value))}
          />
        </div>

        <button className="btn btn-primary" onClick={onClose} style={{ width: "100%", marginTop: 8 }}>
          Done
        </button>
      </div>
    </div>
  );
}
