import { BackgroundModel } from "./types";

export function createBackgroundModel(width: number, height: number): BackgroundModel {
  const pixelCount = width * height;
  return {
    width,
    height,
    mean: new Float32Array(pixelCount * 3),
    variance: new Float32Array(pixelCount * 3),
    count: 0,
  };
}

/**
 * Accumulates a frame into the background model using Welford's online variance algorithm.
 */
export function accumulateFrame(model: BackgroundModel, frameData: Uint8ClampedArray): void {
  model.count++;
  const k = model.count;
  const numPixels = model.width * model.height;

  for (let i = 0; i < numPixels; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;

    for (let c = 0; c < 3; c++) {
      const val = frameData[srcIdx + c];
      const prevMean = model.mean[dstIdx + c];
      const delta = val - prevMean;
      const newMean = prevMean + delta / k;
      model.mean[dstIdx + c] = newMean;
      model.variance[dstIdx + c] += delta * (val - newMean);
    }
  }
}

/**
 * Finalizes the model and checks if the captured background is steady and valid.
 * Returns false if frames differed too much (motion) or frame is flat color.
 */
export function finalizeBackgroundModel(model: BackgroundModel): boolean {
  if (model.count < 5) return false;

  const numPixels = model.width * model.height;
  const divisor = Math.max(1, model.count - 1);
  let totalVar = 0;
  let minMean = 255;
  let maxMean = 0;

  for (let i = 0; i < numPixels; i++) {
    const dstIdx = i * 3;
    for (let c = 0; c < 3; c++) {
      const v = model.variance[dstIdx + c] / divisor;
      model.variance[dstIdx + c] = v;
      totalVar += v;
      const m = model.mean[dstIdx + c];
      if (m < minMean) minMean = m;
      if (m > maxMean) maxMean = m;
    }
  }

  const avgVar = totalVar / (numPixels * 3);
  // Unsteady background check (someone was moving during capture)
  if (avgVar > 450) {
    return false;
  }

  // Flat color check (e.g. camera covered or solid black frame)
  if (maxMean - minMean < 12) {
    return false;
  }

  return true;
}

/**
 * Slowly updates the background model via running average (alpha ~ 0.01)
 * ONLY for pixels classified as background (mask[i] === 0).
 */
export function updateBackgroundModel(
  model: BackgroundModel,
  frameData: Uint8ClampedArray,
  mask: Uint8Array,
  alpha = 0.01
): void {
  const numPixels = model.width * model.height;
  for (let i = 0; i < numPixels; i++) {
    if (mask[i] === 0) { // Background pixel
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      for (let c = 0; c < 3; c++) {
        const val = frameData[srcIdx + c];
        model.mean[dstIdx + c] = (1 - alpha) * model.mean[dstIdx + c] + alpha * val;
      }
    }
  }
}

/**
 * Detects if the camera was bumped or moved:
 * - Foreground covers more than 70% of frame.
 * - Or border perimeter patches (assumed static background) differ substantially.
 */
export function detectCameraBump(
  frameData: Uint8ClampedArray,
  model: BackgroundModel,
  mask: Uint8Array
): boolean {
  const numPixels = model.width * model.height;
  let fgCount = 0;
  for (let i = 0; i < numPixels; i++) {
    if (mask[i] > 0) fgCount++;
  }

  // Foreground covers > 70% of frame
  if (fgCount / numPixels > 0.70) {
    return true;
  }

  // Check border pixels (first & last 2 rows and columns)
  let borderDiff = 0;
  let borderCount = 0;
  const w = model.width;
  const h = model.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 3 || x >= w - 3 || y < 3 || y >= h - 3) {
        const i = y * w + x;
        const srcIdx = i * 4;
        const dstIdx = i * 3;
        const diffR = Math.abs(frameData[srcIdx] - model.mean[dstIdx]);
        const diffG = Math.abs(frameData[srcIdx + 1] - model.mean[dstIdx + 1]);
        const diffB = Math.abs(frameData[srcIdx + 2] - model.mean[dstIdx + 2]);
        borderDiff += (diffR + diffG + diffB) / 3;
        borderCount++;
      }
    }
  }

  const avgBorderDiff = borderDiff / Math.max(1, borderCount);
  return avgBorderDiff > 32;
}
