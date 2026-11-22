import { describe, it, expect } from "vitest";
import { createBackgroundModel, accumulateFrame, finalizeBackgroundModel, detectCameraBump } from "./backgroundModel";
import { estimateExposureGain, cleanMaskMorphology, keepLargestConnectedComponent } from "./foregroundMask";
import { extractRowProfiles, deriveBodyMeasurements } from "./silhouetteMeasurements";
import { OneEuroFilter1D } from "./oneEuroFilter";
import { TrackingStateManager } from "./trackingState";
import { generateSilhouetteMesh } from "./meshBuilder";

const W = 160, H = 120;

function createBlankFrame(val = 128): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = val; data[i * 4 + 1] = val; data[i * 4 + 2] = val; data[i * 4 + 3] = 255;
  }
  return data;
}

function drawSyntheticPerson(opts: {
  centerX?: number; headY?: number; headRadius?: number;
  shoulderWidth?: number; leanOffset?: number; omitHead?: boolean;
}): Uint8Array {
  const mask = new Uint8Array(W * H);
  const cx = opts.centerX ?? 80, hy = opts.headY ?? 20, hr = opts.headRadius ?? 10;
  const sw = opts.shoulderWidth ?? 40, lean = opts.leanOffset ?? 0;

  if (!opts.omitHead) {
    for (let y = hy - hr; y <= hy + hr; y++) {
      for (let x = cx - hr; x <= cx + hr; x++) {
        if (x >= 0 && x < W && y >= 0 && y < H && Math.hypot(x - cx, y - hy) <= hr) mask[y * W + x] = 255;
      }
    }
  }

  const neckY = hy + hr;
  for (let y = neckY; y <= neckY + 6; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 255;
    }
  }

  const shoulderY = neckY + 7, hemY = Math.min(H - 1, shoulderY + 50);
  for (let y = shoulderY; y <= hemY; y++) {
    const progress = (y - shoulderY) / (hemY - shoulderY);
    const rowCenter = cx + lean * progress;
    const halfW = (sw / 2) * (1.0 - 0.15 * progress);
    for (let x = Math.round(rowCenter - halfW); x <= Math.round(rowCenter + halfW); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 255;
    }
  }
  return mask;
}

