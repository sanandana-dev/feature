export interface Point2D {
  x: number;
  y: number;
}

export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface BodyAnchors {
  leftShoulder: Point2D;
  rightShoulder: Point2D;
  leftHip: Point2D;
  rightHip: Point2D;
  neck: Point2D;
  leftElbow?: Point2D;
  rightElbow?: Point2D;
  shoulderWidth: number;
  torsoLength: number;
  torsoAngle: number; // in radians
  confidence: number; // 0..1
}

export interface ViewportBox {
  width: number;
  height: number;
}

export interface VideoNaturalSize {
  videoWidth: number;
  videoHeight: number;
}

export type AutoFitState = "off" | "loading" | "tracking" | "lost" | "error";
export type FabricType = "flowy" | "cotton" | "heavy";
export type RealismLevel = "low" | "high";
