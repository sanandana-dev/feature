import { RealismLevel } from "../pose/types";

export class ShadingGenerator {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== "undefined") {
      this.offscreenCanvas = document.createElement("canvas");
      this.offscreenCanvas.width = 128;
      this.offscreenCanvas.height = 128;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
      this.generateFoldPattern();
    }
  }

  private generateFoldPattern(): void {
    const ctx = this.offscreenCtx;
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);

    // Procedural soft wrinkles across diagonal folds
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";

    // Soft folds
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.bezierCurveTo(40, 50, 70, 45, 110, 75);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(15, 80);
    ctx.bezierCurveTo(55, 65, 85, 95, 120, 85);
    ctx.stroke();

    // Subtle noise spots
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    for (let i = 0; i < 40; i++) {
      const rx = (i * 37) % 128;
      const ry = (i * 59) % 128;
      ctx.fillRect(rx, ry, 6, 6);
    }
  }

  /**
   * Applies procedural depth shading (vertical gradient, contact shadow, folds)
   * to the rendered garment path or canvas.
   */
  applyShading(
    ctx: CanvasRenderingContext2D,
    box: { minX: number; minY: number; maxX: number; maxY: number },
    level: RealismLevel = "high"
  ): void {
    const width = box.maxX - box.minX;
    const height = box.maxY - box.minY;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";

    // 1. Soft vertical gradient (darker near hem and underarms)
    const grad = ctx.createLinearGradient(0, box.minY, 0, box.maxY);
    grad.addColorStop(0, "rgba(255, 255, 255, 1.0)");
    grad.addColorStop(0.3, "rgba(250, 250, 250, 0.98)");
    grad.addColorStop(0.7, "rgba(235, 235, 238, 0.95)");
    grad.addColorStop(1.0, "rgba(215, 215, 220, 0.90)");

    ctx.fillStyle = grad;
    ctx.fillRect(box.minX, box.minY, width, height);

    if (level === "high" && this.offscreenCanvas) {
      // 2. Procedural fold texture
      ctx.globalAlpha = 0.45;
      const pattern = ctx.createPattern(this.offscreenCanvas, "repeat");
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(box.minX, box.minY, width, height);
      }
    }

    // 3. Collar contact shadow
    const collarShadow = ctx.createRadialGradient(
      box.minX + width / 2,
      box.minY + height * 0.08,
      10,
      box.minX + width / 2,
      box.minY + height * 0.08,
      width * 0.28
    );
    collarShadow.addColorStop(0, "rgba(0, 0, 0, 0.22)");
    collarShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = collarShadow;
    ctx.fillRect(box.minX, box.minY, width, height * 0.25);

    ctx.restore();
  }
}
