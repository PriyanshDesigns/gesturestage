import { useState } from "react";
import "./App.css";
import { Landing } from "./components/Landing";
import { Onboarding } from "./components/Onboarding";
import { Calibration } from "./components/Calibration";
import { LiveControl } from "./components/LiveControl";
import { SessionSummary, type SessionStats } from "./components/SessionSummary";
import { DEFAULT_GESTURE_SETTINGS } from "./gesture/types";
import type { GestureSettings } from "./gesture/types";

type Screen = "landing" | "onboarding" | "calibration" | "live" | "summary";

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [settings, setSettings] = useState<GestureSettings>(DEFAULT_GESTURE_SETTINGS);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [lastStats, setLastStats] = useState<SessionStats | null>(null);

  if (screen === "landing") {
    return <Landing onStart={() => setScreen("onboarding")} />;
  }

  if (screen === "onboarding") {
    return <Onboarding onContinue={() => setScreen("calibration")} />;
  }

  if (screen === "calibration") {
    return (
      <Calibration
        onContinue={(id) => {
          setDeviceId(id);
          setScreen("live");
        }}
      />
    );
  }

  if (screen === "live") {
    return (
      <LiveControl
        settings={settings}
        onSettingsChange={setSettings}
        deviceId={deviceId}
        onDeviceChange={setDeviceId}
        onEnd={(stats) => {
          setLastStats(stats);
          setScreen("summary");
        }}
      />
    );
  }

  return (
    <SessionSummary
      stats={lastStats ?? { nextCount: 0, prevCount: 0, pointerCount: 0, zoomCount: 0, blankCount: 0, durationMs: 0 }}
      onRestart={() => setScreen("calibration")}
      onHome={() => setScreen("landing")}
    />
  );
}

export default App;
