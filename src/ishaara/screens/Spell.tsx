import { useEffect, useRef, useState } from "react";
import type { HandSide } from "../../isl/pose";
import { CameraStage, ReferenceCard } from "../components/Coach";
import type { References } from "../references";
import { go } from "../router";
import type { Attempt } from "../store";
import { StrictnessPicker } from "../components/StrictnessPicker";
import { useCoach, type Strictness } from "../useCoach";
import { clock, nameLetters } from "../letters";

const BETWEEN_MS = 600;

interface Props {
  name: string;
  refs: References;
  dominant: HandSide;
  onAttempt: (letter: string, attempt: Attempt) => void;
  strictness: Strictness;
  onStrictness: (s: Strictness) => void;
}

export function Spell({ name, refs, dominant, onAttempt, strictness, onStrictness }: Props) {
  const [draft, setDraft] = useState(name);
  const [word, setWord] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [totalMs, setTotalMs] = useState(0);
  const letterStart = useRef(0);
  const wordStart = useRef(0);

  const playable = (word ?? []).filter((l) => refs.byLetter.has(l));
  const letter = word && index < playable.length ? playable[index] : null;
  const finished = word !== null && letter === null;

  function next(correct: boolean) {
    if (!letter) return;
    const now = clock();
    onAttempt(letter, { correct, assisted: revealed, ms: now - letterStart.current });
    setRevealed(false);
    const advance = () => {
      setFlash(null);
      if (index + 1 >= playable.length) setTotalMs(clock() - wordStart.current);
      setIndex(index + 1);
    };
    if (!correct) return advance();
    setFlash(letter);
    setTimeout(advance, BETWEEN_MS);
  }

  const coach = useCoach({
    refs,
    dominant,
    strictness,
    target: flash || finished ? null : letter,
    showGhost: revealed,
    attempt: index,
    onCorrect: () => next(true),
  });

  useEffect(() => {
    if (coach.status !== "ready" || !word) return;
    letterStart.current = clock();
    if (index === 0) wordStart.current = letterStart.current;
  }, [index, coach.status, word]);

  function start(letters: string[]) {
    setWord(letters);
    setIndex(0);
    setRevealed(false);
    setTotalMs(0);
  }

  const draftLetters = nameLetters(draft);
  const missing = [...new Set(draftLetters.filter((l) => !refs.byLetter.has(l)))];

  if (!word) {
    return (
      <main className="ish-page ish-narrow">
        <p className="ish-eyebrow">Spell a word</p>
        <h1 className="ish-display">Sign it letter by letter.</h1>
        <p className="ish-lead">Here's a word to start with — or type your own. No dotted guide this time; tap “Show me” if you get stuck.</p>
        <input
          className="ish-input ish-input-lg"
          value={draft}
          maxLength={24}
          placeholder="Type a name or word"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && draftLetters.length && start(draftLetters)}
        />
        {draftLetters.length > 0 && (
          <div className="ish-tiles ish-tiles-lg">
            {draftLetters.map((l, i) => (
              <span key={i} className={`ish-tile ${refs.byLetter.has(l) ? "st-new" : "st-missing"}`}>
                {l}
              </span>
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <p className="ish-small ish-dim">
            No reference sign yet for {missing.join(", ")} — {missing.length === 1 ? "it" : "they"}'ll be skipped.
          </p>
        )}
        <div className="ish-row">
          <button
            className="ish-btn ish-btn-primary"
            disabled={!draftLetters.some((l) => refs.byLetter.has(l))}
            onClick={() => start(draftLetters)}
          >
            Start spelling
          </button>
          <button className="ish-btn" onClick={() => go("home")}>
            Back
          </button>
        </div>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="ish-page ish-narrow">
        <p className="ish-eyebrow">Spelled</p>
        <div className="ish-tiles ish-tiles-lg">
          {word.map((l, i) => (
            <span key={i} className={`ish-tile ${refs.byLetter.has(l) ? "st-mastered" : "st-missing"}`}>
              {l}
            </span>
          ))}
        </div>
        <h1 className="ish-display">You signed {word.join("")} in {(totalMs / 1000).toFixed(1)} seconds.</h1>
        <p className="ish-lead">Go again and watch your time drop — fluency is the letters flowing without a pause.</p>
        <div className="ish-row">
          <button className="ish-btn ish-btn-primary" onClick={() => start(word)}>
            Again, faster
          </button>
          <button className="ish-btn" onClick={() => setWord(null)}>
            Another word
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
      <header className="ish-learn-head" style={{ ["--progress" as string]: index / playable.length }}>
        <button className="ish-link" onClick={() => setWord(null)}>
          ← Change word
        </button>
        <div className="ish-tiles ish-tiles-lg" aria-label={`Spelling ${word.join("")}`}>
          {playable.map((l, i) => (
            <span key={i} className={`ish-tile ${i < index ? "st-mastered" : i === index ? "st-current" : "st-new"}`}>
              {l}
            </span>
          ))}
        </div>
        <span />
      </header>
      <div className="ish-learn-grid">
        <aside className="ish-learn-side">
          <p className="ish-eyebrow">Next letter</p>
          <h1 className="ish-letter-xl">{letter}</h1>
          <ReferenceCard
            letter={letter ?? ""}
            template={letter ? (refs.display.get(letter) ?? null) : null}
            dominant={dominant}
            video={letter ? refs.videos[letter] : undefined}
            hidden={!revealed}
            onReveal={() => setRevealed(true)}
          />
        </aside>
        <section className="ish-learn-main">
          <CameraStage {...coach} celebrate={flash} />
          <div className="ish-toolbar">
            <span className="ish-small ish-dim">{revealed ? "Guide on — this letter counts as assisted." : "From memory."}</span>
            <StrictnessPicker value={strictness} onChange={onStrictness} />
            <button className="ish-btn" onClick={() => next(false)} disabled={!!flash}>
              Skip {letter}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
