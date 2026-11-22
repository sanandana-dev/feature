import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const [snapshotMsg, setSnapshotMsg] = useState<string>("");
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);

  const shirtImgRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const isHoveringControls = useRef(false);

  const applyTransform = useCallback((x: number, y: number, s: number, r: number) => {
    if (shirtImgRef.current) {
      shirtImgRef.current.style.transform = `translate3d(calc(-50% + ${x}px), ${y}px, 0) scale(${s}) rotate(${r}deg)`;
    }
  }, []);

  useEffect(() => {
    applyTransform(posRef.current.x, posRef.current.y, scale, rotate);
    try { localStorage.setItem("dealfinder.tryon.mirror", scale.toFixed(2)); } catch {}
  }, [scale, rotate, applyTransform]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsVisible(true);
    if (isFullscreen && !isHoveringControls.current) {
      hideTimer.current = window.setTimeout(() => {
        if (pointers.current.size === 0 && !isHoveringControls.current) setControlsVisible(false);
      }, 3000);
    }
  }, [isFullscreen]);

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

  const handleClose = () => {
    if (isFullscreen) exitFullscreen();
    stopCamera();
    onClose();
  };

  const takeSnapshot = () => {
    setSnapshotMsg("");
    const video = videoRef.current;
    const vp = viewportRef.current;
    const shirt = shirtImgRef.current;
    if (!video || !vp || !shirt) return;
    captureMirrorSnapshot(video, vp, shirt, rotate, deal.id, () => {
      setSnapshotMsg("Snapshot isn't available for this image. Use your screenshot instead.");
    });
  };

  const isFull = isFullscreen || isPseudoFullscreen;

  return (
    <div
      ref={containerRef}
      className={`tryon-camera-overlay ${isFull ? "tryon-fullscreen-active" : ""}`}
      onPointerMove={resetHideTimer}
      onClick={resetHideTimer}
    >
      {/* Top Controls Overlay */}
      <div
        className={`tryon-fs-top-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`}
        onPointerEnter={() => { isHoveringControls.current = true; }}
        onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}
      >
        <div className="tryon-translucent-pill">
          <label htmlFor="tryon-fs-scale" className="tryon-fs-label">Size</label>
          <input id="tryon-fs-scale" type="range" min={0.5} max={1.8} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="tryon-slider tryon-slider-tiny" aria-label="Scale shirt size" />
          <label htmlFor="tryon-fs-rotate" className="tryon-fs-label">Rotate</label>
          <input id="tryon-fs-rotate" type="range" min={-15} max={15} step={1} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} className="tryon-slider tryon-slider-tiny" aria-label="Rotate shirt angle" />
        </div>
        <div className="tryon-fs-actions">
          <button type="button" className={`tryon-touch-btn ${showGuide ? "active" : ""}`} onClick={() => setShowGuide((v) => !v)} aria-label="Toggle shoulder guide" title="Toggle shoulder guide" aria-pressed={showGuide}>👤</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); applyTransform(0, 0, scale, 0); }} aria-label="Center shirt" title="Center shirt">🎯</button>
          <button type="button" className="tryon-touch-btn" onClick={() => { posRef.current = { x: 0, y: 0 }; setRotate(0); setScale(1.0); applyTransform(0, 0, 1.0, 0); }} aria-label="Reset position and size" title="Reset position and size">↺</button>
          <button type="button" className="tryon-touch-btn" onClick={takeSnapshot} aria-label="Take snapshot" title="Take snapshot">📷</button>
          <button type="button" className="tryon-touch-btn" onClick={toggleFullscreen} aria-label={isFull ? "Exit full screen" : "Enter full screen"} title={isFull ? "Exit full screen" : "Enter full screen"}>{isFull ? "⤡" : "⛶"}</button>
          <button type="button" className="tryon-touch-btn" onClick={handleClose} aria-label="Close" title="Close">✕</button>
        </div>
      </div>

      {/* Main Viewport */}
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
                {state !== "unsupported" && (
                  <button type="button" className="tryon-buy-btn" onClick={() => startCamera()} aria-label="Turn on camera">{state === "error" || state === "denied" ? "Retry" : "Turn on camera"}</button>
                )}
              </>
            )}
          </div>
        )}
        {showGuide && state === "active" && (
          <svg className="tryon-shoulder-guide" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <ellipse cx="150" cy="110" rx="38" ry="50" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" />
            <path d="M 30 250 Q 80 170 110 160 Q 150 163 190 160 Q 220 170 270 250" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" />
          </svg>
        )}
        {state === "active" && (
          <img ref={shirtImgRef} src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className="tryon-mirror-shirt-img" draggable={false} />
        )}
      </div>

      {snapshotMsg && <p className="tryon-snapshot-alert" role="status">{snapshotMsg}</p>}

      {/* Bottom Overlaid / Stacked Deal Controls */}
      <div
        className={`tryon-fs-bottom-bar tryon-fs-overlay ${!controlsVisible && isFull ? "hidden" : ""}`}
        onPointerEnter={() => { isHoveringControls.current = true; }}
        onPointerLeave={() => { isHoveringControls.current = false; resetHideTimer(); }}
      >
        <div className="tryon-deal-compact-row">
          <span className="tryon-deal-compact-title">{deal.title}</span>
          <span className="tryon-deal-compact-price">₹{deal.price.toLocaleString("en-IN")}</span>
          <a href={deal.buyUrl} target="_blank" rel="noopener noreferrer" className="tryon-buy-btn tryon-buy-btn-compact" aria-label={`Buy on ${deal.store}`}>Buy on {deal.store}</a>
        </div>
        <div className="tryon-fs-strip-wrap">
          <DealStrip deals={deals} activeDealId={deal.id} onSelect={onSelectDeal} />
        </div>
        <p className="tryon-fs-footnote">Style preview only, not a fit check</p>
      </div>
    </div>
  );
};
