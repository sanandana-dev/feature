# DealFinder "Style Preview" (Try On v4 - Auto-Fit Live Mirror)

An accessible "Style Preview" and "Size Match" component for apparel comparison apps.

## Key Features
- **Style Preview Modes**:
  - **Body Twin (Zero-AI)**: Parametric SVG body silhouette scaled to user's height, build, and skin tone.
  - **Manual Mirror (Zero-AI Fallback)**: Mirrored local webcam feed with manual alignment, scale, rotation, and snapshot capture.
  - **Auto-Fit (beta)**: On-device body tracking using self-hosted MediaPipe PoseLandmarker (Lite). Warped 2D textured mesh, Verlet cloth dynamics, and procedural depth shading. 100% on-device; zero cloud calls.
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
  AutoFitControls.tsx  # Fabric & Realism selectors for Auto-Fit mode
  DealStrip.tsx        # Scroll-snap horizontal strip of alternative deals
  TryOnModal.tsx       # Focus-trapped dialog orchestrating all components
  tryon.css            # Responsive styles, blend modes, animations
  hooks/
    useAutoFit.ts      # Auto-fit lifecycle, detection loop, and adaptive quality
    loadLandmarker.ts  # Dynamic lazy loader for self-hosted MediaPipe wasm/model
    useShirtGestures.ts# Touch/pointer pinch & drag gesture handler
  pose/
    types.ts           # Pose anchors, landmarks, and viewport types
    coordinateMapping.ts# Exact object-fit: cover and mirror coordinate mapping
    oneEuroFilter.ts   # Adaptive low-latency jitter filter (1€ Filter)
    poseToAnchors.ts   # Extracts body anchors from 33 pose landmarks
    trackingState.ts   # Smooth fading state manager for lost/regained tracking
    meshGenerator.ts   # Warped garment mesh calculation pinned to anchors
    pose.test.ts       # Vitest tests for pose, filter, mapping, and mesh
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

# Run all unit tests (27 tests)
npm test

# Run Vite dev server
npm run dev

# Run TypeScript checks and production build
npm run build
```
