import { MeshGrid, MeshVertex } from "../cv/meshBuilder";
import { FabricType } from "../cv/types";

interface FabricParams {
  stiffness: number;
  damping: number;
  maxOffset: number;
}

const FABRIC_SETTINGS: Record<FabricType, FabricParams> = {
  flowy: { stiffness: 0.08, damping: 0.88, maxOffset: 28 },
  cotton: { stiffness: 0.18, damping: 0.82, maxOffset: 18 },
  heavy: { stiffness: 0.35, damping: 0.70, maxOffset: 10 },
};

export class ClothSimulator {
  private prevCollarX: number | null = null;
  private prevCollarY: number | null = null;
  private velocityOffsets: { vx: number; vy: number; ox: number; oy: number }[] = [];

  /**
   * Applies physics sway/lag to the lower rows of the mesh (hem and sides),
   * driven by torso velocity. Clamps offsets to prevent flicker or detachment.
   */
  simulate(
    grid: MeshGrid,
    fabric: FabricType = "cotton",
    reducedMotion: boolean = false
  ): MeshGrid {
    if (reducedMotion || grid.vertices.length === 0) {
      return grid;
    }

    const { stiffness, damping, maxOffset } = FABRIC_SETTINGS[fabric];

    // Center collar reference (top row middle)
    const midIdx = Math.floor(grid.cols / 2);
    const collar = grid.vertices[midIdx];
    if (!collar) return grid;

    let velX = 0;
    let velY = 0;
    if (this.prevCollarX !== null && this.prevCollarY !== null) {
      velX = Math.max(-30, Math.min(30, collar.x - this.prevCollarX));
      velY = Math.max(-30, Math.min(30, collar.y - this.prevCollarY));
    }
    this.prevCollarX = collar.x;
    this.prevCollarY = collar.y;

    if (this.velocityOffsets.length !== grid.vertices.length) {
      this.velocityOffsets = grid.vertices.map(() => ({ vx: 0, vy: 0, ox: 0, oy: 0 }));
    }

    const simulatedVertices: MeshVertex[] = grid.vertices.map((v, i) => {
      // Upper rows (v < 0.4) are rigidly anchored to body shoulders/neck
      if (v.v < 0.4) {
        return { ...v };
      }

      // Weight increases down towards the hem
      const weight = (v.v - 0.4) / 0.6;
      const state = this.velocityOffsets[i];

      // External force opposite to movement direction (lag effect)
      const forceX = -velX * 0.45 * weight;
      const forceY = -velY * 0.3 * weight;

      // Spring force returning to anchor position
      const springX = -state.ox * stiffness;
      const springY = -state.oy * stiffness;

      state.vx = (state.vx + forceX + springX) * damping;
      state.vy = (state.vy + forceY + springY) * damping;

      state.ox += state.vx;
      state.oy += state.vy;

      // Clamp max displacement
      const maxAllowed = maxOffset * weight;
      state.ox = Math.max(-maxAllowed, Math.min(maxAllowed, state.ox));
      state.oy = Math.max(-maxAllowed, Math.min(maxAllowed, state.oy));

      return {
        x: v.x + state.ox,
        y: v.y + state.oy,
        u: v.u,
        v: v.v,
      };
    });

    return {
      cols: grid.cols,
      rows: grid.rows,
      vertices: simulatedVertices,
    };
  }

  reset(): void {
    this.prevCollarX = null;
    this.prevCollarY = null;
    this.velocityOffsets = [];
  }
}
