import React from "react";

interface MirrorControlsBarProps {
  scale: number;
  rotate: number;
  blendMode: "realistic" | "solid";
  isTransparent: boolean;
  isFlat: boolean;
  autoFitEnabled: boolean;
  onScaleChange: (s: number) => void;
  onRotateChange: (r: number) => void;
  onBlendChange: (b: "realistic" | "solid") => void;
  onToggleAutoFit: () => void;
}

export const MirrorControlsBar: React.FC<MirrorControlsBarProps> = ({
  scale,
  rotate,
  blendMode,
  isTransparent,
  isFlat,
  autoFitEnabled,
  onScaleChange,
  onRotateChange,
  onBlendChange,
  onToggleAutoFit,
}) => {
  return (
    <div className="tryon-translucent-pill">
      <label htmlFor="tryon-fs-scale" className="tryon-fs-label">Size</label>
      <input
        id="tryon-fs-scale"
        type="range"
        min={0.5}
        max={2.0}
        step={0.05}
        value={scale}
        onChange={(e) => onScaleChange(Number(e.target.value))}
        className="tryon-slider tryon-slider-tiny"
        aria-label="Scale shirt size"
      />
      <label htmlFor="tryon-fs-rotate" className="tryon-fs-label">Rotate</label>
      <input
        id="tryon-fs-rotate"
        type="range"
        min={-15}
        max={15}
        step={1}
        value={rotate}
        onChange={(e) => onRotateChange(Number(e.target.value))}
        className="tryon-slider tryon-slider-tiny"
        aria-label="Rotate shirt angle"
      />
      <div className="tryon-blend-toggle" role="group" aria-label="Blend mode">
        <button
          type="button"
          className={`tryon-blend-btn ${blendMode === "realistic" ? "active" : ""}`}
          onClick={() => onBlendChange("realistic")}
          aria-label="Realistic blend mode"
        >
          Realistic
        </button>
        <button
          type="button"
          className={`tryon-blend-btn ${blendMode === "solid" ? "active" : ""}`}
          onClick={() => isTransparent && onBlendChange("solid")}
          disabled={!isTransparent}
          title={!isTransparent ? "Needs a transparent image" : "Solid blend mode"}
          aria-label="Solid blend mode"
        >
          Solid
        </button>
      </div>
      {isFlat && (
        <button
          type="button"
          className={`tryon-autofit-switch ${autoFitEnabled ? "active" : ""}`}
          onClick={onToggleAutoFit}
          aria-label="Toggle Auto-Fit no AI body tracking"
          aria-pressed={autoFitEnabled}
        >
          Auto-Fit (no AI)
        </button>
      )}
    </div>
  );
};
