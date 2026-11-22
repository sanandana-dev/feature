import { BodyAnchors } from "./types";
import { FitType, FIT_FACTORS } from "../types";

export interface MeshVertex {
  x: number;
  y: number;
  u: number; // [0, 1] texture coordinate
  v: number; // [0, 1] texture coordinate
}

export interface MeshGrid {
  cols: number;
  rows: number;
  vertices: MeshVertex[]; // (cols + 1) * (rows + 1)
}

export interface MeshConfig {
  cols?: number;
  rows?: number;
  fit?: FitType;
  manualOffset?: { x: number; y: number };
  manualScale?: number;
  manualRotateDeg?: number;
}

/**
 * Generates a warped 2D mesh pinned to the user's body anchors.
 */
export function generateGarmentMesh(
  anchors: BodyAnchors,
  config: MeshConfig = {}
): MeshGrid {
  const cols = config.cols ?? 8;
  const rows = config.rows ?? 10;
  const fit = config.fit ?? "regular";
  const fitFactor = FIT_FACTORS[fit] ?? 1.05;
  const manualOffset = config.manualOffset ?? { x: 0, y: 0 };
  const manualScale = config.manualScale ?? 1.0;
  const manualRotateRad = ((config.manualRotateDeg ?? 0) * Math.PI) / 180;

  const {
    leftShoulder,
    rightShoulder,
    shoulderWidth,
    torsoLength,
    leftElbow,
    rightElbow,
  } = anchors;

  // Torso vector & normal
  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;
  const baseAngle = Math.atan2(dy, dx);
  const totalAngle = baseAngle + manualRotateRad;

  // Center between shoulders (collarbone base)
  const collarMidX = (leftShoulder.x + rightShoulder.x) / 2 + manualOffset.x;
  const collarMidY = (leftShoulder.y + rightShoulder.y) / 2 + manualOffset.y;

  // Directions
  const dirX = Math.cos(totalAngle);
  const dirY = Math.sin(totalAngle);
  const downX = -Math.sin(totalAngle);
  const downY = Math.cos(totalAngle);

  // Scaled dimensions
  const sWidth = shoulderWidth * fitFactor * manualScale;
  const tLength = torsoLength * 1.08 * manualScale;
  const sleeveSpan = sWidth * 0.52;

  // Arm angles based on elbows if available
  let leftArmDown = 0.55;
  let leftArmOut = -0.85;
  if (leftElbow) {
    const elDx = leftElbow.x - leftShoulder.x;
    const elDy = leftElbow.y - leftShoulder.y;
    const len = Math.hypot(elDx, elDy) || 1;
    leftArmOut = elDx / len;
    leftArmDown = elDy / len;
  }

  let rightArmDown = 0.55;
  let rightArmOut = 0.85;
  if (rightElbow) {
    const erDx = rightElbow.x - rightShoulder.x;
    const erDy = rightElbow.y - rightShoulder.y;
    const len = Math.hypot(erDx, erDy) || 1;
    rightArmOut = erDx / len;
    rightArmDown = erDy / len;
  }

  // Define key reference points along rows
  const vertices: MeshVertex[] = [];

  for (let r = 0; r <= rows; r++) {
    const v = r / rows; // 0 at neck/shoulders, 1 at hem
    const rowY = collarMidY + downY * (v * tLength);
    const rowX = collarMidX + downX * (v * tLength);

    // Lateral profile width across torso
    // Top rows include sleeve span (v < 0.35)
    let halfSpan: number;
    if (v < 0.35) {
      // Sleeve row blending into torso
      halfSpan = (sWidth / 2) + sleeveSpan * (1.0 - v / 0.35);
    } else {
      // Torso width (slight taper towards waist, gentle flare at hem)
      const waistFactor = 0.92 + 0.08 * Math.sin(v * Math.PI);
      halfSpan = (sWidth / 2) * waistFactor;
    }

    for (let c = 0; c <= cols; c++) {
      const u = c / cols; // 0 is left edge, 1 is right edge
      const relU = (u - 0.5) * 2; // -1 to +1

      let px = rowX + dirX * (relU * halfSpan);
      let py = rowY + dirY * (relU * halfSpan);

      // Sleeve drooping in upper rows based on arm direction
      if (v < 0.35 && Math.abs(relU) > 0.45) {
        const sleeveWeight = ((Math.abs(relU) - 0.45) / 0.55) * (1.0 - v / 0.35);
        if (relU < 0) {
          px += (leftArmOut * sleeveSpan * 0.2) * sleeveWeight;
          py += (leftArmDown * sleeveSpan * 0.35) * sleeveWeight;
        } else {
          px += (rightArmOut * sleeveSpan * 0.2) * sleeveWeight;
          py += (rightArmDown * sleeveSpan * 0.35) * sleeveWeight;
        }
      }

      // Crewneck dip at collar (r = 0, central columns)
      if (r === 0 && Math.abs(relU) < 0.3) {
        const dip = (1.0 - Math.abs(relU) / 0.3) * (tLength * 0.06);
        px += downX * dip;
        py += downY * dip;
      }

      // Slight curve at hem (r = rows, middle dips slightly)
      if (r === rows) {
        const hemDip = (1.0 - Math.pow(relU, 2)) * (tLength * 0.03);
        px += downX * hemDip;
        py += downY * hemDip;
      }

      vertices.push({ x: px, y: py, u, v });
    }
  }

  return { cols, rows, vertices };
}
