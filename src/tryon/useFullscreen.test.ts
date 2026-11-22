import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFullscreen } from "./useFullscreen";

describe("useFullscreen hook", () => {
  let mockTarget: HTMLElement;
  let targetRef: { current: HTMLElement };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTarget = document.createElement("div");
    targetRef = { current: mockTarget };
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true, writable: true });
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true, writable: true });
  });

  it("enters native fullscreen when API is supported", async () => {
    const requestFsMock = vi.fn().mockResolvedValue(undefined);
    mockTarget.requestFullscreen = requestFsMock;
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true, writable: true });

    const { result } = renderHook(() => useFullscreen(targetRef));

    expect(result.current.isFullscreen).toBe(false);

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(requestFsMock).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.isPseudoFullscreen).toBe(false);
  });

  it("falls back to pseudo-fullscreen when API is rejected", async () => {
    const requestFsMock = vi.fn().mockRejectedValue(new Error("User denied"));
    mockTarget.requestFullscreen = requestFsMock;
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });

    const { result } = renderHook(() => useFullscreen(targetRef));

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(requestFsMock).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.isPseudoFullscreen).toBe(true);
  });

  it("falls back to pseudo-fullscreen when API is completely unsupported", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
    (mockTarget as unknown as { requestFullscreen: undefined }).requestFullscreen = undefined;

    const { result } = renderHook(() => useFullscreen(targetRef));

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.isPseudoFullscreen).toBe(true);
  });

  it("exits fullscreen correctly when toggled or exited", async () => {
    const exitFsMock = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFsMock;
    Object.defineProperty(document, "fullscreenElement", { value: mockTarget, configurable: true, writable: true });
    mockTarget.requestFullscreen = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useFullscreen(targetRef));

    await act(async () => {
      await result.current.enterFullscreen();
    });

    expect(result.current.isFullscreen).toBe(true);

    await act(async () => {
      await result.current.exitFullscreen();
    });

    expect(exitFsMock).toHaveBeenCalled();
    expect(result.current.isFullscreen).toBe(false);
  });
});
