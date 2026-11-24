import { LESSONS, type References } from "../references";
import { letterState, nameLetters } from "../letters";
import { dueCount, type LetterProgress } from "../store";
import { go, learnRoute } from "../router";

interface Props {
  word: string;
  onShuffle: () => void;
  refs: References;
  progress: Record<string, LetterProgress>;
  loading: boolean;
}

export function Home({ word, onShuffle, refs, progress, loading }: Props) {
  const name = nameLetters(word);
  const unique = [...new Set(name)];
  const state = (l: string) => letterState(l, refs, progress);
  const nameMissing = unique.filter((l) => state(l) === "missing");
  const nameToLearn = unique.filter((l) => state(l) === "new");
  const due = dueCount(progress, refs.letters);
  const seen = refs.letters.filter((l) => progress[l]?.attempts).length;
  const noRefs = !loading && refs.letters.length === 0;

  return (
    <main className="ish-page">
      <header className="ish-hello">
        <p className="ish-eyebrow">{seen === 0 ? "Welcome" : "Welcome back"}</p>
        <h1 className="ish-display">
          {seen === 0 ? "Your first letters are waiting." : `${refs.letters.filter((l) => state(l) === "mastered").length} of 26 letters solid.`}
        </h1>
      </header>

      {noRefs && (
        <section className="ish-banner" role="note">
          <div>
            <h2>No reference signs loaded yet</h2>
            <p>
              Ishaara learns each letter from a fluent ISL signer's recording, and none have been added to this copy.
              Record them (ideally with a Deaf signer), or import a file someone has shared.
            </p>
          </div>
          <button className="ish-btn ish-btn-primary" onClick={() => go("teach")}>
            Add reference signs
          </button>
        </section>
      )}

      <div className="ish-home-grid">
        <section className="ish-card ish-name-card">
          <div className="ish-card-head">
            <p className="ish-eyebrow">Your first real word</p>
            <button className="ish-link" onClick={onShuffle}>
              Another word
            </button>
          </div>
          <div className="ish-tiles ish-tiles-lg" aria-label={`Letters of ${word}`}>
            {name.map((l, i) => (
              <span key={i} className={`ish-tile st-${state(l)}`}>
                {l}
              </span>
            ))}
          </div>
          {nameMissing.length > 0 ? (
            <p className="ish-dim">
              No reference yet for {nameMissing.join(", ")}. Add {nameMissing.length === 1 ? "it" : "them"} under Reference signs.
            </p>
          ) : nameToLearn.length > 0 ? (
            <>
              <p>
                Learn the {nameToLearn.length} {nameToLearn.length === 1 ? "letter" : "letters"} you haven't tried yet, then spell
                the whole word.
              </p>
              <button className="ish-btn ish-btn-primary" onClick={() => go(learnRoute(nameToLearn, `Letters in ${word}`))}>
                Learn {nameToLearn.join(" ")}
              </button>
            </>
          ) : (
            <>
              <p>You know every letter. Sign it start to finish.</p>
              <button className="ish-btn ish-btn-primary" onClick={() => go(`spell?w=${word}`)}>
                Spell {word}
              </button>
            </>
          )}
        </section>

        <section className="ish-card ish-practice-card">
          <p className="ish-eyebrow">Practice</p>
          <p className="ish-big-number">{due}</p>
          <p className="ish-dim">
            {seen === 0
              ? "Letters you learn come back here, spaced out so they stick."
              : due
                ? `${due === 1 ? "letter is" : "letters are"} due for review.`
                : "Nothing due right now. Come back later, or practise anyway."}
          </p>
          <button className="ish-btn" disabled={seen === 0} onClick={() => go("practice")}>
            Practise from memory
          </button>
        </section>
      </div>

      <section aria-labelledby="path-title">
        <div className="ish-section-head">
          <h2 id="path-title" className="ish-title">
            The alphabet, in five lessons
          </h2>
          <div className="ish-legend" aria-hidden>
            <span className="ish-tile ish-tile-xs st-new" /> new
            <span className="ish-tile ish-tile-xs st-learning" /> learning
            <span className="ish-tile ish-tile-xs st-mastered" /> solid
          </div>
        </div>
        <ol className="ish-path">
          {LESSONS.map((lesson, i) => {
            const available = lesson.letters.filter((l) => state(l) !== "missing");
            const done = lesson.letters.filter((l) => state(l) === "mastered").length;
            return (
              <li key={lesson.title} className="ish-card ish-lesson">
                <div className="ish-lesson-head">
                  <span className="ish-lesson-num">{i + 1}</span>
                  <div>
                    <h3>{lesson.title}</h3>
                    <p className="ish-small ish-dim">
                      {done}/{lesson.letters.length} solid
                    </p>
                  </div>
                </div>
                <div className="ish-tiles">
                  {lesson.letters.map((l) => (
                    <span key={l} className={`ish-tile st-${state(l)}`} title={state(l) === "missing" ? "No reference sign yet" : undefined}>
                      {l}
                    </span>
                  ))}
                </div>
                <button className="ish-btn" disabled={!available.length} onClick={() => go(learnRoute(available, lesson.title))}>
                  {available.length ? (done === lesson.letters.length ? "Review" : "Start") : "No references"}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
