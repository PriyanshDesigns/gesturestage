import { useEffect, useMemo, useState } from "react";
import { randomWord } from "./letters";
import type { Strictness } from "./useCoach";
import { buildReferences, fetchBundledRefs } from "./references";
import { go, useRoute, type Route } from "./router";
import { DEFAULT_STATE, loadState, recordAttempt, saveState, type AppState, type Attempt, type RefSet } from "./store";
import { Home } from "./screens/Home";
import { Lesson } from "./screens/Lesson";
import { Onboarding } from "./screens/Onboarding";
import { Practice } from "./screens/Practice";
import { Progress } from "./screens/Progress";
import { Spell } from "./screens/Spell";
import { Teach } from "./screens/Teach";

const NAV: { route: Route["name"]; label: string }[] = [
  { route: "home", label: "Learn" },
  { route: "spell", label: "Spell" },
  { route: "practice", label: "Practice" },
  { route: "progress", label: "Progress" },
  { route: "teach", label: "Reference signs" },
];

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [bundled, setBundled] = useState<RefSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstWord, setFirstWord] = useState(() => randomWord());
  const route = useRoute();

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    fetchBundledRefs().then((set) => {
      setBundled(set);
      setLoading(false);
    });
  }, []);

  const { profile, progress } = state;
  const refs = useMemo(() => buildReferences(bundled, state.localRefs, profile.dominant), [bundled, state.localRefs, profile.dominant]);

  const strictness = profile.strictness ?? "normal";
  const strictProps = {
    strictness,
    onStrictness: (v: Strictness) => setState((s) => ({ ...s, profile: { ...s.profile, strictness: v } })),
  };

  function onAttempt(letter: string, attempt: Attempt) {
    setState((s) => ({ ...s, progress: { ...s.progress, [letter]: recordAttempt(s.progress[letter], attempt) } }));
  }

  if (!profile.onboarded && route.name !== "teach") {
    return <Onboarding initial={profile} refs={refs} onDone={(p) => setState((s) => ({ ...s, profile: p }))} />;
  }

  let screen;
  switch (route.name) {
    case "learn": {
      const letters = (route.params.get("l") ?? "").toUpperCase().replace(/[^A-Z]/g, "").split("").filter(Boolean);
      screen = (
        <Lesson
          key={route.params.toString()}
          title={route.params.get("t") ?? "Lesson"}
          letters={letters}
          refs={refs}
          dominant={profile.dominant}
          onAttempt={onAttempt}
          {...strictProps}
        />
      );
      break;
    }
    case "spell":
      screen = <Spell key={route.params.get("w") ?? firstWord} name={route.params.get("w") ?? firstWord} refs={refs} dominant={profile.dominant} onAttempt={onAttempt} {...strictProps} />;
      break;
    case "practice":
      screen = (
        <Practice
          refs={refs}
          progress={progress}
          dominant={profile.dominant}
          onAttempt={onAttempt}
          {...strictProps}
          onSessionDone={() => setState((s) => ({ ...s, sessions: s.sessions + 1 }))}
        />
      );
      break;
    case "progress":
      screen = (
        <Progress refs={refs} progress={progress} sessions={state.sessions} onReset={() => setState((s) => ({ ...s, progress: {}, sessions: 0 }))} />
      );
      break;
    case "teach":
      screen = (
        <Teach
          refs={refs}
          bundledCount={bundled ? new Set(bundled.templates.map((t) => t.letter)).size : 0}
          local={state.localRefs}
          learnerDominant={profile.dominant}
          onChange={(set) => setState((s) => ({ ...s, localRefs: set }))}
        />
      );
      break;
    default:
      screen = <Home dominant={profile.dominant} word={firstWord} onShuffle={() => setFirstWord((w) => randomWord(w))} refs={refs} progress={progress} loading={loading} />;
  }

  const active = route.name === "learn" ? "home" : route.name;
  return (
    <div className="ish-app">
      <nav className="ish-nav" aria-label="Main">
        <button className="ish-brand" onClick={() => go("home")}>
          <span className="ish-brand-mark" aria-hidden>
            इ
          </span>
          Ishaara
        </button>
        <div className="ish-nav-links">
          {NAV.map((n) => (
            <button key={n.route} className={active === n.route ? "on" : ""} aria-current={active === n.route ? "page" : undefined} onClick={() => go(n.route)}>
              {n.label}
            </button>
          ))}
        </div>
        <button
          className="ish-nav-hand"
          title="Switch dominant hand"
          onClick={() =>
            setState((s) => ({ ...s, profile: { ...s.profile, dominant: s.profile.dominant === "Right" ? "Left" : "Right" } }))
          }
        >
          {profile.dominant}-handed
        </button>
      </nav>
      {screen}
      <footer className="ish-footer">
        <span>
          Video is processed on this device and never uploaded.
          {refs.signers.length ? ` Reference signs: ${refs.signers.join(", ")}` : ""}
          {refs.credits.map((c) => (
            <span key={c.text}>
              {" "}
              ({c.url ? <a href={c.url} target="_blank" rel="noreferrer">source</a> : "source"}
              {c.license ? `, ${c.license}` : ""}).
            </span>
          ))}
        </span>
        <button
          className="ish-link"
          onClick={() => setState((s) => ({ ...s, profile: { ...DEFAULT_STATE.profile, dominant: s.profile.dominant } }))}
        >
          Change dominant hand
        </button>
      </footer>
    </div>
  );
}
