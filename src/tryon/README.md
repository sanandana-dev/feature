# DealFinder "Style Preview" (Try On v4 - Classical CV Auto-Fit)

An accessible "Style Preview" and "Size Match" component for apparel comparison apps.

## Key Features
- **Style Preview Modes**:
  - **Body Twin (Zero-AI)**: Parametric SVG body silhouette scaled to user's height, build, and skin tone.
  - **Manual Mirror (Zero-AI Fallback)**: Mirrored local webcam feed with manual alignment, scale, rotation, and snapshot capture.
  - **Auto-Fit (no AI)**: Real-time classical computer vision using background subtraction, auto-exposure normalization, morphological filtering, and silhouette extraction. Warps a 10x12 garment mesh with Verlet cloth simulation and procedural shading. Zero ML dependencies.
- **Size Match (v3)**:
  - Deterministic size chart matching (`chestCm >= user chest + 4` ease).
  - Flags between-sizes and narrow shoulders (> 2 cm narrower than user).
  - Explicit honest labeling: *"Size suggestion based on the store's chart. Check the store's size guide before buying."*

---

## Component Architecture

```
src/tryon/
  types.ts             # Deal, Profile, SizeChartEntry, FitType definitions
  useProfile.ts        # LocalStorage persistence hook for measurements
  recommendSize.ts     # Pure function size recommendation engine
  recommendSize.test.ts# Vitest tests for recommendSize
  SizeMatch.tsx        # Size match suggestion card & size chart viewer
  useCamera.ts         # Camera state machine, error handling & stream lifecycle
  useCamera.test.ts    # Unit tests for camera state machine
  useFullscreen.ts     # Native & pseudo fullscreen hook
  useFullscreen.test.ts# Fullscreen unit tests
  snapshot.ts          # Client-side canvas snapshot compositor
  TryOnTabs.tsx        # Accessible WAI-ARIA tab navigation (Twin / Mirror)
  ProfileSetup.tsx     # Height slider, segmented build, skin tones, measurements
  PaperDoll.tsx        # Dynamic SVG silhouette + shirt overlay + drag/pinch
  CameraOverlay.tsx    # Live mirror view orchestrating manual & Auto-Fit modes
  AutoFitControls.tsx  # Fabric, Realism, Silhouette overlay & Recalibrate controls
  DealStrip.tsx        # Scroll-snap horizontal strip of alternative deals
  TryOnModal.tsx       # Focus-trapped dialog orchestrating all components
  tryon.css            # Responsive styles, blend modes, animations
  hooks/
    useAutoFitCv.ts    # Classical CV detection loop, calibration flow & rendering
    useShirtGestures.ts# Touch/pointer pinch & drag gesture handler
  cv/
    types.ts           # BackgroundModel, RowProfile, BodyMeasurements types
    backgroundModel.ts # Mean/variance model accumulation, validation & bump detection
    foregroundMask.ts  # Exposure gain, difference thresholding, morphology, flood-fill
    silhouetteMeasurements.ts # Head, neck, shoulder extraction & centerline fit
    oneEuroFilter.ts   # Adaptive low-latency jitter filter (1€ Filter)
    trackingState.ts   # Smooth fading state manager for lost/regained tracking
    meshBuilder.ts     # 10x12 mesh pinned to silhouette with armpit clamping
    cv.test.ts         # Vitest unit tests with synthetic silhouette masks
  render/
    clothSimulation.ts # Verlet spring physics for fabric sway & lag
    shading.ts         # Procedural depth gradient, folds & contact shadow
    meshRenderer.ts    # Canvas 2D textured triangle mesh rasterizer
```

---

## Running and Testing

```bash
# Install dependencies
npm install

# Run all unit tests (26 tests)
npm test

# Run Vite dev server
npm run dev

# Run TypeScript checks and production build
npm run build
```
