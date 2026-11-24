import type { Settings as SettingsData } from "../storage";

interface Props {
  settings: SettingsData;
  inputMode: "hand" | "mouse";
  onChange: (s: SettingsData) => void;
  onToggleInput: () => void;
  onResetProgress: () => void;
  onClose: () => void;
}

export function Settings({ settings, inputMode, onChange, onToggleInput, onResetProgress, onClose }: Props) {
  return (
    <div className="zg-overlay" style={{ zIndex: 10 }}>
      <div className="zg-panel zg-settings">
        <h2>Settings</h2>
        <label>
          Sound
          <input type="checkbox" data-dwell checked={settings.sound} onChange={(e) => onChange({ ...settings, sound: e.target.checked })} />
        </label>
        <label>
          Show camera
          <input
            type="checkbox"
            data-dwell
            checked={settings.showCamera}
            onChange={(e) => onChange({ ...settings, showCamera: e.target.checked })}
          />
        </label>
        <label>
          Arm reach
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={settings.reach}
            onChange={(e) => onChange({ ...settings, reach: Number(e.target.value) })}
          />
        </label>
        <div className="note">Smaller = tiny hand movements cover the whole chamber.</div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="zg-btn secondary" onClick={onToggleInput} data-dwell>
            {inputMode === "hand" ? "🖱 Switch to mouse" : "✋ Switch to hands"}
          </button>
          <button
            className="zg-btn secondary"
            onClick={() => {
              if (window.confirm("Reset all stars and locked levels?")) onResetProgress();
            }}
          >
            Reset stars
          </button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="zg-btn" onClick={onClose} data-dwell>
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
