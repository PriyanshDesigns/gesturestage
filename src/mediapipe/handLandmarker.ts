import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const landmarkers = new Map<number, Promise<HandLandmarker>>();

export function getHandLandmarker(numHands = 1): Promise<HandLandmarker> {
  let landmarker = landmarkers.get(numHands);
  if (!landmarker) {
    landmarker = FilesetResolver.forVisionTasks(WASM_PATH).then((vision) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands,
      })
    );
    landmarkers.set(numHands, landmarker);
  }
  return landmarker;
}
