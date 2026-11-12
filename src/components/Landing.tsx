export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen landing">
      <div className="landing-inner">
        <h1>GestureStage</h1>
        <p className="tagline">
          Control your slides with your hands — point, zoom, advance, and blank the
          screen, all from across the room. No clicker, no install.
        </p>
        <button className="btn btn-primary" onClick={onStart}>
          Try it now
        </button>

        <div className="feature-row">
          <div className="card">
            <h3>Zero hardware</h3>
            <p>Your laptop's own webcam is the whole input device.</p>
          </div>
          <div className="card">
            <h3>Five gestures</h3>
            <p>Next, previous, pointer, zoom, and blank — nothing to memorize beyond that.</p>
          </div>
          <div className="card">
            <h3>Private by design</h3>
            <p>Video is processed on your device only. Nothing is uploaded.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
