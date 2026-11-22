# DealFinder - Live Mirror (Style Preview)

**Live Mirror** is an interactive, real-time virtual try-on preview for apparel shopping in DealFinder. It tracks the user's body live through their webcam feed without any machine learning models, cloud APIs, or external servers, draping and warping the shirt mesh with responsive cloth physics as they move.

---

## 1. Product Overview & Goal

- **Live Mirror Try-On**: A real-time camera mode where clothing follows the user's shoulders, torso angle, and movements, behaving like real cloth rather than a flat sticker.
- **Body Twin Tab**: A parametric 2D SVG silhouette scaled to height, build, and skin tone for quick headless styling.
- **Manual Mode (Zero-Setup Fallback)**: Drag, scale, and rotate garments directly over the mirrored webcam stream with manual alignment and snapshot capture.
- **Size Match (v3)**: Deterministic size chart comparison against user chest and shoulder measurements with comfort ease calculation and between-size guidance.

---

## 2. Tracking Approach: Classical Computer Vision (Zero-AI)

Tracking operates purely on classical computer vision on downscaled video frames (160x120 px) using `{ willReadFrequently: true }`:

1. **Stationary Background Modeling**:
   - Computes per-pixel RGB mean and variance across 30 calibration frames using Welford's algorithm.
   - Rejects calibration if movement is detected or if the background lacks sufficient visual variance.
   - Continuously adapts background pixels during tracking via running average ($\alpha = 0.01$).
   - Detects camera bumps through border perimeter frame difference checks.

2. **Auto-Exposure Gain Compensation**:
   - Estimates global lighting shifts from perimeter border patches to cancel out webcam auto-exposure adjustments.

3. **Foreground Isolation & Morphology**:
   - Flags foreground pixels where color deviation exceeds $\max(\text{minThreshold}, k \cdot \sigma)$ across $\ge 2$ color channels.
   - Cleans up noise with a $3 \times 3$ morphological Open (erosion $\to$ dilation) followed by Close (dilation $\to$ erosion).
   - Identifies the user's body using a 4-connected flood-fill to isolate the largest connected component.

4. **Silhouette Biometrics**:
   - Scans row profiles from top to bottom to locate `headTop`, `neckRow`, `shoulderRow`, and `shoulderWidth`.
   - Computes shoulder tilt and fits a least-squares linear regression line down the torso centerline to capture body lean angle.
   - Restricts torso width below armpits ($0.80 - 0.95 \times \text{shoulderWidth}$) to prevent cloth ballooning when arms are moved.

5. **Adaptive 1€Filter Smoothing**:
   - Employs low-latency 1€Filters to filter translation, scale, and torso rotation, eliminating micro-jitter while remaining responsive to rapid body movement.
   - Handles tracking loss with a 400ms hold and smooth 200ms opacity fade-out.

---

## 3. Rendering Approach: Mesh Warping & Cloth Dynamics

- **Textured Mesh Warping**:
  - A $10 \times 12$ deformable vertex grid mapped over the silhouette.
  - Rendered via Canvas 2D affine triangle subdivision (or raw WebGL) directly over the mirrored `<video>` element. No Three.js or heavy 3D runtimes.
- **Cloth Simulation (Verlet / Mass-Spring)**:
  - Garment vertices respond to torso lean, sway, and inertia with configurable fabric stiffness (cotton, flowy, heavy).
- **Procedural Shading**:
  - Adds depth gradients, fold creases, and subtle contact shadows matched to user posture for realistic drape.

---

## 4. Privacy & Local Processing Guarantee

- **100% On-Device**: All frame processing and rendering occurs entirely in client memory.
- **Zero Data Transmission**: No video frames, photographs, or biometric silhouettes are ever stored, recorded, or transmitted to any server.
- **No Cross-Origin Pixel Access**: Product images are rendered via SVG/Canvas draw calls without reading tainted external pixels.

---

## 5. Honest Limitations

- **Fixed Camera**: Designed for a stationary webcam (laptop on a desk or phone on a stand). Moving or bumping the camera requires a quick recalibration.
- **Lighting Conditions**: Requires steady indoor lighting. Rapid light level changes or strong backlighting may disrupt background subtraction.
- **Single Person**: Designed for a single shopper in frame.
- **Front-Facing Style Preview Only**: Displays the front product image over the user's front silhouette; there is no 3D back view.
- **Style Preview, Not a Fit Check**: Visualizes drape, proportions, color, and necklines. True sizing should always be confirmed against store size charts.

---

## 6. Manual Test Checklist

- [ ] **Calibration & Step Back**: Step out of frame during 3-2-1 countdown, verify background capture, step back in, and confirm silhouette acquisition.
- [ ] **Leaning & Rotation**: Lean side-to-side; confirm the shirt rotates naturally with the torso angle.
- [ ] **Lateral Movement**: Step left and right; confirm responsive horizontal tracking without jitter.
- [ ] **Profile Turn**: Turn slightly sideways; verify the garment narrows with the profile silhouette.
- [ ] **Arm Movement**: Raise and cross arms; confirm armpit clamping prevents garment distortion.
- [ ] **Camera Movement**: Bump camera deliberately; confirm "Camera moved, please recalibrate" prompt.
- [ ] **Walk Away & Return**: Walk out of frame; confirm smooth 200ms fade-out after 400ms timeout, and smooth fade-in upon return.
- [ ] **Manual Fallback**: Toggle Auto-Fit off; verify instant switch to manual drag/pinch alignment.
- [ ] **Body Twin**: Switch to Body Twin tab; verify 2D parametric silhouette and Size Match recommendations remain functional.
- [ ] **Full-Screen Mode**: Toggle full-screen on desktop/mobile; verify layout and canvas resize cleanly.

---

## 7. Getting Started

```bash
# Install dependencies
npm install

# Run all test suites (30 tests: recommendSize + useCamera + useFullscreen + cv)
npm test

# Launch Vite dev server
npm run dev

# Run type check and production build
npm run build
```
