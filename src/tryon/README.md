# DealFinder "Style Preview" (Try On v3 - Size Match)

A lightweight, zero-AI, accessible "Style Preview" and "Size Match" component for clothes shopping apps.

## Key Features
- **100% Zero AI & Zero WebGL**: No ML models, no pose tracking, no server calls.
- **Style Preview (v1 & v2)**:
  - **Body Twin**: Parametric SVG body silhouette scaled to user's height, build, and skin tone.
  - **Live Mirror**: Mirrored local webcam feed with manual alignment.
- **Size Match (v3)**:
  - Deterministic recommendation engine based on store size charts.
  - Pick smallest size where `chestCm >= user chest + 4` (comfort ease).
  - Flags between-sizes and narrow shoulders (> 2 cm narrower than user).
  - Explicit honest labeling: *"Size suggestion based on the store's chart. Check the store's size guide before buying."*
  - Requires user chest input; never guesses.

---

## Live Mirror Mode

> [!NOTE]
> Camera access requires a secure context (**HTTPS** or `localhost`). Browsers automatically block `navigator.mediaDevices.getUserMedia` on plain HTTP.

- **Explicit Opt-in**: Camera starts only after the user taps "Turn on camera".
- **Strict Leak Prevention**: Media tracks stop immediately on tab switch, modal close, hook unmount, or when the browser tab goes into background (`visibilitychange: hidden`).
- **Device Switching**: If multiple cameras are present, a "Switch camera" button appears automatically.
- **Honest Labeling**: Prominently labeled: *"Line up the shirt with your shoulders. This is a style preview, not a fit check."*

---

## Component Structure

```
src/tryon/
  types.ts             # Deal, Profile, SizeChartEntry, FitType definitions
  useProfile.ts        # Resilient localStorage hook with chest/shoulder validation
  recommendSize.ts     # Pure function size recommendation engine
  recommendSize.test.ts# Vitest unit tests for recommendSize
  SizeMatch.tsx        # Size match suggestion card & size chart viewer
  useCamera.ts         # Camera state machine, error handling & stream lifecycle
  useCamera.test.ts    # Unit tests for camera state machine (Vitest)
  TryOnTabs.tsx        # Accessible WAI-ARIA tab navigation (Twin / Mirror)
  ProfileSetup.tsx     # Height slider, segmented build, skin tones, exact measurements
  PaperDoll.tsx        # Dynamic SVG silhouette + shirt overlay + drag/pinch
  CameraOverlay.tsx    # Mirrored video feed + un-mirrored shirt overlay + snapshot
  DealStrip.tsx        # Smooth scroll-snap horizontal strip of alternative deals
  TryOnModal.tsx       # Focus-trapped dialog orchestrating all components
  tryon.css            # Mobile-first styles (360px+), CSS transforms & animations
  README.md            # Usage notes and integration guide
```

---

## Running and Testing

```bash
# Install dependencies
npm install

# Run all unit tests (13 tests: useCamera + recommendSize)
npm test

# Run Vite dev server
npm run dev

# Run TypeScript checks and production build
npm run build
```
