import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { Deal } from "./types";
import { useCamera } from "./useCamera";
import { useFullscreen } from "./useFullscreen";
import { DealStrip } from "./DealStrip";
import { captureMirrorSnapshot } from "./snapshot";

interface CameraOverlayProps {
  deal: Deal;
  deals: Deal[];
  onSelectDeal: (id: string) => void;
  onClose: () => void;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({ deal, deals, onSelectDeal, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, errorMessage, videoRef, startCamera, stopCamera } = useCamera();
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

  const shirtImgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const isHoveringControls = useRef(false);

  const isTransparent = deal.imageUrl.toLowerCase().includes(".svg");
  const effectiveBlend = isTransparent ? blendMode : "realistic";

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
        if (pointers.current.size === 0 && !isHoveringControls.current) setControlsVisible(false);
      }, 3000);
    }
  }, [isFullscreen, isPseudoFullscreen]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isFullscreen, resetHideTimer]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    resetHideTimer();
    if (state !== "active") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastSingle.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStart.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    resetHideTimer();
    if (state !== "active" || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && lastSingle.current) {
      const dx = e.clientX - lastSingle.current.x;
      const dy = e.clientY - lastSingle.current.y;
      lastSingle.current = { x: e.clientX, y: e.clientY };
      posRef.current.x += dx;
      posRef.current.y += dy;
      setHasDragged(true);
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          applyTransform(posRef.current.x, posRef.current.y, scale, rotate);
          rafId.current = null;
        });
      }
    } else if (pointers.current.size === 2 && pinchStart.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const next = Math.min(2.0, Math.max(0.5, pinchStart.current.scale * (dist / pinchStart.current.dist)));
      setScale(Number(next.toFixed(2)));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    try { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    lastSingle.current = pointers.current.size === 1 ? (pointers.current.values().next().value ?? null) : null;
    if (pointers.current.size < 2) pinchStart.current = null;
    resetHideTimer();
  };

  const isFull = isFullscreen || isPseudoFullscreen;

  return (
    <div ref={containerRef} className={`tryon-camera-overlay ${isFull ? "tryon-fullscreen-active" : ""}`} onPointerMove={resetHideTimer} onClick={resetHideTimer}>
      <div className={`tryon-fs-top-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <div className="tryon-translucent-pill">
          <label htmlFor="tryon-fs-scale" className="tryon-fs-label">Size</label>
          <input id="tryon-fs-scale" type="range" min={0.5} max={2.0} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="tryon-slider tryon-slider-tiny" aria-label="Scale shirt size" />
          <label htmlFor="tryon-fs-rotate" className="tryon-fs-label">Rotate</label>
          <input id="tryon-fs-rotate" type="range" min={-15} max={15} step={1} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} className="tryon-slider tryon-slider-tiny" aria-label="Rotate shirt angle" />
          <div className="tryon-blend-toggle" role="group" aria-label="Blend mode">
            <button type="button" className={`tryon-blend-btn ${effectiveBlend === "realistic" ? "active" : ""}`} onClick={() => setBlendMode("realistic")} aria-label="Realistic blend mode">Realistic</button>
            <button type="button" className={`tryon-blend-btn ${effectiveBlend === "solid" ? "active" : ""}`} onClick={() => isTransparent && setBlendMode("solid")} disabled={!isTransparent} title={!isTransparent ? "Needs a transparent image" : "Solid blend mode"} aria-label="Solid blend mode">Solid</button>
          </div>
        </div>
        <div className="tryon-fs-actions">
          <button type="button" className={`tryon-touch-btn ${showGuide ? "active" : ""}`} onClick={() => setShowGuide((v) => !v)} aria-label="Toggle shoulder guide" title="Toggle shoulder guide" aria-pressed={showGuide}>👤</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); setHasDragged(false); applyTransform(0, 0, scale, 0); }} aria-label="Center shirt" title="Center shirt">🎯</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); setScale(1.0); setHasDragged(false); applyTransform(0, 0, 1.0, 0); }} aria-label="Reset position and size" title="Reset position and size">↺</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { setSnapshotMsg(""); if (videoRef.current && viewportRef.current && shirtImgRef.current) captureMirrorSnapshot(videoRef.current, viewportRef.current, shirtImgRef.current, rotate, deal.id, effectiveBlend, () => setSnapshotMsg("Snapshot isn't available for this image. Use your screenshot instead.")); }} aria-label="Take snapshot" title="Take snapshot">📷</button>
          <button type="button" className="tryon-touch-btn" onClick={toggleFullscreen} aria-label={isFull ? "Exit full screen" : "Enter full screen"} title={isFull ? "Exit full screen" : "Enter full screen"}>{isFull ? "⤡" : "⛶"}</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { if (isFullscreen) exitFullscreen(); stopCamera(); onClose(); }} aria-label="Close" title="Close">✕</button>
        </div>
      </div>

      <div className={`tryon-fs-deal-pill tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <span className="tryon-deal-compact-title">{deal.title}</span>
        <span className="tryon-deal-compact-price">₹{deal.price.toLocaleString("en-IN")}</span>
        <a href={deal.buyUrl} target="_blank" rel="noopener noreferrer" className="tryon-buy-btn tryon-buy-btn-compact" aria-label={`Buy on ${deal.store}`}>Buy on {deal.store}</a>
      </div>

      <div ref={viewportRef} className="tryon-mirror-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ touchAction: "none" }}>
        <video ref={videoRef} autoPlay playsInline muted className="tryon-mirror-video" style={{ visibility: state === "active" ? "visible" : "hidden" }} />
        {state !== "active" && (
          <div className="tryon-camera-prompt">
            {state === "requesting" && <p>Requesting camera access...</p>}
            {state === "waiting-for-video" && <p>Starting camera...</p>}
            {state !== "requesting" && state !== "waiting-for-video" && (
              <>
                <p className="tryon-camera-privacy">Your camera stays on your device. Nothing is recorded or uploaded.</p>
                {errorMessage && <p className="tryon-camera-err-text">{errorMessage}</p>}
                {state !== "unsupported" && <button type="button" className="tryon-buy-btn" onClick={() => startCamera()} aria-label="Turn on camera">{state === "error" || state === "denied" ? "Retry" : "Turn on camera"}</button>}
              </>
            )}
          </div>
        )}
        {showGuide && state === "active" && (
          <>
            <svg className="tryon-shoulder-guide" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
              <ellipse cx="500" cy="280" rx="55" ry="70" vectorEffect="non-scaling-stroke" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 6" />
              <path d="M 250 540 Q 360 480 440 470 Q 500 472 560 470 Q 640 480 750 540" vectorEffect="non-scaling-stroke" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeDasharray="8 6" />
            </svg>
            {!hasDragged && <p className="tryon-guide-caption" aria-hidden="true">Line up your shoulders here</p>}
          </>
        )}
        {state === "active" && (
          <img ref={shirtImgRef} src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className={`tryon-mirror-shirt-img ${effectiveBlend === "solid" ? "tryon-blend-solid" : "tryon-blend-realistic"}`} style={{ width: `${baseWidth}px` }} draggable={false} />
        )}
      </div>

      {snapshotMsg && <p className="tryon-snapshot-alert" role="status">{snapshotMsg}</p>}

      <div className={`tryon-fs-bottom-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`} onPointerEnter={() => { isHoveringControls.current = true; }} onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}>
        <div className="tryon-fs-strip-wrap">
          <DealStrip deals={deals} activeDealId={deal.id} onSelect={onSelectDeal} />
        </div>
        <p className="tryon-fs-footnote">Style preview only, not a fit check</p>
      </div>
    </div>
  );
};
