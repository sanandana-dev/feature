import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { Deal, Profile } from "./types";
import { useCamera } from "./useCamera";
import { useFullscreen } from "./useFullscreen";
import { DealStrip } from "./DealStrip";
import { captureMirrorSnapshot } from "./snapshot";
import { useAutoFitCv } from "./hooks/useAutoFitCv";
import { useShirtGestures } from "./hooks/useShirtGestures";
import { AutoFitControls } from "./AutoFitControls";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { MirrorControlsBar } from "./MirrorControlsBar";
import { LimitsHelpPopover } from "./LimitsHelpPopover";
import { FabricType, RealismLevel } from "./cv/types";

interface CameraOverlayProps {
  deal: Deal;
  deals: Deal[];
  onSelectDeal: (id: string) => void;
  onClose: () => void;
  profile?: Profile;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({ deal, deals, onSelectDeal, onClose, profile }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state: camState, errorMessage, videoRef, startCamera, stopCamera } = useCamera();
  const { isFullscreen, isPseudoFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen(containerRef);

  const [scale, setScale] = useState<number>(() => {
    try {
      const val = parseFloat(localStorage.getItem("dealfinder.tryon.mirror") || "1");
      return Number.isFinite(val) && val >= 0.5 && val <= 2.0 ? val : 1.0;
    } catch { return 1.0; }
  });
  const [rotate, setRotate] = useState<number>(0);
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [hasDragged, setHasDragged] = useState<boolean>(false);
  const [blendMode, setBlendMode] = useState<"realistic" | "solid">("realistic");
  const [snapshotMsg, setSnapshotMsg] = useState<string>("");
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [vpDim, setVpDim] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [autoFitEnabled, setAutoFitEnabled] = useState<boolean>(false);
  const [fabric, setFabric] = useState<FabricType>("cotton");
  const [realism, setRealism] = useState<RealismLevel>("high");
  const [showSilhouette, setShowSilhouette] = useState<boolean>(false);

  const shirtImgRef = useRef<HTMLImageElement>(null);
  const autoFitCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const isHoveringControls = useRef(false);

  const isTransparent = deal.imageUrl.toLowerCase().includes(".svg");
  const effectiveBlend = isTransparent ? blendMode : "realistic";
  const isFlat = deal.tryOnMode === "flat";
  const effectiveAutoFit = autoFitEnabled && isFlat;

  const {
    state: cvState, calibStep, calibCountdown, fps, latencyMs, qualityLevel, startCalibration,
  } = useAutoFitCv({
    enabled: effectiveAutoFit && camState === "active",
    videoRef,
    canvasRef: autoFitCanvasRef,
    shirtImgRef,
    fit: "regular",
    fabric,
    realism,
    showSilhouette,
    manualOffset: posRef.current,
    manualScale: scale,
    manualRotateDeg: rotate,
    profile,
  });

  const isLandscape = vpDim.w >= vpDim.h;
  const baseWidth = Math.min(900, Math.max(280, (vpDim.w || (isLandscape ? 800 : 400)) * (isLandscape ? 0.55 : 0.85)));
  const baseY = (vpDim.h || 600) * 0.50;

  const applyTransform = useCallback((x: number, y: number, s: number, r: number) => {
    if (shirtImgRef.current) {
      shirtImgRef.current.style.transform = `translate3d(calc(-50% + ${x}px), calc(${baseY}px + ${y}px), 0) scale(${s}) rotate(${r}deg)`;
    }
  }, [baseY]);

  const updateDimensions = useCallback(() => {
    if (viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      setVpDim({ w: rect.width, h: rect.height });
    }
  }, []);

  useLayoutEffect(() => {
    updateDimensions();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateDimensions) : null;
    if (viewportRef.current && ro) ro.observe(viewportRef.current);
    window.addEventListener("resize", updateDimensions);
    return () => { ro?.disconnect(); window.removeEventListener("resize", updateDimensions); };
  }, [updateDimensions, isFullscreen]);

