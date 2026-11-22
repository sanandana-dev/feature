import React from "react";
import { FabricType, RealismLevel } from "./pose/types";

interface AutoFitSubBarProps {
  visible: boolean;
  isFull: boolean;
  fabric: FabricType;
  realism: RealismLevel;
  onFabricChange: (f: FabricType) => void;
  onRealismChange: (r: RealismLevel) => void;
}

export const AutoFitSubBar: React.FC<AutoFitSubBarProps> = ({
  visible,
  isFull,
  fabric,
  realism,
  onFabricChange,
  onRealismChange,
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
    </div>
  );
};
