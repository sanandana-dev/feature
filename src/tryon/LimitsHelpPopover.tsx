import React, { useState, useRef, useEffect } from "react";

export const LimitsHelpPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="tryon-help-wrap" ref={popoverRef}>
      <button
        type="button"
        className={`tryon-touch-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Honest limits and tips"
        title="Honest limits and tips"
        aria-expanded={isOpen}
      >
        ❓
      </button>

      {isOpen && (
        <div className="tryon-help-popover" role="dialog" aria-label="Honest limits">
          <div className="tryon-help-header">
            <h4>Live Mirror Honest Limits</h4>
            <button
              type="button"
              className="tryon-help-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close tips"
            >
              ✕
            </button>
          </div>
          <ul className="tryon-help-list">
            <li><strong>Fixed camera:</strong> Keep your laptop or phone on a stable surface. Moving the device requires recalibration.</li>
            <li><strong>Steady lighting:</strong> Works best under even indoor light without rapid flickering or harsh backlights.</li>
            <li><strong>One person:</strong> Designed for a single shopper in frame.</li>
            <li><strong>Front photo:</strong> Displays a front-view cloth warp. There is no 3D back view.</li>
            <li><strong>Style preview, not fit:</strong> Visualizes style, necklines, and drape—never a tailored fit check.</li>
            <li><strong>Colors:</strong> High contrast between clothing and background improves silhouette accuracy.</li>
          </ul>
        </div>
      )}
    </div>
  );
};
