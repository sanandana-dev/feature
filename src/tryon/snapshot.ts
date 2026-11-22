/**
 * Zero-AI client-side snapshot helper for Live Mirror.
 * Composites the mirrored video frame and positioned/rotated shirt onto a 2D canvas
 * and triggers a client-side PNG download.
 */
export function captureMirrorSnapshot(
  video: HTMLVideoElement,
  viewport: HTMLElement,
  shirt: HTMLImageElement,
  rotate: number,
  dealId: string,
  blendMode: "realistic" | "solid",
  onUnavailable: () => void
): void {
  if (video.readyState < 2) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  try {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const vpRect = viewport.getBoundingClientRect();
    const shirtRect = shirt.getBoundingClientRect();
    const sx = canvas.width / vpRect.width;
    const sy = canvas.height / vpRect.height;
    const cx = (shirtRect.left + shirtRect.width / 2 - vpRect.left) * sx;
    const cy = (shirtRect.top + shirtRect.height / 2 - vpRect.top) * sy;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.globalCompositeOperation = blendMode === "realistic" ? "multiply" : "source-over";
    const dw = shirtRect.width * sx;
    const dh = shirtRect.height * sy;
    ctx.drawImage(shirt, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `style-preview-${dealId}.png`;
    a.click();
  } catch {
    onUnavailable();
  }
}
