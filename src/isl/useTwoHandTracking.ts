import { useEffect, useRef, useState } from "react";
import { getHandLandmarker } from "../mediapipe/handLandmarker";
import type { TrackedHand } from "./pose";

export type TrackingStatus = "starting" | "ready" | "error";

type FrameHandler = (hands: TrackedHand[], aspect: number, now: number) => void;

export function useTwoHandTracking(onFrame: FrameHandler) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState<TrackingStatus>("starting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
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
        setStatus("ready");

        let lastVideoTime = -1;
        const loop = () => {
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const now = performance.now();
            const result = landmarker.detectForVideo(video, now);
            // Handedness refers to the signer's real hands because the frame we
            // pass in is not mirrored (only the on-screen preview is).
            const hands = result.landmarks.map((lm, i): TrackedHand => {
              const category = result.handedness[i]?.[0];
              return {
                side: category?.categoryName === "Left" ? "Left" : "Right",
                score: category?.score ?? 0,
                landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
              };
            });
            onFrameRef.current(hands, video.videoWidth / video.videoHeight || 4 / 3, now);
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "The camera or hand-tracking model failed to start.");
          setStatus("error");
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { videoRef, status, error };
}
