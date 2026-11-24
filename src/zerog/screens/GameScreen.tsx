import { useEffect, useRef, useState, type PointerEvent } from "react";
import { UI, candyUrl, loadFonts, loadSprites } from "../assets";
import { Game, POWERS, type Hud, type PowerId } from "../game";
import type { HandInput, HandPose, HandTracker } from "../hands";
import { BASKET_COLS, STAGE_H, STAGE_W, basketColumnX, stageToWorld } from "../layout";
import { COLOR_HEX, LEVELS, type LevelDef } from "../levels";
import { drawGame } from "../render";
import { playSfx } from "../sfx";

interface Props {
  level: LevelDef;
  tracker: HandTracker;
  scale: number;
  inputMode: "hand" | "mouse";
  settingsOpen: boolean;
  onExit: () => void;
  onPlay: (id: number) => void;
  onWin: (levelId: number, stars: number) => void;
  onSettings: () => void;
}

const HINTS: Record<"hand" | "mouse", [string, string][]> = {
  hand: [
    ["Open your palm ✋ and sweep the candies around", "Move fast to shove them"],
    ["Pinch 🤏 a candy to pick it up", "Carry it into same-colour candies and they stick on"],
    ["Make a fist ✊ to freeze the candies near it", "Handy for holding a group still"],
    ["Get 3 of one colour touching to pop them!", "Keep them together until the white ring fills"],
  ],
  mouse: [
    ["Move the mouse through the candies to sweep them", "Move fast to shove them"],
    ["Hold the left button on a candy to pick it up", "Carry it into same-colour candies and they stick on"],
    ["Hold the right button to freeze the candies nearby", "Handy for holding a group still"],
    ["Get 3 of one colour touching to pop them!", "Keep them together until the white ring fills"],
  ],
};

const POWER_INFO: Record<PowerId, string> = {
  swirl: "Swirl",
  surprise: "Surprise Box",
  sweet: "Sweet Tooth",
};

const MOUSE_ID = 9;

interface MouseState {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pose: HandPose;
  t: number;
}

