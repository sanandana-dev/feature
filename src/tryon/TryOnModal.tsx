import React, { useState, useEffect, useRef } from "react";
import { Deal } from "./types";
import { useProfile } from "./useProfile";
import { ProfileSetup } from "./ProfileSetup";
import { PaperDoll, ShirtTransform } from "./PaperDoll";
import { DealStrip } from "./DealStrip";
import { TryOnTabs, TabMode } from "./TryOnTabs";
import { CameraOverlay } from "./CameraOverlay";
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

  // If switched to a model-only deal, return to twin tab safely
  useEffect(() => {
    if (isModelMode && activeTab === "mirror") {
      setActiveTab("twin");
    }
  }, [isModelMode, activeTab]);

  const handleSelectDeal = (id: string) => {
    setSelectedDealId(id);
  };

  const handleResetTransform = () => {
    setTransform(INITIAL_TRANSFORM);
  };

  // Keyboard navigation & Focus trapping
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
        className="tryon-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tryon-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="tryon-header">
          <div className="tryon-header-text">
            <h1 id="tryon-modal-title" className="tryon-title">
              Style Preview
            </h1>
            <span className="tryon-badge-pill">v2 Live</span>
          </div>
          <button
            type="button"
            className="tryon-close-btn"
            onClick={onClose}
            aria-label="Close Style Preview"
          >
            ✕
          </button>
        </header>

        {/* Tab Switcher: Body Twin vs Live Mirror */}
        <TryOnTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isModelMode={isModelMode}
        />

        <div className="tryon-body-scroll">
          {activeTab === "twin" ? (
            <div id="tryon-panel-twin" role="tabpanel" aria-labelledby="tryon-tab-twin">
              <PaperDoll
                deal={activeDeal}
                profile={profile}
                transform={transform}
                onTransformChange={setTransform}
                onResetTransform={handleResetTransform}
              />
              <ProfileSetup
                profile={profile}
                onChange={setProfile}
                isFirstTime={isFirstTime}
              />
            </div>
          ) : (
            <div id="tryon-panel-mirror" role="tabpanel" aria-labelledby="tryon-tab-mirror">
              <CameraOverlay deal={activeDeal} />
              <div className="tryon-deal-info" style={{ marginTop: "0.75rem" }}>
                <h2 className="tryon-deal-title">{activeDeal.title}</h2>
                <div className="tryon-deal-meta">
                  <span className="tryon-deal-store">{activeDeal.store}</span>
                  <span className="tryon-deal-price">₹{activeDeal.price.toLocaleString("en-IN")}</span>
                </div>
                <a
                  href={activeDeal.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tryon-buy-btn"
                  aria-label={`Buy ${activeDeal.title} on ${activeDeal.store}`}
                >
                  Buy on {activeDeal.store}
                </a>
              </div>
            </div>
          )}

          <p className="tryon-footnote">
            Style preview only. Never indicates tailored fit. Check the store's size chart before buying.
          </p>
        </div>

        <footer className="tryon-footer-strip">
          <DealStrip
            deals={deals}
            activeDealId={activeDeal.id}
            onSelect={handleSelectDeal}
          />
        </footer>
      </div>
    </div>
  );
};
