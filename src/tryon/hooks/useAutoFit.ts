import { useState, useRef, useEffect } from "react";
import { AutoFitState, BodyAnchors, FabricType, RealismLevel } from "../pose/types";
import { poseToAnchors } from "../pose/poseToAnchors";
import { OneEuroFilter2D } from "../pose/oneEuroFilter";
import { TrackingStateManager } from "../pose/trackingState";
import { generateGarmentMesh } from "../pose/meshGenerator";
import { ClothSimulator } from "../render/clothSimulation";
import { renderGarmentMesh } from "../render/meshRenderer";
import { FitType } from "../types";
import { loadPoseLandmarker } from "./loadLandmarker";

export interface UseAutoFitProps {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  shirtImgRef: React.RefObject<HTMLImageElement>;
  fit?: FitType;
  fabric?: FabricType;
  realism?: RealismLevel;
  manualOffset?: { x: number; y: number };
  manualScale?: number;
  manualRotateDeg?: number;
}

export interface UseAutoFitResult {
  state: AutoFitState;
  isCalibrated: boolean;
  fps: number;
  latencyMs: number;
  qualityLevel: "high" | "medium" | "low";
}

export function useAutoFit({
  enabled,
  videoRef,
  canvasRef,
  shirtImgRef,
  fit = "regular",
  fabric = "cotton",
  realism = "high",
  manualOffset = { x: 0, y: 0 },
  manualScale = 1.0,
  manualRotateDeg = 0,
}: UseAutoFitProps): UseAutoFitResult {
  const [state, setState] = useState<AutoFitState>("off");
  const [isCalibrated, setIsCalibrated] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [qualityLevel, setQualityLevel] = useState<"high" | "medium" | "low">("high");

  const landmarkerRef = useRef<unknown>(null);
  const isRunningRef = useRef(false);
  const trackingManager = useRef(new TrackingStateManager());
  const clothSim = useRef(new ClothSimulator());

  const lsFilter = useRef(new OneEuroFilter2D());
  const rsFilter = useRef(new OneEuroFilter2D());
  const lhFilter = useRef(new OneEuroFilter2D());
  const rhFilter = useRef(new OneEuroFilter2D());
  const neckFilter = useRef(new OneEuroFilter2D());

  const lastDetectTime = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const calibrationStartTime = useRef<number | null>(null);

  // Initialize MediaPipe PoseLandmarker lazily
  useEffect(() => {
    if (!enabled) {
      setState("off");
      if (landmarkerRef.current) {
        try { (landmarkerRef.current as { close?: () => void }).close?.(); } catch {}
        landmarkerRef.current = null;
      }
      return;
    }

    let isCancelled = false;
    setState("loading");

    loadPoseLandmarker()
      .then((landmarker) => {
        if (isCancelled) {
          try { (landmarker as { close?: () => void }).close?.(); } catch {}
          return;
        }
        landmarkerRef.current = landmarker;
        setState("tracking");
      })
      .catch(() => {
        if (!isCancelled) setState("error");
      });

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try { (landmarkerRef.current as { close?: () => void }).close?.(); } catch {}
        landmarkerRef.current = null;
      }
    };
  }, [enabled]);

  // Main detection and render loop
  useEffect(() => {
    if (!enabled || !landmarkerRef.current || state === "error" || state === "off") {
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    let animId: number;
    let lastRenderTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const loop = () => {
      if (!isRunningRef.current) return;

      const now = performance.now();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const shirt = shirtImgRef.current;

      if (video && video.readyState >= 2 && canvas && shirt) {
        // Match canvas dimensions to viewport
        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Run pose detection at ~30fps
          const timeSinceDetect = now - lastDetectTime.current;
          let rawAnchors: BodyAnchors | null = null;

          if (timeSinceDetect >= 33 && landmarkerRef.current) {
            lastDetectTime.current = now;
            const detectStart = performance.now();
            try {
              const res = (landmarkerRef.current as {
                detectForVideo: (el: HTMLVideoElement, ts: number) => { landmarks?: { x: number; y: number; visibility?: number }[][] };
              }).detectForVideo(video, now);

              const lms = res.landmarks && res.landmarks[0];
              if (lms) {
                rawAnchors = poseToAnchors(
                  lms,
                  { videoWidth: video.videoWidth, videoHeight: video.videoHeight },
                  { width: canvas.width, height: canvas.height },
                  true // mirrored selfie view
                );
              }
            } catch {}
            setLatencyMs(Math.round(performance.now() - detectStart));
          }

          // Check calibration: shoulders visible continuously for 1s
          if (rawAnchors && rawAnchors.confidence >= 0.7) {
            if (calibrationStartTime.current === null) {
              calibrationStartTime.current = now;
            } else if (now - calibrationStartTime.current >= 1000) {
              setIsCalibrated(true);
            }
          } else {
            calibrationStartTime.current = null;
          }

          // Tracking state update (handles smooth fading)
          const tracking = trackingManager.current.update(rawAnchors, now);

          if (tracking.status === "lost" && state !== "lost") {
            setState("lost");
          } else if (tracking.status === "tracking" && state === "lost") {
            setState("tracking");
          }

          if (tracking.anchors && tracking.opacity > 0.01) {
            const sAnchors: BodyAnchors = {
              ...tracking.anchors,
              leftShoulder: lsFilter.current.filter(tracking.anchors.leftShoulder, now),
              rightShoulder: rsFilter.current.filter(tracking.anchors.rightShoulder, now),
              leftHip: lhFilter.current.filter(tracking.anchors.leftHip, now),
              rightHip: rhFilter.current.filter(tracking.anchors.rightHip, now),
              neck: neckFilter.current.filter(tracking.anchors.neck, now),
            };

            const cols = qualityLevel === "low" ? 6 : 8;
            const rows = qualityLevel === "low" ? 8 : 10;
            const baseMesh = generateGarmentMesh(sAnchors, { cols, rows, fit, manualOffset, manualScale, manualRotateDeg });
            const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const simMesh = clothSim.current.simulate(baseMesh, fabric, isReducedMotion);
            renderGarmentMesh(ctx, shirt, simMesh, tracking.opacity, qualityLevel === "low" ? "low" : realism);
          }
        }

        const frameDt = now - lastRenderTime;
        lastRenderTime = now;
        frameTimes.current.push(frameDt);
        if (frameTimes.current.length > 30) frameTimes.current.shift();
        const avgFrameDt = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
        if (avgFrameDt > 40 && qualityLevel !== "low") setQualityLevel("low");
        else if (avgFrameDt < 25 && qualityLevel === "low") setQualityLevel("high");

        frameCount++;
        if (now - lastFpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = now;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animId);
      trackingManager.current.reset();
      clothSim.current.reset();
      [lsFilter, rsFilter, lhFilter, rhFilter, neckFilter].forEach((f) => f.current.reset());
    };
  }, [enabled, state, qualityLevel, fit, fabric, realism, manualOffset, manualScale, manualRotateDeg, videoRef, canvasRef, shirtImgRef]);

  return { state, isCalibrated, fps, latencyMs, qualityLevel };
}
