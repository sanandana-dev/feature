import { BackgroundModel, BodyMeasurements } from "./types";
import {
  estimateExposureGain,
  computeForegroundMask,
  applyMotionAssist,
  cleanMaskMorphology,
  keepLargestConnectedComponent,
  applyTemporalSmoothing,
} from "./foregroundMask";
import { extractRowProfiles, deriveBodyMeasurements } from "./silhouetteMeasurements";
import { updateBackgroundModel, detectCameraBump } from "./backgroundModel";
import { Profile } from "../types";

export interface DetectBuffers {
  rawMask: Uint8Array;
  tempBuf: Uint8Array;
  cleanedMask: Uint8Array;
  finalMask: Uint8Array;
}

export interface DetectSilhouetteResult {
  mask: Uint8Array;
  measurements: BodyMeasurements | null;
  bumped: boolean;
}

export function detectSilhouette(
  frameData: Uint8ClampedArray,
  model: BackgroundModel,
  width: number,
  height: number,
  prevM: BodyMeasurements | null,
  profilePrior?: Profile,
  prevFrameData: Uint8ClampedArray | null = null,
  prevMask: Uint8Array | null = null,
  buffers?: DetectBuffers
): DetectSilhouetteResult {
  const numPixels = width * height;
  const rawMask = buffers?.rawMask ?? new Uint8Array(numPixels);
  const tempBuf = buffers?.tempBuf ?? new Uint8Array(numPixels);
  const cleanedMask = buffers?.cleanedMask ?? new Uint8Array(numPixels);
  const finalMaskBuf = buffers?.finalMask ?? new Uint8Array(numPixels);

  const gain = estimateExposureGain(frameData, model);
  computeForegroundMask(frameData, model, gain, undefined, undefined, rawMask);

  // Motion assist to preserve foreground when still
  applyMotionAssist(rawMask, frameData, prevFrameData, width, height);

  cleanMaskMorphology(rawMask, width, height, tempBuf, cleanedMask);
  const componentMask = keepLargestConnectedComponent(cleanedMask, width, height, finalMaskBuf);

  // Temporal smoothing to prevent edge flicker
  const smoothedMask = applyTemporalSmoothing(componentMask, prevMask, width, height);

  const bumped = detectCameraBump(frameData, model, smoothedMask);
  updateBackgroundModel(model, frameData, smoothedMask);

  const profiles = extractRowProfiles(smoothedMask, width, height);
  const measurements = deriveBodyMeasurements(profiles, width, height, prevM, profilePrior);

  return {
    mask: smoothedMask,
    measurements,
    bumped,
  };
}
