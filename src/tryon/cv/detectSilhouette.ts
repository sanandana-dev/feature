import { BackgroundModel, BodyMeasurements } from "./types";
import { estimateExposureGain, computeForegroundMask, cleanMaskMorphology, keepLargestConnectedComponent } from "./foregroundMask";
import { extractRowProfiles, deriveBodyMeasurements } from "./silhouetteMeasurements";
import { updateBackgroundModel, detectCameraBump } from "./backgroundModel";

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
  prevM: BodyMeasurements | null
): DetectSilhouetteResult {
  const gain = estimateExposureGain(frameData, model);
  const rawMask = computeForegroundMask(frameData, model, gain);
  const cleanedMask = cleanMaskMorphology(rawMask, width, height);
  const finalMask = keepLargestConnectedComponent(cleanedMask, width, height);

  const bumped = detectCameraBump(frameData, model, finalMask);
  updateBackgroundModel(model, frameData, finalMask, 0.01);

  const profiles = extractRowProfiles(finalMask, width, height);
  const measurements = deriveBodyMeasurements(profiles, width, height, prevM);

  return {
    mask: finalMask,
    measurements,
    bumped,
  };
}
