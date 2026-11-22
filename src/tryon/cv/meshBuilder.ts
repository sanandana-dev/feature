import { BodyMeasurements } from "./types";
import { FitType, FIT_FACTORS } from "../types";

export interface MeshVertex {
  x: number;
  y: number;
  u: number; // 0..1 texture coordinates
  v: number; // 0..1 texture coordinates
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
  scaleX?: number; // scale from cv grid to canvas pixels
  scaleY?: number; // scale from cv grid to canvas pixels
  manualOffset?: { x: number; y: number };
  manualScale?: number;
  manualRotateDeg?: number;
}

/**
 * Builds a 10x12 garment mesh directly fitted to the silhouette edges,
 * with sleeve extensions, armpit clamping, and lean rotation.
 */
export function generateSilhouetteMesh(
  measurements: BodyMeasurements,
  options: MeshBuildOptions = {}
): MeshGrid {
  const cols = options.cols ?? 10;
  const rows = options.rows ?? 12;
  const fit = options.fit ?? "regular";
  const fitFactor = FIT_FACTORS[fit] ?? 1.05;
  const sx = options.scaleX ?? 1.0;
  const sy = options.scaleY ?? 1.0;
  const manualOffset = options.manualOffset ?? { x: 0, y: 0 };
  const manualScale = options.manualScale ?? 1.0;
  const manualRotateRad = ((options.manualRotateDeg ?? 0) * Math.PI) / 180;

  const {
    leftShoulder,
    rightShoulder,
    shoulderWidth,
    shoulderTilt,
    torsoAngle,
    torsoLength,
    rowProfiles,
  } = measurements;

  // Total orientation angle (shoulder tilt + torso lean + manual rotate)
  const totalAngle = (shoulderTilt + torsoAngle) / 2 + manualRotateRad;
  const dirX = Math.cos(totalAngle);
  const dirY = Math.sin(totalAngle);
  const downX = -Math.sin(totalAngle);
  const downY = Math.cos(totalAngle);

  // Scaled dimensions in canvas space
  const sWidth = shoulderWidth * sx * fitFactor * manualScale;
  const sLength = torsoLength * sy * 1.08 * manualScale;
  const sleeveSpan = sWidth * 0.55;

  const collarMidX = ((leftShoulder.x + rightShoulder.x) / 2) * sx + manualOffset.x;
  const collarMidY = ((leftShoulder.y + rightShoulder.y) / 2) * sy + manualOffset.y;

  const vertices: MeshVertex[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows; // 0 at neck/shoulders, 1 at hem
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
      // Sleeve band: extends beyond shoulders by up to 0.55x shoulderWidth
      const sleeveWeight = 1.0 - (v / 0.28);
      halfSpan = (sWidth / 2) + sleeveSpan * sleeveWeight;
    } else {
      // Torso band: take from silhouette edges, but CLAMP below armpit
      // to 0.8 - 0.95 x shoulderWidth so raised or wide arms don't balloon the shirt
      const maxTorsoHalfWidth = (sWidth / 2) * 0.95;
      const minTorsoHalfWidth = (sWidth / 2) * 0.75;

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

      // Neck dip at top row center
      if (r === 0 && Math.abs(relU) < 0.25) {
        const dip = (1.0 - Math.abs(relU) / 0.25) * (sLength * 0.05);
        px += downX * dip;
        py += downY * dip;
      }

      // Slight curve at hem
      if (r === rows) {
        const hemDip = (1.0 - Math.pow(relU, 2)) * (sLength * 0.03);
        px += downX * hemDip;
        py += downY * hemDip;
      }

      vertices.push({ x: px, y: py, u, v });
    }
  }

  return { cols, rows, vertices };
}
