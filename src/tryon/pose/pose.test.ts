import { describe, it, expect } from "vitest";
import { mapLandmarkToViewport } from "./coordinateMapping";
import { OneEuroFilter1D } from "./oneEuroFilter";
import { poseToAnchors } from "./poseToAnchors";
import { TrackingStateManager } from "./trackingState";
import { generateGarmentMesh } from "./meshGenerator";
import { Landmark } from "./types";

describe("coordinateMapping (object-fit: cover + mirror)", () => {
  it("maps center point accurately on landscape viewport", () => {
    const video = { videoWidth: 1280, videoHeight: 720 };
    const vp = { width: 800, height: 600 };
    // Center point (0.5, 0.5)
    const pt = { x: 0.5, y: 0.5 };

    const mappedMirrored = mapLandmarkToViewport(pt, video, vp, true);
    expect(mappedMirrored.x).toBeCloseTo(400, 1);
    expect(mappedMirrored.y).toBeCloseTo(300, 1);

    const mappedNormal = mapLandmarkToViewport(pt, video, vp, false);
    expect(mappedNormal.x).toBeCloseTo(400, 1);
    expect(mappedNormal.y).toBeCloseTo(300, 1);
  });

  it("handles portrait viewport with vertical orientation", () => {
    const video = { videoWidth: 720, videoHeight: 1280 };
    const vp = { width: 360, height: 640 };
    const pt = { x: 0.2, y: 0.8 };

    // With mirrored = true, x becomes 1 - 0.2 = 0.8
    const mappedMirrored = mapLandmarkToViewport(pt, video, vp, true);
    expect(mappedMirrored.x).toBeCloseTo(360 * 0.8, 1);
    expect(mappedMirrored.y).toBeCloseTo(640 * 0.8, 1);

    const mappedNormal = mapLandmarkToViewport(pt, video, vp, false);
    expect(mappedNormal.x).toBeCloseTo(360 * 0.2, 1);
    expect(mappedNormal.y).toBeCloseTo(640 * 0.8, 1);
  });
});

describe("OneEuroFilter", () => {
  it("reduces jitter on high-frequency noise", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 0.5, beta: 0.005 });
    const rawValues: number[] = [];
    const filteredValues: number[] = [];

    let t = 0;
    for (let i = 0; i < 50; i++) {
      t += 16.6;
      const noise = (Math.sin(i * 10) > 0 ? 1 : -1) * 3;
      const val = 100 + noise;
      rawValues.push(val);
      filteredValues.push(filter.filter(val, t));
    }

    const variance = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
    };

    expect(variance(filteredValues)).toBeLessThan(variance(rawValues) * 0.4);
  });

  it("follows a step change within approximately 150ms", () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.01 });
    let t = 0;
    // Settle at 0
    for (let i = 0; i < 20; i++) {
      t += 16.6;
      filter.filter(0, t);
    }

    // Step to 100
    let stepOutput = 0;
    for (let i = 0; i < 10; i++) { // ~166ms
      t += 16.6;
      stepOutput = filter.filter(100, t);
    }

    // After ~160ms, the step response should have achieved over 85% of target
    expect(stepOutput).toBeGreaterThan(85);
  });
});

