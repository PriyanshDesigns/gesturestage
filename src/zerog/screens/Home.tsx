import { UI, candyUrl, specialUrl } from "../assets";
import { GestureRows } from "../components/CameraPanel";

interface Props {
  cameraError: string | null;
  onHands: () => void;
  onMouse: () => void;
}

const FLOATERS = [
  { src: candyUrl("pink"), left: 30, top: 300, delay: 0 },
  { src: candyUrl("blue"), left: 318, top: 248, delay: -2 },
  { src: candyUrl("yellow"), left: 250, top: 330, delay: -4 },
  { src: specialUrl("wild"), left: 120, top: 380, delay: -1 },
  { src: candyUrl("green"), left: 330, top: 404, delay: -3 },
  { src: specialUrl("soda"), left: 196, top: 272, delay: -5 },
];

export function Home({ cameraError, onHands, onMouse }: Props) {
  return (
    <div className="zg-home">
      {FLOATERS.map((f, i) => (
        <img key={i} className="zg-home-float" src={f.src} alt="" style={{ left: f.left, top: f.top, animationDelay: `${f.delay}s` }} />
      ))}
      <div className="zg-logo">
        <span className="small zg-outline">WONKA'S</span>
        <span className="big zg-outline">ZERO-G</span>
        <span className="mid zg-outline">CANDY LAB</span>
      </div>

      <img className="zg-home-wonka" src={UI.wonka} alt="Willy Wonka" />

      <div className="zg-home-card">
        <h3>Candies float. Your hands move them.</h3>
        <GestureRows />
        <div style={{ fontFamily: "system-ui", fontSize: 11, fontWeight: 600, marginTop: 6 }}>
          Get 3 of a colour touching and they pop.
        </div>
      </div>

      <div className="zg-home-actions">
        {cameraError && <div className="zg-status">Camera problem: {cameraError}. You can still play with the mouse.</div>}
        <button className="zg-btn pink" onClick={onHands} data-dwell>
          ✋ PLAY WITH HANDS
        </button>
        <button className="zg-btn secondary" onClick={onMouse} data-dwell>
          🖱 Use the mouse instead
        </button>
      </div>
    </div>
  );
}
