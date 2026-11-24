import type { Sfx } from "./game";

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

// Must be called from a real user gesture before sounds can play.
export function unlockAudio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, gain: number, freq: number) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t);
}

export function playSfx(s: Sfx, v = 1) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  switch (s) {
    case "pop": {
      const f = 520 * Math.pow(1.12, Math.min(10, v - 1));
      tone(f, 0, 0.12, "sine", 0.3, f * 1.8);
      tone(f * 1.5, 0.05, 0.1, "triangle", 0.15);
      noise(0, 0.05, 0.15, 2500);
      break;
    }
    case "grab":
      tone(300, 0, 0.09, "triangle", 0.18, 520);
      break;
    case "fizz":
      noise(0, 0.18, 0.05 + v * 0.08, 6000);
      break;
    case "burst":
      noise(0, 0.5, 0.4, 1200);
      tone(180, 0, 0.4, "sawtooth", 0.15, 60);
      break;
    case "ticket":
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.22, "triangle", 0.2));
      break;
    case "crack":
      noise(0, 0.25, 0.35, 800);
      tone(140, 0, 0.25, "square", 0.1, 70);
      break;
    case "power":
      tone(440, 0, 0.35, "sine", 0.2, 1320);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, "triangle", 0.22));
      break;
    case "lose":
      [440, 370, 311, 262].forEach((f, i) => tone(f, i * 0.16, 0.4, "triangle", 0.2));
      break;
  }
}

export function playClick() {
  if (!enabled || !ctx || ctx.state !== "running") return;
  tone(880, 0, 0.06, "sine", 0.15);
}
