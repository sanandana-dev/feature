import { describe, it, expect } from "vitest";
import {
  createBackgroundModel,
  accumulateFrame,
  finalizeBackgroundModel,
  detectCameraBump,
} from "./backgroundModel";
import {
  estimateExposureGain,
  cleanMaskMorphology,
  keepLargestConnectedComponent,
} from "./foregroundMask";
import { extractRowProfiles, deriveBodyMeasurements } from "./silhouetteMeasurements";
import { OneEuroFilter1D } from "./oneEuroFilter";
import { TrackingStateManager } from "./trackingState";
import { generateSilhouetteMesh } from "./meshBuilder";

const W = 160;
const H = 120;

function createBlankFrame(val = 128): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = val;
    data[i * 4 + 1] = val;
    data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function drawSyntheticPerson(opts: {
  centerX?: number;
  headY?: number;
  headRadius?: number;
  shoulderWidth?: number;
  leanOffset?: number;
  omitHead?: boolean;
}): Uint8Array {
  const mask = new Uint8Array(W * H);
  const cx = opts.centerX ?? 80;
  const hy = opts.headY ?? 20;
  const hr = opts.headRadius ?? 10;
  const sw = opts.shoulderWidth ?? 40;
  const lean = opts.leanOffset ?? 0;

  // Head
  if (!opts.omitHead) {
    for (let y = hy - hr; y <= hy + hr; y++) {
      for (let x = cx - hr; x <= cx + hr; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H) {
          if (Math.hypot(x - cx, y - hy) <= hr) {
            mask[y * W + x] = 255;
          }
        }
      }
    }
  }

  // Neck
  const neckY = hy + hr;
  for (let y = neckY; y <= neckY + 6; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 255;
    }
  }

  // Shoulders & Torso
  const shoulderY = neckY + 7;
  const hemY = Math.min(H - 1, shoulderY + 50);

  for (let y = shoulderY; y <= hemY; y++) {
    const progress = (y - shoulderY) / (hemY - shoulderY);
    const rowCenter = cx + lean * progress;
    // Width narrows slightly towards waist
    const halfW = (sw / 2) * (1.0 - 0.15 * progress);

    for (let x = Math.round(rowCenter - halfW); x <= Math.round(rowCenter + halfW); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) {
        mask[y * W + x] = 255;
      }
    }
  }

  return mask;
}

describe("Background Model & Calibration", () => {
  it("accumulates frames and finalizes steady background", () => {
    const model = createBackgroundModel(W, H);
    for (let f = 0; f < 10; f++) {
      const frame = createBlankFrame(100 + (f % 2) * 2);
      // add non-flat texture in middle so it's not rejected as flat
      for (let i = 0; i < 500; i++) frame[i * 4] = 200;
      accumulateFrame(model, frame);
    }

    const success = finalizeBackgroundModel(model);
    expect(success).toBe(true);
    expect(model.mean[0]).toBeGreaterThan(90);
  });

  it("fails calibration if background was moving excessively", () => {
    const model = createBackgroundModel(W, H);
    for (let f = 0; f < 10; f++) {
      const frame = createBlankFrame(f * 25); // wildly shifting light/movement
      accumulateFrame(model, frame);
    }
    const success = finalizeBackgroundModel(model);
    expect(success).toBe(false);
  });

  it("detects camera bump when foreground covers > 70% or border shifts", () => {
    const model = createBackgroundModel(W, H);
    const frame = createBlankFrame(100);
    for (let i = 0; i < 500; i++) frame[i * 4] = 200;
    for (let f = 0; f < 10; f++) accumulateFrame(model, frame);
    finalizeBackgroundModel(model);

    const fullMask = new Uint8Array(W * H).fill(255);
    expect(detectCameraBump(frame, model, fullMask)).toBe(true);

    const normalMask = new Uint8Array(W * H);
    expect(detectCameraBump(frame, model, normalMask)).toBe(false);
  });
});

describe("Foreground Mask & Morphology", () => {
  it("estimates exposure gain and normalizes frame differences", () => {
    const model = createBackgroundModel(W, H);
    const frame1 = createBlankFrame(100);
    for (let i = 0; i < 500; i++) frame1[i * 4] = 200;
    for (let f = 0; f < 10; f++) accumulateFrame(model, frame1);
    finalizeBackgroundModel(model);

    // Frame with 20% brighter exposure
    const brightFrame = createBlankFrame(120);
    const gain = estimateExposureGain(brightFrame, model);
    expect(gain).toBeCloseTo(1.2, 0.1);
  });

  it("cleans isolated noise with morphology and keeps largest component", () => {
    const mask = drawSyntheticPerson({});
    // Add noise speckles
    mask[5 * W + 5] = 255;
    mask[5 * W + 6] = 255;
    mask[115 * W + 150] = 255;

    const cleaned = cleanMaskMorphology(mask, W, H);
    const largest = keepLargestConnectedComponent(cleaned, W, H);

    // Noise outside main body is removed
    expect(largest[5 * W + 5]).toBe(0);
    expect(largest[115 * W + 150]).toBe(0);
    // Main body stays intact
    expect(largest[40 * W + 80]).toBe(255);
  });
});

