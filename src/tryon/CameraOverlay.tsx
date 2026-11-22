import React, { useState, useRef, useEffect, useCallback } from "react";
import { Deal } from "./types";
import { useCamera } from "./useCamera";

const MIRROR_STORAGE_KEY = "dealfinder.tryon.mirror";

function getSavedScale(): number {
  try {
    const raw = localStorage.getItem(MIRROR_STORAGE_KEY);
    if (raw) {
      const val = parseFloat(raw);
      if (Number.isFinite(val) && val >= 0.5 && val <= 2.0) return val;
    }
  } catch {}
  return 1.0;
}

interface CameraOverlayProps {
  deal: Deal;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({ deal }) => {
  const { state, errorMessage, hasMultipleCameras, videoRef, startCamera, switchCamera } = useCamera();
  const [scale, setScale] = useState<number>(getSavedScale);
  const [rotate, setRotate] = useState<number>(0);
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [snapshotMsg, setSnapshotMsg] = useState<string>("");

  const shirtBoxRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);

  const applyTransform = useCallback((x: number, y: number, s: number, r: number) => {
    if (shirtBoxRef.current) {
      shirtBoxRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s}) rotate(${r}deg)`;
    }
  }, []);

  // Sync when scale or rotate slider changes
  useEffect(() => {
    applyTransform(posRef.current.x, posRef.current.y, scale, rotate);
    try {
      localStorage.setItem(MIRROR_STORAGE_KEY, scale.toFixed(2));
    } catch {}
  }, [scale, rotate, applyTransform]);

  // Pointer dragging with requestAnimationFrame (avoids re-rendering React state on move)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastSingle.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStart.current = { dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
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
      const nextScale = Math.min(2.0, Math.max(0.5, pinchStart.current.scale * (dist / pinchStart.current.dist)));
      setScale(Number(nextScale.toFixed(2)));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    lastSingle.current = pointers.current.size === 1 ? (pointers.current.values().next().value ?? null) : null;
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  const centerShirt = () => {
    posRef.current = { x: 0, y: 0 };
    setRotate(0);
    applyTransform(0, 0, scale, 0);
  };

  const resetAll = () => {
    posRef.current = { x: 0, y: 0 };
    setRotate(0);
    setScale(1.0);
    applyTransform(0, 0, 1.0, 0);
  };

  const takeSnapshot = () => {
    setSnapshotMsg("");
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      // 1. Draw mirrored video feed
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 2. Draw shirt un-mirrored with user offsets
      const img = shirtBoxRef.current?.querySelector("img");
      if (img && img.complete) {
        ctx.save();
        const stageW = 300;
        const scaleRatio = canvas.width / stageW;
        ctx.translate(canvas.width / 2 + posRef.current.x * scaleRatio, (canvas.height * 0.3) + posRef.current.y * scaleRatio);
        ctx.rotate((rotate * Math.PI) / 180);
        ctx.scale(scale * scaleRatio, scale * scaleRatio);
        const drawW = 160;
        const drawH = (img.naturalHeight / (img.naturalWidth || 1)) * drawW;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `style-preview-${deal.id}.png`;
      a.click();
    } catch {
      setSnapshotMsg("Snapshot isn't available for this image. Use your phone's screenshot instead.");
    }
  };

  return (
    <div className="tryon-camera-overlay">
      <div className="tryon-doll-toolbar">
        <div className="tryon-tool-item">
          <label htmlFor="tryon-m-scale" className="tryon-tool-label">Size:</label>
          <input id="tryon-m-scale" type="range" min={0.5} max={1.8} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="tryon-slider tryon-slider-mini" aria-label="Scale shirt" />
        </div>
        <div className="tryon-tool-item">
          <label htmlFor="tryon-m-rotate" className="tryon-tool-label">Rotate:</label>
          <input id="tryon-m-rotate" type="range" min={-15} max={15} step={1} value={rotate} onChange={(e) => setRotate(Number(e.target.value))} className="tryon-slider tryon-slider-mini" aria-label="Rotate shirt" />
        </div>
        <div className="tryon-tool-item tryon-btn-group">
          <button type="button" className={`tryon-action-btn ${showGuide ? "active" : ""}`} onClick={() => setShowGuide((v) => !v)} aria-pressed={showGuide}>Guide</button>
          <button type="button" className="tryon-action-btn" onClick={centerShirt}>Center</button>
          <button type="button" className="tryon-action-btn" onClick={resetAll}>Reset</button>
        </div>
      </div>

      <div className="tryon-mirror-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={{ touchAction: "none" }}>
        {state === "active" ? (
          <video ref={videoRef} autoPlay playsInline muted className="tryon-mirror-video" />
        ) : (
          <div className="tryon-camera-prompt">
            {state === "requesting" ? (
              <p>Requesting camera access...</p>
            ) : (
              <>
                <p className="tryon-camera-privacy">Your camera stays on your device. Nothing is recorded or uploaded.</p>
                {errorMessage && <p className="tryon-camera-err-text">{errorMessage}</p>}
                {state !== "unsupported" && (
                  <button type="button" className="tryon-buy-btn" onClick={() => startCamera()}>Turn on camera</button>
                )}
              </>
            )}
          </div>
        )}

        {showGuide && state === "active" && (
          <svg className="tryon-shoulder-guide" viewBox="0 0 300 400" aria-hidden="true">
            <ellipse cx="150" cy="85" rx="35" ry="45" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
            <path d="M 40 240 Q 80 160 115 150 Q 150 152 185 150 Q 220 160 260 240" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.6" />
          </svg>
        )}

        <div ref={shirtBoxRef} className="tryon-mirror-shirt-box" style={{ willChange: "transform" }}>
          <img src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className="tryon-shirt-img" draggable={false} />
        </div>
      </div>

      {snapshotMsg && <p className="tryon-snapshot-alert" role="status">{snapshotMsg}</p>}

      <div className="tryon-mirror-bottom-bar">
        {state === "active" && (
          <div className="tryon-mirror-actions">
            <button type="button" className="tryon-action-btn" onClick={takeSnapshot}>Take snapshot</button>
            {hasMultipleCameras && (
              <button type="button" className="tryon-action-btn" onClick={switchCamera}>Switch camera</button>
            )}
          </div>
        )}
        <p className="tryon-honest-label">Line up the shirt with your shoulders. This is a style preview, not a fit check.</p>
      </div>
    </div>
  );
};
