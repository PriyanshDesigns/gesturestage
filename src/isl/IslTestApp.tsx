import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  classify,
  fingerIssues,
  passes,
  shapeDistance,
  summarizeRun,
  toPose,
  DEFAULT_MATCH_SETTINGS,
  PASS_BAR,
  type FingerIssue,
  type FrameRecord,
  type HandSide,
  type Match,
  type MatchSettings,
  type RunStats,
  type Template,
  type TrackedHand,
} from "./pose";
import { useTwoHandTracking } from "./useTwoHandTracking";
import { downloadFile, loadState, resultsToCsv, saveState, type Contact, type RunResult } from "./storage";

const HOLD_MS = 500;
const COUNTDOWN_MS = 3000;
const MEASURE_MS = 10000;
const SAMPLES_PER_RECORDING = 5;
const SAMPLE_GAP_MS = 400;
const RECORD_TIMEOUT_MS = 10000;

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];
const HAND_COLORS: Record<HandSide, string> = { Right: "#8b7bf7", Left: "#e0a23c" };
const CONTACTS: { value: Contact; label: string }[] = [
  { value: "apart", label: "Hands apart" },
  { value: "touching", label: "Hands touching" },
  { value: "overlapping", label: "Hands overlapping" },
];

interface Recording {
  letter: string;
  handCount: number;
  phase: "countdown" | "capturing";
  startedAt: number;
  captureStartedAt: number;
  nextAt: number;
  captured: Template[];
}

interface Measuring {
  letter: string;
  contact: Contact;
  handCount: number;
  phase: "countdown" | "running";
  startedAt: number;
  runStartedAt: number;
  frames: FrameRecord[];
}

interface Live {
  hands: TrackedHand[];
  match: Match | null;
  heldMs: number;
  targetDistance: number | null;
  issues: FingerIssue[];
}

const EMPTY_LIVE: Live = { hands: [], match: null, heldMs: 0, targetDistance: null, issues: [] };

function drawHands(canvas: HTMLCanvasElement | null, hands: TrackedHand[], aspect: number) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = 960;
  const height = Math.round(width / aspect);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.clearRect(0, 0, width, height);
  for (const hand of hands) {
    const lm = hand.landmarks;
    ctx.strokeStyle = HAND_COLORS[hand.side];
    ctx.lineWidth = 3;
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * width, lm[a].y * height);
      ctx.lineTo(lm[b].x * width, lm[b].y * height);
      ctx.stroke();
    }
    ctx.fillStyle = "#f3f4f8";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function pct(n: number) {
  return `${n.toFixed(0)}%`;
}

function average(results: RunResult[], pick: (s: RunStats) => number) {
  return results.reduce((sum, r) => sum + pick(r.stats), 0) / results.length;
}

