import { BackgroundModel } from "./types";
import { CV_CONFIG } from "./config";

/**
 * Estimates global exposure/brightness gain from perimeter border pixels.
 */
export function estimateExposureGain(
  frameData: Uint8ClampedArray,
  model: BackgroundModel,
  margin = CV_CONFIG.grid.borderMargin
): number {
  const w = model.width, h = model.height;
  let frameSum = 0, bgSum = 0, count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < margin || x >= w - margin || y < margin || y >= h - margin) {
        const i = y * w + x, s = i * 4, d = i * 3;
        frameSum += frameData[s] * 0.299 + frameData[s + 1] * 0.587 + frameData[s + 2] * 0.114;
        bgSum += model.mean[d] * 0.299 + model.mean[d + 1] * 0.587 + model.mean[d + 2] * 0.114;
        count++;
      }
    }
  }

  if (bgSum < 10 || count === 0) return 1.0;
  return Math.min(1.6, Math.max(0.6, frameSum / bgSum));
}

/**
 * Compares frame with background model.
 * Pixel is foreground if difference exceeds max(minThreshold, k * sigma) in >= 2 channels.
 */
export function computeForegroundMask(
  frameData: Uint8ClampedArray,
  model: BackgroundModel,
  gain = 1.0,
  k = CV_CONFIG.background.diffK,
  minThreshold = CV_CONFIG.background.minThreshold,
  outMask?: Uint8Array
): Uint8Array {
  const numPixels = model.width * model.height;
  const mask = outMask ?? new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const s = i * 4, d = i * 3;
    let diffChannels = 0;
    for (let c = 0; c < 3; c++) {
      const normVal = frameData[s + c] / gain;
      const sigma = Math.sqrt(Math.max(1, model.variance[d + c]));
      if (Math.abs(normVal - model.mean[d + c]) > Math.max(minThreshold, k * sigma)) {
        diffChannels++;
      }
    }
    mask[i] = diffChannels >= 2 ? 255 : 0;
  }
  return mask;
}

/**
 * Motion assist: uses consecutive frame differencing as a secondary cue
 * to preserve foreground pixels when standing still. Never creates shapes on its own.
 */
export function applyMotionAssist(
  mask: Uint8Array,
  frameData: Uint8ClampedArray,
  prevFrameData: Uint8ClampedArray | null,
  width: number,
  height: number,
  diffThreshold = CV_CONFIG.motionAssist.diffThreshold
): void {
  if (!prevFrameData) return;
  const numPixels = width * height;
  for (let i = 0; i < numPixels; i++) {
    if (mask[i] === 0) {
      const x = i % width, y = Math.floor(i / width);
      const hasFg = (x > 0 && mask[i - 1] === 255) || (x < width - 1 && mask[i + 1] === 255) ||
                    (y > 0 && mask[i - width] === 255) || (y < height - 1 && mask[i + width] === 255);
      if (hasFg) {
        const s = i * 4;
        const d = (Math.abs(frameData[s] - prevFrameData[s]) +
                   Math.abs(frameData[s + 1] - prevFrameData[s + 1]) +
                   Math.abs(frameData[s + 2] - prevFrameData[s + 2])) / 3;
        if (d > diffThreshold) mask[i] = 255;
      }
    }
  }
}

/**
 * 3x3 morphological Open (erode -> dilate) followed by Close (dilate -> erode).
 */
