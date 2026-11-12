const GESTURES: { badge: string; label: string; detail: string }[] = [
  { badge: "SWIPE →", label: "Next slide", detail: "Open hand, swipe left to right." },
  { badge: "SWIPE ←", label: "Previous slide", detail: "Open hand, swipe right to left." },
  { badge: "POINT", label: "Laser pointer", detail: "Extend your index finger, the rest curled." },
  { badge: "PINCH + DRAG", label: "Zoom in / out", detail: "Pinch thumb and index together, drag up or down." },
  { badge: "FIST, HOLD", label: "Blank the screen", detail: "Make a fist and hold it for about a second." },
];

export function Onboarding({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="screen onboarding">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Five gestures, that's the whole vocabulary</h2>
        <p className="muted">
          Every gesture starts and ends from an open, relaxed hand — that's how the
          system knows where one gesture stops and the next begins.
        </p>
        <div className="gesture-list">
          {GESTURES.map((g) => (
            <div className="gesture-item" key={g.label}>
              <span className="badge">{g.badge}</span>
              <div className="label">
                <strong>{g.label}</strong>
                <span>{g.detail}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          Keyboard arrow keys always work too — gestures are an addition, never the
          only way in.
        </p>
        <button className="btn btn-primary" onClick={onContinue}>
          Continue to camera setup
        </button>
      </div>
    </div>
  );
}
