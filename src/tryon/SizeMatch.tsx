import React from "react";
import { Deal, Profile } from "./types";
import { recommendSize } from "./recommendSize";

interface SizeMatchProps {
  deal: Deal;
  profile: Profile;
}

export const SizeMatch: React.FC<SizeMatchProps> = ({ deal, profile }) => {
  const rec = recommendSize(profile, deal.sizeChart);

  return (
    <div className="tryon-size-match-card">
      <div className="tryon-size-match-header">
        <span className="tryon-size-match-title">Size Match</span>
        {rec.recommendedSize && (
          <span className="tryon-size-pill-rec">
            Recommended: <strong>{rec.recommendedSize}</strong>
          </span>
        )}
      </div>

      <div className="tryon-size-match-body">
        {rec.status === "no-chart" && (
          <p className="tryon-size-empty-text">Size chart not available</p>
        )}

        {rec.status === "missing-measurement" && (
          <div className="tryon-size-missing-box">
            <p className="tryon-size-empty-text">Add your chest measurement</p>
            <p className="tryon-size-subtext">
              Expand "Edit my body" below and enter your chest size to receive tailored size recommendations.
            </p>
          </div>
        )}

        {(rec.status === "match" ||
          rec.status === "between-sizes" ||
          rec.status === "smaller-than-all" ||
          rec.status === "larger-than-all") && (
          <>
            <p className="tryon-size-message">{rec.message}</p>
            {rec.shoulderWarning && (
              <p className="tryon-size-shoulder-warning">⚠️ {rec.shoulderWarning}</p>
            )}

            {deal.sizeChart && deal.sizeChart.length > 0 && (
              <div className="tryon-chart-table-wrap">
                <table className="tryon-chart-table">
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Chest</th>
                      {deal.sizeChart.some((s) => s.shoulderCm) && <th>Shoulder</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {deal.sizeChart.map((entry) => {
                      const isRec = entry.size === rec.recommendedSize;
                      return (
                        <tr key={entry.size} className={isRec ? "active-row" : ""}>
                          <td>
                            <strong>{entry.size}</strong>
                            {isRec && <span className="tryon-check-tag">✓ Best</span>}
                          </td>
                          <td>{entry.chestCm} cm</td>
                          {deal.sizeChart?.some((s) => s.shoulderCm) && (
                            <td>{entry.shoulderCm ? `${entry.shoulderCm} cm` : "—"}</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <p className="tryon-size-disclaimer">
        Size suggestion based on the store's chart. Check the store's size guide before buying.
      </p>
    </div>
  );
};
