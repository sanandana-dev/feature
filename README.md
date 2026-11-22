# DealFinder - Style Preview ("Try On" v4 - Classical CV Auto-Fit)

An accessible, 100% on-device "Style Preview" modal component for clothes shopping in **DealFinder**.

## Modes Overview
- **Manual Mode (Zero-AI Fallback)**: Drag, scale, and rotate the garment manually over the mirrored camera feed or onto the parametric SVG "Body Twin". Completely zero-AI and zero external network calls.
- **Auto-Fit (no AI)**: Classical computer vision running live in the browser using background subtraction, morphological cleanup, connected-component analysis, and row-wise silhouette width profiling. Warps the shirt mesh in real time with Verlet cloth physics and procedural depth shading. Zero ML, zero pose models, zero cloud APIs.

## Classical Computer Vision Pipeline (`src/tryon/cv/`)
1. **Background Modeling**: Captures frames on a downscaled 160px grid during calibration to build per-pixel mean and variance models via Welford's algorithm. Validates background stillness and non-flatness.
2. **Auto-Exposure Gain Normalization**: Estimates global brightness gain from perimeter border pixels to compensate for automatic webcam exposure adjustments.
3. **Foreground Mask Extraction**: Compares pixel deviations against $\max(\text{minThreshold}, k \cdot \sigma)$ across RGB channels.
4. **Morphological Filtering & Largest Component**: Applies $3 \times 3$ morphological Open (erode $\to$ dilate) and Close (dilate $\to$ erode), followed by 4-connected flood-fill to isolate the user's silhouette.
5. **Silhouette Measurements**: Derives `headTop`, `neckRow`, `shoulderRow`, `shoulderWidth`, shoulder tilt angle, least-squares torso centerline, and lean angle.
6. **Graceful Degradation**: Clamps torso width below armpits ($0.8 - 0.95 \times \text{shoulderWidth}$) to prevent ballooning when arms are raised or crossed.
7. **Smoothing & Mesh Warping**: 1€Filter jitter suppression with Verlet cloth dynamics and procedural depth shading.

## Privacy & Local Processing
- **100% On-Device**: All frame processing happens locally in the browser memory using downscaled canvas pixel buffers (`getImageData` with `{ willReadFrequently: true }`).
- **No Video Storage or Transmission**: No images, video frames, or silhouettes are ever stored, recorded, or sent to any server.

## Limitations
- **Camera Stability**: Requires a stationary camera (on a stand or flat surface). If the camera is bumped, Auto-Fit prompts the user to recalibrate.
- **Lighting**: Works best with steady indoor lighting. Rapid light switches may require recalibration.
- **Single Person**: Designed for one shopper in frame.
- **Occlusion**: Arms or hands placed directly across the chest will be treated as part of the torso silhouette.

---

## Manual Test Checklist
Use this checklist to verify Auto-Fit (no AI) behavior:
- [ ] **Step Out & Back In**: Step out during calibration countdown (3-2-1), wait for background capture, step back in, and verify silhouette acquisition.
- [ ] **Lean Left/Right**: Check that the shirt rotates naturally with the least-squares torso centerline.
- [ ] **Move Sideways**: Verify smooth horizontal tracking across the camera viewport without jitter.
- [ ] **Turn Sideways**: Verify that as the torso narrows in profile, the shirt adjusts its width proportionally.
- [ ] **Raise Arms**: Verify that armpit clamping ($0.8 - 0.95 \times \text{shoulderWidth}$) prevents the shirt body from ballooning.
- [ ] **Second Person Walking Behind**: Notice how background subtraction reacts and recovers once the background clears.
- [ ] **Switch Room Light On/Off**: Verify exposure gain normalization compensates for moderate lighting shifts; recalibrate if lights drastically change.
- [ ] **Bump the Camera**: Verify that a bumped camera triggers the "Camera moved, please recalibrate" prompt.
- [ ] **Walk Out and Back**: Verify smooth 200ms fade-out after 400ms without body detection, and smooth fade-in without snapping to (0,0) upon return.
- [ ] **Switch Deals**: Ensure instant garment swap while maintaining calibration and blend modes.
- [ ] **Toggle Fullscreen**: Verify canvas and video adapt seamlessly to screen dimensions without resetting calibration.
- [ ] **Phone on a Stand**: Verify portrait 85% default sleeve width scaling and responsive touch controls.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run unit tests (26 tests: recommendSize + useCamera + useFullscreen + cv)
npm test

# Run Vite dev server
npm run dev

# Typecheck and build production bundle
npm run build
```
