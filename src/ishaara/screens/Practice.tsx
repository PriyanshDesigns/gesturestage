import { useEffect, useRef, useState } from "react";
import type { HandSide } from "../../isl/pose";
import { CameraStage, ReferenceCard } from "../components/Coach";
import type { References } from "../references";
import { go } from "../router";
import { pickPractice, type Attempt, type LetterProgress } from "../store";
import { clock } from "../letters";
import { useCoach } from "../useCoach";

const SESSION_SIZE = 8;
const BETWEEN_MS = 800;

interface Props {
  refs: References;
  progress: Record<string, LetterProgress>;
  dominant: HandSide;
  onAttempt: (letter: string, attempt: Attempt) => void;
  onSessionDone: () => void;
}

interface Result {
  letter: string;
  ms: number;
  correct: boolean;
  assisted: boolean;
}

export function Practice({ refs, progress, dominant, onAttempt, onSessionDone }: Props) {
  const [queue, setQueue] = useState(() => pickPractice(progress, refs.letters, SESSION_SIZE));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const startedAt = useRef(0);

  const letter = index < queue.length ? queue[index] : null;

  function next(correct: boolean) {
    if (!letter) return;
    const ms = clock() - startedAt.current;
    const attempt = { correct, assisted: revealed, ms };
    onAttempt(letter, attempt);
    setResults((prev) => [...prev, { letter, ...attempt }]);
    setRevealed(false);
    const advance = () => {
      setFlash(null);
      if (index + 1 >= queue.length) onSessionDone();
      setIndex(index + 1);
    };
    if (!correct) return advance();
    setFlash(letter);
    setTimeout(advance, BETWEEN_MS);
  }

  const coach = useCoach({
    refs,
    dominant,
    target: flash ? null : letter,
    showGhost: revealed,
    attempt: index,
    onCorrect: () => next(true),
  });

  useEffect(() => {
    if (coach.status === "ready") startedAt.current = clock();
  }, [index, coach.status]);

  if (!queue.length) {
    return (
      <main className="ish-page ish-narrow">
        <h1 className="ish-title">Learn a few letters first</h1>
        <p className="ish-lead">Practice brings back letters you've already met, from memory.</p>
        <button className="ish-btn ish-btn-primary" onClick={() => go("home")}>
          Go to lessons
        </button>
      </main>
    );
  }

  if (!letter) {
    const clean = results.filter((r) => r.correct && !r.assisted);
    const struggled = [...new Set(results.filter((r) => !r.correct || r.assisted).map((r) => r.letter))];
    const avg = clean.length ? clean.reduce((s, r) => s + r.ms, 0) / clean.length : 0;
    return (
      <main className="ish-page ish-narrow">
        <p className="ish-eyebrow">Practice · done</p>
        <h1 className="ish-display">
          {clean.length} of {results.length} from memory.
        </h1>
        {clean.length > 0 && <p className="ish-lead">Average {(avg / 1000).toFixed(1)}s to the right shape.</p>}
        <ul className="ish-results">
          {results.map((r, i) => (
            <li key={i}>
              <span className={`ish-tile ${r.correct && !r.assisted ? "st-mastered" : r.correct ? "st-learning" : "st-new"}`}>{r.letter}</span>
              <span>
                {!r.correct ? "Skipped — back sooner" : r.assisted ? `With the guide, ${(r.ms / 1000).toFixed(1)}s` : `From memory, ${(r.ms / 1000).toFixed(1)}s`}
              </span>
            </li>
          ))}
        </ul>
        {struggled.length > 0 && <p className="ish-dim">{struggled.join(", ")} will come back sooner than the rest.</p>}
        <div className="ish-row">
          <button
            className="ish-btn ish-btn-primary"
            onClick={() => {
              setQueue(pickPractice(progress, refs.letters, SESSION_SIZE));
              setIndex(0);
              setResults([]);
            }}
          >
            Another round
          </button>
          <button className="ish-btn" onClick={() => go("home")}>
            Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="ish-page ish-learn">
      <header className="ish-learn-head">
        <button className="ish-link" onClick={() => go("home")}>
          ← Home
        </button>
        <div className="ish-dots" aria-label={`${index + 1} of ${queue.length}`}>
          {queue.map((_, i) => (
            <span key={i} className={i < index ? "done" : i === index ? "now" : ""} />
          ))}
        </div>
        <span className="ish-small ish-dim">Practice</span>
      </header>
      <div className="ish-learn-grid">
        <aside className="ish-learn-side">
          <p className="ish-eyebrow">Sign this letter</p>
          <h1 className="ish-letter-xl">{letter}</h1>
          <ReferenceCard
            letter={letter}
            template={refs.display.get(letter) ?? null}
            dominant={dominant}
            video={refs.videos[letter]}
            hidden={!revealed}
            onReveal={() => setRevealed(true)}
          />
        </aside>
        <section className="ish-learn-main">
          <CameraStage {...coach} celebrate={flash} />
          <div className="ish-row ish-row-split">
            <span className="ish-small ish-dim">{revealed ? "Guide on — counts as assisted." : "From memory moves a letter up."}</span>
            <button className="ish-btn" onClick={() => next(false)} disabled={!!flash}>
              Skip {letter}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
