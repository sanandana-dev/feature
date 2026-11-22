import { BodyAnchors, Landmark, Point2D, VideoNaturalSize, ViewportBox } from "./types";
import { mapLandmarkToViewport } from "./coordinateMapping";

const VISIBILITY_THRESHOLD = 0.5;

function isValid(lm?: Landmark): boolean {
  return lm !== undefined && (lm.visibility === undefined || lm.visibility >= VISIBILITY_THRESHOLD);
}

/**
 * Extracts key garment anchor points from MediaPipe pose landmarks,
 * mapping them into screen pixel space.
 */
export function poseToAnchors(
  landmarks: Landmark[] | undefined,
  videoNatural: VideoNaturalSize,
  viewport: ViewportBox,
  mirrored: boolean
): BodyAnchors | null {
  if (!landmarks || landmarks.length < 25) return null;

  const lm11 = landmarks[11]; // left shoulder
  const lm12 = landmarks[12]; // right shoulder
  const lm23 = landmarks[23]; // left hip
  const lm24 = landmarks[24]; // right hip
  const lm0 = landmarks[0];   // nose
  const lm13 = landmarks[13]; // left elbow
  const lm14 = landmarks[14]; // right elbow

  const leftShoulderValid = isValid(lm11);
  const rightShoulderValid = isValid(lm12);

  // Both shoulders are mandatory to form a garment fit
  if (!leftShoulderValid || !rightShoulderValid) {
    return null;
  }

  const leftShoulder = mapLandmarkToViewport(lm11, videoNatural, viewport, mirrored);
  const rightShoulder = mapLandmarkToViewport(lm12, videoNatural, viewport, mirrored);

  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;
  const shoulderWidth = Math.hypot(dx, dy);

  if (shoulderWidth <= 10) {
    return null; // Degenerate size
  }

  // Torso tilt angle
  const torsoAngle = Math.atan2(dy, dx);

  // Midpoint between shoulders
  const shoulderMid: Point2D = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };

  // Neck estimation (between shoulder midpoint and nose if nose is visible)
  let neck: Point2D = { ...shoulderMid };
  if (isValid(lm0)) {
    const nosePt = mapLandmarkToViewport(lm0, videoNatural, viewport, mirrored);
    neck = {
      x: shoulderMid.x * 0.75 + nosePt.x * 0.25,
      y: shoulderMid.y * 0.75 + nosePt.y * 0.25,
    };
  }

  // Hips
  const leftHipValid = isValid(lm23);
  const rightHipValid = isValid(lm24);

  let leftHip: Point2D;
  let rightHip: Point2D;
  let torsoLength: number;

  if (leftHipValid && rightHipValid) {
    leftHip = mapLandmarkToViewport(lm23, videoNatural, viewport, mirrored);
    rightHip = mapLandmarkToViewport(lm24, videoNatural, viewport, mirrored);
    const hipMidX = (leftHip.x + rightHip.x) / 2;
    const hipMidY = (leftHip.y + rightHip.y) / 2;
    torsoLength = Math.hypot(hipMidX - shoulderMid.x, hipMidY - shoulderMid.y);
  } else {
    // User is close to the camera, hips out of frame. Estimate torso length ~1.3x shoulder width
    torsoLength = shoulderWidth * 1.3;
    // Project downwards along the normal perpendicular to shoulder line
    const perpX = -Math.sin(torsoAngle);
    const perpY = Math.cos(torsoAngle);
    const halfWidth = shoulderWidth * 0.45;

    const estHipMidX = shoulderMid.x + perpX * torsoLength;
    const estHipMidY = shoulderMid.y + perpY * torsoLength;

    leftHip = {
      x: estHipMidX - Math.cos(torsoAngle) * halfWidth,
      y: estHipMidY - Math.sin(torsoAngle) * halfWidth,
    };
    rightHip = {
      x: estHipMidX + Math.cos(torsoAngle) * halfWidth,
      y: estHipMidY + Math.sin(torsoAngle) * halfWidth,
    };
  }

  // Optional elbows
  const leftElbow = isValid(lm13) ? mapLandmarkToViewport(lm13, videoNatural, viewport, mirrored) : undefined;
  const rightElbow = isValid(lm14) ? mapLandmarkToViewport(lm14, videoNatural, viewport, mirrored) : undefined;

  // Calculate overall confidence score
  const visArr = [
    lm11.visibility ?? 1,
    lm12.visibility ?? 1,
    leftHipValid ? (lm23.visibility ?? 1) : 0.6,
    rightHipValid ? (lm24.visibility ?? 1) : 0.6,
  ];
  const confidence = visArr.reduce((a, b) => a + b, 0) / visArr.length;

  return {
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    neck,
    leftElbow,
    rightElbow,
    shoulderWidth,
    torsoLength,
    torsoAngle,
    confidence,
  };
}
