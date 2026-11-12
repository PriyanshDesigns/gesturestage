import { classifyPose, pinchCenter } from "./classifier";
import type {
  GestureEvent,
  GestureSettings,
  HandLandmarks,
  Pose,
} from "./types";

const SWIPE_WINDOW_MS = 500;
const SWIPE_COOLDOWN_MS = 700;

interface WristSample {
  x: number; // mirrored (0 = screen-left as the presenter sees it)
  t: number;
}

/**
 * Turns a per-frame stream of hand landmarks into discrete GestureEvents.
 * Mirrors x so "right" means right as the presenter sees it on their own
 * screen, matching the mirrored camera preview.
 */
export class GestureEngine {
  private wristHistory: WristSample[] = [];
  private lastSwipeAt = 0;
  private pose: Pose = "unknown";
  private fistStartedAt: number | null = null;
  private fistFired = false;
  private wasPinching = false;
  private lastPinchCenterY: number | null = null;
  private wasPointing = false;

  reset() {
    this.wristHistory = [];
    this.fistStartedAt = null;
    this.fistFired = false;
    this.wasPinching = false;
    this.lastPinchCenterY = null;
    this.wasPointing = false;
    this.pose = "unknown";
  }

  get currentPose(): Pose {
    return this.pose;
  }

  update(
    lm: HandLandmarks | null,
    now: number,
    settings: GestureSettings
  ): GestureEvent[] {
    const events: GestureEvent[] = [];

    if (!lm) {
      this.pose = "unknown";
      this.wristHistory = [];
      this.fistStartedAt = null;
      this.fistFired = false;
      this.wasPinching = false;
      if (this.wasPointing) {
        events.push({ type: "pointer-off", at: now });
        this.wasPointing = false;
      }
      return events;
    }

    const reading = classifyPose(lm, settings.pinchThreshold);
    this.pose = reading.pose;
    const mirroredWristX = 1 - lm[0].x;

    // --- swipe (next / prev slide) ---
    if (reading.pose === "ready") {
      this.wristHistory.push({ x: mirroredWristX, t: now });
      this.wristHistory = this.wristHistory.filter(
        (s) => now - s.t <= SWIPE_WINDOW_MS
      );
      if (now - this.lastSwipeAt > SWIPE_COOLDOWN_MS && this.wristHistory.length >= 2) {
        const oldest = this.wristHistory[0];
        const delta = mirroredWristX - oldest.x;
        if (Math.abs(delta) >= settings.swipeThreshold) {
          events.push({
            type: delta > 0 ? "next-slide" : "prev-slide",
            at: now,
          });
          this.lastSwipeAt = now;
          this.wristHistory = [];
        }
      }
    } else {
      this.wristHistory = [];
    }

    // --- point -> pointer overlay ---
    if (reading.pose === "point") {
      const tip = lm[8];
      events.push({ type: "pointer-move", x: 1 - tip.x, y: tip.y, at: now });
      this.wasPointing = true;
    } else if (this.wasPointing) {
      events.push({ type: "pointer-off", at: now });
      this.wasPointing = false;
    }

    // --- pinch -> zoom (drag up = zoom in) ---
    if (reading.pose === "pinch") {
      const center = pinchCenter(lm);
      if (this.wasPinching && this.lastPinchCenterY !== null) {
        const delta = (this.lastPinchCenterY - center.y) * settings.zoomSensitivity;
        if (Math.abs(delta) > 0.0008) {
          events.push({ type: "zoom", delta, at: now });
        }
      }
      this.lastPinchCenterY = center.y;
      this.wasPinching = true;
    } else {
      this.wasPinching = false;
      this.lastPinchCenterY = null;
    }

    // --- fist held -> blank toggle ---
    if (reading.pose === "fist") {
      if (this.fistStartedAt === null) this.fistStartedAt = now;
      if (!this.fistFired && now - this.fistStartedAt >= settings.fistHoldMs) {
        events.push({ type: "blank-toggle", at: now });
        this.fistFired = true;
      }
    } else {
      this.fistStartedAt = null;
      this.fistFired = false;
    }

    return events;
  }
}
