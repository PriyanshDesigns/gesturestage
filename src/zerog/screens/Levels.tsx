import { UI } from "../assets";
import { LEVELS } from "../levels";

interface Props {
  stars: Record<number, number>;
  status: string | null;
  onPlay: (id: number) => void;
  onBack: () => void;
  onSettings: () => void;
}

export function Levels({ stars, status, onPlay, onBack, onSettings }: Props) {
  return (
    <div className="zg-levels">
      <h2 className="zg-outline">PICK A BOX</h2>
      <p className="sub">Each box unlocks the next. Collect all 15 stars!</p>
      <div className="zg-level-grid">
        {LEVELS.map((l, i) => {
          const unlocked = i === 0 || (stars[LEVELS[i - 1].id] ?? 0) > 0;
          const earned = stars[l.id] ?? 0;
          return (
            <button
              key={l.id}
              className="zg-level"
              disabled={!unlocked}
              onClick={() => onPlay(l.id)}
              data-dwell
              style={i === LEVELS.length - 1 ? { gridColumn: "1 / -1", justifySelf: "center", width: "50%" } : undefined}
            >
              <span className="num zg-outline">{l.id}</span>
              <img className="box" src={unlocked ? UI.box : UI.lid} alt="" />
              <span className="name">{l.name}</span>
              {unlocked ? (
                <span className="stars">
                  {[1, 2, 3].map((s) => (
                    <img key={s} src={UI.star} alt="" className={s <= earned ? "" : "zg-star-off"} />
                  ))}
                </span>
              ) : (
                <span className="lock">🔒 Finish box {l.id - 1}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="zg-levels-actions">
        <button className="zg-btn secondary" onClick={onBack} data-dwell>
          ← Home
        </button>
        <button className="zg-btn secondary" onClick={onSettings} data-dwell>
          ⚙ Settings
        </button>
      </div>
      {status && (
        <div className="zg-status" style={{ position: "absolute", bottom: 88, left: "50%", transform: "translateX(-50%)", width: 340 }}>
          {status}
        </div>
      )}
    </div>
  );
}
