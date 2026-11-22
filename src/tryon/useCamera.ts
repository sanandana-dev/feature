import { useState, useRef, useEffect, useCallback } from "react";

export type CameraState =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "no-camera"
  | "error"
  | "unsupported";

export function useCamera() {
  const [state, setState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("idle");
    setErrorMessage("");
  }, []);

  const startCamera = useCallback(
    async (preferredFacing: "user" | "environment" = facingMode) => {
      // 1. Check support & secure context
      const isMediaSupported =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function";

      if (!isMediaSupported) {
        setState("unsupported");
        setErrorMessage("Camera access is not supported by this browser or requires HTTPS.");
        return;
      }

      // Stop any existing stream before starting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setState("requesting");
      setErrorMessage("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: preferredFacing,
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState("active");

        // Enumerate devices to check if multiple cameras exist
        try {
          if (typeof navigator.mediaDevices.enumerateDevices === "function") {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((d) => d.kind === "videoinput");
            setHasMultipleCameras(videoInputs.length > 1);
          }
        } catch {
          // Non-critical: keep hasMultipleCameras false
        }
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        const errName = error?.name || "";

        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setState("denied");
          setErrorMessage("Camera permission was denied. Please allow camera access in browser settings.");
        } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
          setState("no-camera");
          setErrorMessage("No camera was found on your device.");
        } else {
          setState("error");
          setErrorMessage("Camera is in use by another app or could not be accessed.");
        }
      }
    },
    [facingMode]
  );

  const switchCamera = useCallback(async () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  }, [facingMode, startCamera]);

  // Stop camera on tab hidden (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stopCamera]);

  // Stop tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    state,
    errorMessage,
    hasMultipleCameras,
    videoRef,
    stream: streamRef.current,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
