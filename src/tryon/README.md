# DealFinder "Style Preview" (Try On v2 - Live Mirror)

A lightweight, zero-AI, accessible "Style Preview" modal component for clothes shopping apps.

## Key Features
- **100% Zero AI & Zero WebGL**: No ML models, no pose estimation, no canvas pixel reading, no heavy tracking libraries.
- **Two Preview Modes**:
  1. **Body Twin (v1)**: Parametric SVG body silhouette scaled to user's height, build, and skin tone.
  2. **Live Mirror (v2)**: User's mirrored webcam feed with manual shoulder alignment.
- **Privacy First**: Camera stream never leaves the client device; nothing is stored or uploaded.
- **Interactive Alignment**: Drag to nudge, pinch or slider to scale, rotate slider (-15° to +15°), and "Center" / "Reset" helpers.
- **60 FPS Performance**: Drag nudging uses direct CSS transforms and `requestAnimationFrame` with zero React re-renders on pointer moves.
- **Snapshot Generator**: Local canvas snapshot without reading raw pixels (`drawImage` only).
- **Graceful Model Photo Fallback**: Model-photo listings disable Style Preview and display clear price comparison.

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
  types.ts             # Deal, Profile, FitType definitions & constants
  useProfile.ts        # Resilient localStorage hook with debounce
  useCamera.ts         # Camera state machine, error handling & stream lifecycle
  useCamera.test.ts    # Unit tests for camera state machine (Vitest)
  TryOnTabs.tsx        # Accessible WAI-ARIA tab navigation (Twin / Mirror)
  ProfileSetup.tsx     # Height slider, segmented build control, 6 skin swatches
  PaperDoll.tsx        # Dynamic SVG silhouette + shirt overlay + drag/pinch
  CameraOverlay.tsx    # Mirrored video feed + un-mirrored shirt overlay + snapshot
  DealStrip.tsx        # Smooth scroll-snap horizontal strip of alternative deals
  TryOnModal.tsx       # Focus-trapped dialog orchestrating all components
  tryon.css            # Mobile-first styles (360px+), CSS transforms & animations
  README.md            # Usage notes and integration guide
```

---

## Manual Test Checklist

1. **Permission Denied**: Click "Turn on camera" and deny permissions in browser prompt -> Verify message: *"Camera permission was denied. Please allow camera access in browser settings."*
2. **Camera In Use / Error**: Open camera in another program, or mock stream failure -> Verify friendly error card with retry CTA.
3. **Tab Switch Track Teardown**: Start camera in "Mirror" tab, click "Body Twin" tab -> Verify camera indicator turns off immediately and tracks stop.
4. **Deal Swap Alignment Persistence**: Move and scale shirt in Mirror mode, then tap a deal in the bottom strip -> Verify shirt image swaps immediately while user position and scale are preserved.
5. **Model Photo Tab Disable**: Select a deal with `tryOnMode: "model"` -> Verify "Live Mirror" tab is disabled and user is alerted that style preview is unavailable for model photos.
6. **Background Visibility Change**: Start camera, switch browser tabs -> Verify video stops and stream releases.
7. **Snapshot Capture**: Tap "Take snapshot" -> Verify downloadable PNG is created with mirrored video feed and un-mirrored shirt graphic.

---

## Running and Testing

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run Vite dev server
npm run dev

# Run TypeScript checks and production build
npm run build
```