export function cleanMaskMorphology(
  mask: Uint8Array,
  width: number,
  height: number,
  tempBuf?: Uint8Array,
  outBuf?: Uint8Array
): Uint8Array {
  const len = width * height;
  const temp = tempBuf ?? new Uint8Array(len);
  const out = outBuf ?? new Uint8Array(len);

  const erode = (src: Uint8Array, dst: Uint8Array) => {
    for (let y = 1; y < height - 1; y++) {
      const off = y * width;
      for (let x = 1; x < width - 1; x++) {
        const i = off + x;
        dst[i] = (src[i] && src[i - 1] && src[i + 1] &&
                  src[i - width] && src[i + width] &&
                  src[i - width - 1] && src[i - width + 1] &&
                  src[i + width - 1] && src[i + width + 1]) ? 255 : 0;
      }
    }
  };

  const dilate = (src: Uint8Array, dst: Uint8Array) => {
    for (let y = 1; y < height - 1; y++) {
      const off = y * width;
      for (let x = 1; x < width - 1; x++) {
        const i = off + x;
        dst[i] = (src[i] || src[i - 1] || src[i + 1] ||
                  src[i - width] || src[i + width] ||
                  src[i - width - 1] || src[i - width + 1] ||
                  src[i + width - 1] || src[i + width + 1]) ? 255 : 0;
      }
    }
  };

  erode(mask, temp);
  dilate(temp, out);
  dilate(out, temp);
  erode(temp, out);
  return out;
}

/**
 * Keeps the largest connected component and fills enclosed interior holes.
 */
export function keepLargestConnectedComponent(
  mask: Uint8Array,
  width: number,
  height: number,
  outBuf?: Uint8Array
): Uint8Array {
  const len = width * height;
  const visited = new Uint8Array(len);
  const out = outBuf ?? new Uint8Array(len);
  out.fill(0);

  let maxComponentSize = 0;
  let maxComponentIndices: number[] = [];
  const queue: number[] = [];

  for (let i = 0; i < len; i++) {
    if (mask[i] === 255 && !visited[i]) {
      let currentSize = 0;
      const currentIndices: number[] = [];
      queue.push(i);
      visited[i] = 1;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        currentSize++;
        currentIndices.push(idx);

        const x = idx % width, y = Math.floor(idx / width);
        const neighbors = [
          x > 0 ? idx - 1 : -1, x < width - 1 ? idx + 1 : -1,
          y > 0 ? idx - width : -1, y < height - 1 ? idx + width : -1,
        ];

        for (const n of neighbors) {
          if (n !== -1 && mask[n] === 255 && !visited[n]) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }

      if (currentSize > maxComponentSize) {
        maxComponentSize = currentSize;
        maxComponentIndices = currentIndices;
      }
    }
  }

  for (const idx of maxComponentIndices) out[idx] = 255;

  // Fill small interior enclosed holes (row-wise scan between left and right bounds)
  for (let y = 0; y < height; y++) {
    const yOff = y * width;
    let l = -1, r = -1;
    for (let x = 0; x < width; x++) {
      if (out[yOff + x] === 255) { if (l === -1) l = x; r = x; }
    }
    if (l !== -1 && r > l + 2) {
      let runStart = -1;
      for (let x = l + 1; x < r; x++) {
        if (out[yOff + x] === 0) {
          if (runStart === -1) runStart = x;
        } else if (runStart !== -1) {
          if (x - runStart <= 12) {
            for (let fillX = runStart; fillX < x; fillX++) out[yOff + fillX] = 255;
          }
          runStart = -1;
        }
      }
    }
  }

  return out;
}

/**
 * Temporal smoothing with previous mask to eliminate frame-to-frame flicker.
 */
export function applyTemporalSmoothing(
  currentMask: Uint8Array,
  prevMask: Uint8Array | null,
  width: number,
  height: number,
  alpha = CV_CONFIG.temporalMask.decayAlpha
): Uint8Array {
  if (!prevMask) return currentMask;
  const len = width * height;
  for (let i = 0; i < len; i++) {
    if (currentMask[i] === 0 && prevMask[i] === 255) {
      const x = i % width, y = Math.floor(i / width);
      const nearCurrent =
        (x > 0 && currentMask[i - 1] === 255) || (x < width - 1 && currentMask[i + 1] === 255) ||
        (y > 0 && currentMask[i - width] === 255) || (y < height - 1 && currentMask[i + width] === 255);
      if (nearCurrent && Math.random() < alpha) currentMask[i] = 255;
    }
  }
  return currentMask;
}
