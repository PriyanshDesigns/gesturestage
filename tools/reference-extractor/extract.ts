import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

declare const __DATA_DIR__: string;

// Same versions as src/mediapipe/handLandmarker.ts.
const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

interface Item {
  letter: string;
  file: string; // path relative to the data dir
}

const status = document.getElementById("status")!;
const log = document.getElementById("log")!;
const url = (rel: string) => `/@fs${__DATA_DIR__}/${rel}`;

async function make(minConf: number) {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    runningMode: "IMAGE",
    numHands: 2,
    minHandDetectionConfidence: minConf,
    minHandPresenceConfidence: minConf,
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function run() {
  const items: Item[] = await (await fetch(url("list.json"))).json();
  const strict = await make(0.5);
  const lenient = await make(0.25);
  const results = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const img = await loadImage(url(it.file));
    let r = strict.detect(img);
    let pass = "strict";
    if (r.landmarks.length === 0) {
      r = lenient.detect(img);
      pass = "lenient";
    }
    results.push({
      ...it,
      width: img.naturalWidth,
      height: img.naturalHeight,
      pass,
      hands: r.landmarks.map((lm, h) => ({
        side: r.handedness[h]?.[0]?.categoryName ?? "Right",
        score: r.handedness[h]?.[0]?.score ?? 0,
        landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      })),
    });
    if (i % 20 === 0) status.textContent = `${i + 1}/${items.length} · ${it.file}`;
  }
  const res = await fetch("/save", { method: "POST", body: JSON.stringify(results) });
  const noHands = results.filter((r) => r.hands.length === 0).length;
  status.textContent = `Done: ${results.length} images, ${noHands} with no hands. ${await res.text()}`;
  log.textContent = "finished";
}

run().catch((e) => {
  status.textContent = `Error: ${e instanceof Error ? e.message : e}`;
});
