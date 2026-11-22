import { useState, useRef, useEffect } from "react";
import { AutoFitCvState, BodyMeasurements, CalibrationStep, FabricType, RealismLevel } from "../cv/types";
import { createBackgroundModel, accumulateFrame, finalizeBackgroundModel } from "../cv/backgroundModel";
import { detectSilhouette } from "../cv/detectSilhouette";
import { TrackingStateManager } from "../cv/trackingState";
import { generateSilhouetteMesh } from "../cv/meshBuilder";
import { ClothSimulator } from "../render/clothSimulation";
import { renderGarmentMesh } from "../render/meshRenderer";
import { renderSilhouetteOverlay } from "../cv/renderSilhouetteOverlay";
import { FitType } from "../types";
import { useCvFilters } from "./useCvFilters";

export interface UseAutoFitCvProps {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  shirtImgRef: React.RefObject<HTMLImageElement>;
  fit?: FitType;
  fabric?: FabricType;
  realism?: RealismLevel;
  showSilhouette?: boolean;
  manualOffset?: { x: number; y: number };
  manualScale?: number;
  manualRotateDeg?: number;
}

export function useAutoFitCv({
  enabled,
  videoRef,
  canvasRef,
  shirtImgRef,
  fit = "regular",
  fabric = "cotton",
  realism = "high",
  showSilhouette = false,
  manualOffset = { x: 0, y: 0 },
  manualScale = 1.0,
  manualRotateDeg = 0,
}: UseAutoFitCvProps) {
  const [state, setState] = useState<AutoFitCvState>("off");
  const [calibStep, setCalibStep] = useState<CalibrationStep>("idle");
  const [calibCountdown, setCalibCountdown] = useState<number>(3);
  const [fps, setFps] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [qualityLevel, setQualityLevel] = useState<"high" | "low">("high");

  const bgModelRef = useRef<ReturnType<typeof createBackgroundModel> | null>(null);
  const cvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cvCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isRunningRef = useRef(false);
  const trackingMgr = useRef(new TrackingStateManager());
  const clothSim = useRef(new ClothSimulator());
  const { applyFilters, resetFilters } = useCvFilters();

  const lastDetectTime = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const prevMeasurements = useRef<BodyMeasurements | null>(null);
  const currentMaskRef = useRef<Uint8Array | null>(null);

  // Setup offscreen CV canvas (160px wide, maintaining aspect ratio)
  useEffect(() => {
    if (typeof document !== "undefined" && !cvCanvasRef.current) {
      const cvCanvas = document.createElement("canvas");
      cvCanvas.width = 160;
      cvCanvas.height = 120;
      cvCanvasRef.current = cvCanvas;
      cvCtxRef.current = cvCanvas.getContext("2d", { willReadFrequently: true });
    }
  }, []);

  const startCalibration = () => {
    setCalibStep("countdown"); setCalibCountdown(3); setState("calibrating");
  };

  // Turn on/off logic
  useEffect(() => {
    if (!enabled) {
      setState("off");
      setCalibStep("idle");
      bgModelRef.current = null;
      return;
    }
    startCalibration();
  }, [enabled]);

  // Calibration flow countdown and capture
  useEffect(() => {
    if (calibStep === "countdown") {
      const timer = window.setInterval(() => {
        setCalibCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCalibStep("capturing");
            bgModelRef.current = createBackgroundModel(160, 120);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [calibStep]);

  // Main CV Vision & Render Loop
  useEffect(() => {
    if (!enabled || state === "off") {
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    let animId: number;
    let lastRender = performance.now();
    let frameCount = 0;
    let lastFps = performance.now();
    let captureFramesCount = 0;

    const loop = () => {
      if (!isRunningRef.current) return;
      const now = performance.now();
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const shirt = shirtImgRef.current;
      const cvCtx = cvCtxRef.current;
      const cvCanvas = cvCanvasRef.current;

      if (video && video.readyState >= 2 && canvas && cvCtx && cvCanvas) {
        // Adjust CV canvas aspect ratio to match video
        const targetH = Math.round((160 * video.videoHeight) / (video.videoWidth || 1));
        if (cvCanvas.height !== targetH) cvCanvas.height = targetH;

        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
        }

        // Downscale video frame onto CV canvas
        cvCtx.drawImage(video, 0, 0, 160, cvCanvas.height);
        const frameData = cvCtx.getImageData(0, 0, 160, cvCanvas.height).data;

        // Calibration frame capturing
        if (calibStep === "capturing" && bgModelRef.current) {
          accumulateFrame(bgModelRef.current, frameData);
          captureFramesCount++;
          if (captureFramesCount >= 45) { // ~1.5s at 30fps
            const valid = finalizeBackgroundModel(bgModelRef.current);
            if (valid) {
              setCalibStep("ready");
              setState("tracking");
            } else {
              setCalibStep("failed");
              setState("error");
            }
            captureFramesCount = 0;
          }
        }

        // Live CV tracking when background model is ready
        if (calibStep === "ready" && bgModelRef.current && (state === "tracking" || state === "lost" || state === "bumped")) {
          const model = bgModelRef.current;
          if (now - lastDetectTime.current >= 33) {
            lastDetectTime.current = now;
            const t0 = performance.now();

            const { mask, measurements, bumped } = detectSilhouette(
              frameData,
              model,
              160,
              cvCanvas.height,
              prevMeasurements.current
            );
            currentMaskRef.current = mask;
            if (bumped) setState("bumped");
            else if (state === "bumped") setState("tracking");
            if (measurements && measurements.confidence > 0.4) {
              prevMeasurements.current = measurements;
            }

            setLatencyMs(Math.round(performance.now() - t0));
          }

          // Tracking state update (handles 400ms timeout / 200ms fade)
          const tracking = trackingMgr.current.update(prevMeasurements.current, now);
          if (tracking.status === "lost" && state !== "lost" && state !== "bumped") {
            setState("lost");
          } else if (tracking.status === "tracking" && state === "lost") {
            setState("tracking");
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Debug silhouette overlay
            if (showSilhouette && currentMaskRef.current) {
              renderSilhouetteOverlay(ctx, currentMaskRef.current, canvas.width, canvas.height, 160, cvCanvas.height);
            }

            // Render warped garment mesh
            if (tracking.measurements && tracking.opacity > 0.01 && shirt) {
              const m = tracking.measurements;
              const sx = canvas.width / 160;
              const sy = canvas.height / cvCanvas.height;

              const smoothM = applyFilters(m, now);

              const cols = qualityLevel === "low" ? 8 : 10;
              const rows = qualityLevel === "low" ? 10 : 12;
              const baseMesh = generateSilhouetteMesh(smoothM, {
                cols, rows, fit, scaleX: sx, scaleY: sy, manualOffset, manualScale, manualRotateDeg,
              });
              const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              const simMesh = clothSim.current.simulate(baseMesh, fabric, isReduced);
              renderGarmentMesh(ctx, shirt, simMesh, tracking.opacity, qualityLevel === "low" ? "low" : realism);
            }
          }
        }

        const dt = now - lastRender;
        lastRender = now;
        frameTimes.current.push(dt);
        if (frameTimes.current.length > 30) frameTimes.current.shift();
        const avgDt = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
        if (avgDt > 40 && qualityLevel !== "low") setQualityLevel("low");
        else if (avgDt < 25 && qualityLevel === "low") setQualityLevel("high");

        if (now - lastFps >= 1000) {
          setFps(Math.round(((frameCount + 1) * 1000) / (now - lastFps)));
          frameCount = 0;
          lastFps = now;
        } else frameCount++;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animId);
      trackingMgr.current.reset();
      clothSim.current.reset();
      resetFilters();
    };
  }, [enabled, state, calibStep, fit, fabric, realism, showSilhouette, qualityLevel, manualOffset, manualScale, manualRotateDeg, videoRef, canvasRef, shirtImgRef]);

  return { state, calibStep, calibCountdown, fps, latencyMs, qualityLevel, startCalibration };
}
