/**
 * Central configuration and tunables for the Classical Computer Vision (Auto-Fit) pipeline.
 * All thresholds, constants, and parameters must be maintained in this file.
 */

export const CV_CONFIG = {
  // Vision processing grid
  grid: {
    width: 160,
    defaultHeight: 120,
    borderMargin: 4,
  },

  // Calibration parameters
  calibration: {
    countdownSeconds: 3,
    captureFrames: 45, // ~1.5 seconds at 30 fps
    maxVarianceAllowed: 450, // Rejects unsteady background (movement)
    minColorRangeAllowed: 12, // Rejects flat color (e.g. camera covered)
  },

  // Background subtraction & adaptation
  background: {
    diffK: 2.8, // Multiplier for per-pixel standard deviation (k * sigma)
    minThreshold: 18, // Floor difference threshold across RGB channels
    alpha: 0.01, // Running average update rate for background pixels
    bumpForegroundRatio: 0.70, // Sudden foreground explosion indicates bump
    bumpBorderDiffThreshold: 32, // Border difference indicating camera shift
  },

  // Secondary motion assist & temporal smoothing
  motionAssist: {
    diffThreshold: 12, // Inter-frame differencing threshold
    minMotionArea: 10,
  },
  temporalMask: {
    decayAlpha: 0.80, // Weight for current frame mask vs previous mask
    holeFillMaxArea: 120, // Maximum enclosed hole area in pixels to fill
  },

  // Biometrics & silhouette extraction
  biometrics: {
    headWidthMin: 5,
    maxHeadTopRatio: 0.60,
    minNeckSearchOffsetRatio: 0.05,
    maxNeckSearchOffsetRatio: 0.25,
    shoulderExpansionSearchRatio: 0.18,
    minShoulderWidthRatio: 0.18,
    maxShoulderWidthRatio: 0.85,
    armpitWidthClampMin: 0.75, // Lower bound below armpit as ratio of shoulder width
    armpitWidthClampMax: 0.95, // Upper bound below armpit (prevents ballooning when arms raise)
    sleeveSpanRatio: 0.55,
  },

  // 1€ Filter smoothing cutoffs
  smoothing: {
    posMinCutoff: 1.0,
    posBeta: 0.02,
    angleMinCutoff: 0.5,
    angleBeta: 0.01,
    sizeMinCutoff: 0.8,
    sizeBeta: 0.02,
    dCutoff: 1.0,
  },

  // Tracking state transitions
  tracking: {
    lostTimeoutMs: 400, // Time before entering fade-out after losing silhouette
    fadeDurationMs: 200, // Smooth fade-out and fade-in duration
  },

  // Mesh resolution & adaptive quality
  mesh: {
    highCols: 10,
    highRows: 12,
    lowCols: 8,
    lowRows: 10,
    degradeFrameTimeMs: 40,
    upgradeFrameTimeMs: 25,
  },
} as const;
