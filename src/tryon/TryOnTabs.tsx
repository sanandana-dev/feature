import React, { useRef } from "react";

export type TabMode = "twin" | "mirror";

interface TryOnTabsProps {
  activeTab: TabMode;
  onTabChange: (tab: TabMode) => void;
  isModelMode: boolean;
}

export const TryOnTabs: React.FC<TryOnTabsProps> = ({
  activeTab,
  onTabChange,
  isModelMode,
}) => {
  const twinRef = useRef<HTMLButtonElement>(null);
  const mirrorRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (activeTab === "twin" && !isModelMode) {
        onTabChange("mirror");
        mirrorRef.current?.focus();
      } else if (activeTab === "mirror") {
        onTabChange("twin");
        twinRef.current?.focus();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      onTabChange("twin");
      twinRef.current?.focus();
    } else if (e.key === "End" && !isModelMode) {
      e.preventDefault();
      onTabChange("mirror");
      mirrorRef.current?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Try On Preview Modes"
      className="tryon-tabs"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={twinRef}
        type="button"
        id="tryon-tab-twin"
        role="tab"
        aria-selected={activeTab === "twin"}
        aria-controls="tryon-panel-twin"
        tabIndex={activeTab === "twin" ? 0 : -1}
        className={`tryon-tab-btn ${activeTab === "twin" ? "active" : ""}`}
        onClick={() => onTabChange("twin")}
      >
        Body Twin
      </button>

      <button
        ref={mirrorRef}
        type="button"
        id="tryon-tab-mirror"
        role="tab"
        aria-selected={activeTab === "mirror"}
        aria-controls="tryon-panel-mirror"
        tabIndex={activeTab === "mirror" ? 0 : -1}
        disabled={isModelMode}
        aria-disabled={isModelMode}
        title={isModelMode ? "Model photo listing: Mirror preview unavailable" : "Live camera mirror preview"}
        className={`tryon-tab-btn ${activeTab === "mirror" ? "active" : ""}`}
        onClick={() => {
          if (!isModelMode) onTabChange("mirror");
        }}
      >
        Live Mirror {isModelMode ? "(N/A)" : ""}
      </button>
    </div>
  );
};