export function GameScreen({ level, tracker, scale, inputMode, settingsOpen, onExit, onPlay, onWin, onSettings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const scaleRef = useRef(scale);
  const mouse = useRef<MouseState>({ active: false, x: 0, y: 0, vx: 0, vy: 0, pose: "open", t: 0 });
  const [hud, setHud] = useState<Hud | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const reportedWin = useRef(false);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // One Game per level attempt, driven by a rAF loop.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const game = new Game(level, playSfx);
    gameRef.current = game;
    reportedWin.current = false;

    const mouseInputs = (now: number): HandInput[] => {
      const m = mouse.current;
      if (!m.active) return [];
      const still = now - m.t > 45;
      return [{ id: MOUSE_ID, source: "mouse", pose: m.pose, x: m.x, y: m.y, vx: still ? 0 : m.vx, vy: still ? 0 : m.vy, cursorX: 0, cursorY: 0 }];
    };

    Promise.all([loadSprites(level.colors), loadFonts()]).then(() => {
      if (cancelled) return;
      let last = performance.now();
      let lastKey = "";
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = (now - last) / 1000;
        last = now;
        const inputs = [...tracker.inputs(now), ...mouseInputs(now)];
        game.update(dt, inputs);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          const px = scaleRef.current * Math.min(2, window.devicePixelRatio || 1);
          const w = Math.round(STAGE_W * px);
          const h = Math.round(STAGE_H * px);
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, w, h);
          ctx.setTransform(px, 0, 0, px, 0, 0);
          drawGame(ctx, game, inputs, now / 1000);
        }

        const next = game.hud();
        const key = JSON.stringify(next);
        if (key !== lastKey) {
          lastKey = key;
          setHud(next);
        }
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [level, attempt, tracker]);

  useEffect(() => {
    gameRef.current?.pause(userPaused || settingsOpen);
  }, [userPaused, settingsOpen, hud?.status]);

  useEffect(() => {
    if (hud?.status === "won" && !reportedWin.current) {
      reportedWin.current = true;
      onWin(level.id, hud.stars);
    }
  }, [hud?.status, hud?.stars, level.id, onWin]);

  const restart = () => {
    setUserPaused(false);
    setAttempt((a) => a + 1);
  };
  const activatePower = (id: PowerId) => gameRef.current?.usePower(id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game) return;
      if (e.key >= "1" && e.key <= "3") game.usePower(POWERS[Number(e.key) - 1]);
      else if (e.key === "p" || e.key === "Escape") {
        if (game.status === "playing" || game.status === "paused") setUserPaused((p) => !p);
      } else if (e.key === "r") {
        setUserPaused(false);
        setAttempt((a) => a + 1);
      }
      else if (e.key === "Enter" || e.key === " ") game.start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- mouse as a stand-in hand ---
  const toWorld = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return stageToWorld(((e.clientX - rect.left) / rect.width) * STAGE_W, ((e.clientY - rect.top) / rect.height) * STAGE_H);
  };
  const poseFor = (buttons: number): HandPose => (buttons & 2 ? "fist" : buttons & 1 ? "pinch" : "open");
  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "touch") return;
    const p = toWorld(e);
    const m = mouse.current;
    const now = performance.now();
    if (m.active) {
      const dt = Math.max(0.004, (now - m.t) / 1000);
      m.vx += ((p.x - m.x) / dt - m.vx) * 0.5;
      m.vy += ((p.y - m.y) / dt - m.vy) * 0.5;
    } else {
      m.vx = 0;
      m.vy = 0;
    }
    m.x = p.x;
    m.y = p.y;
    m.t = now;
    m.active = true;
    m.pose = poseFor(e.buttons);
  };
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onPointerMove(e);
  };
  const onPointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    mouse.current.pose = poseFor(e.buttons);
  };
  const onPointerLeave = () => {
    mouse.current.active = false;
  };

  if (!hud) return null;
  const nextLevel = LEVELS.find((l) => l.id === level.id + 1);
  const progress = Math.min(1, hud.score / level.stars[1]);
  const hint = hud.hint >= 0 && hud.status === "playing" ? HINTS[inputMode][hud.hint] : null;
  const goalByCol = new Map(hud.goals.map((g) => [g.col, g]));

  return (
    <>
      {/* chamber */}
      <img className="zg-abs" src={UI.chamber} alt="" style={{ left: -13, top: 163, width: 428 }} />
      <img className="zg-abs" src={UI.chocGrid} alt="" style={{ left: 32, top: 208, width: 340, height: 340, opacity: 0.35, borderRadius: 18 }} />

      {/* basket */}
      <img className="zg-abs" src={UI.basket} alt="" style={{ left: 11, top: 535, width: 377 }} />
      {Array.from({ length: BASKET_COLS }, (_, col) => {
        const g = goalByCol.get(col);
        const style = { left: basketColumnX(col, 600) };
        if (!g) return <div key={col} className="zg-bin empty" style={style} />;
        return (
          <div key={col} className={`zg-bin ${g.left === 0 ? "done" : ""}`} style={{ ...style, background: COLOR_HEX[g.color] }}>
            <img src={candyUrl(g.color)} alt={g.color} />
            <span className="count zg-outline">{g.left === 0 ? "✓" : g.left}</span>
          </div>
        );
      })}

      <canvas
        ref={canvasRef}
        className="zg-abs"
        style={{ left: 0, top: 0, width: STAGE_W, height: STAGE_H, pointerEvents: "auto", touchAction: "none" }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* header */}
      <img className="zg-abs" src={UI.header} alt="" style={{ left: -55, top: -160, width: 513 }} />
      <img className="zg-abs" src={UI.mascot} alt="" style={{ left: 6, top: 30, width: 112 }} />
      <div className="zg-score zg-outline">SCORE : {hud.score}</div>
      <div className="zg-progress">
        <div className="fill" style={{ width: `${progress * 100}%` }} />
        <div className="mark" style={{ left: `${(level.stars[0] / level.stars[1]) * 100}%` }} />
      </div>
      {hud.ticket && <div className="zg-ticket">★ GOLDEN ×2</div>}
      <div className={`zg-time ${hud.timeLeft <= 10 ? "low" : ""}`}>
        <span className="label zg-outline">TIME</span>
        <span className="value zg-outline">{hud.timeLeft}</span>
      </div>
      <button
        className="zg-img-btn"
        style={{ left: 175, top: 127, width: 53, height: 53 }}
        onClick={() => setUserPaused(true)}
        disabled={hud.status !== "playing"}
        aria-label="Pause"
        data-dwell
      >
        <img src={UI.pause} alt="" />
      </button>
      {hud.combo > 1 && <div className="zg-combo">COMBO ×{hud.combo}</div>}

      {hint && (
        <div className="zg-hint" key={hud.hint}>
          {hint[0]}
          <small>{hint[1]}</small>
        </div>
      )}

      {/* footer */}
      <img className="zg-abs" src={UI.footer} alt="" style={{ left: -33, top: 617, width: 468 }} />
      <button className="zg-img-btn" style={{ left: 40, top: 803, width: 60, height: 60 }} onClick={onSettings} aria-label="Settings" data-dwell>
        <img src={UI.settings} alt="" />
      </button>
      {POWERS.map((id, i) => (
        <button
          key={id}
          className="zg-img-btn zg-power"
          style={{ left: 128 + i * 86, top: 800 }}
          onClick={() => activatePower(id)}
          disabled={hud.status !== "playing" || hud.powers[id] === 0}
          aria-label={POWER_INFO[id]}
          title={POWER_INFO[id]}
          data-dwell
        >
          <img src={UI.power[id]} alt="" />
          <span className="badge">{hud.powers[id]}</span>
          <span className="key">{i + 1}</span>
        </button>
      ))}

      {hud.status === "ready" && !settingsOpen && (
        <div className="zg-overlay">
          <div className="zg-panel">
            <h2>
              Box {level.id}: {level.name}
            </h2>
            <p>{level.blurb}</p>
            <div className="zg-goal-row">
              {level.colors.map((c) => (
                <div key={c} className="zg-outline">
                  <img src={candyUrl(c)} alt={c} />×{level.goal}
                </div>
              ))}
            </div>
            <p style={{ marginTop: 0 }}>
              Pop them all in {level.time} seconds.
              <br />
              {inputMode === "hand" ? "Point ☝️ at GO and hold still." : "Press GO or hit Space."}
            </p>
            <div className="row">
              <button className="zg-btn secondary" onClick={onExit} data-dwell>
                ← Boxes
              </button>
              <button className="zg-btn pink" onClick={() => gameRef.current?.start()} data-dwell>
                GO!
              </button>
            </div>
          </div>
        </div>
      )}

      {userPaused && hud.status === "paused" && !settingsOpen && (
        <div className="zg-overlay">
          <div className="zg-panel">
            <h2>Paused</h2>
            <p>Candies are holding their breath.</p>
            <div className="row">
              <button className="zg-btn pink" onClick={() => setUserPaused(false)} data-dwell>
                RESUME
              </button>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="zg-btn secondary" onClick={restart} data-dwell>
                ↻ Restart
              </button>
              <button className="zg-btn secondary" onClick={onExit} data-dwell>
                ← Boxes
              </button>
            </div>
          </div>
        </div>
      )}

      {(hud.status === "won" || hud.status === "lost") && (
        <div className="zg-overlay">
          <div className="zg-popup">
            <img className="bg" src={UI.popupBg} alt="" />
            <div className="stars">
              {[1, 2, 3].map((s) => (
                <img key={s} src={UI.star} alt="" className={s <= hud.stars ? "" : "zg-star-off"} />
              ))}
            </div>
            <button className="zg-img-btn" style={{ right: -12, top: 70, width: 48, height: 48 }} onClick={onExit} aria-label="Close" data-dwell>
              <img src={UI.close} alt="" />
            </button>
            <div className="body">
              <div className="title zg-outline">{hud.status === "won" ? "YOUR SCORE" : "OUT OF TIME!"}</div>
              <div className="big zg-outline">{hud.score}</div>
              <div className="stats">
                <span>
                  TIME BONUS<b>+{hud.timeBonus}</b>
                </span>
                <span>
                  BEST COMBO<b>×{Math.max(1, hud.bestCombo)}</b>
                </span>
              </div>
              {hud.status === "lost" && (
                <div className="msg">
                  So close! Freeze a group ({inputMode === "hand" ? "make a fist ✊" : "hold the right button"}) so it stays together.
                </div>
              )}
              <div className="actions">
                <button className="zg-img-btn" style={{ position: "relative", width: 54, height: 54 }} onClick={restart} aria-label="Retry" data-dwell>
                  <img src={UI.retry} alt="" />
                </button>
                {hud.status === "won" && nextLevel ? (
                  <button
                    className="zg-img-btn"
                    style={{ position: "relative", width: 124, height: 60 }}
                    onClick={() => onPlay(nextLevel.id)}
                    aria-label="Next level"
                    data-dwell
                  >
                    <img src={UI.next} alt="" />
                  </button>
                ) : (
                  <button className="zg-btn" onClick={onExit} data-dwell>
                    BOXES
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