describe("poseToAnchors", () => {
  const mockVideo = { videoWidth: 1280, videoHeight: 720 };
  const mockVp = { width: 1280, height: 720 };

  const createMockLandmarks = (): Landmark[] => {
    const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    // 0: Nose
    lms[0] = { x: 0.5, y: 0.2, visibility: 0.95 };
    // 11: Left shoulder, 12: Right shoulder
    lms[11] = { x: 0.4, y: 0.3, visibility: 0.95 };
    lms[12] = { x: 0.6, y: 0.3, visibility: 0.95 };
    // 23: Left hip, 24: Right hip
    lms[23] = { x: 0.42, y: 0.65, visibility: 0.9 };
    lms[24] = { x: 0.58, y: 0.65, visibility: 0.9 };
    return lms;
  };

  it("extracts valid body anchors from landmarks", () => {
    const lms = createMockLandmarks();
    const anchors = poseToAnchors(lms, mockVideo, mockVp, false);

    expect(anchors).not.toBeNull();
    expect(anchors!.shoulderWidth).toBeCloseTo(1280 * 0.2, 1);
    expect(anchors!.torsoLength).toBeGreaterThan(100);
    expect(anchors!.confidence).toBeGreaterThan(0.8);
  });

  it("estimates torso length from shoulder width when hips are missing", () => {
    const lms = createMockLandmarks();
    lms[23].visibility = 0.2; // hips hidden (close to camera)
    lms[24].visibility = 0.2;

    const anchors = poseToAnchors(lms, mockVideo, mockVp, false);
    expect(anchors).not.toBeNull();
    // Expected ~1.3x shoulderWidth
    expect(anchors!.torsoLength).toBeCloseTo(anchors!.shoulderWidth * 1.3, 1);
  });

  it("returns null if shoulders are missing or below threshold", () => {
    const lms = createMockLandmarks();
    lms[11].visibility = 0.3; // missing left shoulder
    const anchors = poseToAnchors(lms, mockVideo, mockVp, false);
    expect(anchors).toBeNull();
  });
});

describe("TrackingStateManager", () => {
  it("fades out smoothly after 400ms without confident landmarks", () => {
    const manager = new TrackingStateManager({ lostTimeoutMs: 400, fadeDurationMs: 200 });
    const mockAnchors = {
      leftShoulder: { x: 100, y: 100 },
      rightShoulder: { x: 200, y: 100 },
      leftHip: { x: 100, y: 300 },
      rightHip: { x: 200, y: 300 },
      neck: { x: 150, y: 90 },
      shoulderWidth: 100,
      torsoLength: 200,
      torsoAngle: 0,
      confidence: 0.9,
    };

    // Tracking active
    let state = manager.update(mockAnchors, 1000);
    for (let i = 1; i <= 20; i++) {
      state = manager.update(mockAnchors, 1000 + i * 20);
    }
    expect(state.opacity).toBe(1.0);
    expect(state.status).toBe("tracking");

    // Signal lost after t = 1400
    // At t = 1600 (200ms < 400ms timeout), opacity should still be preserved
    state = manager.update(null, 1600);
    expect(state.opacity).toBe(1.0);

    // At t = 1900 (500ms > 400ms timeout, 100ms into fade), opacity starts decaying
    state = manager.update(null, 1900);
    expect(state.opacity).toBeLessThan(1.0);
    expect(state.anchors).not.toBeNull(); // retains last valid anchors!
  });
});

describe("generateGarmentMesh", () => {
  it("generates correct grid vertices and respects fit factors", () => {
    const mockAnchors = {
      leftShoulder: { x: 200, y: 150 },
      rightShoulder: { x: 400, y: 150 },
      leftHip: { x: 220, y: 400 },
      rightHip: { x: 380, y: 400 },
      neck: { x: 300, y: 135 },
      shoulderWidth: 200,
      torsoLength: 250,
      torsoAngle: 0,
      confidence: 0.95,
    };

    const regularMesh = generateGarmentMesh(mockAnchors, { cols: 8, rows: 10, fit: "regular" });
    expect(regularMesh.vertices.length).toBe((8 + 1) * (10 + 1));

    const oversizedMesh = generateGarmentMesh(mockAnchors, { cols: 8, rows: 10, fit: "oversized" });
    // Oversized mesh should have wider horizontal vertex spread
    const regRightHem = regularMesh.vertices[regularMesh.vertices.length - 1].x;
    const overRightHem = oversizedMesh.vertices[oversizedMesh.vertices.length - 1].x;
    expect(overRightHem).toBeGreaterThan(regRightHem);
  });
});
