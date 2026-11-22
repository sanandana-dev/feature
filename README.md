# DealFinder - Style Preview ("Try On" v4 - Auto-Fit Live Mirror)

An accessible, interactive "Style Preview" modal component for clothes shopping in **DealFinder**.

## Modes Overview
- **Manual Mode (Zero-AI Fallback)**: Drag, scale, and rotate the garment manually over the mirrored camera feed or onto the parametric SVG "Body Twin". Completely zero-AI and zero external network calls.
- **Auto-Fit (beta)**: Opt-in, on-device body tracking powered by MediaPipe PoseLandmarker (Lite). The shirt automatically follows body position, shoulder tilt, arm direction, and waist contours in real time with cloth physics simulation (Verlet sway) and procedural depth shading. 100% on-device; no video, frames, or landmarks ever leave the user's device.

## Self-Hosted ML & Privacy
- **Zero Cloud APIs**: Detection runs purely on-device via WebAssembly/GPU delegate.
- **Self-Hosted Assets**: All WASM binaries and the model task file (`pose_landmarker_lite.task`) are hosted locally in `public/mediapipe/`. The `@mediapipe/tasks-vision` module is lazy-loaded via dynamic `import()` only when the user enables Auto-Fit, preventing bundle bloat.
- **Privacy Guarantee**: Video feeds, captured frames, and landmark coordinates never touch a server or storage.

### Model License & Updating Assets
- **License**: MediaPipe PoseLandmarker is released by Google under the **Apache License 2.0**.
- **Updating Model Files**:
  To update or re-download the self-hosted model files:
  ```bash
  # Copy latest vision wasm files from node_modules
  cp node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe/

  # Download latest pose_landmarker_lite.task
  curl -L "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task" -o "public/mediapipe/pose_landmarker_lite.task"
  ```

## Arms and Occlusion (Roadmap Note)
The system is architected with a clean extension point in `useAutoFit.ts` and `renderGarmentMesh.ts` to support segmentation-mask based arm occlusion (`outputSegmentationMasks: true`). To preserve a stable 30+ FPS baseline across mid-range mobile hardware, arms occlusion is currently omitted from default execution.

---

## Manual Test Checklist
Use this checklist to verify Live Mirror & Auto-Fit performance:
- [ ] **Move Left & Right**: Verify the shirt tracks smoothly without jitter or rubber-banding.
- [ ] **Lean**: Check that the shirt tilts naturally along the shoulder slope (`torsoAngle`).
- [ ] **Turn Sideways**: Verify that as shoulder width narrows, torso profile compresses realistically.
- [ ] **Raise Arms**: Verify that sleeve ends lift and rotate in response to elbow landmark positions.
- [ ] **Walk Out of Frame and Back**: Verify smooth 200ms fade-out after 400ms without body detection, and smooth fade-in without snapping to (0,0) when re-entering.
- [ ] **Switch Deals**: Ensure instant garment swap while maintaining tracking state and selected blend mode.
- [ ] **Toggle Fullscreen**: Verify canvas and video adapt seamlessly to screen dimensions without resetting calibration.
- [ ] **Deny Camera**: Check that the prompt displays a polite permission denied message with a retry button.
- [ ] **Block Model File**: Remove or rename `public/mediapipe/pose_landmarker_lite.task`; verify Auto-Fit automatically falls back to manual mode with a friendly notice.
- [ ] **Low Light**: Check that 1€Filter suppresses high-frequency landmark noise and camera noise.
- [ ] **Phone in Portrait**: Verify 85% default sleeve width scaling and responsive touch controls.

---

## Getting Started

```bash
# Install dependencies
npm install

# Run unit tests (27 tests: recommendSize + useCamera + useFullscreen + pose)
npm test

# Run dev server (requires localhost or HTTPS for camera access)
npm run dev

# Typecheck and build production bundle
npm run build
```