export default function IslTestApp() {
  const [initial] = useState(loadState);
  const [dominant, setDominant] = useState<HandSide>(initial?.dominant ?? "Right");
  const [templates, setTemplates] = useState<Template[]>(initial?.templates ?? []);
  const [results, setResults] = useState<RunResult[]>(initial?.results ?? []);
  const [settings, setSettings] = useState<MatchSettings>(DEFAULT_MATCH_SETTINGS);
  const [aspect, setAspect] = useState(4 / 3);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [activity, setActivity] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newLetter, setNewLetter] = useState("");
  const [newHandCount, setNewHandCount] = useState(2);
  const [target, setTarget] = useState("");
  const [testLetter, setTestLetter] = useState("");
  const [testContact, setTestContact] = useState<Contact>("touching");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holdRef = useRef<{ letter: string | null; since: number }>({ letter: null, since: 0 });
  const recordingRef = useRef<Recording | null>(null);
  const measuringRef = useRef<Measuring | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveState({ dominant, templates, results });
  }, [dominant, templates, results]);

  const letters = [...new Set(templates.map((t) => t.letter))].sort();
  const handCountFor = (letter: string) => templates.find((t) => t.letter === letter)?.sides.length ?? 2;

  function handleFrame(hands: TrackedHand[], frameAspect: number, now: number) {
    drawHands(canvasRef.current, hands, frameAspect);
    setAspect((prev) => (Math.abs(prev - frameAspect) > 0.01 ? frameAspect : prev));

    const pose = toPose(hands, dominant, frameAspect);
    const match = pose ? classify(pose, templates, settings) : null;

    if (!match?.accepted || match.accepted !== holdRef.current.letter) {
      holdRef.current = { letter: match?.accepted ?? null, since: now };
    }
    const heldMs = holdRef.current.letter ? now - holdRef.current.since : 0;

    let targetDistance: number | null = null;
    let issues: FingerIssue[] = [];
    if (pose && target) {
      let closest: Template | null = null;
      for (const t of templates) {
        if (t.letter !== target || t.points.length !== pose.points.length) continue;
        const d = shapeDistance(pose.points, t.points);
        if (targetDistance === null || d < targetDistance) {
          targetDistance = d;
          closest = t;
        }
      }
      if (closest && match?.accepted !== target) issues = fingerIssues(pose, closest).slice(0, 2);
    }

    const rec = recordingRef.current;
    if (rec) {
      if (rec.phase === "countdown") {
        const left = COUNTDOWN_MS - (now - rec.startedAt);
        if (left <= 0) {
          rec.phase = "capturing";
          rec.captureStartedAt = now;
          rec.nextAt = now;
        }
        setActivity(`Form ${rec.letter}… recording in ${Math.max(1, Math.ceil(left / 1000))}`);
      } else {
        if (now >= rec.nextAt && pose && pose.sides.length === rec.handCount) {
          rec.captured.push({ id: crypto.randomUUID(), letter: rec.letter, sides: pose.sides, points: pose.points });
          rec.nextAt = now + SAMPLE_GAP_MS;
        }
        const done = rec.captured.length >= SAMPLES_PER_RECORDING;
        if (done || now - rec.captureStartedAt > RECORD_TIMEOUT_MS) {
          recordingRef.current = null;
          const captured = rec.captured;
          setTemplates((prev) => [...prev, ...captured]);
          setActivity(null);
          setNotice(
            done
              ? `Saved ${captured.length} samples for ${rec.letter}.`
              : `Only caught ${captured.length} of ${SAMPLES_PER_RECORDING} samples for ${rec.letter} — ${
                  rec.handCount === 2 ? "both hands weren't" : "the hand wasn't"
                } visible long enough.`
          );
        } else {
          setActivity(`Recording ${rec.letter}: hold still… ${rec.captured.length}/${SAMPLES_PER_RECORDING}`);
        }
      }
    }

    const run = measuringRef.current;
    if (run) {
      if (run.phase === "countdown") {
        const left = COUNTDOWN_MS - (now - run.startedAt);
        if (left <= 0) {
          run.phase = "running";
          run.runStartedAt = now;
        }
        setActivity(`Form ${run.letter} and hold it… starting in ${Math.max(1, Math.ceil(left / 1000))}`);
      } else {
        run.frames.push({
          handsDetected: hands.length,
          meanScore: hands.length ? hands.reduce((s, h) => s + h.score, 0) / hands.length : 0,
          predicted: match?.accepted ?? null,
          points: pose?.points ?? null,
        });
        const elapsed = now - run.runStartedAt;
        if (elapsed >= MEASURE_MS) {
          measuringRef.current = null;
          const stats = summarizeRun(run.frames, run.letter, run.handCount, elapsed);
          const result: RunResult = {
            id: crypto.randomUUID(),
            letter: run.letter,
            contact: run.contact,
            handCount: run.handCount,
            stats,
            at: Date.now(),
          };
          setResults((prev) => [result, ...prev]);
          setActivity(null);
          setNotice(`${run.letter}: ${passes(stats) ? "passed" : "did not pass"} — see the results table.`);
        } else {
          setActivity(`Measuring ${run.letter} — keep holding, ${Math.ceil((MEASURE_MS - elapsed) / 1000)}s left`);
        }
      }
    }

    setLive({ hands, match, heldMs, targetDistance, issues });
  }

  const { videoRef, status, error } = useTwoHandTracking(handleFrame);
  const ready = status === "ready";
  const busy = activity !== null;

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  function startRecording() {
    const letter = newLetter.trim().toUpperCase();
    if (!letter) return;
    recordingRef.current = {
      letter,
      handCount: newHandCount,
      phase: "countdown",
      startedAt: performance.now(),
      captureStartedAt: 0,
      nextAt: 0,
      captured: [],
    };
    setActivity(`Form ${letter}…`);
  }

  function startMeasuring() {
    if (!testLetter) return;
    measuringRef.current = {
      letter: testLetter,
      contact: testContact,
      handCount: handCountFor(testLetter),
      phase: "countdown",
      startedAt: performance.now(),
      runStartedAt: 0,
      frames: [],
    };
    setActivity(`Form ${testLetter}…`);
  }

  async function importTemplates(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const list = (Array.isArray(parsed) ? parsed : (parsed as { templates?: unknown }).templates) as Template[] | undefined;
      const valid = (list ?? []).filter(
        (t) => typeof t?.letter === "string" && Array.isArray(t.points) && Array.isArray(t.sides) && t.points.length === t.sides.length * 21
      );
      if (!valid.length) throw new Error("no templates");
      setTemplates((prev) => [...prev, ...valid.map((t) => ({ ...t, id: crypto.randomUUID() }))]);
      setNotice(`Imported ${valid.length} samples.`);
    } catch {
      setNotice("That file doesn't contain templates from this tool.");
    }
  }

  const accepted = live.match?.accepted ?? null;
  const held = accepted !== null && live.heldMs >= HOLD_MS;
  const contactSummary = CONTACTS.map((c) => ({ ...c, runs: results.filter((r) => r.contact === c.value) })).filter(
    (c) => c.runs.length > 0
  );

  return (
    <div className="isl-app">
      <section className="isl-stage-col">
        <header className="isl-header">
          <p className="isl-eyebrow">ISHAARA · FEASIBILITY TEST</p>
          <h1>Can a laptop webcam read two-handed ISL letters?</h1>
          <p className="muted">
            Record a few letters, then measure how reliably they're tracked and recognised — especially when your hands
            touch or overlap. Video never leaves this device.
          </p>
        </header>

        <div className="isl-stage" style={{ aspectRatio: String(aspect) }}>
          <video ref={videoRef} muted playsInline />
          <canvas ref={canvasRef} />
          {status === "starting" && <div className="isl-overlay">Starting camera and hand tracking…</div>}
          {status === "error" && (
            <div className="isl-overlay isl-overlay-error">
              Camera unavailable: {error}. Allow camera access and reload.
            </div>
          )}
          {activity && <div className="isl-overlay isl-overlay-activity">{activity}</div>}
        </div>

        <div className="isl-statusbar">
          <span className="pill">
            <span className="dot" style={{ background: live.hands.length === 2 ? "var(--good)" : "var(--warn)" }} />
            {live.hands.length} {live.hands.length === 1 ? "hand" : "hands"} detected
          </span>
          {live.hands.map((h, i) => (
            <span className="pill" key={i}>
              <span className="dot" style={{ background: HAND_COLORS[h.side] }} />
              {h.side} {h.score.toFixed(2)}
            </span>
          ))}
          {notice && <span className="isl-notice">{notice}</span>}
        </div>
      </section>

      <aside className="isl-panel-col">
        <div className="card isl-card">
          <h2>1 · Record letters</h2>
          <p className="muted isl-small">
            Use an ISL chart, or better, a fluent ISL signer: whatever you record becomes the reference shape.
          </p>
          <div className="isl-row">
            <span className="isl-label">Dominant hand</span>
            <div className="isl-segment">
              {(["Right", "Left"] as HandSide[]).map((side) => (
                <button
                  key={side}
                  className={side === dominant ? "active" : ""}
                  onClick={() => setDominant(side)}
                  disabled={busy || templates.length > 0}
                  title={templates.length > 0 ? "Clear templates before switching hands" : undefined}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>
          <div className="isl-row">
            <input
              className="isl-input"
              placeholder="Letter, e.g. A"
              maxLength={3}
              value={newLetter}
              onChange={(e) => setNewLetter(e.target.value.toUpperCase())}
            />
            <select className="isl-input" value={newHandCount} onChange={(e) => setNewHandCount(Number(e.target.value))}>
              <option value={2}>Two hands</option>
              <option value={1}>One hand</option>
            </select>
          </div>
          <button className="btn btn-primary isl-full" onClick={startRecording} disabled={!ready || busy || !newLetter.trim()}>
            Record {SAMPLES_PER_RECORDING} samples
          </button>

          {letters.length > 0 && (
            <div className="isl-chips">
              {letters.map((l) => (
                <span className="isl-chip" key={l}>
                  {l} ×{templates.filter((t) => t.letter === l).length}
                  <button
                    aria-label={`Delete ${l}`}
                    onClick={() => setTemplates((prev) => prev.filter((t) => t.letter !== l))}
                    disabled={busy}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="isl-row isl-actions">
            <button
              className="btn"
              disabled={!templates.length}
              onClick={() =>
                downloadFile("ishaara-templates.json", JSON.stringify({ dominant, templates }, null, 2), "application/json")
              }
            >
              Export
            </button>
            <button className="btn" onClick={() => importRef.current?.click()} disabled={busy}>
              Import
            </button>
            <input ref={importRef} type="file" accept="application/json" hidden onChange={importTemplates} />
          </div>
        </div>

        <div className="card isl-card">
          <h2>2 · Live check</h2>
          <div className="isl-live">
            <div className={`isl-letter ${held ? "held" : ""}`}>{accepted ?? "—"}</div>
            <div className="isl-live-detail">
              <div className="isl-progress">
                <div style={{ width: `${Math.min(100, (live.heldMs / HOLD_MS) * 100)}%` }} />
              </div>
              <p className="isl-small muted">
                {live.match?.best
                  ? `Closest: ${live.match.best.letter} (${live.match.best.distance.toFixed(2)})${
                      live.match.runnerUp ? ` · next: ${live.match.runnerUp.letter} (${live.match.runnerUp.distance.toFixed(2)})` : ""
                    }`
                  : letters.length
                    ? "Show your hands to the camera."
                    : "Record a letter first."}
              </p>
            </div>
          </div>

          <div className="isl-row">
            <span className="isl-label">Practise</span>
            <select className="isl-input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">No target</option>
              {letters.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          {target && (
            <div className="isl-hints">
              {accepted === target && held ? (
                <p className="isl-good">Correct — that's {target}.</p>
              ) : live.issues.length ? (
                live.issues.map((issue) => (
                  <p key={`${issue.side}-${issue.finger}`}>
                    {issue.side} {issue.finger}: {issue.advice}
                  </p>
                ))
              ) : (
                <p className="muted">Show the same number of hands as the recording.</p>
              )}
              {live.targetDistance !== null && (
                <p className="isl-small muted">Distance to {target}: {live.targetDistance.toFixed(2)}</p>
              )}
            </div>
          )}

          <label className="isl-slider">
            <span>
              Accept below <strong>{settings.threshold.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0.1}
              max={0.6}
              step={0.01}
              value={settings.threshold}
              onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })}
            />
          </label>
          <label className="isl-slider">
            <span>
              Margin over runner-up <strong>{settings.minMargin.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={settings.minMargin}
              onChange={(e) => setSettings({ ...settings, minMargin: Number(e.target.value) })}
            />
          </label>
        </div>

        <div className="card isl-card">
          <h2>3 · Measure</h2>
          <p className="muted isl-small">
            Hold one letter for 10 seconds. Pass = both hands tracked ≥{PASS_BAR.expectedHandsPct}% of frames, recognised
            ≥{PASS_BAR.recognizedPct}%, wrong &lt;{PASS_BAR.wrongPctMax}%.
          </p>
          <div className="isl-row">
            <select className="isl-input" value={testLetter} onChange={(e) => setTestLetter(e.target.value)}>
              <option value="">Letter…</option>
              {letters.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <select className="isl-input" value={testContact} onChange={(e) => setTestContact(e.target.value as Contact)}>
              {CONTACTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary isl-full" onClick={startMeasuring} disabled={!ready || busy || !testLetter}>
            Run 10-second test
          </button>

          {contactSummary.length > 0 && (
            <div className="isl-summary">
              {contactSummary.map((c) => {
                const tracked = average(c.runs, (s) => s.expectedHandsPct);
                const recognised = average(c.runs, (s) => s.recognizedPct);
                const wrong = average(c.runs, (s) => s.wrongPct);
                const ok = tracked >= PASS_BAR.expectedHandsPct && recognised >= PASS_BAR.recognizedPct && wrong < PASS_BAR.wrongPctMax;
                return (
                  <div key={c.value} className="isl-summary-row">
                    <span>{c.label}</span>
                    <span className="muted isl-small">
                      tracked {pct(tracked)} · recognised {pct(recognised)} · wrong {pct(wrong)}
                    </span>
                    <span className={`isl-verdict ${ok ? "pass" : "fail"}`}>{ok ? "Pass" : "Fail"}</span>
                  </div>
                );
              })}
            </div>
          )}

          {results.length > 0 && (
            <>
              <table className="isl-table">
                <thead>
                  <tr>
                    <th>Letter</th>
                    <th>Contact</th>
                    <th>Tracked</th>
                    <th>Jitter</th>
                    <th>Right</th>
                    <th>Wrong</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.letter}</td>
                      <td>{r.contact}</td>
                      <td>{pct(r.stats.expectedHandsPct)}</td>
                      <td>{r.stats.jitterPct.toFixed(1)}%</td>
                      <td>{pct(r.stats.recognizedPct)}</td>
                      <td>{pct(r.stats.wrongPct)}</td>
                      <td>
                        <span className={`isl-verdict ${passes(r.stats) ? "pass" : "fail"}`}>{passes(r.stats) ? "Pass" : "Fail"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="isl-row isl-actions">
                <button className="btn" onClick={() => downloadFile("ishaara-results.csv", resultsToCsv(results), "text/csv")}>
                  Download CSV
                </button>
                <button className="btn" onClick={() => setResults([])} disabled={busy}>
                  Clear results
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
