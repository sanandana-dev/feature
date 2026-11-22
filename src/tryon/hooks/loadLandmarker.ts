/**
 * Dynamic lazy loader for MediaPipe Tasks Vision PoseLandmarker.
 * Self-hosted locally under /mediapipe/ (no CDN or external network calls).
 */
export async function loadPoseLandmarker(): Promise<unknown> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe");

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch {
    // GPU failed, fall back to CPU delegate
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }
}
