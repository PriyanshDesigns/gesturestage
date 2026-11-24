import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toPose, type HandSide, type Template, type TrackedHand } from "../../isl/pose";
import { downloadFile } from "../../isl/storage";
import { useTwoHandTracking } from "../../isl/useTwoHandTracking";
import { ReferenceCard } from "../components/Coach";
import { drawStage, readPalette, type HandPalette } from "../draw";
import { ALPHABET, parseRefSet, type References } from "../references";
import { loadTestPageTemplates, type RefSet } from "../store";

const COUNTDOWN_MS = 3000;
const SAMPLES = 5;
const SAMPLE_GAP_MS = 400;
const TIMEOUT_MS = 10000;

interface Recording {
  letter: string;
  hands: number;
  phase: "countdown" | "capturing";
  startedAt: number;
  captureAt: number;
  nextAt: number;
  captured: Template[];
}

interface Props {
  refs: References;
  bundledCount: number;
  local: RefSet | null;
  learnerDominant: HandSide;
  onChange: (set: RefSet | null) => void;
}

export function Teach({ refs, bundledCount, local, learnerDominant, onChange }: Props) {
  const [signer, setSigner] = useState(local?.signer ?? "");
  const [signerHand, setSignerHand] = useState<HandSide>(local?.dominant ?? learnerDominant);
  const [selected, setSelected] = useState(() => ALPHABET.find((l) => !refs.byLetter.has(l)) ?? "A");
  const [handCount, setHandCount] = useState(2);
  const [activity, setActivity] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [handsSeen, setHandsSeen] = useState(0);
  const [aspect, setAspect] = useState(16 / 9);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recRef = useRef<Recording | null>(null);
  const paletteRef = useRef<HandPalette | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef({ local, signer, signerHand, onChange });
  useEffect(() => {
    stateRef.current = { local, signer, signerHand, onChange };
  });

  const localTemplates = local?.templates ?? [];
  const localCount = (l: string) => localTemplates.filter((t) => t.letter === l).length;
  const testSet = loadTestPageTemplates();

  function save(templates: Template[], hand = signerHand, name = signer) {
    onChange(templates.length ? { version: 1, dominant: hand, signer: name.trim() || undefined, templates, videos: local?.videos } : null);
  }

  function handleFrame(hands: TrackedHand[], frameAspect: number, now: number) {
    paletteRef.current ??= readPalette(canvasRef.current);
    const { signerHand: hand } = stateRef.current;
    drawStage(canvasRef.current, hands, frameAspect, hand, null, paletteRef.current);
    setAspect((prev) => (Math.abs(prev - frameAspect) > 0.01 ? frameAspect : prev));
    setHandsSeen(hands.length);

    const rec = recRef.current;
    if (!rec) return;
    if (rec.phase === "countdown") {
      const left = COUNTDOWN_MS - (now - rec.startedAt);
      if (left <= 0) {
        rec.phase = "capturing";
        rec.captureAt = now;
        rec.nextAt = now;
      }
      setActivity(`Form ${rec.letter} · recording in ${Math.max(1, Math.ceil(left / 1000))}`);
      return;
    }
    const pose = toPose(hands, hand, frameAspect);
    if (now >= rec.nextAt && pose && pose.sides.length === rec.hands) {
      rec.captured.push({ id: crypto.randomUUID(), letter: rec.letter, sides: pose.sides, points: pose.points });
      rec.nextAt = now + SAMPLE_GAP_MS;
    }
    const done = rec.captured.length >= SAMPLES;
    if (!done && now - rec.captureAt <= TIMEOUT_MS) {
      setActivity(`Hold ${rec.letter} still · ${rec.captured.length}/${SAMPLES}`);
      return;
    }
    recRef.current = null;
    setActivity(null);
    const s = stateRef.current;
    const kept = (s.local?.templates ?? []).filter((t) => t.letter !== rec.letter);
    if (rec.captured.length) {
      const templates = [...kept, ...rec.captured];
      s.onChange({ version: 1, dominant: s.signerHand, signer: s.signer.trim() || undefined, templates, videos: s.local?.videos });
    }
    setNotice(
      done
        ? `Saved ${rec.letter}.`
        : `Caught ${rec.captured.length} of ${SAMPLES} samples for ${rec.letter} — ${rec.hands === 2 ? "both hands weren't" : "the hand wasn't"} in view long enough.`
    );
    if (done) {
      const after = ALPHABET.slice(ALPHABET.indexOf(rec.letter) + 1).find((l) => !refs.byLetter.has(l));
      if (after) setSelected(after);
    }
  }

  const { videoRef, status, error } = useTwoHandTracking(handleFrame);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  function record() {
    recRef.current = { letter: selected, hands: handCount, phase: "countdown", startedAt: performance.now(), captureAt: 0, nextAt: 0, captured: [] };
    setActivity(`Form ${selected}…`);
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const set = parseRefSet(JSON.parse(await file.text()));
      if (!set) throw new Error("empty");
      adopt(set);
    } catch {
      setNotice("That file doesn't contain reference signs.");
    }
  }

  function adopt(set: RefSet) {
    if (localTemplates.length && set.dominant !== signerHand) {
      setNotice(`That set was recorded ${set.dominant.toLowerCase()}-handed; clear your recordings first to switch.`);
      return;
    }
    const letters = new Set(set.templates.map((t) => t.letter));
    const kept = localTemplates.filter((t) => !letters.has(t.letter));
    setSignerHand(set.dominant);
    if (set.signer) setSigner(set.signer);
    save([...kept, ...set.templates.map((t) => ({ ...t, id: crypto.randomUUID() }))], set.dominant, set.signer ?? signer);
    setNotice(`Added ${letters.size} ${letters.size === 1 ? "letter" : "letters"}.`);
  }

  const busy = activity !== null;
  const selectedHasRef = refs.byLetter.has(selected);

  return (
    <main className="ish-page">
      <header className="ish-hello">
        <p className="ish-eyebrow">Reference signs</p>
        <h1 className="ish-display">Every lesson is checked against these.</h1>
        <p className="ish-lead">
          Record each letter as a fluent ISL signer forms it — ideally a Deaf signer, credited by name. Ishaara compares
          learners' hands to these shapes and mirrors them for left-handers.
        </p>
      </header>

      {refs.credits.length > 0 && (
        <section className="ish-credit" aria-label="Reference sign sources">
          {refs.credits.map((c) => (
            <p key={c.text}>
              {c.text}{" "}
              {c.url && (
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </p>
          ))}
        </section>
      )}

      <div className="ish-teach-grid">
        <section className="ish-teach-main">
          <div className="ish-stage tone-idle" style={{ aspectRatio: String(aspect) }}>
            <video ref={videoRef} muted playsInline />
            <canvas ref={canvasRef} />
            {status === "starting" && <div className="ish-stage-msg">Starting your camera…</div>}
            {status === "error" && (
              <div className="ish-stage-msg is-error">
                <strong>The camera didn't start.</strong>
                <span>{error}</span>
              </div>
            )}
            {activity && <div className="ish-hint is-activity">{activity}</div>}
          </div>
          <div className="ish-row ish-row-split">
            <span className="ish-small ish-dim">
              {handsSeen} {handsSeen === 1 ? "hand" : "hands"} in view
            </span>
            {notice && <span className="ish-small ish-notice">{notice}</span>}
          </div>

          <div className="ish-card">
            <div className="ish-section-head">
              <h2 className="ish-title-sm">Alphabet</h2>
              <span className="ish-small ish-dim">
                {refs.letters.length}/26 have a reference{bundledCount ? ` · ${bundledCount} shipped with this copy` : ""}
              </span>
            </div>
            <div className="ish-teach-letters">
              {ALPHABET.map((l) => (
                <button
                  key={l}
                  className={`ish-tile ish-tile-btn ${refs.byLetter.has(l) ? "st-mastered" : "st-missing"} ${selected === l ? "is-selected" : ""}`}
                  onClick={() => setSelected(l)}
                  disabled={busy}
                  aria-pressed={selected === l}
                  title={localCount(l) ? `${localCount(l)} samples recorded here` : refs.byLetter.has(l) ? "Shipped reference" : "No reference yet"}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="ish-teach-side">
          <div className="ish-card">
            <p className="ish-eyebrow">Letter</p>
            <h2 className="ish-letter-xl">{selected}</h2>
            {selectedHasRef && (
              <ReferenceCard
                letter={selected}
                template={refs.display.get(selected) ?? null}
                dominant={learnerDominant}
                caption={refs.localLetters.has(selected) ? `Recorded here · ${localCount(selected)} samples` : "Shipped with this copy"}
              />
            )}
            <div className="ish-field">
              <span className="ish-label">Hands used</span>
              <div className="ish-segment">
                {[2, 1].map((n) => (
                  <button key={n} className={handCount === n ? "on" : ""} onClick={() => setHandCount(n)} disabled={busy}>
                    {n === 2 ? "Both" : "One"}
                  </button>
                ))}
              </div>
            </div>
            <button className="ish-btn ish-btn-primary ish-full" onClick={record} disabled={status !== "ready" || busy}>
              {selectedHasRef ? `Re-record ${selected}` : `Record ${selected}`}
            </button>
            <p className="ish-small ish-dim">
              3-second countdown, then hold the shape while {SAMPLES} samples are taken. For letters that move, record the
              final position.
            </p>
            {localCount(selected) > 0 && (
              <button className="ish-link" disabled={busy} onClick={() => save(localTemplates.filter((t) => t.letter !== selected))}>
                Delete my recording of {selected}
              </button>
            )}
          </div>

          <div className="ish-card">
            <label className="ish-field">
              <span className="ish-label">Signer, for the credit</span>
              <input
                className="ish-input"
                placeholder="Name of the signer"
                value={signer}
                onChange={(e) => setSigner(e.target.value)}
                onBlur={() => localTemplates.length && save(localTemplates)}
              />
            </label>
            <div className="ish-field">
              <span className="ish-label">Signer's dominant hand</span>
              <div className="ish-segment">
                {(["Right", "Left"] as HandSide[]).map((side) => (
                  <button
                    key={side}
                    className={signerHand === side ? "on" : ""}
                    disabled={busy || localTemplates.length > 0}
                    title={localTemplates.length ? "Clear recordings before switching" : undefined}
                    onClick={() => setSignerHand(side)}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ish-card ish-stack">
            <h2 className="ish-title-sm">Share or ship</h2>
            <p className="ish-small ish-dim">
              Export a file to send to someone else. To ship these to every learner, save it in the code as{" "}
              <code>public/ishaara/templates.json</code>.
            </p>
            <div className="ish-row">
              <button
                className="ish-btn"
                disabled={!localTemplates.length}
                onClick={() => local && downloadFile("ishaara-templates.json", JSON.stringify(local, null, 1), "application/json")}
              >
                Export
              </button>
              <button className="ish-btn" disabled={busy} onClick={() => importRef.current?.click()}>
                Import
              </button>
              <input ref={importRef} type="file" accept="application/json" hidden onChange={importFile} />
            </div>
            {testSet && (
              <button className="ish-btn" disabled={busy} onClick={() => adopt(testSet)}>
                Use the {new Set(testSet.templates.map((t) => t.letter)).size} letters from the feasibility test
              </button>
            )}
            {localTemplates.length > 0 && (
              <button
                className="ish-link"
                disabled={busy}
                onClick={() => confirm("Delete every reference recorded on this device?") && onChange(null)}
              >
                Clear my recordings
              </button>
            )}
            <a className="ish-link" href="/isl-test.html">
              Open the feasibility test →
            </a>
          </div>
        </aside>
      </div>
    </main>
  );
}
