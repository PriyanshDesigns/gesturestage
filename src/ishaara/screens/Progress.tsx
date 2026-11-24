import { ALPHABET, type References } from "../references";
import { go, learnRoute } from "../router";
import { MASTERED_BOX, type LetterProgress } from "../store";
import { letterState } from "../letters";

interface Props {
  refs: References;
  progress: Record<string, LetterProgress>;
  sessions: number;
  onReset: () => void;
}

const STATE_LABEL = { missing: "No reference", new: "Not started", learning: "Learning", mastered: "Solid" };

export function Progress({ refs, progress, sessions, onReset }: Props) {
  const states = ALPHABET.map((l) => letterState(l, refs, progress));
  const count = (s: string) => states.filter((x) => x === s).length;
  const all = Object.values(progress);
  const attempts = all.reduce((s, p) => s + p.attempts, 0);
  const correct = all.reduce((s, p) => s + p.correct, 0);
  const unaided = all.reduce((s, p) => s + Math.max(0, p.correct - p.assisted), 0);
  const weakest = ALPHABET.filter((l) => progress[l]?.attempts)
    .sort((a, b) => progress[a].box - progress[b].box || progress[a].correct / progress[a].attempts - progress[b].correct / progress[b].attempts)
    .slice(0, 5);

  return (
    <main className="ish-page">
      <header className="ish-hello">
        <p className="ish-eyebrow">Progress</p>
        <h1 className="ish-display">
          {count("mastered")} solid · {count("learning")} learning · {count("new")} to go
        </h1>
      </header>

      <div className="ish-stats">
        <div className="ish-card">
          <p className="ish-big-number">{attempts ? Math.round((correct / attempts) * 100) : 0}%</p>
          <p className="ish-dim">of attempts ended in the right shape</p>
        </div>
        <div className="ish-card">
          <p className="ish-big-number">{unaided}</p>
          <p className="ish-dim">letters signed without the guide</p>
        </div>
        <div className="ish-card">
          <p className="ish-big-number">{sessions}</p>
          <p className="ish-dim">practice {sessions === 1 ? "session" : "sessions"} finished</p>
        </div>
      </div>

      <section>
        <div className="ish-section-head">
          <h2 className="ish-title">Every letter</h2>
          {weakest.length > 0 && (
            <button className="ish-btn" onClick={() => go(learnRoute(weakest, "Your weakest letters"))}>
              Relearn weakest: {weakest.join(" ")}
            </button>
          )}
        </div>
        <ul className="ish-alphabet">
          {ALPHABET.map((l, i) => {
            const p = progress[l];
            const st = states[i];
            return (
              <li key={l} className={`ish-alpha st-${st}`}>
                <span className="ish-alpha-letter">{l}</span>
                <span className="ish-box" aria-label={`Memory level ${p?.box ?? 0} of 4`}>
                  {[1, 2, 3, 4].map((b) => (
                    <i key={b} className={(p?.box ?? 0) >= b ? (b >= MASTERED_BOX ? "on solid" : "on") : ""} />
                  ))}
                </span>
                <span className="ish-small">{STATE_LABEL[st]}</span>
                {p?.attempts ? (
                  <span className="ish-small ish-dim">
                    {p.correct}/{p.attempts} right
                    {p.correct ? ` · ${(p.totalMs / p.correct / 1000).toFixed(1)}s` : ""}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="ish-small ish-dim">
        Progress is saved in this browser only.{" "}
        <button
          className="ish-link"
          onClick={() => {
            if (confirm("Reset all progress on this device? Your reference signs stay.")) onReset();
          }}
        >
          Reset progress
        </button>
      </p>
    </main>
  );
}
