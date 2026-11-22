import { useState, useRef, useEffect } from "react";
import { AutoFitCvState, BodyMeasurements, CalibrationStep, FabricType, RealismLevel } from "../cv/types";
import { createBackgroundModel, accumulateFrame, finalizeBackgroundModel } from "../cv/backgroundModel";
import { detectSilhouette, DetectBuffers } from "../cv/detectSilhouette";
import { TrackingStateManager } from "../cv/trackingState";
import { generateSilhouetteMesh } from "../cv/meshBuilder";
import { ClothSimulator } from "../render/clothSimulation";
import { renderGarmentMesh } from "../render/meshRenderer";
import { renderSilhouetteOverlay } from "../cv/renderSilhouetteOverlay";
import { FitType, Profile } from "../types";
import { useCvFilters } from "./useCvFilters";
import { CV_CONFIG } from "../cv/config";

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
  profile?: Profile;
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
  profile,
}: UseAutoFitCvProps) {
  const [state, setState] = useState<AutoFitCvState>("off");
  const [calibStep, setCalibStep] = useState<CalibrationStep>("idle");
  const [calibCountdown, setCalibCountdown] = useState<number>(CV_CONFIG.calibration.countdownSeconds);
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

  // Pre-allocated typed arrays for zero-allocation CV loop
  const buffersRef = useRef<DetectBuffers | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const prevMaskRef = useRef<Uint8Array | null>(null);

  // Setup offscreen CV canvas
  useEffect(() => {
    if (typeof document !== "undefined" && !cvCanvasRef.current) {
      const cvCanvas = document.createElement("canvas");
      cvCanvas.width = CV_CONFIG.grid.width;
      cvCanvas.height = CV_CONFIG.grid.defaultHeight;
      cvCanvasRef.current = cvCanvas;
      cvCtxRef.current = cvCanvas.getContext("2d", { willReadFrequently: true });
    }
  }, []);

  const startCalibration = () => {
    setCalibStep("countdown");
    setCalibCountdown(CV_CONFIG.calibration.countdownSeconds);
    setState("calibrating");
  };

  useEffect(() => {
    if (!enabled) {
      setState("off");
      setCalibStep("idle");
      bgModelRef.current = null;
      return;
    }
    startCalibration();
  }, [enabled]);

  useEffect(() => {
    if (calibStep === "countdown") {
      const timer = window.setInterval(() => {
        setCalibCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCalibStep("capturing");
            bgModelRef.current = createBackgroundModel(CV_CONFIG.grid.width, CV_CONFIG.grid.defaultHeight);
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
        const targetH = Math.round((CV_CONFIG.grid.width * video.videoHeight) / (video.videoWidth || 1));
        if (cvCanvas.height !== targetH) {
          cvCanvas.height = targetH;
          const numPixels = CV_CONFIG.grid.width * targetH;
          buffersRef.current = {
            rawMask: new Uint8Array(numPixels),
            tempBuf: new Uint8Array(numPixels),
            cleanedMask: new Uint8Array(numPixels),
            finalMask: new Uint8Array(numPixels),
          };
          prevFrameDataRef.current = new Uint8ClampedArray(numPixels * 4);
          prevMaskRef.current = new Uint8Array(numPixels);
        }

        if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
        }

        cvCtx.drawImage(video, 0, 0, CV_CONFIG.grid.width, cvCanvas.height);
        const frameData = cvCtx.getImageData(0, 0, CV_CONFIG.grid.width, cvCanvas.height).data;

        // Calibration capture
        if (calibStep === "capturing" && bgModelRef.current) {
          accumulateFrame(bgModelRef.current, frameData);
          captureFramesCount++;
          if (captureFramesCount >= CV_CONFIG.calibration.captureFrames) {
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

        // Live CV tracking
        if (calibStep === "ready" && bgModelRef.current && (state === "tracking" || state === "lost" || state === "bumped")) {
          const model = bgModelRef.current;
          if (now - lastDetectTime.current >= 33) {
            lastDetectTime.current = now;
            const t0 = performance.now();

            const { mask, measurements, bumped } = detectSilhouette(
              frameData,
              model,
              CV_CONFIG.grid.width,
              cvCanvas.height,
              prevMeasurements.current,
              profile,
              prevFrameDataRef.current,
              prevMaskRef.current,
              buffersRef.current ?? undefined
            );

            // Copy to previous frame / mask for motion assist & temporal stability
            if (prevFrameDataRef.current) prevFrameDataRef.current.set(frameData);
            if (prevMaskRef.current) prevMaskRef.current.set(mask);
            currentMaskRef.current = mask;

            if (bumped) setState("bumped");
            else if (state === "bumped") setState("tracking");

            if (measurements && measurements.confidence > 0.4) {
              prevMeasurements.current = measurements;
            }
            setLatencyMs(Math.round(performance.now() - t0));
          }

          const tracking = trackingMgr.current.update(prevMeasurements.current, now);
          if (tracking.status === "lost" && state !== "lost" && state !== "bumped") {
            setState("lost");
          } else if (tracking.status === "tracking" && state === "lost") {
            setState("tracking");
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (showSilhouette && currentMaskRef.current) {
              renderSilhouetteOverlay(ctx, currentMaskRef.current, canvas.width, canvas.height, CV_CONFIG.grid.width, cvCanvas.height);
            }

            if (tracking.measurements && tracking.opacity > 0.01 && shirt) {
              const m = tracking.measurements;
              const sx = canvas.width / CV_CONFIG.grid.width;
              const sy = canvas.height / cvCanvas.height;

              const smoothM = applyFilters(m, now);
              const cols = qualityLevel === "low" ? CV_CONFIG.mesh.lowCols : CV_CONFIG.mesh.highCols;
              const rows = qualityLevel === "low" ? CV_CONFIG.mesh.lowRows : CV_CONFIG.mesh.highRows;

              const baseMesh = generateSilhouetteMesh(smoothM, {
                cols, rows, fit, scaleX: sx, scaleY: sy, manualOffset, manualScale, manualRotateDeg,
              });

              const isReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
        if (avgDt > CV_CONFIG.mesh.degradeFrameTimeMs && qualityLevel !== "low") setQualityLevel("low");
        else if (avgDt < CV_CONFIG.mesh.upgradeFrameTimeMs && qualityLevel === "low") setQualityLevel("high");

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
  }, [enabled, state, calibStep, fit, fabric, realism, showSilhouette, qualityLevel, manualOffset, manualScale, manualRotateDeg, profile, videoRef, canvasRef, shirtImgRef]);

  return { state, calibStep, calibCountdown, fps, latencyMs, qualityLevel, startCalibration };
}