describe("Classical CV Pipeline Suites", () => {
  it("calibrates background and rejects motion or flat frames", () => {
    const model = createBackgroundModel(W, H);
    for (let f = 0; f < 10; f++) {
      const frame = createBlankFrame(100 + (f % 2) * 2);
      for (let i = 0; i < 500; i++) frame[i * 4] = 200;
      accumulateFrame(model, frame);
    }
    expect(finalizeBackgroundModel(model)).toBe(true);

    const badModel = createBackgroundModel(W, H);
    for (let f = 0; f < 10; f++) accumulateFrame(badModel, createBlankFrame(f * 25));
    expect(finalizeBackgroundModel(badModel)).toBe(false);
  });

  it("detects camera bump on foreground explosion or border shift", () => {
    const model = createBackgroundModel(W, H);
    const frame = createBlankFrame(100);
    for (let i = 0; i < 500; i++) frame[i * 4] = 200;
    for (let f = 0; f < 10; f++) accumulateFrame(model, frame);
    finalizeBackgroundModel(model);

    expect(detectCameraBump(frame, model, new Uint8Array(W * H).fill(255))).toBe(true);
    expect(detectCameraBump(frame, model, new Uint8Array(W * H))).toBe(false);
  });

  it("estimates exposure gain on brightness changes", () => {
    const model = createBackgroundModel(W, H);
    const frame = createBlankFrame(100);
    for (let i = 0; i < 500; i++) frame[i * 4] = 200;
    for (let f = 0; f < 10; f++) accumulateFrame(model, frame);
    finalizeBackgroundModel(model);
    expect(estimateExposureGain(createBlankFrame(120), model)).toBeCloseTo(1.2, 0.1);
  });

  it("cleans noise speckles and fills enclosed interior holes", () => {
    const mask = drawSyntheticPerson({});
    mask[5 * W + 5] = 255; // noise speckle
    mask[40 * W + 80] = 0; // interior hole inside chest
    const cleaned = cleanMaskMorphology(mask, W, H);
    const largest = keepLargestConnectedComponent(cleaned, W, H);
    expect(largest[5 * W + 5]).toBe(0);
    expect(largest[40 * W + 80]).toBe(255); // hole filled
  });

  it("measures standing straight, leaning, shifted, and closer/farther silhouettes", () => {
    // Standing straight
    const straight = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ centerX: 80, headY: 20, shoulderWidth: 44 }), W, H), W, H);
    expect(straight).not.toBeNull();
    expect(straight!.shoulderWidth).toBe(45);
    expect(straight!.torsoAngle).toBeCloseTo(0, 0.1);

    // Leaning
    const leaning = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ centerX: 80, leanOffset: 15 }), W, H), W, H);
    expect(Math.abs(leaning!.torsoAngle)).toBeGreaterThan(0.1);

    // Shifted laterally
    const shifted = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ centerX: 55 }), W, H), W, H);
    expect(shifted!.neck.x).toBeLessThan(straight!.neck.x);

    // Closer (larger) vs Farther (smaller)
    const closer = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ headRadius: 14, shoulderWidth: 60 }), W, H), W, H);
    const farther = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ headRadius: 7, shoulderWidth: 30 }), W, H), W, H);
    expect(closer!.shoulderWidth).toBeGreaterThan(farther!.shoulderWidth);
  });

  it("measures turned sideways silhouette and handles missing head", () => {
    const frontM = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ shoulderWidth: 48 }), W, H), W, H);
    const sideM = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ shoulderWidth: 26 }), W, H), W, H);
    expect(sideM!.shoulderWidth).toBeLessThan(frontM!.shoulderWidth);

    const headless = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ omitHead: true, headY: 80 }), W, H), W, H);
    expect(headless).toBeNull();
  });

  it("clamps sudden shoulder jumps when arms are raised or waving", () => {
    const valid = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ shoulderWidth: 44 }), W, H), W, H)!;
    // Raised arms double the apparent shoulder row width
    const armsRaisedMask = drawSyntheticPerson({ shoulderWidth: 90 });
    const clamped = deriveBodyMeasurements(extractRowProfiles(armsRaisedMask, W, H), W, H, valid);
    expect(clamped).not.toBeNull();
    expect(clamped!.shoulderWidth).toBe(valid.shoulderWidth);
  });

  it("OneEuroFilter smoothes jitter and follows steps within 150ms", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.01 });
    let t = 0;
    for (let i = 0; i < 20; i++) filter.filter(0, (t += 16.6));
    let stepOut = 0;
    for (let i = 0; i < 10; i++) stepOut = filter.filter(100, (t += 16.6));
    expect(stepOut).toBeGreaterThan(85);
  });

  it("TrackingStateManager holds 400ms then smoothly fades out over 200ms", () => {
    const manager = new TrackingStateManager({ lostTimeoutMs: 400, fadeDurationMs: 200 });
    const mockM = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({}), W, H), W, H)!;
    let s = manager.update(mockM, 1000);
    for (let i = 1; i <= 20; i++) s = manager.update(mockM, 1000 + i * 20);
    expect(s.opacity).toBe(1.0);

    // After 200ms: still fully opaque (holding)
    s = manager.update(null, 1600);
    expect(s.opacity).toBe(1.0);

    // After 500ms (> 400ms): fading out
    s = manager.update(null, 1900);
    expect(s.opacity).toBeLessThan(1.0);
    expect(s.measurements).not.toBeNull();
  });

  it("generates mesh anchored at neckline with sleeve span and armpit clamping", () => {
    const m = deriveBodyMeasurements(extractRowProfiles(drawSyntheticPerson({ shoulderWidth: 40 }), W, H), W, H)!;
    const mesh = generateSilhouetteMesh(m, { cols: 10, rows: 12, fit: "regular" });
    expect(mesh.vertices.length).toBe((10 + 1) * (12 + 1));

    // Mid torso row width must be clamped below armpit
    const midIdx = 6 * (10 + 1);
    const midWidth = mesh.vertices[midIdx + 10].x - mesh.vertices[midIdx].x;
    expect(midWidth).toBeLessThanOrEqual(m.shoulderWidth * 1.05 * 1.05);

    // Top sleeve row extends beyond shoulders
    const topRowWidth = mesh.vertices[10].x - mesh.vertices[0].x;
    expect(topRowWidth).toBeGreaterThan(midWidth);
  });
});
