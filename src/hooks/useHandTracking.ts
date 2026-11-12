import { useEffect, useRef, useState } from "react";
import { getHandLandmarker } from "../mediapipe/handLandmarker";
import { GestureEngine } from "../gesture/engine";
import type { GestureEvent, GestureSettings, HandLandmarks, Pose } from "../gesture/types";

export type TrackingStatus = "idle" | "loading-model" | "requesting-camera" | "ready" | "error";

interface Options {
  deviceId?: string;
  active: boolean;
  settings: GestureSettings;
  onEvent: (e: GestureEvent) => void;
}

export function useHandTracking({ deviceId, active, settings, onEvent }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const engineRef = useRef(new GestureEngine());
  const rafRef = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  const onEventRef = useRef(onEvent);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<HandLandmarks | null>(null);
  const [pose, setPose] = useState<Pose>("unknown");
  const [brightness, setBrightness] = useState<number | null>(null);

  settingsRef.current = settings;
  onEventRef.current = onEvent;

  // Camera stream.
  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;

    setStatus("requesting-camera");
    setError(null);

    navigator.mediaDevices
      .getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setStatus("loading-model");
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not access the camera.");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, deviceId]);

  // Detection loop.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let frameCount = 0;

    getHandLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        setStatus("ready");

        const loop = () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }

          const now = performance.now();
          const result = landmarker.detectForVideo(video, now);
          const hand = result.landmarks?.[0] ?? null;
          setLandmarks(hand as HandLandmarks | null);

          const events = engineRef.current.update(hand as HandLandmarks | null, now, settingsRef.current);
          setPose(engineRef.current.currentPose);
          events.forEach((e) => onEventRef.current(e));

          frameCount += 1;
          if (frameCount % 15 === 0) {
            setBrightness(sampleBrightness(video, canvasRef.current));
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load the hand-tracking model.");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      engineRef.current.reset();
    };
  }, [active]);

  return { videoRef, status, error, landmarks, pose, brightness };
}

function sampleBrightness(video: HTMLVideoElement, canvas: HTMLCanvasElement): number | null {
  const w = 32;
  const h = 24;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (w * h) / 255; // 0..1
}
