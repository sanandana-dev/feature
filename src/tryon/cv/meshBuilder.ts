import { BodyMeasurements } from "./types";
import { FitType, FIT_FACTORS } from "../types";
import { CV_CONFIG } from "./config";

export interface MeshVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}

export interface MeshGrid {
  cols: number;
  rows: number;
  vertices: MeshVertex[];
}

export interface MeshBuildOptions {
  cols?: number;
  rows?: number;
  fit?: FitType;
  scaleX?: number;
  scaleY?: number;
  manualOffset?: { x: number; y: number };
  manualScale?: number;
  manualRotateDeg?: number;
}

/**
 * Builds a garment mesh (approx 10x12) from the neckline to the hem,
 * anchored directly to silhouette landmarks with sleeve extensions and armpit clamping.
 */
export function generateSilhouetteMesh(
  measurements: BodyMeasurements,
  options: MeshBuildOptions = {}
): MeshGrid {
  const cols = options.cols ?? CV_CONFIG.mesh.highCols;
  const rows = options.rows ?? CV_CONFIG.mesh.highRows;
  const fit = options.fit ?? "regular";
  const fitFactor = FIT_FACTORS[fit] ?? 1.05;
  const sx = options.scaleX ?? 1.0;
  const sy = options.scaleY ?? 1.0;
  const manualOffset = options.manualOffset ?? { x: 0, y: 0 };
  const manualScale = options.manualScale ?? 1.0;
  const manualRotateRad = ((options.manualRotateDeg ?? 0) * Math.PI) / 180;

  const {
    neck,
    leftShoulder,
    shoulderWidth,
    shoulderTilt,
    torsoAngle,
    torsoLength,
    rowProfiles,
  } = measurements;

  // Combined rotation angle (shoulder tilt + torso lean + manual adjustment)
  const totalAngle = (shoulderTilt * 0.4 + torsoAngle * 0.6) + manualRotateRad;
  const dirX = Math.cos(totalAngle);
  const dirY = Math.sin(totalAngle);
  const downX = -Math.sin(totalAngle);
  const downY = Math.cos(totalAngle);

  // Scaled dimensions in canvas space
  const sWidth = shoulderWidth * sx * fitFactor * manualScale;
  const sLength = torsoLength * sy * 1.15 * manualScale;
  const sleeveSpan = sWidth * CV_CONFIG.biometrics.sleeveSpanRatio;

  // Anchor at the neck base (collar level)
  const collarMidX = neck.x * sx + manualOffset.x;
  const collarMidY = neck.y * sy + manualOffset.y;

  const vertices: MeshVertex[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows; // 0 at neck/collar, 1 at hem
    const rowCenterY = collarMidY + downY * (v * sLength);
    const rowCenterX = collarMidX + downX * (v * sLength);

    // Corresponding cv row index
    const cvRowIdx = Math.min(
      rowProfiles.length - 1,
      Math.max(0, Math.round(leftShoulder.y + (v * torsoLength)))
    );
    const profile = rowProfiles[cvRowIdx];

    // Determine half-span for this row from silhouette
    let halfSpan: number;

    if (v < 0.28) {
      // Sleeve band: extends beyond shoulders with downward angle
      const sleeveWeight = 1.0 - (v / 0.28);
      halfSpan = (sWidth / 2) + sleeveSpan * sleeveWeight;
    } else {
      // Torso band: clamp below armpit to prevent ballooning
      const maxTorsoHalfWidth = (sWidth / 2) * CV_CONFIG.biometrics.armpitWidthClampMax;
      const minTorsoHalfWidth = (sWidth / 2) * CV_CONFIG.biometrics.armpitWidthClampMin;

      let silHalfWidth = sWidth / 2;
      if (profile && profile.width > 5) {
        silHalfWidth = (profile.width * sx * fitFactor * manualScale) / 2;
      }
      halfSpan = Math.min(maxTorsoHalfWidth, Math.max(minTorsoHalfWidth, silHalfWidth));
    }

    for (let c = 0; c <= cols; c++) {
      const u = c / cols; // 0..1
      const relU = (u - 0.5) * 2; // -1 to +1

      let px = rowCenterX + dirX * (relU * halfSpan);
      let py = rowCenterY + dirY * (relU * halfSpan);

      // Angled sleeve drop on outer sleeves
      if (v < 0.28 && Math.abs(relU) > 0.6) {
        const sleeveDrop = (Math.abs(relU) - 0.6) / 0.4 * (sLength * 0.08);
        px += downX * sleeveDrop;
        py += downY * sleeveDrop;
      }

      // Neck curve dip at top row center
      if (r === 0 && Math.abs(relU) < 0.25) {
        const dip = (1.0 - Math.abs(relU) / 0.25) * (sLength * 0.06);
        px += downX * dip;
        py += downY * dip;
      }

      // Soft curve at the bottom hem
      if (r === rows) {
        const hemDip = (1.0 - Math.pow(relU, 2)) * (sLength * 0.035);
        px += downX * hemDip;
        py += downY * hemDip;
      }

      vertices.push({ x: px, y: py, u, v });
    }
  }

  return { cols, rows, vertices };
}
