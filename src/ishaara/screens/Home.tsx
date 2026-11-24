import { useMemo, useState } from "react";
import type { HandSide } from "../../isl/pose";
import { HandMorph } from "../components/HandMorph";
import { letterState, nameLetters, type LetterState } from "../letters";
import { ALPHABET, LESSONS, type References } from "../references";
import { go, learnRoute } from "../router";
import { dueCount, type LetterProgress } from "../store";

interface Props {
  word: string;
  onShuffle: () => void;
  refs: References;
  progress: Record<string, LetterProgress>;
  dominant: HandSide;
  loading: boolean;
}

const STATE_WORD: Record<LetterState, string> = { missing: "no reference", new: "new", learning: "learning", mastered: "solid" };

/** A small ring showing how much of a lesson is solid. */
function Ring({ value, total, current }: { value: number; total: number; current: boolean }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg className={`ish-ring ${current ? "is-current" : ""}`} viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r={r} className="ish-ring-track" />
      {value > 0 && (
        <circle cx="24" cy="24" r={r} className="ish-ring-fill" strokeDasharray={`${(value / total) * c} ${c}`} transform="rotate(-90 24 24)" />
      )}
    </svg>
  );
}

export function Home({ word, onShuffle, refs, progress, dominant, loading }: Props) {
  const state = (l: string) => letterState(l, refs, progress);
  const wordLetters = nameLetters(word);
  const unique = [...new Set(wordLetters)];
  const wordMissing = unique.filter((l) => state(l) === "missing");
  const wordToLearn = unique.filter((l) => state(l) === "new");
  const due = dueCount(progress, refs.letters);
  const seen = refs.letters.filter((l) => progress[l]?.attempts).length;
  const solid = ALPHABET.filter((l) => state(l) === "mastered").length;
  const noRefs = !loading && refs.letters.length === 0;

  // The lesson to continue: the first one with letters that aren't solid yet.
  const lessons = LESSONS.map((lesson, i) => {
    const available = lesson.letters.filter((l) => state(l) !== "missing");
    const done = lesson.letters.filter((l) => state(l) === "mastered").length;
    const todo = available.filter((l) => state(l) !== "mastered");
    return { ...lesson, index: i, available, done, todo };
  });
  const current = lessons.find((l) => l.todo.length > 0) ?? null;
  const started = current ? current.todo.some((l) => progress[l]?.attempts) || current.done > 0 : false;

  const frames = useMemo(
    () =>
      nameLetters(word)
        .map((letter) => ({ letter, template: refs.display.get(letter) }))
        .filter((f): f is { letter: string; template: NonNullable<typeof f.template> } => !!f.template),
    [word, refs]
  );
  const [shown, setShown] = useState(0);

  return (
    <main className="ish-page ish-home">
      {noRefs && (
        <section className="ish-banner" role="note">
          <div>
            <h2>No reference signs loaded yet</h2>
            <p>Ishaara checks each letter against a fluent signer's recording. Record them, or import a shared set.</p>
          </div>
          <button className="ish-btn ish-btn-primary" onClick={() => go("teach")}>
            Add reference signs
          </button>
        </section>
      )}

      <section className="ish-hero">
        <div className="ish-hero-copy">
          <p className="ish-eyebrow">{seen === 0 ? "Indian Sign Language · fingerspelling" : `Welcome back · ${solid} of 26 solid`}</p>
          <h1 className="ish-hero-title">
            {seen === 0 ? (
              <>
                Your hands
                <br />
                are the lesson.
              </>
            ) : current ? (
              <>
                Pick up at
                <br />
                <em>{current.title.toLowerCase()}</em>.
              </>
            ) : (
              <>
                The whole
                <br />
                alphabet, solid.
              </>
            )}
          </h1>
          <p className="ish-lead">
            {seen === 0
              ? "Copy a letter, hold it, and the webcam tells you which finger to fix. Five short lessons take you through A to Z."
              : current
                ? `${current.todo.length} ${current.todo.length === 1 ? "letter" : "letters"} left in lesson ${current.index + 1}: ${current.todo.join(" ")}.`
                : "Keep them sharp in practice, or spell longer words."}
          </p>
          <div className="ish-hero-actions">
            {current ? (
              <button className="ish-btn ish-btn-primary ish-btn-lg" onClick={() => go(learnRoute(current.todo, current.title))}>
                {started ? "Continue" : "Start"} lesson {current.index + 1}
                <span aria-hidden>→</span>
              </button>
            ) : (
              <button className="ish-btn ish-btn-primary ish-btn-lg" onClick={() => go(`spell?w=${word}`)}>
                Spell a word <span aria-hidden>→</span>
              </button>
            )}
            <button className="ish-btn ish-btn-lg" disabled={seen === 0} onClick={() => go("practice")}>
              Practice{due ? <span className="ish-badge">{due} due</span> : null}
            </button>
          </div>

          <div className="ish-alpha-bar" aria-label={`${solid} of 26 letters solid`}>
            {ALPHABET.map((l) => (
              <span key={l} className={`st-${state(l)}`} title={`${l}: ${STATE_WORD[state(l)]}`}>
                {l}
              </span>
            ))}
          </div>
        </div>

        <figure className="ish-word-card">
          <div className="ish-word-head">
            <span className="ish-eyebrow">Today's word</span>
            <button className="ish-link" onClick={onShuffle}>
              Another word
            </button>
          </div>
          <div className="ish-word-stage">
            {frames.length > 0 ? (
              <HandMorph key={word} frames={frames} dominant={dominant} onLetter={setShown} label={`Reference shapes spelling ${word}`} />
            ) : (
              <span className="ish-dim">No reference shapes yet</span>
            )}
            <span className="ish-word-letter" aria-hidden>
              {frames[shown]?.letter}
            </span>
          </div>
          <div className="ish-word-tiles" aria-label={`Letters of ${word}`}>
            {wordLetters.map((l, i) => (
              <span key={i} className={`ish-tile st-${state(l)} ${frames[shown]?.letter === l ? "is-lit" : ""}`}>
                {l}
              </span>
            ))}
          </div>
          <figcaption>
            {wordMissing.length > 0 ? (
              <span className="ish-dim">No reference yet for {wordMissing.join(", ")}.</span>
            ) : wordToLearn.length > 0 ? (
              <>
                <span className="ish-dim">
                  {wordToLearn.length} new {wordToLearn.length === 1 ? "letter" : "letters"}
                </span>
                <button className="ish-btn" onClick={() => go(learnRoute(wordToLearn, `Letters in ${word}`))}>
                  Learn {wordToLearn.join(" ")}
                </button>
              </>
            ) : (
              <>
                <span className="ish-dim">You know every letter</span>
                <button className="ish-btn" onClick={() => go(`spell?w=${word}`)}>
                  Spell {word}
                </button>
              </>
            )}
          </figcaption>
        </figure>
      </section>

      <section className="ish-track-section" aria-labelledby="path-title">
        <div className="ish-section-head">
          <h2 id="path-title" className="ish-title">
            The alphabet in five lessons
          </h2>
          <div className="ish-legend" aria-hidden>
            <span className="ish-tile ish-tile-xs st-new" /> new
            <span className="ish-tile ish-tile-xs st-learning" /> learning
            <span className="ish-tile ish-tile-xs st-mastered" /> solid
          </div>
        </div>
        <ol className="ish-track">
          {lessons.map((lesson) => {
            const isCurrent = current?.index === lesson.index;
            const complete = lesson.done === lesson.letters.length;
            return (
              <li key={lesson.title} className={`ish-stop ${isCurrent ? "is-current" : ""} ${complete ? "is-complete" : ""}`}>
                <div className="ish-stop-marker">
                  <Ring value={lesson.done} total={lesson.letters.length} current={isCurrent} />
                  <span>{complete ? "✓" : lesson.index + 1}</span>
                </div>
                <div className="ish-stop-body">
                  <h3>{lesson.title}</h3>
                  <p className="ish-small ish-dim">
                    {lesson.done}/{lesson.letters.length} solid
                  </p>
                  <div className="ish-tiles ish-stop-tiles">
                    {lesson.letters.map((l) => (
                      <span key={l} className={`ish-tile ish-tile-sm st-${state(l)}`} title={`${l}: ${STATE_WORD[state(l)]}`}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <button
                    className={`ish-btn ${isCurrent ? "ish-btn-primary" : ""}`}
                    disabled={!lesson.available.length}
                    onClick={() => go(learnRoute(lesson.todo.length ? lesson.todo : lesson.available, lesson.title))}
                  >
                    {!lesson.available.length ? "No references" : complete ? "Review" : isCurrent && started ? "Continue" : "Start"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="ish-how" aria-label="How a letter is checked">
        {[
          ["Watch", "A real signer's shape, mirrored so it matches what you see."],
          ["Copy", "A dotted outline sits on your own wrist on the camera."],
          ["Fix", "It names the one finger that's off, and how to move it."],
          ["Hold", "Keep the shape for a moment and the ring fills: done."],
        ].map(([title, text], i) => (
          <div key={title} className="ish-how-step">
            <span className="ish-how-num">{i + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
