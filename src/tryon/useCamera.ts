import { useState, useRef, useEffect, useCallback } from "react";

export type CameraState =
  | "idle"
  | "requesting"
  | "waiting-for-video"
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
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState("idle");
    setErrorMessage("");
  }, []);

  const startCamera = useCallback(
    async (preferredFacing: "user" | "environment" = facingMode) => {
      const isMediaSupported =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function";

      if (!isMediaSupported) {
        setState("unsupported");
        setErrorMessage("Camera access is not supported by this browser or requires HTTPS.");
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setState("requesting");
      setErrorMessage("");

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: preferredFacing,
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setState("waiting-for-video");

        try {
          if (typeof navigator.mediaDevices.enumerateDevices === "function") {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
          }
        } catch {}
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

  // Attach stream to video element and handle playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !stream) return;

    videoEl.srcObject = stream;

    const handleLoadedMetadata = () => {
      setState("active");
      try {
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } catch {}
    };

    videoEl.addEventListener("loadedmetadata", handleLoadedMetadata);

    try {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch {}

    if (videoEl.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      videoEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [stream]);

  // 5-second timeout for waiting-for-video state
  useEffect(() => {
    if (state !== "waiting-for-video") return;
    const timer = setTimeout(() => {
      setState("error");
      setErrorMessage("Camera is on but no video. Close other apps using the camera and try again");
    }, 5000);
    return () => clearTimeout(timer);
  }, [state]);

  // Stop camera on tab hidden (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        stopCamera();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    stream,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
