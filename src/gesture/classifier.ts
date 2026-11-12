import type { HandLandmarks, Landmark, Pose } from "./types";

// MediaPipe hand landmark indices.
const WRIST = 0;
const THUMB_TIP = 4;
const THUMB_MCP = 2;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_TIP = 20;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// A finger counts as extended when its tip sits further from the wrist
// than its own base joint does, by a margin (works across hand rotation
// better than a fixed up/down check).
function fingerExtended(lm: HandLandmarks, tip: number, mcp: number): boolean {
  return dist(lm[tip], lm[WRIST]) > dist(lm[mcp], lm[WRIST]) * 1.15;
}

function thumbExtended(lm: HandLandmarks): boolean {
  return dist(lm[THUMB_TIP], lm[PINKY_MCP]) > dist(lm[THUMB_MCP], lm[PINKY_MCP]) * 1.05;
}

export function handSize(lm: HandLandmarks): number {
  return dist(lm[WRIST], lm[MIDDLE_MCP]) || 0.0001;
}

export function pinchDistance(lm: HandLandmarks): number {
  return dist(lm[THUMB_TIP], lm[INDEX_TIP]) / handSize(lm);
}

export function pinchCenter(lm: HandLandmarks): Landmark {
  return {
    x: (lm[THUMB_TIP].x + lm[INDEX_TIP].x) / 2,
    y: (lm[THUMB_TIP].y + lm[INDEX_TIP].y) / 2,
    z: (lm[THUMB_TIP].z + lm[INDEX_TIP].z) / 2,
  };
}

export interface PoseReading {
  pose: Pose;
  extendedCount: number;
  thumbOut: boolean;
  pinchDist: number;
}

export function classifyPose(lm: HandLandmarks, pinchThreshold: number): PoseReading {
  const index = fingerExtended(lm, INDEX_TIP, INDEX_MCP);
  const middle = fingerExtended(lm, MIDDLE_TIP, MIDDLE_MCP);
  const ring = fingerExtended(lm, RING_TIP, RING_MCP);
  const pinky = fingerExtended(lm, PINKY_TIP, PINKY_MCP);
  const thumbOut = thumbExtended(lm);
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length;
  const pinchDist = pinchDistance(lm);

  let pose: Pose = "unknown";
  if (pinchDist < pinchThreshold) {
    pose = "pinch";
  } else if (extendedCount >= 4 && thumbOut) {
    pose = "ready";
  } else if (index && !middle && !ring && !pinky) {
    pose = "point";
  } else if (extendedCount === 0 && !thumbOut) {
    pose = "fist";
  }

  return { pose, extendedCount, thumbOut, pinchDist };
}

export { INDEX_TIP, WRIST };
