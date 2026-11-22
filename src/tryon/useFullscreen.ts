import { useState, useEffect, useCallback } from "react";

export function useFullscreen(targetRef: React.RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const isNativeSupported =
    typeof document !== "undefined" &&
    Boolean(
      document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
    );

  const enterFullscreen = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;

    if (isNativeSupported) {
      try {
        const req =
          el.requestFullscreen ||
          (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
        if (typeof req === "function") {
          await req.call(el);
          setIsFullscreen(true);
          return;
        }
      } catch {
        // Rejected or blocked (e.g. user gesture expired or iframe permissions) -> fallback
      }
    }

    // Fallback: pseudo fullscreen
    setIsPseudoFullscreen(true);
    setIsFullscreen(true);
  }, [targetRef, isNativeSupported]);

  const exitFullscreen = useCallback(async () => {
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      setIsFullscreen(false);
      return;
    }

    const doc = document as unknown as {
      exitFullscreen?: () => Promise<void>;
      webkitExitFullscreen?: () => Promise<void>;
      fullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
    };

    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      try {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        if (typeof exit === "function") {
          await exit.call(document);
        }
      } catch {}
    }

    setIsFullscreen(false);
    setIsPseudoFullscreen(false);
  }, [isPseudoFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as unknown as {
        fullscreenElement?: Element | null;
        webkitFullscreenElement?: Element | null;
      };
      const nativeActive = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!nativeActive && !isPseudoFullscreen) {
        setIsFullscreen(false);
      } else if (nativeActive) {
        setIsFullscreen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPseudoFullscreen) {
        exitFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPseudoFullscreen, exitFullscreen]);

  // Cleanup on unmount: exit fullscreen if currently active
  useEffect(() => {
    return () => {
      const doc = document as unknown as {
        exitFullscreen?: () => Promise<void>;
        fullscreenElement?: Element | null;
      };
      if (doc.fullscreenElement && typeof doc.exitFullscreen === "function") {
        doc.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  return {
    isFullscreen,
    isPseudoFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
