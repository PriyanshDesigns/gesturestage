import { useCallback, useEffect, useRef, useState } from "react";
import { CameraPanel, GestureCheatSheet } from "./components/CameraPanel";
import { DwellCursor } from "./components/DwellCursor";
import { HandTracker, type RawHand } from "./hands";
import { STAGE_H, STAGE_W } from "./layout";
import { LEVELS } from "./levels";
import { GameScreen } from "./screens/GameScreen";
import { Home } from "./screens/Home";
import { Levels } from "./screens/Levels";
import { Settings } from "./screens/Settings";
import { setSoundEnabled, unlockAudio } from "./sfx";
import { loadSettings, loadStars, resetStars, saveSettings, saveStars, type Settings as SettingsData } from "./storage";
import { useCamera } from "./useCamera";

type Screen = { name: "home" } | { name: "levels" } | { name: "game"; levelId: number };

const tracker = new HandTracker();

const SIDE_W = 250;
const SIDE_GAP = 28;

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return vp;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [inputMode, setInputMode] = useState<"hand" | "mouse" | null>(null);
  const [settings, setSettings] = useState<SettingsData>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stars, setStars] = useState(loadStars);
  const [aspect, setAspect] = useState(16 / 9);
  const stageRef = useRef<HTMLDivElement>(null);
  const vp = useViewport();

  const onFrame = useCallback((hands: RawHand[], a: number, now: number) => {
    tracker.ingest(hands, a, now);
    setAspect((prev) => (Math.abs(prev - a) > 0.01 ? a : prev));
  }, []);
  const camera = useCamera(inputMode === "hand", onFrame);

  useEffect(() => {
    tracker.reach = settings.reach;
    setSoundEnabled(settings.sound);
    saveSettings(settings);
  }, [settings]);

  const chooseInput = (mode: "hand" | "mouse") => {
    unlockAudio();
    setInputMode(mode);
    setScreen({ name: "levels" });
  };

  const onWin = useCallback((levelId: number, earned: number) => setStars(saveStars(levelId, earned)), []);

  // Fit the portrait stage to the window; leave room for the camera panel when wide.
  const fit = Math.min(vp.h / STAGE_H, vp.w / STAGE_W);
  const wide = vp.w >= STAGE_W * fit + 2 * (SIDE_W + SIDE_GAP);
  const scale = fit;
  const stageW = STAGE_W * scale;
  const stageH = STAGE_H * scale;

  const camVariant = inputMode !== "hand" ? null : !settings.showCamera ? "hidden" : wide ? "side" : "mini";
  const level = screen.name === "game" ? LEVELS.find((l) => l.id === screen.levelId) : undefined;

  return (
    <div className="zg-root" onPointerDown={unlockAudio}>
      {/* Same tree position in every layout so the <video> never remounts mid-stream. */}
      <div className={wide ? "zg-side" : "zg-side-narrow"} style={wide ? { left: vp.w / 2 - stageW / 2 - SIDE_GAP - SIDE_W } : undefined}>
        {camVariant && (
          <CameraPanel videoRef={camera.videoRef} tracker={tracker} status={camera.status} variant={camVariant} aspect={aspect} />
        )}
        {wide && screen.name !== "home" && <GestureCheatSheet />}
      </div>

      <div className={`zg-stage-wrap ${wide ? "framed" : ""}`} style={{ width: stageW, height: stageH }}>
        <div className="zg-stage" ref={stageRef} style={{ transform: `scale(${scale})` }}>
          {screen.name === "home" && (
            <Home cameraError={camera.error} onHands={() => chooseInput("hand")} onMouse={() => chooseInput("mouse")} />
          )}
          {screen.name === "levels" && (
            <Levels
              stars={stars}
              status={
                inputMode === "hand"
                  ? camera.status === "error"
                    ? `Camera problem: ${camera.error}. Switch to the mouse in Settings.`
                    : camera.status === "starting"
                      ? "Starting the camera and hand tracker…"
                      : "Point ☝️ at a box and hold to open it."
                  : null
              }
              onPlay={(id) => setScreen({ name: "game", levelId: id })}
              onBack={() => setScreen({ name: "home" })}
              onSettings={() => setSettingsOpen(true)}
            />
          )}
          {level && (
            <GameScreen
              key={level.id}
              level={level}
              tracker={tracker}
              scale={scale}
              inputMode={inputMode ?? "mouse"}
              settingsOpen={settingsOpen}
              onExit={() => setScreen({ name: "levels" })}
              onPlay={(id) => setScreen({ name: "game", levelId: id })}
              onWin={onWin}
              onSettings={() => setSettingsOpen(true)}
            />
          )}
          {settingsOpen && (
            <Settings
              settings={settings}
              inputMode={inputMode ?? "mouse"}
              onChange={setSettings}
              onToggleInput={() => setInputMode((m) => (m === "hand" ? "mouse" : "hand"))}
              onResetProgress={() => {
                resetStars();
                setStars({});
              }}
              onClose={() => setSettingsOpen(false)}
            />
          )}
          <DwellCursor tracker={tracker} stageRef={stageRef} showIdle={screen.name !== "game"} />
        </div>
      </div>
    </div>
  );
}
