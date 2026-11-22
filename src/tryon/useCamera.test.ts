import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCamera } from "./useCamera";

describe("useCamera state machine", () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: originalMediaDevices,
      configurable: true,
      writable: true,
    });
  });

  it("starts in idle state without requesting media automatically", () => {
    const { result } = renderHook(() => useCamera());
    expect(result.current.state).toBe("idle");
    expect(result.current.stream).toBeNull();
  });

  it("sets state to 'denied' when permission is rejected", async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue({
      name: "NotAllowedError",
      message: "Permission denied",
    });

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("denied");
    expect(result.current.errorMessage).toContain("denied");
  });

  it("sets state to 'no-camera' when device is not found", async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue({
      name: "NotFoundError",
      message: "No device found",
    });

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: mockGetUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("no-camera");
    expect(result.current.errorMessage).toContain("No camera");
  });

  it("sets state to 'unsupported' when mediaDevices or getUserMedia is absent", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("unsupported");
    expect(result.current.errorMessage).toContain("not supported");
  });

  it("stops all media tracks when the hook unmounts", async () => {
    const stopTrack = vi.fn();
    const mockTrack = { stop: stopTrack } as unknown as MediaStreamTrack;
    const mockStream = {
      getTracks: () => [mockTrack],
    } as unknown as MediaStream;

    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
      },
      configurable: true,
      writable: true,
    });

    const { result, unmount } = renderHook(() => useCamera());

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.state).toBe("active");
    expect(stopTrack).not.toHaveBeenCalled();

    unmount();

    expect(stopTrack).toHaveBeenCalledTimes(1);
  });
});
