import { BodyMeasurements, Point2D, RowProfile } from "./types";

export function extractRowProfiles(
  mask: Uint8Array,
  width: number,
  height: number
): RowProfile[] {
  const profiles: RowProfile[] = [];

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let left = -1;
    let right = -1;

    for (let x = 0; x < width; x++) {
      if (mask[rowOffset + x] === 255) {
        if (left === -1) left = x;
        right = x;
      }
    }

    if (left !== -1 && right !== -1) {
      const w = right - left + 1;
      profiles.push({
        row: y,
        left,
        right,
        width: w,
        center: (left + right) / 2,
      });
    } else {
      profiles.push({
        row: y,
        left: -1,
        right: -1,
        width: 0,
        center: width / 2,
      });
    }
  }

  return profiles;
}

/**
 * Derives body measurements (headTop, neck, shoulders, centerline, tilt, lean)
 * from silhouette row profiles.
 */
export function deriveBodyMeasurements(
  profiles: RowProfile[],
  width: number,
  height: number,
  prev?: BodyMeasurements | null
): BodyMeasurements | null {
  // 1. Find head top: first row with width >= 5
  let headTop = -1;
  for (let y = 0; y < height; y++) {
    if (profiles[y].width >= 5) {
      headTop = y;
      break;
    }
  }

  if (headTop === -1 || headTop >= height * 0.6) {
    return null;
  }

  // 2. Find neck row: narrowest row in band below head top
  const neckBandStart = Math.min(height - 1, headTop + Math.max(4, Math.round(height * 0.05)));
  const neckBandEnd = Math.min(height - 1, headTop + Math.max(12, Math.round(height * 0.25)));

  let minNeckWidth = Infinity;
  let neckRow = neckBandStart;

  for (let y = neckBandStart; y <= neckBandEnd; y++) {
    // 3-point vertical moving average for smooth width
    const wPrev = profiles[Math.max(0, y - 1)].width;
    const wCurr = profiles[y].width;
    const wNext = profiles[Math.min(height - 1, y + 1)].width;
    const smoothed = (wPrev + wCurr + wNext) / 3;

    if (smoothed > 4 && smoothed < minNeckWidth) {
      minNeckWidth = smoothed;
      neckRow = y;
    }
  }

  // 3. Find shoulder row: where width expands sharply and plateaus below neck
  const shoulderSearchEnd = Math.min(height - 1, neckRow + Math.max(6, Math.round(height * 0.18)));
  let shoulderRow = Math.min(height - 1, neckRow + 4);
  let maxExpansion = 0;

  for (let y = neckRow + 1; y <= shoulderSearchEnd; y++) {
    const expansion = profiles[y].width - profiles[neckRow].width;
    if (expansion > maxExpansion) {
      maxExpansion = expansion;
      shoulderRow = y;
    }
  }

  let leftShoulder: Point2D = { x: profiles[shoulderRow].left, y: shoulderRow };
  let rightShoulder: Point2D = { x: profiles[shoulderRow].right, y: shoulderRow };
  let shoulderWidth = profiles[shoulderRow].width;

  // 4. Estimate shoulder tilt angle
  const neckCenter = profiles[neckRow].center;
  const neckPoint: Point2D = { x: neckCenter, y: neckRow };

  // Sample top edge near shoulders for tilt
  const tiltDy = rightShoulder.y - leftShoulder.y;
  const tiltDx = Math.max(1, rightShoulder.x - leftShoulder.x);
  let shoulderTilt = Math.atan2(tiltDy, tiltDx);

  // 5. Graceful degradation on shoulder width jumps (e.g. raised arms)
  if (prev && prev.confidence > 0.5) {
    const ratio = shoulderWidth / prev.shoulderWidth;
    if (ratio > 1.35 || ratio < 0.65) {
      shoulderWidth = prev.shoulderWidth;
      const midX = (leftShoulder.x + rightShoulder.x) / 2;
      leftShoulder = { x: midX - shoulderWidth / 2, y: shoulderRow };
      rightShoulder = { x: midX + shoulderWidth / 2, y: shoulderRow };
      shoulderTilt = prev.shoulderTilt;
    }
  }

  // 6. Torso centerline (least-squares fit through row centers from shoulders down)
  const torsoStart = shoulderRow;
  const torsoEnd = Math.min(height - 1, shoulderRow + Math.round(shoulderWidth * 1.3));
  let sumY = 0;
  let sumX = 0;
  let sumYY = 0;
  let sumYX = 0;
  let count = 0;

  for (let y = torsoStart; y <= torsoEnd; y++) {
    if (profiles[y].width > 10) {
      const cy = y;
      const cx = profiles[y].center;
      sumY += cy;
      sumX += cx;
      sumYY += cy * cy;
      sumYX += cy * cx;
      count++;
    }
  }

  let slope = 0;
  let intercept = neckCenter;
  if (count > 3) {
    const denom = count * sumYY - sumY * sumY;
    if (Math.abs(denom) > 1e-4) {
      slope = (count * sumYX - sumY * sumX) / denom;
      intercept = (sumX - slope * sumY) / count;
    }
  }

  // Torso lean angle relative to vertical
  const torsoAngle = Math.atan2(slope, 1);

  // 7. Torso length
  let bottomRow = height - 1;
  for (let y = height - 1; y >= shoulderRow; y--) {
    if (profiles[y].width > 10) {
      bottomRow = y;
      break;
    }
  }
  const isCutoff = bottomRow >= height - 2;
  const torsoLength = isCutoff
    ? shoulderWidth * 1.3
    : Math.max(shoulderWidth * 0.9, bottomRow - shoulderRow);

  // 8. Confidence calculation
  let totalArea = 0;
  for (let y = 0; y < height; y++) totalArea += profiles[y].width;
  const areaRatio = totalArea / (width * height);

  let conf = 0.5;
  if (areaRatio >= 0.08 && areaRatio <= 0.70) conf += 0.25;
  if (shoulderWidth >= width * 0.18 && shoulderWidth <= width * 0.85) conf += 0.15;
  if (neckRow > headTop && shoulderRow > neckRow) conf += 0.10;
  const confidence = Math.min(1.0, Math.max(0.0, conf));

  return {
    headTop,
    neckRow,
    shoulderRow,
    leftShoulder,
    rightShoulder,
    neck: neckPoint,
    shoulderWidth,
    shoulderTilt,
    torsoAngle,
    torsoCenterline: { slope, intercept },
    torsoLength,
    confidence,
    rowProfiles: profiles,
  };
}
