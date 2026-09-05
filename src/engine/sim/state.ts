/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Point, Stroke } from '../../core/types';
import type { EngineEntity, EngineParticle } from './types';

/**
 * Mutable world + mirror state shared by the RAF loop, the pointer handlers
 * and the cast logic. The component owns exactly one instance in a ref for the
 * lifetime of the mount; subsystems read & write these fields directly so the
 * mount-once simulation never closes over stale React state.
 */
export interface SimState {
  /** Persistent simulation bodies (light spheres, pillars, vines, ...). */
  entities: EngineEntity[];
  /** Visual effect particles. */
  particles: EngineParticle[];
  /** Mirror of the component's stroke React state, read every RAF frame. */
  strokes: { completed: Stroke[]; current: Point[] };
  /** Entity currently being dragged by the pointer, if any. */
  dragEntityId: string | null;
  /** Latest pointer position in CSS canvas pixels (monster-arm target). */
  lastPointer: Point;
  /** True while a casting transition flash is running. */
  castingTrans: boolean;
  /** True while the invisibility shroud is active. */
  isInvisActive: boolean;
}

/** Builds an empty simulation state for a component mount. */
export function createSimState(): SimState {
  return {
    entities: [],
    particles: [],
    strokes: { completed: [], current: [] },
    dragEntityId: null,
    lastPointer: { x: 0, y: 0 },
    castingTrans: false,
    isInvisActive: false,
  };
}

/** Per-frame aggregate flags derived once per RAF tick and shared by subsystems. */
export interface FrameFlags {
  /** The single active vortex light sphere, if any. */
  activeVortex: EngineEntity | null;
  /** True while any sleep-mist particle is on screen. */
  isSleepMistActive: boolean;
  /** True while a safety-hover gravity bubble exists. */
  isSafetyHoverActive: boolean;
}

/** Derives the shared force flags exactly like the original frame preamble. */
export function computeFrameFlags(sim: SimState): FrameFlags {
  const activeVortex =
    sim.entities.find((e) => e.type === 'light_sphere' && e.data.isVortex) ?? null;
  const isSleepMistActive = sim.particles.some((p) => p.type === 'mist');
  const isSafetyHoverActive = sim.entities.some(
    (e) => e.type === 'light_sphere' && e.data.isGravityBubble
  );
  return { activeVortex, isSleepMistActive, isSafetyHoverActive };
}

/** Logical (CSS-pixel) surface box for the current backing store + dpr. */
export function logicalBox(canvas: HTMLCanvasElement, dpr: number): { w: number; h: number } {
  return {
    w: Math.round(canvas.width / dpr),
    h: Math.round(canvas.height / dpr),
  };
}
