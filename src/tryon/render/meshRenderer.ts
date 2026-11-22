import { MeshGrid, MeshVertex } from "../pose/meshGenerator";
import { RealismLevel } from "../pose/types";
import { ShadingGenerator } from "./shading";

const shadingGen = new ShadingGenerator();

function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  p0: MeshVertex,
  p1: MeshVertex,
  p2: MeshVertex,
  imgWidth: number,
  imgHeight: number
): void {
  const s0x = p0.u * imgWidth;
  const s0y = p0.v * imgHeight;
  const s1x = p1.u * imgWidth;
  const s1y = p1.v * imgHeight;
  const s2x = p2.u * imgWidth;
  const s2y = p2.v * imgHeight;

  const delta = (s1x - s0x) * (s2y - s0y) - (s2x - s0x) * (s1y - s0y);
  if (Math.abs(delta) < 1e-5) return;

  const a = ((p1.x - p0.x) * (s2y - s0y) - (p2.x - p0.x) * (s1y - s0y)) / delta;
  const b = ((p1.y - p0.y) * (s2y - s0y) - (p2.y - p0.y) * (s1y - s0y)) / delta;
  const c = ((p2.x - p0.x) * (s1x - s0x) - (p1.x - p0.x) * (s2x - s0x)) / delta;
  const d = ((p2.y - p0.y) * (s1x - s0x) - (p1.y - p0.y) * (s2x - s0x)) / delta;
  const e = p0.x - a * s0x - c * s0y;
  const f = p0.y - b * s0x - d * s0y;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
  ctx.restore();
}

/**
 * Renders a warped garment mesh onto the canvas with affine-textured triangles,
 * smooth fading, and depth shading.
 */
export function renderGarmentMesh(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  grid: MeshGrid,
  opacity: number,
  realism: RealismLevel = "high"
): void {
  if (opacity <= 0.01 || grid.vertices.length === 0) return;

  const imgW = image.naturalWidth || image.width || 600;
  const imgH = image.naturalHeight || image.height || 640;

  ctx.save();
  ctx.globalAlpha = opacity;

  const { cols, rows, vertices } = grid;
  const stride = cols + 1;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Render each subdivided quad as two textured triangles
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pTL = vertices[r * stride + c];
      const pTR = vertices[r * stride + c + 1];
      const pBL = vertices[(r + 1) * stride + c];
      const pBR = vertices[(r + 1) * stride + c + 1];

      minX = Math.min(minX, pTL.x, pTR.x, pBL.x, pBR.x);
      minY = Math.min(minY, pTL.y, pTR.y, pBL.y, pBR.y);
      maxX = Math.max(maxX, pTL.x, pTR.x, pBL.x, pBR.x);
      maxY = Math.max(maxY, pTL.y, pTR.y, pBL.y, pBR.y);

      drawTexturedTriangle(ctx, image, pTL, pTR, pBL, imgW, imgH);
      drawTexturedTriangle(ctx, image, pTR, pBR, pBL, imgW, imgH);
    }
  }

  // Apply procedural depth shading across the rendered garment bounds
  if (isFinite(minX) && minX < maxX) {
    shadingGen.applyShading(ctx, { minX, minY, maxX, maxY }, realism);
  }

  ctx.restore();
}
