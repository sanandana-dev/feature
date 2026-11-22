export interface Point2D {
  x: number;
  y: number;
}

export interface BackgroundModel {
  width: number;
  height: number;
  mean: Float32Array;      // [r, g, b] per pixel
  variance: Float32Array;  // [vr, vg, vb] per pixel
  count: number;
}

export interface RowProfile {
  row: number;
  left: number;
  right: number;
  width: number;
  center: number;
}

export interface BodyMeasurements {
  headTop: number;
  neckRow: number;
  shoulderRow: number;
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  neck: Point2D;
  shoulderWidth: number;
  shoulderTilt: number; // in radians
  torsoAngle: number;   // in radians (lean)
  torsoCenterline: { slope: number; intercept: number };
  torsoLength: number;
  confidence: number;   // 0 to 1
  rowProfiles: RowProfile[];
}

export type CalibrationStep =
  | "idle"
  | "countdown"
  | "capturing"
  | "validating"
  | "ready"
  | "failed";

export type AutoFitCvState =
  | "off"
  | "calibrating"
  | "tracking"
  | "lost"
  | "bumped"
  | "error";

export type FabricType = "flowy" | "cotton" | "heavy";
export type RealismLevel = "low" | "high";
