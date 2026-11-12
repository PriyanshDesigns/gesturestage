export interface SessionStats {
  nextCount: number;
  prevCount: number;
  pointerCount: number;
  zoomCount: number;
  blankCount: number;
  durationMs: number;
}

export function SessionSummary({ stats, onRestart, onHome }: { stats: SessionStats; onRestart: () => void; onHome: () => void }) {
  const seconds = Math.round(stats.durationMs / 1000);
  return (
    <div className="screen summary">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Session summary</h2>
        <p className="muted">{seconds}s · {stats.nextCount + stats.prevCount + stats.pointerCount + stats.zoomCount + stats.blankCount} gestures recognized</p>

        <div className="stat-grid">
          <Stat n={stats.nextCount} label="Next slide" />
          <Stat n={stats.prevCount} label="Previous slide" />
          <Stat n={stats.pointerCount} label="Pointer activations" />
          <Stat n={stats.zoomCount} label="Zoom adjustments" />
          <Stat n={stats.blankCount} label="Screen blanked" />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={onRestart} style={{ flex: 1 }}>
            Present again
          </button>
          <button className="btn" onClick={onHome} style={{ flex: 1 }}>
            Back home
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <div className="n">{n}</div>
      <div className="label">{label}</div>
    </div>
  );
}
