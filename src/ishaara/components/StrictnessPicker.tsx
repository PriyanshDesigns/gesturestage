import { STRICTNESS, type Strictness } from "../useCoach";

/** How exact a shape must be to count. Shown under the camera on practice screens. */
export function StrictnessPicker({ value, onChange }: { value: Strictness; onChange: (s: Strictness) => void }) {
  return (
    <div className="ish-strict" role="group" aria-label="How strict the checking is">
      <span className="ish-small ish-dim">Checking</span>
      <div className="ish-segment ish-segment-sm">
        {(Object.keys(STRICTNESS) as Strictness[]).map((k) => (
          <button key={k} className={value === k ? "on" : ""} aria-pressed={value === k} onClick={() => onChange(k)}>
            {STRICTNESS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
