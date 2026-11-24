import { useEffect, useRef, useState } from "react";
import { getHandLandmarker } from "../mediapipe/handLandmarker";
import type { RawHand } from "./hands";

export type CameraStatus = "off" | "starting" | "ready" | "error";

type FrameHandler = (hands: RawHand[], aspect: number, now: number) => void;

export function useCamera(enabled: boolean, onFrame: FrameHandler) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFrameRef = useRef(onFrame);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status: CameraStatus = !enabled ? "off" : error ? "error" : ready ? "ready" : "starting";

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 540 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const landmarker = await getHandLandmarker(2);
        if (cancelled) return;
        setReady(true);

        let lastVideoTime = -1;
        const loop = () => {
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const now = performance.now();
            const result = landmarker.detectForVideo(video, now);
            const hands = result.landmarks.map(
              (lm, i): RawHand => ({
                side: result.handedness[i]?.[0]?.categoryName === "Left" ? "Left" : "Right",
                landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
              })
            );
            onFrameRef.current(hands, video.videoWidth / video.videoHeight || 16 / 9, now);
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "The camera or hand-tracking model failed to start.");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      setReady(false);
      setError(null);
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  return { videoRef, status, error };
}
