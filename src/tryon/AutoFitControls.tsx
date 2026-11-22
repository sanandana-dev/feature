import React from "react";
import { FabricType, RealismLevel } from "./cv/types";

interface AutoFitControlsProps {
  visible: boolean;
  isFull: boolean;
  fabric: FabricType;
  realism: RealismLevel;
  showSilhouette: boolean;
  onFabricChange: (f: FabricType) => void;
  onRealismChange: (r: RealismLevel) => void;
  onToggleSilhouette: () => void;
  onRecalibrate: () => void;
}

export const AutoFitControls: React.FC<AutoFitControlsProps> = ({
  visible,
  isFull,
  fabric,
  realism,
  showSilhouette,
  onFabricChange,
  onRealismChange,
  onToggleSilhouette,
  onRecalibrate,
}) => {
  return (
    <div className={`tryon-autofit-subbar tryon-fs-overlay ${!visible && isFull ? "hidden" : ""}`}>
      <div className="tryon-autofit-group">
        <span className="tryon-subbar-label">Fabric:</span>
        {(["flowy", "cotton", "heavy"] as FabricType[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`tryon-subbar-btn ${fabric === f ? "active" : ""}`}
            onClick={() => onFabricChange(f)}
            aria-label={`${f} fabric`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="tryon-autofit-group">
        <span className="tryon-subbar-label">Realism:</span>
        {(["low", "high"] as RealismLevel[]).map((r) => (
          <button
            key={r}
            type="button"
            className={`tryon-subbar-btn ${realism === r ? "active" : ""}`}
            onClick={() => onRealismChange(r)}
            aria-label={`${r} realism`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="tryon-autofit-group">
        <button
          type="button"
          className={`tryon-subbar-btn ${showSilhouette ? "active" : ""}`}
          onClick={onToggleSilhouette}
          aria-label="Toggle silhouette debug overlay"
          title="Show silhouette mask over video"
        >
          Silhouette
        </button>
        <button
          type="button"
          className="tryon-subbar-btn tryon-recalib-btn"
          onClick={onRecalibrate}
          aria-label="Recalibrate background"
          title="Recalibrate background model"
        >
          Recalibrate
        </button>
      </div>
    </div>
  );
};
