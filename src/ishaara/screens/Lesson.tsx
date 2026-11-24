import { useEffect, useRef, useState } from "react";
import type { HandSide } from "../../isl/pose";
import { CameraStage, ReferenceCard } from "../components/Coach";
import { handsFor, type References } from "../references";
import { go } from "../router";
import type { Attempt } from "../store";
import { clock } from "../letters";
import { StrictnessPicker } from "../components/StrictnessPicker";
import { useDiagnostics } from "../diagnostics";
import { useCoach, type Strictness } from "../useCoach";

const CELEBRATE_MS = 1100;

interface Props {
  title: string;
  letters: string[];
  refs: References;
  dominant: HandSide;
  onAttempt: (letter: string, attempt: Attempt) => void;
  strictness: Strictness;
  onStrictness: (s: Strictness) => void;
}

interface Result {
  letter: string;
  ms: number;
  skipped: boolean;
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function Lesson({ title, letters, refs, dominant, onAttempt, strictness, onStrictness }: Props) {
  const playable = letters.filter((l) => refs.byLetter.has(l));
  const [index, setIndex] = useState(0);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [ghost, setGhost] = useState(true);
  const startedAt = useRef(0);

  const letter = index < playable.length ? playable[index] : null;
  const done = letter === null;

  function finish(skipped: boolean) {
    if (!letter) return;
    const ms = clock() - startedAt.current;
    onAttempt(letter, { correct: !skipped, assisted: true, ms });
    setResults((prev) => [...prev, { letter, ms, skipped }]);
    if (skipped) {
      setIndex((i) => i + 1);
      return;
    }
    setCelebrate(letter);
    setTimeout(() => {
      setCelebrate(null);
      setIndex((i) => i + 1);
    }, CELEBRATE_MS);
  }

  const [diagnostics, setDiagnostics] = useDiagnostics();
  const coach = useCoach({
    refs,
    dominant,
    strictness,
    target: celebrate ? null : letter,
    showGhost: ghost,
    onCorrect: () => finish(false),
  });

  // Time each letter from when the camera can actually see it.
  useEffect(() => {
    if (coach.status === "ready") startedAt.current = clock();
  }, [index, coach.status]);

  if (!playable.length) {
    return (
      <main className="ish-page ish-narrow">
        <h1 className="ish-title">No reference signs for this lesson yet</h1>
        <button className="ish-btn" onClick={() => go("teach")}>
          Add reference signs
        </button>
      </main>
    );
  }

  if (done) {
    const learned = results.filter((r) => !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    return (
      <main className="ish-page ish-narrow">
        <p className="ish-eyebrow">{title} · done</p>
        <h1 className="ish-display">
          {learned.length === results.length ? "Every letter, signed." : `${learned.length} of ${results.length} letters signed.`}
        </h1>
        <ul className="ish-results">
          {results.map((r, i) => (
            <li key={i}>
              <span className={`ish-tile ${r.skipped ? "st-new" : "st-learning"}`}>{r.letter}</span>
              <span>{r.skipped ? "Skipped — it'll come back in practice" : `Held correctly after ${seconds(r.ms)}`}</span>
            </li>
          ))}
        </ul>
        <p className="ish-dim">
          These letters now come back in Practice, without the dotted guide, at growing intervals.
          {skipped.length ? " Skipped ones come back first." : ""}
        </p>
        <div className="ish-row">
          <button className="ish-btn ish-btn-primary" onClick={() => go("practice")}>
            Practise from memory
          </button>
          <button className="ish-btn" onClick={() => go("home")}>
            Back to lessons
          </button>
        </div>
      </main>
    );
  }

  const hands = handsFor(refs, letter);
  return (
    <main className="ish-page ish-learn">
      <header className="ish-learn-head" style={{ ["--progress" as string]: index / playable.length }}>
        <button className="ish-link" onClick={() => go("home")}>
          ← Lessons
        </button>
        <div className="ish-tiles" aria-label={`Letter ${index + 1} of ${playable.length}`}>
          {playable.map((l, i) => (
            <span key={l} className={`ish-tile ish-tile-sm ${i < index ? "st-learning" : i === index ? "st-current" : "st-new"}`}>
              {l}
            </span>
          ))}
        </div>
        <span className="ish-small ish-dim">{title}</span>
      </header>

      <div className="ish-learn-grid">
        <aside className="ish-learn-side">
          <p className="ish-eyebrow">Letter {index + 1} of {playable.length}</p>
          <div className="ish-letter-row">
            <h1 className="ish-letter-xl">{letter}</h1>
            <span className="ish-chip">{hands === 2 ? "Both hands" : `${dominant} hand only`}</span>
          </div>
          <ReferenceCard letter={letter} template={refs.display.get(letter) ?? null} dominant={dominant} video={refs.videos[letter]} />
          <ol className="ish-howto">
            <li>Copy the shape — your hands appear in colour.</li>
            <li>Line up with the dotted guide on the camera.</li>
            <li>Hold still until the ring fills.</li>
          </ol>
        </aside>

        <section className="ish-learn-main">
          <CameraStage {...coach} celebrate={celebrate} diagnostics={diagnostics} />
          <div className="ish-toolbar">
            <label className="ish-toggle">
              <input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} />
              <span>Dotted guide</span>
            </label>
            <label className="ish-toggle ish-toggle-quiet">
              <input type="checkbox" checked={diagnostics} onChange={(e) => setDiagnostics(e.target.checked)} />
              <span>What it sees</span>
            </label>
            <StrictnessPicker value={strictness} onChange={onStrictness} />
            <button className="ish-btn" onClick={() => finish(true)} disabled={!!celebrate}>
              Skip {letter}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
