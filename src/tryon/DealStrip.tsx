import React from "react";
import { Deal } from "./types";

interface DealStripProps {
  deals: Deal[];
  activeDealId: string;
  onSelect: (id: string) => void;
}

export const DealStrip: React.FC<DealStripProps> = ({
  deals,
  activeDealId,
  onSelect,
}) => {
  return (
    <nav className="tryon-deal-strip-container" aria-label="Similar deals comparison">
      <div className="tryon-deal-strip-track" role="list">
        {deals.map((deal) => {
          const isSelected = deal.id === activeDealId;
          const isModel = deal.tryOnMode === "model";

          return (
            <div
              key={deal.id}
              role="listitem"
              className="tryon-strip-item"
            >
              <button
                type="button"
                className={`tryon-strip-card ${isSelected ? "selected" : ""}`}
                onClick={() => onSelect(deal.id)}
                aria-pressed={isSelected}
                aria-label={`${deal.title}, ${deal.store}, ₹${deal.price}${
                  isModel ? " (Price only)" : ""
                }`}
              >
                <div className="tryon-card-thumb-wrap">
                  <img
                    src={deal.imageUrl}
                    alt=""
                    loading="lazy"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    className="tryon-card-thumb"
                  />
                  {isModel && (
                    <span className="tryon-badge-model" title="Model photo listing">
                      Price only
                    </span>
                  )}
                </div>
                <div className="tryon-card-meta">
                  <span className="tryon-card-store">{deal.store}</span>
                  <span className="tryon-card-price">
                    ₹{deal.price.toLocaleString("en-IN")}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
};
