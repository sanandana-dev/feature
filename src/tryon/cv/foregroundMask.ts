import { BackgroundModel } from "./types";

/**
 * Estimates global exposure/brightness gain from perimeter border pixels (assumed background).
 */
export function estimateExposureGain(
  frameData: Uint8ClampedArray,
  model: BackgroundModel
): number {
  const w = model.width;
  const h = model.height;
  let frameSum = 0;
  let bgSum = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 4 || x >= w - 4 || y < 4 || y >= h - 4) {
        const i = y * w + x;
        const srcIdx = i * 4;
        const dstIdx = i * 3;

        const fLum = frameData[srcIdx] * 0.299 + frameData[srcIdx + 1] * 0.587 + frameData[srcIdx + 2] * 0.114;
        const bgLum = model.mean[dstIdx] * 0.299 + model.mean[dstIdx + 1] * 0.587 + model.mean[dstIdx + 2] * 0.114;

        frameSum += fLum;
        bgSum += bgLum;
        count++;
      }
    }
  }

  if (bgSum < 10 || count === 0) return 1.0;
  const rawGain = frameSum / bgSum;
  return Math.min(1.6, Math.max(0.6, rawGain));
}

/**
 * Compares frame with background model.
 * A pixel is foreground if difference exceeds max(minThreshold, k * sigma) in >= 2 channels.
 */
export function computeForegroundMask(
  frameData: Uint8ClampedArray,
  model: BackgroundModel,
  gain = 1.0,
  k = 2.8,
  minThreshold = 18,
  outMask?: Uint8Array
): Uint8Array {
  const numPixels = model.width * model.height;
  const mask = outMask ?? new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const srcIdx = i * 4;
    const dstIdx = i * 3;
    let diffChannels = 0;

    for (let c = 0; c < 3; c++) {
      const normVal = frameData[srcIdx + c] / gain;
      const m = model.mean[dstIdx + c];
      const sigma = Math.sqrt(Math.max(1, model.variance[dstIdx + c]));
      const thresh = Math.max(minThreshold, k * sigma);

      if (Math.abs(normVal - m) > thresh) {
        diffChannels++;
      }
    }

    mask[i] = diffChannels >= 2 ? 255 : 0;
  }

  return mask;
}

/**
 * 3x3 morphological Open (erode -> dilate) followed by Close (dilate -> erode).
 */
export function cleanMaskMorphology(
  mask: Uint8Array,
  width: number,
  height: number,
  tempBuf?: Uint8Array
): Uint8Array {
  const len = width * height;
  const temp = tempBuf ?? new Uint8Array(len);
  const out = new Uint8Array(len);

  const erode = (src: Uint8Array, dst: Uint8Array) => {
    for (let y = 1; y < height - 1; y++) {
      const yOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = yOffset + x;
        if (
          src[idx] &&
          src[idx - 1] && src[idx + 1] &&
          src[idx - width] && src[idx + width] &&
          src[idx - width - 1] && src[idx - width + 1] &&
          src[idx + width - 1] && src[idx + width + 1]
        ) {
          dst[idx] = 255;
        } else {
          dst[idx] = 0;
        }
      }
    }
  };

  const dilate = (src: Uint8Array, dst: Uint8Array) => {
    for (let y = 1; y < height - 1; y++) {
      const yOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = yOffset + x;
        if (
          src[idx] ||
          src[idx - 1] || src[idx + 1] ||
          src[idx - width] || src[idx + width] ||
          src[idx - width - 1] || src[idx - width + 1] ||
          src[idx + width - 1] || src[idx + width + 1]
        ) {
          dst[idx] = 255;
        } else {
          dst[idx] = 0;
        }
      }
    }
  };

  // Open: Erode -> Dilate
  erode(mask, temp);
  dilate(temp, out);
  // Close: Dilate -> Erode
  dilate(out, temp);
  erode(temp, out);

  return out;
}

/**
 * Keeps only the largest connected component in the binary mask (flood-fill).
 */
export function keepLargestConnectedComponent(
  mask: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const len = width * height;
  const visited = new Uint8Array(len);
  const out = new Uint8Array(len);

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

        const x = idx % width;
        const y = Math.floor(idx / width);

        // 4-neighbors
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < width - 1 ? idx + 1 : -1,
          y > 0 ? idx - width : -1,
          y < height - 1 ? idx + width : -1,
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

  // Paint only the largest component
  for (const idx of maxComponentIndices) {
    out[idx] = 255;
  }

  return out;
}