describe("Silhouette Measurements", () => {
  it("measures standing straight synthetic silhouette accurately", () => {
    const mask = drawSyntheticPerson({ centerX: 80, headY: 20, shoulderWidth: 44 });
    const profiles = extractRowProfiles(mask, W, H);
    const measurements = deriveBodyMeasurements(profiles, W, H);

    expect(measurements).not.toBeNull();
    expect(measurements!.headTop).toBe(11);
    expect(measurements!.shoulderWidth).toBe(45);
    expect(measurements!.torsoAngle).toBeCloseTo(0, 0.1);
    expect(measurements!.confidence).toBeGreaterThan(0.7);
  });

  it("measures leaning silhouette with non-zero torso angle", () => {
    const mask = drawSyntheticPerson({ centerX: 80, headY: 20, shoulderWidth: 44, leanOffset: 15 });
    const profiles = extractRowProfiles(mask, W, H);
    const measurements = deriveBodyMeasurements(profiles, W, H);

    expect(measurements).not.toBeNull();
    expect(Math.abs(measurements!.torsoAngle)).toBeGreaterThan(0.1);
  });

  it("measures turned sideways silhouette with narrower shoulder width", () => {
    const frontMask = drawSyntheticPerson({ shoulderWidth: 48 });
    const sideMask = drawSyntheticPerson({ shoulderWidth: 26 });

    const frontM = deriveBodyMeasurements(extractRowProfiles(frontMask, W, H), W, H);
    const sideM = deriveBodyMeasurements(extractRowProfiles(sideMask, W, H), W, H);

    expect(frontM).not.toBeNull();
    expect(sideM).not.toBeNull();
    expect(sideM!.shoulderWidth).toBeLessThan(frontM!.shoulderWidth);
  });

  it("returns null if head is missing", () => {
    const mask = drawSyntheticPerson({ omitHead: true, headY: 80 });
    const profiles = extractRowProfiles(mask, W, H);
    const measurements = deriveBodyMeasurements(profiles, W, H);
    // When head top is missing or below 60% of frame height, measurements return null
    expect(measurements).toBeNull();
  });
});

describe("Smoothing & Tracking State", () => {
  it("OneEuroFilter reduces jitter and tracks step within ~150ms", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.01 });
    let t = 0;
    for (let i = 0; i < 20; i++) filter.filter(0, (t += 16.6));

    let stepOut = 0;
    for (let i = 0; i < 10; i++) stepOut = filter.filter(100, (t += 16.6));
    expect(stepOut).toBeGreaterThan(85);
  });

  it("TrackingStateManager fades out after 400ms without snapping", () => {
    const manager = new TrackingStateManager({ lostTimeoutMs: 400, fadeDurationMs: 200 });
    const mockM = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({}), W, H), W, H)!;

    let s = manager.update(mockM, 1000);
    for (let i = 1; i <= 20; i++) s = manager.update(mockM, 1000 + i * 20);
    expect(s.opacity).toBe(1.0);

    // After 200ms without body: still preserved
    s = manager.update(null, 1600);
    expect(s.opacity).toBe(1.0);

    // After 500ms (> 400ms timeout): fading
    s = manager.update(null, 1900);
    expect(s.opacity).toBeLessThan(1.0);
    expect(s.measurements).not.toBeNull();
  });
});

describe("Mesh Generation & Armpit Clamping", () => {
  it("clamps torso width below armpit to prevent ballooning", () => {
    const mask = drawSyntheticPerson({ shoulderWidth: 40 });
    const m = deriveBodyMeasurements(extractRowProfiles(mask, W, H), W, H)!;

    const mesh = generateSilhouetteMesh(m, { cols: 10, rows: 12, fit: "regular" });
    expect(mesh.vertices.length).toBe((10 + 1) * (12 + 1));

    // Mid torso row (row 6)
    const midRowIdx = 6 * (10 + 1);
    const leftX = mesh.vertices[midRowIdx].x;
    const rightX = mesh.vertices[midRowIdx + 10].x;
    const midTorsoWidth = rightX - leftX;

    // Torso width must be clamped below armpit
    expect(midTorsoWidth).toBeLessThanOrEqual(m.shoulderWidth * 1.05 * 1.05);
  });
});
