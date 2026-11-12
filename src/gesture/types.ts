// A MediaPipe hand landmark: normalized image coordinates (0-1), z = relative depth.
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = Landmark[]; // 21 points, indices per MediaPipe's hand model

export type Pose = "ready" | "point" | "pinch" | "fist" | "unknown";

export type GestureEventType =
  | "next-slide"
  | "prev-slide"
  | "pointer-move"
  | "pointer-off"
  | "zoom"
  | "blank-toggle";

export interface GestureEvent {
  type: GestureEventType;
  // Normalized (0-1) position for pointer-move; delta for zoom.
  x?: number;
  y?: number;
  delta?: number;
  at: number;
}

export interface GestureSettings {
  swipeThreshold: number; // normalized x-distance to count as a swipe
  pinchThreshold: number; // normalized distance (relative to hand size) to count as pinched
  fistHoldMs: number; // how long a fist must be held to toggle blank
  zoomSensitivity: number;
}

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  swipeThreshold: 0.22,
  pinchThreshold: 0.38,
  fistHoldMs: 700,
  zoomSensitivity: 2.5,
};
