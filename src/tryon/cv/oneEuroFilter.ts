import { Point2D } from "./types";

export interface OneEuroConfig {
  minCutoff?: number; // Minimum cutoff frequency in Hz (default: 1.0)
  beta?: number;      // Speed coefficient (default: 0.007)
  dCutoff?: number;   // Cutoff frequency for derivative (default: 1.0)
}

function alpha(rate: number, cutoff: number): number {
  const tau = 1.0 / (2 * Math.PI * cutoff);
  const te = 1.0 / rate;
  return 1.0 / (1.0 + tau / te);
}

export class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alphaVal: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = alphaVal * value + (1.0 - alphaVal) * this.s!;
    this.s = this.y;
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(config: OneEuroConfig = {}) {
    this.minCutoff = config.minCutoff ?? 1.0;
    this.beta = config.beta ?? 0.007;
    this.dCutoff = config.dCutoff ?? 1.0;
  }

  filter(val: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(val, 1.0);
    }

    const dt = Math.max((timestamp - this.lastTime) / 1000.0, 1e-5);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    const dx = this.xFilter.hasLast() ? (val - this.xFilter.last()) * rate : 0;
    const edx = this.dxFilter.filter(dx, alpha(rate, this.dCutoff));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(val, alpha(rate, cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

export class OneEuroFilter2D {
  private xFilt: OneEuroFilter1D;
  private yFilt: OneEuroFilter1D;

  constructor(config: OneEuroConfig = {}) {
    this.xFilt = new OneEuroFilter1D(config);
    this.yFilt = new OneEuroFilter1D(config);
  }

  filter(pt: Point2D, timestamp: number): Point2D {
    return {
      x: this.xFilt.filter(pt.x, timestamp),
      y: this.yFilt.filter(pt.y, timestamp),
    };
  }

  reset(): void {
    this.xFilt.reset();
    this.yFilt.reset();
  }
}
