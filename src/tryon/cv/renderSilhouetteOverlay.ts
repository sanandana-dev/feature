export function renderSilhouetteOverlay(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
  gridWidth: number,
  gridHeight: number
): void {
  ctx.save();
  ctx.fillStyle = "rgba(59, 130, 246, 0.35)";
  const sx = canvasWidth / gridWidth;
  const sy = canvasHeight / gridHeight;

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (mask[y * gridWidth + x] === 255) {
        ctx.fillRect((gridWidth - 1 - x) * sx, y * sy, sx, sy);
      }
    }
  }
  ctx.restore();
}