  useEffect(() => {
    applyTransform(posRef.current.x, posRef.current.y, scale, rotate);
    try { localStorage.setItem("dealfinder.tryon.mirror", scale.toFixed(2)); } catch {}
  }, [scale, rotate, applyTransform]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsVisible(true);
    if ((isFullscreen || isPseudoFullscreen) && !isHoveringControls.current) {
      hideTimer.current = window.setTimeout(() => {
        if (!isHoveringControls.current) setControlsVisible(false);
      }, 3000);
    }
  }, [isFullscreen, isPseudoFullscreen]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isFullscreen, resetHideTimer]);

  const { onPointerDown, onPointerMove, onPointerUp } = useShirtGestures({
    isActive: camState === "active",
    scale,
    rotate,
    setScale,
    onDragStart: resetHideTimer,
    onDragMove: (dx, dy) => {
      resetHideTimer();
      posRef.current.x += dx;
      posRef.current.y += dy;
      setHasDragged(true);
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          applyTransform(posRef.current.x, posRef.current.y, scale, rotate);
          rafId.current = null;
        });
      }
    },
    onGestureEnd: resetHideTimer,
  });

  const statusText = !effectiveAutoFit ? "" :
    calibStep === "countdown" ? `Step out of frame... ${calibCountdown}` :
    calibStep === "capturing" ? "Capturing background..." :
    calibStep === "failed" ? "Background wasn't steady, try again" :
    cvState === "bumped" ? "Camera moved, please recalibrate" :
    cvState === "lost" ? "No silhouette found" :
    cvState === "tracking" ? "Auto-Fit Tracking ✓" : "";

  const isFull = isFullscreen || isPseudoFullscreen;

  return (
    <div ref={containerRef} className={`tryon-camera-overlay ${isFull ? "tryon-fullscreen-active" : ""}`} onPointerMove={resetHideTimer} onClick={resetHideTimer}>
      <div className={`tryon-fs-top-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <MirrorControlsBar
          scale={scale} rotate={rotate} blendMode={blendMode} isTransparent={isTransparent}
          isFlat={isFlat} autoFitEnabled={effectiveAutoFit} onScaleChange={setScale}
          onRotateChange={setRotate} onBlendChange={setBlendMode} onToggleAutoFit={() => setAutoFitEnabled((v) => !v)}
        />
        <div className="tryon-fs-actions">
          <LimitsHelpPopover />
          <button type="button" className={`tryon-touch-btn ${showGuide ? "active" : ""}`} onClick={() => setShowGuide((v) => !v)} aria-label="Toggle shoulder guide" title="Toggle shoulder guide" aria-pressed={showGuide}>👤</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); setHasDragged(false); applyTransform(0, 0, scale, 0); }} aria-label="Center shirt" title="Center shirt">🎯</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); setScale(1.0); setHasDragged(false); applyTransform(0, 0, 1.0, 0); }} aria-label="Reset position and size" title="Reset position and size">↺</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { setSnapshotMsg(""); const cap = effectiveAutoFit && autoFitCanvasRef.current ? autoFitCanvasRef.current : shirtImgRef.current; if (videoRef.current && viewportRef.current && cap) captureMirrorSnapshot(videoRef.current, viewportRef.current, cap, rotate, deal.id, effectiveBlend, effectiveAutoFit, () => setSnapshotMsg("Snapshot isn't available for this image. Use your screenshot instead.")); }} aria-label="Take snapshot" title="Take snapshot">📷</button>
          <button type="button" className="tryon-touch-btn" onClick={toggleFullscreen} aria-label={isFull ? "Exit full screen" : "Enter full screen"} title={isFull ? "Exit full screen" : "Enter full screen"}>{isFull ? "⤡" : "⛶"}</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { if (isFullscreen) exitFullscreen(); stopCamera(); onClose(); }} aria-label="Close" title="Close">✕</button>
        </div>
      </div>

      <div className={`tryon-fs-deal-pill tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <span className="tryon-deal-compact-title">{deal.title}</span>
        <span className="tryon-deal-compact-price">₹{deal.price.toLocaleString("en-IN")}</span>
        <a href={deal.buyUrl} target="_blank" rel="noopener noreferrer" className="tryon-buy-btn tryon-buy-btn-compact" aria-label={`Buy on ${deal.store}`}>Buy on {deal.store}</a>
        {effectiveAutoFit && statusText && <span className={`tryon-autofit-badge ${cvState === "tracking" ? "calibrated" : ""}`}>{statusText}</span>}
      </div>

      {effectiveAutoFit && (
        <AutoFitControls visible={controlsVisible} isFull={isFull} fabric={fabric} realism={realism} showSilhouette={showSilhouette} onFabricChange={setFabric} onRealismChange={setRealism} onToggleSilhouette={() => setShowSilhouette((v) => !v)} onRecalibrate={startCalibration} />
      )}

      {import.meta.env.DEV && effectiveAutoFit && cvState === "tracking" && (
        <div className="tryon-dev-fps" aria-hidden="true">{fps} FPS | {latencyMs}ms | {qualityLevel}</div>
      )}

      <div aria-live="polite" className="tryon-sr-only">{statusText}</div>

      <div ref={viewportRef} className="tryon-mirror-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ touchAction: "none" }}>
        <video ref={videoRef} autoPlay playsInline muted className="tryon-mirror-video" style={{ visibility: camState === "active" ? "visible" : "hidden" }} />
        <canvas ref={autoFitCanvasRef} className={`tryon-mirror-autofit-canvas ${effectiveBlend === "solid" ? "tryon-blend-solid" : "tryon-blend-realistic"}`} style={{ display: effectiveAutoFit && calibStep === "ready" ? "block" : "none" }} />

        {effectiveAutoFit && <CalibrationOverlay step={calibStep} countdown={calibCountdown} onRetry={startCalibration} />}

        {camState !== "active" && (
          <div className="tryon-camera-prompt">
            {camState === "requesting" && <p>Requesting camera access...</p>}
            {camState === "waiting-for-video" && <p>Starting camera...</p>}
            {camState !== "requesting" && camState !== "waiting-for-video" && (
              <>
                <p className="tryon-camera-privacy">Your camera stays on your device. Nothing is recorded or uploaded.</p>
                {errorMessage && <p className="tryon-camera-err-text">{errorMessage}</p>}
                {camState !== "unsupported" && <button type="button" className="tryon-buy-btn" onClick={() => startCamera()} aria-label="Turn on camera">{camState === "error" || camState === "denied" ? "Retry" : "Turn on camera"}</button>}
              </>
            )}
          </div>
        )}

        {showGuide && camState === "active" && !effectiveAutoFit && (
          <>
            <svg className="tryon-shoulder-guide" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="500" cy="280" rx="55" ry="70" vectorEffect="non-scaling-stroke" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 6" />
              <path d="M 250 540 Q 360 480 440 470 Q 500 472 560 470 Q 640 480 750 540" vectorEffect="non-scaling-stroke" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 6" />
            </svg>
            {!hasDragged && <p className="tryon-guide-caption" aria-hidden="true">Line up your shoulders here</p>}
          </>
        )}

        {camState === "active" && (
          <img ref={shirtImgRef} src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className={`tryon-mirror-shirt-img ${effectiveBlend === "solid" ? "tryon-blend-solid" : "tryon-blend-realistic"}`} style={{ width: `${baseWidth}px`, display: effectiveAutoFit && cvState === "tracking" ? "none" : "block" }} draggable={false} />
        )}
      </div>

      {snapshotMsg && <p className="tryon-snapshot-alert" role="status">{snapshotMsg}</p>}

      <div className={`tryon-fs-bottom-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <div className="tryon-fs-strip-wrap">
          <DealStrip deals={deals} activeDealId={deal.id} onSelect={onSelectDeal} />
        </div>
        <p className="tryon-fs-footnote">Works best with a fixed camera, steady light and one person in frame. Style preview only, not a fit check.</p>
      </div>
    </div>
  );
};
