import { Point2D, VideoNaturalSize, ViewportBox } from "./types";

/**
 * Maps a normalized point [0, 1] from the video frame to viewport pixel coordinates,
 * accounting for object-fit: cover cropping and optional horizontal mirroring.
 */
export function mapLandmarkToViewport(
  pt: Point2D,
  videoNatural: VideoNaturalSize,
  viewport: ViewportBox,
  mirrored: boolean
): Point2D {
  const { videoWidth, videoHeight } = videoNatural;
  const { width: vpWidth, height: vpHeight } = viewport;

  if (videoWidth <= 0 || videoHeight <= 0 || vpWidth <= 0 || vpHeight <= 0) {
    return { x: 0, y: 0 };
  }

  // Calculate object-fit: cover scale factor
  const scale = Math.max(vpWidth / videoWidth, vpHeight / videoHeight);
  const scaledWidth = videoWidth * scale;
  const scaledHeight = videoHeight * scale;

  // Cropping offsets (centering the video)
  const offsetX = (vpWidth - scaledWidth) / 2;
  const offsetY = (vpHeight - scaledHeight) / 2;

  // Mirroring horizontally if requested (webcam selfie mirror)
  const normX = mirrored ? 1 - pt.x : pt.x;
  const normY = pt.y;

  return {
    x: normX * scaledWidth + offsetX,
    y: normY * scaledHeight + offsetY,
  };
}
