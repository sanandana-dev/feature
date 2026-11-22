import React from "react";
import { CalibrationStep } from "./cv/types";

interface CalibrationOverlayProps {
  step: CalibrationStep;
  countdown: number;
  onRetry: () => void;
}

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  step,
  countdown,
  onRetry,
}) => {
  if (step === "ready" || step === "idle") return null;

  return (
    <div className="tryon-calib-overlay">
      {step === "countdown" && (
        <div className="tryon-calib-card">
          <h3>Step out of the frame and keep still</h3>
          <div className="tryon-countdown-number">{countdown}</div>
          <p className="tryon-calib-tips">
            Tips: Use a still background, steady light, one person in frame, and keep the camera on a stand.
          </p>
          <p className="tryon-privacy-note">
            All processing is on-device. Nothing is recorded, stored or uploaded.
          </p>
        </div>
      )}

      {step === "capturing" && (
        <div className="tryon-calib-card">
          <h3>Capturing background frames...</h3>
          <div className="tryon-spinner" />
          <p className="tryon-calib-sub">Please stay out of frame for a second.</p>
        </div>
      )}

      {step === "failed" && (
        <div className="tryon-calib-card">
          <h3>Background wasn&apos;t steady, try again</h3>
          <p className="tryon-calib-sub">
            Make sure there is no movement while the background is being captured.
          </p>
          <button
            type="button"
            className="tryon-buy-btn"
            onClick={onRetry}
            aria-label="Retry background calibration"
          >
            Retry Calibration
          </button>
        </div>
      )}
    </div>
  );
};
