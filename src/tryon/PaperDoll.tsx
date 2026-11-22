import React, { useState, useRef, useMemo } from "react";
import { Deal, Profile, FitType, FIT_FACTORS } from "./types";

export interface ShirtTransform {
  x: number;
  y: number;
  scale: number;
  fit: FitType;
}

interface PaperDollProps {
  deal: Deal;
  profile: Profile;
  transform: ShirtTransform;
  onTransformChange: (updater: (prev: ShirtTransform) => ShirtTransform) => void;
  onResetTransform: () => void;
}

const GEOMETRY = {
  slim: { shoulder: 140, waist: 84, chest: 104 },
  regular: { shoulder: 165, waist: 102, chest: 122 },
  broad: { shoulder: 195, waist: 122, chest: 142 },
};

export const PaperDoll: React.FC<PaperDollProps> = ({
  deal,
  profile,
  transform,
  onTransformChange,
  onResetTransform,
}) => {
  const [swayEnabled, setSwayEnabled] = useState(false);
  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">("loading");
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDist = useRef<number | null>(null);
  const pinchInitScale = useRef<number>(1);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const geo = GEOMETRY[profile.build];
  const heightScale = useMemo(() => 0.85 + ((profile.heightCm - 140) / 60) * 0.25, [profile.heightCm]);
  const renderedShirtWidth = geo.shoulder * FIT_FACTORS[transform.fit];

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) lastPos.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [p1, p2] = Array.from(pointers.current.values());
      pinchStartDist.current = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      pinchInitScale.current = transform.scale;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1 && lastPos.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onTransformChange((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
    } else if (pointers.current.size === 2 && pinchStartDist.current) {
      const [p1, p2] = Array.from(pointers.current.values());
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const scale = Math.min(1.8, Math.max(0.6, pinchInitScale.current * (dist / pinchStartDist.current)));
      onTransformChange((p) => ({ ...p, scale: Number(scale.toFixed(2)) }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (pointers.current.size === 1) {
      const rem = pointers.current.values().next().value;
      if (rem) lastPos.current = { x: rem.x, y: rem.y };
      pinchStartDist.current = null;
    } else if (pointers.current.size === 0) {
      lastPos.current = null;
      pinchStartDist.current = null;
    }
  };

  if (deal.tryOnMode === "model") {
    return (
      <div className="tryon-model-fallback">
        <div className="tryon-model-card">
          <p className="tryon-alert-text">
            This listing uses a model photo, so Style Preview isn't available. You can still compare prices below.
          </p>
          <div className="tryon-model-img-wrapper">
            <img src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className="tryon-model-img" loading="lazy" />
          </div>
        </div>
        <div className="tryon-deal-info">
          <h2 className="tryon-deal-title">{deal.title}</h2>
          <div className="tryon-deal-meta">
            <span className="tryon-deal-store">{deal.store}</span>
            <span className="tryon-deal-price">₹{deal.price.toLocaleString("en-IN")}</span>
          </div>
          <a href={deal.buyUrl} target="_blank" rel="noopener noreferrer" className="tryon-buy-btn">Buy on {deal.store}</a>
        </div>
      </div>
    );
  }

  const hs = geo.shoulder / 2;
  const hw = geo.waist / 2;
  const hc = geo.chest / 2;

  return (
    <div className="tryon-paperdoll-wrapper">
      <div className="tryon-doll-toolbar">
        <div className="tryon-tool-item">
          <label htmlFor="tryon-fit-select" className="tryon-tool-label">Fit:</label>
          <select id="tryon-fit-select" className="tryon-select" value={transform.fit} onChange={(e) => onTransformChange((p) => ({ ...p, fit: e.target.value as FitType }))}>
            <option value="slim">Slim</option>
            <option value="regular">Regular</option>
            <option value="oversized">Oversized</option>
          </select>
        </div>
        <div className="tryon-tool-item">
          <label htmlFor="tryon-scale-slider" className="tryon-tool-label">Size:</label>
          <input id="tryon-scale-slider" type="range" min={0.6} max={1.6} step={0.05} value={transform.scale} onChange={(e) => onTransformChange((p) => ({ ...p, scale: Number(e.target.value) }))} className="tryon-slider tryon-slider-mini" aria-label="Shirt scale slider" />
        </div>
        <div className="tryon-tool-item tryon-btn-group">
          <button type="button" className={`tryon-action-btn ${swayEnabled ? "active" : ""}`} onClick={() => setSwayEnabled((v) => !v)} aria-pressed={swayEnabled}>
            Sway {swayEnabled ? "On" : "Off"}
          </button>
          <button type="button" className="tryon-action-btn" onClick={onResetTransform} aria-label="Reset shirt positioning">Reset</button>
        </div>
      </div>

      <div
        className={`tryon-stage ${swayEnabled ? "tryon-swaying" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
        role="region"
        aria-label="Interactive silhouette with drag to nudge"
      >
        <svg viewBox="0 0 300 600" className="tryon-svg-canvas" aria-hidden="true" style={{ transform: `scaleY(${heightScale})`, transformOrigin: "150px 140px" }}>
          <ellipse cx="150" cy="70" rx="26" ry="34" fill={profile.skin} />
          <path d="M 137 100 L 163 100 L 166 138 L 134 138 Z" fill={profile.skin} />
          <path d={`M ${150 - hs} 145 Q 150 148 ${150 + hs} 145 L ${150 + hc} 210 L ${150 + hw} 300 L ${150 + hw + 8} 360 L ${150 - hw - 8} 360 L ${150 - hw} 300 L ${150 - hc} 210 Z`} fill="#e2e8f0" />
          <path d={`M ${150 - hs} 145 Q ${150 - hs - 18} 210 ${150 - hw - 16} 330 L ${150 - hw - 6} 330 Q ${150 - hs - 4} 210 ${150 - hc} 185 Z`} fill={profile.skin} />
          <path d={`M ${150 + hs} 145 Q ${150 + hs + 18} 210 ${150 + hw + 16} 330 L ${150 + hw + 6} 330 Q ${150 + hs + 4} 210 ${150 + hc} 185 Z`} fill={profile.skin} />
          <path d={`M ${150 - hw - 8} 360 L ${150 + hw + 8} 360 L ${150 + hw + 4} 430 L 152 430 L 152 385 L 148 385 L 148 430 L ${150 - hw - 4} 430 Z`} fill="#cbd5e1" />
        </svg>

        <div className="tryon-shirt-anchor" style={{ width: `${renderedShirtWidth}px`, transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}>
          {imgStatus === "loading" && <div className="tryon-skeleton-shirt" aria-hidden="true" />}
          {imgStatus === "error" ? (
            <div className="tryon-shirt-error" role="alert">Couldn't load this image</div>
          ) : (
            <img src={deal.imageUrl} alt={deal.title} crossOrigin="anonymous" referrerPolicy="no-referrer" className={`tryon-shirt-img ${imgStatus === "loaded" ? "loaded" : "hidden"}`} onLoad={() => setImgStatus("loaded")} onError={() => setImgStatus("error")} draggable={false} />
          )}
        </div>
      </div>

      <div className="tryon-deal-info">
        <h2 className="tryon-deal-title">{deal.title}</h2>
        <div className="tryon-deal-meta">
          <span className="tryon-deal-store">{deal.store}</span>
          <span className="tryon-deal-price">₹{deal.price.toLocaleString("en-IN")}</span>
        </div>
        <a href={deal.buyUrl} target="_blank" rel="noopener noreferrer" className="tryon-buy-btn" aria-label={`Buy ${deal.title} on ${deal.store}`}>Buy on {deal.store}</a>
      </div>
    </div>
  );
};
