import { BodyMeasurements } from "./types";

export interface TrackingStateConfig {
  lostTimeoutMs?: number; // Time before fading starts (default 400ms)
  fadeDurationMs?: number; // Time to fade out/in (default 200ms)
}

export class TrackingStateManager {
  private lastConfidentTime: number = 0;
  private lastTime: number = 0;
  private opacity: number = 0;
  private lastValidMeasurements: BodyMeasurements | null = null;
  private lostTimeoutMs: number;
  private fadeDurationMs: number;

  constructor(config: TrackingStateConfig = {}) {
    this.lostTimeoutMs = config.lostTimeoutMs ?? 400;
    this.fadeDurationMs = config.fadeDurationMs ?? 200;
  }

  update(
    newMeasurements: BodyMeasurements | null,
    now: number
  ): {
    measurements: BodyMeasurements | null;
    opacity: number;
    status: "tracking" | "lost";
  } {
    const dt = this.lastTime > 0 ? Math.min(100, Math.max(1, now - this.lastTime)) : 16.6;
    this.lastTime = now;

    const isConfident = newMeasurements !== null && newMeasurements.confidence >= 0.5;

    if (isConfident) {
      this.lastConfidentTime = now;
      this.lastValidMeasurements = newMeasurements;
      this.opacity = Math.min(1.0, this.opacity + dt / this.fadeDurationMs);
    } else {
      const timeSinceConfident = now - this.lastConfidentTime;
      if (timeSinceConfident >= this.lostTimeoutMs) {
        this.opacity = Math.max(0.0, this.opacity - dt / this.fadeDurationMs);
      }
    }

    const status = this.opacity > 0.05 ? "tracking" : "lost";
    return {
      measurements: this.lastValidMeasurements,
      opacity: this.opacity,
      status,
    };
  }

  reset(): void {
    this.lastConfidentTime = 0;
    this.lastTime = 0;
    this.opacity = 0;
    this.lastValidMeasurements = null;
  }
}
