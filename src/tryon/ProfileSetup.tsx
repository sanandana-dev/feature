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

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const heightCm = Number(e.target.value);
    onChange({ ...profile, heightCm });
  };

  const handleBuildChange = (build: Profile["build"]) => {
    onChange({ ...profile, build });
  };

  const handleSkinChange = (skin: string) => {
    onChange({ ...profile, skin });
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
        <section
          id="tryon-profile-panel"
          className="tryon-profile-panel"
          aria-label="Body silhouette settings"
        >
          {/* Height Slider */}
          <div className="tryon-form-group">
            <div className="tryon-form-label-row">
              <label htmlFor="tryon-height-slider" className="tryon-label">
                Height
              </label>
              <span className="tryon-value-badge" aria-live="polite">
                {profile.heightCm} cm
              </span>
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
            <span id="tryon-build-label" className="tryon-label">
              Build
            </span>
            <div
              role="group"
              aria-labelledby="tryon-build-label"
              className="tryon-segmented-control"
            >
              {BUILDS.map((b) => {
                const isActive = profile.build === b;
                return (
                  <button
                    key={b}
                    type="button"
                    className={`tryon-segment-btn ${isActive ? "active" : ""}`}
                    onClick={() => handleBuildChange(b)}
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
            <span id="tryon-skin-label" className="tryon-label">
              Skin Tone
            </span>
            <div
              role="group"
              aria-labelledby="tryon-skin-label"
              className="tryon-swatches-grid"
            >
              {SKIN_PRESETS.map((hex, index) => {
                const isSelected = profile.skin.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    className={`tryon-swatch ${isSelected ? "selected" : ""}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => handleSkinChange(hex)}
                    aria-label={`Skin tone preset ${index + 1} of ${SKIN_PRESETS.length}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <span className="tryon-swatch-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
