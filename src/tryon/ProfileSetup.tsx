import React, { useState } from "react";
import { Profile, SKIN_PRESETS } from "./types";

interface ProfileSetupProps {
  profile: Profile;
  onChange: (updated: Profile) => void;
  isFirstTime: boolean;
}

const BUILDS: Array<Profile["build"]> = ["slim", "regular", "broad"];

export const ProfileSetup: React.FC<ProfileSetupProps> = ({
  profile,
  onChange,
  isFirstTime,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isFirstTime);
  const [isMeasureExpanded, setIsMeasureExpanded] = useState<boolean>(false);

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...profile, heightCm: Number(e.target.value) });
  };

  const handleChestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === "" ? undefined : Number(e.target.value);
    onChange({ ...profile, chestCm: val !== undefined ? Math.min(140, Math.max(70, val)) : undefined });
  };

  const handleShoulderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === "" ? undefined : Number(e.target.value);
    onChange({ ...profile, shoulderCm: val !== undefined ? Math.min(60, Math.max(30, val)) : undefined });
  };

  return (
    <div className="tryon-profile-setup">
      <div className="tryon-profile-toggle-row">
        <button
          type="button"
          className="tryon-btn-link"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="tryon-profile-panel"
        >
          {isExpanded ? "Hide body settings ▲" : "Edit my body ▼"}
        </button>
      </div>

      {isExpanded && (
        <section id="tryon-profile-panel" className="tryon-profile-panel" aria-label="Body silhouette settings">
          {/* Height Slider */}
          <div className="tryon-form-group">
            <div className="tryon-form-label-row">
              <label htmlFor="tryon-height-slider" className="tryon-label">Height</label>
              <span className="tryon-value-badge" aria-live="polite">{profile.heightCm} cm</span>
            </div>
            <input
              id="tryon-height-slider"
              type="range"
              min={140}
              max={200}
              step={1}
              value={profile.heightCm}
              onChange={handleHeightChange}
              className="tryon-slider"
              aria-label="Height in centimeters"
            />
          </div>

          {/* Build Segmented Control */}
          <div className="tryon-form-group">
            <span id="tryon-build-label" className="tryon-label">Build</span>
            <div role="group" aria-labelledby="tryon-build-label" className="tryon-segmented-control">
              {BUILDS.map((b) => {
                const isActive = profile.build === b;
                return (
                  <button
                    key={b}
                    type="button"
                    className={`tryon-segment-btn ${isActive ? "active" : ""}`}
                    onClick={() => onChange({ ...profile, build: b })}
                    aria-pressed={isActive}
                    aria-label={`Build ${b}`}
                  >
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Tone Swatches */}
          <div className="tryon-form-group">
            <span id="tryon-skin-label" className="tryon-label">Skin Tone</span>
            <div role="group" aria-labelledby="tryon-skin-label" className="tryon-swatches-grid">
              {SKIN_PRESETS.map((hex, index) => {
                const isSelected = profile.skin.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    className={`tryon-swatch ${isSelected ? "selected" : ""}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => onChange({ ...profile, skin: hex })}
                    aria-label={`Skin tone preset ${index + 1} of ${SKIN_PRESETS.length}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <span className="tryon-swatch-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Collapsible Exact Measurements for Size Match (v3) */}
          <div className="tryon-measurements-section">
            <button
              type="button"
              className="tryon-btn-link tryon-measure-toggle"
              onClick={() => setIsMeasureExpanded((v) => !v)}
              aria-expanded={isMeasureExpanded}
              aria-controls="tryon-measurements-panel"
            >
              {isMeasureExpanded ? "Hide exact measurements ▲" : "Add exact measurements ▼"}
            </button>

            {isMeasureExpanded && (
              <div id="tryon-measurements-panel" className="tryon-measurements-panel">
                <div className="tryon-form-group">
                  <div className="tryon-form-label-row">
                    <label htmlFor="tryon-chest-input" className="tryon-label">Chest (70–140 cm)</label>
                    <span className="tryon-value-badge">{profile.chestCm ? `${profile.chestCm} cm` : "Not set"}</span>
                  </div>
                  <input
                    id="tryon-chest-input"
                    type="range"
                    min={70}
                    max={140}
                    step={1}
                    value={profile.chestCm ?? 95}
                    onChange={handleChestChange}
                    className="tryon-slider"
                    aria-label="Chest circumference in centimeters"
                  />
                  <p className="tryon-measure-hint">How to measure: Measure around the fullest part of your chest under your armpits.</p>
                </div>

                <div className="tryon-form-group">
                  <div className="tryon-form-label-row">
                    <label htmlFor="tryon-shoulder-input" className="tryon-label">Shoulder (30–60 cm)</label>
                    <span className="tryon-value-badge">{profile.shoulderCm ? `${profile.shoulderCm} cm` : "Not set"}</span>
                  </div>
                  <input
                    id="tryon-shoulder-input"
                    type="range"
                    min={30}
                    max={60}
                    step={1}
                    value={profile.shoulderCm ?? 44}
                    onChange={handleShoulderChange}
                    className="tryon-slider"
                    aria-label="Shoulder width in centimeters"
                  />
                  <p className="tryon-measure-hint">How to measure: Measure from the tip of one shoulder across your upper back to the other tip.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
