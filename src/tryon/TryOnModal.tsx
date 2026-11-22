import React, { useState, useEffect, useRef } from "react";
import { Deal } from "./types";
import { useProfile } from "./useProfile";
import { ProfileSetup } from "./ProfileSetup";
import { PaperDoll, ShirtTransform } from "./PaperDoll";
import { DealStrip } from "./DealStrip";
import { TryOnTabs, TabMode } from "./TryOnTabs";
import { CameraOverlay } from "./CameraOverlay";
import { SizeMatch } from "./SizeMatch";
import "./tryon.css";

interface TryOnModalProps {
  deals: Deal[];
  activeDealId: string;
  onClose: () => void;
}

const INITIAL_TRANSFORM: ShirtTransform = {
  x: 0,
  y: 0,
  scale: 1,
  fit: "regular",
};

export const TryOnModal: React.FC<TryOnModalProps> = ({
  deals,
  activeDealId,
  onClose,
}) => {
  const [selectedDealId, setSelectedDealId] = useState<string>(activeDealId);
  const [activeTab, setActiveTab] = useState<TabMode>("twin");
  const [transform, setTransform] = useState<ShirtTransform>(INITIAL_TRANSFORM);

  const { profile, setProfile, isFirstTime } = useProfile();
  const modalRef = useRef<HTMLDivElement>(null);
  const prevFocusedRef = useRef<HTMLElement | null>(null);

  const activeDeal =
    deals.find((d) => d.id === selectedDealId) || deals[0] || null;
  const isModelMode = activeDeal?.tryOnMode === "model";

  useEffect(() => {
    if (isModelMode && activeTab === "mirror") {
      setActiveTab("twin");
    }
  }, [isModelMode, activeTab]);

  useEffect(() => {
    prevFocusedRef.current = document.activeElement as HTMLElement | null;
    const container = modalRef.current;
    if (!container) return;

    const closeBtn = container.querySelector<HTMLElement>(".tryon-close-btn");
    if (closeBtn) closeBtn.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusableNodes = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusableNodes.length === 0) return;
        const firstNode = focusableNodes[0];
        const lastNode = focusableNodes[focusableNodes.length - 1];

        if (e.shiftKey && document.activeElement === firstNode) {
          e.preventDefault();
          lastNode.focus();
        } else if (!e.shiftKey && document.activeElement === lastNode) {
          e.preventDefault();
          firstNode.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (prevFocusedRef.current?.focus) {
        prevFocusedRef.current.focus();
      }
    };
  }, [onClose]);

  if (!activeDeal) return null;

  return (
    <div className="tryon-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className={`tryon-dialog ${activeTab === "mirror" ? "tryon-dialog-mirror" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tryon-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tryon-header">
          <h1 id="tryon-modal-title" className="tryon-title">
            Style Preview
          </h1>
          <button
            type="button"
            className="tryon-close-btn"
            onClick={onClose}
            aria-label="Close Style Preview"
          >
            ✕
          </button>
        </header>

        <TryOnTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isModelMode={isModelMode}
        />

        {activeTab === "twin" ? (
          <>
            <div className="tryon-body-scroll">
              <div id="tryon-panel-twin" role="tabpanel" aria-labelledby="tryon-tab-twin">
                <PaperDoll
                  deal={activeDeal}
                  profile={profile}
                  transform={transform}
                  onTransformChange={setTransform}
                  onResetTransform={() => setTransform(INITIAL_TRANSFORM)}
                />
                <SizeMatch deal={activeDeal} profile={profile} />
                <ProfileSetup
                  profile={profile}
                  onChange={setProfile}
                  isFirstTime={isFirstTime}
                />
              </div>
              <p className="tryon-footnote">
                Style preview only. Never indicates tailored fit. Check the store's size chart before buying.
              </p>
            </div>
            <footer className="tryon-footer-strip">
              <DealStrip
                deals={deals}
                activeDealId={activeDeal.id}
                onSelect={setSelectedDealId}
              />
            </footer>
          </>
        ) : (
          <div id="tryon-panel-mirror" role="tabpanel" aria-labelledby="tryon-tab-mirror" className="tryon-mirror-panel">
            <CameraOverlay
              deal={activeDeal}
              deals={deals}
              onSelectDeal={setSelectedDealId}
              onClose={onClose}
            />
          </div>
        )}
      </div>
    </div>
  );
};
